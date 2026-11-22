import { prisma } from '../lib/prisma';
import { whatsappService } from './whatsappService';
import { pushNotificationService } from './pushNotificationService';
import crypto from 'crypto';

// ==============================================================================
// MÁQUINA DE ESTADOS Y CONTROLADOR CONVERSACIONAL DEL BOT DE WHATSAPP
// ==============================================================================

type EstadoConversacion =
  | 'IDLE'
  | 'ESPERANDO_ORIGEN'
  | 'ESPERANDO_DESTINO'
  | 'CONFIRMANDO_COTIZACION';

interface SesionClienteWhatsApp {
  telefono: string;
  estado: EstadoConversacion;
  nombre?: string;
  origen?: string;
  origenLat?: number;
  origenLon?: number;
  destino?: string;
  destinoLat?: number;
  destinoLon?: number;
  distanciaKm?: number;
  precioEstimado?: number;
  updatedAt: number;
}

// Almacenamiento en memoria de sesiones activas (expiran a los 30 minutos de inactividad)
const sesionesMap = new Map<string, SesionClienteWhatsApp>();

function getSesion(telefono: string): SesionClienteWhatsApp {
  const cleanTel = whatsappService.formatearNumero(telefono);
  const ahora = Date.now();
  let sesion = sesionesMap.get(cleanTel);

  // Si la sesión expiró tras 30 minutos de inactividad, reiniciarla
  if (sesion && ahora - sesion.updatedAt > 30 * 60 * 1000) {
    sesionesMap.delete(cleanTel);
    sesion = undefined;
  }

  if (!sesion) {
    sesion = {
      telefono: cleanTel,
      estado: 'IDLE',
      updatedAt: ahora,
    };
    sesionesMap.set(cleanTel, sesion);
  } else {
    sesion.updatedAt = ahora;
  }

  return sesion;
}

function resetSesion(telefono: string) {
  const cleanTel = whatsappService.formatearNumero(telefono);
  sesionesMap.delete(cleanTel);
}

// Cálculo de distancia euclidiana / haversine para estimar Km
function calcularDistanciaKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radio de la Tierra en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 10) / 10;
}

export const whatsappBotService = {
  /**
   * Procesa cualquier mensaje entrante de un usuario por WhatsApp
   */
  async procesarMensaje(params: {
    from: string;
    messageId: string;
    tipo: 'text' | 'interactive' | 'location';
    texto?: string;
    botonId?: string;
    location?: { latitude: number; longitude: number; name?: string; address?: string };
    senderName?: string;
  }) {
    const { from, messageId, tipo, texto, botonId, location, senderName } = params;
    const cleanFrom = whatsappService.formatearNumero(from);
    const sesion = getSesion(cleanFrom);

    // Marcar como leído
    whatsappService.marcarComoLeido(messageId).catch(() => {});

    // 1. Identificar o registrar al cliente en la base de datos
    let cliente = await prisma.cliente.findFirst({
      where: {
        OR: [
          { telefono: cleanFrom },
          { telefono: { contains: cleanFrom.slice(-8) } }, // Coincidencia por últimos 8 dígitos
        ],
      },
      include: {
        remiseria: true,
      },
    });

    const nombreMostrado = cliente?.nombre || senderName || 'Pasajero';
    sesion.nombre = nombreMostrado;

    // Obtener remisería principal
    let remiseria = cliente?.remiseria;
    if (!remiseria) {
      remiseria = await prisma.remiseria.findFirst();
    }
    const remiseriaId = remiseria?.id || '';
    const bajadaBandera = remiseria?.bajadaBandera || 3500;
    const valorKm = remiseria?.valorKm || 800;

    // 2. Comandos globales directos (reiniciar, cancelar, estado, operador)
    const textoLower = (texto || '').trim().toLowerCase();
    const actionId = botonId || '';

    if (actionId === 'BTN_CANCELAR' || textoLower === 'cancelar' || textoLower === 'salir') {
      resetSesion(cleanFrom);
      return await whatsappService.enviarBotones(
        cleanFrom,
        '❌ Pedido cancelado. ¡Cuando nos necesites volvé a escribirnos!',
        [{ id: 'BTN_PEDIR', title: '🚕 Pedir un Remís' }]
      );
    }

    if (actionId === 'BTN_OPERADOR' || textoLower === 'operador' || textoLower === 'central') {
      const telFijo = remiseria?.telefono || '2346-427637';
      return await whatsappService.enviarTexto(
        cleanFrom,
        `📞 Podés comunicarte directamente con nuestros operadores a los teléfonos fijos:\n☎️ ${telFijo}\n☎️ 2346-433000\n\nEstamos a tu disposición las 24 horas.`
      );
    }

    if (actionId === 'BTN_ESTADO' || textoLower === 'estado') {
      return await this.consultarEstadoViaje(cleanFrom, cliente?.id);
    }

    // 3. Manejo según estado de la conversación
    switch (sesion.estado) {
      case 'IDLE': {
        // Si el usuario presionó el botón de pedir o escribió "pedir", "remis", "auto", "viaje"
        if (
          actionId === 'BTN_PEDIR' ||
          textoLower.includes('pedir') ||
          textoLower.includes('remis') ||
          textoLower.includes('auto') ||
          textoLower.includes('viaje')
        ) {
          sesion.estado = 'ESPERANDO_ORIGEN';
          return await whatsappService.enviarTexto(
            cleanFrom,
            `📍 *¿Dónde te pasamos a buscar?*\n\nPodés:\n1. 📎 Compartir tu *ubicación GPS* desde el clip de WhatsApp.\n2. ✍️ O escribir la calle y altura (ej: *Rivadavia 250*).`
          );
        }

        // Si ya tiene un viaje activo en curso, mostrarle el estado directo
        const viajeActivo = await prisma.viaje.findFirst({
          where: {
            OR: [
              { clienteTelefono: cleanFrom },
              { clienteId: cliente?.id },
            ],
            estado: { in: ['PENDIENTE', 'ACEPTADO', 'EN_CAMINO', 'EN_CURSO'] },
          },
        });

        if (viajeActivo) {
          return await this.consultarEstadoViaje(cleanFrom, cliente?.id);
        }

        // Saludo de bienvenida y menú principal
        const mensajeBienvenida = `👋 ¡Hola, *${nombreMostrado}*! Bienvenido a *Remises Bruno*.\n¿En qué te podemos ayudar hoy?`;
        return await whatsappService.enviarBotones(cleanFrom, mensajeBienvenida, [
          { id: 'BTN_PEDIR', title: '🚕 Pedir un Remís' },
          { id: 'BTN_ESTADO', title: '📍 Estado de mi viaje' },
          { id: 'BTN_OPERADOR', title: '📞 Hablar con Central' },
        ]);
      }

      case 'ESPERANDO_ORIGEN': {
        if (tipo === 'location' && location) {
          sesion.origenLat = location.latitude;
          sesion.origenLon = location.longitude;
          sesion.origen = location.address || location.name || `Ubicación GPS (${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)})`;
        } else if (texto && texto.trim().length >= 3) {
          sesion.origen = texto.trim();
        } else {
          return await whatsappService.enviarTexto(
            cleanFrom,
            '⚠️ Por favor enviá una dirección válida o compartí tu ubicación GPS desde WhatsApp.'
          );
        }

        sesion.estado = 'ESPERANDO_DESTINO';
        return await whatsappService.enviarTexto(
          cleanFrom,
          `✅ *Origen registrado:* ${sesion.origen}\n\n🏁 *¿Hacia dónde te llevamos?*\nEscribí la dirección o punto de destino (ej: *Av. Sarmiento 500*, *Hospital Municipal*, etc.):`
        );
      }

      case 'ESPERANDO_DESTINO': {
        if (tipo === 'location' && location) {
          sesion.destinoLat = location.latitude;
          sesion.destinoLon = location.longitude;
          sesion.destino = location.address || location.name || `Destino GPS (${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)})`;
        } else if (texto && texto.trim().length >= 3) {
          sesion.destino = texto.trim();
        } else {
          return await whatsappService.enviarTexto(
            cleanFrom,
            '⚠️ Por favor escribí la dirección hacia dónde te llevamos.'
          );
        }

        // Calcular distancia y precio estimado
        let dist = 2.5; // Distancia estándar urbana por defecto
        if (sesion.origenLat && sesion.origenLon && sesion.destinoLat && sesion.destinoLon) {
          dist = calcularDistanciaKm(sesion.origenLat, sesion.origenLon, sesion.destinoLat, sesion.destinoLon);
          if (dist < 0.5) dist = 0.8;
        }

        const precioGpsPuro = dist > 1 ? bajadaBandera + (dist - 1) * valorKm : bajadaBandera;
        const precioEstimado = Math.round(precioGpsPuro / 100) * 100;

        sesion.distanciaKm = dist;
        sesion.precioEstimado = precioEstimado;
        sesion.estado = 'CONFIRMANDO_COTIZACION';

        const resumen =
          `📋 *Resumen de tu viaje:*\n` +
          `━━━━━━━━━━━━━━━━━━━\n` +
          `🟢 *Origen:* ${sesion.origen}\n` +
          `🔴 *Destino:* ${sesion.destino}\n` +
          `📏 *Distancia:* ~${dist} km\n` +
          `💵 *Precio estimado:* *$${precioEstimado.toLocaleString('es-AR')}* _(Efectivo)_\n` +
          `━━━━━━━━━━━━━━━━━━━\n` +
          `¿Deseas solicitar el móvil ahora?`;

        return await whatsappService.enviarBotones(
          cleanFrom,
          resumen,
          [
            { id: 'BTN_CONFIRMAR', title: '✅ Confirmar Pedido' },
            { id: 'BTN_CANCELAR', title: '❌ Cancelar' },
          ],
          'Cotización de Viaje'
        );
      }

      case 'CONFIRMANDO_COTIZACION': {
        if (actionId === 'BTN_CONFIRMAR' || textoLower.includes('si') || textoLower.includes('confirmar')) {
          return await this.crearViajeDesdeWhatsApp(cleanFrom, sesion, cliente, remiseriaId);
        } else {
          return await whatsappService.enviarBotones(
            cleanFrom,
            '¿Querés confirmar el viaje o cancelarlo?',
            [
              { id: 'BTN_CONFIRMAR', title: '✅ Confirmar Pedido' },
              { id: 'BTN_CANCELAR', title: '❌ Cancelar' },
            ]
          );
        }
      }
    }
  },

  /**
   * Crea el Viaje en la base de datos de Remises Bruno y lo dispara a Central y Choferes
   */
  async crearViajeDesdeWhatsApp(
    cleanFrom: string,
    sesion: SesionClienteWhatsApp,
    clienteExistente: any,
    remiseriaId: string
  ) {
    try {
      const trackingToken = crypto.randomBytes(16).toString('hex');
      const codigoPin = Math.floor(1000 + Math.random() * 9000).toString();
      const origen = sesion.origen || 'Origen solicitado por WhatsApp';
      const destino = sesion.destino || 'Destino a convenir';
      const precio = sesion.precioEstimado || 3500;
      const clienteNombre = sesion.nombre || 'Pasajero WhatsApp';

      const origenDetallado =
        sesion.origenLat && sesion.origenLon
          ? `${sesion.origenLat},${sesion.origenLon}`
          : undefined;
      const destinoDetallado =
        sesion.destinoLat && sesion.destinoLon
          ? `${sesion.destinoLat},${sesion.destinoLon}`
          : undefined;

      const viaje = await prisma.viaje.create({
        data: {
          origen,
          destino,
          precio,
          fecha: new Date(),
          estado: 'PENDIENTE',
          observaciones: 'Pedido generado automáticamente por WhatsApp Bot',
          clienteId: clienteExistente?.id || null,
          clienteNombre,
          clienteTelefono: cleanFrom,
          remiseriaId,
          origenDetallado,
          destinoDetallado,
          trackingToken,
          codigoPin,
          metodoPago: 'EFECTIVO',
        },
        include: {
          cliente: true,
          chofer: true,
          vehiculo: true,
          remiseria: true,
        },
      });

      // Resetear estado de la sesión
      resetSesion(cleanFrom);

      // 1. Notificar en tiempo real por WebSocket a la central del Coordinador
      try {
        const { getIO } = await import('../lib/socket');
        const io = getIO();
        io.to(remiseriaId).emit('nuevo_viaje_recibido', viaje);
      } catch (sErr) {
        console.warn('Socket aviso WhatsApp nuevo viaje:', sErr);
      }

      // 2. Disparar notificación Push a los choferes conectados de la remisería
      try {
        pushNotificationService.enviarAChoferesDeRemiseria(remiseriaId, {
          title: '🚕 ¡Nuevo viaje por WhatsApp!',
          body: `${origen} ➔ ${destino} ($${precio.toLocaleString('es-AR')})`,
          url: '/chofer/app',
          tag: `whatsapp-viaje-${viaje.id}`,
          data: { viajeId: viaje.id },
        }).catch(() => {});
      } catch {}

      // 3. Confirmar al pasajero por WhatsApp
      const confirmacionTexto =
        `🚕 *¡Pedido confirmado!*\n\n` +
        `Tu solicitud ya ingresó a nuestra central con el viaje *#${viaje.id.slice(-4).toUpperCase()}*.\n` +
        `🔒 *PIN de inicio de viaje:* *${codigoPin}*\n\n` +
        `Estamos asignándote el mejor móvil disponible. Te avisaremos por acá en cuanto el chofer salga a buscarte.`;

      await whatsappService.enviarBotones(cleanFrom, confirmacionTexto, [
        { id: 'BTN_ESTADO', title: '📍 Estado del viaje' },
        { id: 'BTN_OPERADOR', title: '📞 Hablar con Central' },
      ]);

      return { success: true, viajeId: viaje.id };
    } catch (err: any) {
      console.error('Error creando viaje desde WhatsApp:', err);
      resetSesion(cleanFrom);
      return await whatsappService.enviarTexto(
        cleanFrom,
        'Tuvimos un inconveniente al registrar tu pedido. Por favor comunicate con nuestros teléfonos fijos: 2346-427637 o 2346-433000.'
      );
    }
  },

  /**
   * Consulta y responde el estado actual del viaje de un cliente
   */
  async consultarEstadoViaje(cleanFrom: string, clienteId?: string) {
    const viaje = await prisma.viaje.findFirst({
      where: {
        OR: [
          { clienteTelefono: cleanFrom },
          ...(clienteId ? [{ clienteId }] : []),
        ],
        estado: { in: ['PENDIENTE', 'ACEPTADO', 'EN_CAMINO', 'EN_CURSO'] },
      },
      include: {
        chofer: true,
        vehiculo: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!viaje) {
      return await whatsappService.enviarBotones(
        cleanFrom,
        'No tenés ningún viaje activo en este momento.',
        [{ id: 'BTN_PEDIR', title: '🚕 Pedir un Remís' }]
      );
    }

    const choferNombre = viaje.chofer?.nombre || 'Chofer en asignación';
    const vehiculo = viaje.vehiculo;
    const vehiculoStr = vehiculo ? `${vehiculo.marca} ${vehiculo.modelo} (${vehiculo.patente})` : 'Móvil a confirmar';

    let estadoTexto = '';
    switch (viaje.estado) {
      case 'PENDIENTE':
        estadoTexto = '🟡 *Buscando móvil disponible...* Tu viaje ya está en pantalla central.';
        break;
      case 'ACEPTADO':
        estadoTexto = `🟢 *Chofer asignado:* ${choferNombre}\n🚗 *Vehículo:* ${vehiculoStr}\n_El chofer va en camino a buscarte._`;
        break;
      case 'EN_CAMINO':
        estadoTexto = `🔔 *¡Tu remis ya está esperando afuera!*\n🚗 *Vehículo:* ${vehiculoStr}\n_Ya podés salir a subirte._`;
        break;
      case 'EN_CURSO':
        estadoTexto = `🚕 *Viaje en curso* hacia ${viaje.destino}.`;
        break;
    }

    const respuesta =
      `📋 *Estado de tu Viaje #${viaje.id.slice(-4).toUpperCase()}*\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `${estadoTexto}\n` +
      `🟢 *Origen:* ${viaje.origen}\n` +
      `🔴 *Destino:* ${viaje.destino}\n` +
      `🔒 *PIN de seguridad:* *${viaje.codigoPin || 'Sin PIN'}*\n` +
      `━━━━━━━━━━━━━━━━━━━`;

    return await whatsappService.enviarTexto(cleanFrom, respuesta);
  },

  /**
   * Notifica por WhatsApp al pasajero cuando el chofer avisa que está llegando o afuera
   */
  async notificarCambioEstadoPasajero(viaje: any, nuevoEstado: string, mensajeExtra?: string) {
    const telefono = viaje.clienteTelefono || viaje.cliente?.telefono;
    if (!telefono) return;

    const choferNombre = viaje.chofer?.nombre || 'Tu chofer';
    const vehiculo = viaje.vehiculo;
    const autoStr = vehiculo ? ` (${vehiculo.marca} ${vehiculo.modelo} - ${vehiculo.patente})` : '';

    if (nuevoEstado === 'EN_CAMINO') {
      const msg = `🔔 *¡Tu remis está esperando afuera!*\n${choferNombre} ya está en tu puerta${autoStr}.\n¡Ya podés salir a subirte!`;
      await whatsappService.enviarTexto(telefono, msg).catch(() => {});
    } else if (nuevoEstado === 'ACEPTADO') {
      const msg = `🚗 *¡Chofer en camino!*\n${choferNombre} aceptó tu viaje${autoStr} y va en camino a buscarte.`;
      await whatsappService.enviarTexto(telefono, msg).catch(() => {});
    } else if (nuevoEstado === 'LLEGANDO') {
      const msg = `📍 *¡Tu remis está a 2 cuadras!*\n${choferNombre}${autoStr} está llegando. ¡Podés ir preparándote!`;
      await whatsappService.enviarTexto(telefono, msg).catch(() => {});
    }
  },
};

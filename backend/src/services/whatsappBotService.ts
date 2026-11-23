import { prisma } from '../lib/prisma';
import { whatsappService } from './whatsappService';
import { pushNotificationService } from './pushNotificationService';
import crypto from 'crypto';

// ==============================================================================
// MÁQUINA DE ESTADOS Y CONTROLADOR CONVERSACIONAL DEL BOT DE WHATSAPP
// ==============================================================================

type EstadoConversacion =
  | 'IDLE'
  | 'ESPERANDO_FECHA_HORA_RESERVA'
  | 'ESPERANDO_ORIGEN'
  | 'ESPERANDO_DESTINO'
  | 'CONFIRMANDO_COTIZACION';

interface SesionClienteWhatsApp {
  telefono: string;
  estado: EstadoConversacion;
  esReserva?: boolean;
  fechaHoraReserva?: Date;
  fechaHoraTexto?: string;
  horaInicioStr?: string;
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

// ==============================================================================
// HELPERS DE FECHA Y PARSEO NATURAL DE RESERVAS (ZONA HORARIA ARGENTINA UTC-3)
// ==============================================================================

function getFechaActualArgentina(): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dayOfWeek: number;
} {
  const now = new Date();
  const arFormatter = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'long',
    hour12: false,
  });

  const parts = arFormatter.formatToParts(now);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;

  const year = parseInt(map.year, 10);
  const month = parseInt(map.month, 10) - 1; // 0-indexed
  const day = parseInt(map.day, 10);
  const hour = parseInt(map.hour, 10);
  const minute = parseInt(map.minute, 10);

  const arDate = new Date(Date.UTC(year, month, day, 12, 0, 0));
  const dayOfWeek = arDate.getUTCDay();

  return { year, month, day, hour, minute, dayOfWeek };
}

function formatearFechaLegible(fechaUtc: Date): { fechaTexto: string; horaStr: string } {
  const parts = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(fechaUtc);

  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;

  const weekdayCapitalized = map.weekday.charAt(0).toUpperCase() + map.weekday.slice(1);
  const horaStr = `${map.hour}:${map.minute}`;
  const fechaTexto = `${weekdayCapitalized} ${map.day}/${map.month} a las ${horaStr} hs`;

  return { fechaTexto, horaStr };
}

function parsearFechaHoraReserva(input: string): { fecha: Date; fechaTexto: string; horaStr: string } | { error: string } {
  const texto = input.trim().toLowerCase();
  const ar = getFechaActualArgentina();

  // 1. "en X horas" / "en X minutos"
  const matchEnHoras = texto.match(/en\s+(\d+)\s*(h|hs|hora|horas)/i);
  const matchEnMins = texto.match(/en\s+(\d+)\s*(m|min|mins|minuto|minutos)/i);
  if (matchEnHoras || matchEnMins) {
    const addHours = matchEnHoras ? parseInt(matchEnHoras[1], 10) : 0;
    const addMins = matchEnMins ? parseInt(matchEnMins[1], 10) : 0;
    const targetUtcMs = Date.now() + (addHours * 60 + addMins) * 60 * 1000;
    const targetDate = new Date(targetUtcMs);

    const diffMins = (targetDate.getTime() - Date.now()) / (1000 * 60);
    if (diffMins < 15) {
      return { error: '⚠️ Por favor indicá un horario con al menos *15 minutos de anticipación*.' };
    }

    const { fechaTexto, horaStr } = formatearFechaLegible(targetDate);
    return { fecha: targetDate, fechaTexto, horaStr };
  }

  // 2. Extraer Hora (HH:mm, HH.mm, HH hs, etc.)
  let textoSinFecha = texto
    .replace(/\b(hoy|mañana|manana|pasado mañana|pasado manana)\b/g, '')
    .replace(/\b(lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)\b/g, '')
    .replace(/\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b/g, '')
    .trim();

  const timeRegex = /(?:a\s+las\s+)?(\d{1,2})(?:[:.](\d{2}))?\s*(hs|hrs|horas|am|pm)?/i;
  const timeMatch = textoSinFecha.match(timeRegex);
  if (!timeMatch || !timeMatch[1]) {
    return {
      error:
        '⚠️ No pudimos reconocer la hora de tu reserva.\n\nPor favor escribí la fecha y hora indicando el horario (ej: *Mañana 08:30*, *Hoy 23:00*, *Lunes 07:15*).',
    };
  }

  let targetHour = parseInt(timeMatch[1], 10);
  const targetMinute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
  const ampm = (timeMatch[3] || '').toLowerCase();

  if (ampm === 'pm' && targetHour < 12) targetHour += 12;
  if (ampm === 'am' && targetHour === 12) targetHour = 0;

  if (targetHour < 0 || targetHour > 23 || targetMinute < 0 || targetMinute > 59) {
    return { error: '⚠️ El horario ingresado no es válido. Ingresá una hora entre 00:00 y 23:59.' };
  }

  let targetYear = ar.year;
  let targetMonth = ar.month;
  let targetDay = ar.day;

  // 3. Determinar el Día
  if (texto.includes('pasado mañana') || texto.includes('pasado manana')) {
    targetDay += 2;
  } else if (texto.includes('mañana') || texto.includes('manana')) {
    targetDay += 1;
  } else if (texto.includes('hoy')) {
    // Es hoy
  } else {
    // ¿Nombre de día de semana?
    const diasSemanaMap: Record<string, number> = {
      domingo: 0,
      lunes: 1,
      martes: 2,
      miercoles: 3,
      miércoles: 3,
      jueves: 4,
      viernes: 5,
      sabado: 6,
      sábado: 6,
    };

    let diaSemanaEncontrado = -1;
    for (const [diaNombre, diaNum] of Object.entries(diasSemanaMap)) {
      if (new RegExp(`\\b${diaNombre}\\b`, 'i').test(texto)) {
        diaSemanaEncontrado = diaNum;
        break;
      }
    }

    if (diaSemanaEncontrado !== -1) {
      let diffDays = (diaSemanaEncontrado - ar.dayOfWeek + 7) % 7;
      if (diffDays === 0) {
        if (targetHour < ar.hour || (targetHour === ar.hour && targetMinute <= ar.minute)) {
          diffDays = 7;
        }
      }
      targetDay += diffDays;
    } else {
      // ¿Fecha numérica DD/MM?
      const fechaNumMatch = texto.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
      if (fechaNumMatch) {
        targetDay = parseInt(fechaNumMatch[1], 10);
        targetMonth = parseInt(fechaNumMatch[2], 10) - 1;
        if (fechaNumMatch[3]) {
          let y = parseInt(fechaNumMatch[3], 10);
          if (y < 100) y += 2000;
          targetYear = y;
        }
      } else {
        // Sin día explícito: si la hora ya pasó hoy (o falta menos de 15m), asume mañana
        if (targetHour < ar.hour || (targetHour === ar.hour && targetMinute <= ar.minute + 15)) {
          targetDay += 1;
        }
      }
    }
  }

  // Argentina es UTC-3, por lo que UTC = targetHour + 3
  const targetDateUtc = new Date(Date.UTC(targetYear, targetMonth, targetDay, targetHour + 3, targetMinute, 0));

  const diffMinutes = (targetDateUtc.getTime() - Date.now()) / (1000 * 60);
  if (diffMinutes < 15) {
    return {
      error:
        '⚠️ La hora elegida ya pasó o es muy próxima. Por favor programá tu viaje con al menos *15 minutos de anticipación*.\n\n_Si necesitás un móvil ya mismo, presioná "Pedir Ahora"_',
    };
  }

  if (diffMinutes > 30 * 24 * 60) {
    return {
      error: '⚠️ Las reservas pueden programarse hasta con 30 días de anticipación.',
    };
  }

  const { fechaTexto, horaStr } = formatearFechaLegible(targetDateUtc);
  return {
    fecha: targetDateUtc,
    fechaTexto,
    horaStr,
  };
}

// ==============================================================================
// SERVICIO PRINCIPAL DEL BOT DE WHATSAPP
// ==============================================================================

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

    // Marcar mensaje como leído en WhatsApp
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
        '❌ Operación cancelada. ¡Cuando nos necesites volvé a escribirnos!',
        [
          { id: 'BTN_PEDIR_AHORA', title: '🚕 Pedir Ahora' },
          { id: 'BTN_RESERVAR', title: '📅 Reservar Viaje' },
        ]
      );
    }

    if (actionId === 'BTN_OPERADOR' || textoLower === 'operador' || textoLower === 'central') {
      const telFijo = remiseria?.telefono || '2346-427637';
      return await whatsappService.enviarTexto(
        cleanFrom,
        `📞 Podés comunicarte directamente con nuestros operadores a los teléfonos fijos:\n☎️ ${telFijo}\n☎️ 2346-433000\n\nEstamos a tu disposición las 24 horas.`
      );
    }

    if (actionId === 'BTN_ESTADO' || textoLower === 'estado' || textoLower === 'mis viajes') {
      return await this.consultarEstadoViaje(cleanFrom, cliente?.id);
    }

    // 3. Manejo según estado de la conversación
    switch (sesion.estado) {
      case 'IDLE': {
        // Disparador: Reservar para más tarde
        if (
          actionId === 'BTN_RESERVAR' ||
          textoLower.includes('reserva') ||
          textoLower.includes('agendar') ||
          textoLower.includes('programar') ||
          textoLower.includes('para mañana') ||
          textoLower.includes('para mas tarde') ||
          textoLower.includes('para más tarde') ||
          textoLower.includes('otro momento')
        ) {
          sesion.esReserva = true;
          sesion.estado = 'ESPERANDO_FECHA_HORA_RESERVA';
          return await whatsappService.enviarTexto(
            cleanFrom,
            `📅 *¿Para qué día y hora necesitás el remís?*\n\nPodés escribir por ejemplo:\n• *'Hoy 23:30'*\n• *'Mañana 08:00'*\n• *'Lunes 07:30'*\n• *'25/11 14:00'*\n\n_(O escribí Cancelar para salir)_`
          );
        }

        // Disparador: Pedir ahora inmediatamente
        if (
          actionId === 'BTN_PEDIR' ||
          actionId === 'BTN_PEDIR_AHORA' ||
          textoLower.includes('pedir') ||
          textoLower.includes('remis') ||
          textoLower.includes('auto') ||
          textoLower.includes('viaje') ||
          textoLower.includes('ahora')
        ) {
          sesion.esReserva = false;
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

        // Saludo de bienvenida y menú principal interactivo
        const mensajeBienvenida = `👋 ¡Hola, *${nombreMostrado}*! Bienvenido a *Remises Bruno*.\n¿Cómo querés viajar hoy?`;
        return await whatsappService.enviarBotones(cleanFrom, mensajeBienvenida, [
          { id: 'BTN_PEDIR_AHORA', title: '🚕 Pedir Ahora' },
          { id: 'BTN_RESERVAR', title: '📅 Reservar Viaje' },
          { id: 'BTN_ESTADO', title: '📍 Estado / Ayuda' },
        ]);
      }

      case 'ESPERANDO_FECHA_HORA_RESERVA': {
        if (!texto || texto.trim().length < 2) {
          return await whatsappService.enviarTexto(
            cleanFrom,
            '⚠️ Por favor indicá el día y la hora de tu reserva (ej: *Mañana 08:30*, *Hoy 23:00*, *Lunes 07:15*).'
          );
        }

        const parseResult = parsearFechaHoraReserva(texto);
        if ('error' in parseResult) {
          return await whatsappService.enviarTexto(cleanFrom, parseResult.error);
        }

        sesion.fechaHoraReserva = parseResult.fecha;
        sesion.fechaHoraTexto = parseResult.fechaTexto;
        sesion.horaInicioStr = parseResult.horaStr;
        sesion.estado = 'ESPERANDO_ORIGEN';

        return await whatsappService.enviarTexto(
          cleanFrom,
          `🗓️ *Reserva para:* ${parseResult.fechaTexto}\n\n📍 *¿Dónde te pasamos a buscar?*\nPodés:\n1. 📎 Compartir tu *ubicación GPS* desde el clip de WhatsApp.\n2. ✍️ O escribir la dirección (ej: *Rivadavia 250*).`
        );
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
          `✅ *Origen:* ${sesion.origen}\n\n🏁 *¿Hacia dónde te llevamos?*\nEscribí la dirección de destino (ej: *Av. Sarmiento 500*, *Hospital Municipal*, etc.):`
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

        if (sesion.esReserva && sesion.fechaHoraTexto) {
          const resumenReserva =
            `📋 *Resumen de tu Reserva Programada:*\n` +
            `━━━━━━━━━━━━━━━━━━━\n` +
            `🗓️ *Fecha y Hora:* *${sesion.fechaHoraTexto}*\n` +
            `🟢 *Origen:* ${sesion.origen}\n` +
            `🔴 *Destino:* ${sesion.destino}\n` +
            `📏 *Distancia:* ~${dist} km\n` +
            `💵 *Precio estimado:* *$${precioEstimado.toLocaleString('es-AR')}* _(Efectivo)_\n` +
            `━━━━━━━━━━━━━━━━━━━\n` +
            `¿Confirmás la reserva?`;

          return await whatsappService.enviarBotones(
            cleanFrom,
            resumenReserva,
            [
              { id: 'BTN_CONFIRMAR_RESERVA', title: '✅ Confirmar Reserva' },
              { id: 'BTN_CANCELAR', title: '❌ Cancelar' },
            ],
            'Reserva de Viaje'
          );
        } else {
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
      }

      case 'CONFIRMANDO_COTIZACION': {
        const esAfirmativo =
          actionId === 'BTN_CONFIRMAR' ||
          actionId === 'BTN_CONFIRMAR_RESERVA' ||
          textoLower.includes('si') ||
          textoLower.includes('confirmar') ||
          textoLower.includes('confirmo');

        if (esAfirmativo) {
          if (sesion.esReserva) {
            return await this.crearReservaDesdeWhatsApp(cleanFrom, sesion, cliente, remiseriaId);
          } else {
            return await this.crearViajeDesdeWhatsApp(cleanFrom, sesion, cliente, remiseriaId);
          }
        } else {
          const botonConfirmarId = sesion.esReserva ? 'BTN_CONFIRMAR_RESERVA' : 'BTN_CONFIRMAR';
          return await whatsappService.enviarBotones(
            cleanFrom,
            '¿Querés confirmar el servicio o cancelarlo?',
            [
              { id: botonConfirmarId, title: '✅ Confirmar' },
              { id: 'BTN_CANCELAR', title: '❌ Cancelar' },
            ]
          );
        }
      }
    }
  },

  /**
   * Crea una Reserva programada en la base de datos de Remises Bruno
   */
  async crearReservaDesdeWhatsApp(
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
      const fechaInicio = sesion.fechaHoraReserva || new Date();
      const horaInicio = sesion.horaInicioStr || '08:00';
      const fechaTexto = sesion.fechaHoraTexto || 'Fecha programada';

      const origenDetallado =
        sesion.origenLat && sesion.origenLon
          ? `${sesion.origenLat},${sesion.origenLon}`
          : undefined;
      const destinoDetallado =
        sesion.destinoLat && sesion.destinoLon
          ? `${sesion.destinoLat},${sesion.destinoLon}`
          : undefined;

      // 1. Guardar en la tabla Reserva (para que aparezca en el tab Reservados de la Central)
      const reserva = await prisma.reserva.create({
        data: {
          clienteNombre,
          clienteTelefono: cleanFrom,
          clienteEmail: clienteExistente?.email || null,
          origen,
          destino,
          fechaInicio,
          horaInicio,
          tipo: 'UNICA',
          estado: 'ACTIVA',
          observaciones: `Reserva programada por WhatsApp Bot para ${fechaTexto}. Est: $${precio.toLocaleString('es-AR')}`,
          remiseriaId,
          clienteId: clienteExistente?.id || null,
        },
      });

      // 2. Registrar también el Viaje programado con la fecha de la reserva
      const viaje = await prisma.viaje.create({
        data: {
          origen,
          destino,
          precio,
          fecha: fechaInicio,
          estado: 'PENDIENTE',
          observaciones: `Viaje Reservado por WhatsApp para: ${fechaTexto} (Reserva #${reserva.id.slice(-4).toUpperCase()})`,
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
      });

      // Resetear estado de la sesión
      resetSesion(cleanFrom);

      // 3. Notificar en tiempo real por WebSocket a la central del Coordinador
      try {
        const { getIO } = await import('../lib/socket');
        const io = getIO();
        io.to(remiseriaId).emit('nueva_reserva_recibida', reserva);
        io.to(remiseriaId).emit('nuevo_viaje_recibido', viaje);
      } catch (sErr) {
        console.warn('Socket aviso WhatsApp nueva reserva:', sErr);
      }

      // 4. Confirmar al pasajero por WhatsApp
      const confirmacionTexto =
        `📅 *¡Reserva agendada con éxito!*\n\n` +
        `Tu viaje quedó registrado en nuestra central:\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `🗓️ *Fecha y Hora:* *${fechaTexto}*\n` +
        `🟢 *Origen:* ${origen}\n` +
        `🔴 *Destino:* ${destino}\n` +
        `💵 *Precio estimado:* *$${precio.toLocaleString('es-AR')}*\n` +
        `🔒 *PIN de seguridad:* *${codigoPin}*\n` +
        `━━━━━━━━━━━━━━━━━━━\n\n` +
        `La central asignará tu móvil con anticipación y te avisaremos por WhatsApp en cuanto el chofer salga a buscarte.`;

      await whatsappService.enviarBotones(cleanFrom, confirmacionTexto, [
        { id: 'BTN_ESTADO', title: '📍 Mis Reservas / Viajes' },
        { id: 'BTN_OPERADOR', title: '📞 Hablar con Central' },
      ]);

      return { success: true, reservaId: reserva.id, viajeId: viaje.id };
    } catch (err: any) {
      console.error('Error creando reserva desde WhatsApp:', err);
      resetSesion(cleanFrom);
      return await whatsappService.enviarTexto(
        cleanFrom,
        'Tuvimos un inconveniente al agendar tu reserva. Por favor comunicate con nuestros teléfonos fijos: 2346-427637 o 2346-433000.'
      );
    }
  },

  /**
   * Crea el Viaje inmediato en la base de datos de Remises Bruno y lo dispara a Central y Choferes
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
   * Consulta y responde el estado actual de los viajes o reservas del cliente
   */
  async consultarEstadoViaje(cleanFrom: string, clienteId?: string) {
    const [viaje, reservas] = await Promise.all([
      prisma.viaje.findFirst({
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
      }),
      prisma.reserva.findMany({
        where: {
          clienteTelefono: cleanFrom,
          estado: 'ACTIVA',
          fechaInicio: { gte: new Date(Date.now() - 60 * 60 * 1000) },
        },
        include: {
          chofer: true,
        },
        orderBy: { fechaInicio: 'asc' },
        take: 3,
      }),
    ]);

    if (!viaje && reservas.length === 0) {
      return await whatsappService.enviarBotones(
        cleanFrom,
        'No tenés ningún viaje activo ni reservas programadas en este momento.',
        [
          { id: 'BTN_PEDIR_AHORA', title: '🚕 Pedir Ahora' },
          { id: 'BTN_RESERVAR', title: '📅 Reservar Viaje' },
        ]
      );
    }

    let respuesta = '';

    // Si tiene un viaje activo en curso o por llegar
    if (viaje) {
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

      respuesta +=
        `📋 *Estado de tu Viaje #${viaje.id.slice(-4).toUpperCase()}*\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `${estadoTexto}\n` +
        `🟢 *Origen:* ${viaje.origen}\n` +
        `🔴 *Destino:* ${viaje.destino}\n` +
        `🔒 *PIN de seguridad:* *${viaje.codigoPin || 'Sin PIN'}*\n` +
        `━━━━━━━━━━━━━━━━━━━`;
    }

    // Si tiene reservas activas
    if (reservas.length > 0) {
      if (respuesta.length > 0) respuesta += '\n\n';
      respuesta += `📅 *Tus Reservas Programadas:*\n━━━━━━━━━━━━━━━━━━━\n`;
      respuesta += reservas
        .map((r) => {
          const { fechaTexto } = formatearFechaLegible(r.fechaInicio);
          const choferStr = r.chofer
            ? `🚗 Móvil asignado: *${r.chofer.nombre}*`
            : `🟡 Agendada en central (se asignará previo al viaje)`;
          return (
            `🗓️ *${fechaTexto}*\n` +
            `🟢 *Origen:* ${r.origen}\n` +
            `🔴 *Destino:* ${r.destino}\n` +
            `${choferStr}`
          );
        })
        .join('\n───────────────────\n');
    }

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

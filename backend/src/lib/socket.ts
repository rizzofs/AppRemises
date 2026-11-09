import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { prisma } from './prisma';

let io: Server | null = null;

// Fórmula de Haversine para distancia en metros entre dos coordenadas GPS
function calcularDistanciaMetros(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Radio de la Tierra en metros
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const initSocket = (server: HttpServer): Server => {
  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (
          /^https:\/\/([a-z0-9-]+\.)?brunoremises\.com\.ar$/i.test(origin) ||
          /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin) ||
          /^http:\/\/localhost:[0-9]+$/i.test(origin) ||
          (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL)
        ) {
          return callback(null, true);
        }
        return callback(null, true);
      },
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  console.log('⚡ Servidor de Sockets inicializado exitosamente.');

  io.on('connection', (socket: Socket) => {
    console.log(`🔌 Cliente conectado: ${socket.id}`);

    // Unirse a una sala específica de una remisería (Aislamiento Multi-tenant)
    socket.on('join_room', ({ remiseriaId }: { remiseriaId: string }) => {
      if (remiseriaId) {
        socket.join(remiseriaId);
        console.log(`👤 Socket ${socket.id} se unió a la sala de Remisería: ${remiseriaId}`);
      }
    });

    // Actualización de GPS del Chofer / Vehículo en tiempo real
    socket.on('actualizar_gps', async ({
      vehiculoId,
      choferId,
      lat,
      lng,
      remiseriaId,
      choferNombre,
      estado
    }: {
      vehiculoId?: string;
      choferId?: string;
      lat: number;
      lng: number;
      remiseriaId: string;
      choferNombre?: string;
      estado?: string;
    }) => {
      try {
        if ((!vehiculoId && !choferId) || !lat || !lng || !remiseriaId) {
          return;
        }

        let vId = vehiculoId;
        let nombre = choferNombre;
        let patente = 'Auto Propio';
        let estadoVehiculo = estado || 'disponible';

        // Si tenemos choferId pero no vehiculoId, buscar si tiene un vehículo asignado
        if (choferId) {
          try {
            const choferActual = await prisma.chofer.findUnique({
              where: { id: choferId },
              include: { vehiculo: true, remiseria: true }
            });

            if (choferActual) {
              if (!nombre) {
                nombre = `${choferActual.nombre} ${choferActual.apellido}`.trim();
              }
              if (!vId && choferActual.vehiculoId) {
                vId = choferActual.vehiculoId;
              }
              if (choferActual.vehiculo) {
                patente = choferActual.vehiculo.patente;
              }

              // Verificar si el chofer tiene un viaje activo en curso (ACEPTADO, EN_CAMINO, EN_CURSO)
              const viajeActivo = await prisma.viaje.findFirst({
                where: {
                  choferId,
                  estado: { in: ['ACEPTADO', 'EN_CAMINO', 'EN_CURSO'] }
                },
                select: { id: true }
              });

              if (viajeActivo) {
                estadoVehiculo = 'en_viaje';
                if (choferActual.enParadaVirtual) {
                  await prisma.chofer.update({
                    where: { id: choferId },
                    data: { enParadaVirtual: false, paradaVirtualIngreso: null }
                  });
                }
              } else if (choferActual.isOnline && estadoVehiculo === 'disponible') {
                // Sistema de Tablas: todo chofer online y realmente libre se mantiene en la cola FIFO
                const baseLat = choferActual.remiseria?.latitud ?? -34.901138;
                const baseLng = choferActual.remiseria?.longitud ?? -60.013778;
                const distMetros = calcularDistanciaMetros(lat, lng, baseLat, baseLng);

                if (!choferActual.enParadaVirtual) {
                  await prisma.chofer.update({
                    where: { id: choferId },
                    data: { enParadaVirtual: true, paradaVirtualIngreso: new Date() }
                  });
                  io?.to(remiseriaId).emit('parada_virtual_actualizada', {
                    choferId,
                    accion: 'INGRESO_AUTOMATICO',
                    distanciaMetros: Math.round(distMetros)
                  });
                }
              }
            }
          } catch (errChofer) {
            console.error('Aviso al buscar chofer por id en socket:', errChofer);
          }
        }

        // Si tenemos un vehículo asociado, actualizar sus coordenadas en la base de datos
        if (vId) {
          try {
            const vehiculoActualizado = await prisma.vehiculo.update({
              where: { id: vId },
              data: {
                latitud: lat,
                longitud: lng,
                ultimaUbicacion: new Date()
              }
            });
            patente = vehiculoActualizado.patente;
            if (!estado) {
              estadoVehiculo = vehiculoActualizado.estado.toLowerCase() === 'activo' ? 'disponible' : vehiculoActualizado.estado.toLowerCase();
            }
          } catch (errVehiculo) {
            console.warn(`Aviso: vehículo ${vId} no encontrado para update GPS directo`);
          }
        }

        console.log(`🚗 Movimiento GPS [${patente} - ${nombre || 'Chofer'}]: Lat: ${lat}, Lng: ${lng}`);

        // Transmitir el movimiento a todos en la sala de la remisería
        io?.to(remiseriaId).emit('vehiculo_movido', {
          id: vId || choferId,
          choferId: choferId,
          vehiculoId: vId,
          patente: patente,
          chofer: nombre || 'Chofer',
          estado: estadoVehiculo,
          ubicacion: { lat, lng },
          ultimaActualizacion: new Date().toISOString(),
          direccionActual: `${lat.toFixed(5)}, ${lng.toFixed(5)}`
        });

      } catch (error) {
        console.error('❌ Error al actualizar ubicación GPS en socket:', error);
      }
    });

    // Notificar creación de nuevo viaje
    socket.on('crear_viaje', ({ remiseriaId, viaje }: { remiseriaId: string; viaje: any }) => {
      if (remiseriaId && viaje) {
        socket.to(remiseriaId).emit('nuevo_viaje_recibido', viaje);
      }
    });

    // Notificar cambio de estado de viaje (ej: chofer avisa que está esperando afuera)
    socket.on('viaje_estado_cambiado', ({ remiseriaId, viajeId, estado, mensaje, viaje }: { remiseriaId: string; viajeId: string; estado: string; mensaje?: string; viaje?: any }) => {
      if (remiseriaId) {
        io?.to(remiseriaId).emit('viaje_estado_actualizado', { viajeId, estado, mensaje, viaje });
      }
    });

    // Notificar que el chofer está llegando (a pocas cuadras)
    socket.on('notificar_chofer_llegando', ({ remiseriaId, viajeId, choferNombre, autoStr, viaje }: any) => {
      if (remiseriaId) {
        io?.to(remiseriaId).emit('chofer_llegando', {
          viajeId,
          mensaje: `🚕 ¡${choferNombre || 'El chofer'}${autoStr || ''} está llegando a tu ubicación! Podés ir preparándote.`,
          choferNombre,
          viaje,
        });
      }
    });

    // Notificar cancelación inmediata con sonido y motivo
    socket.on('viaje_cancelado_cliente', ({ remiseriaId, viajeId, motivo, debeAbonarMinimo, costoCancelacion, viaje }: any) => {
      if (remiseriaId) {
        io?.to(remiseriaId).emit('viaje_cancelado', {
          viajeId,
          motivo,
          debeAbonarMinimo,
          costoCancelacion,
          canceladoPor: 'CLIENTE',
          viaje
        });
      }
    });

    // Chat rápido entre cliente y chofer
    socket.on('enviar_mensaje_chat', ({ remiseriaId, viajeId, remitente, remitenteNombre, texto, timestamp }: any) => {
      if (remiseriaId && viajeId) {
        io?.to(remiseriaId).emit('mensaje_chat_recibido', {
          viajeId,
          remitente,
          remitenteNombre,
          texto,
          timestamp: timestamp || new Date().toISOString()
        });
      }
    });

    // Alerta SOS de emergencia
    socket.on('emitir_alerta_sos', ({ remiseriaId, viajeId, pasajeroNombre, telefono, coords }: any) => {
      if (remiseriaId) {
        io?.to(remiseriaId).emit('alerta_sos_recibida', {
          viajeId,
          pasajeroNombre,
          telefono,
          coords,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Actualización de espera (botón de espera del chofer)
    socket.on('notificar_espera', ({ remiseriaId, viajeId, enEspera, tiempoEsperaSegundos, costoEspera, nuevoPrecio }: any) => {
      if (remiseriaId) {
        io?.to(remiseriaId).emit('espera_actualizada', {
          viajeId,
          enEspera,
          tiempoEsperaSegundos,
          costoEspera,
          nuevoPrecio
        });
      }
    });

    // Desconexión
    socket.on('disconnect', () => {
      console.log(`🔌 Cliente desconectado: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = (): Server => {
  if (!io) {
    throw new Error('Socket.io no ha sido inicializado. Llama a initSocket primero.');
  }
  return io;
};

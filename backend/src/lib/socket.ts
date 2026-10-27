import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { prisma } from './prisma';

let io: Server | null = null;

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
              include: { vehiculo: true }
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

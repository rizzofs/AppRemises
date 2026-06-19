import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { prisma } from './prisma';

let io: Server | null = null;

export const initSocket = (server: HttpServer): Server => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
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
      lat,
      lng,
      remiseriaId,
      choferNombre
    }: {
      vehiculoId: string;
      lat: number;
      lng: number;
      remiseriaId: string;
      choferNombre?: string;
    }) => {
      try {
        if (!vehiculoId || !lat || !lng || !remiseriaId) {
          return;
        }

        console.log(`🚗 Movimiento GPS Vehículo [${vehiculoId}]: Lat: ${lat}, Lng: ${lng}`);

        // 1. Guardar la ubicación en la base de datos PostgreSQL mediante Prisma
        const vehiculoActualizado = await prisma.vehiculo.update({
          where: { id: vehiculoId },
          data: {
            latitud: lat,
            longitud: lng,
            ultimaUbicacion: new Date()
          }
        });

        // 2. Transmitir el movimiento a todos los coordinadores conectados de esa remisería
        socket.to(remiseriaId).emit('vehiculo_movido', {
          id: vehiculoId,
          patente: vehiculoActualizado.patente,
          chofer: choferNombre || 'Chofer',
          estado: vehiculoActualizado.estado.toLowerCase(),
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

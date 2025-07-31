import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../types';

const prisma = new PrismaClient();

export const coordinatorDashboardController = {
  // Obtener viajes en curso
  async getViajesEnCurso(req: AuthenticatedRequest, res: Response) {
    try {
      const coordinadorId = req.user?.id;
      
      if (!coordinadorId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      // Obtener la remisería del coordinador
      const coordinador = await prisma.coordinador.findFirst({
        where: { userId: coordinadorId },
        include: { remiseria: true }
      });

      if (!coordinador) {
        return res.status(404).json({
          success: false,
          message: 'Coordinador no encontrado'
        });
      }

      const viajes = await prisma.viaje.findMany({
        where: {
          remiseriaId: coordinador.remiseriaId,
          estado: 'EN_CURSO'
        },
        include: {
          chofer: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              telefono: true
            }
          },
          vehiculo: {
            select: {
              id: true,
              patente: true,
              marca: true,
              modelo: true
            }
          }
        },
        orderBy: {
          fecha: 'desc'
        }
      });

      res.json({
        success: true,
        data: viajes
      });
    } catch (error) {
      console.error('Error getting viajes en curso:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  },

  // Obtener viajes sin asignar
  async getViajesSinAsignar(req: AuthenticatedRequest, res: Response) {
    try {
      const coordinadorId = req.user?.id;
      
      if (!coordinadorId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      const coordinador = await prisma.coordinador.findFirst({
        where: { userId: coordinadorId },
        include: { remiseria: true }
      });

      if (!coordinador) {
        return res.status(404).json({
          success: false,
          message: 'Coordinador no encontrado'
        });
      }

      const viajes = await prisma.viaje.findMany({
        where: {
          remiseriaId: coordinador.remiseriaId,
          estado: 'PENDIENTE',
          choferId: null
        },
        orderBy: {
          fecha: 'asc'
        }
      });

      res.json({
        success: true,
        data: viajes
      });
    } catch (error) {
      console.error('Error getting viajes sin asignar:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  },

  // Obtener viajes reservados
  async getViajesReservados(req: AuthenticatedRequest, res: Response) {
    try {
      const coordinadorId = req.user?.id;
      
      if (!coordinadorId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      const coordinador = await prisma.coordinador.findFirst({
        where: { userId: coordinadorId },
        include: { remiseria: true }
      });

      if (!coordinador) {
        return res.status(404).json({
          success: false,
          message: 'Coordinador no encontrado'
        });
      }

      const reservas = await prisma.reserva.findMany({
        where: {
          remiseriaId: coordinador.remiseriaId,
          estado: 'ACTIVA'
        },
        include: {
          chofer: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              telefono: true
            }
          },
          vehiculo: {
            select: {
              id: true,
              patente: true,
              marca: true,
              modelo: true
            }
          }
        },
        orderBy: {
          fechaInicio: 'asc'
        }
      });

      res.json({
        success: true,
        data: reservas
      });
    } catch (error) {
      console.error('Error getting reservas:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  },

  // Crear nuevo viaje
  async createViaje(req: AuthenticatedRequest, res: Response) {
    try {
      const coordinadorId = req.user?.id;
      const {
        origen,
        destino,
        precio,
        fecha,
        clienteNombre,
        clienteTelefono,
        clienteEmail,
        prioridad,
        origenDetallado,
        destinoDetallado,
        observaciones
      } = req.body;

      if (!coordinadorId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      const coordinador = await prisma.coordinador.findFirst({
        where: { userId: coordinadorId },
        include: { remiseria: true }
      });

      if (!coordinador) {
        return res.status(404).json({
          success: false,
          message: 'Coordinador no encontrado'
        });
      }

      const viaje = await prisma.viaje.create({
        data: {
          origen,
          destino,
          precio: parseFloat(precio),
          fecha: new Date(fecha),
          clienteNombre,
          clienteTelefono,
          clienteEmail,
          prioridad: prioridad || 'NORMAL',
          origenDetallado,
          destinoDetallado,
          observaciones,
          remiseriaId: coordinador.remiseriaId,
          estado: 'PENDIENTE'
        }
      });

      // Track the action
      await prisma.appUsage.create({
        data: {
          userId: coordinadorId,
          userEmail: coordinador.email,
          action: 'CREATE_VIAJE',
          details: JSON.stringify({ viajeId: viaje.id }),
          ipAddress: req.ip,
          userAgent: req.get('User-Agent') || null
        }
      });

      res.status(201).json({
        success: true,
        data: viaje,
        message: 'Viaje creado exitosamente'
      });
    } catch (error) {
      console.error('Error creating viaje:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  },

  // Crear nueva reserva
  async createReserva(req: AuthenticatedRequest, res: Response) {
    try {
      const coordinadorId = req.user?.id;
      const {
        clienteNombre,
        clienteTelefono,
        clienteEmail,
        origen,
        destino,
        fechaInicio,
        fechaFin,
        horaInicio,
        horaFin,
        diasSemana,
        tipo,
        observaciones
      } = req.body;

      if (!coordinadorId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      const coordinador = await prisma.coordinador.findFirst({
        where: { userId: coordinadorId },
        include: { remiseria: true }
      });

      if (!coordinador) {
        return res.status(404).json({
          success: false,
          message: 'Coordinador no encontrado'
        });
      }

      const reserva = await prisma.reserva.create({
        data: {
          clienteNombre,
          clienteTelefono,
          clienteEmail,
          origen,
          destino,
          fechaInicio: new Date(fechaInicio),
          fechaFin: fechaFin ? new Date(fechaFin) : null,
          horaInicio,
          horaFin,
          diasSemana: diasSemana ? JSON.stringify(diasSemana) : null,
          tipo: tipo || 'UNICA',
          observaciones,
          remiseriaId: coordinador.remiseriaId,
          estado: 'ACTIVA'
        }
      });

      // Track the action
      await prisma.appUsage.create({
        data: {
          userId: coordinadorId,
          userEmail: coordinador.email,
          action: 'CREATE_RESERVA',
          details: JSON.stringify({ reservaId: reserva.id }),
          ipAddress: req.ip,
          userAgent: req.get('User-Agent') || null
        }
      });

      res.status(201).json({
        success: true,
        data: reserva,
        message: 'Reserva creada exitosamente'
      });
    } catch (error) {
      console.error('Error creating reserva:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  },

  // Obtener vehículos en tiempo real
  async getVehiculosTiempoReal(req: AuthenticatedRequest, res: Response) {
    try {
      const coordinadorId = req.user?.id;
      
      if (!coordinadorId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      const coordinador = await prisma.coordinador.findFirst({
        where: { userId: coordinadorId },
        include: { remiseria: true }
      });

      if (!coordinador) {
        return res.status(404).json({
          success: false,
          message: 'Coordinador no encontrado'
        });
      }

      const vehiculos = await prisma.vehiculo.findMany({
        where: {
          remiseriaId: coordinador.remiseriaId,
          estado: 'ACTIVO'
        },
        include: {
          choferes: {
            where: { estado: 'ACTIVO' },
            select: {
              id: true,
              nombre: true,
              apellido: true,
              telefono: true
            }
          }
        }
      });

      res.json({
        success: true,
        data: vehiculos
      });
    } catch (error) {
      console.error('Error getting vehiculos tiempo real:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  },

  // Obtener choferes en tiempo real
  async getChoferesTiempoReal(req: AuthenticatedRequest, res: Response) {
    try {
      const coordinadorId = req.user?.id;
      
      if (!coordinadorId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      const coordinador = await prisma.coordinador.findFirst({
        where: { userId: coordinadorId },
        include: { remiseria: true }
      });

      if (!coordinador) {
        return res.status(404).json({
          success: false,
          message: 'Coordinador no encontrado'
        });
      }

      const choferes = await prisma.chofer.findMany({
        where: {
          remiseriaId: coordinador.remiseriaId,
          estado: 'ACTIVO'
        },
        include: {
          vehiculo: {
            select: {
              id: true,
              patente: true,
              marca: true,
              modelo: true
            }
          }
        }
      });

      res.json({
        success: true,
        data: choferes
      });
    } catch (error) {
      console.error('Error getting choferes tiempo real:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  },

  // Obtener estadísticas del dashboard
  async getDashboardStats(req: AuthenticatedRequest, res: Response) {
    try {
      const coordinadorId = req.user?.id;
      
      if (!coordinadorId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      const coordinador = await prisma.coordinador.findFirst({
        where: { userId: coordinadorId },
        include: { remiseria: true }
      });

      if (!coordinador) {
        return res.status(404).json({
          success: false,
          message: 'Coordinador no encontrado'
        });
      }

      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

      const [
        viajesEnCurso,
        viajesSinAsignar,
        reservasActivas,
        totalVehiculos,
        totalChoferes
      ] = await Promise.all([
        prisma.viaje.count({
          where: {
            remiseriaId: coordinador.remiseriaId,
            estado: 'EN_CURSO'
          }
        }),
        prisma.viaje.count({
          where: {
            remiseriaId: coordinador.remiseriaId,
            estado: 'PENDIENTE',
            choferId: null
          }
        }),
        prisma.reserva.count({
          where: {
            remiseriaId: coordinador.remiseriaId,
            estado: 'ACTIVA'
          }
        }),
        prisma.vehiculo.count({
          where: {
            remiseriaId: coordinador.remiseriaId,
            estado: 'ACTIVO'
          }
        }),
        prisma.chofer.count({
          where: {
            remiseriaId: coordinador.remiseriaId,
            estado: 'ACTIVO'
          }
        })
      ]);

      res.json({
        success: true,
        data: {
          viajesEnCurso,
          viajesSinAsignar,
          reservasActivas,
          totalVehiculos,
          totalChoferes
        }
      });
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
}; 
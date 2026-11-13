import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../types';

export const liquidacionController = {
  // Obtener viajes pendientes de liquidar para un chofer
  async getPendientes(req: AuthenticatedRequest, res: Response) {
    try {
      const { choferId } = req.params;
      const { rol, id: userId } = req.user!;

      // Obtener el chofer con su remisería
      const chofer = await prisma.chofer.findUnique({
        where: { id: choferId },
        include: { remiseria: true }
      });

      if (!chofer) {
        return res.status(404).json({
          success: false,
          message: 'Chofer no encontrado'
        });
      }

      // Validar acceso
      if (rol === 'DUENIO') {
        const duenio = await prisma.duenio.findUnique({
          where: { userId },
          include: { remiserias: { select: { remiseriaId: true } } }
        });
        const remiseriaIds = duenio?.remiserias.map(r => r.remiseriaId) || [];
        if (!remiseriaIds.includes(chofer.remiseriaId)) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para ver las liquidaciones de este chofer'
          });
        }
      } else if (rol === 'COORDINADOR') {
        const coordinador = await prisma.coordinador.findFirst({
          where: { userId }
        });
        if (coordinador?.remiseriaId !== chofer.remiseriaId) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para ver las liquidaciones de este chofer'
          });
        }
      } else {
        return res.status(403).json({
          success: false,
          message: 'No autorizado'
        });
      }

      // Obtener viajes completados del chofer que no estén liquidados
      const viajes = await prisma.viaje.findMany({
        where: {
          choferId: chofer.id,
          estado: 'COMPLETADO',
          liquidacionId: null
        },
        orderBy: {
          fecha: 'desc'
        }
      });

      // Calcular totales
      const totalRecaudado = viajes.reduce((sum, v) => sum + Number(v.precio), 0);
      const totalEfectivo = viajes.filter(v => v.metodoPago !== 'TRANSFERENCIA').reduce((sum, v) => sum + Number(v.precio), 0);
      const totalTransferencia = viajes.filter(v => v.metodoPago === 'TRANSFERENCIA').reduce((sum, v) => sum + Number(v.precio), 0);

      // Comisiones calculadas por defecto (sin combustible)
      let comisionChofer = 0;
      let comisionAgencia = 0;
      let gananciaPropietario = 0;

      // Reglas de Comisiones:
      // 1. Todos pagan 20% de comisión a la remisería.
      // 2. Choferes con vehículo asignado se llevan el 30% de la recaudación diaria.
      // 3. Dueño del vehículo se lleva el 50% restante (menos combustible).
      if (chofer.esPropietario) {
        comisionAgencia = (totalRecaudado * 20) / 100; // 20% para la agencia
        comisionChofer = totalRecaudado - comisionAgencia; // 80% para el chofer dueño
        gananciaPropietario = 0; // El dueño del auto es el chofer mismo
      } else {
        comisionChofer = (totalRecaudado * 30) / 100; // 30% recaudación diaria
        comisionAgencia = (totalRecaudado * 20) / 100; // 20% comisión remisería
        gananciaPropietario = totalRecaudado - comisionChofer - comisionAgencia; // 50% para el dueño del auto
      }

      res.json({
        success: true,
        data: {
          chofer: {
            id: chofer.id,
            nombre: chofer.nombre,
            apellido: chofer.apellido,
            numeroChofer: chofer.numeroChofer,
            esPropietario: chofer.esPropietario,
            comisionPorcentaje: chofer.comisionPorcentaje,
            comisionDuenioAuto: chofer.remiseria.comisionDuenioAuto
          },
          viajes,
          resumen: {
            totalRecaudado,
            totalEfectivo,
            totalTransferencia,
            comisionChofer,
            comisionAgencia,
            combustible: 0,
            gananciaPropietario
          }
        }
      });
    } catch (error) {
      console.error('Error al obtener liquidaciones pendientes:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  },

  // Crear la liquidación (cierre de caja)
  async crear(req: AuthenticatedRequest, res: Response) {
    try {
      const { choferId, combustible, observaciones } = req.body;
      const { rol, id: userId } = req.user!;

      if (!choferId) {
        return res.status(400).json({
          success: false,
          message: 'El id del chofer es requerido'
        });
      }

      const combustibleVal = combustible !== undefined ? parseFloat(combustible) : 0;

      // Obtener el chofer con su remisería
      const chofer = await prisma.chofer.findUnique({
        where: { id: choferId },
        include: { remiseria: true }
      });

      if (!chofer) {
        return res.status(404).json({
          success: false,
          message: 'Chofer no encontrado'
        });
      }

      // Validar acceso
      if (rol === 'DUENIO') {
        const duenio = await prisma.duenio.findUnique({
          where: { userId },
          include: { remiserias: { select: { remiseriaId: true } } }
        });
        const remiseriaIds = duenio?.remiserias.map(r => r.remiseriaId) || [];
        if (!remiseriaIds.includes(chofer.remiseriaId)) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para realizar liquidaciones para este chofer'
          });
        }
      } else if (rol === 'COORDINADOR') {
        const coordinador = await prisma.coordinador.findFirst({
          where: { userId }
        });
        if (coordinador?.remiseriaId !== chofer.remiseriaId) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para realizar liquidaciones para este chofer'
          });
        }
      } else {
        return res.status(403).json({
          success: false,
          message: 'No autorizado'
        });
      }

      // Obtener los viajes pendientes
      const viajes = await prisma.viaje.findMany({
        where: {
          choferId: chofer.id,
          estado: 'COMPLETADO',
          liquidacionId: null
        }
      });

      if (viajes.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No hay viajes completados pendientes de liquidación para este chofer'
        });
      }

      const totalRecaudado = viajes.reduce((sum, v) => sum + Number(v.precio), 0);

      // Calcular comisiones y ganancias definitivas
      let comisionChofer = 0;
      let comisionAgencia = 0;
      let gananciaPropietario = 0;

      if (chofer.esPropietario) {
        // Chofer dueño del vehículo: Paga 20% de comisión a la remisería, retiene el 80%
        comisionAgencia = (totalRecaudado * 20) / 100;
        comisionChofer = totalRecaudado - comisionAgencia;
        gananciaPropietario = 0;
      } else {
        // Chofer que maneja un vehículo asignado (por la remisería o un tercero):
        // El chofer se lleva el 30% de su recaudación diaria
        // La remisería cobra el 20% de comisión
        // El dueño del auto (o la remisería si es propietaria) recibe el 50% restante
        comisionChofer = (totalRecaudado * 30) / 100;
        comisionAgencia = (totalRecaudado * 20) / 100;
        gananciaPropietario = totalRecaudado - comisionChofer - comisionAgencia - combustibleVal;
      }

      // Registrar la liquidación y relacionar los viajes en una transacción
      const liquidacion = await prisma.$transaction(async (tx) => {
        const liq = await tx.liquidacion.create({
          data: {
            choferId: chofer.id,
            coordinadorId: userId, // ID del usuario autenticado (dueño o coordinador) en la tabla 'User'
            totalRecaudado,
            combustible: combustibleVal,
            comisionChofer,
            comisionAgencia,
            gananciaPropietario,
            observaciones: observaciones || null
          }
        });

        // Actualizar todos los viajes asociados
        await tx.viaje.updateMany({
          where: {
            id: { in: viajes.map(v => v.id) }
          },
          data: {
            liquidacionId: liq.id
          }
        });

        return liq;
      });

      // Registrar log de auditoría
      await prisma.appUsage.create({
        data: {
          userId,
          userEmail: req.user!.email,
          action: 'CREATE_LIQUIDACION',
          details: JSON.stringify({
            liquidacionId: liquidacion.id,
            choferId: chofer.id,
            totalRecaudado,
            comisionChofer,
            comisionAgencia,
            combustibleVal,
            gananciaPropietario
          }),
          ipAddress: req.ip,
          userAgent: req.get('User-Agent') || null
        }
      });

      res.status(201).json({
        success: true,
        data: liquidacion,
        message: 'Cierre de caja y liquidación registrados correctamente'
      });
    } catch (error) {
      console.error('Error al registrar liquidación:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  },

  // Obtener resumen de lo recaudado por el coordinador en su turno (hoy)
  async getResumenCoordinador(req: AuthenticatedRequest, res: Response) {
    try {
      const { id: userId } = req.user!;

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const liquidaciones = await prisma.liquidacion.findMany({
        where: {
          coordinadorId: userId,
          fecha: {
            gte: startOfToday
          }
        },
        include: {
          chofer: {
            select: {
              nombre: true,
              apellido: true,
              numeroChofer: true,
              esPropietario: true
            }
          }
        },
        orderBy: {
          fecha: 'desc'
        }
      });

      const totalRecaudado = liquidaciones.reduce((sum, l) => sum + l.totalRecaudado, 0);
      const totalComisionAgencia = liquidaciones.reduce((sum, l) => sum + l.comisionAgencia, 0);
      const totalGananciaPropietario = liquidaciones.reduce((sum, l) => sum + l.gananciaPropietario, 0);
      const totalCombustible = liquidaciones.reduce((sum, l) => sum + l.combustible, 0);

      res.json({
        success: true,
        data: {
          liquidaciones,
          resumen: {
            totalRecaudado,
            totalComisionAgencia,
            totalGananciaPropietario,
            totalCombustible
          }
        }
      });
    } catch (error) {
      console.error('Error al obtener resumen de coordinador:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  },

  // Historial de todas las liquidaciones para el dueño
  async getHistorialDuenio(req: AuthenticatedRequest, res: Response) {
    try {
      const { id: userId } = req.user!;

      const duenio = await prisma.duenio.findUnique({
        where: { userId },
        include: { remiserias: { select: { remiseriaId: true } } }
      });

      if (!duenio) {
        return res.status(404).json({
          success: false,
          message: 'Dueño no encontrado'
        });
      }

      const remiseriaIds = duenio.remiserias.map(r => r.remiseriaId);

      const liquidaciones = await prisma.liquidacion.findMany({
        where: {
          chofer: {
            remiseriaId: { in: remiseriaIds }
          }
        },
        include: {
          chofer: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              numeroChofer: true,
              esPropietario: true,
              vehiculo: {
                select: {
                  id: true,
                  patente: true,
                  marca: true,
                  modelo: true,
                  propietario: true
                }
              }
            }
          },
          viajes: {
            select: {
              id: true,
              precio: true,
              fecha: true,
              origen: true,
              destino: true,
              vehiculo: {
                select: {
                  id: true,
                  patente: true,
                  marca: true,
                  modelo: true,
                  propietario: true
                }
              }
            }
          },
          coordinador: {
            select: {
              email: true,
              coordinador: {
                select: {
                  nombre: true
                }
              },
              duenio: {
                select: {
                  nombre: true
                }
              }
            }
          }
        },
        orderBy: {
          fecha: 'desc'
        }
      });

      res.json({
        success: true,
        data: liquidaciones
      });
    } catch (error) {
      console.error('Error al obtener historial para dueño:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  },

  // Historial de liquidaciones del propio chofer
  async getHistorialChofer(req: AuthenticatedRequest, res: Response) {
    try {
      const choferId = req.user?.chofer?.id;

      if (!choferId) {
        return res.status(400).json({
          success: false,
          message: 'El usuario no tiene un chofer asociado'
        });
      }

      const liquidaciones = await prisma.liquidacion.findMany({
        where: {
          choferId
        },
        include: {
          coordinador: {
            select: {
              id: true,
              email: true,
              rol: true,
              coordinador: {
                select: {
                  id: true,
                  nombre: true,
                  email: true
                }
              },
              duenio: {
                select: {
                  id: true,
                  nombre: true,
                  telefono: true
                }
              }
            }
          },
          viajes: {
            select: {
              id: true,
              origen: true,
              destino: true,
              precio: true,
              fecha: true,
              metodoPago: true,
              clienteNombre: true
            },
            orderBy: {
              fecha: 'desc'
            }
          }
        },
        orderBy: {
          fecha: 'desc'
        }
      });

      res.json({
        success: true,
        data: liquidaciones
      });
    } catch (error) {
      console.error('Error al obtener historial para chofer:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
};

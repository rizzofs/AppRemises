import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../types';


export const vehiculoController = {
  // Obtener todos los vehículos
  async getAll(req: AuthenticatedRequest, res: Response) {
    try {
      const { rol, id: userId } = req.user!;
      let whereClause: any = {};

      if (rol === 'DUENIO') {
        const duenio = await prisma.duenio.findUnique({
          where: { userId },
          include: { remiserias: { select: { remiseriaId: true } } }
        });
        const remiseriaIds = duenio?.remiserias.map(r => r.remiseriaId) || [];
        whereClause = { remiseriaId: { in: remiseriaIds } };
      } else if (rol === 'COORDINADOR') {
        const coordinador = await prisma.coordinador.findFirst({
          where: { userId }
        });
        whereClause = { remiseriaId: coordinador?.remiseriaId || '' };
      }

      const vehiculos = await prisma.vehiculo.findMany({
        where: whereClause,
        include: {
          remiseria: {
            select: {
              id: true,
              nombreFantasia: true,
            },
          },
          choferes: {
            select: {
              id: true,
              numeroChofer: true,
              nombre: true,
              apellido: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      res.json({
        success: true,
        data: vehiculos,
      });
    } catch (error) {
      console.error('Error getting vehiculos:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // Obtener vehículos por remisería
  async getByRemiseria(req: AuthenticatedRequest, res: Response) {
    try {
      const { remiseriaId } = req.params;
      const { rol, id: userId } = req.user!;

      // Validar acceso a la remiseriaId
      if (rol === 'DUENIO') {
        const duenio = await prisma.duenio.findUnique({
          where: { userId },
          include: { remiserias: { select: { remiseriaId: true } } }
        });
        const remiseriaIds = duenio?.remiserias.map(r => r.remiseriaId) || [];
        if (!remiseriaIds.includes(remiseriaId)) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para acceder a esta remisería',
          });
        }
      } else if (rol === 'COORDINADOR') {
        const coordinador = await prisma.coordinador.findFirst({
          where: { userId }
        });
        if (coordinador?.remiseriaId !== remiseriaId) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para acceder a esta remisería',
          });
        }
      }

      const vehiculos = await prisma.vehiculo.findMany({
        where: {
          remiseriaId,
        },
        include: {
          remiseria: {
            select: {
              id: true,
              nombreFantasia: true,
            },
          },
          choferes: {
            select: {
              id: true,
              numeroChofer: true,
              nombre: true,
              apellido: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      res.json({
        success: true,
        data: vehiculos,
      });
    } catch (error) {
      console.error('Error getting vehiculos by remiseria:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // Obtener vehículo por ID
  async getById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { rol, id: userId } = req.user!;

      const vehiculo = await prisma.vehiculo.findFirst({
        where: {
          id,
        },
        include: {
          remiseria: {
            select: {
              id: true,
              nombreFantasia: true,
            },
          },
          choferes: {
            select: {
              id: true,
              numeroChofer: true,
              nombre: true,
              apellido: true,
            },
          },
        },
      });

      if (!vehiculo) {
        return res.status(404).json({
          success: false,
          message: 'Vehículo no encontrado',
        });
      }

      // Validar acceso
      if (rol === 'DUENIO') {
        const duenio = await prisma.duenio.findUnique({
          where: { userId },
          include: { remiserias: { select: { remiseriaId: true } } }
        });
        const remiseriaIds = duenio?.remiserias.map(r => r.remiseriaId) || [];
        if (!remiseriaIds.includes(vehiculo.remiseriaId)) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para ver este vehículo',
          });
        }
      } else if (rol === 'COORDINADOR') {
        const coordinador = await prisma.coordinador.findFirst({
          where: { userId }
        });
        if (coordinador?.remiseriaId !== vehiculo.remiseriaId) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para ver este vehículo',
          });
        }
      }

      res.json({
        success: true,
        data: vehiculo,
      });
    } catch (error) {
      console.error('Error getting vehiculo:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // Crear vehículo
  async create(req: AuthenticatedRequest, res: Response) {
    try {
      const { 
        patente, 
        marca, 
        modelo, 
        anio, 
        color, 
        tipo, 
        capacidad, 
        propietario, 
        vtoVtv, 
        vtoMatafuego, 
        vtoSeguro, 
        observaciones, 
        remiseriaId 
      } = req.body;

      // Validar campos requeridos
      if (!patente || !marca || !modelo || !anio || !color || !tipo || !capacidad || !propietario || !remiseriaId) {
        return res.status(400).json({
          success: false,
          message: 'Los campos patente, marca, modelo, año, color, tipo, capacidad, propietario y remisería son requeridos',
        });
      }

      // Verificar si la patente ya existe
      const existingVehiculo = await prisma.vehiculo.findFirst({
        where: {
          patente,
        },
      });

      if (existingVehiculo) {
        return res.status(400).json({
          success: false,
          message: 'La patente ya está registrada',
        });
      }

      // Verificar que la remisería existe
      const remiseria = await prisma.remiseria.findUnique({
        where: { id: remiseriaId },
      });

      if (!remiseria) {
        return res.status(400).json({
          success: false,
          message: 'Remisería no encontrada',
        });
      }

      // Validar acceso del usuario creador a la remisería
      const { rol, id: userId } = req.user!;
      if (rol === 'DUENIO') {
        const duenio = await prisma.duenio.findUnique({
          where: { userId },
          include: { remiserias: { select: { remiseriaId: true } } }
        });
        const remiseriaIds = duenio?.remiserias.map(r => r.remiseriaId) || [];
        if (!remiseriaIds.includes(remiseriaId)) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para crear vehículos en esta remisería',
          });
        }
      } else if (rol === 'COORDINADOR') {
        const coordinador = await prisma.coordinador.findFirst({
          where: { userId }
        });
        if (coordinador?.remiseriaId !== remiseriaId) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para crear vehículos en esta remisería',
          });
        }
      }

      const vehiculo = await prisma.vehiculo.create({
        data: {
          patente,
          marca,
          modelo,
          anio,
          color,
          tipo,
          capacidad,
          propietario,
          vtoVtv: vtoVtv ? new Date(vtoVtv) : null,
          vtoMatafuego: vtoMatafuego ? new Date(vtoMatafuego) : null,
          vtoSeguro: vtoSeguro ? new Date(vtoSeguro) : null,
          observaciones,
          remiseriaId,
        },
        include: {
          remiseria: {
            select: {
              id: true,
              nombreFantasia: true,
            },
          },
          choferes: {
            select: {
              id: true,
              numeroChofer: true,
              nombre: true,
              apellido: true,
            },
          },
        },
      });

      // Registrar log de auditoría
      if (req.user) {
        await prisma.appUsage.create({
          data: {
            userId: req.user.id,
            userEmail: req.user.email,
            action: 'CREATE_VEHICULO',
            details: JSON.stringify({ vehiculoId: vehiculo.id, patente: vehiculo.patente, modelo: `${vehiculo.marca} ${vehiculo.modelo}` }),
            ipAddress: req.ip,
            userAgent: req.get('User-Agent') || null
          }
        });
      }

      res.status(201).json({
        success: true,
        data: vehiculo,
        message: 'Vehículo creado exitosamente',
      });
    } catch (error) {
      console.error('Error creating vehiculo:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // Actualizar vehículo
  async update(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { 
        patente, 
        marca, 
        modelo, 
        anio, 
        color, 
        tipo, 
        capacidad, 
        propietario, 
        vtoVtv, 
        vtoMatafuego, 
        vtoSeguro, 
        observaciones, 
        estado 
      } = req.body;

      // Verificar que el vehículo existe
      const existingVehiculo = await prisma.vehiculo.findFirst({
        where: {
          id,
        },
      });

      if (!existingVehiculo) {
        return res.status(404).json({
          success: false,
          message: 'Vehículo no encontrado',
        });
      }

      // Validar acceso
      const { rol, id: userId } = req.user!;
      if (rol === 'DUENIO') {
        const duenio = await prisma.duenio.findUnique({
          where: { userId },
          include: { remiserias: { select: { remiseriaId: true } } }
        });
        const remiseriaIds = duenio?.remiserias.map(r => r.remiseriaId) || [];
        if (!remiseriaIds.includes(existingVehiculo.remiseriaId)) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para modificar vehículos de esta remisería',
          });
        }
      } else if (rol === 'COORDINADOR') {
        const coordinador = await prisma.coordinador.findFirst({
          where: { userId }
        });
        if (coordinador?.remiseriaId !== existingVehiculo.remiseriaId) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para modificar vehículos de esta remisería',
          });
        }
      }

      // Si se está cambiando la patente, verificar que no exista
      if (patente && patente !== existingVehiculo.patente) {
        const patenteExists = await prisma.vehiculo.findFirst({
          where: {
            patente,
            id: { not: id },
          },
        });

        if (patenteExists) {
          return res.status(400).json({
            success: false,
            message: 'La patente ya está registrada',
          });
        }
      }

      // Preparar datos de actualización
      const updateData: any = {};
      if (patente) updateData.patente = patente;
      if (marca) updateData.marca = marca;
      if (modelo) updateData.modelo = modelo;
      if (anio) updateData.anio = anio;
      if (color) updateData.color = color;
      if (tipo) updateData.tipo = tipo;
      if (capacidad) updateData.capacidad = capacidad;
      if (propietario) updateData.propietario = propietario;
      if (vtoVtv !== undefined) updateData.vtoVtv = vtoVtv ? new Date(vtoVtv) : null;
      if (vtoMatafuego !== undefined) updateData.vtoMatafuego = vtoMatafuego ? new Date(vtoMatafuego) : null;
      if (vtoSeguro !== undefined) updateData.vtoSeguro = vtoSeguro ? new Date(vtoSeguro) : null;
      if (observaciones !== undefined) updateData.observaciones = observaciones;
      if (estado) updateData.estado = estado;

      const vehiculo = await prisma.vehiculo.update({
        where: { id },
        data: updateData,
        include: {
          remiseria: {
            select: {
              id: true,
              nombreFantasia: true,
            },
          },
          choferes: {
            select: {
              id: true,
              numeroChofer: true,
              nombre: true,
              apellido: true,
            },
          },
        },
      });

      // Registrar log de auditoría
      if (req.user) {
        await prisma.appUsage.create({
          data: {
            userId: req.user.id,
            userEmail: req.user.email,
            action: 'UPDATE_VEHICULO',
            details: JSON.stringify({ vehiculoId: vehiculo.id, patente: vehiculo.patente, modelo: `${vehiculo.marca} ${vehiculo.modelo}` }),
            ipAddress: req.ip,
            userAgent: req.get('User-Agent') || null
          }
        });
      }

      res.json({
        success: true,
        data: vehiculo,
        message: 'Vehículo actualizado exitosamente',
      });
    } catch (error) {
      console.error('Error updating vehiculo:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // Baja lógica del vehículo
  async delete(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;

      // Verificar que el vehículo existe
      const vehiculo = await prisma.vehiculo.findFirst({
        where: {
          id,
        },
      });

      if (!vehiculo) {
        return res.status(404).json({
          success: false,
          message: 'Vehículo no encontrado',
        });
      }

      // Validar acceso
      const { rol, id: userId } = req.user!;
      if (rol === 'DUENIO') {
        const duenio = await prisma.duenio.findUnique({
          where: { userId },
          include: { remiserias: { select: { remiseriaId: true } } }
        });
        const remiseriaIds = duenio?.remiserias.map(r => r.remiseriaId) || [];
        if (!remiseriaIds.includes(vehiculo.remiseriaId)) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para eliminar vehículos de esta remisería',
          });
        }
      } else if (rol === 'COORDINADOR') {
        const coordinador = await prisma.coordinador.findFirst({
          where: { userId }
        });
        if (coordinador?.remiseriaId !== vehiculo.remiseriaId) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para eliminar vehículos de esta remisería',
          });
        }
      }

      // Baja lógica (marcar como inactivo)
      await prisma.vehiculo.update({
        where: { id },
        data: { estado: 'INACTIVO' },
      });

      // Registrar log de auditoría
      if (req.user) {
        await prisma.appUsage.create({
          data: {
            userId: req.user.id,
            userEmail: req.user.email,
            action: 'DELETE_VEHICULO',
            details: JSON.stringify({ vehiculoId: vehiculo.id, patente: vehiculo.patente }),
            ipAddress: req.ip,
            userAgent: req.get('User-Agent') || null
          }
        });
      }

      res.json({
        success: true,
        message: 'Vehículo eliminado exitosamente',
      });
    } catch (error) {
      console.error('Error deleting vehiculo:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // Cambiar estado del vehículo
  async updateStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { estado } = req.body;

      if (!estado || !['ACTIVO', 'MANTENIMIENTO', 'INACTIVO'].includes(estado)) {
        return res.status(400).json({
          success: false,
          message: 'Estado inválido. Debe ser ACTIVO, MANTENIMIENTO o INACTIVO',
        });
      }

      const vehiculo = await prisma.vehiculo.findUnique({
        where: { id },
      });

      if (!vehiculo) {
        return res.status(404).json({
          success: false,
          message: 'Vehículo no encontrado',
        });
      }

      // Validar acceso
      const { rol, id: userId } = req.user!;
      if (rol === 'DUENIO') {
        const duenio = await prisma.duenio.findUnique({
          where: { userId },
          include: { remiserias: { select: { remiseriaId: true } } }
        });
        const remiseriaIds = duenio?.remiserias.map(r => r.remiseriaId) || [];
        if (!remiseriaIds.includes(vehiculo.remiseriaId)) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para modificar vehículos de esta remisería',
          });
        }
      } else if (rol === 'COORDINADOR') {
        const coordinador = await prisma.coordinador.findFirst({
          where: { userId }
        });
        if (coordinador?.remiseriaId !== vehiculo.remiseriaId) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para modificar vehículos de esta remisería',
          });
        }
      }

      const updatedVehiculo = await prisma.vehiculo.update({
        where: { id },
        data: { estado },
        include: {
          remiseria: {
            select: {
              id: true,
              nombreFantasia: true,
            },
          },
        },
      });

      // Registrar log de auditoría
      if (req.user) {
        await prisma.appUsage.create({
          data: {
            userId: req.user.id,
            userEmail: req.user.email,
            action: 'UPDATE_VEHICULO_STATUS',
            details: JSON.stringify({ vehiculoId: updatedVehiculo.id, patente: updatedVehiculo.patente, estado }),
            ipAddress: req.ip,
            userAgent: req.get('User-Agent') || null
          }
        });
      }

      res.json({
        success: true,
        data: updatedVehiculo,
        message: `Vehículo ${estado.toLowerCase()} exitosamente`,
      });
    } catch (error) {
      console.error('Error updating vehiculo status:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },
}; 
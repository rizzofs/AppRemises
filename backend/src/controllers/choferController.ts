import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const choferController = {
  // Obtener todos los choferes
  async getAll(req: Request, res: Response) {
    try {
      const choferes = await prisma.chofer.findMany({
        where: {
          // Removemos el filtro de activo para obtener todos
        },
        include: {
          remiseria: {
            select: {
              id: true,
              nombreFantasia: true,
            },
          },
          vehiculo: {
            select: {
              id: true,
              patente: true,
              marca: true,
              modelo: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      res.json({
        success: true,
        data: choferes,
      });
    } catch (error) {
      console.error('Error getting choferes:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // Obtener choferes por remisería
  async getByRemiseria(req: Request, res: Response) {
    try {
      const { remiseriaId } = req.params;

      const choferes = await prisma.chofer.findMany({
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
          vehiculo: {
            select: {
              id: true,
              patente: true,
              marca: true,
              modelo: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      res.json({
        success: true,
        data: choferes,
      });
    } catch (error) {
      console.error('Error getting choferes by remiseria:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // Obtener chofer por ID
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const chofer = await prisma.chofer.findFirst({
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
          vehiculo: {
            select: {
              id: true,
              patente: true,
              marca: true,
              modelo: true,
            },
          },
        },
      });

      if (!chofer) {
        return res.status(404).json({
          success: false,
          message: 'Chofer no encontrado',
        });
      }

      res.json({
        success: true,
        data: chofer,
      });
    } catch (error) {
      console.error('Error getting chofer:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // Crear chofer
  async create(req: Request, res: Response) {
    try {
      const { 
        numeroChofer, 
        nombre, 
        apellido, 
        dni, 
        telefono, 
        email, 
        direccion, 
        categoriaLicencia, 
        vtoLicencia, 
        observaciones, 
        remiseriaId, 
        vehiculoId 
      } = req.body;

      // Validar campos requeridos
      if (!numeroChofer || !nombre || !apellido || !dni || !telefono || !categoriaLicencia || !vtoLicencia || !remiseriaId) {
        return res.status(400).json({
          success: false,
          message: 'Los campos número de chofer, nombre, apellido, DNI, teléfono, categoría de licencia, vencimiento de licencia y remisería son requeridos',
        });
      }

      // Verificar si el número de chofer ya existe
      const existingNumeroChofer = await prisma.chofer.findFirst({
        where: {
          numeroChofer,
        },
      });

      if (existingNumeroChofer) {
        return res.status(400).json({
          success: false,
          message: 'El número de chofer ya está registrado',
        });
      }

      // Verificar si el DNI ya existe
      const existingChofer = await prisma.chofer.findFirst({
        where: {
          dni,
        },
      });

      if (existingChofer) {
        return res.status(400).json({
          success: false,
          message: 'El DNI ya está registrado',
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

      // Verificar que el vehículo existe si se proporciona
      if (vehiculoId) {
        const vehiculo = await prisma.vehiculo.findUnique({
          where: { id: vehiculoId },
        });

        if (!vehiculo) {
          return res.status(400).json({
            success: false,
            message: 'Vehículo no encontrado',
          });
        }
      }

      const chofer = await prisma.chofer.create({
        data: {
          numeroChofer,
          nombre,
          apellido,
          dni,
          telefono,
          email,
          direccion,
          categoriaLicencia,
          vtoLicencia: new Date(vtoLicencia),
          observaciones: observaciones || null,
          remiseriaId,
          vehiculoId: vehiculoId || null,
        },
        include: {
          remiseria: {
            select: {
              id: true,
              nombreFantasia: true,
            },
          },
          vehiculo: {
            select: {
              id: true,
              patente: true,
              marca: true,
              modelo: true,
            },
          },
        },
      });

      res.status(201).json({
        success: true,
        data: chofer,
        message: 'Chofer creado exitosamente',
      });
    } catch (error) {
      console.error('Error creating chofer:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // Actualizar chofer
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { 
        numeroChofer, 
        nombre, 
        apellido, 
        dni, 
        telefono, 
        email, 
        direccion, 
        categoriaLicencia, 
        vtoLicencia, 
        observaciones, 
        estado, 
        vehiculoId 
      } = req.body;

      // Verificar que el chofer existe
      const existingChofer = await prisma.chofer.findFirst({
        where: {
          id,
        },
      });

      if (!existingChofer) {
        return res.status(404).json({
          success: false,
          message: 'Chofer no encontrado',
        });
      }

      // Si se está cambiando el número de chofer, verificar que no exista
      if (numeroChofer && numeroChofer !== existingChofer.numeroChofer) {
        const numeroChoferExists = await prisma.chofer.findFirst({
          where: {
            numeroChofer,
            id: { not: id },
          },
        });

        if (numeroChoferExists) {
          return res.status(400).json({
            success: false,
            message: 'El número de chofer ya está registrado',
          });
        }
      }

      // Si se está cambiando el DNI, verificar que no exista
      if (dni && dni !== existingChofer.dni) {
        const dniExists = await prisma.chofer.findFirst({
          where: {
            dni,
            id: { not: id },
          },
        });

        if (dniExists) {
          return res.status(400).json({
            success: false,
            message: 'El DNI ya está registrado',
          });
        }
      }

      // Verificar que el vehículo existe si se proporciona
      if (vehiculoId) {
        const vehiculo = await prisma.vehiculo.findUnique({
          where: { id: vehiculoId },
        });

        if (!vehiculo) {
          return res.status(400).json({
            success: false,
            message: 'Vehículo no encontrado',
          });
        }
      }

      // Preparar datos de actualización
      const updateData: any = {};
      if (numeroChofer) updateData.numeroChofer = numeroChofer;
      if (nombre) updateData.nombre = nombre;
      if (apellido) updateData.apellido = apellido;
      if (dni) updateData.dni = dni;
      if (telefono) updateData.telefono = telefono;
      if (email !== undefined) updateData.email = email;
      if (direccion !== undefined) updateData.direccion = direccion;
      if (categoriaLicencia) updateData.categoriaLicencia = categoriaLicencia;
      if (vtoLicencia) updateData.vtoLicencia = new Date(vtoLicencia);
      if (observaciones !== undefined) updateData.observaciones = observaciones;
      if (estado !== undefined) updateData.estado = estado;
      if (vehiculoId !== undefined) updateData.vehiculoId = vehiculoId;

      const chofer = await prisma.chofer.update({
        where: { id },
        data: updateData,
        include: {
          remiseria: {
            select: {
              id: true,
              nombreFantasia: true,
            },
          },
          vehiculo: {
            select: {
              id: true,
              patente: true,
              marca: true,
              modelo: true,
            },
          },
        },
      });

      res.json({
        success: true,
        data: chofer,
        message: 'Chofer actualizado exitosamente',
      });
    } catch (error) {
      console.error('Error updating chofer:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // Baja lógica del chofer
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Verificar que el chofer existe
      const chofer = await prisma.chofer.findFirst({
        where: {
          id,
        },
      });

      if (!chofer) {
        return res.status(404).json({
          success: false,
          message: 'Chofer no encontrado',
        });
      }

      // Baja lógica (marcar como dado de baja)
      await prisma.chofer.update({
        where: { id },
        data: { estado: 'DADO_DE_BAJA' },
      });

      res.json({
        success: true,
        message: 'Chofer eliminado exitosamente',
      });
    } catch (error) {
      console.error('Error deleting chofer:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // Cambiar estado del chofer (activar/suspender/dar de baja)
  async toggleStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const chofer = await prisma.chofer.findUnique({
        where: { id },
      });

      if (!chofer) {
        return res.status(404).json({
          success: false,
          message: 'Chofer no encontrado',
        });
      }

      // Cambiar estado: ACTIVO -> SUSPENDIDO -> DADO_DE_BAJA -> ACTIVO
      let newEstado: 'ACTIVO' | 'SUSPENDIDO' | 'DADO_DE_BAJA';
      let message: string;

      switch (chofer.estado) {
        case 'ACTIVO':
          newEstado = 'SUSPENDIDO';
          message = 'Chofer suspendido exitosamente';
          break;
        case 'SUSPENDIDO':
          newEstado = 'DADO_DE_BAJA';
          message = 'Chofer dado de baja exitosamente';
          break;
        case 'DADO_DE_BAJA':
          newEstado = 'ACTIVO';
          message = 'Chofer activado exitosamente';
          break;
        default:
          newEstado = 'ACTIVO';
          message = 'Chofer activado exitosamente';
      }

      const updatedChofer = await prisma.chofer.update({
        where: { id },
        data: { estado: newEstado },
        include: {
          remiseria: {
            select: {
              id: true,
              nombreFantasia: true,
            },
          },
          vehiculo: {
            select: {
              id: true,
              patente: true,
              marca: true,
              modelo: true,
            },
          },
        },
      });

      res.json({
        success: true,
        data: updatedChofer,
        message,
      });
    } catch (error) {
      console.error('Error toggling chofer status:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },
}; 
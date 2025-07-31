import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export const coordinadorController = {
  // Obtener todos los coordinadores
  async getAll(req: Request, res: Response) {
    try {
      const coordinadores = await prisma.coordinador.findMany({
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
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      res.json({
        success: true,
        data: coordinadores,
      });
    } catch (error) {
      console.error('Error getting coordinadores:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // Obtener coordinadores por remisería
  async getByRemiseria(req: Request, res: Response) {
    try {
      const { remiseriaId } = req.params;

      const coordinadores = await prisma.coordinador.findMany({
        where: {
          remiseriaId,
          activo: true,
        },
        include: {
          remiseria: {
            select: {
              id: true,
              nombreFantasia: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      res.json({
        success: true,
        data: coordinadores,
      });
    } catch (error) {
      console.error('Error getting coordinadores by remiseria:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // Obtener coordinador por ID
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const coordinador = await prisma.coordinador.findFirst({
        where: {
          id,
          activo: true,
        },
        include: {
          remiseria: {
            select: {
              id: true,
              nombreFantasia: true,
            },
          },
        },
      });

      if (!coordinador) {
        return res.status(404).json({
          success: false,
          message: 'Coordinador no encontrado',
        });
      }

      res.json({
        success: true,
        data: coordinador,
      });
    } catch (error) {
      console.error('Error getting coordinador:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // Crear coordinador
  async create(req: Request, res: Response) {
    try {
      const { nombre, email, password, remiseriaId } = req.body;

      // Validar campos requeridos
      if (!nombre || !email || !password || !remiseriaId) {
        return res.status(400).json({
          success: false,
          message: 'Todos los campos son requeridos',
        });
      }

      // Verificar si el email ya existe
      const existingCoordinador = await prisma.coordinador.findFirst({
        where: {
          email,
          activo: true,
        },
      });

      if (existingCoordinador) {
        return res.status(400).json({
          success: false,
          message: 'El email ya está registrado',
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

      // Encriptar contraseña
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      const coordinador = await prisma.coordinador.create({
        data: {
          nombre,
          email,
          passwordHash,
          remiseriaId,
        },
        include: {
          remiseria: {
            select: {
              id: true,
              nombreFantasia: true,
            },
          },
        },
      });

      res.status(201).json({
        success: true,
        data: coordinador,
        message: 'Coordinador creado exitosamente',
      });
    } catch (error) {
      console.error('Error creating coordinador:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // Actualizar coordinador
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { nombre, email, password, activo } = req.body;

      // Verificar que el coordinador existe
      const existingCoordinador = await prisma.coordinador.findFirst({
        where: {
          id,
          activo: true,
        },
      });

      if (!existingCoordinador) {
        return res.status(404).json({
          success: false,
          message: 'Coordinador no encontrado',
        });
      }

      // Si se está cambiando el email, verificar que no exista
      if (email && email !== existingCoordinador.email) {
        const emailExists = await prisma.coordinador.findFirst({
          where: {
            email,
            activo: true,
            id: { not: id },
          },
        });

        if (emailExists) {
          return res.status(400).json({
            success: false,
            message: 'El email ya está registrado',
          });
        }
      }

      // Preparar datos de actualización
      const updateData: any = {};
      if (nombre) updateData.nombre = nombre;
      if (email) updateData.email = email;
      if (activo !== undefined) updateData.activo = activo;

      // Si se proporciona nueva contraseña, encriptarla
      if (password) {
        const saltRounds = 10;
        updateData.passwordHash = await bcrypt.hash(password, saltRounds);
      }

      const coordinador = await prisma.coordinador.update({
        where: { id },
        data: updateData,
        include: {
          remiseria: {
            select: {
              id: true,
              nombreFantasia: true,
            },
          },
        },
      });

      res.json({
        success: true,
        data: coordinador,
        message: 'Coordinador actualizado exitosamente',
      });
    } catch (error) {
      console.error('Error updating coordinador:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // Baja lógica del coordinador
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Verificar que el coordinador existe
      const coordinador = await prisma.coordinador.findFirst({
        where: {
          id,
          activo: true,
        },
      });

      if (!coordinador) {
        return res.status(404).json({
          success: false,
          message: 'Coordinador no encontrado',
        });
      }

      // Baja lógica (marcar como inactivo)
      await prisma.coordinador.update({
        where: { id },
        data: { activo: false },
      });

      res.json({
        success: true,
        message: 'Coordinador eliminado exitosamente',
      });
    } catch (error) {
      console.error('Error deleting coordinador:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // Cambiar estado del coordinador (activar/desactivar)
  async toggleStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const coordinador = await prisma.coordinador.findUnique({
        where: { id },
      });

      if (!coordinador) {
        return res.status(404).json({
          success: false,
          message: 'Coordinador no encontrado',
        });
      }

      const updatedCoordinador = await prisma.coordinador.update({
        where: { id },
        data: { activo: !coordinador.activo },
        include: {
          remiseria: {
            select: {
              id: true,
              nombreFantasia: true,
            },
          },
        },
      });

      res.json({
        success: true,
        data: updatedCoordinador,
        message: `Coordinador ${updatedCoordinador.activo ? 'activado' : 'desactivado'} exitosamente`,
      });
    } catch (error) {
      console.error('Error toggling coordinador status:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },
}; 
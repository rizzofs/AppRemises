import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../types';
import bcrypt from 'bcryptjs';


export const coordinadorController = {
  // Obtener todos los coordinadores
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

      const coordinadores = await prisma.coordinador.findMany({
        where: whereClause,
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
  async getById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { rol, id: userId } = req.user!;

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

      // Validar acceso
      if (rol === 'DUENIO') {
        const duenio = await prisma.duenio.findUnique({
          where: { userId },
          include: { remiserias: { select: { remiseriaId: true } } }
        });
        const remiseriaIds = duenio?.remiserias.map(r => r.remiseriaId) || [];
        if (!remiseriaIds.includes(coordinador.remiseriaId)) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para ver este coordinador',
          });
        }
      } else if (rol === 'COORDINADOR') {
        const loggedCoord = await prisma.coordinador.findFirst({
          where: { userId }
        });
        if (loggedCoord?.remiseriaId !== coordinador.remiseriaId) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para ver este coordinador',
          });
        }
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
  async create(req: AuthenticatedRequest, res: Response) {
    try {
      const { nombre, email, password, remiseriaId } = req.body;
      const { rol, id: userId } = req.user!;

      // Validar campos requeridos
      if (!nombre || !email || !password || !remiseriaId) {
        return res.status(400).json({
          success: false,
          message: 'Todos los campos son requeridos',
        });
      }

      // Validar acceso a la remisería
      if (rol === 'DUENIO') {
        const duenio = await prisma.duenio.findUnique({
          where: { userId },
          include: { remiserias: { select: { remiseriaId: true } } }
        });
        const remiseriaIds = duenio?.remiserias.map(r => r.remiseriaId) || [];
        if (!remiseriaIds.includes(remiseriaId)) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para crear coordinadores en esta remisería',
          });
        }
      } else if (rol === 'COORDINADOR') {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para crear coordinadores',
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
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            passwordHash,
            rol: 'COORDINADOR',
          }
        });

        const coordinador = await tx.coordinador.create({
          data: {
            nombre,
            email,
            passwordHash,
            remiseriaId,
            userId: user.id
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

        return coordinador;
      });

      res.status(201).json({
        success: true,
        data: result,
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
  async update(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { nombre, email, password, activo } = req.body;
      const { rol, id: userId } = req.user!;

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

      // Validar acceso
      if (rol === 'DUENIO') {
        const duenio = await prisma.duenio.findUnique({
          where: { userId },
          include: { remiserias: { select: { remiseriaId: true } } }
        });
        const remiseriaIds = duenio?.remiserias.map(r => r.remiseriaId) || [];
        if (!remiseriaIds.includes(existingCoordinador.remiseriaId)) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para modificar este coordinador',
          });
        }
      } else if (rol === 'COORDINADOR') {
        if (userId !== existingCoordinador.userId) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para modificar este coordinador',
          });
        }
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
      let passwordHash: string | undefined;
      if (password) {
        const saltRounds = 12;
        passwordHash = await bcrypt.hash(password, saltRounds);
      }

      const result = await prisma.$transaction(async (tx) => {
        const updateData: any = {};
        if (nombre) updateData.nombre = nombre;
        if (email) updateData.email = email;
        if (activo !== undefined) updateData.activo = activo;
        if (passwordHash) updateData.passwordHash = passwordHash;

        const coordinador = await tx.coordinador.update({
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

        if (existingCoordinador.userId) {
          const userUpdateData: any = {};
          if (email) userUpdateData.email = email;
          if (activo !== undefined) userUpdateData.activo = activo;
          if (passwordHash) userUpdateData.passwordHash = passwordHash;

          if (Object.keys(userUpdateData).length > 0) {
            await tx.user.update({
              where: { id: existingCoordinador.userId },
              data: userUpdateData
            });
          }
        }

        return coordinador;
      });

      res.json({
        success: true,
        data: result,
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
  async delete(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { rol, id: userId } = req.user!;

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

      // Validar acceso
      if (rol === 'DUENIO') {
        const duenio = await prisma.duenio.findUnique({
          where: { userId },
          include: { remiserias: { select: { remiseriaId: true } } }
        });
        const remiseriaIds = duenio?.remiserias.map(r => r.remiseriaId) || [];
        if (!remiseriaIds.includes(coordinador.remiseriaId)) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para eliminar este coordinador',
          });
        }
      } else if (rol === 'COORDINADOR') {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para eliminar coordinadores',
        });
      }

      // Baja lógica (marcar como inactivo)
      await prisma.$transaction(async (tx) => {
        await tx.coordinador.update({
          where: { id },
          data: { activo: false },
        });

        if (coordinador.userId) {
          await tx.user.update({
            where: { id: coordinador.userId },
            data: { activo: false }
          });
        }
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
  async toggleStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { rol, id: userId } = req.user!;

      const coordinador = await prisma.coordinador.findUnique({
        where: { id },
      });

      if (!coordinador) {
        return res.status(404).json({
          success: false,
          message: 'Coordinador no encontrado',
        });
      }

      // Validar acceso
      if (rol === 'DUENIO') {
        const duenio = await prisma.duenio.findUnique({
          where: { userId },
          include: { remiserias: { select: { remiseriaId: true } } }
        });
        const remiseriaIds = duenio?.remiserias.map(r => r.remiseriaId) || [];
        if (!remiseriaIds.includes(coordinador.remiseriaId)) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para modificar este coordinador',
          });
        }
      } else if (rol === 'COORDINADOR') {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para modificar coordinadores',
        });
      }

      const newStatus = !coordinador.activo;

      const updatedCoordinador = await prisma.$transaction(async (tx) => {
        const coord = await tx.coordinador.update({
          where: { id },
          data: { activo: newStatus },
          include: {
            remiseria: {
              select: {
                id: true,
                nombreFantasia: true,
              },
            },
          },
        });

        if (coordinador.userId) {
          await tx.user.update({
            where: { id: coordinador.userId },
            data: { activo: newStatus }
          });
        }

        return coord;
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
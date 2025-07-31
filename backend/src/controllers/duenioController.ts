import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { ApiResponse, CreateDuenioRequest, UpdateDuenioRequest, AuthenticatedRequest } from '../types';

export const getAllDuenios = async (req: Request, res: Response) => {
  try {
    const duenios = await prisma.duenio.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            activo: true,
            createdAt: true
          }
        },
        remiserias: {
          include: {
            remiseria: true
          }
        }
      }
    });

    const response: ApiResponse = {
      success: true,
      data: duenios,
      message: 'Dueños obtenidos exitosamente'
    };

    res.json(response);
  } catch (error) {
    console.error('Error al obtener dueños:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

export const getDuenioById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const duenio = await prisma.duenio.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            activo: true,
            createdAt: true
          }
        },
        remiserias: {
          include: {
            remiseria: true
          }
        }
      }
    });

    if (!duenio) {
      return res.status(404).json({
        success: false,
        error: 'Dueño no encontrado'
      });
    }

    const response: ApiResponse = {
      success: true,
      data: duenio,
      message: 'Dueño obtenido exitosamente'
    };

    res.json(response);
  } catch (error) {
    console.error('Error al obtener dueño:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

export const createDuenio = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, password, nombre, telefono, dni, remiseriaIds }: CreateDuenioRequest = req.body;

    // Verificar si el usuario ya existe
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'El email ya está registrado'
      });
    }

    // Verificar si el DNI ya existe
    const existingDuenio = await prisma.duenio.findUnique({
      where: { dni }
    });

    if (existingDuenio) {
      return res.status(400).json({
        success: false,
        error: 'El DNI ya está registrado'
      });
    }

    // Encriptar contraseña
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Crear usuario y dueño en una transacción
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          rol: 'DUENIO'
        }
      });

      const duenio = await tx.duenio.create({
        data: {
          nombre,
          telefono,
          dni,
          userId: user.id
        }
      });

      // Asociar con remiserías si se proporcionan
      if (remiseriaIds && remiseriaIds.length > 0) {
        await tx.remiseriaDuenio.createMany({
          data: remiseriaIds.map(remiseriaId => ({
            remiseriaId,
            duenioId: duenio.id
          }))
        });
      }

      return { user, duenio };
    });

    // Track creation if user is authenticated
    if (req.user) {
      await prisma.appUsage.create({
        data: {
          userId: req.user.id,
          userEmail: req.user.email,
          action: 'CREATE_DUENIO',
          details: JSON.stringify({ duenioId: result.duenio.id, nombre }),
          ipAddress: req.ip,
          userAgent: req.get('User-Agent') || null
        }
      });
    }

    const response: ApiResponse = {
      success: true,
      data: {
        id: result.duenio.id,
        nombre: result.duenio.nombre,
        telefono: result.duenio.telefono,
        dni: result.duenio.dni,
        userId: result.duenio.userId,
        createdAt: result.duenio.createdAt,
        updatedAt: result.duenio.updatedAt,
        user: {
          id: result.user.id,
          email: result.user.email,
          activo: result.user.activo,
          createdAt: result.user.createdAt
        }
      },
      message: 'Dueño creado exitosamente'
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Error al crear dueño:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

export const updateDuenio = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { rol, id: userId } = req.user!;
    const { nombre, telefono, dni, activo, email, password }: UpdateDuenioRequest = req.body;

    const duenio = await prisma.duenio.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!duenio) {
      return res.status(404).json({
        success: false,
        error: 'Dueño no encontrado'
      });
    }

    // Verificar permisos según el rol
    if (rol === 'DUENIO') {
      // Dueños solo pueden modificar sus propios datos y solo ciertos campos
      if (duenio.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'No tienes permisos para modificar este dueño'
        });
      }

      // Dueños NO pueden modificar: nombre, dni, activo
      if (nombre !== undefined || dni !== undefined || activo !== undefined) {
        return res.status(403).json({
          success: false,
          error: 'No tienes permisos para modificar nombre, DNI o estado'
        });
      }
    }

    // Verificar si el DNI ya existe (si se está actualizando y es admin)
    if (dni && dni !== duenio.dni && rol === 'ADMIN') {
      const existingDuenio = await prisma.duenio.findUnique({
        where: { dni }
      });

      if (existingDuenio) {
        return res.status(400).json({
          success: false,
          error: 'El DNI ya está registrado'
        });
      }
    }

    // Actualizar dueño y usuario en una transacción
    const result = await prisma.$transaction(async (tx) => {
      const updateData: any = {};
      
      // Solo admin puede modificar nombre y dni
      if (rol === 'ADMIN') {
        if (nombre !== undefined) updateData.nombre = nombre;
        if (dni !== undefined) updateData.dni = dni;
      }
      
      // Ambos pueden modificar teléfono
      if (telefono !== undefined) updateData.telefono = telefono;

      const updatedDuenio = await tx.duenio.update({
        where: { id },
        data: updateData
      });

      // Actualizar usuario
      const userUpdateData: any = {};
      
      // Solo admin puede cambiar el estado
      if (activo !== undefined && rol === 'ADMIN') {
        userUpdateData.activo = activo;
      }
      
      // Ambos pueden cambiar email
      if (email !== undefined) {
        userUpdateData.email = email;
      }
      
      // Ambos pueden cambiar contraseña
      if (password !== undefined) {
        const saltRounds = 12;
        userUpdateData.passwordHash = await bcrypt.hash(password, saltRounds);
      }

      if (Object.keys(userUpdateData).length > 0) {
        await tx.user.update({
          where: { id: duenio.userId },
          data: userUpdateData
        });
      }

      return updatedDuenio;
    });

    // Track update if user is authenticated
    if (req.user) {
      await prisma.appUsage.create({
        data: {
          userId: req.user.id,
          userEmail: req.user.email,
          action: 'UPDATE_DUENIO',
          details: JSON.stringify({ duenioId: id, changes: { nombre, telefono, dni, activo } }),
          ipAddress: req.ip,
          userAgent: req.get('User-Agent') || null
        }
      });
    }

    const response: ApiResponse = {
      success: true,
      data: result,
      message: 'Dueño actualizado exitosamente'
    };

    res.json(response);
  } catch (error) {
    console.error('Error al actualizar dueño:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

export const toggleDuenioStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const duenio = await prisma.duenio.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!duenio) {
      return res.status(404).json({
        success: false,
        error: 'Dueño no encontrado'
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: duenio.userId },
      data: { activo: !duenio.user.activo }
    });

    const response: ApiResponse = {
      success: true,
      data: {
        ...duenio,
        user: updatedUser
      },
      message: `Dueño ${updatedUser.activo ? 'activado' : 'desactivado'} exitosamente`
    };

    res.json(response);
  } catch (error) {
    console.error('Error al cambiar estado del dueño:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
}; 
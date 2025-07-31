import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest, JwtPayload } from '../types';

export const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Token de acceso requerido' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    
    // Buscar el usuario completo con sus relaciones
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: {
        duenio: true,
        coordinador: true,
        cliente: true
      }
    });

    if (!user || !user.activo) {
      return res.status(401).json({ success: false, error: 'Usuario no encontrado o inactivo' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      rol: user.rol,
      duenio: user.duenio ? {
        id: user.duenio.id,
        nombre: user.duenio.nombre,
        telefono: user.duenio.telefono,
        dni: user.duenio.dni,
        userId: user.duenio.userId
      } : undefined,
      coordinador: user.coordinador ? {
        id: user.coordinador.id,
        nombre: user.coordinador.nombre,
        email: user.coordinador.email,
        activo: user.coordinador.activo,
        remiseriaId: user.coordinador.remiseriaId,
        userId: user.coordinador.userId || ''
      } : undefined,
      cliente: user.cliente ? {
        id: user.cliente.id,
        nombre: user.cliente.nombre,
        apellido: user.cliente.apellido,
        dni: user.cliente.dni,
        telefono: user.cliente.telefono,
        email: user.cliente.email,
        direccion: user.cliente.direccion,
        fechaNacimiento: user.cliente.fechaNacimiento,
        genero: user.cliente.genero || undefined,
        activo: user.cliente.activo,
        userId: user.cliente.userId
      } : undefined
    };
    
    next();
  } catch (error) {
    return res.status(403).json({ success: false, error: 'Token inválido' });
  }
};

export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Autenticación requerida' });
  }

  if (req.user.rol !== 'ADMIN') {
    return res.status(403).json({ success: false, error: 'Acceso denegado. Se requiere rol de administrador' });
  }

  next();
};

export const requireDuenio = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Autenticación requerida' });
  }

  if (req.user.rol !== 'DUENIO') {
    return res.status(403).json({ success: false, error: 'Acceso denegado. Se requiere rol de dueño' });
  }

  next();
};

export const requireCoordinador = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Autenticación requerida' });
  }

  if (req.user.rol !== 'COORDINADOR') {
    return res.status(403).json({ success: false, error: 'Acceso denegado. Se requiere rol de coordinador' });
  }

  next();
}; 
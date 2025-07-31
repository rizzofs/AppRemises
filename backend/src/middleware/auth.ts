import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest, JwtPayload } from '../types';

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Token de acceso requerido' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    req.user = decoded;
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
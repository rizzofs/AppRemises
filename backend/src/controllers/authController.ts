import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { ApiResponse, LoginRequest, RegisterRequest } from '../types';

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password }: LoginRequest = req.body;

    // Buscar usuario
    const user = await prisma.user.findUnique({
      where: { email },
      include: { duenio: true }
    });

    if (!user || !user.activo) {
      return res.status(401).json({
        success: false,
        error: 'Credenciales inválidas'
      });
    }

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Credenciales inválidas'
      });
    }

    // Generar tokens
    const jwtSecret = process.env.JWT_SECRET;
    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;

    if (!jwtSecret || !jwtRefreshSecret) {
      console.error('JWT secrets not configured');
      return res.status(500).json({
        success: false,
        error: 'Error de configuración del servidor'
      });
    }

    const accessToken = jwt.sign(
      { id: user.id, email: user.email, rol: user.rol },
      jwtSecret,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { id: user.id },
      jwtRefreshSecret,
      { expiresIn: '7d' }
    );

    // Track login activity
    await prisma.appUsage.create({
      data: {
        userId: user.id,
        userEmail: user.email,
        action: 'LOGIN',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || null
      }
    });

    const response: ApiResponse = {
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          rol: user.rol,
          duenio: user.duenio
        },
        accessToken,
        refreshToken
      },
      message: 'Login exitoso'
    };

    res.json(response);
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, nombre, telefono }: RegisterRequest = req.body;

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

    // Encriptar contraseña
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Generar tokens
    const jwtSecret = process.env.JWT_SECRET;
    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;

    if (!jwtSecret || !jwtRefreshSecret) {
      console.error('JWT secrets not configured');
      return res.status(500).json({
        success: false,
        error: 'Error de configuración del servidor'
      });
    }

    // Crear usuario y dueño en una transacción
    const result = await prisma.$transaction(async (tx: any) => {
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
          userId: user.id
        }
      });

      return { user, duenio };
    });

    // Generar tokens después de crear el usuario
    const accessToken = jwt.sign(
      { id: result.user.id, email: result.user.email, rol: result.user.rol },
      jwtSecret,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { id: result.user.id },
      jwtRefreshSecret,
      { expiresIn: '7d' }
    );

    const response: ApiResponse = {
      success: true,
      data: {
        user: {
          id: result.user.id,
          email: result.user.email,
          rol: result.user.rol,
          duenio: result.duenio
        },
        accessToken,
        refreshToken
      },
      message: 'Usuario registrado exitosamente'
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

export const refreshToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token requerido'
      });
    }

    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtRefreshSecret || !jwtSecret) {
      console.error('JWT secrets not configured');
      return res.status(500).json({
        success: false,
        error: 'Error de configuración del servidor'
      });
    }

    // Verificar refresh token
    const decoded = jwt.verify(refreshToken, jwtRefreshSecret) as { id: string };
    
    // Buscar usuario
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { duenio: true }
    });

    if (!user || !user.activo) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no encontrado o inactivo'
      });
    }

    // Generar nuevo access token
    const newAccessToken = jwt.sign(
      { id: user.id, email: user.email, rol: user.rol },
      jwtSecret,
      { expiresIn: '15m' }
    );

    const response: ApiResponse = {
      success: true,
      data: {
        accessToken: newAccessToken
      },
      message: 'Token renovado exitosamente'
    };

    res.json(response);
  } catch (error) {
    console.error('Error en refresh token:', error);
    res.status(401).json({
      success: false,
      error: 'Refresh token inválido'
    });
  }
}; 
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { ApiResponse, LoginRequest, RegisterRequest } from '../types';
import { JwtPayload } from 'jsonwebtoken';
import { sendPasswordResetEmail } from '../lib/mailer';

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password }: LoginRequest = req.body;

    // Buscar usuario
    const user = await prisma.user.findUnique({
      where: { email },
      include: { 
        duenio: true,
        coordinador: {
          include: {
            remiseria: {
              select: {
                id: true,
                nombreFantasia: true
              }
            }
          }
        },
        cliente: true,
        chofer: true
      }
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
          duenio: user.duenio,
          coordinador: user.coordinador,
          cliente: user.cliente,
          chofer: user.chofer
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

export const registerCliente = async (req: Request, res: Response) => {
  try {
    const { email, password, nombre, apellido, dni, telefono, direccion, fechaNacimiento, fotoUrl } = req.body;

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
    const existingCliente = await prisma.cliente.findUnique({
      where: { dni }
    });

    if (existingCliente) {
      return res.status(400).json({
        success: false,
        error: 'El DNI ya está registrado'
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

    // Crear usuario y cliente en una transacción
    const result = await prisma.$transaction(async (tx: any) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          rol: 'CLIENTE'
        }
      });

      const cliente = await tx.cliente.create({
        data: {
          nombre,
          apellido,
          dni,
          telefono,
          email,
          direccion,
          fechaNacimiento: new Date(fechaNacimiento),
          fotoUrl: fotoUrl || null,
          userId: user.id
        }
      });

      return { user, cliente };
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
          cliente: result.cliente
        },
        accessToken,
        refreshToken
      },
      message: 'Cliente registrado exitosamente'
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Error en registro de cliente:', error);
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

    // Soporte para sesión de Demo Fallback
    if (refreshToken === 'demo-refresh-token') {
      return res.json({
        success: true,
        data: {
          accessToken: 'demo-access-token'
        }
      });
    }

    // Verificar refresh token
    const decoded = jwt.verify(refreshToken, jwtRefreshSecret) as { id: string };

    
    // Buscar usuario
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { duenio: true, chofer: true, cliente: true, coordinador: true }
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

// Validar token
export const validateToken = async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: 'Token no proporcionado' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    
    // Buscar el usuario en la base de datos
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: {
        duenio: true,
        coordinador: true,
        cliente: true,
        chofer: true
      }
    });

    if (!user || !user.activo) {
      return res.status(401).json({ 
        success: false, 
        error: 'Usuario no encontrado o inactivo' 
      });
    }

    // Retornar información del usuario sin la contraseña
    const { passwordHash, ...userWithoutPassword } = user;
    
    res.json({
      success: true,
      data: {
        user: userWithoutPassword,
        valid: true
      }
    });
  } catch (error) {
    console.error('Error validando token:', error);
    res.status(401).json({ 
      success: false, 
      error: 'Token inválido' 
    });
  }
}; 

// Solicitar recuperación de contraseña
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: 'El email es requerido' });
    }

    // Buscar usuario (respuesta genérica por seguridad)
    const user = await prisma.user.findUnique({ where: { email } });

    if (user && user.activo) {
      // Generar token seguro
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

      // Guardar token en BD
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetPasswordToken: token,
          resetPasswordExpires: expires,
        },
      });

      // Armar URL del frontend
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

      // Enviar email
      await sendPasswordResetEmail(email, resetUrl);
    }

    // Siempre responder igual (no revelar si el email existe)
    res.json({
      success: true,
      message: 'Si el email existe en nuestro sistema, recibirás un link para restablecer tu contraseña.',
    });
  } catch (error) {
    console.error('Error en forgotPassword:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};

// Restablecer contraseña con token
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ success: false, error: 'Token y contraseña son requeridos' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    // Buscar usuario con token válido y no expirado
    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: { gt: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'El link de recuperación es inválido o ha expirado.',
      });
    }

    // Hashear nueva contraseña y limpiar token
    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });

    res.json({ success: true, message: 'Contraseña restablecida exitosamente. Ya podés iniciar sesión.' });
  } catch (error) {
    console.error('Error en resetPassword:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};
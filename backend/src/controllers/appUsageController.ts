import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../types';

const prisma = new PrismaClient();

export const trackAppUsage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { action, details } = req.body;
    const userId = req.user?.id;
    const userEmail = req.user?.email;

    if (!userId || !userEmail || !action) {
      return res.status(400).json({
        success: false,
        message: 'Faltan datos requeridos'
      });
    }

    const usage = await prisma.appUsage.create({
      data: {
        userId,
        userEmail,
        action,
        details: details ? JSON.stringify(details) : null,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || null
      }
    });

    res.json({
      success: true,
      data: usage
    });
  } catch (error) {
    console.error('Error tracking app usage:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

export const getAppUsageStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Verificar que el usuario sea admin
    if (req.user?.rol !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado'
      });
    }

    const { period = '7d' } = req.query;
    
    let dateFilter: Date;
    const now = new Date();
    
    switch (period) {
      case '24h':
        dateFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Obtener estadísticas de uso
    const totalActions = await prisma.appUsage.count({
      where: {
        createdAt: {
          gte: dateFilter
        }
      }
    });

    // Acciones por tipo
    const actionsByType = await prisma.appUsage.groupBy({
      by: ['action'],
      where: {
        createdAt: {
          gte: dateFilter
        }
      },
      _count: {
        action: true
      }
    });

    // Usuarios activos
    const activeUsers = await prisma.appUsage.groupBy({
      by: ['userEmail'],
      where: {
        createdAt: {
          gte: dateFilter
        }
      },
      _count: {
        userEmail: true
      }
    });

    // Últimas actividades
    const recentActivity = await prisma.appUsage.findMany({
      where: {
        createdAt: {
          gte: dateFilter
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 20,
      select: {
        id: true,
        userEmail: true,
        action: true,
        details: true,
        createdAt: true
      }
    });

    res.json({
      success: true,
      data: {
        period,
        totalActions,
        actionsByType,
        activeUsersCount: activeUsers.length,
        recentActivity
      }
    });
  } catch (error) {
    console.error('Error getting app usage stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
}; 
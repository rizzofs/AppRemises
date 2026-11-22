import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { pushNotificationService } from '../services/pushNotificationService';
import { prisma } from '../lib/prisma';

export const pushController = {
  /**
   * Obtener la clave pública VAPID para que el navegador cree la suscripción
   */
  async getPublicKey(req: AuthenticatedRequest, res: Response) {
    try {
      const publicKey = pushNotificationService.getPublicKey();
      res.json({
        success: true,
        publicKey,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener clave pública VAPID',
        error: error.message,
      });
    }
  },

  /**
   * Guardar o actualizar la suscripción Web Push del usuario o chofer actual
   */
  async subscribe(req: AuthenticatedRequest, res: Response) {
    try {
      const { subscription } = req.body;

      if (!subscription || !subscription.endpoint || !subscription.keys) {
        return res.status(400).json({
          success: false,
          message: 'Formato de suscripción inválido',
        });
      }

      const userId = req.user?.id || null;
      let choferId = req.user?.chofer?.id || null;

      // Si no viene directo en el token pero es usuario chofer, buscarlo por userId
      if (!choferId && userId) {
        const choferEncontrado = await prisma.chofer.findFirst({
          where: { userId },
          select: { id: true },
        });
        if (choferEncontrado) {
          choferId = choferEncontrado.id;
        }
      }

      const userAgent = req.headers['user-agent'] || null;

      await pushNotificationService.guardarSuscripcion({
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        choferId,
        userId,
        userAgent,
      });

      console.log(`📱 Suscripción Push guardada para chofer: ${choferId || 'N/A'}, usuario: ${userId || 'N/A'}`);

      res.json({
        success: true,
        message: 'Suscripción a notificaciones push registrada con éxito',
      });
    } catch (error: any) {
      console.error('Error al guardar suscripción push:', error);
      res.status(500).json({
        success: false,
        message: 'No se pudo guardar la suscripción push',
        error: error.message,
      });
    }
  },

  /**
   * Cancelar suscripción por endpoint
   */
  async unsubscribe(req: AuthenticatedRequest, res: Response) {
    try {
      const { endpoint } = req.body;
      if (!endpoint) {
        return res.status(400).json({ success: false, message: 'Endpoint requerido' });
      }

      await pushNotificationService.eliminarSuscripcion(endpoint);

      res.json({
        success: true,
        message: 'Suscripción eliminada con éxito',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error al eliminar suscripción push',
        error: error.message,
      });
    }
  },

  /**
   * Enviar notificación de prueba al chofer o usuario actual
   */
  async enviarPrueba(req: AuthenticatedRequest, res: Response) {
    try {
      const choferId = req.user?.chofer?.id;
      if (!choferId) {
        return res.status(400).json({
          success: false,
          message: 'Solo disponible para choferes autenticados',
        });
      }

      await pushNotificationService.enviarAChofer(choferId, {
        title: '🚕 Prueba de Notificación - AppRemises',
        body: '¡Excelente! Tu teléfono recibe viajes en segundo plano y con la pantalla bloqueada.',
        url: '/chofer/app',
        tag: 'test-push',
      });

      res.json({
        success: true,
        message: 'Notificación de prueba enviada',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error al enviar prueba push',
        error: error.message,
      });
    }
  },
};

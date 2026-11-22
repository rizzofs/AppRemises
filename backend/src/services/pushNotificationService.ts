import webpush from 'web-push';
import { prisma } from '../lib/prisma';

// Claves VAPID configuradas por entorno con fallback predeterminado generado
export const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  'BP9c8_5Oq9spVO2KRULE9V_j9DIk-jKORod6JRew9Q16wf6x3G8OboadnKri2Tc1yQXCA1SXsDYGREV7UjYspTI';

export const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  'P7wrqbj03LQn2J7JuWbG9_y7Dxz8g8CU3Dq81uF_iYI';

export const VAPID_EMAIL =
  process.env.VAPID_EMAIL ||
  'mailto:notificaciones@rzcore.dev';

// Inicializar configuración de web-push
try {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log('🔔 Servicio Web Push VAPID inicializado correctamente.');
} catch (err) {
  console.error('Error inicializando VAPID en web-push:', err);
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
  data?: Record<string, any>;
  vibrate?: number[];
  requireInteraction?: boolean;
}

export const pushNotificationService = {
  getPublicKey() {
    return VAPID_PUBLIC_KEY;
  },

  /**
   * Registra o actualiza una suscripción Push en la base de datos
   */
  async guardarSuscripcion(params: {
    endpoint: string;
    p256dh: string;
    auth: string;
    choferId?: string | null;
    userId?: string | null;
    userAgent?: string | null;
  }) {
    const { endpoint, p256dh, auth, choferId, userId, userAgent } = params;

    if (!endpoint || !p256dh || !auth) {
      throw new Error('Datos de suscripción incompletos');
    }

    return await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: {
        p256dh,
        auth,
        choferId: choferId || undefined,
        userId: userId || undefined,
        userAgent: userAgent || undefined,
        updatedAt: new Date(),
      },
      create: {
        endpoint,
        p256dh,
        auth,
        choferId: choferId || undefined,
        userId: userId || undefined,
        userAgent: userAgent || undefined,
      },
    });
  },

  /**
   * Elimina una suscripción Push por endpoint (ej. al cerrar sesión)
   */
  async eliminarSuscripcion(endpoint: string) {
    try {
      await prisma.pushSubscription.deleteMany({
        where: { endpoint },
      });
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Envía notificación Push nativa a todas las suscripciones de un chofer
   */
  async enviarAChofer(choferId: string, payload: PushNotificationPayload) {
    if (!choferId) return;

    try {
      const suscripciones = await prisma.pushSubscription.findMany({
        where: { choferId },
      });

      if (!suscripciones || suscripciones.length === 0) return;

      const formattedPayload = JSON.stringify({
        title: payload.title,
        body: payload.body,
        icon: payload.icon || '/pwa-192x192.png',
        badge: payload.badge || '/pwa-192x192.png',
        url: payload.url || '/chofer/app',
        tag: payload.tag || 'alerta-chofer',
        vibrate: payload.vibrate || [300, 150, 300, 150, 400],
        requireInteraction: payload.requireInteraction !== undefined ? payload.requireInteraction : true,
        data: payload.data || {},
      });

      const envios = suscripciones.map(async (sub) => {
        const pushConfig = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        try {
          await webpush.sendNotification(pushConfig, formattedPayload);
        } catch (error: any) {
          // Si el endpoint expiró o fue revocado por el navegador (404 o 410)
          if (error.statusCode === 404 || error.statusCode === 410) {
            await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
          } else {
            console.warn(`Aviso enviando Push a Chofer (${sub.id}):`, error.message);
          }
        }
      });

      await Promise.allSettled(envios);
    } catch (err) {
      console.error(`Error en enviarAChofer (${choferId}):`, err);
    }
  },

  /**
   * Envía notificación Push a todos los choferes conectados/activos de una remisería
   */
  async enviarAChoferesDeRemiseria(remiseriaId: string, payload: PushNotificationPayload, excludeChoferId?: string) {
    try {
      const choferes = await prisma.chofer.findMany({
        where: {
          remiseriaId,
          isOnline: true,
          estado: 'ACTIVO',
          ...(excludeChoferId ? { id: { not: excludeChoferId } } : {}),
        },
        select: { id: true },
      });

      if (!choferes || choferes.length === 0) return;

      const envios = choferes.map((c) => this.enviarAChofer(c.id, payload));
      await Promise.allSettled(envios);
    } catch (err) {
      console.error('Error enviando push a flota de remisería:', err);
    }
  },
};

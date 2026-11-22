import { pushService } from './api';

// Convierte clave pública Base64 a Uint8Array requerido por el navegador
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushNotificationSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'Notification' in window;
}

export function getNotificationPermissionState(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function forceAppCacheRefresh(): Promise<void> {
  try {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.update();
      }
    }
    if (typeof window !== 'undefined' && 'caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch (err) {
    console.warn('Error limpiando caché de la app:', err);
  }
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushNotificationSupported()) return null;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    // Forzar actualización inmediata del Service Worker para no quedar atrapado en caché viejo
    if (registration) {
      registration.update().catch(() => {});
    }
    return registration;
  } catch (error) {
    console.error('Error al registrar Service Worker:', error);
    return null;
  }
}

export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushNotificationSupported()) return null;

  try {
    const registration = await navigator.serviceWorker.ready;
    if (!registration.pushManager) return null;
    return await registration.pushManager.getSubscription();
  } catch (error) {
    console.error('Error al obtener suscripción push actual:', error);
    return null;
  }
}

/**
 * Pide permiso al usuario, crea la suscripción con la clave VAPID y la guarda en el backend
 */
export async function subscribeToPushNotifications(): Promise<{
  success: boolean;
  message?: string;
  subscription?: PushSubscription;
}> {
  if (!isPushNotificationSupported()) {
    return {
      success: false,
      message: 'Las notificaciones push no están soportadas en este navegador.',
    };
  }

  try {
    // 1. Pedir permiso al usuario
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return {
        success: false,
        message: 'Permiso de notificaciones denegado. Habilitalo en los ajustes del navegador.',
      };
    }

    // 2. Registrar Service Worker si no estaba registrado
    let registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      registration = await navigator.serviceWorker.register('/sw.js');
    }
    await navigator.serviceWorker.ready;

    if (!registration.pushManager) {
      return {
        success: false,
        message: 'PushManager no está disponible en este dispositivo.',
      };
    }

    // 3. Obtener la clave pública VAPID desde el backend
    const keyRes = await pushService.getPublicKey();
    const pubKey = keyRes.data?.publicKey || (keyRes as any).publicKey;
    if (!keyRes.success || !pubKey) {
      return {
        success: false,
        message: 'No se pudo obtener la clave VAPID del servidor.',
      };
    }

    const applicationServerKey = urlBase64ToUint8Array(pubKey);

    // 4. Suscribir con el PushManager del navegador
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }

    // 5. Enviar la suscripción al Backend
    const jsonSub = subscription.toJSON();
    const saveRes = await pushService.subscribe(jsonSub);

    if (saveRes.success) {
      return {
        success: true,
        message: '¡Notificaciones en segundo plano activadas correctamente!',
        subscription,
      };
    } else {
      return {
        success: false,
        message: saveRes.message || 'Error al guardar la suscripción en el servidor.',
      };
    }
  } catch (error: any) {
    console.error('Error suscribiendo a notificaciones push:', error);
    return {
      success: false,
      message: error.message || 'Ocurrió un error al activar notificaciones push.',
    };
  }
}

/**
 * Cancela la suscripción push
 */
export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  try {
    const subscription = await getCurrentPushSubscription();
    if (subscription) {
      await pushService.unsubscribe(subscription.endpoint);
      await subscription.unsubscribe();
    }
    return true;
  } catch (error) {
    console.error('Error desuscribiendo notificaciones push:', error);
    return false;
  }
}

// ==============================================================================
// SERVICE WORKER - APP REMISES
// Soporte para Notificaciones Push en segundo plano y pantalla bloqueada
// ==============================================================================

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Evento que se dispara cuando el servidor envía una notificación Push
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || '🚕 App Remises';

    const options = {
      body: data.body || 'Nuevo viaje disponible en tu zona.',
      icon: data.icon || '/pwa-192x192.png',
      badge: data.badge || '/pwa-192x192.png',
      vibrate: data.vibrate || [300, 150, 300, 150, 450],
      tag: data.tag || 'alerta-viaje-remises',
      renotify: true,
      requireInteraction: data.requireInteraction !== undefined ? data.requireInteraction : true,
      data: {
        url: data.url || '/chofer/app',
        ...(data.data || {}),
      },
      actions: [
        {
          action: 'open_trip',
          title: '🚕 Ver Viaje',
        },
      ],
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error('Error mostrando notificación push en SW:', err);
  }
});

// Evento cuando el chofer toca la notificación en su teléfono
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/chofer/app';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si la ventana ya está abierta, traerla al frente y enfocarla
      for (const client of clientList) {
        if (client.url && client.url.includes('/chofer/app') && 'focus' in client) {
          return client.focus();
        }
      }
      // Si está cerrada, abrir la ventana en primer plano
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope;

// Manifest injetado em tempo de build pelo vite-plugin-pwa
precacheAndRoute(self.__WB_MANIFEST || []);
cleanupOutdatedCaches();

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());

// Notificações push: exibir quando o app estiver em segundo plano ou fechado
self.addEventListener('push', (event: PushEvent) => {
  if (!self.Notification || self.Notification.permission !== 'granted') return;
  if (!event.data) return;
  try {
    const data = event.data.json() as { title?: string; body?: string; icon?: string; url?: string };
    event.waitUntil(
      self.registration.showNotification(data.title || 'Gestor Fazenda', {
        body: data.body || '',
        icon: data.icon || '/logo192.png',
        badge: '/logo192.png',
        data: { url: data.url }
      })
    );
  } catch {
    event.waitUntil(
      self.registration.showNotification('Gestor Fazenda', {
        body: event.data?.text() || '',
        icon: '/logo192.png',
        badge: '/logo192.png'
      })
    );
  }
});

// Clique na notificação: abrir a URL ou a raiz do app
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const url = event.notification.data?.url;
  event.waitUntil(self.clients.openWindow(url || '/'));
});

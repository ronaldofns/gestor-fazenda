/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
// 1. Em vez de criar uma interface do zero, vamos ESTENDER a global
// Isso une as propriedades padrão (body, icon) com as do Service Worker (vibrate)
type ExtendedNotificationOptions = NotificationOptions & {
  vibrate?: number[];
  badge?: string;
  data?: Record<string, unknown>;
};

declare let self: ServiceWorkerGlobalScope & {
  readonly Notification: {
    readonly permission: NotificationPermission;
  };
};

// Manifest injetado em tempo de build pelo vite-plugin-pwa
precacheAndRoute(self.__WB_MANIFEST || []);
cleanupOutdatedCaches();

// Não chamar skipWaiting() no install — aguardar o usuário clicar em "Atualizar" no PWAUpdatePrompt
self.addEventListener("install", () => {});

self.addEventListener("message", (event: ExtendableMessageEvent) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", () => self.clients.claim());

// Notificações push: exibir quando o app estiver em segundo plano ou fechado
self.addEventListener("push", (event: PushEvent) => {
  if (!self.Notification || self.Notification.permission !== "granted") return;
  if (!event.data) return;

  try {
    const data = event.data.json();

    // 2. Usamos o nosso tipo estendido aqui
    const options: ExtendedNotificationOptions = {
      body: data.body || "",
      icon: data.icon || "/logo192.png",
      badge: "/logo192.png",
      data: { url: data.url },
      vibrate: [200, 100, 200],
    };

    event.waitUntil(
      self.registration.showNotification(
        data.title || "Gestor Fazenda",
        options,
      ),
    );
  } catch {
    event.waitUntil(
      self.registration.showNotification("Gestor Fazenda", {
        body: event.data.text(),
        icon: "/logo192.png",
      }),
    );
  }
});

// Clique na notificação: abrir a URL ou a raiz do app
self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const url = event.notification.data?.url;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Se já tiver uma aba aberta, foca nela, senão abre uma nova
        for (const client of clientList) {
          if (client.url === (url || "/") && "focus" in client) {
            return (client as WindowClient).focus();
          }
        }
        return self.clients.openWindow(url || "/");
      }),
  );
});

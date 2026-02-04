/**
 * Utilitários para Web Push: inscrever e serializar subscription para o servidor.
 * Requer VITE_VAPID_PUBLIC_KEY no .env (chave pública VAPID em base64url).
 */

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export interface PushSubscriptionPayload {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Obtém a subscription de push para o Service Worker atual.
 * Retorna null se VAPID não estiver configurado, SW não estiver pronto ou subscribe falhar.
 */
export async function subscribePush(): Promise<PushSubscription | null> {
  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!vapidPublicKey || typeof navigator === 'undefined' || !navigator.serviceWorker) {
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(vapidPublicKey)
    });
    return subscription;
  } catch {
    return null;
  }
}

/**
 * Converte um PushSubscription no payload para enviar ao servidor (push_subscriptions).
 */
export function subscriptionToPayload(subscription: PushSubscription): PushSubscriptionPayload {
  const p256dh = subscription.getKey('p256dh');
  const auth = subscription.getKey('auth');
  return {
    endpoint: subscription.endpoint,
    p256dh: p256dh ? arrayBufferToBase64Url(p256dh) : '',
    auth: auth ? arrayBufferToBase64Url(auth) : ''
  };
}

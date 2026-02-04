/**
 * Script de exemplo para enviar notificação push a um usuário.
 * Uso: node supabase/scripts/send-push.js <user_id> "Título" "Corpo da mensagem"
 *
 * Variáveis de ambiente:
 *   VAPID_PUBLIC_KEY   - Chave pública VAPID (base64url)
 *   VAPID_PRIVATE_KEY  - Chave privada VAPID (base64url)
 *   VITE_SUPABASE_URL  - URL do projeto Supabase (ou SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY - Chave service_role do Supabase
 */

import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Defina SUPABASE_URL (ou VITE_SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
  console.error('Defina VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY (gere com: npx web-push generate-vapid-keys)');
  process.exit(1);
}

webpush.setVapidDetails('mailto:admin@gestorfazenda.app', VAPID_PUBLIC, VAPID_PRIVATE);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function sendPushToUser(userId, payload) {
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId);

  if (error) {
    console.error('Erro ao buscar subscriptions:', error.message);
    return;
  }
  if (!subs?.length) {
    console.log('Nenhuma subscription encontrada para o usuário:', userId);
    return;
  }

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
        { TTL: 86400 }
      )
    )
  );
  const ok = results.filter((r) => r.status === 'fulfilled').length;
  const fail = results.filter((r) => r.status === 'rejected').length;
  console.log(`Enviado: ${ok} sucesso, ${fail} falha`);
}

const userId = process.argv[2];
const title = process.argv[3] || 'Gestor Fazenda';
const body = process.argv[4] || 'Nova notificação';

if (!userId) {
  console.log('Uso: node supabase/scripts/send-push.js <user_id> [titulo] [corpo]');
  process.exit(1);
}

sendPushToUser(userId, { title, body, icon: '/icon-192.png' }).catch((e) => {
  console.error(e);
  process.exit(1);
});

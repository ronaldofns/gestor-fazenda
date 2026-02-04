# Notificações Push – Servidor

O app já solicita permissão de notificações no navegador (Configurações > App PWA). Para enviar notificações push do servidor, é necessário registrar o **Service Worker** e a **subscription** (endpoint) no backend e enviar mensagens via Web Push.

## Visão geral

1. **Cliente (já implementado):**
   - Usuário concede permissão em Configurações > App (PWA) > "Permitir notificações no navegador".
   - O PWA pode registrar um Service Worker e criar uma **Push Subscription** (VAPID).

2. **Servidor (a implementar):**
   - Armazenar as subscriptions por usuário/dispositivo.
   - Ao ocorrer um evento (ex.: alerta de desmama, nova notificação), enviar um payload Web Push para cada subscription.

## Opções de implementação

### A) Supabase + Edge Function

- Criar uma Edge Function que recebe o evento e chama a API Web Push (usando biblioteca como `web-push` em Node).
- Armazenar em tabela `push_subscriptions` (user_id, endpoint, keys, created_at).
- O cliente envia a subscription após `registration.pushManager.subscribe()` e salva no Supabase.

### B) Backend próprio (Node/Express etc.)

- Endpoint POST para salvar subscription (body: `{ endpoint, keys: { p256dh, auth } }`).
- Job ou webhook que, ao gerar alerta, envia POST para cada endpoint usando [web-push](https://www.npmjs.com/package/web-push) com VAPID keys.

## Onde pegar as chaves VAPID

As chaves **não vêm de um site** – você as **gera no seu computador**, uma vez, com a ferramenta `web-push` (já está no projeto como devDependency).

**1. No terminal, na pasta do projeto:**

```bash
npx web-push generate-vapid-keys
```

**2. A saída será algo assim:**

```
Public Key: BNx7k3...
Private Key: abc123...
```

**3. Use no `.env`:**

- **Chave pública** → no **cliente** (Vite expõe variáveis que começam com `VITE_`):
  - `VITE_VAPID_PUBLIC_KEY=BNx7k3...` (a mesma que apareceu como Public Key)

- **Chave pública e privada** → no **servidor** (script `send-push.js` ou outro backend):
  - `VAPID_PUBLIC_KEY=BNx7k3...` (mesma Public Key)
  - `VAPID_PRIVATE_KEY=abc123...` (a Private Key que apareceu)

**Resumo:** a **mesma** chave pública vai no app (como `VITE_VAPID_PUBLIC_KEY`) e no servidor (como `VAPID_PUBLIC_KEY`). A chave privada **só** no servidor, nunca no frontend.

## Payload exemplo (Web Push)

O Service Worker do PWA recebe o push e exibe a notificação. Exemplo de payload:

```json
{
  "title": "Alerta de desmama",
  "body": "Animal 1234 passou do prazo de desmama.",
  "icon": "/logo192.png",
  "url": "/animais"
}
```

- `title`, `body`, `icon` (opcional): exibidos na notificação.
- `url` (opcional): ao clicar na notificação, o app abre essa URL (ex.: `/animais`). Se omitido, abre a raiz `/`.

## Tabela no Supabase

Foi criada a migration `048_push_subscriptions.sql` com a tabela `push_subscriptions`:

- `user_id` (text) – ID do usuário no sistema
- `endpoint` (text) – URL do endpoint Web Push
- `p256dh` (text) – Chave pública do cliente
- `auth` (text) – Secret de autenticação
- `created_at` (timestamptz)

O cliente deve inserir uma linha ao obter a subscription (após `pushManager.subscribe()`).

## Exemplo de envio no servidor (Node.js + web-push)

Instale: `npm install web-push`

Gere as chaves VAPID uma vez: `npx web-push generate-vapid-keys`

```js
// send-push.js (exemplo – rodar com Node ou em cron)
const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

webpush.setVapidDetails(
  'mailto:admin@seudominio.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function sendPushToUser(userId, payload) {
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId);

  const send = (sub) =>
    webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth }
      },
      JSON.stringify(payload),
      { TTL: 86400 }
    );

  await Promise.allSettled((subs || []).map(send));
}

// Exemplo: enviar alerta de desmama
sendPushToUser('uuid-do-usuario', {
  title: 'Alerta de desmama',
  body: 'Animal 1234 passou do prazo de desmama.',
  icon: '/icon-192.png'
}).catch(console.error);
```

Use variáveis de ambiente para `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`. A chave pública (VAPID_PUBLIC_KEY) deve ser a mesma usada no cliente em `pushManager.subscribe({ applicationServerKey: vapidPublicKey })`.

## Cliente (implementado)

1. **Configurações > App (PWA):** ao clicar em "Pedir permissão agora" e o usuário conceder, o app chama `subscribePush()` (usa `VITE_VAPID_PUBLIC_KEY`), serializa a subscription e faz upsert em `push_subscriptions` no Supabase (com `user_id` do usuário logado).
2. Configure no `.env`: `VITE_VAPID_PUBLIC_KEY=<chave pública base64url>` (a mesma usada no servidor).
3. O Service Worker customizado (`src/sw.ts`) trata o evento `push` e chama `registration.showNotification()`, exibindo a notificação quando o app estiver em segundo plano ou fechado. O clique na notificação abre a URL em `data.url` ou a raiz do app.

## Envio no servidor (script)

Foi adicionado o script `supabase/scripts/send-push.js`:

```bash
# Variáveis de ambiente: SUPABASE_URL (ou VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
node supabase/scripts/send-push.js <user_id> "Título" "Corpo da mensagem"
# ou
npm run push:send -- <user_id> "Alerta de desmama" "Animal 1234 passou do prazo."
```

Para gerar as chaves VAPID, veja a seção **"Onde pegar as chaves VAPID"** acima.

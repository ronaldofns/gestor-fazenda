-- Tabela para armazenar subscriptions de Web Push por usuário/dispositivo
-- Usada para enviar notificações push quando o app está fechado
-- user_id = UUID do usuário no sistema (usuarios_online.uuid ou equivalente)

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Política permissiva: o app usa a chave anon/service e controla user_id no cliente
CREATE POLICY "Allow all for push_subscriptions"
  ON push_subscriptions FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE push_subscriptions IS 'Web Push subscriptions por usuário para notificações (VAPID).';

-- Adiciona coluna preco_venda_kg em confinamentos_online (usada no app para cálculo de resultado).
-- Enquanto esta coluna não existir no Supabase, o app não envia precoVendaKg no payload (syncEvents.ts)
-- para evitar erro. Após aplicar esta migration, pode-se remover 'precoVendaKg' do Set de exclusão
-- em payloadToServerConfinamento para passar a sincronizar o campo.
ALTER TABLE public.confinamentos_online
  ADD COLUMN IF NOT EXISTS preco_venda_kg NUMERIC(10, 4) CHECK (preco_venda_kg IS NULL OR preco_venda_kg >= 0);

COMMENT ON COLUMN public.confinamentos_online.preco_venda_kg IS 'Preço de venda por kg (R$) para cálculo de resultado do confinamento';

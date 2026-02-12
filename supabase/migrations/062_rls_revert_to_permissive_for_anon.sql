-- Reverte as políticas RLS para permissivas (USING true / WITH CHECK true).
-- Necessário quando o projeto Supabase não aceita JWT custom (ex.: migrou para JWT Signing Keys).
-- O app continua com login local e sync usando chave anon; os avisos do linter voltam a aparecer.

-- alert_settings_online
DROP POLICY IF EXISTS _insert_public ON public.alert_settings_online;
DROP POLICY IF EXISTS _update_public ON public.alert_settings_online;
DROP POLICY IF EXISTS _delete_public ON public.alert_settings_online;
CREATE POLICY _insert_public ON public.alert_settings_online FOR INSERT WITH CHECK (true);
CREATE POLICY _update_public ON public.alert_settings_online FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY _delete_public ON public.alert_settings_online FOR DELETE USING (true);

-- animais_online
DROP POLICY IF EXISTS animais_insert_public ON public.animais_online;
DROP POLICY IF EXISTS animais_update_public ON public.animais_online;
CREATE POLICY animais_insert_public ON public.animais_online FOR INSERT WITH CHECK (true);
CREATE POLICY animais_update_public ON public.animais_online FOR UPDATE USING (true) WITH CHECK (true);

-- app_settings_online
DROP POLICY IF EXISTS _insert_public ON public.app_settings_online;
DROP POLICY IF EXISTS _update_public ON public.app_settings_online;
DROP POLICY IF EXISTS _delete_public ON public.app_settings_online;
CREATE POLICY _insert_public ON public.app_settings_online FOR INSERT WITH CHECK (true);
CREATE POLICY _update_public ON public.app_settings_online FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY _delete_public ON public.app_settings_online FOR DELETE USING (true);

-- audits_online
DROP POLICY IF EXISTS audits_online_insert_public ON public.audits_online;
CREATE POLICY audits_online_insert_public ON public.audits_online FOR INSERT WITH CHECK (true);

-- categorias_online
DROP POLICY IF EXISTS categorias_online_insert_public ON public.categorias_online;
DROP POLICY IF EXISTS categorias_online_update_public ON public.categorias_online;
DROP POLICY IF EXISTS categorias_online_delete_public ON public.categorias_online;
CREATE POLICY categorias_online_insert_public ON public.categorias_online FOR INSERT WITH CHECK (true);
CREATE POLICY categorias_online_update_public ON public.categorias_online FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY categorias_online_delete_public ON public.categorias_online FOR DELETE USING (true);

-- confinamento_alimentacao_online
DROP POLICY IF EXISTS confinamento_alimentacao_online_insert_public ON public.confinamento_alimentacao_online;
DROP POLICY IF EXISTS confinamento_alimentacao_online_update_public ON public.confinamento_alimentacao_online;
DROP POLICY IF EXISTS confinamento_alimentacao_online_delete_public ON public.confinamento_alimentacao_online;
CREATE POLICY confinamento_alimentacao_online_insert_public ON public.confinamento_alimentacao_online FOR INSERT WITH CHECK (true);
CREATE POLICY confinamento_alimentacao_online_update_public ON public.confinamento_alimentacao_online FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY confinamento_alimentacao_online_delete_public ON public.confinamento_alimentacao_online FOR DELETE USING (true);

-- confinamento_animais_online
DROP POLICY IF EXISTS confinamento_animais_online_insert_public ON public.confinamento_animais_online;
DROP POLICY IF EXISTS confinamento_animais_online_update_public ON public.confinamento_animais_online;
DROP POLICY IF EXISTS confinamento_animais_online_delete_public ON public.confinamento_animais_online;
CREATE POLICY confinamento_animais_online_insert_public ON public.confinamento_animais_online FOR INSERT WITH CHECK (true);
CREATE POLICY confinamento_animais_online_update_public ON public.confinamento_animais_online FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY confinamento_animais_online_delete_public ON public.confinamento_animais_online FOR DELETE USING (true);

-- confinamento_pesagens_online
DROP POLICY IF EXISTS confinamento_pesagens_online_insert_public ON public.confinamento_pesagens_online;
DROP POLICY IF EXISTS confinamento_pesagens_online_update_public ON public.confinamento_pesagens_online;
DROP POLICY IF EXISTS confinamento_pesagens_online_delete_public ON public.confinamento_pesagens_online;
CREATE POLICY confinamento_pesagens_online_insert_public ON public.confinamento_pesagens_online FOR INSERT WITH CHECK (true);
CREATE POLICY confinamento_pesagens_online_update_public ON public.confinamento_pesagens_online FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY confinamento_pesagens_online_delete_public ON public.confinamento_pesagens_online FOR DELETE USING (true);

-- confinamentos_online
DROP POLICY IF EXISTS confinamentos_online_insert_public ON public.confinamentos_online;
DROP POLICY IF EXISTS confinamentos_online_update_public ON public.confinamentos_online;
DROP POLICY IF EXISTS confinamentos_online_delete_public ON public.confinamentos_online;
CREATE POLICY confinamentos_online_insert_public ON public.confinamentos_online FOR INSERT WITH CHECK (true);
CREATE POLICY confinamentos_online_update_public ON public.confinamentos_online FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY confinamentos_online_delete_public ON public.confinamentos_online FOR DELETE USING (true);

-- desmamas_online
DROP POLICY IF EXISTS desmamas_online_insert_public ON public.desmamas_online;
DROP POLICY IF EXISTS desmamas_online_update_public ON public.desmamas_online;
DROP POLICY IF EXISTS desmamas_online_delete_public ON public.desmamas_online;
CREATE POLICY desmamas_online_insert_public ON public.desmamas_online FOR INSERT WITH CHECK (true);
CREATE POLICY desmamas_online_update_public ON public.desmamas_online FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY desmamas_online_delete_public ON public.desmamas_online FOR DELETE USING (true);

-- fazendas_online
DROP POLICY IF EXISTS fazendas_online_insert_public ON public.fazendas_online;
DROP POLICY IF EXISTS fazendas_online_update_public ON public.fazendas_online;
DROP POLICY IF EXISTS fazendas_online_delete_public ON public.fazendas_online;
CREATE POLICY fazendas_online_insert_public ON public.fazendas_online FOR INSERT WITH CHECK (true);
CREATE POLICY fazendas_online_update_public ON public.fazendas_online FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY fazendas_online_delete_public ON public.fazendas_online FOR DELETE USING (true);

-- genealogias_online
DROP POLICY IF EXISTS genealogias_insert_public ON public.genealogias_online;
DROP POLICY IF EXISTS genealogias_update_public ON public.genealogias_online;
CREATE POLICY genealogias_insert_public ON public.genealogias_online FOR INSERT WITH CHECK (true);
CREATE POLICY genealogias_update_public ON public.genealogias_online FOR UPDATE USING (true) WITH CHECK (true);

-- matrizes_online
DROP POLICY IF EXISTS matrizes_online_insert_public ON public.matrizes_online;
DROP POLICY IF EXISTS matrizes_online_update_public ON public.matrizes_online;
DROP POLICY IF EXISTS matrizes_online_delete_public ON public.matrizes_online;
CREATE POLICY matrizes_online_insert_public ON public.matrizes_online FOR INSERT WITH CHECK (true);
CREATE POLICY matrizes_online_update_public ON public.matrizes_online FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY matrizes_online_delete_public ON public.matrizes_online FOR DELETE USING (true);

-- notificacoes_lidas_online
DROP POLICY IF EXISTS notificacoes_lidas_online_insert_public ON public.notificacoes_lidas_online;
DROP POLICY IF EXISTS notificacoes_lidas_online_update_public ON public.notificacoes_lidas_online;
DROP POLICY IF EXISTS notificacoes_lidas_online_delete_public ON public.notificacoes_lidas_online;
CREATE POLICY notificacoes_lidas_online_insert_public ON public.notificacoes_lidas_online FOR INSERT WITH CHECK (true);
CREATE POLICY notificacoes_lidas_online_update_public ON public.notificacoes_lidas_online FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY notificacoes_lidas_online_delete_public ON public.notificacoes_lidas_online FOR DELETE USING (true);

-- ocorrencia_animais_online
DROP POLICY IF EXISTS ocorrencia_animais_online_insert_public ON public.ocorrencia_animais_online;
DROP POLICY IF EXISTS ocorrencia_animais_online_update_public ON public.ocorrencia_animais_online;
DROP POLICY IF EXISTS ocorrencia_animais_online_delete_public ON public.ocorrencia_animais_online;
CREATE POLICY ocorrencia_animais_online_insert_public ON public.ocorrencia_animais_online FOR INSERT WITH CHECK (true);
CREATE POLICY ocorrencia_animais_online_update_public ON public.ocorrencia_animais_online FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY ocorrencia_animais_online_delete_public ON public.ocorrencia_animais_online FOR DELETE USING (true);

-- origens_online
DROP POLICY IF EXISTS origens_insert_public ON public.origens_online;
DROP POLICY IF EXISTS origens_update_public ON public.origens_online;
CREATE POLICY origens_insert_public ON public.origens_online FOR INSERT WITH CHECK (true);
CREATE POLICY origens_update_public ON public.origens_online FOR UPDATE USING (true) WITH CHECK (true);

-- pesagens_online
DROP POLICY IF EXISTS pesagens_online_insert_public ON public.pesagens_online;
DROP POLICY IF EXISTS pesagens_online_update_public ON public.pesagens_online;
DROP POLICY IF EXISTS pesagens_online_delete_public ON public.pesagens_online;
CREATE POLICY pesagens_online_insert_public ON public.pesagens_online FOR INSERT WITH CHECK (true);
CREATE POLICY pesagens_online_update_public ON public.pesagens_online FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY pesagens_online_delete_public ON public.pesagens_online FOR DELETE USING (true);

-- push_subscriptions
DROP POLICY IF EXISTS "Allow all for push_subscriptions" ON public.push_subscriptions;
CREATE POLICY "Allow all for push_subscriptions" ON public.push_subscriptions FOR ALL USING (true) WITH CHECK (true);

-- racas_online
DROP POLICY IF EXISTS racas_online_insert_public ON public.racas_online;
DROP POLICY IF EXISTS racas_online_update_public ON public.racas_online;
DROP POLICY IF EXISTS racas_online_delete_public ON public.racas_online;
CREATE POLICY racas_online_insert_public ON public.racas_online FOR INSERT WITH CHECK (true);
CREATE POLICY racas_online_update_public ON public.racas_online FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY racas_online_delete_public ON public.racas_online FOR DELETE USING (true);

-- role_permissions_online
DROP POLICY IF EXISTS _insert_public ON public.role_permissions_online;
DROP POLICY IF EXISTS _update_public ON public.role_permissions_online;
DROP POLICY IF EXISTS _delete_public ON public.role_permissions_online;
CREATE POLICY _insert_public ON public.role_permissions_online FOR INSERT WITH CHECK (true);
CREATE POLICY _update_public ON public.role_permissions_online FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY _delete_public ON public.role_permissions_online FOR DELETE USING (true);

-- status_animal_online
DROP POLICY IF EXISTS status_animal_insert_public ON public.status_animal_online;
DROP POLICY IF EXISTS status_animal_update_public ON public.status_animal_online;
CREATE POLICY status_animal_insert_public ON public.status_animal_online FOR INSERT WITH CHECK (true);
CREATE POLICY status_animal_update_public ON public.status_animal_online FOR UPDATE USING (true) WITH CHECK (true);

-- tag_assignments
DROP POLICY IF EXISTS tag_assignments_insert_public ON public.tag_assignments;
DROP POLICY IF EXISTS tag_assignments_update_public ON public.tag_assignments;
CREATE POLICY tag_assignments_insert_public ON public.tag_assignments FOR INSERT WITH CHECK (true);
CREATE POLICY tag_assignments_update_public ON public.tag_assignments FOR UPDATE USING (true) WITH CHECK (true);

-- tags
DROP POLICY IF EXISTS tags_insert_public ON public.tags;
DROP POLICY IF EXISTS tags_update_public ON public.tags;
CREATE POLICY tags_insert_public ON public.tags FOR INSERT WITH CHECK (true);
CREATE POLICY tags_update_public ON public.tags FOR UPDATE USING (true) WITH CHECK (true);

-- tipos_animal_online
DROP POLICY IF EXISTS tipos_animal_insert_public ON public.tipos_animal_online;
DROP POLICY IF EXISTS tipos_animal_update_public ON public.tipos_animal_online;
CREATE POLICY tipos_animal_insert_public ON public.tipos_animal_online FOR INSERT WITH CHECK (true);
CREATE POLICY tipos_animal_update_public ON public.tipos_animal_online FOR UPDATE USING (true) WITH CHECK (true);

-- usuarios_online
DROP POLICY IF EXISTS usuarios_online_insert_public ON public.usuarios_online;
DROP POLICY IF EXISTS usuarios_online_update_public ON public.usuarios_online;
DROP POLICY IF EXISTS usuarios_online_delete_public ON public.usuarios_online;
CREATE POLICY usuarios_online_insert_public ON public.usuarios_online FOR INSERT WITH CHECK (true);
CREATE POLICY usuarios_online_update_public ON public.usuarios_online FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY usuarios_online_delete_public ON public.usuarios_online FOR DELETE USING (true);

-- vacinacoes_online
DROP POLICY IF EXISTS vacinacoes_online_insert_public ON public.vacinacoes_online;
DROP POLICY IF EXISTS vacinacoes_online_update_public ON public.vacinacoes_online;
DROP POLICY IF EXISTS vacinacoes_online_delete_public ON public.vacinacoes_online;
CREATE POLICY vacinacoes_online_insert_public ON public.vacinacoes_online FOR INSERT WITH CHECK (true);
CREATE POLICY vacinacoes_online_update_public ON public.vacinacoes_online FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY vacinacoes_online_delete_public ON public.vacinacoes_online FOR DELETE USING (true);

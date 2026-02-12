-- Performance: (select auth.uid()) evita reavaliação por linha (auth_rls_initplan).
-- Remove índices duplicados (duplicate_index).
-- Ref: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

-- alert_settings_online
DROP POLICY IF EXISTS _insert_public ON public.alert_settings_online;
DROP POLICY IF EXISTS _update_public ON public.alert_settings_online;
DROP POLICY IF EXISTS _delete_public ON public.alert_settings_online;
CREATE POLICY _insert_public ON public.alert_settings_online FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY _update_public ON public.alert_settings_online FOR UPDATE USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY _delete_public ON public.alert_settings_online FOR DELETE USING ((select auth.uid()) IS NOT NULL);

-- animais_online
DROP POLICY IF EXISTS animais_insert_public ON public.animais_online;
DROP POLICY IF EXISTS animais_update_public ON public.animais_online;
CREATE POLICY animais_insert_public ON public.animais_online FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY animais_update_public ON public.animais_online FOR UPDATE USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);

-- app_settings_online
DROP POLICY IF EXISTS _insert_public ON public.app_settings_online;
DROP POLICY IF EXISTS _update_public ON public.app_settings_online;
DROP POLICY IF EXISTS _delete_public ON public.app_settings_online;
CREATE POLICY _insert_public ON public.app_settings_online FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY _update_public ON public.app_settings_online FOR UPDATE USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY _delete_public ON public.app_settings_online FOR DELETE USING ((select auth.uid()) IS NOT NULL);

-- audits_online
DROP POLICY IF EXISTS audits_online_insert_public ON public.audits_online;
CREATE POLICY audits_online_insert_public ON public.audits_online FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

-- categorias_online
DROP POLICY IF EXISTS categorias_online_insert_public ON public.categorias_online;
DROP POLICY IF EXISTS categorias_online_update_public ON public.categorias_online;
DROP POLICY IF EXISTS categorias_online_delete_public ON public.categorias_online;
CREATE POLICY categorias_online_insert_public ON public.categorias_online FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY categorias_online_update_public ON public.categorias_online FOR UPDATE USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY categorias_online_delete_public ON public.categorias_online FOR DELETE USING ((select auth.uid()) IS NOT NULL);

-- confinamento_alimentacao_online
DROP POLICY IF EXISTS confinamento_alimentacao_online_insert_public ON public.confinamento_alimentacao_online;
DROP POLICY IF EXISTS confinamento_alimentacao_online_update_public ON public.confinamento_alimentacao_online;
DROP POLICY IF EXISTS confinamento_alimentacao_online_delete_public ON public.confinamento_alimentacao_online;
CREATE POLICY confinamento_alimentacao_online_insert_public ON public.confinamento_alimentacao_online FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY confinamento_alimentacao_online_update_public ON public.confinamento_alimentacao_online FOR UPDATE USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY confinamento_alimentacao_online_delete_public ON public.confinamento_alimentacao_online FOR DELETE USING ((select auth.uid()) IS NOT NULL);

-- confinamento_animais_online
DROP POLICY IF EXISTS confinamento_animais_online_insert_public ON public.confinamento_animais_online;
DROP POLICY IF EXISTS confinamento_animais_online_update_public ON public.confinamento_animais_online;
DROP POLICY IF EXISTS confinamento_animais_online_delete_public ON public.confinamento_animais_online;
CREATE POLICY confinamento_animais_online_insert_public ON public.confinamento_animais_online FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY confinamento_animais_online_update_public ON public.confinamento_animais_online FOR UPDATE USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY confinamento_animais_online_delete_public ON public.confinamento_animais_online FOR DELETE USING ((select auth.uid()) IS NOT NULL);

-- confinamento_pesagens_online
DROP POLICY IF EXISTS confinamento_pesagens_online_insert_public ON public.confinamento_pesagens_online;
DROP POLICY IF EXISTS confinamento_pesagens_online_update_public ON public.confinamento_pesagens_online;
DROP POLICY IF EXISTS confinamento_pesagens_online_delete_public ON public.confinamento_pesagens_online;
CREATE POLICY confinamento_pesagens_online_insert_public ON public.confinamento_pesagens_online FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY confinamento_pesagens_online_update_public ON public.confinamento_pesagens_online FOR UPDATE USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY confinamento_pesagens_online_delete_public ON public.confinamento_pesagens_online FOR DELETE USING ((select auth.uid()) IS NOT NULL);

-- confinamentos_online
DROP POLICY IF EXISTS confinamentos_online_insert_public ON public.confinamentos_online;
DROP POLICY IF EXISTS confinamentos_online_update_public ON public.confinamentos_online;
DROP POLICY IF EXISTS confinamentos_online_delete_public ON public.confinamentos_online;
CREATE POLICY confinamentos_online_insert_public ON public.confinamentos_online FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY confinamentos_online_update_public ON public.confinamentos_online FOR UPDATE USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY confinamentos_online_delete_public ON public.confinamentos_online FOR DELETE USING ((select auth.uid()) IS NOT NULL);

-- desmamas_online
DROP POLICY IF EXISTS desmamas_online_insert_public ON public.desmamas_online;
DROP POLICY IF EXISTS desmamas_online_update_public ON public.desmamas_online;
DROP POLICY IF EXISTS desmamas_online_delete_public ON public.desmamas_online;
CREATE POLICY desmamas_online_insert_public ON public.desmamas_online FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY desmamas_online_update_public ON public.desmamas_online FOR UPDATE USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY desmamas_online_delete_public ON public.desmamas_online FOR DELETE USING ((select auth.uid()) IS NOT NULL);

-- fazendas_online
DROP POLICY IF EXISTS fazendas_online_insert_public ON public.fazendas_online;
DROP POLICY IF EXISTS fazendas_online_update_public ON public.fazendas_online;
DROP POLICY IF EXISTS fazendas_online_delete_public ON public.fazendas_online;
CREATE POLICY fazendas_online_insert_public ON public.fazendas_online FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY fazendas_online_update_public ON public.fazendas_online FOR UPDATE USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY fazendas_online_delete_public ON public.fazendas_online FOR DELETE USING ((select auth.uid()) IS NOT NULL);

-- genealogias_online
DROP POLICY IF EXISTS genealogias_insert_public ON public.genealogias_online;
DROP POLICY IF EXISTS genealogias_update_public ON public.genealogias_online;
CREATE POLICY genealogias_insert_public ON public.genealogias_online FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY genealogias_update_public ON public.genealogias_online FOR UPDATE USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);

-- matrizes_online
DROP POLICY IF EXISTS matrizes_online_insert_public ON public.matrizes_online;
DROP POLICY IF EXISTS matrizes_online_update_public ON public.matrizes_online;
DROP POLICY IF EXISTS matrizes_online_delete_public ON public.matrizes_online;
CREATE POLICY matrizes_online_insert_public ON public.matrizes_online FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY matrizes_online_update_public ON public.matrizes_online FOR UPDATE USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY matrizes_online_delete_public ON public.matrizes_online FOR DELETE USING ((select auth.uid()) IS NOT NULL);

-- notificacoes_lidas_online
DROP POLICY IF EXISTS notificacoes_lidas_online_insert_public ON public.notificacoes_lidas_online;
DROP POLICY IF EXISTS notificacoes_lidas_online_update_public ON public.notificacoes_lidas_online;
DROP POLICY IF EXISTS notificacoes_lidas_online_delete_public ON public.notificacoes_lidas_online;
CREATE POLICY notificacoes_lidas_online_insert_public ON public.notificacoes_lidas_online FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY notificacoes_lidas_online_update_public ON public.notificacoes_lidas_online FOR UPDATE USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY notificacoes_lidas_online_delete_public ON public.notificacoes_lidas_online FOR DELETE USING ((select auth.uid()) IS NOT NULL);

-- ocorrencia_animais_online
DROP POLICY IF EXISTS ocorrencia_animais_online_insert_public ON public.ocorrencia_animais_online;
DROP POLICY IF EXISTS ocorrencia_animais_online_update_public ON public.ocorrencia_animais_online;
DROP POLICY IF EXISTS ocorrencia_animais_online_delete_public ON public.ocorrencia_animais_online;
CREATE POLICY ocorrencia_animais_online_insert_public ON public.ocorrencia_animais_online FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY ocorrencia_animais_online_update_public ON public.ocorrencia_animais_online FOR UPDATE USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY ocorrencia_animais_online_delete_public ON public.ocorrencia_animais_online FOR DELETE USING ((select auth.uid()) IS NOT NULL);

-- origens_online
DROP POLICY IF EXISTS origens_insert_public ON public.origens_online;
DROP POLICY IF EXISTS origens_update_public ON public.origens_online;
CREATE POLICY origens_insert_public ON public.origens_online FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY origens_update_public ON public.origens_online FOR UPDATE USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);

-- pesagens_online
DROP POLICY IF EXISTS pesagens_online_insert_public ON public.pesagens_online;
DROP POLICY IF EXISTS pesagens_online_update_public ON public.pesagens_online;
DROP POLICY IF EXISTS pesagens_online_delete_public ON public.pesagens_online;
CREATE POLICY pesagens_online_insert_public ON public.pesagens_online FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY pesagens_online_update_public ON public.pesagens_online FOR UPDATE USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY pesagens_online_delete_public ON public.pesagens_online FOR DELETE USING ((select auth.uid()) IS NOT NULL);

-- push_subscriptions
DROP POLICY IF EXISTS "Allow all for push_subscriptions" ON public.push_subscriptions;
CREATE POLICY "Allow all for push_subscriptions" ON public.push_subscriptions FOR ALL USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);

-- racas_online
DROP POLICY IF EXISTS racas_online_insert_public ON public.racas_online;
DROP POLICY IF EXISTS racas_online_update_public ON public.racas_online;
DROP POLICY IF EXISTS racas_online_delete_public ON public.racas_online;
CREATE POLICY racas_online_insert_public ON public.racas_online FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY racas_online_update_public ON public.racas_online FOR UPDATE USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY racas_online_delete_public ON public.racas_online FOR DELETE USING ((select auth.uid()) IS NOT NULL);

-- role_permissions_online
DROP POLICY IF EXISTS _insert_public ON public.role_permissions_online;
DROP POLICY IF EXISTS _update_public ON public.role_permissions_online;
DROP POLICY IF EXISTS _delete_public ON public.role_permissions_online;
CREATE POLICY _insert_public ON public.role_permissions_online FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY _update_public ON public.role_permissions_online FOR UPDATE USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY _delete_public ON public.role_permissions_online FOR DELETE USING ((select auth.uid()) IS NOT NULL);

-- status_animal_online
DROP POLICY IF EXISTS status_animal_insert_public ON public.status_animal_online;
DROP POLICY IF EXISTS status_animal_update_public ON public.status_animal_online;
CREATE POLICY status_animal_insert_public ON public.status_animal_online FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY status_animal_update_public ON public.status_animal_online FOR UPDATE USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);

-- tag_assignments
DROP POLICY IF EXISTS tag_assignments_insert_public ON public.tag_assignments;
DROP POLICY IF EXISTS tag_assignments_update_public ON public.tag_assignments;
CREATE POLICY tag_assignments_insert_public ON public.tag_assignments FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY tag_assignments_update_public ON public.tag_assignments FOR UPDATE USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);

-- tags
DROP POLICY IF EXISTS tags_insert_public ON public.tags;
DROP POLICY IF EXISTS tags_update_public ON public.tags;
CREATE POLICY tags_insert_public ON public.tags FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY tags_update_public ON public.tags FOR UPDATE USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);

-- tipos_animal_online
DROP POLICY IF EXISTS tipos_animal_insert_public ON public.tipos_animal_online;
DROP POLICY IF EXISTS tipos_animal_update_public ON public.tipos_animal_online;
CREATE POLICY tipos_animal_insert_public ON public.tipos_animal_online FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY tipos_animal_update_public ON public.tipos_animal_online FOR UPDATE USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);

-- usuarios_online
DROP POLICY IF EXISTS usuarios_online_insert_public ON public.usuarios_online;
DROP POLICY IF EXISTS usuarios_online_update_public ON public.usuarios_online;
DROP POLICY IF EXISTS usuarios_online_delete_public ON public.usuarios_online;
CREATE POLICY usuarios_online_insert_public ON public.usuarios_online FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY usuarios_online_update_public ON public.usuarios_online FOR UPDATE USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY usuarios_online_delete_public ON public.usuarios_online FOR DELETE USING ((select auth.uid()) IS NOT NULL);

-- vacinacoes_online
DROP POLICY IF EXISTS vacinacoes_online_insert_public ON public.vacinacoes_online;
DROP POLICY IF EXISTS vacinacoes_online_update_public ON public.vacinacoes_online;
DROP POLICY IF EXISTS vacinacoes_online_delete_public ON public.vacinacoes_online;
CREATE POLICY vacinacoes_online_insert_public ON public.vacinacoes_online FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY vacinacoes_online_update_public ON public.vacinacoes_online FOR UPDATE USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY vacinacoes_online_delete_public ON public.vacinacoes_online FOR DELETE USING ((select auth.uid()) IS NOT NULL);

-- user_app_settings (políticas com user_id = auth.uid())
DROP POLICY IF EXISTS "users_select_own_settings" ON public.user_app_settings;
DROP POLICY IF EXISTS "users_insert_own_settings" ON public.user_app_settings;
DROP POLICY IF EXISTS "users_update_own_settings" ON public.user_app_settings;
DROP POLICY IF EXISTS "users_delete_own_settings" ON public.user_app_settings;
CREATE POLICY "users_select_own_settings" ON public.user_app_settings FOR SELECT USING (user_id = (select auth.uid()));
CREATE POLICY "users_insert_own_settings" ON public.user_app_settings FOR INSERT WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "users_update_own_settings" ON public.user_app_settings FOR UPDATE USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "users_delete_own_settings" ON public.user_app_settings FOR DELETE USING (user_id = (select auth.uid()));

-- Índices duplicados: manter _key (constraint), remover idx_ redundantes
DROP INDEX IF EXISTS public.idx_alert_settings_online_uuid;
DROP INDEX IF EXISTS public.idx_app_settings_online_uuid;

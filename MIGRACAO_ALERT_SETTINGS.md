# Migração: Configurações de Alerta

## ⚠️ IMPORTANTE: Execute a Migration no Supabase

Para que as configurações de alerta sejam sincronizadas entre dispositivos, você **DEVE** executar a migration no Supabase.

### Como executar:

1. Acesse o **Dashboard do Supabase**: https://app.supabase.com
2. Selecione seu projeto
3. Vá em **SQL Editor** (no menu lateral)
4. Clique em **New Query**
5. Copie e cole o conteúdo do arquivo: `supabase/migrations/019_add_alert_settings_online.sql`
6. Clique em **Run** (ou pressione Ctrl+Enter)

### Verificar se foi executada:

Após executar, você pode verificar se a tabela foi criada:

```sql
SELECT * FROM alert_settings_online;
```

Se retornar vazio (sem erros), a tabela foi criada com sucesso!

### O que a migration faz:

- Cria a tabela `alert_settings_online` no Supabase
- Configura políticas RLS (Row Level Security) para permitir acesso público
- Cria trigger para atualizar `updated_at` automaticamente
- Adiciona validações (checks) para os valores

### Após executar a migration:

1. Salve as configurações em um dispositivo
2. Aguarde a sincronização automática (ou clique em "Sincronizar")
3. Em outro dispositivo, faça sincronização
4. As configurações devem aparecer automaticamente

## Troubleshooting

### Se não sincronizar:

1. **Verifique se a migration foi executada:**
   - Execute: `SELECT * FROM alert_settings_online;` no SQL Editor
   - Se der erro "does not exist", a migration não foi executada

2. **Verifique os logs do console:**
   - Abra o DevTools (F12)
   - Vá na aba Console
   - Procure por mensagens sobre "alert_settings_online" ou "configurações de alerta"

3. **Force uma sincronização:**
   - Clique no botão "Sincronizar" na sidebar
   - Verifique se aparece algum erro

4. **Verifique se há dados no Supabase:**
   - Execute: `SELECT * FROM alert_settings_online;`
   - Se houver dados, a sincronização está funcionando
   - Se estiver vazio, o push pode não estar funcionando


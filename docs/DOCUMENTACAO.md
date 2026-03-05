# Documentação — Gestor Fazenda

Documentação técnica e de uso do sistema de gestão de rebanho (PWA offline-first com sincronização Supabase).

---

## 1. Visão geral

- **PWA**: funciona offline, instalável, sincronização automática quando online.
- **Stack**: React 19, TypeScript, Vite, Tailwind, Dexie (IndexedDB), Supabase.
- **Multi-usuário**: roles (admin, gerente, peão, visitante) e permissões granulares.
- **Funcionalidades**: fazendas, animais, matrizes, desmama, pesagem, vacinação, dashboard, relatórios, alertas, backup, tags, confinamento.

---

## 2. Instalação e variáveis de ambiente

```bash
npm install
npm run dev
```

**Variáveis (`.env`):**

| Variável | Uso |
|----------|-----|
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Chave anônima do Supabase |
| `VITE_VAPID_PUBLIC_KEY` | Chave pública VAPID (notificações push no cliente) |
| `VITE_APP_VERSION` | Versão exibida no app (opcional) |

Para **notificações push no servidor** (script ou cron): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Gere as chaves com: `npx web-push generate-vapid-keys`.

---

## 3. Estrutura do projeto

- **`src/api/`** — Cliente Supabase e serviço de sincronização.
- **`src/components/`** — Componentes React (modais, formulários, TopBar, Sidebar, etc.).
- **`src/db/`** — Dexie (IndexedDB), modelos e migrações locais.
- **`src/hooks/`** — Hooks (auth, permissões, alertas, métricas, sync, etc.).
- **`src/routes/`** — Páginas (Dashboard, Animais, Fazendas, Configurações, etc.).
- **`src/utils/`** — Utilitários (export, backup, tema, validação, etc.).
- **`supabase/`** — Migrações SQL, Edge Functions, scripts.

---

## 4. Funcionalidades e permissões

| Área | Onde | Permissões principais |
|------|------|------------------------|
| **Fazendas** | Menu Fazendas | `ver_fazendas`, `gerenciar_fazendas` |
| **Animais** | Menu Animais | `ver_planilha`, `cadastrar_animal`, `editar_animal`, `excluir_animal` |
| **Desmama / Pesagem / Vacina** | Modal do animal | `cadastrar_*`, `editar_*`, `excluir_*` |
| **Dashboard** | Menu Dashboard | `ver_dashboard` |
| **Relatórios** | Menu Relatórios | `gerar_relatorios` |
| **Notificações** | Menu Notificações | `ver_notificacoes` |
| **Usuários** | Menu Usuários | `ver_usuarios`, `gerenciar_usuarios` |
| **Permissões** | Menu Permissões | admin |
| **Sincronização** | Menu Sincronização | `ver_sincronizacao` |
| **Exportação** | Dashboard, Relatórios, Backup | `exportar_dados` |

Cadastros auxiliares: Configurações → Raças e Categorias; tipos/status/origens em modais no fluxo do animal.

---

## 5. Sincronização (IndexedDB ↔ Supabase)

- **Tabelas sincronizadas**: fazendas, racas, categorias, animais, desmamas, pesagens, vacinações, usuarios, matrizes, audits, notificacoesLidas, alertSettings, appSettings, rolePermissions, tags, tagAssignments, confinamentos, confinamentoAnimais, confinamentoAlimentacao, ocorrenciaAnimais, genealogias, etc.
- **Fluxo**: push de pendências locais; pull de atualizações do Supabase. Intervalo configurável em Configurações.
- **Offline**: dados salvos no IndexedDB; envio automático quando a conexão voltar. Tela de Sincronização mostra fila e status.

---

## 6. Notificações push

- **Cliente**: Configurações → App (PWA) → permitir notificações. O app regista a subscription e grava em `push_subscriptions` (Supabase).
- **Servidor**: use o script incluído para enviar push a um usuário:

```bash
# Variáveis: SUPABASE_URL (ou VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
npm run push:send -- <user_id> "Título" "Corpo da mensagem"
# ou
node supabase/scripts/send-push.js <user_id> "Título" "Corpo"
```

Payload suportado: `title`, `body`, `icon`, `url` (aberto ao clicar na notificação). Chaves VAPID: `npx web-push generate-vapid-keys`; mesma chave pública no cliente (`VITE_VAPID_PUBLIC_KEY`) e no servidor (`VAPID_PUBLIC_KEY`).

---

## 7. Deploy (Vercel)

- Deploy automático a partir da branch `main`. Build: Vite; output: `dist`.
- Variáveis de ambiente: configurar na Vercel (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, etc.).
- Limpar cache: Vercel Dashboard → Project → Settings → General → Clear Build Cache (ou redeploy).

---

## 8. Atalhos de teclado

| Atalho | Ação |
|--------|------|
| `Ctrl + D` | Dashboard |
| `Ctrl + H` | Planilha (Animais) |
| `Ctrl + M` | Matrizes |
| `Ctrl + N` | Notificações |
| `Ctrl + F` | Fazendas |
| `Ctrl + U` | Usuários |
| `Ctrl + B` | Expandir/recolher sidebar |
| `Ctrl + K` | Alternar tema claro/escuro |
| `Ctrl + S` | Sincronizar |
| `Ctrl + ,` | Configurações |
| `ESC` | Fechar modais |
| `?` | Ajuda (lista de atalhos) |

Atalhos desativados ao digitar em inputs/textarea/select.

---

## 9. Backup automático

- Configurações → Backup: ativar backup automático e definir intervalo (ex.: 24 h). Histórico limitado (ex.: 10 itens).
- Backup completo inclui todas as tabelas locais (fazendas, animais, desmamas, pesagens, vacinações, tags, confinamentos, etc.). Formato JSON (versão 3.0).
- Exportar/Importar backup manual: menu do usuário (TopBar) ou Sincronização. Importação mescla dados (não substitui).

---

## 10. Tags

- Configurações → Tags: criar, editar e excluir tags. Atribuir a animais e fazendas; filtrar e buscar por tags na tela Animais.

---

## 11. Scripts e manutenção

| Item | Uso |
|------|-----|
| **`supabase/scripts/send-push.js`** | Enviar notificação push a um usuário (cron ou manual). Ver secção 6. |
| **`supabase/scripts/update_empty_brincos.sql`** | Script SQL para preencher brincos vazios em `animais_online` (executar no SQL Editor do Supabase após revisar as consultas de verificação). |
| **Edge Function `get-supabase-token`** | Ver `supabase/functions/get-supabase-token/README.md` para deploy e uso. |

---

## 12. Changelog e referências

- **Changelog**: [`docs/CHANGELOG.md`](./CHANGELOG.md)
- **Scripts npm**: `npm run dev`, `npm run build`, `npm run lint`, `npm run test:run`, `npm run check`, `npm run push:send`, etc. (ver `package.json`).

# Gestor Fazenda

Sistema de gestão para fazendas de gado, desenvolvido como PWA (Progressive Web App) com sincronização offline/online.

## 🚀 Características Principais

### 📱 PWA (Progressive Web App)
- ✅ Funciona **100% offline**
- ✅ Pode ser instalado como app no celular/tablet
- ✅ Sincronização automática quando online
- ✅ Service Worker para cache inteligente (precache + runtime cache)
- ✅ **Notificações push** no navegador (inscrição + exibição em segundo plano; ver `docs/DOCUMENTACAO.md` § Notificações push)

### 🔄 Sincronização Offline-First
- ✅ Sincronização bidirecional IndexedDB ↔ Supabase
- ✅ Múltiplas tabelas sincronizadas (fazendas, animais, desmamas, pesagens, vacinações, confinamentos, usuários, tags, etc.)
- ✅ Intervalo configurável (padrão 30 s)
- ✅ Tela dedicada de **Sincronização** (fila de pendências, envio manual)
- ✅ Indicador de status online/offline e toast "Conexão restaurada"
- ✅ Tratamento robusto de erros e conflitos

### 👥 Sistema Multi-usuário
- ✅ 4 roles: Admin, Gerente, Peão, Visitante
- ✅ Permissões granulares por role (ver_*, cadastrar_*, editar_*, excluir_*, gerar_relatorios, exportar_dados, etc.)
- ✅ Gerenciamento de usuários e permissões (telas Usuários e Permissões)
- ✅ Proteção de rotas por permissão
- ✅ Sincronização de permissões entre dispositivos

### 🎨 Personalização
- ✅ Tema dinâmico com 7 cores (verde, azul, esmeralda, teal, índigo, roxo, cinza)
- ✅ Modo escuro/claro
- ✅ **Modo Curral / Escritório** (toggle na barra; UI simplificada e fonte maior no curral)
- ✅ Configurações persistentes
- ✅ Timeout de inatividade configurável

### 🐄 Gestão de Rebanho
- ✅ **Fazendas**: Múltiplas fazendas, histórico, tags
- ✅ **Animais**: Cadastro completo (brinco, tipo, status, origem, genealogia, datas, valor compra/venda). Listagem com filtros e virtualização para listas grandes. Data de nascimento e origem (ex.: nascido na fazenda) na ficha do animal
- ✅ **Matrizes**: Integradas ao cadastro de animais e à genealogia (mãe/pai)
- ✅ **Desmamas**: Peso e data de desmama (por animal)
- ✅ **Pesagens**: Data e peso por animal (com opção de **balança** Web Bluetooth em Configurações)
- ✅ **Vacinações**: Vacina, data de aplicação e vencimento por animal
- ✅ **Confinamentos**: Lotes/ciclos de confinamento, entrada/saída de animais, peso entrada/saída, alimentação e custos; tela de lista e detalhe por confinamento
- ✅ **Pendências do Curral**: Tela dedicada (bezerros sem desmama, vacinas vencidas, etc.)
- ✅ **Raças e Categorias**: Gestão em Configurações → Raças e Categorias (e cadastro rápido de raça no modal do animal)
- ✅ **Tipos / Status / Origens**: Editáveis (Bezerro, Vaca, Ativo, Vendido, Nascido na Fazenda, etc.)
- ✅ **Histórico**: Histórico de alterações por entidade (fazenda, animal)

### 📊 Dashboard e Relatórios
- ✅ **Dashboard**: Métricas em tempo real por fazenda, evolução do rebanho, distribuição por tipo/status, alertas, exportação PDF/Excel
- ✅ **Relatórios** (tela dedicada): Gráficos de evolução, tipos, por fazenda; filtros por período; exportação PDF/Excel
- ✅ Taxa de desmama, mortalidade, nascimentos por período
- ✅ Estatísticas por fazenda

### 🔔 Notificações e Alertas
- ✅ Bezerros sem desmama após X meses (configurável)
- ✅ Mortalidade alta por fazenda (configurável)
- ✅ Peso crítico, vacinas vencidas, matriz improdutiva
- ✅ Sistema de notificações lidas
- ✅ Configurações de alertas sincronizadas
- ✅ Banner de alertas no Dashboard

### 📄 Exportação e Backup
- ✅ **Exportação Excel/CSV**: Lista de animais (com filtros aplicados)
- ✅ **Dashboard e Relatórios**: Exportação PDF e Excel
- ✅ **Backup automático** agendado com histórico (Configurações → Backup)
- ✅ Restauração a partir de backup local

### 🔍 Busca e Filtros
- ✅ Busca por brinco, nome, tipo, status, raça, fazenda, tags
- ✅ Filtros combinados: fazenda, tipo, status, sexo, raça, mês/ano de nascimento, tags (modo qualquer/todos)
- ✅ Ordenação e colunas visíveis configuráveis
- ✅ Paginação configurável
- ✅ Filtros avançados com salvamento e reutilização

### 🔐 Auditoria e Segurança
- ✅ Auditoria completa: registro de todas as alterações
- ✅ Histórico de alterações por entidade (fazenda, animal)
- ✅ Restauração de versões anteriores (onde aplicável)
- ✅ Lock de registro (evitar edição simultânea)
- ✅ Snapshot antes/depois das alterações

### ⚡ Performance e UX
- ✅ **Atalhos de teclado globais** (Ctrl+D, Ctrl+H, Ctrl+B, etc.; ver `docs/DOCUMENTACAO.md` § Atalhos)
- ✅ **Lazy loading** de rotas e modais pesados (AnimalModal, Histórico, Árvore Genealógica)
- ✅ **Virtualização** da lista de animais (react-window) para listas grandes
- ✅ **Sistema de tags** customizáveis (fazendas, animais)
- ✅ **i18n** preparado (estrutura pt-BR e hook `t()`; Login já traduzido)
- ✅ **Testes** com Vitest (usePermissions, useAuth, Login, Modal, utils)
- ✅ Paginação otimizada
- ✅ Loading/Empty/Error states padronizados
- ✅ Feedback visual (toasts)
- ✅ Responsivo (mobile, tablet, desktop)

## ✅ Scripts de verificação e manutenção

Use estes comandos para manter o projeto seguro e atualizado:

| Comando | Descrição |
|--------|-----------|
| `npm run audit` | Verifica vulnerabilidades nas dependências (recomendado antes de cada deploy). |
| `npm run outdated` | Lista pacotes desatualizados (versão instalada vs. última dentro do range do `package.json`). |
| `npm run deps:check` | Mostra quais dependências têm versões mais novas (usa `npm-check-updates`). |
| `npm run deps:update` | Atualiza os ranges no `package.json` para a última versão; depois rode `npm install`. |
| `npm run lint` | Roda o ESLint em `src/` (TypeScript + React). |
| `npm run lint:fix` | Corrige automaticamente o que o ESLint conseguir (formatação, alguns erros). |
| `npm run check` | Roda **audit** + **lint** + **testes** (verificação completa). |
| `npm run check:fast` | Roda só **audit** + **testes** (útil em CI ou quando o lint ainda tem avisos). |

**Sugestão de fluxo para manter dependências atualizadas:**

1. `npm run deps:check` — ver o que pode ser atualizado.
2. `npm run deps:update` — atualizar as versões no `package.json`.
3. `npm install` — instalar as novas versões.
4. `npm run audit` — conferir se não surgiram vulnerabilidades.
5. `npm run test:run` e `npm run build` — garantir que tudo continua funcionando.

## 🛠️ Stack Tecnológica

- **Frontend**: React 19 + TypeScript + Vite
- **Estilização**: Tailwind CSS
- **Banco Local**: Dexie.js (IndexedDB)
- **Backend**: Supabase (PostgreSQL)
- **Roteamento**: React Router v7
- **Formulários**: React Hook Form + Zod
- **Gráficos**: Recharts
- **PDF**: jsPDF + jsPDF-AutoTable
- **Planilhas**: ExcelJS
- **PWA**: vite-plugin-pwa (Workbox injectManifest; Service Worker com push)
- **Testes**: Vitest + Testing Library

## 📦 Instalação

```bash
npm install
npm run dev
```

Variáveis de ambiente (`.env`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Para notificações push: `VITE_VAPID_PUBLIC_KEY` (e no servidor `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`). Ver `docs/DOCUMENTACAO.md`.

## 📋 Funcionalidades – Referência

O sistema está **completo** para gestão de fazendas (cadastros, operações por animal, relatórios, usuários, alertas, sincronização, configurações). Lista detalhada de funcionalidades e permissões em **[`docs/DOCUMENTACAO.md`](./docs/DOCUMENTACAO.md)**.


## 📚 Documentação

Toda a documentação técnica e de uso está em **[`docs/DOCUMENTACAO.md`](./docs/DOCUMENTACAO.md)** (instalação, funcionalidades, sincronização, notificações push, deploy, atalhos, backup, tags, scripts). Histórico de versões: [`docs/CHANGELOG.md`](./docs/CHANGELOG.md).

## 📄 Licença

Este projeto é privado.

# Gestor Fazenda

Sistema de gestão para fazendas de gado, desenvolvido como PWA (Progressive Web App) com sincronização offline/online.

## 🚀 Características Principais

### 📱 PWA (Progressive Web App)
- ✅ Funciona **100% offline**
- ✅ Pode ser instalado como app no celular/tablet
- ✅ Sincronização automática quando online
- ✅ Service Worker para cache inteligente (precache + runtime cache)
- ✅ **Notificações push** no navegador (inscrição + exibição em segundo plano; ver `docs/NOTIFICACOES_PUSH_SERVIDOR.md`)

### 🔄 Sincronização Offline-First
- ✅ Sincronização bidirecional IndexedDB ↔ Supabase
- ✅ Múltiplas tabelas sincronizadas (fazendas, animais, matrizes, nascimentos, desmamas, pesagens, vacinações, usuários, etc.)
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
- ✅ Configurações persistentes
- ✅ Timeout de inatividade configurável

### 🐄 Gestão de Rebanho
- ✅ **Fazendas**: Múltiplas fazendas, histórico, tags
- ✅ **Animais**: Cadastro completo (brinco, tipo, status, origem, genealogia, datas, valor compra/venda). Listagem com filtros e virtualização para listas grandes
- ✅ **Matrizes**: Integradas ao cadastro de animais e à genealogia (mãe/pai)
- ✅ **Nascimentos**: Registro histórico; animais nascidos na fazenda via origem/tipo
- ✅ **Desmamas**: Peso e data de desmama (por animal)
- ✅ **Pesagens**: Data e peso por animal (com opção de **balança** Web Bluetooth em Configurações)
- ✅ **Vacinações**: Vacina, data de aplicação e vencimento por animal
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

### ⚡ Performance e UX (v0.3.0)
- ✅ **Atalhos de teclado globais** (Ctrl+D, Ctrl+H, Ctrl+B, etc.; ver `docs/KEYBOARD_SHORTCUTS.md`)
- ✅ **Lazy loading** de rotas e modais pesados (AnimalModal, Histórico, Árvore Genealógica)
- ✅ **Virtualização** da lista de animais (react-window) para 100+ itens
- ✅ **Filtros avançados** com salvamento e reutilização
- ✅ **Backup automático agendado** com histórico
- ✅ **Sistema de tags** customizáveis (fazendas, animais)
- ✅ **i18n** preparado (estrutura pt-BR e hook `t()`; Login já traduzido)
- ✅ **Testes** com Vitest (usePermissions, useAuth, Login, Modal, utils)
- ✅ Paginação otimizada
- ✅ Loading/Empty/Error states padronizados
- ✅ Feedback visual (toasts)
- ✅ Responsivo (mobile, tablet, desktop)

## 🛠️ Stack Tecnológica

- **Frontend**: React 19 + TypeScript + Vite
- **Estilização**: Tailwind CSS
- **Banco Local**: Dexie.js (IndexedDB)
- **Backend**: Supabase (PostgreSQL)
- **Roteamento**: React Router v7
- **Formulários**: React Hook Form + Zod
- **Gráficos**: Recharts
- **PDF**: jsPDF + jsPDF-AutoTable
- **Planilhas**: XLSX
- **PWA**: vite-plugin-pwa (Workbox injectManifest; Service Worker com push)
- **Testes**: Vitest + Testing Library

## 📦 Instalação

```bash
npm install
npm run dev
```

Variáveis de ambiente (`.env`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Para notificações push: `VITE_VAPID_PUBLIC_KEY` (e no servidor `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`). Ver `docs/NOTIFICACOES_PUSH_SERVIDOR.md`.

## 📋 Funcionalidades – Referência

O sistema está **completo** para gestão de fazendas (cadastros, operações por animal, relatórios, usuários, alertas, sincronização, configurações). Para a lista detalhada de funcionalidades e permissões, consulte **[`docs/FUNCIONALIDADES_GESTAO_FAZENDAS.md`](./docs/FUNCIONALIDADES_GESTAO_FAZENDAS.md)**.

O documento [`docs/ROADMAP_FUNCIONALIDADES.md`](./docs/ROADMAP_FUNCIONALIDADES.md) contém o histórico do roadmap já implementado.

## 📚 Documentação

- **Funcionalidades**: [`docs/FUNCIONALIDADES_GESTAO_FAZENDAS.md`](./docs/FUNCIONALIDADES_GESTAO_FAZENDAS.md)
- **Documentação técnica**: pasta [`docs/`](./docs/) (estrutura, sincronização, tags, atalhos, backup, notificações push, etc.)

## 📄 Licença

Este projeto é privado.

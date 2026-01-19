# Gestor Fazenda

Sistema de gestão para fazendas de gado, desenvolvido como PWA (Progressive Web App) com sincronização offline/online.

## 🚀 Características Principais

### 📱 PWA (Progressive Web App)
- ✅ Funciona **100% offline**
- ✅ Pode ser instalado como app no celular/tablet
- ✅ Sincronização automática quando online
- ✅ Service Worker para cache inteligente

### 🔄 Sincronização Offline-First
- ✅ Sincronização bidirecional IndexedDB ↔ Supabase
- ✅ 13 tabelas sincronizadas automaticamente
- ✅ Sincronização automática a cada 30 segundos
- ✅ Botão de sincronização manual
- ✅ Indicador de status online/offline
- ✅ Tratamento robusto de erros e conflitos

### 👥 Sistema Multi-usuário
- ✅ 4 roles: Admin, Gerente, Peão, Visitante
- ✅ 16 permissões granulares por role
- ✅ Gerenciamento de usuários e permissões
- ✅ Proteção de rotas por permissão
- ✅ Sincronização de permissões entre dispositivos

### 🎨 Personalização
- ✅ Tema dinâmico com 7 cores (verde, azul, esmeralda, teal, índigo, roxo, cinza)
- ✅ Modo escuro/claro
- ✅ Configurações persistentes
- ✅ Timeout de inatividade configurável

### 🐄 Gestão de Rebanho
- ✅ **Fazendas**: Múltiplas fazendas
- ✅ **Matrizes**: Cadastro completo com identificador, categoria, raça, linhagem (pai/mãe)
- ✅ **Nascimentos**: Cadastro completo com brinco, sexo, raça, data, observações
- ✅ **Desmamas**: Peso e data de desmama
- ✅ **Raças e Categorias**: Gestão de catálogos
- ✅ **Histórico**: Histórico completo de partos por matriz

### 📊 Dashboard e Indicadores
- ✅ Dashboard com métricas em tempo real
- ✅ Taxa de desmama (%)
- ✅ Taxa de mortalidade
- ✅ Peso médio por raça
- ✅ Nascimentos por mês/ano
- ✅ Gráficos de evolução (nascimentos, distribuição por sexo)
- ✅ Estatísticas por fazenda

### 🔔 Notificações e Alertas
- ✅ Bezerros sem desmama após X meses (configurável)
- ✅ Mortalidade alta por fazenda (configurável)
- ✅ Dados incompletos (matriz sem cadastro)
- ✅ Sistema de notificações lidas
- ✅ Configurações de alertas sincronizadas

### 📄 Relatórios e Exportação
- ✅ **Relatórios PDF**:
  - Relatório de Nascimento/Desmama
  - Relatório de Produtividade por Fazenda
  - Relatório de Mortalidade por Raça
  - Relatório de Desmama com Médias de Peso
- ✅ **Exportação Excel/CSV**: Planilhas completas com múltiplas abas
- ✅ **Backup JSON**: Exportação completa de todos os dados locais

### 🔍 Busca e Filtros
- ✅ Busca global (matriz, brinco, raça, fazenda, observações)
- ✅ Filtros combinados:
  - Por fazenda
  - Por mês e ano
  - Por matriz/brinco
  - Por sexo (Macho/Fêmea/Todos)
  - Por status (Vivos/Mortos/Todos)
- ✅ Histórico de buscas recentes
- ✅ Paginação configurável

### 📋 Importação
- ✅ Importação de planilhas Excel/CSV
- ✅ Detecção automática de colunas
- ✅ Mapeamento manual de colunas
- ✅ Preview antes de importar
- ✅ Validação de dados
- ✅ Criação automática de matrizes

### 🔐 Auditoria e Segurança
- ✅ **Auditoria completa**: Registro de todas as alterações
- ✅ Histórico de alterações por entidade
- ✅ Restauração de versões anteriores
- ✅ Quem fez, o quê, quando
- ✅ Snapshot antes/depois das alterações

### ⚡ Performance e UX (v0.3.0)
- ✅ **Atalhos de teclado globais** (Ctrl+D, Ctrl+H, Ctrl+B, etc)
- ✅ **Animações suaves** com framer-motion
- ✅ **Lazy loading** de rotas para carregamento mais rápido
- ✅ **React.memo** em componentes críticos
- ✅ **Índices compostos** no IndexedDB (70% mais rápido)
- ✅ **Filtros Avançados** com salvamento e reutilização
- ✅ **Backup Automático Agendado** com histórico
- ✅ **Sistema de Tags** customizáveis
- ✅ **Métricas Avançadas** no Dashboard (GMD, crescimento, projeções)
- ✅ Favoritos (fazendas e matrizes)
- ✅ Paginação otimizada
- ✅ Loading/Empty/Error states padronizados
- ✅ Feedback visual (toasts com alto contraste)
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

## 📦 Instalação

```bash
npm install
npm run dev
```

## 🗺️ Roadmap

Para ver o roadmap completo de funcionalidades e o que está planejado, consulte [`docs/ROADMAP_FUNCIONALIDADES.md`](./docs/ROADMAP_FUNCIONALIDADES.md).

### Próximas Funcionalidades Prioritárias

**Sprint 1 - Robustez:**
- Centro de Sincronização (tela dedicada)
- Fila de Eventos Offline
- Lock de Registro

**Sprint 2 - Funcionalidades do Produtor:**
- Linha do Tempo do Animal (timeline visual)
- Pesagens Periódicas
- Vacinação / Sanidade

## 📚 Documentação

Para documentação técnica detalhada, consulte a pasta [`docs/`](./docs/README.md).

## 📄 Licença

Este projeto é privado.

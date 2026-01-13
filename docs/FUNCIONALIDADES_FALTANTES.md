# 📋 Funcionalidades Faltantes para Implementar

Lista das funcionalidades sugeridas que ainda **NÃO** estão implementadas.

## 🔥 PRIORIDADE 1 — Robustez

### 1️⃣ Centro de Sincronização (Tela Dedicada)
**Status**: ⚠️ **PARCIAL** - Falta tela completa

**O que temos:**
- ✅ Status Online/Offline (componente `SyncStatus`)
- ✅ Botão "Sincronizar agora" (no TopBar e Sidebar)

**O que falta:**
- ❌ Tela dedicada `/sincronizacao` com:
  - Status: Online / Offline
  - Último sync bem-sucedido (timestamp)
  - Quantidade de pendências locais (contador por tabela)
  - Botão "Sincronizar agora"
  - Erros do último sync (log detalhado)
  - Histórico de sincronizações
  - Lista de registros pendentes por tabela

**Arquivos a criar:**
- `src/routes/Sincronizacao.tsx`

### 2️⃣ Fila de Eventos Offline
**Status**: ❌ **NÃO IMPLEMENTADO**

**O que falta:**
- ❌ Tabela `sync_events` no IndexedDB (Dexie)
- ❌ Campos:
  - `id` (UUID)
  - `tipo` (INSERT, UPDATE, DELETE)
  - `entidade` (nascimento, desmama, matriz, etc.)
  - `entityId` (UUID da entidade)
  - `payload` (JSON com dados)
  - `tentativas` (número)
  - `erro` (mensagem de erro)
  - `synced` (boolean)
  - `createdAt`, `updatedAt`
- ❌ Lógica para criar eventos ao invés de apenas `synced: false`
- ❌ Processamento da fila com retry
- ❌ Interface para visualizar fila

**Arquivos a criar/modificar:**
- Adicionar tabela em `src/db/dexieDB.ts`
- Adicionar interface em `src/db/models.ts`
- Modificar `src/api/syncService.ts` para usar fila
- Criar `src/routes/Sincronizacao.tsx` (ou adicionar na tela de sincronização)

### 3️⃣ Lock de Registro
**Status**: ❌ **NÃO IMPLEMENTADO**

**O que falta:**
- ❌ Campos nos modelos:
  - `locked_by` (userId)
  - `locked_at` (timestamp)
  - TTL de 10 minutos
- ❌ Lógica para verificar lock antes de editar
- ❌ Aviso quando outro usuário está editando
- ❌ Liberação automática após TTL
- ❌ Liberação manual ao salvar/cancelar

**Arquivos a modificar:**
- `src/db/models.ts` (adicionar campos)
- `src/db/dexieDB.ts` (migration)
- Modais de edição (verificar lock antes de abrir)
- `supabase/migrations/` (adicionar campos nas tabelas online)

---

## 🐄 PRIORIDADE 2 — Funcionalidades que o produtor realmente usa

### 4️⃣ Linha do Tempo do Animal (Timeline Visual)
**Status**: ⚠️ **PARCIAL** - Falta timeline visual completa

**O que temos:**
- ✅ Histórico de partos por matriz (em `Home.tsx`)
- ✅ Mostra nascimento, desmama, peso

**O que falta:**
- ❌ Timeline visual completa com:
  - Pesagens periódicas (quando implementar)
  - Vacinações (quando implementar)
  - Observações/eventos
  - Visualização em linha do tempo (componente visual)
  - Filtros por tipo de evento

**Arquivos a criar/modificar:**
- Criar componente `src/components/TimelineAnimal.tsx`
- Modificar `src/routes/Home.tsx` para usar timeline

### 5️⃣ Pesagens Periódicas
**Status**: ❌ **NÃO IMPLEMENTADO**

**O que falta:**
- ❌ Tabela `pesagens` no IndexedDB e Supabase
- ❌ Campos:
  - `id` (UUID)
  - `nascimentoId` (referência)
  - `peso` (number)
  - `data` (date)
  - `observacao` (text)
  - `createdAt`, `updatedAt`
  - `synced`, `remoteId`
- ❌ Cálculo de ganho médio diário (GMD)
- ❌ Alertas para animais fora do padrão
- ❌ Interface para cadastrar pesagens
- ❌ Gráfico de evolução de peso

**Arquivos a criar:**
- Adicionar em `src/db/models.ts` (interface `Pesagem`)
- Adicionar em `src/db/dexieDB.ts` (tabela)
- Criar `src/routes/Pesagens.tsx` ou modal
- Adicionar sincronização em `src/api/syncService.ts`
- Migration no Supabase

### 6️⃣ Vacinação / Sanidade
**Status**: ❌ **NÃO IMPLEMENTADO**

**O que falta:**
- ❌ Tabela `vacinacoes` no IndexedDB e Supabase
- ❌ Campos:
  - `id` (UUID)
  - `nascimentoId` ou `matrizId` (referência)
  - `vacina` (text)
  - `data` (date)
  - `lote` (text)
  - `responsavel` (text)
  - `proximaDose` (date, opcional)
  - `observacao` (text)
  - `createdAt`, `updatedAt`
  - `synced`, `remoteId`
- ❌ Alertas de vacinas vencidas
- ❌ Histórico de sanidade
- ❌ Interface para cadastrar vacinações
- ❌ Calendário de vacinações

**Arquivos a criar:**
- Adicionar em `src/db/models.ts` (interface `Vacinacao`)
- Adicionar em `src/db/dexieDB.ts` (tabela)
- Criar `src/routes/Vacinacoes.tsx` ou modal
- Adicionar sincronização em `src/api/syncService.ts`
- Migration no Supabase

---

## 📊 PRIORIDADE 3 — Inteligência (valor alto)

### 7️⃣ Indicadores Avançados
**Status**: ⚠️ **PARCIAL** - Falta alguns indicadores

**O que temos:**
- ✅ Taxa de desmama (%)
- ✅ Taxa de mortalidade
- ✅ Peso médio por raça
- ✅ Nascimentos por mês/ano

**O que falta:**
- ❌ Ganho médio diário (GMD) por lote
- ❌ Intervalo parto–parto (por matriz)
- ❌ Taxa de natalidade por matriz
- ❌ Comparativos ano a ano

**Arquivos a modificar:**
- `src/routes/Dashboard.tsx` (adicionar cálculos)
- Criar utilitário `src/utils/indicadores.ts`

### 8️⃣ Alertas Adicionais
**Status**: ⚠️ **PARCIAL** - Falta alguns tipos

**O que temos:**
- ✅ Bezerro sem desmama após X dias
- ✅ Mortalidade alta por fazenda
- ✅ Dados incompletos

**O que falta:**
- ❌ Peso abaixo da média (quando implementar pesagens)
- ❌ Animal sem movimentação há X dias
- ❌ Vacina vencida (quando implementar vacinação)

**Arquivos a modificar:**
- `src/hooks/useNotifications.ts` (adicionar novos tipos)

---

## 🧱 PRIORIDADE 5 — Produto sério

### 1️⃣1️⃣ Importar Backup
**Status**: ❌ **NÃO IMPLEMENTADO**

**O que temos:**
- ✅ Exportar backup para JSON

**O que falta:**
- ❌ Importar backup (restaurar dados)
- ❌ Validação de formato
- ❌ Merge ou substituição de dados
- ❌ Confirmação antes de importar

**Arquivos a criar:**
- Função em `src/utils/exportarDados.ts` - `importarBackup()`
- Interface em `src/routes/ImportarPlanilha.tsx` ou nova rota

### 1️⃣2️⃣ Multi-fazenda (Troca Rápida)
**Status**: ⚠️ **PARCIAL** - Falta troca rápida

**O que temos:**
- ✅ Usuário pode ter `fazendaId` (opcional)
- ✅ Sistema suporta múltiplas fazendas
- ✅ Filtro por fazenda

**O que falta:**
- ❌ Seleção de fazenda ativa no topo
- ❌ Troca rápida de fazenda (dropdown)
- ❌ Filtro automático por fazenda do usuário
- ❌ Persistência da fazenda selecionada

**Arquivos a modificar:**
- `src/components/TopBar.tsx` (adicionar seletor)
- `src/hooks/useAppSettings.ts` (adicionar fazendaAtiva)
- Modificar filtros para usar fazenda ativa

---

## 🚀 PRIORIDADE 6 — Crescimento futuro

### 1️⃣3️⃣ Integração com Balança
**Status**: ❌ **NÃO IMPLEMENTADO**

**O que falta:**
- ❌ Integração Bluetooth
- ❌ Entrada manual assistida
- ❌ Leitura automática de peso
- ❌ Seleção de animal antes de pesar

**Nota**: Implementar quando houver necessidade real.

### 1️⃣4️⃣ Relatórios PDF
**Status**: ✅ **IMPLEMENTADO**

Já temos 4 tipos de relatórios PDF implementados.

---

## 📊 Resumo por Prioridade

### 🔥 PRIORIDADE 1 — Robustez
- ⚠️ Centro de Sincronização (tela dedicada)
- ❌ Fila de Eventos Offline
- ❌ Lock de Registro

### 🐄 PRIORIDADE 2 — Funcionalidades do Produtor
- ⚠️ Linha do Tempo do Animal (timeline visual)
- ❌ Pesagens Periódicas
- ❌ Vacinação / Sanidade

### 📊 PRIORIDADE 3 — Inteligência
- ⚠️ Indicadores Avançados (GMD, intervalo parto-parto)
- ⚠️ Alertas Adicionais

### 🧱 PRIORIDADE 5 — Produto sério
- ❌ Importar Backup
- ⚠️ Multi-fazenda (troca rápida)

### 🚀 PRIORIDADE 6 — Futuro
- ❌ Integração com Balança

---

**Total de funcionalidades faltantes**: 10 (5 não implementadas + 5 parciais)

**Última atualização**: 01/12/2025

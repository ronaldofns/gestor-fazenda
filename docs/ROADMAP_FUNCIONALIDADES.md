# 🗺️ Roadmap de Funcionalidades - Gestor Fazenda

Este documento lista as funcionalidades sugeridas e o status de implementação de cada uma.

## 🔥 PRIORIDADE 1 — Robustez (antes de mais features)

### 1️⃣ Centro de Sincronização
**Status**: ⚠️ **PARCIAL**
- ✅ Status Online/Offline (componente `SyncStatus`)
- ✅ Botão "Sincronizar agora" (no TopBar e Sidebar)
- ❌ **FALTA**: Tela dedicada com:
  - Último sync bem-sucedido (timestamp)
  - Quantidade de pendências locais (contador)
  - Erros do último sync (log detalhado)
  - Histórico de sincronizações

**Onde está**: `src/components/SyncStatus.tsx`, `src/components/TopBar.tsx`, `src/components/Sidebar.tsx`

### 2️⃣ Fila de Eventos Offline
**Status**: ❌ **NÃO IMPLEMENTADO**
- ❌ Tabela `sync_events` no IndexedDB
- ❌ Tipo (INSERT, UPDATE, DELETE)
- ❌ Entidade (nascimento, desmama, etc.)
- ❌ Payload
- ❌ Tentativas
- ❌ Erro

**Nota**: Existe `sync_events` no Supabase (migration 001_init.sql), mas não está sendo usado no código.

### 3️⃣ Lock de Registro
**Status**: ❌ **NÃO IMPLEMENTADO**
- ❌ Campo `locked_by`
- ❌ Campo `locked_at`
- ❌ TTL (ex.: 10 min)
- ❌ Aviso quando outro usuário abre registro bloqueado

---

## 🐄 PRIORIDADE 2 — Funcionalidades que o produtor realmente usa

### 4️⃣ Linha do Tempo do Animal
**Status**: ⚠️ **PARCIAL**
- ✅ Histórico de partos por matriz (em `Home.tsx`)
- ✅ Mostra nascimento, desmama, peso
- ❌ **FALTA**: Timeline visual completa com:
  - Pesagens periódicas
  - Vacinações
  - Observações/eventos
  - Visualização em linha do tempo

**Onde está**: `src/routes/Home.tsx` (modal de histórico de matriz)

### 5️⃣ Pesagens Periódicas
**Status**: ❌ **NÃO IMPLEMENTADO**
- ❌ Tabela de pesagens
- ❌ Campos: peso, data, observação
- ❌ Cálculo de ganho médio diário (GMD)
- ❌ Alertas para animais fora do padrão

**Nota**: Existe apenas `pesoDesmama` em `Desmama`, não pesagens periódicas.

### 6️⃣ Vacinação / Sanidade
**Status**: ❌ **NÃO IMPLEMENTADO**
- ❌ Tabela de vacinações
- ❌ Campos: vacina, data, lote, responsável
- ❌ Alertas de vacinas vencidas
- ❌ Histórico de sanidade

---

## 📊 PRIORIDADE 3 — Inteligência (valor alto)

### 7️⃣ Indicadores Automáticos
**Status**: ✅ **IMPLEMENTADO (PARCIAL)**
- ✅ Taxa de desmama (%)
- ✅ Taxa de mortalidade
- ✅ Peso médio por raça
- ✅ Nascimentos por mês/ano
- ❌ **FALTA**: 
  - Ganho médio diário (GMD) por lote
  - Intervalo parto–parto
  - Taxa de natalidade por matriz

**Onde está**: `src/routes/Dashboard.tsx`

### 8️⃣ Alertas Inteligentes
**Status**: ✅ **IMPLEMENTADO (PARCIAL)**
- ✅ Bezerro sem desmama após X dias
- ✅ Mortalidade alta por fazenda
- ✅ Dados incompletos (matriz sem cadastro)
- ❌ **FALTA**:
  - Peso abaixo da média
  - Animal sem movimentação há X dias
  - Vacina vencida (quando implementar vacinação)

**Onde está**: `src/hooks/useNotifications.ts`, `src/routes/Notificacoes.tsx`

---

## 🔐 PRIORIDADE 4 — Profissionalização

### 9️⃣ Permissões Finas (RBAC)
**Status**: ✅ **IMPLEMENTADO**
- ✅ Sistema de roles (admin, gerente, peão, visitante)
- ✅ Permissões granulares por role
- ✅ 16 tipos de permissões diferentes
- ✅ Interface de gerenciamento (`Permissoes.tsx`)
- ✅ Sincronização de permissões

**Onde está**: 
- `src/hooks/usePermissions.ts`
- `src/routes/Permissoes.tsx`
- `src/db/models.ts` (RolePermission)

### 🔟 Auditoria
**Status**: ✅ **IMPLEMENTADO**
- ✅ Tabela `audits` (AuditLog)
- ✅ Registra: quem fez, o quê, quando
- ✅ Snapshot antes/depois (before/after)
- ✅ Histórico de alterações por entidade
- ✅ Restauração de versões anteriores
- ✅ Sincronização de auditoria

**Onde está**: 
- `src/db/models.ts` (AuditLog)
- `src/components/HistoricoAlteracoes.tsx`
- `src/utils/audit.ts`

---

## 🧱 PRIORIDADE 5 — Produto sério

### 1️⃣1️⃣ Backup Local
**Status**: ✅ **IMPLEMENTADO**
- ✅ Exportar dados para JSON
- ✅ Inclui todas as tabelas (fazendas, raças, nascimentos, desmamas, usuários)
- ✅ Metadados (totais, data do backup)
- ❌ **FALTA**: 
  - Importar backup (restaurar)
  - Exportar para CSV também

**Onde está**: `src/utils/exportarDados.ts` - `exportarBackupCompleto()`

### 1️⃣2️⃣ Multi-fazenda
**Status**: ⚠️ **PARCIAL**
- ✅ Usuário pode ter `fazendaId` (opcional)
- ✅ Sistema suporta múltiplas fazendas
- ❌ **FALTA**: 
  - Troca rápida de fazenda no topo
  - Seleção de fazenda ativa
  - Filtro automático por fazenda do usuário

**Nota**: O sistema já suporta múltiplas fazendas, mas não há interface para trocar entre elas facilmente.

---

## 🚀 PRIORIDADE 6 — Crescimento futuro

### 1️⃣3️⃣ Integração com Balança
**Status**: ❌ **NÃO IMPLEMENTADO**
- ❌ Integração Bluetooth
- ❌ Entrada manual assistida
- ❌ Leitura automática de peso

### 1️⃣4️⃣ Relatórios PDF
**Status**: ✅ **IMPLEMENTADO**
- ✅ Relatório de Nascimento/Desmama
- ✅ Relatório de Produtividade por Fazenda
- ✅ Relatório de Mortalidade por Raça
- ✅ Relatório de Desmama com Médias de Peso
- ✅ Geração offline-first

**Onde está**: `src/utils/gerarRelatorioPDF.ts`

---

## 📋 Resumo do Status

### ✅ Totalmente Implementado: 5 funcionalidades
1. Permissões Finas (RBAC)
2. Auditoria
3. Backup Local (exportação)
4. Relatórios PDF
5. Indicadores Automáticos (parcial - falta GMD e intervalo parto-parto)

### ⚠️ Parcialmente Implementado: 4 funcionalidades
1. Centro de Sincronização (falta tela dedicada com detalhes)
2. Linha do Tempo do Animal (falta timeline visual completa)
3. Alertas Inteligentes (falta alguns tipos)
4. Multi-fazenda (falta troca rápida)

### ❌ Não Implementado: 5 funcionalidades
1. Fila de Eventos Offline
2. Lock de Registro
3. Pesagens Periódicas
4. Vacinação / Sanidade
5. Integração com Balança

---

## 🎯 Funcionalidades Prioritárias para Implementar

### Sprint 1 - Robustez
1. **Centro de Sincronização** (tela dedicada)
2. **Fila de Eventos Offline** (tabela sync_events no IndexedDB)
3. **Lock de Registro** (campos locked_by, locked_at, TTL)

### Sprint 2 - Funcionalidades do Produtor
4. **Linha do Tempo do Animal** (timeline visual completa)
5. **Pesagens Periódicas** (tabela + GMD)
6. **Vacinação / Sanidade** (tabela + alertas)

### Sprint 3 - Melhorias
7. **Indicadores Avançados** (GMD, intervalo parto-parto)
8. **Alertas Adicionais** (peso abaixo da média, etc.)
9. **Multi-fazenda** (troca rápida)

### Sprint 4 - Futuro
10. **Importar Backup** (restaurar dados)
11. **Integração com Balança** (quando necessário)

---

**Última atualização**: 01/12/2025

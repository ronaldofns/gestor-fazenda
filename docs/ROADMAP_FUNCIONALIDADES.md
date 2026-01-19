# 🗺️ Roadmap de Funcionalidades - Gestor Fazenda

Este documento lista as funcionalidades sugeridas e o status de implementação de cada uma.

## 🔥 PRIORIDADE 1 — Robustez (antes de mais features)

### 1️⃣ Centro de Sincronização
**Status**: ✅ **IMPLEMENTADO**
- ✅ Status Online/Offline (componente `SyncStatus`)
- ✅ Botão "Sincronizar agora" (no TopBar e Sidebar)
- ✅ Tela dedicada com:
  - Último sync bem-sucedido (timestamp)
  - Quantidade de pendências locais (contador)
  - Erros do último sync (log detalhado)
  - Histórico de sincronizações

**Onde está**: `src/components/SyncStatus.tsx`, `src/components/TopBar.tsx`, `src/components/Sidebar.tsx`

### 2️⃣ Fila de Eventos Offline
**Status**: ✅ **IMPLEMENTADO**
- ✅ Tabela `sync_events` no IndexedDB
- ✅ Tipo (INSERT, UPDATE, DELETE)
- ✅ Entidade (nascimento, desmama, etc.)
- ✅ Payload
- ✅ Tentativas
- ✅ Erro

### 3️⃣ Lock de Registro
**Status**: ✅ **IMPLEMENTADO**
- ✅ Campo `locked_by`
- ✅ Campo `locked_at`
- ✅ TTL (ex.: 10 min)
- ✅ Aviso quando outro usuário abre registro bloqueado

---

## 🐄 PRIORIDADE 2 — Funcionalidades que o produtor realmente usa

### 4️⃣ Linha do Tempo do Animal
**Status**: ✅ **IMPLEMENTADO**
- ✅ Histórico de partos por matriz (em `Home.tsx`)
- ✅ Mostra nascimento, desmama, peso
- ✅ Pesagens periódicas
- ✅ Vacinações
- ✅ Timeline visual completa com:
  - Observações/eventos
  - Metadados completos (brinco, sexo, raça, lote, responsável)
  - Visualização consolidada em linha do tempo

**Onde está**: `src/routes/Home.tsx` (modal de histórico), `src/components/TimelineAnimal.tsx`

### 5️⃣ Pesagens Periódicas
**Status**: ✅ **IMPLEMENTADO**
- ✅ Tabela de pesagens
- ✅ Campos: peso, data, observação
- ✅ Cálculo de ganho médio diário (GMD)
- ✅ Alertas para animais fora do padrão
- ✅ Timeline de evolução do peso
- ✅ Sincronização completa

### 6️⃣ Vacinação / Sanidade
**Status**: ✅ **IMPLEMENTADO**
- ✅ Tabela de vacinações
- ✅ Campos: vacina, data de aplicação, data de vencimento, lote, responsável
- ✅ Histórico de sanidade
- ✅ Alertas de vacinas vencidas
- ✅ Alertas de vacinas vencendo em breve (30 dias)
- ✅ Sincronização completa

---

## 📊 PRIORIDADE 3 — Inteligência (valor alto)

### 7️⃣ Indicadores Automáticos
**Status**: ✅ **IMPLEMENTADO**
- ✅ Taxa de desmama (%)
- ✅ Taxa de mortalidade
- ✅ Peso médio por raça
- ✅ Nascimentos por mês/ano
- ✅ Ganho médio diário (GMD) médio do rebanho
- ✅ Intervalo parto–parto (média entre partos por matriz)
- ✅ Gráficos interativos (nascimentos, mortalidade, comparativo por fazenda)
- ✅ Distribuição por sexo

**Onde está**: `src/routes/Dashboard.tsx`, `src/utils/calcularGMD.ts`

### 8️⃣ Alertas Inteligentes
**Status**: ✅ **IMPLEMENTADO**
- ✅ Bezerro sem desmama após X dias
- ✅ Mortalidade alta por fazenda
- ✅ Dados incompletos (sem raça, sem data de nascimento)
- ✅ Matrizes sem cadastro
- ✅ Peso abaixo da média (15% abaixo do esperado por idade/raça)
- ✅ Vacinas vencidas
- ✅ Vacinas vencendo em breve (30 dias)
- ✅ Resumo compacto no Dashboard
- ✅ Detalhes completos em página dedicada

**Onde está**: `src/hooks/useNotifications.ts`, `src/routes/Notificacoes.tsx`, `src/routes/Dashboard.tsx`

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
**Status**: ✅ **IMPLEMENTADO (PARCIAL)**
- ✅ Exportar dados para JSON
- ✅ Exportar para CSV
- ✅ Inclui todas as tabelas (fazendas, raças, nascimentos, desmamas, usuários)
- ✅ Metadados (totais, data do backup)
- ❌ **FALTA**: 
  - Importar backup (restaurar)

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

### ✅ Totalmente Implementado: 11 funcionalidades
1. Centro de Sincronização
2. Fila de Eventos Offline
3. Lock de Registro
4. Permissões Finas (RBAC)
5. Auditoria
6. Relatórios PDF
7. Indicadores Automáticos
8. Alertas Inteligentes
9. Linha do Tempo do Animal
10. Pesagens Periódicas
11. Vacinação / Sanidade

### ⚠️ Parcialmente Implementado: 2 funcionalidades
1. Backup Local (falta importar/restaurar)
2. Multi-fazenda (falta troca rápida)

### ❌ Não Implementado: 1 funcionalidade
1. Integração com Balança

---

## 🎯 Funcionalidades Prioritárias para Implementar

### ✅ Sprint 1 - Robustez (CONCLUÍDA)
1. **Centro de Sincronização** ✅
2. **Fila de Eventos Offline** ✅
3. **Lock de Registro** ✅

### ✅ Sprint 2 - Funcionalidades do Produtor (CONCLUÍDA)
4. **Linha do Tempo do Animal** ✅
5. **Pesagens Periódicas** ✅
6. **Vacinação / Sanidade** ✅

### ✅ Sprint 3 - Inteligência (CONCLUÍDA)
7. **Indicadores Avançados** ✅
8. **Alertas Inteligentes** ✅

### 🚧 Sprint 4 - Melhorias e Refinamentos (PRÓXIMAS)
9. **Multi-fazenda** (troca rápida de contexto)
10. **Importar Backup** (restaurar dados salvos)
11. **Aplicar permissões nas rotas** (proteger acesso baseado em roles)
12. **Otimizações de performance** (lazy loading, virtualization)

### 🔮 Sprint 5 - Futuro
13. **Integração com Balança** (Bluetooth/USB)
14. **Modo offline aprimorado** (melhor feedback visual)
15. **PWA avançado** (notificações push, background sync)

---

**Última atualização**: 19/01/2026

# 🧭 Checklist do Roadmap Técnico – Sistema de Sincronização (Supabase ⇄ Dexie)

**Última verificação:** 2025-02-05

## Objetivo Central
Garantir sincronização escalável, performática, incremental e resiliente, reduzindo latência, consumo de rede, bloqueios no IndexedDB e riscos de sobrescrita de dados locais.

---

## ✅ 1. Visão Geral da Arquitetura

| Item | Status | Observação |
|------|--------|------------|
| Stack: React/TS, Dexie, Supabase | ✅ | |
| Pull-first, Push-after | ✅ | |
| Controle: synced, remoteId, updatedAt, deletedAt | ✅ | |
| syncCheckpoints.ts, lastPulledAt por tabela | ✅ | |

---

## ✅ 2. Motor Genérico (syncEngine.ts)

| Componente | Status | Detalhe |
|------------|--------|---------|
| **pullEntity** | ✅ | Incremental, paginação, limit, orderBy, updatedAtField, bulkPut/bulkUpdate, checkpoint |
| **pullEntitySimple** | ✅ | Incremental, bulkPut direto |
| **fetchAllPaginated** | ✅ | Para animais, genealogias |
| **fetchFromSupabase** | ✅ | Suporte incremental |
| **MARGEM_TIMESTAMP** | ✅ | 1 segundo |
| **PAGE_SIZE** | ✅ | 1000 (Supabase limit) |

---

## ✅ 3. Sistema de Checkpoints (syncCheckpoints.ts)

| Função | Status |
|--------|--------|
| getLastPulledAt | ✅ |
| setLastPulledAt | ✅ |
| clearLastPulledAt | ✅ |
| getLastPulledForQuery | ✅ |

---

## ✅ 4. Tabelas Migradas

| Tabela | Estratégia | Status |
|--------|------------|--------|
| categorias | pullEntity | ✅ |
| racas | pullEntity | ✅ |
| fazendas | pullEntity | ✅ |
| usuarios | pullEntity (exceto login) | ✅ |
| notificacoes_lidas | pullEntity (updatedAtField: marcada_em) | ✅ |
| auditoria | pullEntity (limit: 1000) | ✅ |
| role_permissions | pullEntity | ✅ |
| tipos_animal | pullEntitySimple | ✅ |
| status_animal | pullEntitySimple | ✅ |
| origens | pullEntitySimple | ✅ |
| animais | fetchAllPaginated + checkpoint | ✅ |
| genealogias | fetchAllPaginated + checkpoint | ✅ |

---

## ✅ 5. Tabelas Especiais (Não migradas)

| Tabela | Comportamento | Status |
|--------|---------------|--------|
| alertSettings | Registro único, sempre sobrescreve | ✅ |
| appSettings | Registro único, dependente de UI | ✅ |
| pullUsuarios (login) | Nunca remove usuários locais | ✅ |

---

## ✅ 6. Estratégia Pull (Ordem e Merge)

| Regra | Status |
|-------|--------|
| Ordem PULL → PUSH | ✅ syncAll chama pullUpdates antes de pushPending |
| Não sobrescrever se !local.synced && local.updatedAt >= server.updated_at - MARGEM | ✅ |

---

## ✅ 7. Push (syncEvents.ts)

| Item | Status |
|------|--------|
| Apenas synced === false | ✅ |
| BATCH_SIZE = 50 | ✅ |
| MAX_CONCURRENCY = 3 | ✅ |
| bulkUpdate em lote | ✅ |
| markBatchError | ✅ |
| MAX_TENTATIVAS = 5 | ✅ |

---

## ✅ 8. Controle de Concorrência

| Item | Status |
|------|--------|
| isSyncing guard em syncAll | ✅ |
| syncState: setGlobalSyncing, getGlobalSyncing | ✅ |
| Retorno { ran: false } quando já sincronizando | ✅ |

---

## ✅ 9. Observabilidade

| Item | Status |
|------|--------|
| Eventos syncProgress, syncCompleted | ✅ |
| SyncStats (tempo, registros por etapa) | ✅ |
| Logs reduzidos em hot paths | ✅ |

---

## ✅ 10. Forçar Sincronização Completa

| Item | Status |
|------|--------|
| syncAllFull() em syncService | ✅ |
| Botão "Forçar sync completa" na página Sincronização | ✅ |
| Diálogo de confirmação | ✅ |

---

## ⚠️ 11. Pontos de Atenção

- Supabase limita 1000 registros por página
- updated_at deve existir e ser confiável em todas as tabelas
- Índices no Postgres são obrigatórios
- FK não resolvida = registro ignorado
- Batch grande demais = erro 413
- Checkpoint errado = perda de dados (use "Forçar sync completa" para recuperar)
- Diferença de timezone pode causar falso conflito

---

## 📋 12. Roadmap Futuro (Não implementados)

- ETag / versioning
- WebWorker para sync
- Retry com backoff
- Partial failure recovery
- Telemetria (tempo médio por tabela)
- Dry-run mode
- Sync por fazenda (sharding lógico)
- Snapshot inicial + incremental contínuo
- Feature flag para tabelas grandes
- Testes automatizados de merge

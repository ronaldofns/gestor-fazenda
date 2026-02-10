# Checklist – Módulo de Confinamento

Conferência em relação ao spec (9 camadas + roadmap).

---

## 1️⃣ Conceito (O que é confinamento)

| Item | Status | Observação |
|------|--------|------------|
| Confinamento é processo/ciclo, não animal | ✅ | Modelo e telas tratam como lote/ciclo |
| Animal pode não estar / estar em um / passar por vários | ✅ | `confinamento_animais` com data_entrada/data_saida, histórico preservado |
| Relação N:N ao longo do tempo | ✅ | Um vínculo por “permanência”; novo vínculo se reentrar |

---

## 2️⃣ Entidades (Backend + modelo local)

| Entidade | Backend (Supabase) | Modelo (Dexie/models) | Observação |
|----------|--------------------|------------------------|------------|
| **confinamentos** | ✅ | ✅ | uuid, fazenda_id, nome, datas, status, observacoes, deleted_at |
| **confinamento_animais** | ✅ | ✅ | uuid, confinamento_id, animal_id, data_entrada/saida, peso_entrada/saida, motivo_saida |
| **confinamento_pesagens** | ✅ | ✅ | uuid, confinamento_animal_id, data, peso |
| **confinamento_alimentacao** | ✅ | ✅ | uuid, confinamento_id, data, tipo_dieta, custo_total |

Status possíveis do confinamento: `ativo` | `finalizado` | `cancelado`.  
Histórico: vínculos não são sobrescritos; novo vínculo se o animal entrar de novo.

---

## 3️⃣ Relação com o que já existe

| Item | Status | Observação |
|------|--------|------------|
| Animais continuam entidade central | ✅ | Sem duplicação de dados do animal |
| Status visual “Confinado” no animal | ⚠️ | **Falta:** na tela/lista do animal não há indicador “Confinado em: X” nem GMD atual |
| Pesagens: tabela separada de confinamento | ✅ | `confinamento_pesagens` própria (não reutiliza pesagens gerais) |
| Auditoria para confinamento | ✅ | `confinamento`, `confinamentoAnimal`, `confinamentoPesagem`, `confinamentoAlimentacao` em audits e restauração no histórico |

---

## 4️⃣ Estrutura local (Dexie)

| Item | Status | Observação |
|------|--------|------------|
| `db.confinamentos` | ✅ | Chave `id` (uuid), índices fazendaId, status, synced, deletedAt, updatedAt |
| `db.confinamentoAnimais` | ✅ | Índices confinamentoId, animalId, dataSaida, synced |
| `db.confinamentoPesagens` | ✅ | Índices confinamentoAnimalId, data, synced |
| `db.confinamentoAlimentacao` | ✅ | Índices confinamentoId, data, synced |

---

## 5️⃣ Sincronização

| Item | Status | Observação |
|------|--------|------------|
| **Pull** confinamentos + 3 tabelas relacionadas | ✅ | `syncService`: pull das 4 tabelas com mapeamento e FKs (fazenda_id → uuid local, etc.) |
| **Push** INSERT/UPDATE via fila | ✅ | `syncEvents`: tableMap, payloadToServerConfinamento, createSyncEvent, processSyncQueue |
| **Push** DELETE | ✅ | Eventos DELETE enriquecidos com `remoteId` da entidade local antes do envio |
| Ordem de envio (FKs) | ✅ | Ondas: confinamento → confinamento_animais → pesagens/alimentação |
| Incremental (checkpoint por updated_at) | ⚠️ | Confinamento usa **forceFullPull** (pull completo). Spec sugere incremental; atual é funcional, otimização futura |

---

## 6️⃣ Regras de negócio

| Regra | Status | Observação |
|-------|--------|------------|
| **1. Animal só pode ter 1 confinamento ativo** | ✅ | `validarEntradaAnimal` em `confinamentoRules.ts`; usada no modal de vínculo |
| **2. Encerrar confinamento** (data_fim_real → preencher data_saida e peso_saida nos vínculos) | ✅ | `encerrarConfinamento` encerra vínculos ativos; pesoSaida = última pesagem do confinamento ou peso atual do animal ou fallback |
| **3. Animal vendido/morto** encerra vínculo e registra motivo | ✅ | `AnimalModal` ao salvar chama `encerrarVinculoPorStatusAnimal` quando status é vendido/morto/abate (por nome do status) |

---

## 7️⃣ Telas (UX)

| Tela / Item | Status | Observação |
|-------------|--------|------------|
| **Lista de Confinamentos** | | |
| – Nome, Status, Qtde animais | ✅ | Nome, status, ativos/total |
| – Data início, Fazenda | ✅ | |
| – Peso médio entrada | ✅ | Coluna "Peso méd. entrada" na tabela e nos cards mobile |
| – GMD parcial | ✅ | Coluna "GMD" (médio) na tabela e nos cards mobile |
| – Atalhos (ver, encerrar, editar, excluir) | ✅ | |
| **Detalhe do Confinamento** | | |
| – Aba Animais | ✅ | Entrada/saída, peso, encerrar vínculo |
| – Aba Pesagens | ✅ | Registrar e listar por animal |
| – Aba Alimentação | ✅ | Tipo dieta, custo, observações |
| – Aba Indicadores | ✅ | Peso médio entrada/saída, GMD médio, tempo médio |
| – Aba Histórico | ✅ | Auditoria + restauração (confinamento e relacionadas) |
| **Animal (tela do animal)** | | |
| – “Confinado em: X” | ✅ | Card "Confinado em" no `AnimalModal` (acima das abas) quando o animal tem vínculo ativo |
| – Data entrada, peso inicial, GMD atual | ✅ | Mesmo card exibe data entrada, peso entrada, peso atual e GMD atual (parcial) |

---

## 8️⃣ Relatórios

| Item | Status | Observação |
|------|--------|------------|
| GMD por confinamento | ✅ | Cálculo no detalhe do confinamento (Indicadores) |
| Custo por arroba | ⚠️ | Dados de alimentação e custo existem; **não há relatório específico** (custo/arroba) |
| Tempo médio de permanência | ✅ | “dias médio” na aba Indicadores |
| Mortalidade no confinamento | ❌ | Não calculado/exibido |
| Ganho total por animal | ✅ | GMD e pesos por vínculo no detalhe |
| Comparação entre confinamentos | ❌ | Não há tela/relatório comparativo |
| Relatórios.tsx (geral) | ⚠️ | Não inclui seção de confinamento (evolução rebanho, tipos, etc.) |

---

## 9️⃣ Roadmap (Fases)

| Fase | Itens | Status resumido |
|------|--------|------------------|
| **Fase 1 – MVP** | confinamentos, confinamento_animais, entrada/saída, pesagens, sync | ✅ Implementado (sync com full pull) |
| **Fase 2 – Gestão** | alimentação, custos, GMD automático, alertas (baixo ganho) | ✅ Alimentação e custos; GMD no detalhe. ❌ Alertas de baixo ganho não implementados |
| **Fase 3 – Inteligência** | ranking, comparação histórica, previsão de saída, alerta ponto ótimo | ❌ Não implementado |

---

## Resumo: o que está pronto x o que falta

### ✅ Pronto

- Conceito e modelo (confinamento = ciclo; vínculos com histórico).
- Entidades no backend e no Dexie (4 tabelas, índices).
- Sync pull/push (incl. DELETE com remoteId), ordem de FKs, auditoria e restauração no histórico.
- Regras: 1 confinamento ativo por animal; encerrar confinamento (data_saida + peso).
- Lista de confinamentos (nome, status, qtd animais, datas, ações).
- Detalhe com abas Animais, Pesagens, Alimentação, Indicadores (GMD, pesos, dias), Histórico.
- GMD e tempo médio no detalhe do confinamento.

### ❌ / ⚠️ Falta ou incompleto

1. ~~**Animal vendido/morto:** chamar `encerrarVinculoPorStatusAnimal` ao salvar animal com status vendido/morto.~~ ✅ Feito em `AnimalModal`.
2. ~~**Tela do animal:** mostrar “Confinado em: X”, data entrada, peso inicial e GMD atual.~~ ✅ Feito: card no `AnimalModal` quando há confinamento ativo.
3. ~~**Lista de confinamentos:** exibir peso médio entrada e GMD parcial.~~ ✅ Feito: colunas e cards mobile.
4. **Sync:** evoluir pull de confinamento para incremental (checkpoint por `updated_at`) se volume crescer.
5. **Relatórios:** seção confinamento em Relatórios (GMD por confinamento, custo/arroba, mortalidade, comparação).
6. **Fase 2:** alertas de baixo ganho no confinamento (opcional).
7. **Fase 3:** ranking, comparação histórica, previsão de saída, ponto ótimo (futuro).

---

*Atualizado com base no código e no spec em 9 camadas + roadmap.*

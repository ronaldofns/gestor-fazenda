# 🗺️ Roadmap — Gestor Fazenda

## 🎯 Objetivo do roadmap

Chegar em **v1.0 estável, vendável e validado em campo**, com:

- **Offline confiável**
- **Fluxo rápido no curral**
- **Valor claro para o produtor**
- **Base sólida para escalar**

---

## 🟢 v0.4.0 — Produto de Campo (CURRAL FIRST)

**Meta:** Fazer o sistema ser rápido e usável no curral, não só bonito no escritório.

### Features-chave

| Item | Status | Observação |
|------|--------|------------|
| **Modo Campo / Curral** — Toggle global, UI simplificada, fonte grande, alto contraste, botões de ação direta | ❌ Não implementado | Não existe “modo curral” dedicado; tema e cores existem, mas sem toggle curral/escritório |
| **Fluxos rápidos** — Pesagem rápida, Vacinação rápida (individual e lote), Desmama rápida, Alteração de status em lote | 🔶 Parcial | Pesagem/Vacina/Desmama existem no modal do animal; não há tela “pesagem rápida” nem ações em lote |
| **Lista “Pendências do Curral”** — Bezerros sem desmama, Vacinas vencidas, Animais sem pesagem recente | 🔶 Parcial | Notificações/alertas cobrem desmama atrasada e vacinas vencidas; não há lista dedicada “Pendências do Curral” nem “sem pesagem recente” |
| **Feedback offline claro** — Badge “Offline”, contador de ações pendentes, Sync manual | ✅ Implementado | OfflineIndicator (barra + toast), contador de pendências na Sincronização, sync manual |

### Ajustes técnicos (v0.4)

| Item | Status |
|------|--------|
| Simplificar permissões → presets | ❌ Não implementado |
| Reduzir relatórios para 3 essenciais | ❌ Não implementado (há mais relatórios/gráficos) |
| UX mobile-first (toque > clique) | 🔶 Parcial (layout responsivo; sem foco explícito em toque) |

**Resultado esperado v0.4:** Usuário consegue trabalhar o dia inteiro sem internet.  
**Estado atual:** Offline e sync ok; falta “modo curral” e fluxos rápidos/lote.

---

## 🟢 v0.5.0 — Experiência do Animal

**Meta:** Transformar dados em entendimento rápido.

### Features-chave

| Item | Status | Observação |
|------|--------|------------|
| **Linha do tempo do animal** — Eventos cronológicos, ícones por tipo (vacina, peso, status), offline | ✅ Implementado | `TimelineAnimal.tsx`; eventos de nascimento, desmama, pesagens, vacinações, status |
| **Perfil do animal (refino)** — Dados principais no topo, Ações rápidas fixas, Histórico colapsável | 🔶 Parcial | AnimalModal completo; pode refinar ordem (dados no topo) e ações fixas/colapsável |
| **Genealogia otimizada** — Lazy loading, visual mais simples no mobile | 🔶 Parcial | `ArvoreGenealogica` com lazy load; pode melhorar visual no mobile |
| **Histórico de alterações (UI simplificada)** — Quem alterou, Quando, O quê (resumo) | ✅ Implementado | `HistoricoAlteracoes.tsx` por entidade |

**Resultado esperado v0.5:** Em 5 segundos, o produtor entende a história do animal.  
**Estado atual:** Timeline e histórico existem; refinamentos de perfil e genealogia mobile são opcionais.

---

## 🟢 v0.6.0 — Entrada e Saída de Dados

**Meta:** Facilitar adoção e segurança dos dados.

### Features-chave

| Item | Status | Observação |
|------|--------|------------|
| **Importação por Excel/CSV** — Template oficial, preview antes de importar, validação clara de erros | ❌ Não implementado | Tela de importação de planilha foi removida; seria reimplementar com template e validação |
| **Exportações refinadas** — Excel por filtros, PDF resumido por fazenda | 🔶 Parcial | Export Excel/CSV em Animais (com filtros); PDF no Dashboard/Relatórios; “resumido por fazenda” pode ser refinado |
| **Backup & Restore v2** — Histórico visual, download manual, restauração seletiva (por entidade) | 🔶 Parcial | Backup automático e histórico em Configurações; restauração seletiva por entidade não existe |
| **Auditoria v2** — Timeline de alterações, busca por usuário/entidade | 🔶 Parcial | Histórico por entidade existe; busca por usuário/entidade não |

**Resultado esperado v0.6:** Migrar do papel ou outro sistema vira algo simples.  
**Estado atual:** Export e backup existem; falta importação e refinamentos de backup/auditoria.

---

## 🟢 v0.7.0 — Alertas e Inteligência Básica

**Meta:** O sistema “avisar” o produtor.

### Features-chave

| Item | Status | Observação |
|------|--------|------------|
| **Central de alertas** — Lidos / não lidos, Severidade (info / atenção / crítico) | ✅ Implementado | Notificações com filtro lidos/não lidos; severidade alta/média/baixa em `useAlertas` e UI |
| **Alertas configuráveis** — Vacina vencida, Bezerro sem desmama, Mortalidade, Matriz improdutiva | ✅ Implementado | Configurações → Alertas (limites); tipos no código e em Notificações |
| **Dashboard orientado a ação** — Cards clicáveis, acesso direto ao problema | 🔶 Parcial | AlertasBanner no Dashboard com links; pode aumentar “cards clicáveis” e links diretos |

**Resultado esperado v0.7:** O produtor abre o app e sabe o que precisa resolver hoje.  
**Estado atual:** Central de alertas e configuração existem; dashboard pode ganhar mais ações diretas.

---

## 🟢 v0.8.0 — Financeiro Leve

**Meta:** Dar noção de dinheiro sem virar ERP.

### Features-chave

| Item | Status | Observação |
|------|--------|------------|
| **Custos por animal (opcional)** — Vacina, Compra, Outros custos manuais | 🔶 Parcial | Animal tem `valorCompra` e `valorVenda`; não há “outros custos” nem custo de vacina por animal |
| **Valor de venda** | ✅ Implementado | Campo `valorVenda` no animal |
| **Lucro/prejuízo estimado** | ❌ Não implementado | Não há cálculo nem exibição por animal ou por fazenda |
| **Indicadores simples** — Custo médio, Resultado por fazenda | ❌ Não implementado | Não há tela nem cards de custo médio/resultado |

**Resultado esperado v0.8:** “Estou ganhando ou perdendo dinheiro?”  
**Estado atual:** Valor compra/venda no animal; falta custos adicionais, lucro/prejuízo e indicadores.

---

## 🟢 v0.9.0 — Pronto para Escalar

**Meta:** Estabilidade, confiança e polimento.

### Features-chave

| Item | Status | Observação |
|------|--------|------------|
| **Integração com balança (se disponível)** | ✅ Implementado | Configurações → Balança (Web Bluetooth, perfil Weight Scale); peso na pesagem |
| **Sync avançado multi-dispositivo** | 🔶 Parcial | Sync bidirecional Supabase; conflitos tratados; “avançado” pode incluir mais dispositivos/UX |
| **Resolução de conflitos aprimorada** | 🔶 Parcial | Existe tratamento no syncService; pode melhorar mensagens e resolução manual |
| **Logs técnicos (suporte)** | ❌ Não implementado | Não há tela/logs exportáveis para suporte |
| **Performance tuning final** | 🔶 Parcial | Lazy loading, virtualização (Animais), índices; sempre espaço para tuning |
| **UX polish** — Microinterações, empty states educativos, onboarding rápido | 🔶 Parcial | Empty states e toasts existem; microinterações e onboarding não dedicados |

**Resultado esperado v0.9:** Sistema sólido para múltiplos clientes reais.  
**Estado atual:** Balança e sync ok; falta logs para suporte e polish de UX/onboarding.

---

## 🟢 v1.0.0 — LANÇAMENTO COMERCIAL

**Meta:** Vender sem vergonha.

### Entregáveis

| Item | Status |
|------|--------|
| MVP + PRO bem definidos | ❌ Não implementado |
| Planos de assinatura ativos | ❌ Não implementado |
| Trial 30 dias | ❌ Não implementado |
| Documentação básica | 🔶 Parcial (docs técnicos e funcionais existem) |
| Política de backup e segurança | ❌ Não implementado (documento formal) |
| Página institucional simples | ❌ Não implementado |

**Estado atual:** Produto funcional; camada comercial (planos, trial, página) não existe.

---

## 📋 Resumo para implementação

### Já coberto (pouco ou nenhum trabalho)

- v0.4: Feedback offline (badge, contador, sync manual).
- v0.5: Linha do tempo do animal, histórico de alterações.
- v0.7: Central de alertas, severidade, alertas configuráveis.
- v0.8: Valor de venda (e compra) no animal.
- v0.9: Integração com balança.

### Prioridade sugerida para implementar

1. **v0.4 — Curral First (maior impacto no uso no campo)**  
   - Modo Campo/Curral (toggle + UI simplificada, fonte grande, alto contraste).  
   - Fluxos rápidos: pesagem rápida, vacinação rápida, desmama rápida (telas ou atalhos dedicados).  
   - Alteração de status em lote.  
   - Lista “Pendências do Curral” (bezerros sem desmama, vacinas vencidas, sem pesagem recente).

2. **v0.6 — Entrada e Saída**  
   - Reimplementar importação Excel/CSV (template, preview, validação).  
   - Backup v2: restauração seletiva por entidade.  
   - Auditoria v2: busca por usuário/entidade.

3. **v0.8 — Financeiro Leve**  
   - Custos por animal (opcional): vacina, outros.  
   - Cálculo e exibição de lucro/prejuízo (por animal ou resumo).  
   - Indicadores: custo médio, resultado por fazenda.

4. **v0.9 — Escalar**  
   - Logs técnicos para suporte.  
   - UX polish e onboarding rápido.

5. **v1.0 — Comercial**  
   - Definir MVP vs PRO, planos, trial, política de backup/segurança, página institucional.

---

**Última atualização:** Comparação com o novo roadmap (v0.4–v1.0); status por feature e prioridade de implementação.

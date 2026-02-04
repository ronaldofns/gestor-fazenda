# Changelog - Gestor Fazenda

## [0.3.2] - 2026-02-03

### 🐛 Correções (Animais)

- **isLoading antes da inicialização**: Declaração de `animaisRawQuery`, `isLoading` e `animaisRaw` movida para antes do `useEffect` que abre animal pela URL.
- **Filtros e cards**: Inclusão de `filtroMesesNascimento` e `filtroAno` nas dependências do `useMemo` de `animaisFiltrados`, para os cards e a tabela refletirem os filtros de mês/ano.
- **Card Matrizes ano 2026**: Quando a lista filtrada tem filhos (ex.: bezerros de 2026), o card passa a mostrar as matrizes distintas desses filhos; quando não tem, mostra quantos filtrados são tipo Vaca/Novilho(a).
- **Card Raças**: Total do card passou a usar `animaisFiltrados.length` (mesma fonte da tabela).
- **Indicador "Total da lista filtrada"**: Exibido acima dos cards para conferência visual com a tabela.

### ✨ Melhorias (Animais)

- **Bezerros e Matrizes por ID de tipo**: Cards Bezerros e Matrizes passam a usar IDs de tipo (Bezerro(a), Vaca, Novilho(a)) em vez de comparação por nome.
- **Filtro Ano**: Combobox com `allowCustomValue={true}` para permitir digitar ano fora da lista.
- **Loading ao filtrar**: Banner "Aplicando filtros..." com spinner quando qualquer filtro é aplicado (`useTransition`).
- **Botão Limpar ao lado do Ano**: Removido; uso de "Todos os anos" no dropdown ou "Limpar filtros".
- **Filtros Ano/Mês**: Atualização síncrona (sem `startTransition`) para evitar inconsistência entre cards e tabela.

---

## [0.3.1] - 2026-01-20

### 🚀 Otimizações de Performance

#### Correção Crítica de OOM (Out of Memory)
- **Sistema de Tags**: Redução de 99% de queries ativas
  - ANTES: 100 nascimentos × 2 queries = 200 subscriptions
  - AGORA: 1 página × 2 queries = 2 subscriptions
  - Hook centralizado `useAllEntityTags` substituindo `useEntityTags`
  
#### Home.tsx - Otimizações
- ✅ **Deduplicação simplificada**: 99% mais rápida (60 linhas → 10 linhas)
- ✅ **Debounce em busca global**: 300ms (evita queries a cada tecla)
- ✅ **Queries otimizadas**: Removido `db.isOpen()` check desnecessário
- ✅ **useMemo otimizados**: Cálculos de uso de fazenda/raça mais eficientes
- 📉 **Bundle size**: Home.js 144KB → 143KB

#### Componentes Refatorados
- `NascimentoTags`, `MatrizTags`, `FazendaTags` - recebem tags via props
- `useAllEntityTags` - hook centralizado para todas as entidades
- `useDebounce` - hook reutilizável para debounce

### 🐛 Correções
- Removido arquivo `useEntityTags.ts` (causava memory leak)
- Removidos logs de debug em `syncService.ts`

### 📚 Documentação
- Criado `docs/OTIMIZACAO_DESEMPENHO.md` com análise completa

---

## [0.3.0] - 2026-01-20

### ✨ Novas Funcionalidades

#### Sistema de Tags Completo
- ✅ Criação e gerenciamento de tags personalizadas
- ✅ Associação de tags a Nascimentos, Matrizes e Fazendas
- ✅ Sincronização bidirecional com Supabase
- ✅ Soft delete de tags
- ✅ Componentes: `TagSelector`, `TagsManager`, `TagsDisplay`
- ✅ Exibição de tags em todas as listagens

#### Migrações Supabase
- `032_fix_tags_policies.sql` - Ajuste de RLS policies
- `033_remove_tags_fk_constraints.sql` - Remoção de FKs para auth.users
- `034_diagnostico_tags_policies.sql` - Diagnóstico de RLS
- `035_remove_orphan_tags_policies.sql` - Limpeza de policies órfãs
- `036_fix_function_search_path.sql` - Segurança em trigger functions
- `037_enable_rls_tags_with_public_policies.sql` - RLS público

### 🔧 Melhorias
- Substituição de `window.confirm` por `ConfirmDialog` customizado
- Correção de scroll em modais com `TagSelector`
- Fix em `Combobox` - validação de valores string
- Correção de sincronização de soft delete

---

## Versões Anteriores

Ver `docs/CONTROLE_VERSAO.md` para histórico completo.

# Operações Auditadas no Sistema

Este documento lista todas as operações que são registradas no histórico de alterações (audit log) do sistema.

## Entidades Auditadas

### 1. **Nascimento** (`nascimento`)
- ✅ **CREATE** - Criação de novo nascimento
- ✅ **UPDATE** - Edição de nascimento existente
- ✅ **DELETE** - Exclusão de nascimento

**Onde é auditado:**
- `src/components/NascimentoModal.tsx`
- `src/routes/Home.tsx`

### 2. **Desmama** (`desmama`)
- ✅ **CREATE** - Criação de nova desmama
- ✅ **UPDATE** - Edição de desmama existente
- ✅ **DELETE** - Exclusão de desmama

**Onde é auditado:**
- `src/components/NascimentoModal.tsx`
- `src/routes/CadastroDesmama.tsx`
- `src/routes/Home.tsx`

### 3. **Pesagem** (`pesagem`)
- ✅ **CREATE** - Criação de nova pesagem periódica
- ✅ **UPDATE** - Edição de pesagem existente
- ✅ **DELETE** - Exclusão de pesagem

**Onde é auditado:**
- `src/components/PesagemModal.tsx`

### 4. **Vacinação** (`vacina`)
- ✅ **CREATE** - Criação de nova vacinação
- ✅ **UPDATE** - Edição de vacinação existente
- ✅ **DELETE** - Exclusão de vacinação

**Onde é auditado:**
- `src/components/VacinaModal.tsx`

### 5. **Matriz** (`matriz`)
- ✅ **CREATE** - Criação de nova matriz
- ✅ **UPDATE** - Edição de matriz existente
- ❌ **DELETE** - Não implementado (matrizes não são excluídas, apenas desativadas)

**Onde é auditado:**
- `src/components/MatrizModal.tsx`

### 6. **Categoria** (`categoria`)
- ✅ **CREATE** - Criação de nova categoria
- ❌ **UPDATE** - Não implementado
- ❌ **DELETE** - Não implementado

**Onde é auditado:**
- `src/components/ModalCategoria.tsx`

## Entidades NÃO Auditadas (ainda)

As seguintes entidades ainda não possuem auditoria implementada:

- ❌ **Fazenda** (`fazenda`)
- ❌ **Raça** (`raca`)
- ❌ **Usuário** (`usuario`)

## Informações Registradas

Cada registro de auditoria contém:

- **entity**: Tipo da entidade (nascimento, desmama, etc.)
- **entityId**: ID único da entidade
- **action**: Ação realizada (create, update, delete)
- **timestamp**: Data e hora da operação
- **userId**: ID do usuário que realizou a operação
- **userNome**: Nome do usuário que realizou a operação
- **before**: Snapshot JSON do estado anterior (para update/delete)
- **after**: Snapshot JSON do estado atual (para create/update)
- **description**: Descrição opcional da operação

## Sincronização

Todos os registros de auditoria são:
- ✅ Salvos localmente no IndexedDB (`db.audits`)
- ✅ Sincronizados com o servidor Supabase (`audits_online`)
- ✅ Buscados de outros usuários durante a sincronização

**Arquivos relacionados:**
- `src/utils/audit.ts` - Função `registrarAudit()`
- `src/api/syncService.ts` - Funções `pushPending()` e `pullUpdates()`

## Visualização

O histórico de alterações pode ser visualizado através do componente `HistoricoAlteracoes`, disponível em várias páginas do sistema através do botão de histórico.

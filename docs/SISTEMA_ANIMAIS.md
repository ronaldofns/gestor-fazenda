# 🐄 Sistema de Animais - Gestor Fazenda

## 📋 Visão Geral

Novo sistema completo de gestão de animais, substituindo gradualmente o módulo "Nascimento/Desmama" por uma estrutura mais profissional e flexível.

---

## ✅ O Que Foi Implementado

### 1. **Estrutura de Dados**

#### Tabelas Principais:
- **`animais`** - Registro completo de cada animal
- **`tiposAnimal`** - Tipos editáveis (Bezerro, Vaca, Touro, etc.)
- **`statusAnimal`** - Status editáveis (Ativo, Vendido, Morto, etc.)
- **`origens`** - Origens editáveis (Nascido, Comprado, Transferido, etc.)
- **`genealogias`** - Árvore genealógica completa (até avós)

#### Campos do Animal:
```typescript
{
  // Identificação
  id: UUID (chave primária)
  brinco: string (identificador visual)
  nome?: string (opcional)
  
  // Classificação
  tipoId: FK para tipos_animal
  racaId: FK para racas
  sexo: 'M' | 'F'
  statusId: FK para status_animal
  
  // Datas
  dataNascimento: date
  dataCadastro: date
  dataEntrada?: date (compra/transferência)
  dataSaida?: date (venda/morte)
  
  // Origem e Proprietário
  origemId: FK para origens
  fazendaId: FK para fazendas (atual)
  fazendaOrigemId?: FK (se transferido)
  proprietarioAnterior?: string
  
  // Genealogia
  matrizId?: UUID (mãe)
  reprodutorId?: UUID (pai)
  
  // Financeiro
  valorCompra?: number
  valorVenda?: number
  
  // Físico
  pelagem?: string
  pesoAtual?: number
  
  // Agrupamento
  lote?: string
  categoria?: string
  
  // Observações
  obs?: string
}
```

---

### 2. **Arquivos Criados**

#### Models e Schema:
- ✅ `src/db/models.ts` - Interfaces TypeScript
- ✅ `src/db/dexieDB.ts` - Schema Dexie v25
- ✅ `supabase/migrations/038_create_animal_system.sql` - Tabelas Supabase

#### Componentes:
- ✅ `src/components/AnimalModal.tsx` - Modal principal (completo)
- ✅ `src/components/TipoAnimalModal.tsx` - Cadastro rápido de tipos
- ✅ `src/components/StatusAnimalModal.tsx` - Cadastro rápido de status
- ✅ `src/components/AnimalTags.tsx` - Exibição de tags

#### Tela Principal:
- ✅ `src/routes/Animais.tsx` - Listagem completa otimizada

#### Utilitários:
- ✅ `src/utils/migrarNascimentosParaAnimais.ts` - Script de migração
- ✅ `src/api/syncService.ts` - Sincronização bidirecional

#### Rota:
- ✅ Adicionada em `App.tsx` - `/animais`
- ✅ Menu no `Sidebar.tsx` - Item "Animais" com ícone PawPrint

---

## 🚀 Como Testar

### 1. **Primeira Execução (Criar Dados Padrão)**

Ao abrir a aplicação, o Dexie v25 será executado automaticamente e criará:
- ✅ 8 Tipos de Animal padrão
- ✅ 5 Status padrão
- ✅ 4 Origens padrão

### 2. **Acessar o Sistema**

```
1. Abra a aplicação
2. Clique em "Animais" no menu lateral
3. Clique em "+ Novo Animal"
```

### 3. **Cadastro Rápido**

No modal de cadastro:
- Clique em "+ Novo" ao lado de "Tipo" para criar tipos customizados
- Clique em "+ Novo" ao lado de "Status" para criar status customizados

### 4. **Funcionalidades Disponíveis**

- ✅ Cadastro completo de animais
- ✅ Edição e exclusão (soft delete)
- ✅ Filtros por: sexo, tipo, status
- ✅ Busca global (brinco, nome, lote)
- ✅ Tags personalizadas
- ✅ Paginação (20 por página)
- ✅ Estatísticas em tempo real
- ✅ Sincronização automática com Supabase

---

## 📊 Migração de Dados

### Script de Migração

Para migrar dados de **Nascimentos → Animais**:

```javascript
// Cole no console (F12) da aplicação
(async () => {
  const { migrarNascimentosParaAnimais, verificarMigracao } = await import('./src/utils/migrarNascimentosParaAnimais.js');
  
  // Verificar se já foi migrado
  const jaFoiMigrado = await verificarMigracao();
  
  if (jaFoiMigrado) {
    console.warn('⚠️ Migração já foi executada! Animais já existem no banco.');
    const confirmar = confirm('Executar migração novamente? Isso pode criar duplicatas!');
    if (!confirmar) return;
  }
  
  console.log('🚀 Iniciando migração...\n');
  const resultado = await migrarNascimentosParaAnimais();
  
  console.log('\n📊 RESULTADO FINAL:');
  console.log(`✅ Sucesso: ${resultado.sucesso}`);
  console.log(`❌ Erros: ${resultado.erros}`);
  console.log('\n📝 Detalhes:');
  resultado.detalhes.forEach(d => console.log(d));
  
  console.log('\n✨ Migração concluída! Acesse /animais para ver os dados migrados.');
})();
```

### Após Migração

1. ✅ Verificar dados em `/animais`
2. ✅ Testar criação de novos animais
3. ✅ Testar edição e exclusão
4. ✅ Verificar sincronização
5. ✅ Validar tags migradas

**DEPOIS DE TUDO VALIDADO:**
- Tabela `nascimentos` pode ser removida
- Rota `/planilha` pode ser depreciada

---

## 🎯 Vantagens do Novo Sistema

### vs. Sistema Anterior (Nascimentos)

| Recurso | Nascimentos | Animais | Melhoria |
|---------|-------------|---------|----------|
| **Estrutura** | Focado em nascimentos | Gerenciamento completo | ✅ 100% |
| **Identificação** | Brinco opcional | Brinco obrigatório | ✅ Melhor |
| **Tipos** | Novilha/Vaca (flags) | Tabela editável | ✅ Flexível |
| **Status** | Apenas "morto" | 5+ status editáveis | ✅ Completo |
| **Origem** | Apenas nascidos | 4+ origens | ✅ Profissional |
| **Genealogia** | Apenas matrizId | Árvore completa | ✅ Avançado |
| **Financeiro** | Não | Compra/Venda | ✅ Novo |
| **Rastreabilidade** | Limitada | Completa | ✅ 100% |

---

## 📦 Dependências e Relacionamentos

### Relacionamentos Mantidos:
- ✅ `animais` → `fazendas` (fazendaId)
- ✅ `animais` → `racas` (racaId)
- ✅ `animais` → `animais` (matrizId, reprodutorId)

### Tabelas que Precisarão Atualização (Futuro):
- ⏳ `desmamas` - adicionar campo `animalId`
- ⏳ `pesagens` - adicionar campo `animalId`
- ⏳ `vacinacoes` - adicionar campo `animalId`

**Nota:** Por enquanto, essas tabelas continuam usando `nascimentoId`. A migração completa será feita após validação.

---

## 🔐 Segurança e Sincronização

### RLS Policies (Supabase):
- ✅ Policies públicas (sistema usa autenticação local)
- ✅ Soft delete implementado
- ✅ Timestamps automáticos (created_at, updated_at)

### Índices Otimizados:
- ✅ `animais(brinco)` - Busca rápida por brinco
- ✅ `animais(fazenda_id)` - Filtro por fazenda
- ✅ `animais(fazenda_id, brinco)` - Combinação única
- ✅ `animais(status_id)` - Filtro por status
- ✅ `animais(tipo_id)` - Filtro por tipo
- ✅ `genealogias(animal_id)` - Busca de ancestrais

---

## 🧪 Checklist de Testes

### ✅ Testes Básicos:
- [ ] Abrir `/animais` - deve mostrar tela vazia
- [ ] Criar novo animal - preencher todos os campos
- [ ] Verificar tipos/status/origens padrão
- [ ] Testar cadastro rápido de tipo customizado
- [ ] Testar cadastro rápido de status customizado
- [ ] Associar tags a um animal
- [ ] Editar animal existente
- [ ] Excluir animal (soft delete)
- [ ] Filtrar por sexo, tipo, status
- [ ] Buscar por brinco/nome

### ✅ Testes Avançados:
- [ ] Sincronizar com Supabase
- [ ] Executar migração de nascimentos
- [ ] Verificar tags migradas
- [ ] Testar em múltiplos dispositivos
- [ ] Validar performance (não deve ter OOM)

---

## 📝 Próximos Passos

1. **AGORA (Teste)**:
   - Abrir `/animais` e testar funcionalidades
   - Criar alguns animais manualmente
   - Verificar se tudo funciona

2. **DEPOIS (Migração)**:
   - Executar script de migração
   - Validar dados migrados
   - Verificar tags e relacionamentos

3. **FUTURO (Transição Completa)**:
   - Atualizar `desmamas`, `pesagens`, `vacinacoes` para usar `animalId`
   - Depreciar rota `/planilha`
   - Remover tabela `nascimentos`

---

## 🎨 Interface

### Cores de Status (Padrão):
- 🟢 **Ativo**: Verde (#10b981)
- 🔵 **Vendido**: Azul (#3b82f6)
- 🔴 **Morto**: Vermelho (#ef4444)
- 🟠 **Transferido**: Laranja (#f59e0b)
- 🩷 **Doente**: Rosa (#ec4899)

### Ícone no Menu:
- 🐾 **PawPrint** (pata de animal)

---

**Data de Criação**: 20/01/2026  
**Status**: ✅ Implementado e pronto para testes  
**Versão**: 0.4.0 (quando for commitado)

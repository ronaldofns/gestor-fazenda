# 🐄 Migração: Nascimento → Animais

## 📋 Visão Geral

Este documento descreve a estratégia de migração completa do sistema de **Nascimento** para o novo sistema de **Animais**. A tabela `nascimentos` será gradualmente substituída pela tabela `animais`, que oferece uma estrutura mais robusta e flexível.

---

## ✅ Status Atual

### Tabelas Migradas
- ✅ **Desmama**: Adicionado `animalId` (opcional, mantém `nascimentoId` para compatibilidade)
- ✅ **Pesagem**: Adicionado `animalId` (opcional, mantém `nascimentoId` para compatibilidade)
- ✅ **Vacina**: Adicionado `animalId` (opcional, mantém `nascimentoId` para compatibilidade)

### Tabelas Principais
- ✅ **Animais**: Sistema completo implementado e funcional
- ⚠️ **Nascimentos**: Ainda em uso, será removido gradualmente

---

## 🎯 Estratégia de Migração

### Fase 1: Preparação (✅ Concluída)
- [x] Adicionar `animalId` às tabelas relacionadas (Desmama, Pesagem, Vacina)
- [x] Criar migrações Dexie e Supabase
- [x] Atualizar syncService para sincronizar `animalId`
- [x] Criar funções helper para vincular registros a animais

### Fase 2: Migração de Dados (🔄 Em Andamento)
- [x] Script de migração de Nascimentos → Animais (`migrarNascimentosParaAnimais.ts`)
- [x] Script de vinculação de Desmamas → Animais (`vincularDesmamasAAnimais.ts`)
- [ ] Script de vinculação de Pesagens → Animais
- [ ] Script de vinculação de Vacinas → Animais
- [ ] Validação e testes de integridade dos dados

### Fase 3: Atualização de Componentes (📋 Planejado)
- [ ] Atualizar `Home.tsx` para usar animais ao invés de nascimentos
- [ ] Atualizar `NascimentoModal.tsx` para criar animais diretamente
- [ ] Atualizar `CadastroDesmama.tsx` para usar `animalId`
- [ ] Atualizar componentes de Pesagem e Vacina
- [ ] Atualizar hooks (`useOptimizedQueries.ts`, etc.)

### Fase 4: Deprecação (📋 Futuro)
- [ ] Tornar `animalId` obrigatório nas interfaces
- [ ] Remover referências a `nascimentoId` dos componentes
- [ ] Atualizar validações para exigir `animalId`
- [ ] Remover tabela `nascimentos` do Dexie
- [ ] Remover tabela `nascimentos_online` do Supabase

---

## 📝 Mudanças nas Interfaces

### Desmama
```typescript
// ANTES
export interface Desmama {
  nascimentoId: string; // obrigatório
  animalId?: string; // não existia
}

// AGORA (Fase 1-2)
export interface Desmama {
  nascimentoId?: string; // opcional (compatibilidade)
  animalId?: string; // opcional (novo sistema)
}

// FUTURO (Fase 4)
export interface Desmama {
  animalId: string; // obrigatório
  // nascimentoId removido
}
```

### Pesagem e Vacina
Mesma estratégia aplicada a Desmama.

---

## 🔧 Funções Helper

### `encontrarAnimalPorNascimento(nascimentoId: string)`
Encontra o animal correspondente a um nascimento através de:
- Brinco + Fazenda + Data de Nascimento

### `vincularDesmamaAAnimal(desmamaId: string, nascimentoId: string)`
Vincula automaticamente uma desmama a um animal.

### `vincularDesmamasAAnimais()`
Script de migração em lote para vincular todas as desmamas existentes.

---

## 📊 Migração de Dados

### Scripts Disponíveis

1. **`migrarNascimentosParaAnimais.ts`**
   - Converte todos os nascimentos em animais
   - Preserva dados e relacionamentos
   - Cria genealogias quando possível

2. **`vincularDesmamasAAnimais.ts`**
   - Vincula desmamas existentes aos animais correspondentes
   - Busca por brinco + fazenda + data nascimento

### Execução

```typescript
// 1. Migrar nascimentos para animais
import { migrarNascimentosParaAnimais } from './utils/migrarNascimentosParaAnimais';
const resultado = await migrarNascimentosParaAnimais();

// 2. Vincular desmamas aos animais
import { vincularDesmamasAAnimais } from './utils/vincularDesmamasAAnimais';
const resultado = await vincularDesmamasAAnimais();
```

---

## 🗄️ Migrações de Banco de Dados

### Dexie (IndexedDB Local)
- **Versão 26**: Adiciona `animalId` a Desmamas
- **Versão 27**: Adiciona `animalId` a Pesagens e Vacinas (planejado)

### Supabase (PostgreSQL)
- **042_add_animal_id_to_desmamas.sql**: Adiciona `animal_id` a `desmamas_online`
- **043_add_animal_id_to_pesagens.sql**: Adiciona `animal_id` a `pesagens_online` (planejado)
- **044_add_animal_id_to_vacinacoes.sql**: Adiciona `animal_id` a `vacinacoes_online` (planejado)

---

## ⚠️ Considerações Importantes

### Compatibilidade
- Durante a transição, ambos os sistemas (`nascimentoId` e `animalId`) funcionarão simultaneamente
- Componentes devem priorizar `animalId` quando disponível, mas aceitar `nascimentoId` como fallback

### Performance
- Queries devem usar índices compostos `[animalId+synced]` quando possível
- Evitar joins desnecessários entre `nascimentos` e `animais`

### Integridade
- Validar que todos os registros relacionados tenham `animalId` antes de remover `nascimentoId`
- Manter auditoria de todas as migrações

---

## 📅 Cronograma Sugerido

1. **Semana 1-2**: Preparação (Fase 1) ✅
2. **Semana 3-4**: Migração de dados (Fase 2) 🔄
3. **Semana 5-6**: Atualização de componentes (Fase 3) 📋
4. **Semana 7-8**: Testes e validação 📋
5. **Semana 9+**: Deprecação gradual (Fase 4) 📋

---

## 🔍 Checklist de Migração

### Antes de Remover Nascimentos
- [ ] Todos os nascimentos migrados para animais
- [ ] Todas as desmamas vinculadas a animais
- [ ] Todas as pesagens vinculadas a animais
- [ ] Todas as vacinas vinculadas a animais
- [ ] Componentes atualizados para usar animais
- [ ] Testes de integridade passando
- [ ] Backup completo do banco de dados
- [ ] Documentação atualizada

---

## 📚 Referências

- [Sistema de Animais](./SISTEMA_ANIMAIS.md)
- [Migração de Nascimentos](./migrarNascimentosParaAnimais.ts)
- [Estrutura de Dados](./models.ts)

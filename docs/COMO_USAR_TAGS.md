# 🏷️ Como Usar Tags no Gestor Fazenda

## ✅ O que você já fez:
- ✅ Criou a tag "Leite" em **Configurações → Tags**

---

## ⚠️ **Status Atual da Integração**

O sistema de **Tags está 100% implementado** no backend, mas **ainda não está integrado visualmente** nos formulários de cadastro/edição.

### 📋 **O que está pronto:**
- ✅ Criar, editar e excluir tags
- ✅ Atribuir tags a: Nascimentos, Matrizes e Fazendas
- ✅ Buscar por tags
- ✅ Filtrar registros por tags
- ✅ Estatísticas de uso
- ✅ Exportar/Importar tags

### ❌ **O que falta integrar:**
- ❌ Campo "Tags" nos modais de **Nascimento**
- ❌ Campo "Tags" nos modais de **Matriz**
- ❌ Campo "Tags" nos modais de **Fazenda**
- ❌ Filtro por tags nas listagens
- ❌ Exibição visual das tags nos cards

---

## 🎯 **Como as Tags DEVEM Funcionar (após integração)**

### **Exemplo Prático:**

Você criou a tag **"Leite"** (verde) para identificar matrizes produtoras de leite.

#### **1. Ao Cadastrar/Editar uma Matriz:**
```
┌─────────────────────────────────────┐
│  Cadastrar Matriz                   │
├─────────────────────────────────────┤
│  Brinco: 001                        │
│  Nome: Mimosa                       │
│  Raça: Holandês                     │
│                                     │
│  Tags: [+] Adicionar tag            │
│  ┌───────────────────────────────┐  │
│  │ 🔍 Buscar ou criar...         │  │
│  ├───────────────────────────────┤  │
│  │ ✓ Leite          (verde)      │  │ ← Seleciona
│  │   Para Venda     (azul)       │  │
│  │   Prenha         (rosa)       │  │
│  └───────────────────────────────┘  │
│                                     │
│  Tags selecionadas:                 │
│  [ Leite × ]                        │ ← Mostra selecionadas
│                                     │
│  [Salvar]  [Cancelar]               │
└─────────────────────────────────────┘
```

#### **2. Na Listagem de Matrizes:**
```
┌──────────────────────────────────────────────┐
│  Matrizes                    🔍 [ Filtrar ]   │
├──────────────────────────────────────────────┤
│                                              │
│  001 - Mimosa      [ Leite ]                │ ← Tag visível
│  Holandês | Última cria: 10/01/2026         │
│                                              │
│  002 - Estrela     [ Para Venda ]           │
│  Nelore | Última cria: 05/12/2025           │
│                                              │
│  003 - Flor        [ Leite ] [ Prenha ]     │ ← Múltiplas tags
│  Jersey | Última cria: 20/11/2025           │
└──────────────────────────────────────────────┘
```

#### **3. Filtro por Tags:**
```
┌─────────────────────────────────────┐
│  Filtrar por:                       │
├─────────────────────────────────────┤
│  Tags:                              │
│  ☑ Leite (15)          ← 15 matrizes│
│  ☐ Para Venda (8)                   │
│  ☐ Prenha (23)                      │
│                                     │
│  [Aplicar Filtro]                   │
└─────────────────────────────────────┘
```

---

## 🛠️ **Onde Integrar (Desenvolvimento)**

### **Modais a Modificar:**

1. **`NascimentoModal.tsx`**
   - Adicionar campo multi-select de tags
   - Salvar com `assignTags(nascimentoId, 'nascimento', tagIds)`

2. **`MatrizModal.tsx`**
   - Adicionar campo multi-select de tags
   - Salvar com `assignTags(matrizId, 'matriz', tagIds)`

3. **`FazendaModal.tsx`**
   - Adicionar campo multi-select de tags
   - Salvar com `assignTags(fazendaId, 'fazenda', tagIds)`

### **Componente de Seleção de Tags:**
```tsx
import { useTags } from '../hooks/useTags';

function TagSelector({ 
  selectedTagIds, 
  onChange 
}: { 
  selectedTagIds: string[]; 
  onChange: (ids: string[]) => void; 
}) {
  const { tags } = useTags();
  
  return (
    <div>
      <label>Tags</label>
      {tags.map(tag => (
        <button
          key={tag.id}
          onClick={() => {
            if (selectedTagIds.includes(tag.id)) {
              onChange(selectedTagIds.filter(id => id !== tag.id));
            } else {
              onChange([...selectedTagIds, tag.id]);
            }
          }}
          style={{ 
            backgroundColor: selectedTagIds.includes(tag.id) ? tag.color : 'transparent',
            borderColor: tag.color
          }}
        >
          {tag.name}
        </button>
      ))}
    </div>
  );
}
```

---

## 💾 **Sincronização**

### **Situação Atual:**
- ⚠️ Tags são salvas no **localStorage** (local por dispositivo)
- ⚠️ AutoBackup configurações também são **locais**

### **Problema:**
Se você usa o sistema em:
- 🖥️ Computador do escritório
- 📱 Celular no campo
- 💻 Notebook em casa

**As tags criadas em um dispositivo NÃO aparecem nos outros!**

### **Solução Recomendada:**
1. Criar tabelas no Supabase:
   - `tags`
   - `tag_assignments`
   - `auto_backup_settings`

2. Sincronizar automaticamente (igual nascimentos/desmamas)

3. Permitir export/import manual (já existe)

---

## 📊 **Próximos Passos**

### **Para Usar Tags Agora (Manual):**
1. Criar tags em **Configurações → Tags**
2. Exportar tags (`tags-2026-01-20.json`)
3. Importar em outros dispositivos

### **Para Desenvolvimento:**
1. Integrar `TagSelector` nos modais
2. Adicionar exibição de tags nas listagens
3. Implementar filtros por tags
4. [Opcional] Sincronizar tags via Supabase

---

## 🎨 **Casos de Uso Sugeridos**

### **Para Nascimentos:**
- 🔵 "Lote 2025-A"
- 🟢 "Desmamado"
- 🔴 "Problema Saúde"
- 🟡 "Para Venda"

### **Para Matrizes:**
- 🟢 "Leite" *(você já criou!)*
- 🔵 "Corte"
- 🟣 "Reprodutora Elite"
- ⚫ "Descarte"
- 🔴 "Problema Reprodutivo"

### **Para Fazendas:**
- 🟢 "Principal"
- 🔵 "Confinamento"
- 🟡 "Cria e Recria"
- 🔴 "Desativada"

---

## ❓ **Dúvidas Comuns**

**P: Posso ter várias tags na mesma matriz?**
R: ✅ Sim! Uma matriz pode ter "Leite" + "Prenha" + "Lote A"

**P: As tags são compartilhadas entre dispositivos?**
R: ❌ Não automaticamente. Use Export/Import ou aguarde sincronização automática.

**P: Posso filtrar por múltiplas tags?**
R: ✅ Sim (após integração). Ex: "Leite" AND "Prenha"

**P: As tags são sincronizadas?**
R: ⚠️ Ainda não. São locais (localStorage). Recomendamos implementar sincronização.

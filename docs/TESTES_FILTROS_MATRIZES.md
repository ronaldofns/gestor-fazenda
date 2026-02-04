# Testes de Filtros - Card de Matrizes

## ✅ Correções Implementadas

### 1. **Problema Original**
- O card de "Matrizes" não respeitava o filtro de sexo quando combinado com filtro de tipo "Bezerro"
- Quando filtrava por "Fêmea" + "Bezerro", mostrava todas as mães (incluindo possíveis erros de dados)

### 2. **Correção Aplicada**
- Adicionada verificação de sexo nas matrizes quando há filtro de sexo ativo
- Lógica agora verifica se a matriz (mãe) também corresponde ao filtro de sexo selecionado

### 3. **Código Modificado**
Arquivo: `src/routes/Animais.tsx` - linhas 319-361

```typescript
if (isFiltroBezerra) {
  // Se filtrado por bezerros: mostrar as MÃES dos bezerros filtrados
  const matrizesCount = new Map<string, number>();
  
  animaisFiltrados.forEach(animal => {
    const genealogia = genealogiaMap.get(animal.id);
    const matrizId = genealogia?.matrizId || animal.matrizId;
    
    if (matrizId) {
      // ✅ NOVO: Verificar se a matriz respeita o filtro de sexo
      const animalMatriz = animaisMap.get(matrizId);
      if (animalMatriz) {
        if (filtroSexo && filtroSexo.trim() !== '' && animalMatriz.sexo !== filtroSexo) {
          return; // Pular esta matriz se não corresponder ao filtro de sexo
        }
        matrizesCount.set(matrizId, (matrizesCount.get(matrizId) || 0) + 1);
      }
    }
  });
  // ... resto do código
}
```

## 📋 Cenários de Teste

### **Teste 1: Filtro Fêmea apenas** ✅ ATUAL
**Aplicado:** Sexo = Fêmea

**Comportamento Esperado:**
- Card "Matrizes" deve mostrar quantas **fêmeas têm filhos registrados**
- Agrupadas por tipo (Vaca, Novilha, etc.)

**Como verificar:**
1. Veja o total no card "Matrizes"
2. Veja o detalhamento por tipo abaixo do total
3. Todos os valores devem ser de animais fêmeas que são mães

---

### **Teste 2: Filtro Bezerro apenas**
**Aplicar:** Sexo = (vazio), Tipo = Bezerro(a)

**Comportamento Esperado:**
- Card "Matrizes" deve mostrar as **mães de todos os bezerros** (machos e fêmeas)
- Agrupadas por tipo da mãe

**Como verificar:**
1. Total deve representar quantas mães únicas têm bezerros
2. Detalhamento mostra o tipo de cada mãe

---

### **Teste 3: Filtro Fêmea + Bezerro**
**Aplicar:** Sexo = Fêmea, Tipo = Bezerro(a)

**Comportamento Esperado:**
- Card "Matrizes" deve mostrar apenas as **mães fêmeas das bezerras**
- Se houver mães marcadas incorretamente como "Macho" no banco, elas NÃO serão contadas

**Como verificar:**
1. Total deve ser <= ao total do Teste 2
2. Apenas mães que são fêmeas devem aparecer

---

### **Teste 4: Filtro Vaca apenas**
**Aplicar:** Sexo = (vazio), Tipo = Vaca

**Comportamento Esperado:**
- Card "Matrizes" deve mostrar quantas **vacas têm filhos registrados**

**Como verificar:**
1. Total no card deve ser o número de vacas que são mães
2. Detalhamento deve mostrar "Vaca: X"

---

### **Teste 5: Filtro Fêmea + Vaca**
**Aplicar:** Sexo = Fêmea, Tipo = Vaca

**Comportamento Esperado:**
- Card "Matrizes" deve mostrar quantas **vacas fêmeas têm filhos registrados**
- Como "Vaca" é biologicamente fêmea, o resultado deve ser igual ao Teste 4 (se os dados estiverem corretos)

**Como verificar:**
1. Total deve ser igual (ou muito próximo) ao Teste 4
2. Se for diferente, pode indicar dados inconsistentes (vacas marcadas como macho)

---

## 🎯 Lógica Final Implementada

### **Quando NÃO é filtro de bezerro:**
```
Card Matrizes = Quantos animais FILTRADOS são matrizes (têm filhos)
```
- `animaisFiltrados` já está filtrado por sexo/tipo/etc.
- Verifica se cada animal tem filhos (está no set `animaisMatrizes`)
- Agrupa por tipo

### **Quando É filtro de bezerro:**
```
Card Matrizes = Mães dos bezerros FILTRADOS (respeitando filtro de sexo)
```
- Busca a mãe (matrizId) de cada bezerro filtrado
- **✅ NOVO:** Verifica se a mãe também corresponde ao filtro de sexo (se ativo)
- Conta mães únicas
- Agrupa por tipo da mãe

---

## ⚠️ Observações Importantes

1. **Dados Inconsistentes**: Se houver animais marcados com sexo errado no banco de dados (ex: uma "Vaca" marcada como "Macho"), o filtro agora vai evidenciar essa inconsistência.

2. **Bezerros sem Mãe**: Bezerros que não têm `matrizId` cadastrado não serão contados no card de Matrizes.

3. **Duplicação**: Uma mesma mãe pode ter múltiplos filhos, mas será contada apenas uma vez no card.

---

## 📊 Status dos Testes

- [x] Teste 1: Fêmea apenas - **EM ANDAMENTO**
- [ ] Teste 2: Bezerro apenas
- [ ] Teste 3: Fêmea + Bezerro
- [ ] Teste 4: Vaca apenas
- [ ] Teste 5: Fêmea + Vaca

---

**Data:** 2026-01-28
**Arquivo modificado:** `src/routes/Animais.tsx`
**Linhas alteradas:** 319-361

# Manual de Filtros Avançados

Sistema completo de filtros customizáveis para facilitar a análise de dados.

---

## 🎯 O que são Filtros Avançados?

Os Filtros Avançados permitem criar consultas complexas nos seus dados combinando múltiplas condições. Você pode salvar filtros frequentes para reutilização rápida.

---

## 🚀 Como Usar

### 1. Abrir o Painel de Filtros
Clique no botão **"Filtros"** na barra de ferramentas (disponível em páginas com listagem).

### 2. Criar uma Condição
1. Clique em **"Adicionar Condição"**
2. Selecione o **campo** que deseja filtrar
3. Escolha o **operador** (igual a, contém, maior que, etc.)
4. Digite ou selecione o **valor**

### 3. Adicionar Múltiplas Condições
- Clique novamente em **"Adicionar Condição"**
- Todas as condições usam lógica **AND** (todas devem ser verdadeiras)

### 4. Aplicar o Filtro
Clique em **"Aplicar Filtros"** para ver os resultados.

### 5. Salvar para Reutilizar (Opcional)
1. Clique em **"Salvar este filtro"**
2. Digite um nome descritivo
3. Adicione uma descrição (opcional)
4. Clique em **"Salvar"**

---

## 🔧 Operadores Disponíveis

### Texto
- **Igual a** - Valor exato
- **Contém** - Texto contém o valor (case insensitive)
- **Começa com** - Texto inicia com o valor
- **Termina com** - Texto termina com o valor

### Números
- **Igual a** - Valor exato
- **Maior que** - Valor maior que o especificado
- **Menor que** - Valor menor que o especificado
- **Entre** - Valor dentro de um intervalo

### Datas
- **Igual a** - Data exata
- **Depois de** - Datas posteriores
- **Antes de** - Datas anteriores
- **Entre** - Datas dentro de um período

### Seleção (Sim/Não)
- **Igual a** - Valor específico
- **É um de** - Valor está em uma lista
- **Não é nenhum de** - Valor não está em uma lista

---

## 📁 Filtros Salvos

### Gerenciar Filtros Salvos
Acesse a aba **"Salvos"** para ver todos os filtros salvos.

Cada filtro mostra:
- Nome e descrição
- Número de condições
- Quantas vezes foi usado
- Data de criação

### Ações Disponíveis
- ⭐ **Favoritar** - Marca como favorito para acesso rápido
- ✅ **Carregar** - Aplica o filtro aos dados
- 📋 **Duplicar** - Cria uma cópia para editar
- 🗑️ **Excluir** - Remove o filtro

---

## ⭐ Filtros Favoritos

Marque seus filtros mais usados como favoritos para acesso ainda mais rápido na aba **"Favoritos"**.

---

## 🕒 Filtros Recentes

A aba **"Recentes"** mostra os últimos 5 filtros que você usou, ordenados pela data de uso.

---

## 📤 Exportar/Importar

### Exportar Filtros
1. Vá para a aba **"Salvos"**
2. Clique em **"Exportar"**
3. Um arquivo JSON será baixado com todos os seus filtros

### Importar Filtros
1. Vá para a aba **"Salvos"**
2. Clique em **"Importar"**
3. Selecione o arquivo JSON de filtros
4. Os filtros serão adicionados aos existentes (não substituem)

**Uso:** Compartilhe filtros com outros usuários ou faça backup.

---

## 💡 Exemplos Práticos

### Exemplo 1: Animais Nascidos em 2025
```
Campo: ano
Operador: Igual a
Valor: 2025
```

### Exemplo 2: Desmamas Acima de 180kg
```
Campo: pesoDesmama
Operador: Maior que
Valor: 180
```

### Exemplo 3: Novilhas com Desmama Pendente
```
Condição 1:
  Campo: tipo
  Operador: Igual a
  Valor: novilha

Condição 2:
  Campo: dataDesmama
  Operador: Igual a
  Valor: [vazio]
```

### Exemplo 4: Animais da Raça Nelore Nascidos em Novembro/2025
```
Condição 1:
  Campo: raca
  Operador: Contém
  Valor: Nelore

Condição 2:
  Campo: mes
  Operador: Igual a
  Valor: 11

Condição 3:
  Campo: ano
  Operador: Igual a
  Valor: 2025
```

---

## 🎓 Dicas Avançadas

### 1. Filtros Incrementais
Comece com filtros simples e adicione condições aos poucos para refinar os resultados.

### 2. Nomear Filtros Descritivos
Use nomes claros como "Animais desmamados em 2025" ao invés de "Filtro 1".

### 3. Adicionar Descrições
Descreva o propósito do filtro para lembrar no futuro: "Usado para relatório mensal de produtividade".

### 4. Favoritar os Mais Usados
Marque como favorito os filtros que você usa semanalmente para acesso rápido.

### 5. Duplicar para Criar Variações
Ao invés de criar do zero, duplique um filtro similar e ajuste.

---

## ⚡ Performance

### Filtros Otimizados
O sistema usa:
- **Memoização** para evitar recalcular filtros
- **Índices compostos** no IndexedDB para buscas rápidas
- **Lazy evaluation** - filtros só são aplicados quando necessário

### Dicas para Melhor Performance
- ✅ Use operadores específicos quando possível (`equals` é mais rápido que `contains`)
- ✅ Combine filtros de campos indexados (fazenda, data, synced)
- ✅ Evite muitos filtros simultâneos com operador `contains`

---

## 🔍 Busca vs Filtros

**Quando usar Busca Global:**
- Procurar por texto livre
- Buscar em múltiplos campos ao mesmo tempo
- Busca rápida e simples

**Quando usar Filtros Avançados:**
- Consultas específicas e precisas
- Múltiplas condições combinadas
- Filtros que você vai reutilizar
- Análises complexas

---

## 🆘 Troubleshooting

### Filtro não retorna resultados
1. Verifique se todas as condições estão corretas
2. Tente remover condições uma por uma para identificar o problema
3. Certifique-se de que o valor está no formato correto (especialmente datas)

### Filtro muito lento
1. Reduza o número de condições com operador `contains`
2. Use campos indexados quando possível
3. Considere filtrar por fazenda primeiro

### Filtro salvo não aparece
1. Verifique se salvou corretamente (mensagem de sucesso)
2. Verifique na aba "Salvos"
3. Use a busca se tiver muitos filtros

---

**Versão:** 0.3.0  
**Última atualização:** 19/01/2026

# 🚀 Proposta: Dashboard Moderna Baseada em Animais

## 📊 **Situação Atual**

A dashboard atual (`src/routes/Dashboard.tsx`) usa dados da tabela `nascimentos`, que está sendo descontinuada em favor da tabela `animais`.

### **Problemas Identificados:**
- ❌ Usa tabela `nascimentos` (descontinuada)
- ❌ Métricas limitadas a nascimentos/desmamas
- ❌ Não reflete a realidade atual do rebanho
- ❌ Falta métricas de gestão zootécnica moderna

---

## 🎯 **Nova Dashboard - Métricas Propostas**

### **1. Visão Geral do Rebanho (Cards Principais)**

#### **Card: Total de Animais**
- Total de animais vivos
- Variação este mês (+ ou -)
- Comparativo com mês anterior

#### **Card: Distribuição por Tipo**
- Vacas, Novilhas, Bezerros, Touros, Garrotes
- Percentual de cada tipo

#### **Card: Distribuição por Sexo**
- Fêmeas vs Machos
- Percentual e gráfico visual

#### **Card: Taxa de Prenhez**
- % de fêmeas reprodutivas prenhas
- Meta vs Real

#### **Card: Matrizes Ativas**
- Quantas fêmeas têm filhos registrados
- Taxa de fertilidade

#### **Card: Taxa de Mortalidade**
- % de mortes no período
- Comparativo com mês anterior

---

### **2. Métricas de Produtividade**

#### **Card: GMD Médio (Ganho Médio Diário)**
- Peso médio por categoria
- Evolução no tempo

#### **Card: Produtividade de Desmama**
- Taxa de desmama (animais desmamados / nascidos)
- Peso médio à desmama

#### **Card: Intervalo Entre Partos (IEP)**
- Média de dias entre partos por matriz
- Meta: 365-400 dias

#### **Card: Taxa de Desfrute**
- Animais vendidos/abatidos vs rebanho total
- % anual

---

### **3. Saúde e Manejo**

#### **Card: Vacinação em Dia**
- % de animais com vacinas em dia
- Alertas de vacinas vencendo

#### **Card: Pesagens Recentes**
- Animais pesados nos últimos 30 dias
- % do rebanho monitorado

#### **Card: Alertas de Saúde**
- Animais com peso abaixo do esperado
- Animais sem pesagem há mais de 90 dias

---

### **4. Análise Financeira (Futuro)**

#### **Card: Valor do Rebanho**
- Estimativa baseada em peso x valor/kg
- Evolução no tempo

#### **Card: Custo por Animal/Dia**
- Custos totais / número de animais
- Comparativo com média do setor

---

### **5. Gráficos Interativos**

#### **Gráfico 1: Evolução do Rebanho**
- Linha temporal dos últimos 12 meses
- Total de animais por mês

#### **Gráfico 2: Pirâmide Etária**
- Distribuição por faixa etária
- Bezerros (0-12m), Jovens (12-24m), Adultos (24+m)

#### **Gráfico 3: Peso Médio por Categoria**
- Barras comparativas por tipo de animal
- Evolução mensal

#### **Gráfico 4: Distribuição por Fazenda**
- Comparativo de performance entre fazendas
- Nascimentos, Mortes, GMD, etc.

#### **Gráfico 5: Mapa de Calor - Nascimentos**
- Meses com mais nascimentos
- Padrões sazonais

#### **Gráfico 6: Taxa de Prenhez por Matriz**
- Top 10 matrizes mais produtivas
- Número de filhos vivos

---

### **6. Alertas e Notificações**

#### **Alerta: Desmama Atrasada**
- Bezerros com +8 meses sem desmama

#### **Alerta: Matriz Improdutiva**
- Fêmeas reprodutivas sem parto há +18 meses

#### **Alerta: Peso Crítico**
- Animais abaixo de 70% do peso esperado

#### **Alerta: Vacinas Vencidas**
- Animais com vacinas atrasadas

#### **Alerta: Mortalidade Alta**
- Fazendas com taxa > 5% no mês

---

## 🏗️ **Estrutura da Nova Dashboard**

```
Dashboard/
├── Header (Resumo de Alertas)
├── Section 1: Cards de Métricas Principais (4-6 cards)
├── Section 2: Gráficos de Tendência (2 gráficos lado a lado)
├── Section 3: Análise por Categoria (cards + gráficos)
├── Section 4: Performance por Fazenda (tabela + gráfico)
├── Section 5: Top Performers (rankings)
└── Footer: Links rápidos e exportação
```

---

## 📐 **Design Moderno**

### **Características:**
- ✅ Gradiente suave de fundo
- ✅ Cards com sombra e hover effects
- ✅ Ícones coloridos por categoria
- ✅ Gráficos responsivos (Recharts)
- ✅ Animações sutis
- ✅ Dark mode totalmente suportado
- ✅ Layout responsivo (mobile-first)

### **Paleta de Cores:**
- 🟢 Verde: Crescimento, saúde positiva
- 🔵 Azul: Informações gerais
- 🟣 Roxo: Reprodução, genética
- 🔴 Vermelho: Alertas, problemas
- 🟠 Laranja: Avisos, atenção
- 🟡 Amarelo: Metas, monitoramento

---

## 🔄 **Migração de Dados**

### **Tabelas Utilizadas:**

1. **animais** (principal)
   - Total de animais
   - Distribuição por tipo, sexo, status
   - Data de nascimento (idade)

2. **genealogias**
   - Matrizes e reprodutores
   - Linhagens
   - Intervalo entre partos

3. **pesagens**
   - GMD (ganho médio diário)
   - Evolução de peso
   - Animais abaixo do peso

4. **vacinacoes**
   - Status de vacinação
   - Alertas de vacinas vencendo

5. **desmamas**
   - Taxa de desmama
   - Peso à desmama
   - Alertas de desmama atrasada

6. **status_animal**
   - Prenhez, venda, morte, etc.

---

## 🚀 **Implementação**

### **Fase 1: Métricas Básicas** ✅ (A fazer primeiro)
- Cards principais (total, tipos, sexo)
- Gráfico de evolução do rebanho
- Distribuição por fazenda

### **Fase 2: Métricas de Produtividade**
- GMD, IEP, Taxa de desmama
- Gráficos de peso e performance

### **Fase 3: Alertas e Notificações**
- Sistema de alertas inteligente
- Dashboard de notificações

### **Fase 4: Análise Avançada**
- Comparativos históricos
- Projeções e tendências
- Benchmarking entre fazendas

---

## 📱 **Funcionalidades Extras**

### **Filtros:**
- Por fazenda
- Por período (últimos 30/60/90 dias, ano, custom)
- Por categoria de animal
- Por status

### **Exportação:**
- PDF com snapshot da dashboard
- Excel com dados detalhados
- CSV para análise externa

### **Comparativos:**
- Comparar fazendas
- Comparar períodos
- Comparar com metas

---

## 🎨 **Wireframe (Conceito)**

```
┌─────────────────────────────────────────────────────┐
│  [📊 Dashboard - Gestor Fazenda]          [Filtros] │
├─────────────────────────────────────────────────────┤
│  🔔 Resumo de Alertas: 3 pendentes       [Ver todos]│
├─────────────────────────────────────────────────────┤
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐           │
│  │ 1.234│  │  65% │  │  890 │  │ 95%  │           │
│  │Animais│  │Fêmeas│  │Matrices│  │Vacinados│      │
│  └──────┘  └──────┘  └──────┘  └──────┘           │
├─────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐          │
│  │ Evolução Rebanho│  │ GMD por Categoria│         │
│  │ (Gráfico Linha) │  │ (Gráfico Barras) │         │
│  └─────────────────┘  └─────────────────┘          │
├─────────────────────────────────────────────────────┤
│  Performance por Fazenda                           │
│  ┌─────────────────────────────────────────┐      │
│  │ Tabela + Gráficos comparativos          │      │
│  └─────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────┘
```

---

## ✅ **Próximos Passos**

1. ✅ Aprovar proposta com o usuário
2. 🔨 Criar hook `useRebanhoMetrics` para calcular métricas
3. 🔨 Implementar nova Dashboard.tsx
4. 🔨 Adicionar gráficos interativos
5. 🔨 Sistema de filtros
6. 🔨 Testes e validação

---

**Data:** 2026-01-28  
**Autor:** AI Assistant  
**Status:** Proposta aguardando aprovação

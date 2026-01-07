# 🧹 Como Limpar o Cache do Build na Vercel

## Método 1: Redeploy Sem Cache (Mais Fácil e Confiável)

1. Acesse [vercel.com](https://vercel.com) e faça login
2. Selecione seu projeto **gestor-fazenda**
3. Vá na aba **"Deployments"** (Deployments)
4. Encontre o último deployment (o mais recente)
5. Clique nos **três pontos (⋯)** no canto superior direito do card do deployment
6. Selecione **"Redeploy"**
7. **IMPORTANTE**: Na janela que abrir, **DESMARQUE** a opção **"Use existing Build Cache"** ou **"Use Build Cache"**
8. Clique em **"Redeploy"**

Isso forçará um build completamente novo, sem usar o cache anterior.

## Método 2: Via CLI da Vercel (Recomendado)

Como você já tem a Vercel CLI instalada, este é o método mais direto:

### 1. Fazer login (se ainda não estiver logado):
```bash
vercel login
```

### 2. Fazer deploy forçando novo build (sem cache):
```bash
# No diretório do projeto
cd d:\Projetos\gestor-fazenda

# Fazer deploy sem usar cache
vercel --force
```

O flag `--force` força um novo build sem usar o cache.

### 3. Ou fazer deploy de produção sem cache:
```bash
vercel --prod --force
```

## Método 3: Variável de Ambiente (Mais Eficaz)

A Vercel reconhece uma variável de ambiente especial para forçar builds sem cache:

1. Vá em **Settings** → **Environment Variables**
2. Adicione uma variável:
   - **Name**: `VERCEL_FORCE_NO_BUILD_CACHE`
   - **Value**: `1`
   - Selecione os ambientes (Production, Preview, Development)
3. Clique em **"Save"**
4. Faça um novo deploy (push para o repositório ou clique em "Redeploy")
5. **Depois pode remover a variável** (não é necessária permanentemente)

Esta variável força a Vercel a ignorar o cache de build completamente.

## Método 4: Via Git (Forçar Novo Deploy)

1. Faça uma pequena alteração em qualquer arquivo (ex: adicione um espaço em branco)
2. Faça commit e push:
```bash
git add .
git commit -m "chore: force rebuild"
git push
```
3. Isso disparará um novo build na Vercel automaticamente

## ⚠️ Importante

- Limpar o cache pode fazer o build demorar mais na primeira vez
- O cache ajuda a acelerar builds subsequentes
- Use apenas quando necessário (como agora, para resolver o erro de PWA)

## 🔍 Verificar se Funcionou

Após limpar o cache e fazer um novo deploy, verifique:
- O build deve completar sem erros
- O arquivo `assets/index-*.js` deve ser menor ou estar dentro do limite de 10 MB
- O service worker deve ser gerado corretamente


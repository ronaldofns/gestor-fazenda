# Configuração de Deploy na Vercel

## 📋 Estratégia de Branches

### Branch `main` (Produção)
- ✅ Branch principal para produção
- ✅ Vercel faz deploy automaticamente desta branch
- ✅ Apenas código testado e estável

### Branch `develop` (Desenvolvimento)
- 🔧 Branch para desenvolvimento e testes
- 🔧 Não faz deploy automático na Vercel
- 🔧 Use para testar antes de fazer merge para `main`

## 🚀 Como Publicar na Vercel

### Opção 1: Deploy Automático (Recomendado)
1. A Vercel já está configurada para fazer deploy da branch `main`
2. Sempre que você fizer `git push origin main`, a Vercel fará deploy automaticamente
3. Não precisa fazer nada manualmente

### Opção 2: Configurar na Vercel (se ainda não configurou)
1. Acesse: https://vercel.com/dashboard
2. Selecione seu projeto
3. Vá em **Settings** → **Git**
4. Em **Production Branch**, selecione: `main`
5. Em **Ignored Build Step**, deixe vazio (ou adicione condições se necessário)
6. Salve as alterações

## 📝 Workflow Recomendado

### Para Desenvolvimento:
```bash
# 1. Trabalhar na branch develop
git checkout develop
# ... fazer alterações ...
git add .
git commit -m "feat: nova funcionalidade"
git push origin develop
```

### Para Publicar em Produção:
```bash
# 1. Voltar para main
git checkout main

# 2. Fazer merge das alterações de develop (quando estiver pronto)
git merge develop

# 3. Fazer push (Vercel fará deploy automaticamente)
git push origin main
```

### Ou fazer commit direto em main (se for pequena alteração):
```bash
# 1. Estar na branch main
git checkout main

# 2. Fazer alterações e commit
git add .
git commit -m "fix: correção rápida"
git push origin main
```

## ⚙️ Configurações da Vercel

### Build Settings:
- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### Environment Variables:
- Configure as variáveis de ambiente necessárias (SUPABASE_URL, etc.)

## 🔒 Segurança

- ✅ Branch `main` é protegida (produção)
- ✅ Branch `develop` é para testes
- ✅ Sempre teste em `develop` antes de fazer merge para `main`


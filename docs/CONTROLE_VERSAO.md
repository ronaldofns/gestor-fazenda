# 📦 Controle de Versão

## Como Funciona

O sistema de controle de versão está integrado ao aplicativo e exibe a versão atual no **footer da sidebar**.

### Onde a Versão é Definida (fonte única)

A versão é definida **apenas** em:

1. **`package.json`** - Versão principal do projeto (fonte única)
   ```json
   {
    "version": "0.2.0"
   }
   ```

O valor é injetado no app via Vite e consumido em `src/utils/version.ts`.

### Onde a Versão é Exibida

A versão aparece no **footer da Sidebar**, logo abaixo do botão "Sair":
- **Sidebar expandida**: Mostra `v0.2.0`
- **Sidebar recolhida**: Mostra apenas `v0.2.0` (com tooltip ao passar o mouse)

## Como Atualizar a Versão

### 1. Atualizar `package.json`

```json
{
  "version": "0.2.0"  // Nova versão
}
```

### 2. Fazer Commit e Push

```bash
git add package.json
git commit -m "chore: atualizar versão para 0.2.0"
git push
```

## Convenção de Versionamento (Semantic Versioning)

Recomendamos usar **Semantic Versioning** (SemVer):

- **MAJOR** (1.0.0): Mudanças incompatíveis com versões anteriores
- **MINOR** (0.1.0): Novas funcionalidades compatíveis
- **PATCH** (0.0.1): Correções de bugs compatíveis

### Exemplos:

- `0.2.0` → `0.2.1`: Correção de bug
- `0.2.0` → `0.3.0`: Nova funcionalidade
- `0.2.0` → `1.0.0`: Versão estável ou mudança incompatível

## Verificar Versão em Produção

1. Abra a aplicação
2. Veja o footer da sidebar (parte inferior)
3. A versão está exibida como `v0.2.0`

## Tags Git (Opcional)

Para marcar versões específicas no Git:

```bash
# Criar tag
git tag -a v0.2.0 -m "Versão 0.2.0"

# Enviar tag para o repositório
git push origin v0.2.0

# Listar todas as tags
git tag

# Ver informações de uma tag
git show v0.2.0
```

## Vercel e Deploy

A Vercel automaticamente:
- Detecta mudanças no `package.json`
- Faz deploy quando você faz push para a branch `main`
- A versão exibida na aplicação será sempre a última versão publicada

## Dicas

- ✅ **Atualize apenas o `package.json`**
- ✅ **Use commits descritivos** quando atualizar a versão
- ✅ **Considere criar tags Git** para versões importantes
- ✅ **Mantenha a versão sincronizada** entre os dois arquivos


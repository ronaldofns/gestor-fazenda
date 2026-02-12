# get-supabase-token

Edge Function que emite JWT para o frontend usar com Supabase (RLS).

**Fluxo:** Frontend → esta função (com `Authorization: Bearer <EDGE_FUNCTION_SECRET>`) → retorna `{ token, exp }` → Frontend injeta o token nas requisições ao PostgREST.

O **JWT Secret** fica apenas nos secrets do projeto; o frontend nunca o vê.

## Deploy

```bash
supabase functions deploy get-supabase-token
```

## Secrets

É obrigatório definir **EDGE_FUNCTION_SECRET** e **um** dos dois modos de assinatura.

### Modo A: ES256 (recomendado para RLS – evita PGRST301)

A Data API valida JWT pelo JWKS (só chaves assimétricas). Para a Edge Function emitir token aceito e usar RLS com `auth.uid()`:

1. **Gerar chave:** `supabase gen signing-key --algorithm ES256` (na raiz do projeto). Guarde o JWK completo (contém `kty`, `kid`, `crv`, `x`, `y`, `d`).
2. **Importar no Dashboard:** Project Settings → JWT → JWT Signing Keys → Add new key → Import. Cole o JWK (com ou sem `d`, conforme o Dashboard aceitar). Anote o **Key ID** (`kid`).
3. **Secrets (Edge Functions → Secrets):** `EDGE_FUNCTION_SECRET`, `JWT_SIGNING_ES256_JWK` = JWK completo em uma linha (JSON minificado), `JWT_SIGNING_KEY_ID` = o `kid` da chave.
4. **Rotate keys** no JWT Signing Keys para a chave importada ser a atual.
5. No frontend: `VITE_SUPABASE_USE_JWT_RLS=true`, `VITE_USE_EDGE_FUNCTION_JWT=true`, `VITE_EDGE_FUNCTION_SECRET=...`.

### Modo B: HS256 (Legacy)

Só funciona se o projeto ainda aceitar JWT com Legacy JWT Secret (senão ocorre PGRST301).

| Nome | Valor |
|------|--------|
| `EDGE_FUNCTION_SECRET` | String forte; mesmo valor em `VITE_EDGE_FUNCTION_SECRET`. |
| `JWT_SIGNING_SECRET` | Legacy JWT Secret (Project Settings → JWT). |
| `JWT_SIGNING_KEY_ID` | (Opcional) Key ID da chave Legacy HS256. |

`SUPABASE_URL` é injetado automaticamente.

## Request

- **Método:** POST
- **Headers:** `Authorization: Bearer <EDGE_FUNCTION_SECRET>`, `Content-Type: application/json`
- **Body:** `{ "userId": "uuid-do-usuario", "email": "opcional" }`
- **Resposta 200:** `{ "token": "eyJ...", "exp": 1234567890 }`

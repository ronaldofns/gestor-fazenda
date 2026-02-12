# Segurança de senha no Supabase Auth

## Aviso: Leaked Password Protection Disabled

Se o Dashboard do Supabase exibir o aviso **"Leaked Password Protection Disabled"** (proteção contra senhas vazadas desativada), ative no projeto hospedado:

### Como ativar (projeto na nuvem)

1. Acesse o [Dashboard do Supabase](https://supabase.com/dashboard) e abra seu projeto.
2. No menu lateral: **Authentication** → **Providers**.
3. Clique no provedor **Email**.
4. Na seção **Password security** (ou configurações de segurança de senha):
   - Ative **"Prevent use of leaked passwords"** / **"Leaked password protection"**.
   - (Opcional) Ajuste o tamanho mínimo da senha (recomendado: 8 ou mais).
   - (Opcional) Defina requisitos de caracteres (maiúsculas, minúsculas, números, símbolos).

**Documentação:** [Password security – Supabase](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

**Requisito:** Proteção contra senhas vazadas (HaveIBeenPwned) está disponível no **Pro Plan** e superiores. Em planos gratuitos, o aviso pode continuar aparecendo e a opção pode não estar disponível.

### Ambiente local (config.toml)

No `supabase/config.toml` já estão definidos:

- `minimum_password_length = 8`
- `password_requirements = "lower_upper_letters_digits_symbols"`

A verificação contra senhas vazadas (HaveIBeenPwned) no ambiente local depende da versão do GoTrue; no projeto na nuvem ela é ativada apenas pelo Dashboard, como acima.

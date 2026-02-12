// Edge Function: emite JWT para o frontend usar com Supabase (RLS).
// Fluxo: Frontend → esta função (com segredo) → retorna JWT → Frontend usa JWT nas requisições ao Supabase.
// O JWT Secret fica apenas no servidor (secrets do projeto).

import { SignJWT, importJWK, base64url } from "npm:jose@6";

const DEFAULT_EXPIRY_SECONDS = 10800; // 3 horas

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-edge-function-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: object, status: number, headers?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders, ...headers },
  });
}

const PAYLOAD_CLAIMS = (iss: string, userId: string, email: string, now: number, exp: number) => ({
  sub: userId,
  role: "authenticated",
  aud: "authenticated",
  scope: "sync",
  exp,
  iat: now,
  iss,
  aal: "aal1",
  session_id: userId + "-" + now,
  email: email ?? "",
  phone: "",
  is_anonymous: false,
});

/** Assina com ES256 usando JWK privado (EC P-256). Aceito pela Data API via JWKS. */
async function createJWTES256(
  userId: string,
  email: string,
  supabaseUrl: string,
  privateJwkJson: string,
  keyId?: string
): Promise<string> {
  const iss = supabaseUrl ? `${supabaseUrl.replace(/\/$/, "")}/auth/v1` : "https://supabase.co/auth/v1";
  const now = Math.floor(Date.now() / 1000);
  const exp = now + DEFAULT_EXPIRY_SECONDS;
  const payload = PAYLOAD_CLAIMS(iss, userId, email, now, exp);
  const jwk = JSON.parse(privateJwkJson) as Record<string, unknown>;
  const kid = (keyId ?? jwk.kid) as string | undefined;
  if (!kid) throw new Error("ES256 JWK deve ter 'kid' ou use JWT_SIGNING_KEY_ID");
  const key = await importJWK(jwk, "ES256");
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "ES256", typ: "JWT", kid })
    .setIssuer(iss)
    .setIssuedAt(payload.iat)
    .setExpirationTime(payload.exp)
    .setSubject(userId)
    .sign(key);
}

/** Assina com HS256 (Legacy). Só aceito pela Data API se o projeto ainda tiver chave HS256 ativa. */
function createJWTHS256(userId: string, email: string, supabaseUrl: string, secret: string, keyId?: string): Promise<string> {
  const iss = supabaseUrl ? `${supabaseUrl.replace(/\/$/, "")}/auth/v1` : "https://supabase.co/auth/v1";
  const now = Math.floor(Date.now() / 1000);
  const exp = now + DEFAULT_EXPIRY_SECONDS;
  const payload = PAYLOAD_CLAIMS(iss, userId, email, now, exp);

  let secretBytes: Uint8Array;
  try {
    const base64 = secret.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64);
    secretBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) secretBytes[i] = binary.charCodeAt(i);
  } catch {
    secretBytes = new TextEncoder().encode(secret);
  }
  const jwk = { kty: "oct", k: base64url.encode(secretBytes), alg: "HS256" };
  return importJWK(jwk, "HS256").then((key) =>
    new SignJWT({ ...payload })
      .setProtectedHeader({ alg: "HS256", typ: "JWT", ...(keyId ? { kid: keyId } : {}) })
      .setIssuer(iss)
      .setIssuedAt(payload.iat)
      .setExpirationTime(payload.exp)
      .setSubject(userId)
      .sign(key)
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido" }, 405);
  }

  const expectedSecret = Deno.env.get("EDGE_FUNCTION_SECRET");
  const jwtSecret = Deno.env.get("JWT_SIGNING_SECRET");
  const jwtEs256Jwk = Deno.env.get("JWT_SIGNING_ES256_JWK");
  const jwtKeyId = Deno.env.get("JWT_SIGNING_KEY_ID");
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

  if (!expectedSecret) {
    return jsonResponse({ error: "Configuração do servidor incompleta", missing: ["EDGE_FUNCTION_SECRET"] }, 500);
  }
  const useEs256 = !!jwtEs256Jwk && jwtEs256Jwk.trim().length > 0;
  const useHs256 = !!jwtSecret && jwtSecret.trim().length > 0;
  if (!useEs256 && !useHs256) {
    return jsonResponse(
      { error: "Defina JWT_SIGNING_ES256_JWK (para RLS com JWKS) ou JWT_SIGNING_SECRET (Legacy HS256)" },
      500
    );
  }

  // Aceita como na doc: Authorization: Bearer <EDGE_FUNCTION_SECRET> ou X-Edge-Function-Secret (retrocompat).
  const authHeader = req.headers.get("Authorization");
  const bearerSecret = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const customSecret = req.headers.get("X-Edge-Function-Secret");
  const authorized = bearerSecret === expectedSecret || customSecret === expectedSecret;
  if (!authorized) {
    return jsonResponse({ error: "Não autorizado" }, 401);
  }

  let body: { userId?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Body JSON inválido" }, 400);
  }

  const userId = body?.userId;
  if (!userId || typeof userId !== "string") {
    return jsonResponse({ error: "userId é obrigatório" }, 400);
  }

  const email = typeof body?.email === "string" ? body.email : "";

  try {
    const jwt = useEs256
      ? await createJWTES256(userId, email, supabaseUrl, jwtEs256Jwk!, jwtKeyId ?? undefined)
      : await createJWTHS256(userId, email, supabaseUrl, jwtSecret!, jwtKeyId ?? undefined);
    const exp = Math.floor(Date.now() / 1000) + DEFAULT_EXPIRY_SECONDS;
    return jsonResponse({ token: jwt, exp });
  } catch (e) {
    console.error("Erro ao criar JWT:", e);
    return jsonResponse({ error: "Erro ao gerar token" }, 500);
  }
});

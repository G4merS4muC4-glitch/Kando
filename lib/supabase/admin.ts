import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente do Supabase com a chave de servico (service role). USO SO NO SERVIDOR
 * (Route Handlers). Ele ignora o RLS, entao nunca pode ser exposto ao navegador.
 *
 * A chave vem de SUPABASE_SERVICE_ROLE_KEY (variavel de ambiente server-only,
 * sem o prefixo NEXT_PUBLIC). Se nao estiver configurada, devolve null e o
 * endpoint responde "indisponivel".
 */
export function criarClienteAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) return null;
  return createClient(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Segredo para assinar o cookie de PIN. Para nao usar a service role direto
 * (que e a chave-mestra do banco), usa um segredo dedicado SHARE_COOKIE_SECRET
 * se existir; senao, deriva uma chave de uso unico por hash da service role
 * (mao unica: vazar o cookie nao revela a service role). Assim a assinatura do
 * cookie nunca e a propria chave-mestra.
 */
export function segredoAssinatura(): string {
  const dedicado = process.env.SHARE_COOKIE_SECRET;
  if (dedicado) return dedicado;
  const sr = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!sr) return "";
  return crypto.createHash("sha256").update(`kando-share-cookie-v1:${sr}`).digest("hex");
}

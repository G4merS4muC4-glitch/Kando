import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente do Supabase para uso no navegador.
 *
 * O app funciona em dois modos:
 * - Sem as variaveis de ambiente do Supabase: usa localStorage (uso local,
 *   sem login nem dados compartilhados).
 * - Com as variaveis configuradas: usa o banco do Supabase e exige login.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CHAVE = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Indica se o Supabase esta configurado (variaveis de ambiente presentes). */
export function supabaseConfigurado(): boolean {
  return Boolean(URL && CHAVE);
}

// Mantem uma unica instancia do cliente no navegador.
let clienteUnico: ReturnType<typeof createBrowserClient> | null = null;

/** Cria (ou reaproveita) o cliente do Supabase no navegador. */
export function criarClienteNavegador() {
  if (!supabaseConfigurado()) {
    throw new Error("Supabase nao configurado (defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY).");
  }
  if (!clienteUnico) {
    clienteUnico = createBrowserClient(URL as string, CHAVE as string);
  }
  return clienteUnico;
}

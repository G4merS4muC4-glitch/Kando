import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Diagnostico temporario: diz se as variaveis de ambiente do servidor estao
 * presentes (apenas true/false, NUNCA o valor). Serve para checar se a
 * SUPABASE_SERVICE_ROLE_KEY chegou no deploy. Pode ser removido depois.
 */
export async function GET() {
  const sr = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return NextResponse.json({
    urlSupabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    serviceRolePresente: sr.length > 0,
    serviceRoleTamanho: sr.length, // so o tamanho, nunca o conteudo
    cookieSecretDedicado: Boolean(process.env.SHARE_COOKIE_SECRET),
  });
}

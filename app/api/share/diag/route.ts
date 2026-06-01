import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Diagnostico temporario: diz se as variaveis de ambiente do servidor estao
 * presentes (apenas true/false e tamanho, NUNCA o valor). Remover apos resolver.
 */
export async function GET() {
  const sr = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return NextResponse.json({
    urlSupabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    serviceRolePresente: sr.length > 0,
    serviceRoleTamanho: sr.length,
    cookieSecretDedicado: Boolean(process.env.SHARE_COOKIE_SECRET),
  });
}

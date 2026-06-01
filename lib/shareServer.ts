import crypto from "node:crypto";

/**
 * Helpers SO-DO-SERVIDOR do compartilhamento (usam node:crypto). Nunca importar
 * no navegador. Servem para assinar e validar o cookie que prova que o visitante
 * acertou o PIN, sem precisar guardar sessao no banco.
 */

/** Assinatura HMAC do par token+pin_hash com o segredo do servidor. */
export function assinarPinCookie(token: string, pinHash: string, segredo: string): string {
  return crypto.createHmac("sha256", segredo).update(`${token}:${pinHash}`).digest("hex");
}

/** Confere o cookie de PIN em tempo constante. */
export function pinCookieValido(
  token: string,
  pinHash: string,
  valor: string,
  segredo: string
): boolean {
  if (!valor || !segredo) return false;
  const esperado = assinarPinCookie(token, pinHash, segredo);
  const a = Buffer.from(valor);
  const b = Buffer.from(esperado);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

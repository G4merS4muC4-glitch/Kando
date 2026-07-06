"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Memoria (por aparelho) da ultima campanha aberta, para o menu "Campanhas"
 * voltar para onde o usuario estava em vez de sempre cair na lista. Guardado no
 * localStorage: quando abre um quadro de campanha, grava o id; quando volta para
 * a lista, limpa (assim "Campanhas" respeita o ultimo lugar visto na secao).
 */
const CHAVE = "kando:ultima-campanha";

export function gravarUltimaCampanha(id: string): void {
  try {
    window.localStorage.setItem(CHAVE, id);
  } catch {
    // sem localStorage: apenas nao lembra
  }
}

export function limparUltimaCampanha(): void {
  try {
    window.localStorage.removeItem(CHAVE);
  } catch {
    // ignora
  }
}

export function lerUltimaCampanha(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}

/** Le a ultima campanha aberta, re-lendo a cada troca de rota. */
export function useUltimaCampanha(): string | null {
  const caminho = usePathname();
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    setId(lerUltimaCampanha());
  }, [caminho]);
  return id;
}

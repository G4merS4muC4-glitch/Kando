"use client";

import { useEffect, useState } from "react";

// Mesmo criterio do breakpoint "espacoso" do Tailwind: largura de desktop E altura
// suficiente. Fora disso (celular em pe ou deitado) o app usa o layout de celular.
const CONSULTA_ESPACOSO = "(min-width: 640px) and (min-height: 500px)";

/**
 * Diz se a tela esta no layout de celular. Devolve null ate medir no cliente
 * (quem usa pode esperar, em vez de piscar o layout errado na primeira pintura).
 */
export function useEhCelular(): boolean | null {
  const [celular, setCelular] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia(CONSULTA_ESPACOSO);
    const aplicar = () => setCelular(!mq.matches);
    aplicar();
    mq.addEventListener("change", aplicar);
    return () => mq.removeEventListener("change", aplicar);
  }, []);
  return celular;
}

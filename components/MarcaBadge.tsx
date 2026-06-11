"use client";

import { useBoard } from "@/lib/store";
import type { Marca } from "@/lib/types";

/** Etiqueta colorida que identifica a marca da organizacao. */
export default function MarcaBadge({
  marca,
  tamanho = "normal",
}: {
  marca: Marca;
  tamanho?: "normal" | "pequeno";
}) {
  const { marcaPorId } = useBoard();
  const conf = marcaPorId(marca);
  const ehPequeno = tamanho === "pequeno";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-marca font-bold uppercase tracking-wide text-white ${
        ehPequeno ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs"
      }`}
      style={{ backgroundColor: conf.cor }}
    >
      <span
        className="inline-block rounded-full bg-white/90"
        style={{ width: ehPequeno ? 5 : 6, height: ehPequeno ? 5 : 6 }}
        aria-hidden
      />
      {conf.nome}
    </span>
  );
}

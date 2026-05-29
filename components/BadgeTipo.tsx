import { TIPOS } from "@/lib/config";
import type { TipoConteudo } from "@/lib/types";

/** Badge colorido com icone que identifica o tipo de conteudo do card. */
export default function BadgeTipo({
  tipo,
  tamanho = "normal",
}: {
  tipo: TipoConteudo;
  tamanho?: "normal" | "pequeno";
}) {
  const conf = TIPOS[tipo];
  // Defensivo: se vier um tipo desconhecido (ex: JSON externo de metricas com um
  // valor inesperado), nao renderiza o selo em vez de quebrar a tela.
  if (!conf) return null;
  const Icone = conf.icone;
  const ehPequeno = tamanho === "pequeno";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-marca font-semibold uppercase tracking-wide text-white ${
        ehPequeno ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs"
      }`}
      style={{ backgroundColor: conf.cor }}
    >
      <Icone size={ehPequeno ? 12 : 14} strokeWidth={2.4} aria-hidden />
      {conf.label}
    </span>
  );
}

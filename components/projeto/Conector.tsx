import { ChevronRight } from "lucide-react";

/**
 * Conector entre duas fases, dando a sensacao de fluxo (estilo Miro).
 * No desktop e uma seta para a direita; no mobile a coluna empilha, entao o
 * mesmo icone gira para baixo sobre uma linha guia. Fica laranja quando a fase
 * anterior esta 100% concluida ("o fluxo avancou").
 */
export default function Conector({ aceso }: { aceso: boolean }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center self-stretch py-1 sm:w-7 sm:py-0"
      title="A seta acende quando as fases anteriores estão concluídas"
      aria-hidden
    >
      {/* Mobile: linha guia vertical atras do icone. */}
      <div className="relative flex h-6 w-full items-center justify-center sm:h-auto sm:w-auto">
        <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-marca-cinza/30 sm:hidden" />
        <ChevronRight
          size={20}
          strokeWidth={2.4}
          className={`relative rotate-90 transition-colors sm:rotate-0 ${
            aceso ? "animate-pop text-marca-laranja" : "text-marca-cinza/60"
          }`}
        />
      </div>
    </div>
  );
}

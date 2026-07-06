"use client";

import { useEffect, useState } from "react";
import { X, Clock, Hourglass, Save } from "lucide-react";
import {
  CONFIG_AUTO_PARADA_PADRAO,
  lerConfigAutoParada,
  salvarConfigAutoParada,
  type ConfigAutoParada,
} from "@/lib/autoParada";

const inputClasse =
  "rounded-marca border border-marca-cinza/40 bg-white px-2.5 py-1.5 text-sm text-marca-preto outline-none transition focus:border-marca-laranja focus:ring-2 focus:ring-marca-laranja/40";

/**
 * Janela de configuracoes de tempo (por aparelho): define quando o cronometro
 * para sozinho, para nao ficar rodando esquecido de madrugada. Vale um horario
 * do dia e/ou um maximo de horas seguidas, o que vier primeiro.
 */
export default function ModalConfigTempo({ onFechar }: { onFechar: () => void }) {
  const [cfg, setCfg] = useState<ConfigAutoParada>(CONFIG_AUTO_PARADA_PADRAO);

  useEffect(() => {
    setCfg(lerConfigAutoParada());
  }, []);

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", aoTeclar);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", aoTeclar);
    };
  }, [onFechar]);

  function salvar() {
    salvarConfigAutoParada(cfg);
    // Avisa o provider para reconferir o limite na hora (nao esperar o proximo ciclo).
    window.dispatchEvent(new Event("kando:auto-parada"));
    onFechar();
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-stretch justify-center bg-marca-preto/50 p-0 animate-fadeIn sm:items-center sm:p-4"
      onClick={onFechar}
      role="dialog"
      aria-modal="true"
      aria-label="Configurações de tempo"
    >
      <div
        className="flex h-full w-full flex-col overflow-hidden bg-white shadow-modal sm:h-auto sm:max-h-[90vh] sm:max-w-md sm:rounded-marca"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 bg-marca-azulEscuro px-5 py-4 text-white">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-marca bg-marca-laranja">
              <Clock size={16} aria-hidden />
            </span>
            <div>
              <p className="text-xs uppercase tracking-wide text-white/70">Cronômetro</p>
              <h2 className="text-base font-bold">Configurações de tempo</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="rounded-marca p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            <X size={20} aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <p className="text-sm text-marca-cinza">
            Para o cronômetro não ficar rodando esquecido de madrugada, ele pode parar sozinho. As
            regras valem o que vier primeiro; o tempo é gravado até o limite. (Configuração deste
            aparelho.)
          </p>

          {/* Parar num horario do dia */}
          <div className="rounded-marca border border-marca-cinza/30 p-3">
            <label className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={cfg.pararNoHorario}
                onChange={(e) => setCfg((c) => ({ ...c, pararNoHorario: e.target.checked }))}
                className="h-4 w-4 accent-marca-laranja"
              />
              <span className="flex items-center gap-1.5 text-sm font-semibold text-marca-azulEscuro">
                <Clock size={15} aria-hidden /> Parar automaticamente às
              </span>
            </label>
            <div className="mt-2 pl-7">
              <input
                type="time"
                value={cfg.horario}
                disabled={!cfg.pararNoHorario}
                onChange={(e) => setCfg((c) => ({ ...c, horario: e.target.value }))}
                className={`${inputClasse} w-32 disabled:cursor-not-allowed disabled:opacity-40`}
              />
              <p className="mt-1 text-xs text-marca-cinza">
                Se o timer passar desse horário, ele encerra nele.
              </p>
            </div>
          </div>

          {/* Parar apos X horas seguidas */}
          <div className="rounded-marca border border-marca-cinza/30 p-3">
            <label className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={cfg.pararAposHoras}
                onChange={(e) => setCfg((c) => ({ ...c, pararAposHoras: e.target.checked }))}
                className="h-4 w-4 accent-marca-laranja"
              />
              <span className="flex items-center gap-1.5 text-sm font-semibold text-marca-azulEscuro">
                <Hourglass size={15} aria-hidden /> Parar após rodar por
              </span>
            </label>
            <div className="mt-2 flex items-center gap-2 pl-7">
              <input
                type="number"
                min={1}
                max={48}
                value={cfg.maxHoras}
                disabled={!cfg.pararAposHoras}
                onChange={(e) =>
                  setCfg((c) => ({
                    ...c,
                    maxHoras: Math.max(1, Math.min(48, Number(e.target.value) || 1)),
                  }))
                }
                className={`${inputClasse} w-20 text-center disabled:cursor-not-allowed disabled:opacity-40`}
              />
              <span className="text-sm text-marca-preto">horas seguidas</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-marca-cinza/30 bg-marca-branco px-5 py-3">
          <button
            type="button"
            onClick={onFechar}
            className="rounded-marca px-4 py-2 text-sm font-semibold text-marca-cinza transition hover:text-marca-azulEscuro"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            className="flex items-center gap-1.5 rounded-marca bg-marca-laranja px-4 py-2 text-sm font-bold text-white transition hover:brightness-95"
          >
            <Save size={16} aria-hidden /> Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

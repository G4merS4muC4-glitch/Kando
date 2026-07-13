"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Lightbulb, Loader2, Link2, Check, AlertTriangle, Send } from "lucide-react";
import { criarClienteNavegador, supabaseConfigurado } from "@/lib/supabase/client";

type Estado = "carregando" | "ok" | "inexistente" | "revogado" | "indisponivel" | "erro" | "enviado";

type Destino = {
  campanhaId: string;
  nome: string;
  marcaNome: string | null;
  marcaCor: string | null;
};

const COR_KANDO = "#FA611E";
const inputClasse =
  "w-full rounded-marca border border-marca-cinza/40 bg-white px-3 py-2.5 text-sm text-marca-preto outline-none transition focus:border-marca-laranja focus:ring-2 focus:ring-marca-laranja/40";

/**
 * Pagina publica de sugestao de ideias (sem login obrigatorio). Um colega manda
 * uma ideia de video com link de referencia; ela cai como card (sugestao externa)
 * na coluna inicial da campanha escolhida. Quando o link tem mais de um destino,
 * a pessoa escolhe para qual empresa/campanha (pelos nomes definidos por quem
 * compartilhou). Quem esta logado no Kando aparece identificado.
 */
export default function PaginaSugerir() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";

  const [estado, setEstado] = useState<Estado>("carregando");
  const [destinos, setDestinos] = useState<Destino[]>([]);
  const [destinoSel, setDestinoSel] = useState<string>(""); // campanhaId escolhido

  const [titulo, setTitulo] = useState("");
  const [referencia, setReferencia] = useState("");
  const [descricao, setDescricao] = useState("");
  const [nome, setNome] = useState("");
  const [emailLogado, setEmailLogado] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Resolve o link (destinos) e descobre se ha alguem logado no Kando.
  useEffect(() => {
    let ativo = true;
    fetch(`/api/sugestao/${token}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!ativo) return;
        setEstado(j.estado as Estado);
        if (j.estado === "ok") {
          const ds = (j.destinos as Destino[]) ?? [];
          setDestinos(ds);
          setDestinoSel(ds[0]?.campanhaId ?? "");
        }
      })
      .catch(() => ativo && setEstado("erro"));

    if (supabaseConfigurado()) {
      try {
        criarClienteNavegador()
          .auth.getUser()
          .then((res: { data: { user: { email?: string | null } | null } }) => {
            const e = res.data.user?.email;
            if (ativo && e) {
              setEmailLogado(e);
              setNome(e);
            }
          });
      } catch {
        // sem login: segue como visitante
      }
    }
    return () => {
      ativo = false;
    };
  }, [token]);

  const sel = destinos.find((d) => d.campanhaId === destinoSel) ?? destinos[0] ?? null;

  const enviar = useCallback(async () => {
    setErro(null);
    if (!titulo.trim()) {
      setErro("Escreva o título da ideia.");
      return;
    }
    setEnviando(true);
    try {
      const r = await fetch(`/api/sugestao/${token}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ titulo, descricao, referenciaUrl: referencia, nome, campanhaId: destinoSel }),
      });
      const j = await r.json();
      if (j.ok) {
        setEstado("enviado");
      } else {
        setErro(j.erro || "Não foi possível enviar.");
      }
    } catch {
      setErro("Não foi possível enviar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }, [token, titulo, descricao, referencia, nome, destinoSel]);

  const cor = sel?.marcaCor ?? COR_KANDO;

  if (estado === "carregando") {
    return <Centro><Loader2 size={28} className="animate-spin text-marca-cinza" aria-hidden /></Centro>;
  }
  if (estado === "inexistente" || estado === "revogado" || estado === "indisponivel" || estado === "erro") {
    const msg =
      estado === "revogado"
        ? "Este link de sugestões foi desativado."
        : estado === "indisponivel"
          ? "Este link está temporariamente indisponível."
          : "Link de sugestões inválido.";
    return (
      <Centro>
        <AlertTriangle size={28} className="text-marca-cinza" aria-hidden />
        <p className="max-w-xs text-sm text-marca-cinza">{msg}</p>
      </Centro>
    );
  }
  if (estado === "enviado") {
    return (
      <Centro>
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-marca-verdeClaro text-marca-verde">
          <Check size={30} aria-hidden />
        </span>
        <h1 className="text-lg font-bold text-marca-azulEscuro">Ideia enviada!</h1>
        <p className="max-w-xs text-sm text-marca-cinza">
          Obrigado. Sua sugestão chegou ao time{sel?.nome ? ` · ${sel.nome}` : ""}.
        </p>
        <button
          type="button"
          onClick={() => {
            setTitulo("");
            setReferencia("");
            setDescricao("");
            setEstado("ok");
          }}
          className="mt-2 rounded-marca bg-marca-laranja px-4 py-2 text-sm font-bold text-white transition hover:brightness-95"
        >
          Enviar outra ideia
        </button>
      </Centro>
    );
  }

  const varios = destinos.length > 1;

  return (
    <div className="min-h-dvh bg-marca-branco">
      <div className="h-1.5 w-full" style={{ backgroundColor: cor }} />
      <div className="mx-auto max-w-lg px-4 py-6 sm:px-6">
        {/* Cabecalho Kando */}
        <div className="mb-5 flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/kando-logo.svg" alt="" aria-hidden className="h-8 w-8 shrink-0 object-contain" />
          <span className="flex items-baseline gap-1.5 leading-none">
            <span className="font-titulo text-lg font-bold uppercase tracking-wide text-marca-azulEscuro">
              Kando
            </span>
            <span className="text-[11px] font-medium tracking-wide text-marca-cinza">by Brusoft</span>
          </span>
        </div>

        <div className="rounded-marca border border-marca-cinza/30 bg-white p-5 shadow-card">
          <h1 className="flex items-center gap-2 text-xl font-bold text-marca-azulEscuro">
            <Lightbulb size={22} style={{ color: cor }} aria-hidden />
            Sugira uma ideia
          </h1>
          <p className="mt-1 text-sm text-marca-cinza">
            {varios
              ? "Escolha para quem é a ideia e mande sua sugestão de vídeo, com o link da referência se tiver."
              : `${sel ? `Para ${sel.nome}. ` : ""}Mande sua ideia de vídeo e, se tiver, o link da referência onde você viu.`}
          </p>

          <div className="mt-4 space-y-3.5">
            {varios && (
              <Campo rotulo="Para qual?">
                <div className="flex flex-wrap gap-2">
                  {destinos.map((d) => {
                    const ativo = d.campanhaId === destinoSel;
                    return (
                      <button
                        key={d.campanhaId}
                        type="button"
                        onClick={() => setDestinoSel(d.campanhaId)}
                        className={`flex items-center gap-1.5 rounded-marca border px-3 py-2 text-sm font-semibold transition ${
                          ativo
                            ? "border-transparent text-white"
                            : "border-marca-cinza/40 bg-white text-marca-preto hover:border-marca-cinza"
                        }`}
                        style={ativo ? { backgroundColor: d.marcaCor ?? COR_KANDO } : undefined}
                      >
                        {d.marcaCor && (
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: ativo ? "rgba(255,255,255,0.9)" : d.marcaCor }}
                            aria-hidden
                          />
                        )}
                        {d.nome}
                      </button>
                    );
                  })}
                </div>
              </Campo>
            )}

            <Campo rotulo="Sua ideia">
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                maxLength={200}
                autoFocus
                className={inputClasse}
                placeholder="Ex: Reels mostrando 3 erros comuns de TI"
              />
            </Campo>

            <Campo rotulo="Link de referência (opcional)">
              <div className="relative">
                <Link2
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-marca-cinza"
                  aria-hidden
                />
                <input
                  type="url"
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  maxLength={600}
                  className={`${inputClasse} pl-9`}
                  placeholder="cole o link do vídeo/post de referência"
                />
              </div>
            </Campo>

            <Campo rotulo="Detalhes (opcional)">
              <textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                maxLength={4000}
                className={`${inputClasse} min-h-[90px] resize-y`}
                placeholder="O que mostrar, gancho, por que funciona..."
              />
            </Campo>

            <Campo rotulo="Seu nome">
              {emailLogado ? (
                <p className="flex items-center gap-1.5 rounded-marca border border-marca-cinza/30 bg-marca-branco px-3 py-2.5 text-sm text-marca-preto">
                  <Check size={15} className="text-marca-verde" aria-hidden />
                  Identificado como <strong>{emailLogado}</strong>
                </p>
              ) : (
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  maxLength={80}
                  className={inputClasse}
                  placeholder="Como o time vai te reconhecer (opcional)"
                />
              )}
            </Campo>

            {erro && (
              <p
                className="rounded-marca px-3 py-2 text-sm font-medium text-white"
                style={{ backgroundColor: "#EC1313" }}
              >
                {erro}
              </p>
            )}

            <button
              type="button"
              onClick={enviar}
              disabled={enviando}
              className="flex w-full items-center justify-center gap-2 rounded-marca bg-marca-laranja px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {enviando ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Send size={16} aria-hidden />}
              Enviar ideia
            </button>
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] text-marca-cinza/70">
          Kando by Brusoft · sua ideia vira um card no quadro do time.
        </p>
      </div>
    </div>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-marca-azulEscuro">
        {rotulo}
      </span>
      {children}
    </label>
  );
}

function Centro({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-marca-branco px-6 text-center">
      {children}
    </div>
  );
}

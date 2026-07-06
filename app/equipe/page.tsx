"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Users,
  UserPlus,
  Trash2,
  Copy,
  Check,
  Loader2,
  ShieldCheck,
  KeyRound,
  AlertTriangle,
} from "lucide-react";
import { useOrg } from "@/lib/orgProvider";
import { supabaseConfigurado } from "@/lib/supabase/client";
import {
  listarEquipe,
  criarLogin,
  removerLogin,
  type MembroEquipe,
  type ResultadoCriarLogin,
} from "@/lib/equipe";

/**
 * Tela de gerenciamento de logins da organizacao (so o dono). Cria contas novas
 * pelo proprio app (sem o painel do Supabase); cada conta nova recebe uma senha
 * temporaria unica, que a pessoa troca no primeiro acesso. So no modo online.
 */
export default function PaginaEquipe() {
  const { orgId, orgAtiva, pronto } = useOrg();
  const ehDono = orgAtiva?.papel === "dono";
  const online = supabaseConfigurado();

  const [membros, setMembros] = useState<MembroEquipe[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [criando, setCriando] = useState(false);
  const [erroCriar, setErroCriar] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoCriarLogin | null>(null);
  const [copiado, setCopiado] = useState(false);

  const recarregar = useCallback(async () => {
    if (!orgId || !online || !ehDono) return;
    setCarregando(true);
    setErroLista(null);
    try {
      setMembros(await listarEquipe(orgId));
    } catch (e) {
      setErroLista(e instanceof Error ? e.message : "Falha ao carregar a equipe.");
    } finally {
      setCarregando(false);
    }
  }, [orgId, online, ehDono]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    setErroCriar(null);
    setResultado(null);
    setCopiado(false);
    setCriando(true);
    try {
      const r = await criarLogin(orgId, email, nome);
      setResultado(r);
      setEmail("");
      setNome("");
      await recarregar();
    } catch (err) {
      setErroCriar(err instanceof Error ? err.message : "Falha ao criar o login.");
    } finally {
      setCriando(false);
    }
  }

  async function remover(m: MembroEquipe) {
    if (!orgId) return;
    if (!window.confirm(`Remover o acesso de ${m.email}?`)) return;
    try {
      await removerLogin(orgId, m.userId);
      await recarregar();
    } catch (err) {
      setErroLista(err instanceof Error ? err.message : "Falha ao remover.");
    }
  }

  function copiarAcesso() {
    if (!resultado?.senhaTemporaria) return;
    const texto = `Acesso ao Kando by Brusoft\nE-mail: ${resultado.email}\nSenha temporária: ${resultado.senhaTemporaria}\nTroque a senha no primeiro acesso.`;
    navigator.clipboard?.writeText(texto).then(
      () => {
        setCopiado(true);
        window.setTimeout(() => setCopiado(false), 2500);
      },
      () => {
        /* sem clipboard: ignora */
      }
    );
  }

  return (
    <div className="h-full min-w-0 overflow-y-auto overflow-x-hidden">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <div className="mb-5">
          <h1 className="flex items-center gap-2 font-titulo text-2xl font-bold uppercase tracking-wide text-marca-azulEscuro">
            <Users size={22} aria-hidden /> Equipe
          </h1>
          <p className="text-sm text-marca-cinza">
            Crie e gerencie os logins de quem acessa {orgAtiva?.nome ? `a ${orgAtiva.nome}` : "a organização"}.
          </p>
        </div>

        {!online ? (
          <Aviso icone={<AlertTriangle size={16} aria-hidden />}>
            O gerenciamento de logins funciona apenas na versão online (publicada). No uso local não
            há login.
          </Aviso>
        ) : !pronto ? (
          <p className="text-sm text-marca-cinza">Carregando...</p>
        ) : !ehDono ? (
          <Aviso icone={<ShieldCheck size={16} aria-hidden />}>
            Apenas o dono da organização pode gerenciar os logins.
          </Aviso>
        ) : (
          <div className="space-y-6">
            {/* Criar novo login */}
            <section className="rounded-marca border border-marca-cinza/30 bg-white p-4 shadow-card">
              <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-marca-azulEscuro">
                <UserPlus size={15} aria-hidden /> Criar novo login
              </h2>
              <form onSubmit={enviar} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="block min-w-0 flex-1">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-marca-cinza">
                    E-mail
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="pessoa@brusoft.inf.br"
                    className="w-full rounded-marca border border-marca-cinza/40 bg-white px-3 py-2 text-sm text-marca-preto outline-none transition focus:border-marca-laranja focus:ring-2 focus:ring-marca-laranja/40"
                  />
                </label>
                <label className="block min-w-0 flex-1">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-marca-cinza">
                    Nome (opcional)
                  </span>
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Nome da pessoa"
                    className="w-full rounded-marca border border-marca-cinza/40 bg-white px-3 py-2 text-sm text-marca-preto outline-none transition focus:border-marca-laranja focus:ring-2 focus:ring-marca-laranja/40"
                  />
                </label>
                <button
                  type="submit"
                  disabled={criando}
                  className="flex shrink-0 items-center justify-center gap-1.5 rounded-marca bg-marca-laranja px-4 py-2 text-sm font-bold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {criando ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <UserPlus size={15} aria-hidden />}
                  Criar
                </button>
              </form>

              {erroCriar && (
                <p className="mt-3 rounded-marca px-3 py-2 text-sm font-medium text-white" style={{ backgroundColor: "#EC1313" }}>
                  {erroCriar}
                </p>
              )}

              {/* Resultado: credenciais para enviar (so aparece uma vez) */}
              {resultado?.senhaTemporaria ? (
                <div className="mt-3 rounded-marca border border-marca-verde/50 bg-marca-verdeClaro p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-marca-verdeEscuro">
                    <KeyRound size={15} aria-hidden /> Login criado. Envie estes dados para a pessoa:
                  </p>
                  <div className="rounded-marca bg-white p-3 text-sm text-marca-preto">
                    <p>
                      <span className="text-marca-cinza">E-mail:</span> <strong>{resultado.email}</strong>
                    </p>
                    <p>
                      <span className="text-marca-cinza">Senha temporária:</span>{" "}
                      <strong className="font-mono">{resultado.senhaTemporaria}</strong>
                    </p>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-[11px] text-marca-cinza">
                      No primeiro acesso, a pessoa vai definir a própria senha.
                    </p>
                    <button
                      type="button"
                      onClick={copiarAcesso}
                      className="flex shrink-0 items-center gap-1.5 rounded-marca border border-marca-cinza/40 px-2.5 py-1.5 text-xs font-semibold text-marca-azulEscuro transition hover:border-marca-azulEscuro"
                    >
                      {copiado ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
                      {copiado ? "Copiado" : "Copiar acesso"}
                    </button>
                  </div>
                </div>
              ) : resultado ? (
                <p className="mt-3 rounded-marca border border-marca-cinza/30 bg-marca-branco px-3 py-2 text-sm text-marca-preto">
                  {resultado.jaMembro
                    ? "Essa pessoa já tem acesso a esta organização."
                    : "Essa pessoa já tinha conta no Kando e foi adicionada. Ela entra com a senha dela."}
                </p>
              ) : null}
            </section>

            {/* Lista de acessos */}
            <section className="rounded-marca border border-marca-cinza/30 bg-white p-4 shadow-card">
              <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-marca-azulEscuro">
                <Users size={15} aria-hidden /> Quem tem acesso ({membros.length})
              </h2>
              {erroLista && (
                <p className="mb-3 rounded-marca px-3 py-2 text-sm font-medium text-white" style={{ backgroundColor: "#EC1313" }}>
                  {erroLista}
                </p>
              )}
              {carregando ? (
                <p className="text-sm text-marca-cinza">Carregando...</p>
              ) : membros.length === 0 ? (
                <p className="rounded-marca border border-dashed border-marca-cinza/40 px-3 py-6 text-center text-sm text-marca-cinza">
                  Ninguém ainda. Crie o primeiro login acima.
                </p>
              ) : (
                <ul className="divide-y divide-marca-cinza/20">
                  {membros.map((m) => (
                    <li key={m.userId} className="flex items-center gap-3 py-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-marca-branco text-sm font-bold uppercase text-marca-azulEscuro">
                        {m.email.charAt(0)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-marca-preto">{m.email}</p>
                        <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-marca-cinza">
                          {m.papel === "dono" ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-marca-azulEscuro">
                              <ShieldCheck size={12} aria-hidden /> Dono
                            </span>
                          ) : (
                            <span>Membro</span>
                          )}
                          {m.senhaTemporaria && (
                            <span className="inline-flex items-center gap-1 rounded-marca bg-marca-laranja/15 px-1.5 py-0.5 font-semibold text-marca-laranja">
                              <KeyRound size={11} aria-hidden /> Aguardando 1º acesso
                            </span>
                          )}
                        </p>
                      </div>
                      {m.papel !== "dono" && (
                        <button
                          type="button"
                          onClick={() => remover(m)}
                          aria-label={`Remover ${m.email}`}
                          title="Remover acesso"
                          className="shrink-0 rounded-marca p-2 text-marca-cinza transition hover:bg-marca-branco hover:text-marca-vermelho"
                        >
                          <Trash2 size={16} aria-hidden />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function Aviso({ icone, children }: { icone: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-marca border border-marca-cinza/30 bg-white p-4 text-sm text-marca-cinza shadow-card">
      <span className="mt-0.5 shrink-0 text-marca-azulEscuro">{icone}</span>
      <p>{children}</p>
    </div>
  );
}

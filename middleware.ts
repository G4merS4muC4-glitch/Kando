import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Protege as rotas quando o Supabase esta configurado: sem sessao, redireciona
 * para /login. Se o Supabase NAO estiver configurado (uso local com
 * localStorage), nao protege nada e o app funciona normalmente.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Rotas publicas: o painel do visitante (/c/...) e seus endpoints (/api/share).
  // Nao exigem login (o controle de acesso e por token/PIN dentro do endpoint).
  if (pathname.startsWith("/c/") || pathname.startsWith("/api/share")) {
    return NextResponse.next();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Sem Supabase: modo local, sem login.
  if (!url || !chave) {
    return NextResponse.next();
  }

  let resposta = NextResponse.next({ request: req });

  const supabase = createServerClient(url, chave, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookies) {
        cookies.forEach(({ name, value }) => req.cookies.set(name, value));
        resposta = NextResponse.next({ request: req });
        cookies.forEach(({ name, value, options }) => resposta.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ehLogin = req.nextUrl.pathname.startsWith("/login");

  // Helper: redireciona preservando os cookies de sessao renovados pelo getUser
  // (sem isso, o token atualizado se perde e ocorre loop de login).
  function redirecionarPara(caminho: string) {
    const destino = req.nextUrl.clone();
    destino.pathname = caminho;
    const redir = NextResponse.redirect(destino);
    resposta.cookies.getAll().forEach((cookie) => redir.cookies.set(cookie));
    return redir;
  }

  // Sem sessao e fora do login: manda para o login.
  if (!user && !ehLogin) {
    return redirecionarPara("/login");
  }

  // Com sessao tentando ver o login: manda para a tela inicial.
  if (user && ehLogin) {
    return redirecionarPara("/");
  }

  return resposta;
}

export const config = {
  // Roda em todas as rotas, menos arquivos estaticos e as imagens da marca.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brusoft-.*\\.png).*)"],
};

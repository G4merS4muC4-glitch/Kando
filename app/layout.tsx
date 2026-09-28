import type { Metadata, Viewport } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Kando by Brusoft",
  description: "Kando: painel de gestão de conteúdo de redes sociais da Brusoft e Evotalks",
  // O iPhone nao usa SVG na tela de inicio: pede um PNG opaco de 180x180 (o K
  // laranja sobre o azul da marca; os cantos ele mesmo arredonda). Sem isso ele
  // gera um "K" generico. O Android segue com o SVG.
  icons: { icon: "/kando-logo.svg", apple: { url: "/apple-touch-icon.png", sizes: "180x180" } },
  // Nome embaixo do icone na tela de inicio do iPhone (o titulo inteiro nao cabe).
  appleWebApp: { title: "Kando" },
};

export const viewport: Viewport = {
  themeColor: "#002952",
  width: "device-width",
  initialScale: 1,
  // Permite que a barra inferior respeite a area segura do aparelho (notch e a
  // faixa inferior do iPhone) via env(safe-area-inset-*).
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        {/* Sora via Google Fonts. Carregada por link para degradar com elegancia
            (cai no fallback do sistema) caso nao haja internet. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Kando by Brusoft",
  description: "Kando: painel de gestao de conteudo de redes sociais da Brusoft e Evotalks",
  icons: { icon: "/brusoft-simbolo.png" },
};

export const viewport: Viewport = {
  themeColor: "#002952",
  width: "device-width",
  initialScale: 1,
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

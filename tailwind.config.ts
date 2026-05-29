import type { Config } from "tailwindcss";

/**
 * Configuracao do Tailwind com a identidade visual da Brusoft.
 * As cores da marca ficam acessiveis como classes utilitarias (ex: bg-marca-laranja).
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        marca: {
          laranja: "#FA611E", // principal: botoes, estados ativos, drop target
          azulEscuro: "#002952", // topo da pagina e cabecalhos
          azulClaro: "#044B8C", // destaques secundarios
          branco: "#f4f5fa", // fundo do board e dos cards
          preto: "#1E2026", // texto principal
          cinza: "#8790AB", // texto secundario e bordas
          vermelho: "#EC1313", // alertas e prazos vencidos
          verde: "#16A34A", // conteudo postado
          verdeEscuro: "#15803D",
          verdeClaro: "#DCFCE7",
        },
      },
      keyframes: {
        // Surgir com leve "pop" (usado em chips agendados e no check de postado).
        pop: {
          "0%": { transform: "scale(0.6)", opacity: "0" },
          "70%": { transform: "scale(1.08)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        // Anel pulsante no dia do calendario que acabou de receber um agendamento.
        dropPulse: {
          "0%": { boxShadow: "0 0 0 0 rgba(250, 97, 30, 0.55)" },
          "100%": { boxShadow: "0 0 0 14px rgba(250, 97, 30, 0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(12px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        // Carimbo de "postado": check que cresce e assenta.
        checkPop: {
          "0%": { transform: "scale(0.2) rotate(-12deg)", opacity: "0" },
          "60%": { transform: "scale(1.15) rotate(3deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(0deg)", opacity: "1" },
        },
      },
      animation: {
        pop: "pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
        dropPulse: "dropPulse 0.6s ease-out",
        fadeIn: "fadeIn 0.2s ease-out",
        slideUp: "slideUp 0.25s ease-out",
        checkPop: "checkPop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      fontFamily: {
        // Sora para todo o corpo e interface; fallback de sistema caso a fonte nao carregue.
        sans: ["Sora", "ui-sans-serif", "system-ui", "Segoe UI", "Arial", "sans-serif"],
        // Titulo principal: LOOS Wide se fornecida, senao Sora (caixa alta aplicada via classe).
        titulo: ["LOOS Wide", "Sora", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        // Cantos retos com leve suavizacao (toque sutil de pixel art).
        marca: "4px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(30, 32, 38, 0.08), 0 1px 3px rgba(30, 32, 38, 0.06)",
        cardHover: "0 4px 12px rgba(30, 32, 38, 0.14)",
        modal: "0 16px 48px rgba(0, 41, 82, 0.28)",
      },
    },
  },
  plugins: [],
};

export default config;

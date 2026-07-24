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
      screens: {
        // "Espacoso" = tela com largura de desktop E altura suficiente. Quando
        // NAO casa (celular em pe OU em paisagem com pouca altura), o app usa o
        // layout compacto/mobile, que aproveita melhor o espaco limitado.
        espacoso: { raw: "(min-width: 640px) and (min-height: 500px)" },
        // Altura curta (ex.: celular em paisagem): compacta o miolo dos modais.
        baixo: { raw: "(max-height: 499px)" },
      },
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
        // Surgimento de popovers (calendario, horario, selects): cresce e sobe
        // com um leve "pop" para a abertura ficar visivel e gostosa.
        surgir: {
          "0%": { opacity: "0", transform: "translateY(-8px) scale(0.94)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        // Cada bloquinho de dia entra em sequencia (so opacidade, para nao
        // conflitar com o transform do tilt 3D que segue o cursor).
        diaEntra: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        // Pegar suave: o card surge e assenta no tamanho normal (sem crescer
        // alem do slot, para o quadro nao "mudar" ao segurar).
        pegar: {
          "0%": { transform: "scale(0.98)", opacity: "0.6" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        // Troca de mes no calendario: o mes novo entra deslizando do lado certo.
        entraDir: {
          "0%": { opacity: "0", transform: "translateX(26px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        entraEsq: {
          "0%": { opacity: "0", transform: "translateX(-26px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        // Bottom sheet subindo (detalhe do dia no mobile).
        subirSheet: {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        // Card que acabou de ser solto numa coluna: cresce de leve e um anel
        // laranja pulsa e some (feedback de "chegou aqui").
        chegou: {
          "0%": { transform: "scale(0.96)", boxShadow: "0 0 0 5px rgba(250, 97, 30, 0.28)" },
          "100%": { transform: "scale(1)", boxShadow: "0 0 0 0 rgba(250, 97, 30, 0)" },
        },
      },
      animation: {
        pop: "pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
        dropPulse: "dropPulse 0.6s ease-out",
        fadeIn: "fadeIn 0.2s ease-out",
        slideUp: "slideUp 0.25s ease-out",
        checkPop: "checkPop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)",
        surgir: "surgir 0.24s cubic-bezier(0.34, 1.56, 0.64, 1)",
        diaEntra: "diaEntra 0.28s cubic-bezier(0.22, 1, 0.36, 1) both",
        pegar: "pegar 0.2s cubic-bezier(0.22, 1, 0.36, 1) both",
        entraDir: "entraDir 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
        entraEsq: "entraEsq 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
        subirSheet: "subirSheet 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
        chegou: "chegou 0.5s cubic-bezier(0.2, 0.9, 0.3, 1)",
      },
      transitionTimingFunction: {
        // Easing suave padrao (sai rapido, assenta devagar) para hovers e lifts.
        suave: "cubic-bezier(0.22, 1, 0.36, 1)",
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
        // Sombra do card "levantado" no hover: maior, mais suave e com tom da marca.
        cardLift: "0 14px 30px -8px rgba(0, 41, 82, 0.22), 0 4px 10px -4px rgba(30, 32, 38, 0.1)",
        // Brilho do dia selecionado/hover no calendario.
        dia: "0 10px 22px -6px rgba(250, 97, 30, 0.45)",
        modal: "0 16px 48px rgba(0, 41, 82, 0.28)",
      },
    },
  },
  plugins: [],
};

export default config;

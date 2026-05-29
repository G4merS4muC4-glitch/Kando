/**
 * Anel de progresso em SVG (sem dependencias). O arco preenche conforme o
 * percentual e anima com a mesma "mola" do carimbo de postado. Fica laranja
 * ate 99% e verde ao chegar em 100%. O texto central e renderizado por quem usa.
 */
export default function AnelProgresso({
  pct,
  size = 120,
  stroke = 10,
  children,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const completo = pct >= 100;
  const corArco = completo ? "#16A34A" : "#FA611E";

  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="block" aria-hidden>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#8790AB"
            strokeOpacity={0.25}
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={corArco}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - Math.min(100, Math.max(0, pct)) / 100)}
            style={{ transition: "stroke-dashoffset 600ms cubic-bezier(0.34, 1.56, 0.64, 1), stroke 300ms ease" }}
          />
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}

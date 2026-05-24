import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { WHEEL_ORDER, numberColor, COLOR_BG } from "@/lib/roulette-constants";

const SEGMENTS = WHEEL_ORDER.length;
const SEG_ANGLE = 360 / SEGMENTS;

function segmentPath(cx: number, cy: number, r: number, i: number): string {
  const a0 = ((i * SEG_ANGLE - 90) * Math.PI) / 180;
  const a1 = (((i + 1) * SEG_ANGLE - 90) * Math.PI) / 180;
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1} Z`;
}

function labelPos(cx: number, cy: number, r: number, i: number) {
  const mid = (i + 0.5) * SEG_ANGLE - 90;
  const rad = (mid * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

type Props = {
  winningNumber: number | null;
  spinning: boolean;
  onSpinEnd?: () => void;
};

export function RouletteWheel({ winningNumber, spinning, onSpinEnd }: Props) {
  const [rotation, setRotation] = useState(0);
  const baseRef = useRef(0);

  useEffect(() => {
    if (!spinning || winningNumber == null) return;
    const idx = WHEEL_ORDER.indexOf(winningNumber as (typeof WHEEL_ORDER)[number]);
    const safeIdx = idx >= 0 ? idx : 0;
    const spins = 5 + Math.floor(Math.random() * 3);
    const target =
      spins * 360 + (360 - safeIdx * SEG_ANGLE - SEG_ANGLE / 2);
    const next = baseRef.current + target;
    baseRef.current = next % 360;
    setRotation(next);
  }, [spinning, winningNumber]);

  const cx = 200;
  const cy = 200;
  const outer = 188;
  const labelR = 132;

  return (
    <div className="relative w-full max-w-[min(100%,420px)] mx-auto aspect-square">
      {/* Indicador */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
        <div className="w-0 h-0 border-l-[14px] border-r-[14px] border-t-[28px] border-l-transparent border-r-transparent border-t-primary drop-shadow-[0_0_12px_rgba(212,175,55,0.9)]" />
      </div>

      <motion.div
        className="w-full h-full"
        animate={{ rotate: rotation }}
        transition={{ duration: 4.2, ease: [0.12, 0.8, 0.2, 1] }}
        onAnimationComplete={() => {
          if (spinning && winningNumber != null) onSpinEnd?.();
        }}
      >
        <svg viewBox="0 0 400 400" className="w-full h-full drop-shadow-[0_0_40px_rgba(0,0,0,0.6)]">
          <defs>
            <radialGradient id="wheelRim" cx="50%" cy="50%" r="50%">
              <stop offset="85%" stopColor="#1a1a1a" />
              <stop offset="100%" stopColor="#d4af37" />
            </radialGradient>
            <filter id="wheelGlow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <circle cx={cx} cy={cy} r={outer + 8} fill="url(#wheelRim)" />
          <circle cx={cx} cy={cy} r={outer + 4} fill="none" stroke="#d4af37" strokeWidth="3" opacity="0.6" />

          {WHEEL_ORDER.map((num, i) => {
            const col = numberColor(num);
            const { x, y } = labelPos(cx, cy, labelR, i);
            return (
              <g key={num}>
                <path
                  d={segmentPath(cx, cy, outer, i)}
                  fill={COLOR_BG[col]}
                  stroke="#d4af37"
                  strokeWidth="0.4"
                  opacity={0.95}
                />
                <text
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontSize={num >= 10 ? 11 : 12}
                  fontWeight="700"
                  transform={`rotate(${i * SEG_ANGLE + SEG_ANGLE / 2}, ${x}, ${y})`}
                >
                  {num}
                </text>
              </g>
            );
          })}

          <circle cx={cx} cy={cy} r={52} fill="#0a0a0a" stroke="#d4af37" strokeWidth="2" filter="url(#wheelGlow)" />
          <circle cx={cx} cy={cy} r={38} fill="none" stroke="#d4af37" strokeWidth="1" opacity="0.35" />
          <text x={cx} y={cy - 6} textAnchor="middle" fill="#d4af37" fontSize="11" fontWeight="600" letterSpacing="2">
            EURO
          </text>
          <text x={cx} y={cy + 14} textAnchor="middle" fill="#fff" fontSize="10" opacity="0.5">
            0–36
          </text>
        </svg>
      </motion.div>

      {winningNumber != null && !spinning && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 px-5 py-2 rounded-full border border-primary/40 bg-black/80 backdrop-blur"
        >
          <span className="text-white/60 text-sm mr-2">Resultado</span>
          <span
            className={`font-bold text-lg ${
              numberColor(winningNumber) === "red"
                ? "text-red-400"
                : numberColor(winningNumber) === "green"
                  ? "text-emerald-400"
                  : "text-white"
            }`}
          >
            {winningNumber}
          </span>
        </motion.div>
      )}
    </div>
  );
}

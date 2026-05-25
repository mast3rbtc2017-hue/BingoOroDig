import { useCallback, useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { MobileNav } from "@/components/layout/MobileNav";
import { RouletteWheel } from "@/components/roulette/RouletteWheel";
import { useAuth } from "@/lib/auth";
import { apiJson } from "@/lib/api-fetch";
import { numberColor, COLOR_BG } from "@/lib/roulette-constants";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { CircleDot, Trash2, Sparkles, History, Wallet } from "lucide-react";
import { formatCOP, formatCOPSigned } from "@/lib/currency";

type RouletteConfig = {
  enabled: boolean;
  minBet: number;
  maxBet: number;
  maxBetsPerSpin: number;
  payoutMultiplier: number;
};

type Bet = { number: number; amount: number };

type SpinResult = {
  winningNumber: number;
  totalBet: number;
  totalPayout: number;
  netResult: number;
  newBalance: number;
  color: "green" | "red" | "black";
  spinId: number;
};

type HistoryRow = {
  id: number;
  winningNumber: number;
  totalBet: number;
  totalPayout: number;
  netResult: number;
  color: string;
  createdAt: string;
};

const TABLE_LAYOUT: (number | null)[][] = [
  [null, 0, null],
  [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
  [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
];

const CHIP_PRESETS = [1_000, 5_000, 10_000, 25_000, 50_000, 100_000];

export default function RoulettePage() {
  const { user, refreshUser } = useAuth();
  const [config, setConfig] = useState<RouletteConfig | null>(null);
  const [chip, setChip] = useState(10_000);
  const [bets, setBets] = useState<Bet[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [history, setHistory] = useState<HistoryRow[]>([]);

  const loadConfig = useCallback(async () => {
    const c = await apiJson<RouletteConfig & { enabled: boolean }>("/api/roulette/config", "GET");
    setConfig(c);
    if (c.minBet) setChip((prev) => (prev < c.minBet ? c.minBet : prev));
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const rows = await apiJson<HistoryRow[]>("/api/roulette/history?limit=12", "GET");
      setHistory(rows);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadConfig();
    void loadHistory();
  }, [loadConfig, loadHistory]);

  const totalBet = useMemo(() => bets.reduce((s, b) => s + b.amount, 0), [bets]);

  const addBet = (n: number) => {
    if (!config || spinning) return;
    if (bets.length >= config.maxBetsPerSpin && !bets.some((b) => b.number === n)) {
      toast.error(`Máximo ${config.maxBetsPerSpin} números por jugada`);
      return;
    }
    const amount = Math.min(Math.max(chip, config.minBet), config.maxBet);
    setBets((prev) => {
      const existing = prev.find((b) => b.number === n);
      if (existing) {
        return prev.map((b) =>
          b.number === n ? { ...b, amount: Math.min(b.amount + amount, config.maxBet) } : b,
        );
      }
      return [...prev, { number: n, amount }];
    });
  };

  const removeBet = (n: number) => setBets((prev) => prev.filter((b) => b.number !== n));

  const clearBets = () => setBets([]);

  const handleSpin = async () => {
    if (!user || !config) return;
    if (!config.enabled) {
      toast.error("La ruleta no está disponible en este momento");
      return;
    }
    if (!bets.length) {
      toast.error("Selecciona al menos un número");
      return;
    }
    if (totalBet > (user.balance ?? 0)) {
      toast.error("Saldo insuficiente");
      return;
    }

    setSpinning(true);
    setShowResult(false);
    setResult(null);

    try {
      const data = await apiJson<SpinResult>("/api/roulette/spin", "POST", { bets });
      setResult(data);
      await refreshUser();
    } catch (e: unknown) {
      setSpinning(false);
      toast.error(e instanceof Error ? e.message : "Error al girar");
      return;
    }
  };

  const onSpinEnd = () => {
    setSpinning(false);
    setShowResult(true);
    setBets([]);
    void loadHistory();
    if (result) {
      if (result.totalPayout > 0) {
        toast.success(`¡Ganaste ${formatCOP(result.totalPayout)}!`, {
          description: `Número ${result.winningNumber}`,
        });
      } else {
        toast.info(`Salió el ${result.winningNumber}`, {
          description: "Mejor suerte en la próxima",
        });
      }
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col text-foreground pb-20 md:pb-0">
      <Navbar />

      <main className="flex-1 container mx-auto px-4 py-6 md:py-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-primary mb-2">
              <CircleDot className="w-6 h-6" />
              <span className="text-sm uppercase tracking-[0.2em] font-medium">Casino OroDig</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-serif font-bold text-white">Ruleta Europea</h1>
            <p className="text-white/50 mt-1 max-w-lg">
              Apuesta a números del 0 al 36. Pago directo ×{config?.payoutMultiplier ?? 35} sobre tu apuesta.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-black/50 border border-white/10 rounded-2xl px-4 py-3">
            <Wallet className="w-5 h-5 text-accent" />
            <div>
              <p className="text-white/40 text-xs">Tu saldo</p>
              <p className="text-accent font-bold text-xl">{formatCOP(user.balance ?? 0)}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 xl:gap-10">
          {/* Ruleta */}
          <section className="relative rounded-3xl border border-white/10 bg-gradient-to-b from-card/40 to-black/60 p-6 md:p-8 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.08)_0%,transparent_70%)] pointer-events-none" />
            <RouletteWheel
              winningNumber={result?.winningNumber ?? null}
              spinning={spinning}
              onSpinEnd={onSpinEnd}
            />

            <AnimatePresence>
              {showResult && result && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-6 text-center"
                >
                  <div
                    className={`inline-flex items-center gap-3 px-6 py-3 rounded-2xl border ${
                      result.totalPayout > 0
                        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                        : "bg-white/5 border-white/10 text-white/70"
                    }`}
                  >
                    <Sparkles className="w-5 h-5" />
                    <span>
                      {result.totalPayout > 0
                        ? formatCOPSigned(result.netResult)
                        : formatCOPSigned(result.netResult)}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* Mesa de apuestas */}
          <section className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-white/50 text-sm mr-1">Ficha:</span>
              {CHIP_PRESETS.filter((c) => !config || (c >= config.minBet && c <= config.maxBet)).map(
                (c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setChip(c)}
                    disabled={spinning}
                    className={`w-11 h-11 rounded-full font-bold text-sm border-2 transition-all ${
                      chip === c
                        ? "border-primary bg-primary text-black scale-110 shadow-[0_0_16px_rgba(212,175,55,0.5)]"
                        : "border-white/20 bg-black/40 text-white hover:border-primary/50"
                    }`}
                  >
                    <span className="text-[10px] leading-tight">{formatCOP(c)}</span>
                  </button>
                ),
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-3 overflow-x-auto">
              <div className="min-w-[320px]">
                {TABLE_LAYOUT.map((row, ri) => (
                  <div key={ri} className="flex gap-1 mb-1">
                    {row.map((num, ci) => {
                      if (num === null) {
                        return <div key={ci} className="w-8 flex-shrink-0" />;
                      }
                      const col = numberColor(num);
                      const active = bets.some((b) => b.number === num);
                      const betAmt = bets.find((b) => b.number === num)?.amount;
                      return (
                        <button
                          key={num}
                          type="button"
                          disabled={spinning}
                          onClick={() => addBet(num)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            removeBet(num);
                          }}
                          className={`relative flex-1 min-w-[2rem] h-10 md:h-11 rounded-lg text-sm font-bold transition-all border ${
                            active
                              ? "ring-2 ring-primary ring-offset-1 ring-offset-black scale-[1.02]"
                              : "opacity-90 hover:brightness-125"
                          }`}
                          style={{
                            backgroundColor: COLOR_BG[col],
                            borderColor: active ? "#d4af37" : "rgba(255,255,255,0.15)",
                          }}
                        >
                          {num}
                          {betAmt != null && (
                            <span className="absolute -top-1 -right-1 bg-primary text-black text-[9px] font-bold px-1 rounded-full">
                              {formatCOP(betAmt)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
              <p className="text-white/30 text-xs mt-2 text-center">Clic para apostar · clic derecho para quitar</p>
            </div>

            {/* Apuestas activas */}
            {bets.length > 0 && (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-white font-medium">Tus apuestas ({bets.length})</span>
                  <button
                    type="button"
                    onClick={clearBets}
                    disabled={spinning}
                    className="text-white/40 hover:text-red-400 flex items-center gap-1 text-sm"
                  >
                    <Trash2 className="w-4 h-4" /> Limpiar
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {bets.map((b) => (
                    <span
                      key={b.number}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-black/50 border border-white/10 text-sm"
                    >
                      <span
                        className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-white`}
                        style={{ backgroundColor: COLOR_BG[numberColor(b.number)] }}
                      >
                        {b.number}
                      </span>
                      {formatCOP(b.amount)}
                    </span>
                  ))}
                </div>
                <p className="text-accent font-bold mt-3 text-right">Total: {formatCOP(totalBet)}</p>
              </div>
            )}

            <Button
              onClick={() => void handleSpin()}
              disabled={spinning || !bets.length || !config?.enabled}
              className="w-full h-14 text-lg font-bold bg-gradient-to-r from-primary to-accent text-black hover:scale-[1.01] transition-transform shadow-[0_0_24px_rgba(212,175,55,0.35)] disabled:opacity-40"
            >
              {spinning ? "Girando..." : `Girar · ${formatCOP(totalBet)}`}
            </Button>
          </section>
        </div>

        {/* Historial */}
        {history.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
              <History className="w-5 h-5 text-primary" /> Últimas jugadas
            </h2>
            <div className="flex flex-wrap gap-2">
              {history.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10"
                  title={new Date(h.createdAt).toLocaleString("es")}
                >
                  <span
                    className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-sm"
                    style={{
                      backgroundColor:
                        COLOR_BG[h.color as keyof typeof COLOR_BG] ?? COLOR_BG.black,
                    }}
                  >
                    {h.winningNumber}
                  </span>
                  <span className={h.netResult >= 0 ? "text-emerald-400" : "text-white/50"}>
                    {formatCOPSigned(h.netResult)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <MobileNav />
    </div>
  );
}

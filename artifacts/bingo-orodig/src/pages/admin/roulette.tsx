import { useCallback, useEffect, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Link } from "wouter";
import { apiJson } from "@/lib/api-fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, CircleDot, Save, Shield } from "lucide-react";
import { motion } from "framer-motion";
import { COLOR_BG } from "@/lib/roulette-constants";
import { formatCOP, formatCOPSigned } from "@/lib/currency";

type AdminConfig = {
  enabled: boolean;
  winEveryNRouletteSpins: number;
  minBet: number;
  maxBet: number;
  maxBetsPerSpin: number;
  payoutMultiplier: number;
  totalSpins: number;
  lastWinAllowedAtSpin: number;
  winAllowedNow: boolean;
  spinsUntilNextWin: number;
};

type AdminSpin = {
  id: number;
  username: string;
  winningNumber: number;
  totalBet: number;
  totalPayout: number;
  netResult: number;
  winAllowed: boolean;
  color: string;
  createdAt: string;
};

export default function AdminRoulette() {
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [spins, setSpins] = useState<AdminSpin[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    enabled: true,
    winEveryNRouletteSpins: 10,
    minBet: 1000,
    maxBet: 500000,
    maxBetsPerSpin: 8,
    payoutMultiplier: 35,
  });

  const load = useCallback(async () => {
    const c = await apiJson<AdminConfig>("/api/roulette/config", "GET");
    setConfig(c);
    setForm({
      enabled: c.enabled,
      winEveryNRouletteSpins: c.winEveryNRouletteSpins,
      minBet: c.minBet,
      maxBet: c.maxBet,
      maxBetsPerSpin: c.maxBetsPerSpin,
      payoutMultiplier: c.payoutMultiplier,
    });
    const s = await apiJson<AdminSpin[]>("/api/roulette/admin/spins?limit=30", "GET");
    setSpins(s);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await apiJson<AdminConfig>("/api/roulette/config", "PATCH", form);
      setConfig(updated);
      toast.success("Configuración de ruleta guardada");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col text-foreground">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-10 max-w-4xl">
        <Link href="/admin">
          <button className="text-white/50 hover:text-primary flex items-center gap-1 text-sm mb-6">
            <ArrowLeft className="w-4 h-4" /> Panel admin
          </button>
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <CircleDot className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-serif font-bold text-white">Ruleta — Control</h1>
            <p className="text-white/50 text-sm">
              Cada cuántos giros de ruleta se permite un premio real (el resto cae en números sin apuesta)
            </p>
          </div>
        </div>

        {config && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {[
              { label: "Giros totales", value: config.totalSpins },
              { label: "Último giro con premio", value: `#${config.lastWinAllowedAtSpin}` },
              {
                label: "Próximo premio en",
                value: `${config.spinsUntilNextWin} giros`,
                highlight: !config.winAllowedNow,
              },
              {
                label: "Estado",
                value: config.winAllowedNow ? "Premio permitido ahora" : "Casa (sin apuesta)",
                highlight: config.winAllowedNow,
              },
            ].map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`rounded-xl border p-4 ${
                  s.highlight
                    ? "bg-amber-500/10 border-amber-500/30"
                    : "bg-white/5 border-white/10"
                }`}
              >
                <p className="text-white/40 text-xs uppercase">{s.label}</p>
                <p className="text-xl font-bold text-white mt-1">{s.value}</p>
              </motion.div>
            ))}
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-card/30 p-6 space-y-6 mb-10">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-white">Ruleta activa</Label>
              <p className="text-white/40 text-xs">Desactiva para mantenimiento</p>
            </div>
            <Switch
              checked={form.enabled}
              onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
            />
          </div>

          <div>
            <Label className="text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Permitir ganar 1 vez cada N giros de ruleta
            </Label>
            <p className="text-white/40 text-xs mb-2">
              Ejemplo: 10 = en 9 giros seguidos la bola cae en un número que nadie apostó; en el giro 10 puede ganar un jugador.
            </p>
            <Input
              type="number"
              min={1}
              max={1000}
              value={form.winEveryNRouletteSpins}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  winEveryNRouletteSpins: Math.max(1, Number(e.target.value) || 1),
                }))
              }
              className="bg-black/40 border-white/10"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-white">Apuesta mínima</Label>
              <Input
                type="number"
                min={1}
                value={form.minBet}
                onChange={(e) => setForm((f) => ({ ...f, minBet: Number(e.target.value) }))}
                className="bg-black/40 border-white/10 mt-1"
              />
            </div>
            <div>
              <Label className="text-white">Apuesta máxima</Label>
              <Input
                type="number"
                min={1}
                value={form.maxBet}
                onChange={(e) => setForm((f) => ({ ...f, maxBet: Number(e.target.value) }))}
                className="bg-black/40 border-white/10 mt-1"
              />
            </div>
            <div>
              <Label className="text-white">Máx. números por giro</Label>
              <Input
                type="number"
                min={1}
                max={37}
                value={form.maxBetsPerSpin}
                onChange={(e) =>
                  setForm((f) => ({ ...f, maxBetsPerSpin: Number(e.target.value) }))
                }
                className="bg-black/40 border-white/10 mt-1"
              />
            </div>
            <div>
              <Label className="text-white">Multiplicador premio</Label>
              <Input
                type="number"
                min={1}
                value={form.payoutMultiplier}
                onChange={(e) =>
                  setForm((f) => ({ ...f, payoutMultiplier: Number(e.target.value) }))
                }
                className="bg-black/40 border-white/10 mt-1"
              />
            </div>
          </div>

          <Button
            onClick={() => void save()}
            disabled={saving}
            className="w-full bg-primary text-black font-bold"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Guardando..." : "Guardar configuración"}
          </Button>
        </div>

        <h2 className="text-xl font-bold text-white mb-4">Últimos giros (todos los jugadores)</h2>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {spins.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/30 px-4 py-3 text-sm"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white shrink-0"
                  style={{
                    backgroundColor:
                      COLOR_BG[s.color as keyof typeof COLOR_BG] ?? COLOR_BG.black,
                  }}
                >
                  {s.winningNumber}
                </span>
                <div className="min-w-0">
                  <p className="text-white font-medium truncate">{s.username}</p>
                  <p className="text-white/40 text-xs">
                    {s.winAllowed ? "Premio permitido" : "Casa (sin apuesta)"} · $
                    {formatCOP(s.totalBet)} → {s.totalPayout > 0 ? formatCOP(s.totalPayout) : formatCOP(0)}
                  </p>
                </div>
              </div>
              <span className={s.netResult >= 0 ? "text-emerald-400" : "text-white/40"}>
                {formatCOPSigned(s.netResult)}
              </span>
            </div>
          ))}
          {!spins.length && <p className="text-white/30 text-center py-8">Sin giros registrados</p>}
        </div>
      </main>
    </div>
  );
}

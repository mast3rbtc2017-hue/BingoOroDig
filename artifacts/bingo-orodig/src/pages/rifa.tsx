import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Navbar } from "@/components/layout/Navbar";
import { MobileNav } from "@/components/layout/MobileNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  Ticket,
  Calendar,
  Shuffle,
  Wallet,
  Trophy,
} from "lucide-react";
import { apiJson } from "@/lib/api-fetch";
import { formatCOP, formatCOPSigned } from "@/lib/currency";
import { useAuth } from "@/lib/auth";
import { useRaffleTicker } from "@/lib/useRaffleTicker";
import { useCountdown } from "@/lib/countdown";
import { formatRaffleDrawColombia } from "@/lib/raffleTime";
import type { RaffleDetail } from "@/lib/raffle-types";
import { toast } from "sonner";
import confetti from "canvas-confetti";

export default function RifaDetailPage() {
  const { id } = useParams();
  const raffleId = parseInt(id!, 10);
  const { user, refreshUser, firebaseSignedIn, isLoading: authLoading } = useAuth();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [buying, setBuying] = useState(false);

  const { data: raffle, refetch, isLoading } = useQuery({
    queryKey: ["/api/raffles", raffleId],
    queryFn: () => apiJson<RaffleDetail>(`/api/raffles/${raffleId}`, "GET"),
    enabled: !!raffleId && !!user && firebaseSignedIn && !authLoading,
    refetchInterval: 8000,
  });

  const { data: myNumbers, refetch: refetchMine } = useQuery({
    queryKey: ["/api/raffles", raffleId, "my-numbers"],
    queryFn: () => apiJson<number[]>(`/api/raffles/${raffleId}/my-numbers`, "GET"),
    enabled: !!raffleId && !!user && firebaseSignedIn,
  });

  useRaffleTicker(raffle?.status === "open" && !!raffle.scheduledDrawAt);

  const soldSet = useMemo(
    () => new Set(raffle?.soldNumbers ?? []),
    [raffle?.soldNumbers],
  );
  const mineSet = useMemo(() => new Set(myNumbers ?? []), [myNumbers]);

  const countdown = useCountdown(
    raffle?.status === "open" && raffle.scheduledDrawAt
      ? raffle.scheduledDrawAt
      : null,
  );

  const totalCost = (raffle?.ticketPrice ?? 0) * selected.size;
  const canBuy = raffle?.status === "open" && selected.size > 0;

  const toggle = (n: number) => {
    if (soldSet.has(n)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  };

  const pickRandom = () => {
    if (!raffle) return;
    const available: number[] = [];
    for (let i = 1; i <= raffle.totalNumbers; i++) {
      if (!soldSet.has(i)) available.push(i);
    }
    if (!available.length) {
      toast.error("No quedan números disponibles");
      return;
    }
    const n = available[Math.floor(Math.random() * available.length)];
    setSelected(new Set([n]));
  };

  const handleBuy = async () => {
    if (!canBuy || !user) return;
    if (totalCost > (user.balance ?? 0)) {
      toast.error("Saldo insuficiente", {
        description: "Recarga en tu billetera",
      });
      return;
    }
    setBuying(true);
    const nums = [...selected].sort((a, b) => a - b);
    try {
      await apiJson(`/api/raffles/${raffleId}/tickets`, "POST", { numbers: nums });
      await refreshUser();
      setSelected(new Set());
      refetch();
      refetchMine();
      toast.success(`¡Números comprados! ${nums.join(", ")}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al comprar");
    } finally {
      setBuying(false);
    }
  };

  if (isLoading || !raffle) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-white/40">Cargando rifa...</p>
      </div>
    );
  }

  const pct = Math.round((raffle.soldCount / raffle.totalNumbers) * 100);
  const isWinner =
    raffle.status === "drawn" &&
    user &&
    raffle.winningNumber != null &&
    mineSet.has(raffle.winningNumber);

  useEffect(() => {
    if (isWinner) {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
    }
  }, [isWinner]);

  return (
    <div className="min-h-screen bg-background flex flex-col text-foreground">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-6 pb-32 md:pb-12 max-w-4xl">
        <Link href="/rifas">
          <button
            type="button"
            className="flex items-center gap-1 text-white/50 hover:text-white text-sm mb-4"
          >
            <ChevronLeft className="w-4 h-4" /> Todas las rifas
          </button>
        </Link>

        {/* Hero */}
        <div className="relative rounded-3xl overflow-hidden border border-white/10 mb-6">
          {raffle.imageUrl ? (
            <img
              src={raffle.imageUrl}
              alt={raffle.prizeTitle}
              className="w-full aspect-[16/9] object-cover"
            />
          ) : (
            <div className="aspect-[16/9] bg-gradient-to-br from-primary/30 to-violet-900/40 flex items-center justify-center">
              <Trophy className="w-20 h-20 text-primary/50" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5 md:p-8">
            <Badge className="mb-2 bg-primary/20 text-primary border-primary/40">
              {raffle.prizeTitle}
            </Badge>
            <h1 className="text-2xl md:text-4xl font-bold text-white">{raffle.title}</h1>
            {raffle.description && (
              <p className="text-white/60 text-sm mt-2 max-w-2xl">{raffle.description}</p>
            )}
          </div>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-card/50 border border-white/10 rounded-2xl p-4">
            <p className="text-white/40 text-xs">Precio</p>
            <p className="text-accent font-bold">{formatCOP(raffle.ticketPrice)}</p>
          </div>
          <div className="bg-card/50 border border-white/10 rounded-2xl p-4">
            <p className="text-white/40 text-xs">Vendidos</p>
            <p className="text-white font-bold">
              {raffle.soldCount}/{raffle.totalNumbers}
            </p>
            <div className="h-1 bg-white/10 rounded mt-2">
              <div
                className="h-full bg-primary rounded"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          <div className="bg-card/50 border border-white/10 rounded-2xl p-4 col-span-2">
            <p className="text-white/40 text-xs flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Sorteo (Colombia)
            </p>
            <p className="text-white font-medium text-sm leading-snug">
              {formatRaffleDrawColombia(raffle.scheduledDrawAt)}
            </p>
            {countdown && !countdown.isPast && raffle.status === "open" && (
              <p className="text-yellow-400 font-black text-lg mt-1 tabular-nums">
                {countdown.label}
              </p>
            )}
          </div>
        </div>

        {raffle.prizeDescription && (
          <div className="bg-card/40 border border-white/10 rounded-2xl p-4 mb-6 text-white/70 text-sm">
            {raffle.prizeDescription}
          </div>
        )}

        {raffle.status === "drawn" && (
          <div className="bg-primary/10 border border-primary/40 rounded-2xl p-5 mb-6 text-center">
            <p className="text-primary font-bold text-lg">Número ganador</p>
            <p className="text-5xl font-black text-white my-2">#{raffle.winningNumber}</p>
            {raffle.winnerUsername && (
              <p className="text-white/60">Ganador: {raffle.winnerUsername}</p>
            )}
            {isWinner && (
              <p className="text-green-400 font-bold mt-2">¡Felicidades, ganaste esta rifa!</p>
            )}
          </div>
        )}

        {(myNumbers?.length ?? 0) > 0 && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 mb-6">
            <p className="text-green-400 font-bold text-sm mb-2">Tus números</p>
            <div className="flex flex-wrap gap-2">
              {myNumbers!.map((n) => (
                <span
                  key={n}
                  className={`px-3 py-1 rounded-lg font-bold text-sm ${
                    raffle.winningNumber === n
                      ? "bg-primary text-black"
                      : "bg-black/40 text-green-400 border border-green-500/30"
                  }`}
                >
                  {n}
                </span>
              ))}
            </div>
          </div>
        )}

        {raffle.status === "open" && (
          <>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 className="text-lg font-bold text-white">Elige tus números</h2>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-white/10 text-white"
                  onClick={pickRandom}
                >
                  <Shuffle className="w-4 h-4 mr-1" /> Aleatorio
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-white/10 text-white"
                  onClick={() => setSelected(new Set())}
                >
                  Limpiar
                </Button>
              </div>
            </div>

            <div className="flex gap-3 text-xs text-white/40 mb-3 flex-wrap">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-black/50 border border-white/20" /> Libre
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-primary/30 border border-primary" /> Tu selección
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-green-500/20 border border-green-500/40" /> Tuyo
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-white/10 opacity-50" /> Vendido
              </span>
            </div>

            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-1.5 max-h-[50vh] overflow-y-auto p-2 bg-black/30 rounded-2xl border border-white/5 mb-6">
              {Array.from({ length: raffle.totalNumbers }, (_, i) => i + 1).map((n) => {
                const sold = soldSet.has(n);
                const mine = mineSet.has(n);
                const sel = selected.has(n);
                return (
                  <button
                    key={n}
                    type="button"
                    disabled={sold && !mine}
                    onClick={() => toggle(n)}
                    className={`
                      aspect-square rounded-lg text-xs font-bold transition-all
                      ${sold && !mine ? "bg-white/5 text-white/20 cursor-not-allowed line-through" : ""}
                      ${mine ? "bg-green-500/25 text-green-400 border border-green-500/50" : ""}
                      ${sel && !mine ? "bg-primary text-black scale-105 shadow-lg shadow-primary/30" : ""}
                      ${!sold && !mine && !sel ? "bg-black/40 text-white/70 border border-white/10 hover:border-primary/50 hover:text-primary" : ""}
                    `}
                  >
                    {n}
                  </button>
                );
              })}
            </div>

            <div className="sticky bottom-20 md:bottom-4 z-20 bg-card/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-white/50 text-xs">
                  {selected.size} número{selected.size !== 1 ? "s" : ""} seleccionado
                  {selected.size !== 1 ? "s" : ""}
                </p>
                <p className="text-white font-bold text-xl">
                  Total: {formatCOPSigned(totalCost)}
                </p>
                <p className="text-white/40 text-xs">
                  Saldo: {formatCOP(user?.balance ?? 0)}
                </p>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Link href="/wallet">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-white/10 text-white"
                  >
                    <Wallet className="w-4 h-4" />
                  </Button>
                </Link>
                <Button
                  type="button"
                  disabled={!canBuy || buying}
                  onClick={handleBuy}
                  className="flex-1 sm:flex-none bg-gradient-to-r from-primary to-accent text-black font-bold px-8"
                >
                  <Ticket className="w-4 h-4 mr-2" />
                  {buying ? "Comprando..." : "Comprar números"}
                </Button>
              </div>
            </div>
          </>
        )}

        {raffle.rules && (
          <div className="mt-8 text-white/40 text-xs border-t border-white/5 pt-6">
            <p className="font-bold text-white/60 mb-2">Reglas</p>
            <p className="whitespace-pre-wrap">{raffle.rules}</p>
          </div>
        )}
      </main>
      <MobileNav />
    </div>
  );
}

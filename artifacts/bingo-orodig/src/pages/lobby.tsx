import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Navbar } from "@/components/layout/Navbar";
import { MobileNav } from "@/components/layout/MobileNav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Coins, Timer, Radio, CreditCard, Calendar, Trophy, Clock } from "lucide-react";
import { resumeAudio } from "@/lib/sounds";
import { useCountdown, formatScheduledLocal } from "@/lib/countdown";
import { useScheduleTicker } from "@/lib/useScheduleTicker";
import { apiJson } from "@/lib/api-fetch";
import { formatCOP } from "@/lib/currency";
import { useAuth } from "@/lib/auth";

const TYPE_LABELS: Record<string, string> = {
  classic: "Clásico", fast: "Rápido", vip: "VIP", automatic: "Automático",
};
const TYPE_COLORS: Record<string, string> = {
  classic: "border-blue-500/30 text-blue-400",
  fast: "border-orange-500/30 text-orange-400",
  vip: "border-primary/30 text-primary",
  automatic: "border-green-500/30 text-green-400",
};

type LobbyGame = {
  id: number;
  title: string | null;
  description: string | null;
  status: string;
  patternType: string;
  scheduledAt?: string | null;
  prize: number;
  cardPrice: number | null;
  maxPlayers: number | null;
  ballInterval: number;
  playerCount?: number;
  type?: string;
};

type LobbyItem = {
  game: LobbyGame;
  winnerUsername: string | null;
};

type FilterTab = "all" | "upcoming" | "live" | "finished";

function gameStatusMeta(status: string) {
  switch (status) {
    case "playing":
      return { label: "En vivo", badge: "bg-red-500/20 text-red-400 border-red-500/30", live: true };
    case "paused":
      return { label: "Pausado", badge: "bg-orange-500/20 text-orange-400 border-orange-500/30", live: true };
    case "waiting":
      return { label: "Por empezar", badge: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", live: false };
    case "finished":
      return { label: "Finalizado", badge: "bg-white/10 text-white/50 border-white/10", live: false };
    default:
      return { label: status, badge: "bg-white/5 text-white/40", live: false };
  }
}

function SorteoCard({ item, index }: { item: LobbyItem; index: number }) {
  const { game, winnerUsername } = item;
  const meta = gameStatusMeta(game.status);
  const scheduledAt = game.scheduledAt ?? null;
  const countdown = useCountdown(
    scheduledAt && game.status === "waiting" ? scheduledAt : null,
  );
  const isScheduled = game.status === "waiting" && !!scheduledAt;
  const title = game.title || `Sorteo #${game.id}`;
  const cardPrice = game.cardPrice ?? 5000;
  const maxPlayers = game.maxPlayers ?? 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.07 }}
      className={`group relative bg-card/40 backdrop-blur-md border border-white/10 rounded-2xl md:rounded-3xl transition-all overflow-hidden ${
        meta.live ? "hover:border-green-500/30" : "hover:border-primary/40"
      }`}
    >
      {meta.live && (
        <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent pointer-events-none" />
      )}

      <div className="relative z-10 p-4 md:p-6 flex flex-col h-full">
        <div className="flex justify-between items-start mb-3 md:mb-4">
          <div className="flex-1 min-w-0 mr-2">
            <h3 className="text-lg md:text-2xl font-bold text-white mb-1 truncate">{title}</h3>
            {game.description && (
              <p className="text-white/40 text-xs truncate">{game.description}</p>
            )}
            <Badge variant="outline" className={`${TYPE_COLORS[game.type || "classic"] || "border-white/20 text-white/50"} text-xs uppercase tracking-wider mt-2`}>
              {TYPE_LABELS[game.type || "classic"] || game.type}
            </Badge>
          </div>
          <Badge className={`${meta.badge} flex items-center gap-1 shrink-0`}>
            {meta.live && game.status === "playing" && (
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            )}
            {meta.label}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 md:gap-3 mb-4">
          <div className="bg-black/40 rounded-xl p-2.5 md:p-3 border border-white/5">
            <span className="text-white/40 text-[10px] md:text-xs uppercase tracking-wider flex items-center gap-1 mb-1">
              <Coins className="w-3 h-3 text-accent" /> Premio
            </span>
            <span className="text-lg md:text-xl font-bold text-accent">{formatCOP(game.prize)}</span>
          </div>
          <div className="bg-black/40 rounded-xl p-2.5 md:p-3 border border-white/5">
            <span className="text-white/40 text-[10px] md:text-xs uppercase tracking-wider flex items-center gap-1 mb-1">
              <CreditCard className="w-3 h-3 text-primary" /> Cartón
            </span>
            <span className="text-lg md:text-xl font-bold text-white">{formatCOP(cardPrice)}</span>
          </div>
          <div className="bg-black/40 rounded-xl p-2.5 md:p-3 border border-white/5">
            <span className="text-white/40 text-[10px] md:text-xs uppercase tracking-wider flex items-center gap-1 mb-1">
              <Users className="w-3 h-3 text-primary" /> Jugadores
            </span>
            <span className="text-lg md:text-xl font-bold text-white">
              {game.playerCount ?? 0}<span className="text-white/30 text-sm">/{maxPlayers}</span>
            </span>
          </div>
          <div className="bg-black/40 rounded-xl p-2.5 md:p-3 border border-white/5">
            <span className="text-white/40 text-[10px] md:text-xs uppercase tracking-wider flex items-center gap-1 mb-1">
              <Timer className="w-3 h-3 text-primary" /> Intervalo
            </span>
            <span className="text-lg md:text-xl font-bold text-white">
              {game.ballInterval}<span className="text-white/30 text-sm">s</span>
            </span>
          </div>
        </div>

        {isScheduled && countdown && (
          <div className="flex flex-col gap-1 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-3 py-2.5 mb-3">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-yellow-400 shrink-0" />
              <span className="text-yellow-400/90 text-xs">{formatScheduledLocal(scheduledAt!)}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-white/50 text-xs uppercase tracking-wider">Inicia en</span>
              <span className="text-2xl font-black text-yellow-400 tabular-nums">{countdown.label}</span>
            </div>
          </div>
        )}

        {game.status === "playing" && (
          <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2 mb-3">
            <Radio className="w-4 h-4 text-green-400 animate-pulse shrink-0" />
            <span className="text-green-400 text-sm font-medium">
              En curso · Patrón: {game.patternType}
            </span>
          </div>
        )}

        {game.status === "paused" && (
          <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-xl px-3 py-2 mb-3">
            <Clock className="w-4 h-4 text-orange-400 shrink-0" />
            <span className="text-orange-400 text-sm font-medium">Pausado — revisión BINGO</span>
          </div>
        )}

        {game.status === "finished" && (
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 mb-3">
            <Trophy className="w-4 h-4 text-primary shrink-0" />
            <span className="text-white/70 text-sm">
              {winnerUsername ? (
                <>Ganador: <strong className="text-primary">{winnerUsername}</strong></>
              ) : (
                "Sorteo finalizado"
              )}
            </span>
          </div>
        )}

        <div className="mt-auto pt-3 border-t border-white/10">
          <Link href={`/sorteo/${game.id}`}>
            <Button
              className={`w-full font-bold ${
                game.status === "finished"
                  ? "bg-white/10 text-white/70 border border-white/10 hover:bg-white/15"
                  : meta.live
                    ? "bg-gradient-to-r from-green-600 to-green-500 text-white"
                    : "bg-gradient-to-r from-primary to-accent text-black"
              } hover:scale-[1.02] transition-all`}
            >
              {game.status === "finished"
                ? "Ver resultados"
                : game.status === "waiting"
                  ? "Ver sorteo · Esperando inicio"
                  : "🎱 Entrar al sorteo"}
            </Button>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

export default function Lobby() {
  const [filter, setFilter] = useState<FilterTab>("all");
  const { user, firebaseSignedIn, isLoading: authLoading } = useAuth();

  const { data: lobbyItems, isLoading, isError, error } = useQuery({
    queryKey: ["/api/games/lobby"],
    queryFn: () => apiJson<LobbyItem[]>("/api/games/lobby", "GET"),
    enabled: !!user && firebaseSignedIn && !authLoading,
    refetchInterval: 5000,
    retry: 1,
  });

  const items = lobbyItems ?? [];

  const hasScheduledWaiting = items.some(
    (i) => i.game.status === "waiting" && i.game.scheduledAt,
  );
  useScheduleTicker(hasScheduledWaiting);

  const filtered = items.filter((i) => {
    if (filter === "live") return i.game.status === "playing" || i.game.status === "paused";
    if (filter === "upcoming") return i.game.status === "waiting";
    if (filter === "finished") return i.game.status === "finished";
    return true;
  });

  const liveCount = items.filter(
    (i) => i.game.status === "playing" || i.game.status === "paused",
  ).length;
  const upcomingCount = items.filter((i) => i.game.status === "waiting").length;
  const finishedCount = items.filter((i) => i.game.status === "finished").length;

  return (
    <div className="min-h-screen bg-background flex flex-col text-foreground relative" onClick={resumeAudio}>
      <Navbar />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background z-0 pointer-events-none" />

      <main className="flex-1 container mx-auto px-4 py-8 md:py-12 relative z-10 pb-24 md:pb-12">
        <div className="mb-6 md:mb-10">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl md:text-4xl font-serif font-bold text-white">Lobby de Bingo</h1>
            {liveCount > 0 && (
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                {liveCount} en curso
              </Badge>
            )}
          </div>
          <p className="text-white/50 text-sm md:text-base">
            Sorteos activos o recién finalizados. El admin elimina los sorteos del listado.
          </p>
        </div>

        {isError && (
          <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-300 text-sm">
            No se pudo cargar los sorteos. {error instanceof Error ? error.message : "Sesión inválida — cierra sesión y vuelve a entrar."}
          </div>
        )}

        <div className="flex gap-2 mb-6 flex-wrap">
          {[
            { key: "all" as const, label: `Todos (${items.length})` },
            { key: "upcoming" as const, label: `Por empezar (${upcomingCount})` },
            { key: "live" as const, label: `En curso (${liveCount})` },
            { key: "finished" as const, label: `Finalizados (${finishedCount})` },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                filter === f.key
                  ? "bg-primary text-black border-primary"
                  : "bg-card/30 text-white/60 border-white/10 hover:border-white/30"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card/50 border border-white/5 rounded-2xl h-56 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {filtered.map((item, i) => (
              <SorteoCard key={item.game.id} item={item} index={i} />
            ))}
          </div>
        )}

        {filtered.length === 0 && !isLoading && !isError && (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🎱</div>
            <h3 className="text-xl text-white/40 mb-2">
              {items.length === 0 ? "No hay sorteos visibles" : "No hay sorteos en esta categoría"}
            </h3>
            <p className="text-white/30 text-sm max-w-md mx-auto">
              {items.length === 0
                ? "Crea un sorteo desde Admin → Gestión de sorteos y aparecerá aquí."
                : "Prueba otro filtro."}
            </p>
          </div>
        )}
      </main>
      <MobileNav />
    </div>
  );
}

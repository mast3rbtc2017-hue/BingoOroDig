import { useState, useEffect } from "react";
import { useListRooms, useListGames } from "@workspace/api-client-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Navbar } from "@/components/layout/Navbar";
import { MobileNav } from "@/components/layout/MobileNav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Coins, Timer, Radio, CreditCard, Calendar } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { resumeAudio } from "@/lib/sounds";
import { useCountdown, formatScheduledLocal } from "@/lib/countdown";
import { useScheduleTicker } from "@/lib/useScheduleTicker";

const TYPE_LABELS: Record<string, string> = {
  classic: "Clásico", fast: "Rápido", vip: "VIP", automatic: "Automático"
};
const TYPE_COLORS: Record<string, string> = {
  classic: "border-blue-500/30 text-blue-400",
  fast: "border-orange-500/30 text-orange-400",
  vip: "border-primary/30 text-primary",
  automatic: "border-green-500/30 text-green-400",
};

function RoomCard({ room, game, index }: { room: any; game: any; index: number }) {
  const scheduledAt = game?.scheduledAt ?? null;
  const countdown = useCountdown(
    scheduledAt && game?.status === "waiting" ? scheduledAt : null,
  );
  const isLive = game?.status === "playing";
  const isScheduled = game?.status === "waiting" && !!scheduledAt;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.07 }}
      className="group relative bg-card/40 backdrop-blur-md border border-white/10 rounded-2xl md:rounded-3xl hover:border-primary/40 transition-all hover:shadow-[0_0_20px_rgba(212,175,55,0.1)] overflow-hidden"
    >
      {/* Live pulse effect */}
      {isLive && (
        <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent pointer-events-none" />
      )}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl md:rounded-3xl" />

      <div className="relative z-10 p-4 md:p-6 flex flex-col h-full">
        {/* Header */}
        <div className="flex justify-between items-start mb-3 md:mb-4">
          <div className="flex-1 min-w-0 mr-2">
            <h3 className="text-lg md:text-2xl font-bold text-white mb-1 truncate">{room.name}</h3>
            <Badge variant="outline" className={`${TYPE_COLORS[room.type] || "border-white/20 text-white/50"} text-xs uppercase tracking-wider`}>
              {TYPE_LABELS[room.type] || room.type}
            </Badge>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {isLive ? (
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                En Vivo
              </Badge>
            ) : game?.status === "waiting" ? (
              <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Esperando</Badge>
            ) : (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Abierta</Badge>
            )}
          </div>
        </div>

        <p className="text-white/50 text-sm mb-4 leading-relaxed line-clamp-2">
          {room.description || "Una experiencia premium de bingo virtual."}
        </p>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2 md:gap-3 mb-4">
          <div className="bg-black/40 rounded-xl p-2.5 md:p-3 border border-white/5">
            <span className="text-white/40 text-[10px] md:text-xs uppercase tracking-wider flex items-center gap-1 mb-1">
              <Coins className="w-3 h-3 text-accent" /> Premio
            </span>
            <span className="text-lg md:text-xl font-bold text-accent">${room.prize.toLocaleString()}</span>
          </div>
          <div className="bg-black/40 rounded-xl p-2.5 md:p-3 border border-white/5">
            <span className="text-white/40 text-[10px] md:text-xs uppercase tracking-wider flex items-center gap-1 mb-1">
              <CreditCard className="w-3 h-3 text-primary" /> Cartón
            </span>
            <span className="text-lg md:text-xl font-bold text-white">${room.cardPrice}</span>
          </div>
          <div className="bg-black/40 rounded-xl p-2.5 md:p-3 border border-white/5">
            <span className="text-white/40 text-[10px] md:text-xs uppercase tracking-wider flex items-center gap-1 mb-1">
              <Users className="w-3 h-3 text-primary" /> Jugadores
            </span>
            <span className="text-lg md:text-xl font-bold text-white">{room.playerCount ?? 0}<span className="text-white/30 text-sm">/{room.maxPlayers}</span></span>
          </div>
          <div className="bg-black/40 rounded-xl p-2.5 md:p-3 border border-white/5">
            <span className="text-white/40 text-[10px] md:text-xs uppercase tracking-wider flex items-center gap-1 mb-1">
              <Timer className="w-3 h-3 text-primary" /> Intervalo
            </span>
            <span className="text-lg md:text-xl font-bold text-white">{room.ballInterval}<span className="text-white/30 text-sm">s</span></span>
          </div>
        </div>

        {/* Countdown for scheduled games */}
        {isScheduled && countdown && (
          <div className="flex flex-col gap-1 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-3 py-2.5 mb-3">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-yellow-400 shrink-0" />
              <span className="text-yellow-400/90 text-xs">
                {formatScheduledLocal(scheduledAt!)}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-white/50 text-xs uppercase tracking-wider">Inicia en</span>
              <span className="text-2xl font-black text-yellow-400 tabular-nums">{countdown.label}</span>
            </div>
          </div>
        )}

        {/* Live indicator bar */}
        {isLive && (
          <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2 mb-3">
            <Radio className="w-4 h-4 text-green-400 animate-pulse shrink-0" />
            <span className="text-green-400 text-sm font-medium">Sorteo en vivo · Patrón: {game?.patternType}</span>
          </div>
        )}

        {/* CTA */}
        <div className="mt-auto pt-3 border-t border-white/10">
          <Link href={`/room/${room.id}`}>
            <Button className={`w-full font-bold ${isLive ? "bg-gradient-to-r from-green-600 to-green-500 text-white hover:from-green-500 hover:to-green-400" : "bg-gradient-to-r from-primary to-accent text-black hover:scale-[1.02]"} transition-all`}>
              {isLive ? "🎱 Entrar al Sorteo" : "Entrar a la Sala"}
            </Button>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

export default function Lobby() {
  const { data: rooms, isLoading } = useListRooms({ query: { queryKey: ["/api/rooms"], refetchInterval: 5000 } });
  const { data: games } = useListGames({ query: { queryKey: ["/api/games"], refetchInterval: 5000 } });
  const [filter, setFilter] = useState<"all" | "live" | "waiting">("all");

  const hasScheduledWaiting = (games ?? []).some(
    (g: { status?: string; scheduledAt?: string | null }) =>
      g.status === "waiting" && g.scheduledAt,
  );
  useScheduleTicker(hasScheduledWaiting);

  const activeRooms = rooms || [];
  const filteredRooms = activeRooms.filter(r => {
    const game = games?.find((g: any) => g.id === r.currentGameId);
    if (filter === "live") return game?.status === "playing";
    if (filter === "waiting") return !game || game.status === "waiting";
    return true;
  });

  const liveCount = activeRooms.filter(r => {
    const g = games?.find((g: any) => g.id === r.currentGameId);
    return g?.status === "playing";
  }).length;

  return (
    <div className="min-h-screen bg-background flex flex-col text-foreground relative" onClick={resumeAudio}>
      <Navbar />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background z-0 pointer-events-none" />

      <main className="flex-1 container mx-auto px-4 py-8 md:py-12 relative z-10 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-6 md:mb-10">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl md:text-4xl font-serif font-bold text-white">Lobby de Bingo</h1>
            {liveCount > 0 && (
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                {liveCount} en vivo
              </Badge>
            )}
          </div>
          <p className="text-white/50 text-sm md:text-base">Elige tu sala y empieza a ganar</p>
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {[
            { key: "all", label: `Todas (${activeRooms.length})` },
            { key: "live", label: `🔴 En Vivo (${liveCount})` },
            { key: "waiting", label: "Esperando" },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key as any)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${filter === f.key ? "bg-primary text-black border-primary" : "bg-card/30 text-white/60 border-white/10 hover:border-white/30"}`}>
              {f.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {[1,2,3,4,5,6].map(i => <div key={i} className="bg-card/50 border border-white/5 rounded-2xl h-56 md:h-64 animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {filteredRooms.map((room, i) => {
              const game = games?.find((g: any) => g.id === room.currentGameId) ?? null;
              return <RoomCard key={room.id} room={room} game={game} index={i} />;
            })}
          </div>
        )}

        {filteredRooms.length === 0 && !isLoading && (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🎱</div>
            <h3 className="text-xl text-white/40 mb-2">No hay salas {filter === "live" ? "en vivo" : filter === "waiting" ? "esperando" : "activas"} ahora</h3>
            {filter !== "all" && (
              <button onClick={() => setFilter("all")} className="text-primary text-sm underline mt-2">Ver todas las salas</button>
            )}
          </div>
        )}
      </main>
      <MobileNav />
    </div>
  );
}

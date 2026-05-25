import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Navbar } from "@/components/layout/Navbar";
import { MobileNav } from "@/components/layout/MobileNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Ticket, Calendar, Users, Trophy, Sparkles } from "lucide-react";
import { apiJson } from "@/lib/api-fetch";
import { formatCOP } from "@/lib/currency";
import { useAuth } from "@/lib/auth";
import { useRaffleTicker } from "@/lib/useRaffleTicker";
import { useCountdown } from "@/lib/countdown";
import { formatRaffleDrawColombia } from "@/lib/raffleTime";
import type { Raffle } from "@/lib/raffle-types";
import { resumeAudio } from "@/lib/sounds";

const STATUS_META: Record<
  string,
  { label: string; badge: string; active: boolean }
> = {
  open: {
    label: "Activa",
    badge: "bg-green-500/20 text-green-400 border-green-500/30",
    active: true,
  },
  closed: {
    label: "Cierre ventas",
    badge: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    active: true,
  },
  drawn: {
    label: "Sorteada",
    badge: "bg-primary/20 text-primary border-primary/30",
    active: false,
  },
};

function RaffleCard({ raffle, index }: { raffle: Raffle; index: number }) {
  const meta = STATUS_META[raffle.status] ?? STATUS_META.open;
  const pct = Math.round((raffle.soldCount / raffle.totalNumbers) * 100);
  const countdown = useCountdown(
    raffle.status === "open" && raffle.scheduledDrawAt
      ? raffle.scheduledDrawAt
      : null,
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
    >
      <Link href={`/rifas/${raffle.id}`}>
        <article className="group relative overflow-hidden rounded-3xl border border-white/10 bg-card/40 backdrop-blur-md hover:border-primary/40 transition-all cursor-pointer">
          <div className="aspect-[4/3] relative overflow-hidden bg-black/60">
            {raffle.imageUrl ? (
              <img
                src={raffle.imageUrl}
                alt={raffle.prizeTitle}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/10">
                <Trophy className="w-16 h-16 text-primary/40" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
            <Badge
              className={`absolute top-3 left-3 ${meta.badge} border font-bold`}
            >
              {meta.label}
            </Badge>
            {raffle.status === "open" && countdown && !countdown.isPast && (
              <div className="absolute top-3 right-3 bg-black/70 backdrop-blur px-3 py-1.5 rounded-xl border border-yellow-500/40">
                <p className="text-[10px] text-yellow-400/80 uppercase tracking-wider">
                  Sorteo en
                </p>
                <p className="text-yellow-400 font-black tabular-nums text-sm">
                  {countdown.label}
                </p>
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <p className="text-primary text-xs font-bold uppercase tracking-widest mb-1">
                Premio
              </p>
              <h3 className="text-white font-bold text-lg leading-tight line-clamp-2">
                {raffle.prizeTitle}
              </h3>
            </div>
          </div>

          <div className="p-4 space-y-3">
            <h4 className="text-white font-semibold truncate">{raffle.title}</h4>
            <div className="flex flex-wrap gap-3 text-xs text-white/50">
              <span className="flex items-center gap-1">
                <Ticket className="w-3.5 h-3.5 text-accent" />
                {formatCOP(raffle.ticketPrice)} / número
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {raffle.soldCount}/{raffle.totalNumbers} vendidos
              </span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-accent transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-white/40 text-xs flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatRaffleDrawColombia(raffle.scheduledDrawAt)}
              <span className="text-white/25">· Colombia</span>
            </p>
            {raffle.status === "drawn" && raffle.winningNumber != null && (
              <p className="text-primary text-sm font-bold">
                Ganador: #{raffle.winningNumber}
                {raffle.winnerUsername ? ` — ${raffle.winnerUsername}` : ""}
              </p>
            )}
            <Button
              className="w-full bg-gradient-to-r from-primary to-accent text-black font-bold"
              type="button"
            >
              {raffle.status === "open"
                ? "Elegir mis números"
                : raffle.status === "drawn"
                  ? "Ver resultado"
                  : "Ver rifa"}
            </Button>
          </div>
        </article>
      </Link>
    </motion.div>
  );
}

export default function RifasPage() {
  const { user, firebaseSignedIn, isLoading: authLoading } = useAuth();

  const { data: raffles, isLoading } = useQuery({
    queryKey: ["/api/raffles"],
    queryFn: () => apiJson<Raffle[]>("/api/raffles", "GET"),
    enabled: !!user && firebaseSignedIn && !authLoading,
    refetchInterval: 10000,
  });

  const active = (raffles ?? []).filter(
    (r) => r.status === "open" || r.status === "closed",
  );
  const finished = (raffles ?? []).filter((r) => r.status === "drawn");

  useRaffleTicker(active.some((r) => !!r.scheduledDrawAt));

  return (
    <div
      className="min-h-screen bg-background flex flex-col text-foreground"
      onClick={resumeAudio}
    >
      <Navbar />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-500/8 via-background to-background pointer-events-none" />

      <main className="flex-1 container mx-auto px-4 py-8 md:py-12 relative z-10 pb-28 md:pb-12">
        <div className="mb-10 text-center md:text-left">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-full px-4 py-1.5 mb-4">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-primary text-sm font-medium">Rifas OroDig</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-serif font-bold text-white mb-2">
            Rifas activas
          </h1>
          <p className="text-white/50 max-w-xl">
            Elige tus números, paga con tu saldo y participa. Los sorteos se realizan
            en hora de Colombia.
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-80 rounded-3xl bg-white/5 animate-pulse border border-white/5"
              />
            ))}
          </div>
        ) : active.length === 0 && finished.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-white/10 rounded-3xl">
            <Ticket className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <p className="text-white/40">No hay rifas publicadas en este momento.</p>
            <p className="text-white/25 text-sm mt-2">
              Vuelve pronto — el administrador publicará nuevas rifas.
            </p>
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <section className="mb-12">
                <h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  En curso ({active.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {active.map((r, i) => (
                    <RaffleCard key={r.id} raffle={r} index={i} />
                  ))}
                </div>
              </section>
            )}
            {finished.length > 0 && (
              <section>
                <h2 className="text-xl font-bold text-white/70 mb-5">
                  Sorteadas ({finished.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 opacity-90">
                  {finished.map((r, i) => (
                    <RaffleCard key={r.id} raffle={r} index={i} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
      <MobileNav />
    </div>
  );
}

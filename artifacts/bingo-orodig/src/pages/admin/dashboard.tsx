import { useGetDashboardStats, useListGames, useListRooms } from "@workspace/api-client-react";
import { Navbar } from "@/components/layout/Navbar";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Presentation, Gamepad2, Coins, Plus, Radio, Clock, Trophy, ArrowRight, Calendar } from "lucide-react";
import { motion } from "framer-motion";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";

const STATUS_COLORS: Record<string, string> = {
  waiting: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  playing: "bg-green-500/20 text-green-400 border-green-500/30",
  paused: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  finished: "bg-white/10 text-white/40 border-white/10",
};
const STATUS_LABELS: Record<string, string> = {
  waiting: "En espera", playing: "En vivo", paused: "Pausado", finished: "Finalizado",
};
const MODE_LABELS: Record<string, string> = {
  live: "🎙️ En Vivo", automatic: "🤖 Automático", manual: "🖱️ Manual",
};

export default function AdminDashboard() {
  const { data: stats, isLoading } = useGetDashboardStats({
    query: { queryKey: ["/api/stats/dashboard"] }
  });
  const { data: games } = useListGames({ query: { queryKey: ["/api/games"] } });
  const { data: rooms } = useListRooms({ query: { queryKey: ["/api/rooms"] } });

  const activeGames = (games as any[])?.filter((g: any) => g.status !== "finished") || [];
  const scheduledGames = (games as any[])?.filter((g: any) => (g as any).scheduledAt && g.status === "waiting") || [];

  return (
    <div className="min-h-screen bg-background flex flex-col text-foreground">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-10">

        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-10 gap-4">
          <div>
            <h1 className="text-4xl font-serif font-bold text-white mb-1">Panel de Administración</h1>
            <p className="text-white/50">Centro de control — Bingo OroDig</p>
          </div>
          <Link href="/admin/sorteos/nuevo">
            <Button className="bg-gradient-to-r from-primary to-accent text-black font-bold px-6 py-3 text-base hover:scale-105 transition-transform shadow-[0_0_20px_rgba(212,175,55,0.3)]">
              <Plus className="w-5 h-5 mr-2" /> Nuevo Sorteo
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {[
            { label: "Usuarios", value: stats?.totalUsers ?? "—", icon: Users, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
            { label: "Partidas activas", value: stats?.activeGames ?? "—", icon: Radio, color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
            { label: "Salas", value: stats?.totalRooms ?? "—", icon: Presentation, color: "text-primary", bg: "bg-primary/10 border-primary/20" },
            { label: "Ingresos", value: `$${stats?.totalRevenue ?? 0}`, icon: Coins, color: "text-accent", bg: "bg-accent/10 border-accent/20" },
          ].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className={`${s.bg} border rounded-2xl p-5 backdrop-blur`}>
              <div className="flex items-center gap-3 mb-3">
                <s.icon className={`w-5 h-5 ${s.color}`} />
                <span className="text-white/50 text-sm uppercase tracking-wide">{s.label}</span>
              </div>
              <p className={`text-3xl font-bold ${isLoading ? "text-white/20" : "text-white"}`}>{isLoading ? "..." : s.value}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Active/Upcoming Games */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2"><Radio className="w-5 h-5 text-green-400" /> Sorteos Activos y Programados</h2>
              <Link href="/admin/sorteos"><button className="text-primary text-sm hover:underline flex items-center gap-1">Ver todos <ArrowRight className="w-3 h-3" /></button></Link>
            </div>

            {activeGames.length === 0 && (
              <div className="bg-card/30 border border-white/5 rounded-2xl p-10 text-center">
                <Gamepad2 className="w-12 h-12 text-white/20 mx-auto mb-3" />
                <p className="text-white/40 mb-4">No hay sorteos activos</p>
                <Link href="/admin/sorteos/nuevo">
                  <Button className="bg-primary text-black"><Plus className="w-4 h-4 mr-1" />Crear Sorteo</Button>
                </Link>
              </div>
            )}

            {activeGames.slice(0, 5).map((game: any, i: number) => (
              <motion.div key={game.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                className="bg-card/50 border border-white/10 rounded-2xl p-5 flex items-center gap-4 hover:border-primary/30 transition-colors">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${game.status === "playing" ? "bg-green-500/20 animate-pulse" : game.status === "waiting" ? "bg-yellow-500/10" : "bg-orange-500/10"}`}>
                  {game.status === "playing" ? "🎱" : game.status === "waiting" ? "⏳" : "⏸️"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold text-white truncate">{game.title || `Sorteo #${game.id}`}</p>
                    <Badge className={STATUS_COLORS[game.status]}>{STATUS_LABELS[game.status]}</Badge>
                  </div>
                  <p className="text-sm text-white/50">
                    Sala #{game.roomId} • Premio: <span className="text-accent font-bold">${game.prize}</span> • {MODE_LABELS[game.mode] || "Manual"}
                    {game.scheduledAt && <> • <span className="text-yellow-400"><Calendar className="w-3 h-3 inline mr-1" />{format(new Date(game.scheduledAt), "d MMM HH:mm", { locale: es })}</span></>}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {game.status !== "finished" && (
                    <Link href={`/admin/sorteos/${game.id}/live`}>
                      <Button size="sm" className="bg-green-500/20 text-green-400 hover:bg-green-500 hover:text-black border border-green-500/30 font-bold">
                        <Radio className="w-3 h-3 mr-1" /> {game.status === "playing" ? "Entrar" : "Gestionar"}
                      </Button>
                    </Link>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Quick Actions + Rooms */}
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Trophy className="w-5 h-5 text-primary" /> Acciones Rápidas</h2>
              <div className="space-y-3">
                {[
                  { label: "Nuevo Sorteo", desc: "Crear y programar", href: "/admin/sorteos/nuevo", icon: Plus, color: "text-primary bg-primary/10 border-primary/20" },
                  { label: "Gestionar Sorteos", desc: "Ver, editar, borrar", href: "/admin/sorteos", icon: Gamepad2, color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
                  { label: "Gestionar Salas", desc: "Configurar salas", href: "/admin/rooms", icon: Presentation, color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
                  { label: "Gestionar Usuarios", desc: "Cuentas y saldos", href: "/admin/users", icon: Users, color: "text-green-400 bg-green-500/10 border-green-500/20" },
                ].map((a, i) => (
                  <Link key={i} href={a.href}>
                    <div className={`${a.color} border rounded-xl p-4 flex items-center gap-3 hover:scale-[1.02] transition-transform cursor-pointer`}>
                      <a.icon className="w-5 h-5 flex-shrink-0" />
                      <div>
                        <p className="font-bold text-white text-sm">{a.label}</p>
                        <p className="text-white/50 text-xs">{a.desc}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2"><Presentation className="w-5 h-5 text-primary" /> Salas Activas</h2>
              <div className="space-y-2">
                {rooms?.slice(0, 5).map((room: any) => (
                  <div key={room.id} className="bg-card/30 border border-white/5 rounded-xl p-3 flex justify-between items-center">
                    <div>
                      <p className="text-white font-medium text-sm">{room.name}</p>
                      <p className="text-white/40 text-xs capitalize">{room.type} • ${room.prize}</p>
                    </div>
                    <Badge className={room.currentGameId ? "bg-green-500/20 text-green-400 border-green-500/20" : "bg-white/5 text-white/30 border-white/10"}>
                      {room.currentGameId ? "Con partida" : "Libre"}
                    </Badge>
                  </div>
                ))}
                {!rooms?.length && <p className="text-white/30 text-sm text-center py-4">Sin salas</p>}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

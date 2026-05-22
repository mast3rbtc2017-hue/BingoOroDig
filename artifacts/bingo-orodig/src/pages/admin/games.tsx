import { useListGames, useControlGame, useDrawNumber, useGetDrawnNumbers } from "@workspace/api-client-react";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function AdminGames() {
  const { data: games, refetch } = useListGames({
    query: { queryKey: ["/api/games"] }
  });

  const relevantGames = games?.filter(g => g.status !== "finished") || [];

  return (
    <div className="min-h-screen bg-background flex flex-col text-foreground">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin">
            <Button variant="ghost" size="sm" className="text-white/60 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-1" /> Panel
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-white">Control de Partidas</h1>
          <Badge className="bg-primary/20 text-primary border-primary/30">{relevantGames.length} activas</Badge>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {relevantGames.map((game) => (
            <GameControlPanel key={game.id} game={game} onUpdate={() => refetch()} />
          ))}
          {relevantGames.length === 0 && (
            <div className="text-center py-16 bg-card/50 rounded-2xl border border-white/10">
              <p className="text-white/60 text-lg mb-4">No hay partidas activas</p>
              <p className="text-white/40 text-sm">Ve a <strong className="text-primary">Gestionar Salas</strong> y presiona <strong className="text-primary">Crear Partida</strong> en cualquier sala</p>
              <Link href="/admin/rooms">
                <Button className="mt-4 bg-primary text-black">Ir a Salas</Button>
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  waiting: "Esperando jugadores",
  playing: "En juego",
  paused: "Pausada",
  finished: "Finalizada",
};

const STATUS_COLORS: Record<string, string> = {
  waiting: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  playing: "bg-green-500/20 text-green-400 border-green-500/30",
  paused: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  finished: "bg-white/10 text-white/40",
};

function GameControlPanel({ game, onUpdate }: { game: any, onUpdate: () => void }) {
  const controlMutation = useControlGame();
  const drawMutation = useDrawNumber();

  const { data: drawnNumbers, refetch: refetchDrawn } = useGetDrawnNumbers(game.id, {
    query: { enabled: !!game.id, queryKey: ["/api/games", game.id, "numbers"] }
  });

  const handleAction = (action: string) => {
    controlMutation.mutate(
      { id: game.id, data: { action: action as any } },
      {
        onSuccess: () => {
          const msgs: Record<string, string> = { start: "¡Partida iniciada!", pause: "Partida pausada", resume: "Partida reanudada", finish: "Partida finalizada" };
          toast.success(msgs[action] || "Acción ejecutada");
          onUpdate();
        },
        onError: (e) => toast.error(e.message)
      }
    );
  };

  const handleDraw = () => {
    drawMutation.mutate(
      { id: game.id },
      {
        onSuccess: () => refetchDrawn(),
        onError: (e) => toast.error(e.message)
      }
    );
  };

  return (
    <div className="bg-card/50 backdrop-blur rounded-2xl border border-white/10 p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-xl font-bold text-white">Partida #{game.id}</h2>
            <Badge className={STATUS_COLORS[game.status]}>{STATUS_LABELS[game.status] || game.status}</Badge>
          </div>
          <p className="text-white/60 text-sm">
            Sala #{game.roomId} • Patrón: <span className="text-primary">{game.patternType}</span> •
            Premio: <span className="text-accent font-bold">${game.prize}</span>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {game.status === "waiting" && (
            <Button className="bg-green-500 hover:bg-green-400 text-black font-bold" onClick={() => handleAction("start")}
              disabled={controlMutation.isPending}>
              ▶ Iniciar Partida
            </Button>
          )}
          {game.status === "playing" && (
            <>
              <Button variant="outline" className="border-yellow-500 text-yellow-500 hover:bg-yellow-500/10" onClick={() => handleAction("pause")} disabled={controlMutation.isPending}>Pausar</Button>
              <Button variant="outline" className="border-red-500 text-red-500 hover:bg-red-500/10" onClick={() => handleAction("finish")} disabled={controlMutation.isPending}>Finalizar</Button>
            </>
          )}
          {game.status === "paused" && (
            <Button variant="outline" className="border-green-500 text-green-500 hover:bg-green-500/10" onClick={() => handleAction("resume")} disabled={controlMutation.isPending}>Reanudar</Button>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1">
          <p className="text-sm font-bold text-white/60 mb-2 uppercase tracking-wider">
            Números sorteados ({drawnNumbers?.length || 0}/75)
          </p>
          <div className="flex flex-wrap gap-2 min-h-16 p-4 bg-black/40 rounded-xl border border-white/5">
            {drawnNumbers?.map((b) => (
              <div key={b.id} className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/60 to-accent/60 border border-primary/50 flex items-center justify-center font-bold text-black text-xs shadow-md">
                {b.letter}{b.number}
              </div>
            ))}
            {(!drawnNumbers || drawnNumbers.length === 0) && (
              <span className="text-white/40 my-auto mx-auto text-sm">
                {game.status === "waiting" ? "Inicia la partida para sortear" : "Sin números sorteados aún"}
              </span>
            )}
          </div>
        </div>

        <div className="w-full md:w-56 flex flex-col gap-3 justify-center">
          <Button
            className="w-full h-20 text-xl font-black bg-gradient-to-r from-primary to-accent text-black hover:scale-105 transition-transform disabled:opacity-40"
            onClick={handleDraw}
            disabled={game.status !== "playing" || drawMutation.isPending}
          >
            {drawMutation.isPending ? "..." : "🎱 SORTEAR"}
          </Button>
          <p className="text-center text-xs text-white/40">
            {game.status === "waiting" ? "Inicia la partida primero" :
             game.status === "playing" ? "Sorteo manual de bola" :
             "Partida no activa"}
          </p>
        </div>
      </div>
    </div>
  );
}

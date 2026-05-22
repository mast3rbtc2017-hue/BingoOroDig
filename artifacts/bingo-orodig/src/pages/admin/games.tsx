import { useListGames, useControlGame, useDrawNumber, useGetDrawnNumbers } from "@workspace/api-client-react";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function AdminGames() {
  const { data: games, refetch } = useListGames({
    query: { queryKey: ["/api/games"] }
  });

  const activeGames = games?.filter(g => g.status === 'playing' || g.status === 'paused') || [];

  return (
    <div className="min-h-screen bg-background flex flex-col text-foreground">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-white mb-8">Control de Partidas</h1>

        <div className="grid grid-cols-1 gap-6">
          {activeGames.map((game) => (
            <GameControlPanel key={game.id} game={game} onUpdate={() => refetch()} />
          ))}
          {activeGames.length === 0 && (
            <div className="text-center py-12 bg-card/50 rounded-2xl border border-white/10">
              <p className="text-white/60">No hay partidas activas en este momento.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function GameControlPanel({ game, onUpdate }: { game: any, onUpdate: () => void }) {
  const controlMutation = useControlGame();
  const drawMutation = useDrawNumber();

  const { data: drawnNumbers, refetch: refetchDrawn } = useGetDrawnNumbers(game.id, {
    query: { enabled: !!game.id, queryKey: ["/api/games", game.id, "numbers"] }
  });

  const handleAction = (action: any) => {
    controlMutation.mutate(
      { id: game.id, data: { action } },
      {
        onSuccess: () => {
          toast.success(`Partida ${action === 'pause' ? 'pausada' : action === 'resume' ? 'reanudada' : 'finalizada'}`);
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
        onSuccess: () => {
          refetchDrawn();
        },
        onError: (e) => toast.error(e.message)
      }
    );
  };

  return (
    <div className="bg-card/50 backdrop-blur rounded-2xl border border-white/10 p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Partida #{game.id}</h2>
          <p className="text-white/60 text-sm">Sala #{game.roomId} • Patrón: {game.patternType}</p>
        </div>
        <div className="flex gap-2">
          {game.status === 'playing' ? (
            <>
              <Button variant="outline" className="border-yellow-500 text-yellow-500" onClick={() => handleAction('pause')}>Pausar</Button>
              <Button variant="outline" className="border-red-500 text-red-500" onClick={() => handleAction('finish')}>Finalizar</Button>
            </>
          ) : (
            <Button variant="outline" className="border-green-500 text-green-500" onClick={() => handleAction('resume')}>Reanudar</Button>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1">
          <p className="text-sm font-bold text-white/60 mb-2 uppercase tracking-wider">Números Sorteados</p>
          <div className="flex flex-wrap gap-2 min-h-16 p-4 bg-black/40 rounded-xl border border-white/5">
            {drawnNumbers?.map((b) => (
              <div key={b.id} className="w-10 h-10 rounded-full bg-black/80 border border-primary/50 flex items-center justify-center font-bold text-white shadow-md">
                {b.letter}{b.number}
              </div>
            ))}
            {(!drawnNumbers || drawnNumbers.length === 0) && (
              <span className="text-white/40 my-auto mx-auto">Sin números sorteados aún</span>
            )}
          </div>
        </div>

        <div className="w-full md:w-64 flex flex-col justify-center">
          <Button
            className="w-full h-24 text-2xl font-black bg-gradient-to-r from-primary to-accent text-black hover:scale-105 transition-transform"
            onClick={handleDraw}
            disabled={game.status !== 'playing' || drawMutation.isPending}
          >
            SORTEAR BOLA
          </Button>
        </div>
      </div>
    </div>
  );
}

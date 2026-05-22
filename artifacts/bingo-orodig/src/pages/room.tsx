import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "wouter";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/lib/auth";
import { useGetRoom, useGetGame, useListMyCards, useGetChatMessages, useSendChatMessage, useBuyCard } from "@workspace/api-client-react";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";

export default function Room() {
  const { id } = useParams();
  const roomId = parseInt(id!);
  const { user } = useAuth();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [drawnNumbers, setDrawnNumbers] = useState<Array<{number: number, letter: string}>>([]);
  const [playerCount, setPlayerCount] = useState(0);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [winner, setWinner] = useState<any | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: room, refetch: refetchRoom } = useGetRoom(roomId, {
    query: { enabled: !!roomId, queryKey: ["/api/rooms", roomId] }
  });

  const { data: game, refetch: refetchGame } = useGetGame(room?.currentGameId || 0, {
    query: { enabled: !!room?.currentGameId, queryKey: ["/api/games", room?.currentGameId] }
  });

  const { data: cards, refetch: refetchCards } = useListMyCards({
    query: { enabled: !!user, queryKey: ["/api/cards"] }
  });

  const roomCards = cards?.filter(c => c.roomId === roomId) || [];

  const buyCardMutation = useBuyCard();
  const sendChatMutation = useSendChatMessage();

  useEffect(() => {
    if (!roomId) return;

    const socketUrl = window.location.origin;
    const newSocket = io(socketUrl, { path: "/api/socket.io" });

    newSocket.on("connect", () => {
      newSocket.emit("join_room", { roomId });
    });

    newSocket.on("player_joined", (data: any) => {
      if (data.roomId === roomId) setPlayerCount(data.playerCount);
    });

    newSocket.on("player_left", (data: any) => {
      if (data.roomId === roomId) setPlayerCount(data.playerCount);
    });

    newSocket.on("ball_drawn", (data: any) => {
      if (data.gameId === room?.currentGameId) {
        setDrawnNumbers(prev => [...prev, { number: data.number, letter: data.letter }]);
        refetchCards();
      }
    });

    newSocket.on("game_state", (data: any) => {
      if (data.roomId === roomId) {
        refetchRoom();
        refetchGame();
      }
    });

    newSocket.on("chat_message", (data: any) => {
      if (data.roomId === roomId) {
        setChatMessages(prev => [...prev, data.message]);
        setTimeout(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }
        }, 100);
      }
    });

    newSocket.on("winner", (data: any) => {
      if (data.gameId === room?.currentGameId) {
        setWinner(data);
        triggerConfetti();
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.emit("leave_room", { roomId });
      newSocket.disconnect();
    };
  }, [roomId, room?.currentGameId]);

  const triggerConfetti = () => {
    const duration = 5 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };
    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) return clearInterval(interval);
      const particleCount = 50 * (timeLeft / duration);
      confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
      confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
    }, 250);
  };

  const handleBuyCard = () => {
    if (!room?.currentGameId) {
      toast.error("No hay una partida activa en esta sala ahora mismo.");
      return;
    }

    buyCardMutation.mutate(
      { data: { gameId: room.currentGameId, quantity: 1 } },
      {
        onSuccess: () => {
          toast.success("¡Cartón comprado con éxito!");
          refetchCards();
        },
        onError: (err) => {
          toast.error("Error al comprar cartón: " + err.message);
        }
      }
    );
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    sendChatMutation.mutate(
      { data: { content: chatInput } },
      {
        onSuccess: () => setChatInput("")
      }
    );
  };

  const currentBall = drawnNumbers.length > 0 ? drawnNumbers[drawnNumbers.length - 1] : null;

  return (
    <div className="min-h-screen bg-background flex flex-col text-foreground overflow-hidden">
      <Navbar />

      <main className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-5rem)] overflow-hidden">

        <div className="flex-1 flex flex-col p-4 overflow-y-auto">
          <div className="flex items-center justify-between bg-card/80 backdrop-blur border border-white/10 p-4 rounded-2xl mb-4">
            <div>
              <h2 className="text-2xl font-bold text-white">{room?.name}</h2>
              <p className="text-sm text-white/60">Premio: <span className="text-accent font-bold">${room?.prize}</span> • Patrón: {room?.patternType}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center bg-black/40 px-4 py-2 rounded-xl border border-white/5">
                <p className="text-xs text-white/60 uppercase">Jugadores</p>
                <p className="font-bold text-white">{playerCount}</p>
              </div>
              <div className="text-center bg-black/40 px-4 py-2 rounded-xl border border-white/5">
                <p className="text-xs text-white/60 uppercase">Estado</p>
                <p className="font-bold text-primary">{game?.status || room?.status}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="bg-card/80 backdrop-blur border border-white/10 p-6 rounded-2xl flex flex-col items-center justify-center min-w-[200px]">
              <p className="text-sm text-white/60 uppercase tracking-widest mb-4">Bola Actual</p>
              <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-primary to-accent shadow-[0_0_30px_rgba(212,175,55,0.4)] flex items-center justify-center border-[4px] border-white/20">
                {currentBall ? (
                  <motion.div
                    key={currentBall.number}
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className="text-center"
                  >
                    <div className="text-2xl font-bold text-black/80">{currentBall.letter}</div>
                    <div className="text-5xl font-black text-black leading-none">{currentBall.number}</div>
                  </motion.div>
                ) : (
                  <span className="text-black/50 font-bold">Esperando...</span>
                )}
              </div>
            </div>

            <div className="flex-1 bg-card/80 backdrop-blur border border-white/10 p-4 rounded-2xl flex flex-col">
              <p className="text-sm text-white/60 uppercase tracking-widest mb-2">Historial</p>
              <ScrollArea className="flex-1 w-full h-32">
                <div className="flex flex-wrap gap-2">
                  <AnimatePresence>
                    {drawnNumbers.map((b, i) => (
                      <motion.div
                        key={`${b.letter}${b.number}-${i}`}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-10 h-10 rounded-full bg-black/60 border border-primary/30 flex items-center justify-center text-sm font-bold text-white"
                      >
                        {b.letter}{b.number}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </ScrollArea>
            </div>
          </div>

          <div className="flex-1 bg-black/20 rounded-2xl border border-white/5 p-4 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Mis Cartones</h3>
              <Button onClick={handleBuyCard} disabled={!room?.currentGameId || room?.status === 'playing'} className="bg-primary text-black hover:bg-accent font-bold">
                Comprar Cartón (${room?.cardPrice})
              </Button>
            </div>

            <ScrollArea className="flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-8">
                {roomCards.map(card => (
                  <BingoCard key={card.id} card={card} drawnNumbers={drawnNumbers.map(n => n.number)} />
                ))}

                {roomCards.length === 0 && (
                  <div className="col-span-full h-48 flex items-center justify-center text-white/40 border-2 border-dashed border-white/10 rounded-2xl">
                    Aún no tienes cartones para esta partida.
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <div className="w-full lg:w-80 border-l border-white/10 bg-card/40 backdrop-blur flex flex-col">
          <div className="p-4 border-b border-white/10">
            <h3 className="font-bold text-white">Chat en Vivo</h3>
          </div>

          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-4"
          >
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.type === 'system' ? 'items-center text-center' : ''}`}>
                {msg.type === 'system' ? (
                  <span className="text-xs text-primary/80 bg-primary/10 px-2 py-1 rounded-full">{msg.content}</span>
                ) : (
                  <div className="bg-black/40 p-2 rounded-lg border border-white/5 inline-block max-w-[90%]">
                    <span className="text-xs font-bold text-primary mr-2">{msg.username}</span>
                    <span className="text-sm text-white/90">{msg.content}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <form onSubmit={handleSendChat} className="p-4 border-t border-white/10 flex gap-2">
            <Input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="Escribe algo..."
              className="bg-black/40 border-white/10 text-white"
            />
            <Button type="submit" disabled={!chatInput.trim() || sendChatMutation.isPending} className="bg-primary/20 text-primary hover:bg-primary/30">
              Enviar
            </Button>
          </form>
        </div>
      </main>

      <AnimatePresence>
        {winner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-gradient-to-b from-card to-background border border-primary p-8 rounded-3xl max-w-md w-full text-center shadow-[0_0_100px_rgba(212,175,55,0.4)]"
            >
              <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent mb-4 uppercase tracking-widest">¡Bingo!</h2>
              <p className="text-xl text-white mb-2"><span className="font-bold">{winner.username}</span> ganó la partida</p>
              <div className="text-4xl font-bold text-white my-6 bg-black/40 py-4 rounded-xl border border-white/10">
                ${winner.prize}
              </div>
              <Button onClick={() => setWinner(null)} className="w-full bg-primary text-black hover:bg-accent">
                Cerrar
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BingoCard({ card, drawnNumbers }: { card: any, drawnNumbers: number[] }) {
  let grid: number[][] = [];
  try {
    grid = JSON.parse(card.numbers);
  } catch (e) {
    return null;
  }

  let marked: number[] = [];
  try {
    marked = JSON.parse(card.markedNumbers || '[]');
  } catch (e) {}

  const isMarked = (num: number, r: number, c: number) => {
    if (r === 2 && c === 2) return true;
    return marked.includes(num) || drawnNumbers.includes(num);
  };

  const letters = ['B', 'I', 'N', 'G', 'O'];

  return (
    <div className="bg-card border-2 border-primary/30 rounded-2xl overflow-hidden shadow-lg shadow-black/50">
      <div className="bg-gradient-to-r from-primary/80 to-accent/80 p-2 flex justify-between px-6 text-black font-black text-2xl tracking-widest">
        {letters.map((l, i) => <span key={i}>{l}</span>)}
      </div>
      <div className="p-2 grid grid-cols-5 gap-1 bg-black/40">
        {grid.map((col, cIndex) =>
          col.map((num, rIndex) => {
            const marked = isMarked(num, rIndex, cIndex);
            const isFree = rIndex === 2 && cIndex === 2;

            return (
              <div
                key={`${cIndex}-${rIndex}`}
                className={`
                  aspect-square rounded-lg flex items-center justify-center text-lg font-bold transition-all duration-300
                  ${marked
                    ? 'bg-gradient-to-br from-primary to-accent text-black shadow-[inset_0_0_10px_rgba(255,255,255,0.5)] scale-95'
                    : 'bg-card border border-white/5 text-white/80 hover:bg-white/5'}
                `}
                style={{ gridColumn: cIndex + 1, gridRow: rIndex + 1 }}
              >
                {isFree ? '★' : num}
              </div>
            );
          })
        )}
      </div>
      <div className="bg-black/60 p-2 text-center text-xs text-white/40">
        Cartón #{card.id}
      </div>
    </div>
  );
}

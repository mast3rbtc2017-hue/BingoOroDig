import { useCallback, useEffect, useState, useRef } from "react";
import { useParams, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { useGetRoom, useGetGame, useListMyCards, useSendChatMessage, useBuyCard } from "@workspace/api-client-react";
import { useGameDrawnNumbers, useGameLive, useGameWinner, useRoomLive, useRoomMessages } from "@/lib/realtime";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { MessageCircle, X, ChevronUp, ChevronDown, Radio, Calendar, Timer, Trophy } from "lucide-react";
import { apiJson } from "@/lib/api-fetch";
import { sounds, resumeAudio } from "@/lib/sounds";
import { useCountdown, formatScheduledLocal } from "@/lib/countdown";
import { useScheduleTicker } from "@/lib/useScheduleTicker";

const PATTERN_LABELS: Record<string, string> = {
  line: "Línea", diagonal: "Diagonal", corners: "Esquinas", x: "X", fullCard: "Cartón lleno"
};
const STATUS_LABELS: Record<string, string> = {
  waiting: "Esperando", playing: "En juego", paused: "Pausada", finished: "Finalizada", active: "Abierta"
};
const STATUS_COLORS: Record<string, string> = {
  playing: "bg-green-500/20 text-green-400 border-green-500/30",
  waiting: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  paused: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  finished: "bg-red-500/20 text-red-400 border-red-500/30",
  active: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

export default function Room() {
  const { id } = useParams();
  const roomId = parseInt(id!);
  const { user } = useAuth();

  const [playerCount, setPlayerCount] = useState(0);
  const [chatInput, setChatInput] = useState("");
  const [prevBallCount, setPrevBallCount] = useState(0);
  const [claimingCard, setClaimingCard] = useState<number | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [winnerDismissed, setWinnerDismissed] = useState(false);
  const [bingoFlash, setBingoFlash] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: room, refetch: refetchRoom } = useGetRoom(roomId, {
    query: { enabled: !!roomId, queryKey: ["/api/rooms", roomId], refetchInterval: 5000 },
  });
  const activeGameId =
    room?.currentGameId != null && room.currentGameId > 0
      ? room.currentGameId
      : undefined;
  const { data: game, refetch: refetchGame } = useGetGame(activeGameId ?? 0, {
    query: {
      enabled: !!activeGameId,
      queryKey: ["/api/games", activeGameId],
      retry: false,
      refetchInterval: 5000,
    },
  });

  const isScheduledWaiting = game?.status === "waiting" && !!game?.scheduledAt;
  useScheduleTicker(isScheduledWaiting);
  const countdown = useCountdown(isScheduledWaiting ? game?.scheduledAt ?? null : null);
  const { data: cards, refetch: refetchCards } = useListMyCards({
    query: { enabled: !!user, queryKey: ["/api/cards"] }
  });

  const roomCards = cards?.filter(c => c.roomId === roomId) || [];
  const gameCards = roomCards.filter(c => c.gameId === room?.currentGameId);
  const buyCardMutation = useBuyCard();
  const sendChatMutation = useSendChatMessage();
  const liveDrawn = useGameDrawnNumbers(activeGameId);
  const chatMessages = useRoomMessages(roomId);
  const winner = useGameWinner(activeGameId);

  const allDrawn = liveDrawn;

  const onRoomUpdate = useCallback(() => {
    refetchRoom();
    refetchCards();
  }, [refetchRoom, refetchCards]);

  const onGameUpdate = useCallback(() => {
    refetchGame();
    refetchCards();
  }, [refetchGame, refetchCards]);

  useRoomLive(roomId, onRoomUpdate);
  useGameLive(activeGameId, onGameUpdate);

  useEffect(() => {
    resumeAudio();
  }, []);

  useEffect(() => {
    if (room?.playerCount != null) setPlayerCount(room.playerCount);
  }, [room?.playerCount]);

  useEffect(() => {
    if (allDrawn.length > prevBallCount && prevBallCount > 0) {
      sounds.ballDraw();
      refetchCards();
    }
    setPrevBallCount(allDrawn.length);
  }, [allDrawn.length, prevBallCount, refetchCards]);

  useEffect(() => {
    if (!winner) return;
    setWinnerDismissed(false);
    sounds.win();
    triggerConfetti();
    refetchRoom();
    refetchGame();
  }, [winner, refetchRoom, refetchGame]);

  useEffect(() => {
    if (chatMessages.length === 0) return;
    setChatOpen((open) => {
      if (!open) setUnread((u) => u + 1);
      return open;
    });
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, 100);
  }, [chatMessages.length]);

  // Clear unread when chat opens
  useEffect(() => { if (chatOpen) setUnread(0); }, [chatOpen]);

  const triggerConfetti = () => {
    const end = Date.now() + 5000;
    const rand = (a: number, b: number) => Math.random() * (b - a) + a;
    const iv: any = setInterval(() => {
      if (Date.now() > end) return clearInterval(iv);
      const pc = 50 * ((end - Date.now()) / 5000);
      confetti({ startVelocity: 30, spread: 360, ticks: 60, zIndex: 100, particleCount: pc, origin: { x: rand(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ startVelocity: 30, spread: 360, ticks: 60, zIndex: 100, particleCount: pc, origin: { x: rand(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);
  };

  const handleBuyCard = () => {
    if (!room?.currentGameId) { toast.error("No hay una partida creada en esta sala."); return; }
    if (game?.status === "finished") { toast.error("La partida ya terminó."); return; }
    sounds.buy();
    buyCardMutation.mutate(
      { data: { gameId: room.currentGameId, quantity: 1 } },
      { onSuccess: () => { toast.success("¡Cartón comprado!"); refetchCards(); }, onError: (err) => toast.error(err.message) }
    );
  };

  const handleClaimBingo = async (cardId: number, pattern: string) => {
    setClaimingCard(cardId);
    try {
      const data = await apiJson<{ status: string; message: string; prize?: number }>(
        `/api/cards/${cardId}/claim`,
        "POST",
        { pattern },
      );
      if (data.status === "pending") {
        setBingoFlash("¡BINGO! 🎉\nEsperando verificación del administrador");
        sounds.win();
        toast.success(data.message, { duration: 6000 });
      } else {
        setBingoFlash(`¡GANASTE! 🏆\n+$${data.prize ?? 0}`);
        sounds.win();
        triggerConfetti();
      }
      refetchCards();
      refetchGame();
      refetchRoom();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al reclamar");
    } finally {
      setClaimingCard(null);
    }
  };

  useEffect(() => {
    if (!bingoFlash) return;
    const t = setTimeout(() => setBingoFlash(null), 4500);
    return () => clearTimeout(t);
  }, [bingoFlash]);

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sounds.click();
    sendChatMutation.mutate({ roomId, data: { content: chatInput } }, { onSuccess: () => setChatInput("") });
  };

  const currentBall = allDrawn.length > 0 ? allDrawn[allDrawn.length - 1] : null;
  const isFinished = game?.status === "finished";
  const canBuyCard = !!room?.currentGameId && !isFinished && game?.status !== "paused";
  const claimPattern = game?.patternType || room?.patternType || "line";
  const gameStatus = game?.status || room?.status || "active";
  const drawnPct = Math.round((allDrawn.length / 75) * 100);

  return (
    <div className="min-h-screen bg-background flex flex-col text-foreground" onClick={resumeAudio}>
      <Navbar />

      {/* Progress bar */}
      {allDrawn.length > 0 && (
        <div className="sticky top-16 md:top-20 z-30 w-full bg-black/80 backdrop-blur border-b border-white/5">
          <div className="h-1 bg-white/5 w-full">
            <motion.div className="h-full bg-gradient-to-r from-primary to-accent"
              initial={{ width: 0 }} animate={{ width: `${drawnPct}%` }} transition={{ duration: 0.4 }} />
          </div>
          <div className="container mx-auto px-3 py-1.5 flex items-center justify-between text-xs text-white/40">
            <span>Sala: <span className="text-white/70">{room?.name}</span></span>
            <span className="flex items-center gap-2">
              <Badge className={`${STATUS_COLORS[gameStatus]} text-[10px] py-0 h-5`}>{STATUS_LABELS[gameStatus]}</Badge>
              <span>{allDrawn.length}/75 bolas</span>
            </span>
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden" style={{ height: "calc(100dvh - 4rem - (allDrawn.length > 0 ? 2.25rem : 0))" }}>

        {/* Main game area */}
        <div className="flex-1 flex flex-col overflow-y-auto">

          {/* Room header */}
          <div className="p-3 md:p-5 flex flex-col gap-3">
            <div className="flex items-start justify-between bg-card/80 backdrop-blur border border-white/10 p-3 md:p-4 rounded-xl md:rounded-2xl gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg md:text-2xl font-bold text-white truncate">{room?.name}</h2>
                  <Badge className={`${STATUS_COLORS[gameStatus]} text-xs hidden sm:flex`}>{STATUS_LABELS[gameStatus]}</Badge>
                </div>
                <p className="text-xs md:text-sm text-white/50 mt-0.5 flex flex-wrap gap-x-2">
                  <span>Premio: <span className="text-accent font-bold">${room?.prize}</span></span>
                  <span>Patrón: <span className="text-primary">{PATTERN_LABELS[room?.patternType || ""] || room?.patternType}</span></span>
                  <span>Cartón: <span className="text-white/70">${room?.cardPrice}</span></span>
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-center bg-black/40 px-3 py-1.5 rounded-xl border border-white/5">
                  <p className="text-[10px] text-white/40 uppercase">Jugadores</p>
                  <p className="font-bold text-white text-sm">{playerCount}</p>
                </div>
              </div>
            </div>

            {isScheduledWaiting && countdown && (
              <div className="bg-gradient-to-r from-yellow-500/15 to-primary/10 border border-yellow-500/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Calendar className="w-8 h-8 text-yellow-400 shrink-0" />
                  <div>
                    <p className="text-white/50 text-xs uppercase tracking-wider">Sorteo programado</p>
                    <p className="text-white font-medium text-sm">{formatScheduledLocal(game!.scheduledAt!)}</p>
                  </div>
                </div>
                <div className="text-center sm:text-right">
                  <p className="text-white/40 text-[10px] uppercase tracking-widest mb-0.5">Inicia en</p>
                  <p className="text-3xl md:text-4xl font-black text-yellow-400 tabular-nums">{countdown.label}</p>
                </div>
              </div>
            )}

            {isFinished && (
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-sm">
                <Trophy className="w-5 h-5 text-primary shrink-0" />
                <div>
                  <p className="text-white font-medium">Este sorteo ya finalizó</p>
                  <p className="text-white/50 text-xs">
                    {winner
                      ? `Ganador: ${winner.username} — $${winner.prize}`
                      : "No puedes comprar cartones ni cantar BINGO. El admin puede eliminar el sorteo desde el panel."}
                  </p>
                </div>
              </div>
            )}

            {game?.status === "playing" && (
              <div className="flex items-center gap-2 flex-wrap bg-green-500/10 border border-green-500/30 rounded-xl px-3 py-2 text-sm text-green-400">
                <Radio className="w-4 h-4 animate-pulse shrink-0" />
                <span>Sorteo en vivo</span>
                <span className="text-white/30">·</span>
                <Timer className="w-3.5 h-3.5" />
                <span>Bola cada {game.ballInterval ?? room?.ballInterval ?? 5}s</span>
                <span className="text-white/30">·</span>
                <span>{allDrawn.length}/75 bolas</span>
              </div>
            )}

            {/* Ball + History row */}
            <div className="flex gap-3 items-stretch">
              {/* Current ball */}
              <div className="bg-card/80 backdrop-blur border border-white/10 p-3 md:p-5 rounded-xl md:rounded-2xl flex flex-col items-center justify-center w-28 md:w-40 shrink-0">
                <p className="text-[10px] md:text-xs text-white/40 uppercase tracking-widest mb-2">Bola</p>
                <div className="relative w-16 h-16 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-primary to-accent shadow-[0_0_20px_rgba(212,175,55,0.4)] flex items-center justify-center border-[3px] border-white/20">
                  {currentBall ? (
                    <motion.div key={currentBall.number} initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} className="text-center leading-none">
                      <div className="text-[10px] md:text-sm font-bold text-black/70">{currentBall.letter}</div>
                      <div className="text-xl md:text-4xl font-black text-black">{currentBall.number}</div>
                    </motion.div>
                  ) : (
                    <span className="text-black/40 font-bold text-xs text-center">{gameStatus === "waiting" ? "Pronto" : "—"}</span>
                  )}
                </div>
                {allDrawn.length > 0 && <p className="text-[10px] text-white/30 mt-1.5">{allDrawn.length}/75</p>}
              </div>

              {/* History */}
              <div className="flex-1 bg-card/80 backdrop-blur border border-white/10 p-3 md:p-4 rounded-xl md:rounded-2xl flex flex-col min-w-0">
                <p className="text-[10px] md:text-xs text-white/40 uppercase tracking-widest mb-2">Historial</p>
                <div className="flex flex-wrap gap-1 md:gap-1.5 overflow-hidden" style={{ maxHeight: "5.5rem" }}>
                  <AnimatePresence>
                    {[...allDrawn].reverse().slice(0, 30).map((b, i) => (
                      <motion.div key={`${b.letter}${b.number}-${i}`} initial={{ scale: 0 }} animate={{ scale: 1 }}
                        className={`rounded-full flex items-center justify-center font-bold transition-all
                          w-8 h-8 md:w-10 md:h-10 text-[10px] md:text-xs
                          ${i === 0 ? "bg-gradient-to-br from-primary to-accent text-black shadow-[0_0_6px_rgba(212,175,55,0.5)]" : "bg-black/60 border border-white/10 text-white/60"}`}>
                        {b.letter}{b.number}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {allDrawn.length === 0 && <span className="text-white/20 text-xs my-auto">Sin bolas aún</span>}
                </div>
              </div>
            </div>

            {/* Buy card button */}
            <div className="flex items-center justify-between bg-black/40 border border-white/5 rounded-xl p-3">
              <div>
                <p className="text-sm font-bold text-white">Mis Cartones <span className="text-primary">({gameCards.length})</span></p>
                {!room?.currentGameId && <p className="text-xs text-white/30">Sin partida activa</p>}
              </div>
              <Button onClick={handleBuyCard} disabled={!canBuyCard || buyCardMutation.isPending}
                className="bg-gradient-to-r from-primary to-accent text-black font-bold text-sm h-9 px-4 hover:scale-105 transition-transform">
                {buyCardMutation.isPending ? "..." : `+ Cartón ($${room?.cardPrice})`}
              </Button>
            </div>
          </div>

          {/* Cards grid */}
          <div className="flex-1 px-3 md:px-5 pb-6">
            {!room?.currentGameId ? (
              <div className="h-32 flex items-center justify-center text-white/30 border-2 border-dashed border-white/10 rounded-2xl">
                <p className="text-sm text-center px-4">El administrador debe crear una partida</p>
              </div>
            ) : gameCards.length === 0 ? (
              <div className="h-32 flex items-center justify-center border-2 border-dashed border-white/10 rounded-2xl">
                <div className="text-center">
                  <p className="text-white/40 text-sm">Sin cartones para esta partida</p>
                  <p className="text-primary text-xs mt-1">¡Compra uno y empieza a jugar!</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-5">
                {gameCards.map(card => (
                  <BingoCard
                    key={card.id} card={card}
                    drawnNumbers={allDrawn.map(n => n.number)}
                    patternType={claimPattern}
                    gameStatus={gameStatus}
                    onClaim={(pattern) => handleClaimBingo(card.id, pattern)}
                    isClaiming={claimingCard === card.id}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Desktop chat sidebar */}
        <div className="hidden lg:flex w-80 flex-col border-l border-white/10 bg-card/40 backdrop-blur">
          <div className="p-4 border-b border-white/10 flex items-center gap-2">
            <Radio className="w-4 h-4 text-green-400 animate-pulse" />
            <h3 className="font-bold text-white">Chat en Vivo</h3>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
            <ChatMessages messages={chatMessages} />
          </div>
          <form onSubmit={handleSendChat} className="p-4 border-t border-white/10 flex gap-2">
            <Input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Escribe algo..."
              className="bg-black/40 border-white/10 text-white" />
            <Button type="submit" disabled={!chatInput.trim() || sendChatMutation.isPending}
              className="bg-primary/20 text-primary hover:bg-primary/30">Enviar</Button>
          </form>
        </div>
      </main>

      {/* Mobile chat floating button + bottom sheet */}
      <div className="lg:hidden">
        {/* Toggle button */}
        <button onClick={() => setChatOpen(v => !v)}
          className="fixed bottom-4 right-4 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-primary to-accent text-black shadow-[0_0_20px_rgba(212,175,55,0.4)] flex items-center justify-center">
          <MessageCircle className="w-6 h-6" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>

        {/* Chat sheet */}
        <AnimatePresence>
          {chatOpen && (
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-background/98 backdrop-blur-xl border-t border-white/10 flex flex-col"
              style={{ height: "65dvh" }}
            >
              <div className="flex items-center justify-between p-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-green-400 animate-pulse" />
                  <span className="font-bold text-white text-sm">Chat en Vivo</span>
                </div>
                <button onClick={() => setChatOpen(false)} className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-white/60">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
                <ChatMessages messages={chatMessages} />
              </div>
              <form onSubmit={handleSendChat} className="p-3 border-t border-white/10 flex gap-2" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
                <Input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Escribe algo..."
                  className="bg-black/40 border-white/10 text-white" />
                <Button type="submit" disabled={!chatInput.trim() || sendChatMutation.isPending}
                  className="bg-primary/20 text-primary hover:bg-primary/30 shrink-0">Enviar</Button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Flash BINGO overlay */}
      <AnimatePresence>
        {bingoFlash && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -30 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none px-6"
          >
            <div className="bg-gradient-to-br from-primary via-accent to-yellow-300 text-black px-10 py-8 rounded-3xl shadow-[0_0_80px_rgba(212,175,55,0.8)] text-center max-w-sm">
              <p className="text-4xl md:text-5xl font-black whitespace-pre-line leading-tight">{bingoFlash}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Winner Modal */}
      <AnimatePresence>
        {winner && !winnerDismissed && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.8, y: 50 }} animate={{ scale: 1, y: 0 }}
              className="bg-gradient-to-b from-card to-background border border-primary p-6 md:p-8 rounded-3xl max-w-sm w-full text-center shadow-[0_0_100px_rgba(212,175,55,0.4)]">
              <h2 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent mb-4 uppercase tracking-widest">¡BINGO!</h2>
              <p className="text-lg md:text-xl text-white mb-2">
                <span className="font-bold text-accent">{winner.username}</span> ganó la partida
              </p>
              <div className="text-3xl md:text-4xl font-bold text-white my-5 bg-black/40 py-4 rounded-xl border border-white/10">${winner.prize}</div>
              <Button onClick={() => setWinnerDismissed(true)} className="w-full bg-gradient-to-r from-primary to-accent text-black font-bold">¡Genial!</Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChatMessages({ messages }: { messages: any[] }) {
  return (
    <>
      {messages.map((msg, i) => (
        <div key={i} className={`flex flex-col ${msg.type === "system" ? "items-center" : ""}`}>
          {msg.type === "system" ? (
            <span className="text-xs text-primary/80 bg-primary/10 px-2 py-1 rounded-full">{msg.content}</span>
          ) : (
            <div className="bg-black/40 p-2 rounded-lg border border-white/5 max-w-[90%]">
              <span className="text-xs font-bold text-primary mr-2">{msg.username}</span>
              <span className="text-sm text-white/90">{msg.content}</span>
            </div>
          )}
        </div>
      ))}
      {messages.length === 0 && (
        <p className="text-white/25 text-xs text-center mt-8">Sé el primero en escribir...</p>
      )}
    </>
  );
}

function BingoCard({ card, drawnNumbers, patternType, gameStatus, onClaim, isClaiming }:
  { card: any, drawnNumbers: number[], patternType: string, gameStatus: string, onClaim: (pattern: string) => void, isClaiming: boolean }
) {
  let grid: number[][] = [];
  try { grid = JSON.parse(card.numbers); } catch { return null; }

  const isMarked = (num: number, r: number, c: number) => {
    if (r === 2 && c === 2) return true;
    return drawnNumbers.includes(num);
  };

  const canClaim = gameStatus === "playing" && !card.isWinner && card.claimStatus !== "pending";
  const letters = ["B", "I", "N", "G", "O"];
  const markedCount = grid.flatMap((col, ci) => col.map((num, ri) => isMarked(num, ri, ci))).filter(Boolean).length;

  return (
    <div className={`bg-card border-2 rounded-2xl overflow-hidden shadow-lg shadow-black/50 transition-all
      ${card.isWinner ? "border-accent shadow-[0_0_25px_rgba(212,175,55,0.5)]" : "border-primary/30 hover:border-primary/60"}`}>
      {/* BINGO header */}
      <div className="bg-gradient-to-r from-primary/80 to-accent/80 py-2 px-3 flex justify-between text-black font-black text-xl md:text-2xl tracking-widest">
        {letters.map((l, i) => <span key={i}>{l}</span>)}
      </div>

      {/* Grid */}
      <div className="p-1.5 md:p-2 grid grid-cols-5 gap-1 bg-black/40">
        {grid.map((col, cIndex) =>
          col.map((num, rIndex) => {
            const marked = isMarked(num, rIndex, cIndex);
            const isFree = rIndex === 2 && cIndex === 2;
            return (
              <div
                key={`${cIndex}-${rIndex}`}
                onClick={() => marked && sounds.ballMark()}
                className={`aspect-square rounded-lg flex items-center justify-center text-xs md:text-sm font-bold transition-all duration-300 cursor-default
                  ${marked
                    ? "bg-gradient-to-br from-primary to-accent text-black shadow-[inset_0_0_8px_rgba(255,255,255,0.4)] scale-95"
                    : "bg-card border border-white/5 text-white/80"}`}
                style={{ gridColumn: cIndex + 1, gridRow: rIndex + 1 }}
              >
                {isFree ? "★" : num}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="bg-black/60 p-2 flex items-center justify-between px-3">
        <span className="text-[10px] text-white/30">#{card.id} · {markedCount}/25</span>
        {card.isWinner ? (
          <span className="text-xs font-bold text-black bg-accent px-3 py-1 rounded-full">¡GANADOR! 🏆</span>
        ) : card.claimStatus === "pending" ? (
          <span className="text-xs font-bold text-yellow-400 bg-yellow-500/20 border border-yellow-500/40 px-3 py-1 rounded-full animate-pulse">En revisión ⏳</span>
        ) : canClaim ? (
          <button onClick={() => { sounds.click(); onClaim(patternType); }}
            disabled={isClaiming}
            className="text-xs font-bold text-black bg-gradient-to-r from-primary to-accent hover:scale-105 active:scale-95 transition-transform px-3 py-1.5 rounded-full disabled:opacity-50">
            {isClaiming ? "..." : "¡BINGO! 🎉"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

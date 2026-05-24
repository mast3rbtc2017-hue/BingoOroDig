import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, Link } from "wouter";
import { useGetGame, useGetDrawnNumbers, useGetGameWinners } from "@workspace/api-client-react";
import { useGameDrawnNumbers, useGameLive, useGameWinner, useRoomMessages } from "@/lib/realtime";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { ArrowLeft, Users, Radio, Pause, Play, Square, RotateCcw, Send, Grid3x3, MessageCircle, Trophy, X } from "lucide-react";
import { sounds, resumeAudio } from "@/lib/sounds";
import { apiJson } from "@/lib/api-fetch";

const BINGO_COLS = [
  { letter: "B", nums: [1, 16] },
  { letter: "I", nums: [16, 31] },
  { letter: "N", nums: [31, 46] },
  { letter: "G", nums: [46, 61] },
  { letter: "O", nums: [61, 76] },
];

const STATUS_COLORS: Record<string, string> = {
  waiting: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  playing: "bg-green-500/20 text-green-400 border-green-500/30",
  paused: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  finished: "bg-red-500/20 text-red-400 border-red-500/30",
};

const PATTERN_LABELS: Record<string, string> = {
  line: "Línea", diagonal: "Diagonal", corners: "Esquinas", x: "X", fullCard: "Cartón lleno",
};

type MobileTab = "draw" | "board" | "chat";

export default function AdminSorteosLive() {
  const { id } = useParams();
  const gameId = Number(id);

  const [playerCount, setPlayerCount] = useState(0);
  const [prevBallCount, setPrevBallCount] = useState(0);
  const [chatInput, setChatInput] = useState("");
  const [drawing, setDrawing] = useState(false);
  const [controlling, setControlling] = useState(false);
  const [lastBall, setLastBall] = useState<{ number: number; letter: string } | null>(null);
  const [winners, setWinners] = useState<any[]>([]);
  const [autoDrawing, setAutoDrawing] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("draw");
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  const { data: game, refetch: refetchGame } = useGetGame(gameId, {
    query: { enabled: !!gameId, queryKey: ["/api/games", gameId], refetchInterval: 5000 }
  });
  const { data: drawnNums, refetch: refetchDrawn } = useGetDrawnNumbers(gameId, {
    query: { enabled: !!gameId, queryKey: ["/api/games/drawn", gameId] }
  });
  const { data: winnersList, refetch: refetchWinners } = useGetGameWinners(gameId, {
    query: { enabled: !!gameId, queryKey: ["/api/games/winners", gameId] }
  });

  const liveDrawn = useGameDrawnNumbers(gameId);
  const chatMessages = useRoomMessages(game?.roomId);
  const liveWinner = useGameWinner(gameId);

  const allDrawn = (() => {
    const map = new Map<number, { number: number; letter: string }>();
    (drawnNums || []).forEach(d => map.set(d.number, { number: d.number, letter: d.letter }));
    liveDrawn.forEach(d => map.set(d.number, d));
    return Array.from(map.values());
  })();

  const onLiveUpdate = useCallback(() => {
    refetchGame();
    refetchDrawn();
    refetchWinners();
  }, [refetchGame, refetchDrawn, refetchWinners]);

  useGameLive(gameId, onLiveUpdate);

  const drawnSet = new Set(allDrawn.map(d => d.number));

  const apiCall = useCallback(
    (path: string, method: string, body?: unknown) => apiJson(path, method, body),
    [],
  );

  useEffect(() => {
    resumeAudio();
  }, []);

  useEffect(() => {
    if (allDrawn.length > prevBallCount && prevBallCount > 0) {
      const ball = allDrawn[allDrawn.length - 1];
      sounds.ballDraw();
      setLastBall(ball);
      refetchDrawn();
    }
    setPrevBallCount(allDrawn.length);
  }, [allDrawn.length, prevBallCount, refetchDrawn, allDrawn]);

  useEffect(() => {
    if (!liveWinner) return;
    setWinners((prev) => [...prev, liveWinner]);
    refetchWinners();
    triggerConfetti();
    sounds.win();
    const w = liveWinner as { username?: string; prize?: number };
    toast.success(`🎉 ¡BINGO! ${w.username ?? "Jugador"} ganó $${w.prize ?? 0}`);
  }, [liveWinner, refetchWinners]);

  useEffect(() => {
    if (chatMessages.length === 0) return;
    setTimeout(() => {
      if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }, 80);
  }, [chatMessages.length]);

  const triggerConfetti = () => {
    const end = Date.now() + 4000;
    const rand = (a: number, b: number) => Math.random() * (b - a) + a;
    const iv = setInterval(() => {
      if (Date.now() > end) return clearInterval(iv);
      confetti({ particleCount: 60, spread: 360, startVelocity: 25, origin: { x: rand(0.1, 0.9), y: rand(0, 0.4) } });
    }, 200);
  };

  const handleDraw = async () => {
    if (drawing || game?.status !== "playing") return;
    setDrawing(true);
    try {
      const result = await apiCall(`/api/games/${gameId}/draw`, "POST");
      setLastBall({ number: result.number, letter: result.letter });
      refetchDrawn();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDrawing(false);
    }
  };

  const handleControl = async (action: string) => {
    setControlling(true);
    try {
      await apiCall(`/api/games/${gameId}/control`, "POST", { action });
      const labels: Record<string, string> = { start: "¡Sorteo iniciado!", pause: "Pausado", resume: "Reanudado", finish: "Sorteo finalizado", restart: "Reiniciado" };
      toast.success(labels[action] || "OK");
      refetchGame();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setControlling(false);
    }
  };

  const toggleAutoDrawing = () => {
    if (autoDrawing) {
      if (autoRef.current) clearInterval(autoRef.current);
      setAutoDrawing(false);
      toast("Auto-sorteo detenido");
    } else {
      const interval = (game?.ballInterval || 8) * 1000;
      autoRef.current = setInterval(handleDraw, interval);
      setAutoDrawing(true);
      toast.success(`Auto-sorteo cada ${game?.ballInterval || 8}s`);
    }
  };

  useEffect(() => () => { if (autoRef.current) clearInterval(autoRef.current); }, []);

  const sendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !game?.roomId) return;
    apiCall(`/api/chat/${game.roomId}`, "POST", { content: chatInput })
      .then(() => setChatInput(""))
      .catch((err: Error) => toast.error(err.message));
  };

  if (!game) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4 animate-bounce">🎱</div>
        <p className="text-white/60">Cargando sorteo...</p>
      </div>
    </div>
  );

  const status = game.status as string;
  const isPlaying = status === "playing";
  const isFinished = status === "finished";
  const drawnPct = Math.round((allDrawn.length / 75) * 100);

  const ControlBar = () => (
    <div className="flex flex-wrap gap-2 bg-black/40 border border-white/5 rounded-2xl p-3 md:p-4">
      {status === "waiting" && (
        <Button onClick={() => handleControl("start")} disabled={controlling}
          className="bg-green-500 hover:bg-green-400 text-black font-bold px-4 md:px-6 h-9 md:h-10">
          <Play className="w-4 h-4 mr-1.5" /> Iniciar
        </Button>
      )}
      {isPlaying && (
        <>
          <Button onClick={() => handleControl("pause")} disabled={controlling} variant="outline" size="sm"
            className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10 h-9">
            <Pause className="w-4 h-4 mr-1.5" /> Pausar
          </Button>
          <Button onClick={() => handleControl("finish")} disabled={controlling} variant="outline" size="sm"
            className="border-red-500/50 text-red-400 hover:bg-red-500/10 h-9">
            <Square className="w-4 h-4 mr-1.5" /> Finalizar
          </Button>
        </>
      )}
      {status === "paused" && (
        <>
          <Button onClick={() => handleControl("resume")} disabled={controlling}
            className="bg-green-500/80 hover:bg-green-500 text-black font-bold h-9">
            <Play className="w-4 h-4 mr-1.5" /> Reanudar
          </Button>
          <Button onClick={() => handleControl("finish")} disabled={controlling} variant="outline" size="sm"
            className="border-red-500/50 text-red-400 hover:bg-red-500/10 h-9">
            <Square className="w-4 h-4 mr-1.5" /> Finalizar
          </Button>
        </>
      )}
      {(isFinished || status === "paused") && (
        <Button onClick={() => handleControl("restart")} disabled={controlling} variant="outline" size="sm"
          className="border-white/20 text-white/50 hover:text-white h-9">
          <RotateCcw className="w-4 h-4 mr-1.5" /> Reiniciar
        </Button>
      )}
      <div className="ml-auto flex items-center gap-2">
        <div className="bg-black/40 px-3 py-1.5 rounded-lg border border-white/5 flex items-center gap-1.5">
          <Radio className="w-3 h-3 text-primary" />
          <span className="text-sm font-bold text-white">{allDrawn.length}<span className="text-white/30">/75</span></span>
        </div>
        <div className="bg-black/40 px-3 py-1.5 rounded-lg border border-white/5 flex items-center gap-1.5">
          <Users className="w-3 h-3 text-primary" />
          <span className="text-sm font-bold">{playerCount}</span>
        </div>
      </div>
    </div>
  );

  const DrawPanel = () => (
    <div className="flex flex-col gap-4">
      <ControlBar />

      {/* Progress */}
      <div className="bg-black/40 border border-white/5 rounded-xl p-3">
        <div className="flex justify-between text-xs text-white/40 mb-1.5">
          <span>Progreso</span><span>{allDrawn.length}/75 bolas ({drawnPct}%)</span>
        </div>
        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
          <motion.div className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
            animate={{ width: `${drawnPct}%` }} transition={{ duration: 0.4 }} />
        </div>
      </div>

      {/* Ball + Draw button */}
      <div className="flex gap-4 items-center">
        <div className="flex flex-col items-center shrink-0">
          <p className="text-[10px] text-white/40 uppercase tracking-widest mb-2">Última bola</p>
          <AnimatePresence mode="wait">
            {lastBall ? (
              <motion.div key={`${lastBall.letter}${lastBall.number}`}
                initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-primary via-accent to-yellow-300 border-4 border-white/30 shadow-[0_0_40px_rgba(212,175,55,0.6)] flex flex-col items-center justify-center">
                <span className="text-lg md:text-2xl font-bold text-black/70 leading-none">{lastBall.letter}</span>
                <span className="text-4xl md:text-5xl font-black text-black leading-none">{lastBall.number}</span>
              </motion.div>
            ) : (
              <motion.div key="empty" className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-black/60 border-4 border-white/10 flex items-center justify-center">
                <span className="text-white/20 text-4xl">?</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex flex-col gap-3 flex-1">
          <motion.button onClick={handleDraw} disabled={!isPlaying || drawing}
            whileTap={isPlaying ? { scale: 0.93 } : {}} whileHover={isPlaying ? { scale: 1.02 } : {}}
            className={`w-full py-6 md:py-8 rounded-2xl text-2xl md:text-4xl font-black uppercase tracking-widest transition-all
              ${isPlaying
                ? "bg-gradient-to-r from-primary to-accent text-black cursor-pointer shadow-[0_0_30px_rgba(212,175,55,0.5)]"
                : "bg-white/5 text-white/20 cursor-not-allowed border border-white/5"}`}>
            {drawing ? "🎱 ..." : isFinished ? "Finalizado" : status === "waiting" ? "Inicia primero" : status === "paused" ? "Pausado" : "🎱 SORTEAR"}
          </motion.button>

          {isPlaying && (
            <button onClick={toggleAutoDrawing}
              className={`w-full py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all border
                ${autoDrawing ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30 animate-pulse" : "bg-white/5 text-white/40 border-white/10 hover:border-white/30"}`}>
              {autoDrawing ? `⏱️ Auto-sorteo activo (${game.ballInterval}s) — Detener` : "⏱️ Activar auto-sorteo"}
            </button>
          )}
        </div>
      </div>

      {/* Recent balls */}
      <div className="bg-black/40 border border-white/5 rounded-xl p-3">
        <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Últimas bolas</p>
        <div className="flex flex-wrap gap-1.5">
          {[...allDrawn].reverse().slice(0, 15).map((b, i) => (
            <div key={`${b.letter}${b.number}-${i}`}
              className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold
                ${i === 0 ? "bg-gradient-to-br from-primary to-accent text-black shadow-[0_0_8px_rgba(212,175,55,0.5)]" : "bg-white/5 text-white/50 border border-white/10"}`}>
              {b.letter}{b.number}
            </div>
          ))}
          {allDrawn.length === 0 && <span className="text-white/20 text-xs">Sin bolas aún</span>}
        </div>
      </div>

      {/* Winners */}
      {((winnersList?.length || 0) > 0 || winners.length > 0) && (
        <div className="bg-gradient-to-r from-accent/10 to-primary/10 border border-accent/30 rounded-2xl p-4">
          <h3 className="font-bold text-accent mb-3 flex items-center gap-2 text-sm"><Trophy className="w-4 h-4" /> Ganadores</h3>
          <div className="space-y-2">
            {(winnersList || winners).map((w: any, i: number) => (
              <div key={i} className="flex justify-between items-center bg-black/40 rounded-xl p-2.5">
                <div>
                  <span className="font-bold text-white text-sm">{w.username}</span>
                  <span className="text-white/40 text-xs ml-2">{PATTERN_LABELS[w.pattern] || w.pattern}</span>
                </div>
                <span className="font-bold text-accent">${w.prize}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const BoardPanel = () => (
    <div>
      <p className="text-xs text-white/40 uppercase tracking-widest mb-3">Tablero de bolas ({allDrawn.length}/75)</p>
      <div className="bg-black/60 border border-white/5 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-5 bg-gradient-to-r from-primary/20 via-accent/10 to-primary/20 border-b border-white/5">
          {["B", "I", "N", "G", "O"].map((l, i) => (
            <div key={l} className={`text-center py-2 md:py-3 text-xl md:text-2xl font-black ${i % 2 === 0 ? "text-primary" : "text-accent"}`}>{l}</div>
          ))}
        </div>
        <div className="grid grid-cols-5">
          {BINGO_COLS.map((col) => (
            <div key={col.letter}>
              {Array.from({ length: col.nums[1] - col.nums[0] }, (_, ri) => {
                const num = col.nums[0] + ri;
                const drawn = drawnSet.has(num);
                const isLast = lastBall?.number === num;
                return (
                  <motion.div key={num}
                    animate={isLast ? { scale: [1, 1.25, 1] } : {}}
                    transition={{ duration: 0.4 }}
                    className={`aspect-square flex items-center justify-center text-sm md:text-lg font-bold border border-black/20 transition-all duration-500
                      ${drawn ? isLast
                        ? "bg-gradient-to-br from-primary to-accent text-black shadow-[inset_0_0_12px_rgba(255,255,255,0.4)]"
                        : "bg-primary/40 text-black"
                      : "text-white/25"}`}>
                    {num}
                  </motion.div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const ChatPanel = () => (
    <div className="flex flex-col h-full">
      <div ref={chatRef} className="flex-1 overflow-y-auto space-y-2 mb-3" style={{ maxHeight: "calc(100dvh - 16rem)" }}>
        {chatMessages.map((msg, i) => (
          <div key={i}>
            {msg.type === "system" ? (
              <p className="text-center text-xs text-primary/70 bg-primary/5 px-2 py-1 rounded-full">{msg.content}</p>
            ) : (
              <div className="bg-white/5 rounded-lg p-2 border border-white/5">
                <span className="text-xs font-bold text-primary">{msg.username} </span>
                <span className="text-xs text-white/80">{msg.content}</span>
              </div>
            )}
          </div>
        ))}
        {chatMessages.length === 0 && <p className="text-white/20 text-xs text-center mt-6">Sin mensajes aún</p>}
      </div>
      <form onSubmit={sendChat} className="flex gap-2">
        <Input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Mensaje..."
          className="bg-black/40 border-white/10 text-white text-sm h-9" />
        <button type="submit" disabled={!chatInput.trim()}
          className="px-3 py-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors disabled:opacity-30">
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen md:h-screen bg-[#07070a] flex flex-col overflow-hidden text-white" onClick={resumeAudio}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-3 md:px-6 py-2 md:py-3 border-b border-white/5 bg-black/60 backdrop-blur shrink-0">
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          <Link href="/admin/sorteos">
            <button className="text-white/40 hover:text-white transition-colors shrink-0"><ArrowLeft className="w-5 h-5" /></button>
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm md:text-lg text-white truncate">{(game as any).title || `Sorteo #${game.id}`}</span>
              <Badge className={`${STATUS_COLORS[status]} text-xs`}>{status === "waiting" ? "En espera" : status === "playing" ? "En Vivo" : status === "paused" ? "Pausado" : "Finalizado"}</Badge>
              {isPlaying && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
            </div>
            <p className="text-white/30 text-xs hidden md:block">Sala #{game.roomId} · Premio: <span className="text-accent">${game.prize}</span> · {PATTERN_LABELS[game.patternType]}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 bg-black/40 px-2.5 py-1.5 rounded-lg border border-white/5">
            <Users className="w-3.5 h-3.5 text-primary" />
            <span className="text-sm font-bold">{playerCount}</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 bg-black/40 px-2.5 py-1.5 rounded-lg border border-white/5">
            <Radio className="w-3.5 h-3.5 text-primary" />
            <span className="text-sm font-bold">{allDrawn.length}<span className="text-white/30">/75</span></span>
          </div>
        </div>
      </div>

      {/* Mobile tab bar */}
      <div className="flex md:hidden border-b border-white/5 bg-black/40 shrink-0">
        {([
          { key: "draw", label: "Sortear", icon: Radio },
          { key: "board", label: "Tablero", icon: Grid3x3 },
          { key: "chat", label: "Chat", icon: MessageCircle },
        ] as { key: MobileTab; label: string; icon: any }[]).map(t => (
          <button key={t.key} onClick={() => setMobileTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors
              ${mobileTab === t.key ? "text-primary border-b-2 border-primary" : "text-white/40"}`}>
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Desktop: 2-column layout */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-y-auto p-5 gap-5">
          <DrawPanel />
          <BoardPanel />
        </div>
        <div className="w-80 flex flex-col border-l border-white/5 bg-black/40 shrink-0">
          <div className="p-4 border-b border-white/5 flex items-center gap-2">
            <Radio className="w-4 h-4 text-green-400 animate-pulse" />
            <h3 className="font-bold text-white/80 text-sm">Chat en Vivo</h3>
          </div>
          <div ref={chatRef} className="flex-1 overflow-y-auto p-3 space-y-2">
            {chatMessages.map((msg, i) => (
              <div key={i}>
                {msg.type === "system" ? (
                  <p className="text-center text-xs text-primary/70 bg-primary/5 px-2 py-1 rounded-full">{msg.content}</p>
                ) : (
                  <div className="bg-white/5 rounded-lg p-2 border border-white/5">
                    <span className="text-xs font-bold text-primary">{msg.username} </span>
                    <span className="text-xs text-white/80">{msg.content}</span>
                  </div>
                )}
              </div>
            ))}
            {chatMessages.length === 0 && <p className="text-white/20 text-xs text-center mt-6">Sin mensajes aún</p>}
          </div>
          <form onSubmit={sendChat} className="p-3 border-t border-white/5 flex gap-2">
            <Input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Mensaje..."
              className="bg-black/40 border-white/10 text-white text-sm h-9" />
            <button type="submit" disabled={!chatInput.trim()}
              className="px-3 py-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors disabled:opacity-30">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Mobile tab content */}
      <div className="flex md:hidden flex-1 overflow-y-auto p-4 pb-6">
        {mobileTab === "draw" && <div className="w-full"><DrawPanel /></div>}
        {mobileTab === "board" && <div className="w-full"><BoardPanel /></div>}
        {mobileTab === "chat" && <div className="w-full flex flex-col h-full"><ChatPanel /></div>}
      </div>
    </div>
  );
}

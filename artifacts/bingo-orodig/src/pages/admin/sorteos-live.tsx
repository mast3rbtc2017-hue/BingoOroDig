import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, Link } from "wouter";
import { io, Socket } from "socket.io-client";
import { useGetGame, useGetDrawnNumbers, useGetGameWinners } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { ArrowLeft, Users, Radio, Pause, Play, Square, RotateCcw, Send } from "lucide-react";

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

export default function AdminSorteosLive() {
  const { id } = useParams();
  const gameId = Number(id);

  const [socket, setSocket] = useState<Socket | null>(null);
  const [liveDrawn, setLiveDrawn] = useState<Array<{ number: number; letter: string }>>([]);
  const [playerCount, setPlayerCount] = useState(0);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [drawing, setDrawing] = useState(false);
  const [controlling, setControlling] = useState(false);
  const [lastBall, setLastBall] = useState<{ number: number; letter: string } | null>(null);
  const [winners, setWinners] = useState<any[]>([]);
  const [autoDrawing, setAutoDrawing] = useState(false);
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

  const allDrawn = (() => {
    const map = new Map<number, { number: number; letter: string }>();
    (drawnNums || []).forEach(d => map.set(d.number, { number: d.number, letter: d.letter }));
    liveDrawn.forEach(d => map.set(d.number, d));
    return Array.from(map.values());
  })();

  const drawnSet = new Set(allDrawn.map(d => d.number));

  const apiCall = useCallback(async (path: string, method: string, body?: any) => {
    const token = localStorage.getItem("bingo_token");
    const r = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Error");
    return data;
  }, []);

  useEffect(() => {
    if (!game?.roomId) return;
    const s = io(window.location.origin, { path: "/api/socket.io" });
    s.on("connect", () => s.emit("join_room", { roomId: game.roomId }));
    s.on("player_joined", (d: any) => setPlayerCount(d.playerCount));
    s.on("player_left", (d: any) => setPlayerCount(d.playerCount));
    s.on("ball_drawn", (d: any) => {
      setLiveDrawn(prev => {
        if (prev.find(b => b.number === d.number)) return prev;
        return [...prev, { number: d.number, letter: d.letter }];
      });
      setLastBall({ number: d.number, letter: d.letter });
      refetchDrawn();
    });
    s.on("game_state", () => { refetchGame(); refetchDrawn(); });
    s.on("winner", (d: any) => {
      setWinners(prev => [...prev, d]);
      refetchWinners();
      triggerConfetti();
      toast.success(`🎉 ¡BINGO! ${d.username} ganó $${d.prize}`);
    });
    s.on("chat_message", (d: any) => {
      if (d.roomId === game.roomId) {
        setChatMessages(prev => [...prev, d.message]);
        setTimeout(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, 80);
      }
    });
    setSocket(s);
    return () => { s.disconnect(); };
  }, [game?.roomId]);

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

  // Auto-draw mode
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
    if (!chatInput.trim() || !socket) return;
    apiCall("/api/chat", "POST", { roomId: game?.roomId, content: chatInput }).then(() => setChatInput("")).catch(() => {});
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

  return (
    <div className="h-screen bg-[#07070a] flex flex-col overflow-hidden text-white">

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-black/60 backdrop-blur flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/admin/sorteos">
            <button className="text-white/40 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5" /></button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-white">{(game as any).title || `Sorteo #${game.id}`}</span>
              <Badge className={STATUS_COLORS[status]}>{status === "waiting" ? "En espera" : status === "playing" ? "En Vivo" : status === "paused" ? "Pausado" : "Finalizado"}</Badge>
              {isPlaying && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
            </div>
            <p className="text-white/40 text-xs">Sala #{game.roomId} • Premio: <span className="text-accent">${game.prize}</span> • Patrón: {PATTERN_LABELS[game.patternType]}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg border border-white/5">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold">{playerCount}</span>
            <span className="text-xs text-white/40">jugadores</span>
          </div>
          <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg border border-white/5">
            <Radio className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold">{allDrawn.length}</span>
            <span className="text-xs text-white/40">/ 75</span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* Left: Bingo Board + Controls */}
        <div className="flex-1 flex flex-col overflow-y-auto p-5 gap-5">

          {/* Game Controls */}
          <div className="flex flex-wrap gap-3 bg-black/40 border border-white/5 rounded-2xl p-4">
            {status === "waiting" && (
              <Button onClick={() => handleControl("start")} disabled={controlling}
                className="bg-green-500 hover:bg-green-400 text-black font-bold px-6">
                <Play className="w-4 h-4 mr-2" /> Iniciar Sorteo
              </Button>
            )}
            {isPlaying && (
              <>
                <Button onClick={() => handleControl("pause")} disabled={controlling} variant="outline"
                  className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10">
                  <Pause className="w-4 h-4 mr-2" /> Pausar
                </Button>
                <Button onClick={() => handleControl("finish")} disabled={controlling} variant="outline"
                  className="border-red-500/50 text-red-400 hover:bg-red-500/10">
                  <Square className="w-4 h-4 mr-2" /> Finalizar
                </Button>
              </>
            )}
            {status === "paused" && (
              <>
                <Button onClick={() => handleControl("resume")} disabled={controlling}
                  className="bg-green-500/80 hover:bg-green-500 text-black font-bold">
                  <Play className="w-4 h-4 mr-2" /> Reanudar
                </Button>
                <Button onClick={() => handleControl("finish")} disabled={controlling} variant="outline"
                  className="border-red-500/50 text-red-400 hover:bg-red-500/10">
                  <Square className="w-4 h-4 mr-2" /> Finalizar
                </Button>
              </>
            )}
            {(isFinished || status === "paused") && (
              <Button onClick={() => handleControl("restart")} disabled={controlling} variant="outline"
                className="border-white/20 text-white/50 hover:text-white hover:border-white/40">
                <RotateCcw className="w-4 h-4 mr-2" /> Reiniciar
              </Button>
            )}
            <div className="ml-auto text-sm text-white/40 flex items-center">
              Sorteo #{game.id} • {new Date().toLocaleTimeString("es")}
            </div>
          </div>

          {/* Current ball + Draw button */}
          <div className="flex gap-5 items-center">
            {/* Big ball */}
            <div className="flex flex-col items-center">
              <p className="text-xs text-white/40 uppercase tracking-widest mb-3">Última bola</p>
              <div className="relative">
                <AnimatePresence mode="wait">
                  {lastBall ? (
                    <motion.div key={`${lastBall.letter}${lastBall.number}`}
                      initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      className="w-32 h-32 rounded-full bg-gradient-to-br from-primary via-accent to-yellow-300 border-4 border-white/30 shadow-[0_0_50px_rgba(212,175,55,0.6)] flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold text-black/70 leading-none">{lastBall.letter}</span>
                      <span className="text-5xl font-black text-black leading-none">{lastBall.number}</span>
                    </motion.div>
                  ) : (
                    <motion.div key="empty" className="w-32 h-32 rounded-full bg-black/60 border-4 border-white/10 flex items-center justify-center">
                      <span className="text-white/20 text-4xl">?</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Draw button */}
            <div className="flex flex-col gap-3 flex-1">
              <motion.button
                onClick={handleDraw}
                disabled={!isPlaying || drawing}
                whileTap={isPlaying ? { scale: 0.93 } : {}}
                whileHover={isPlaying ? { scale: 1.03 } : {}}
                className={`
                  w-full py-8 rounded-2xl text-4xl font-black uppercase tracking-widest transition-all
                  ${isPlaying
                    ? "bg-gradient-to-r from-primary to-accent text-black cursor-pointer shadow-[0_0_40px_rgba(212,175,55,0.5)] hover:shadow-[0_0_60px_rgba(212,175,55,0.7)]"
                    : "bg-white/5 text-white/20 cursor-not-allowed border border-white/5"}
                `}
              >
                {drawing ? "🎱 Sorteando..." : isFinished ? "Finalizado" : status === "waiting" ? "Inicia primero" : status === "paused" ? "Pausado" : "🎱 SORTEAR BOLA"}
              </motion.button>

              {isPlaying && (
                <button onClick={toggleAutoDrawing}
                  className={`w-full py-3 rounded-xl text-sm font-bold transition-all border ${autoDrawing ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30 animate-pulse" : "bg-white/5 text-white/40 border-white/10 hover:border-white/30"}`}>
                  {autoDrawing ? `⏱️ Auto-sorteo activo (cada ${game.ballInterval}s) — Click para detener` : "⏱️ Activar auto-sorteo"}
                </button>
              )}
            </div>
          </div>

          {/* Full BINGO board */}
          <div>
            <p className="text-xs text-white/40 uppercase tracking-widest mb-3">Tablero de bolas</p>
            <div className="bg-black/60 border border-white/5 rounded-2xl overflow-hidden">
              {/* Column headers */}
              <div className="grid grid-cols-5 bg-gradient-to-r from-primary/20 via-accent/10 to-primary/20 border-b border-white/5">
                {["B", "I", "N", "G", "O"].map((l, i) => (
                  <div key={l} className={`text-center py-3 text-2xl font-black ${i % 2 === 0 ? "text-primary" : "text-accent"}`}>{l}</div>
                ))}
              </div>
              {/* Numbers grid — 15 rows */}
              <div className="grid grid-cols-5">
                {BINGO_COLS.map((col, ci) => (
                  <div key={col.letter}>
                    {Array.from({ length: col.nums[1] - col.nums[0] }, (_, ri) => {
                      const num = col.nums[0] + ri;
                      const drawn = drawnSet.has(num);
                      const isLast = lastBall?.number === num;
                      return (
                        <motion.div key={num}
                          animate={isLast ? { scale: [1, 1.2, 1] } : {}}
                          transition={{ duration: 0.4 }}
                          className={`
                            aspect-square flex items-center justify-center text-lg font-bold
                            border border-black/20 transition-all duration-500
                            ${drawn
                              ? isLast
                                ? "bg-gradient-to-br from-primary to-accent text-black shadow-[inset_0_0_12px_rgba(255,255,255,0.4)]"
                                : "bg-primary/40 text-black"
                              : "text-white/25 hover:text-white/50"}
                          `}>
                          {num}
                        </motion.div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Winners */}
          {((winnersList?.length || 0) > 0 || winners.length > 0) && (
            <div className="bg-gradient-to-r from-accent/10 to-primary/10 border border-accent/30 rounded-2xl p-5">
              <h3 className="font-bold text-accent mb-3 flex items-center gap-2">🏆 Ganadores</h3>
              <div className="space-y-2">
                {(winnersList || winners).map((w: any, i: number) => (
                  <div key={i} className="flex justify-between items-center bg-black/40 rounded-xl p-3">
                    <div>
                      <span className="font-bold text-white">{w.username}</span>
                      <span className="text-white/50 text-sm ml-2">— {PATTERN_LABELS[w.pattern] || w.pattern}</span>
                    </div>
                    <span className="font-bold text-accent text-xl">${w.prize}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Chat + History */}
        <div className="w-80 flex flex-col border-l border-white/5 bg-black/40 flex-shrink-0">
          <div className="p-4 border-b border-white/5">
            <h3 className="font-bold text-white/80 text-sm flex items-center gap-2">
              <Radio className="w-4 h-4 text-green-400" /> Chat en Vivo
            </h3>
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

          {/* Recent balls */}
          <div className="p-3 border-t border-white/5">
            <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Últimas bolas ({allDrawn.length}/75)</p>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
              {[...allDrawn].reverse().slice(0, 20).map((b, i) => (
                <motion.div key={`${b.letter}${b.number}-${i}`} initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border
                    ${i === 0 ? "bg-primary text-black border-primary shadow-[0_0_10px_rgba(212,175,55,0.5)]" : "bg-white/5 text-white/60 border-white/10"}`}>
                  {b.letter}{b.number}
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

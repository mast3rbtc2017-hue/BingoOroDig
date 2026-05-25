import { db, Timestamp } from "./firestore";
import { drawBallForGame } from "./gameLogic";

const autoDrawTimers = new Map<number, ReturnType<typeof setInterval>>();

export function startAutoTimer(gameId: number, intervalSecs: number): void {
  stopAutoTimer(gameId);
  const ms = Math.max(intervalSecs * 1000, 2000);
  const timer = setInterval(() => {
    void drawBallForGame(gameId).catch(console.error);
  }, ms);
  autoDrawTimers.set(gameId, timer);
}

export function stopAutoTimer(gameId: number): void {
  const t = autoDrawTimers.get(gameId);
  if (t) {
    clearInterval(t);
    autoDrawTimers.delete(gameId);
  }
}

export async function getGame(gameId: number) {
  const snap = await db.collection("games").doc(String(gameId)).get();
  if (!snap.exists) return null;
  return { id: gameId, ...snap.data() } as Record<string, unknown> & { id: number };
}

export async function getRoom(roomId: number) {
  const snap = await db.collection("rooms").doc(String(roomId)).get();
  if (!snap.exists) return null;
  return { id: roomId, ...snap.data() } as Record<string, unknown> & { id: number };
}

export function serializeGame(g: Record<string, unknown>) {
  return {
    id: g.id,
    title: g.title ?? null,
    description: g.description ?? null,
    mode: g.mode ?? "manual",
    status: g.status,
    patternType: g.patternType,
    ballInterval: g.ballInterval,
    prize: g.prize,
    cardPrice: g.cardPrice ?? null,
    maxPlayers: g.maxPlayers ?? null,
    playerCount: g.playerCount ?? 0,
    type: g.type ?? "classic",
    winnerId: g.winnerId ?? null,
    winnerCardId: g.winnerCardId ?? null,
    scheduledAt: g.scheduledAt instanceof Timestamp ? g.scheduledAt.toDate().toISOString() : g.scheduledAt ?? null,
    startedAt: g.startedAt instanceof Timestamp ? g.startedAt.toDate().toISOString() : g.startedAt ?? null,
    finishedAt: g.finishedAt instanceof Timestamp ? g.finishedAt.toDate().toISOString() : g.finishedAt ?? null,
    createdAt: g.createdAt instanceof Timestamp ? g.createdAt.toDate().toISOString() : g.createdAt,
  };
}

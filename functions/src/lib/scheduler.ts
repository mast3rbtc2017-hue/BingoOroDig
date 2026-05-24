import { db, FieldValue, Timestamp } from "./firestore";
import { getGame, getRoom, startAutoTimer, stopAutoTimer } from "./autoDraw";

export function parseScheduledAt(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Sorteos programados o automáticos sacan bolas solas; manual no. */
export function shouldAutoDrawBalls(
  game: Record<string, unknown>,
  room: Record<string, unknown> | null,
): boolean {
  if (game.mode === "manual") return false;
  if (game.mode === "automatic" || room?.type === "automatic") return true;
  if (game.scheduledAt) return true;
  if (game.mode === "live") return true;
  return false;
}

export function ballIntervalSecs(
  game: Record<string, unknown>,
  room: Record<string, unknown> | null,
): number {
  const n = Number(game.ballInterval ?? room?.ballInterval ?? 5);
  return Number.isFinite(n) && n >= 2 ? n : 5;
}

export async function startGameById(gameId: number): Promise<Record<string, unknown> | null> {
  const game = await getGame(gameId);
  if (!game || game.status !== "waiting") return game;

  const room = await getRoom(game.roomId as number);
  const interval = ballIntervalSecs(game, room);

  await db.collection("games").doc(String(gameId)).update({
    status: "playing",
    startedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await db.collection("rooms").doc(String(game.roomId)).update({
    status: "playing",
    currentGameId: gameId,
    updatedAt: FieldValue.serverTimestamp(),
  });

  if (shouldAutoDrawBalls(game, room)) {
    startAutoTimer(gameId, game.roomId as number, interval);
  }

  return getGame(gameId);
}

export async function processScheduledGames(): Promise<number> {
  const snap = await db.collection("games").where("status", "==", "waiting").get();
  const now = Date.now();
  let started = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const scheduled = parseScheduledAt(data.scheduledAt);
    if (!scheduled || scheduled.getTime() > now) continue;
    const id = Number(doc.id);
    if (Number.isNaN(id)) continue;
    await startGameById(id);
    started++;
  }

  return started;
}

export async function processScheduledGameForRoom(roomId: number): Promise<number> {
  const room = await getRoom(roomId);
  if (!room?.currentGameId) return 0;
  const gameId = room.currentGameId as number;
  const game = await getGame(gameId);
  if (!game || game.status !== "waiting") return 0;
  const scheduled = parseScheduledAt(game.scheduledAt);
  if (!scheduled || scheduled.getTime() > Date.now()) return 0;
  await startGameById(gameId);
  return 1;
}

import { db, FieldValue, Timestamp } from "./firestore";
import { getGame, startAutoTimer, stopAutoTimer } from "./autoDraw";
import { resolveGameSettings } from "./gameMeta";

export function parseScheduledAt(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function shouldAutoDrawBalls(game: Record<string, unknown>): boolean {
  if (game.mode === "manual") return false;
  if (game.mode === "automatic" || game.type === "automatic") return true;
  if (game.scheduledAt) return true;
  if (game.mode === "live") return true;
  return false;
}

export function ballIntervalSecs(game: Record<string, unknown>): number {
  const n = Number(game.ballInterval ?? 8);
  return Number.isFinite(n) && n >= 2 ? n : 8;
}

export async function startGameById(gameId: number): Promise<Record<string, unknown> | null> {
  const game = await getGame(gameId);
  if (!game || game.status !== "waiting") return game;

  const interval = ballIntervalSecs(game);

  await db.collection("games").doc(String(gameId)).update({
    status: "playing",
    startedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  if (shouldAutoDrawBalls(game)) {
    startAutoTimer(gameId, interval);
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

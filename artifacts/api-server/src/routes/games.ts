import { Router, type IRouter } from "express";
import { db, gamesTable, drawnNumbersTable, winnersTable, roomsTable, cardsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";
import {
  CreateGameBody, GetGameParams, ControlGameParams, ControlGameBody,
  DrawNumberParams, GetDrawnNumbersParams, GetGameWinnersParams
} from "@workspace/api-zod";
import { getBingoLetter, validatePattern } from "../lib/bingo";
import { emitBallDrawn, emitGameState, emitWinner } from "../lib/socket";

const router: IRouter = Router();

// Auto-draw timers: gameId -> intervalId
const autoDrawTimers = new Map<number, ReturnType<typeof setInterval>>();

function serializeGame(g: any) {
  return {
    id: g.id,
    roomId: g.roomId,
    title: g.title ?? null,
    description: g.description ?? null,
    mode: g.mode ?? "manual",
    status: g.status,
    patternType: g.patternType,
    ballInterval: g.ballInterval,
    prize: g.prize,
    winnerId: g.winnerId,
    winnerCardId: g.winnerCardId,
    scheduledAt: g.scheduledAt instanceof Date ? g.scheduledAt.toISOString() : g.scheduledAt ?? null,
    startedAt: g.startedAt instanceof Date ? g.startedAt.toISOString() : g.startedAt ?? null,
    finishedAt: g.finishedAt instanceof Date ? g.finishedAt.toISOString() : g.finishedAt ?? null,
    createdAt: g.createdAt instanceof Date ? g.createdAt.toISOString() : g.createdAt,
  };
}

function serializeDrawn(d: any) {
  return {
    id: d.id,
    gameId: d.gameId,
    number: d.number,
    letter: d.letter,
    drawnAt: d.drawnAt instanceof Date ? d.drawnAt.toISOString() : d.drawnAt,
  };
}

async function drawBallForGame(gameId: number, roomId: number) {
  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, gameId));
  if (!game || game.status !== "playing") { stopAutoTimer(gameId); return; }

  const drawn = await db.select().from(drawnNumbersTable).where(eq(drawnNumbersTable.gameId, gameId));
  const drawnSet = new Set(drawn.map((d) => d.number));
  const allNums = Array.from({ length: 75 }, (_, i) => i + 1).filter((n) => !drawnSet.has(n));
  if (allNums.length === 0) { stopAutoTimer(gameId); return; }

  const number = allNums[Math.floor(Math.random() * allNums.length)];
  const letter = getBingoLetter(number);
  const [drawnNum] = await db.insert(drawnNumbersTable).values({ gameId, number, letter }).returning();

  const cards = await db.select().from(cardsTable).where(eq(cardsTable.gameId, gameId));
  for (const card of cards) {
    const grid: number[][] = JSON.parse(card.numbers);
    if (grid.flat().includes(number)) {
      const marked: number[] = JSON.parse(card.markedNumbers || "[]");
      if (!marked.includes(number)) {
        marked.push(number);
        await db.update(cardsTable).set({ markedNumbers: JSON.stringify(marked) }).where(eq(cardsTable.id, card.id));
      }
    }
  }
  emitBallDrawn(roomId, serializeDrawn(drawnNum));
}

function startAutoTimer(gameId: number, roomId: number, intervalSecs: number) {
  stopAutoTimer(gameId);
  const ms = Math.max(intervalSecs * 1000, 2000);
  const timer = setInterval(() => drawBallForGame(gameId, roomId), ms);
  autoDrawTimers.set(gameId, timer);
}

function stopAutoTimer(gameId: number) {
  const t = autoDrawTimers.get(gameId);
  if (t) { clearInterval(t); autoDrawTimers.delete(gameId); }
}

// List all games
router.get("/games", requireAuth, async (_req, res): Promise<void> => {
  const games = await db.select().from(gamesTable).orderBy(desc(gamesTable.createdAt));
  res.json(games.map(serializeGame));
});

// Create game / sorteo
router.post("/games", requireAdmin, async (req, res): Promise<void> => {
  const { roomId, title, description, mode, patternType, prize, ballInterval, scheduledAt } = req.body;
  if (!roomId) { res.status(400).json({ error: "roomId requerido" }); return; }

  const [room] = await db.select().from(roomsTable).where(eq(roomsTable.id, Number(roomId)));
  if (!room) { res.status(404).json({ error: "Sala no encontrada" }); return; }

  if (room.currentGameId) {
    await db.update(gamesTable).set({ status: "finished", finishedAt: new Date() }).where(eq(gamesTable.id, room.currentGameId));
    stopAutoTimer(room.currentGameId);
  }

  const [game] = await db.insert(gamesTable).values({
    roomId: Number(roomId),
    title: title || null,
    description: description || null,
    mode: mode || "manual",
    patternType: patternType ?? room.patternType,
    prize: prize != null ? Number(prize) : room.prize,
    ballInterval: ballInterval != null ? Number(ballInterval) : room.ballInterval,
    status: "waiting",
    scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
  }).returning();

  await db.update(roomsTable).set({ currentGameId: game.id, status: "playing" }).where(eq(roomsTable.id, room.id));
  emitGameState(room.id, { roomId: room.id, gameId: game.id, status: "waiting" });
  res.status(201).json(serializeGame(game));
});

// Get single game
router.get("/games/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, id));
  if (!game) { res.status(404).json({ error: "Partida no encontrada" }); return; }
  res.json(serializeGame(game));
});

// Edit game (admin)
router.patch("/games/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, id));
  if (!game) { res.status(404).json({ error: "Partida no encontrada" }); return; }
  if (game.status === "playing") { res.status(400).json({ error: "No puedes editar una partida en curso" }); return; }

  const { title, description, mode, patternType, prize, ballInterval, scheduledAt } = req.body;
  const updates: Record<string, any> = {};
  if (title !== undefined) updates.title = title || null;
  if (description !== undefined) updates.description = description || null;
  if (mode !== undefined) updates.mode = mode;
  if (patternType !== undefined) updates.patternType = patternType;
  if (prize !== undefined) updates.prize = Number(prize);
  if (ballInterval !== undefined) updates.ballInterval = Number(ballInterval);
  if (scheduledAt !== undefined) updates.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;

  const [updated] = await db.update(gamesTable).set(updates).where(eq(gamesTable.id, id)).returning();
  res.json(serializeGame(updated));
});

// Delete game (admin)
router.delete("/games/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, id));
  if (!game) { res.status(404).json({ error: "Partida no encontrada" }); return; }

  stopAutoTimer(id);

  // Remove from room if it's the current game
  await db.update(roomsTable)
    .set({ currentGameId: null, status: "active" })
    .where(eq(roomsTable.currentGameId, id));

  // Delete related data
  await db.delete(drawnNumbersTable).where(eq(drawnNumbersTable.gameId, id));
  await db.delete(winnersTable).where(eq(winnersTable.gameId, id));
  await db.delete(gamesTable).where(eq(gamesTable.id, id));

  res.json({ ok: true });
});

// Control game
router.post("/games/:id/control", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const { action } = req.body;
  if (!action) { res.status(400).json({ error: "Acción requerida" }); return; }

  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, id));
  if (!game) { res.status(404).json({ error: "Partida no encontrada" }); return; }

  const [room] = await db.select().from(roomsTable).where(eq(roomsTable.id, game.roomId));

  let updateData: Record<string, any> = {};

  switch (action) {
    case "start":
      if (game.status !== "waiting") { res.status(400).json({ error: "Solo se puede iniciar una partida en espera" }); return; }
      updateData = { status: "playing", startedAt: new Date() };
      if (game.mode === "automatic" || room?.type === "automatic") {
        startAutoTimer(game.id, game.roomId, game.ballInterval);
      }
      break;
    case "pause":
      if (game.status !== "playing") { res.status(400).json({ error: "La partida no está en curso" }); return; }
      updateData = { status: "paused" };
      stopAutoTimer(game.id);
      break;
    case "resume":
      if (game.status !== "paused") { res.status(400).json({ error: "La partida no está pausada" }); return; }
      updateData = { status: "playing" };
      if (game.mode === "automatic" || room?.type === "automatic") {
        startAutoTimer(game.id, game.roomId, game.ballInterval);
      }
      break;
    case "finish":
      updateData = { status: "finished", finishedAt: new Date() };
      stopAutoTimer(game.id);
      await db.update(roomsTable).set({ status: "active", currentGameId: null }).where(eq(roomsTable.id, game.roomId));
      break;
    case "restart":
      await db.delete(drawnNumbersTable).where(eq(drawnNumbersTable.gameId, game.id));
      await db.delete(winnersTable).where(eq(winnersTable.gameId, game.id));
      await db.update(cardsTable).set({ isWinner: false, markedNumbers: "[]" }).where(eq(cardsTable.gameId, game.id));
      stopAutoTimer(game.id);
      updateData = { status: "waiting", startedAt: null, finishedAt: null, winnerId: null, winnerCardId: null };
      break;
    default:
      res.status(400).json({ error: "Acción inválida" }); return;
  }

  const [updated] = await db.update(gamesTable).set(updateData).where(eq(gamesTable.id, game.id)).returning();
  emitGameState(game.roomId, { gameId: game.id, status: updated.status, roomId: game.roomId });
  res.json(serializeGame(updated));
});

// Draw a ball manually
router.post("/games/:id/draw", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, id));
  if (!game) { res.status(404).json({ error: "Partida no encontrada" }); return; }
  if (game.status !== "playing") { res.status(400).json({ error: "La partida no está activa" }); return; }

  const drawn = await db.select().from(drawnNumbersTable).where(eq(drawnNumbersTable.gameId, game.id));
  const drawnSet = new Set(drawn.map((d) => d.number));
  const allNums = Array.from({ length: 75 }, (_, i) => i + 1).filter((n) => !drawnSet.has(n));
  if (allNums.length === 0) { res.status(400).json({ error: "Todos los números han sido sorteados" }); return; }

  const number = allNums[Math.floor(Math.random() * allNums.length)];
  const letter = getBingoLetter(number);
  const [drawnNum] = await db.insert(drawnNumbersTable).values({ gameId: game.id, number, letter }).returning();

  const cards = await db.select().from(cardsTable).where(eq(cardsTable.gameId, game.id));
  for (const card of cards) {
    const grid: number[][] = JSON.parse(card.numbers);
    if (grid.flat().includes(number)) {
      const marked: number[] = JSON.parse(card.markedNumbers || "[]");
      if (!marked.includes(number)) {
        marked.push(number);
        await db.update(cardsTable).set({ markedNumbers: JSON.stringify(marked) }).where(eq(cardsTable.id, card.id));
      }
    }
  }

  const result = serializeDrawn(drawnNum);
  emitBallDrawn(game.roomId, result);
  res.json(result);
});

// Get drawn numbers for a game
router.get("/games/:id/numbers", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
  const nums = await db.select().from(drawnNumbersTable).where(eq(drawnNumbersTable.gameId, id)).orderBy(drawnNumbersTable.drawnAt);
  res.json(nums.map(serializeDrawn));
});

// Get winners for a game
router.get("/games/:id/winners", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
  const winners = await db.select().from(winnersTable).where(eq(winnersTable.gameId, id));
  const result = await Promise.all(winners.map(async (w) => {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, w.userId));
    return {
      id: w.id, gameId: w.gameId, userId: w.userId, cardId: w.cardId,
      username: user?.username ?? "Desconocido",
      pattern: w.pattern, prize: w.prize,
      createdAt: w.createdAt instanceof Date ? w.createdAt.toISOString() : w.createdAt,
    };
  }));
  res.json(result);
});

export default router;

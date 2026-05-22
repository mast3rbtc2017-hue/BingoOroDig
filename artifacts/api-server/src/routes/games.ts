import { Router, type IRouter } from "express";
import { db, gamesTable, drawnNumbersTable, winnersTable, roomsTable, cardsTable, usersTable, transactionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
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
    status: g.status,
    patternType: g.patternType,
    ballInterval: g.ballInterval,
    prize: g.prize,
    winnerId: g.winnerId,
    winnerCardId: g.winnerCardId,
    startedAt: g.startedAt instanceof Date ? g.startedAt.toISOString() : g.startedAt,
    finishedAt: g.finishedAt instanceof Date ? g.finishedAt.toISOString() : g.finishedAt,
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
  if (!game || game.status !== "playing") {
    stopAutoTimer(gameId);
    return;
  }

  const drawn = await db.select().from(drawnNumbersTable).where(eq(drawnNumbersTable.gameId, gameId));
  const drawnSet = new Set(drawn.map((d) => d.number));
  const allNums = Array.from({ length: 75 }, (_, i) => i + 1).filter((n) => !drawnSet.has(n));

  if (allNums.length === 0) {
    stopAutoTimer(gameId);
    return;
  }

  const number = allNums[Math.floor(Math.random() * allNums.length)];
  const letter = getBingoLetter(number);

  const [drawnNum] = await db.insert(drawnNumbersTable).values({ gameId, number, letter }).returning();

  // Mark cards
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
  if (t) {
    clearInterval(t);
    autoDrawTimers.delete(gameId);
  }
}

router.get("/games", requireAuth, async (_req, res): Promise<void> => {
  const games = await db.select().from(gamesTable).orderBy(gamesTable.createdAt);
  res.json(games.map(serializeGame));
});

router.post("/games", requireAdmin, async (req, res): Promise<void> => {
  const body = CreateGameBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [room] = await db.select().from(roomsTable).where(eq(roomsTable.id, body.data.roomId));
  if (!room) {
    res.status(404).json({ error: "Sala no encontrada" });
    return;
  }

  // Finish any existing game in this room
  if (room.currentGameId) {
    await db.update(gamesTable).set({ status: "finished", finishedAt: new Date() }).where(eq(gamesTable.id, room.currentGameId));
    stopAutoTimer(room.currentGameId);
  }

  const [game] = await db.insert(gamesTable).values({
    roomId: body.data.roomId,
    patternType: body.data.patternType ?? room.patternType,
    prize: body.data.prize ?? room.prize,
    ballInterval: body.data.ballInterval ?? room.ballInterval,
    status: "waiting",
  }).returning();

  await db.update(roomsTable).set({ currentGameId: game.id, status: "playing" }).where(eq(roomsTable.id, room.id));

  emitGameState(room.id, { roomId: room.id, gameId: game.id, status: "waiting" });

  res.status(201).json(serializeGame(game));
});

router.get("/games/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetGameParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, params.data.id));
  if (!game) {
    res.status(404).json({ error: "Partida no encontrada" });
    return;
  }
  res.json(serializeGame(game));
});

router.post("/games/:id/control", requireAdmin, async (req, res): Promise<void> => {
  const params = ControlGameParams.safeParse(req.params);
  const body = ControlGameBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Solicitud inválida" });
    return;
  }

  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, params.data.id));
  if (!game) {
    res.status(404).json({ error: "Partida no encontrada" });
    return;
  }

  const [room] = await db.select().from(roomsTable).where(eq(roomsTable.id, game.roomId));

  let updateData: Record<string, any> = {};
  const action = body.data.action;

  switch (action) {
    case "start":
      updateData = { status: "playing", startedAt: new Date() };
      // Start auto-draw for automatic rooms
      if (room?.type === "automatic") {
        startAutoTimer(game.id, game.roomId, game.ballInterval);
      }
      break;
    case "pause":
      updateData = { status: "paused" };
      stopAutoTimer(game.id);
      break;
    case "resume":
      updateData = { status: "playing" };
      if (room?.type === "automatic") {
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
      stopAutoTimer(game.id);
      updateData = { status: "waiting", startedAt: null, finishedAt: null, winnerId: null, winnerCardId: null };
      break;
  }

  const [updated] = await db.update(gamesTable).set(updateData).where(eq(gamesTable.id, game.id)).returning();
  emitGameState(game.roomId, { gameId: game.id, status: updated.status });

  res.json(serializeGame(updated));
});

router.post("/games/:id/draw", requireAdmin, async (req, res): Promise<void> => {
  const params = DrawNumberParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, params.data.id));
  if (!game) {
    res.status(404).json({ error: "Partida no encontrada" });
    return;
  }
  if (game.status !== "playing") {
    res.status(400).json({ error: "La partida no está activa" });
    return;
  }

  const drawn = await db.select().from(drawnNumbersTable).where(eq(drawnNumbersTable.gameId, game.id));
  const drawnSet = new Set(drawn.map((d) => d.number));

  const allNums = Array.from({ length: 75 }, (_, i) => i + 1).filter((n) => !drawnSet.has(n));
  if (allNums.length === 0) {
    res.status(400).json({ error: "Todos los números han sido sorteados" });
    return;
  }

  const number = allNums[Math.floor(Math.random() * allNums.length)];
  const letter = getBingoLetter(number);

  const [drawnNum] = await db.insert(drawnNumbersTable).values({ gameId: game.id, number, letter }).returning();

  const cards = await db.select().from(cardsTable).where(eq(cardsTable.gameId, game.id));
  for (const card of cards) {
    const grid: number[][] = JSON.parse(card.numbers);
    const flatNums = grid.flat();
    if (flatNums.includes(number)) {
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

router.get("/games/:id/numbers", requireAuth, async (req, res): Promise<void> => {
  const params = GetDrawnNumbersParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const nums = await db.select().from(drawnNumbersTable).where(eq(drawnNumbersTable.gameId, params.data.id)).orderBy(drawnNumbersTable.drawnAt);
  res.json(nums.map(serializeDrawn));
});

router.get("/games/:id/winners", requireAuth, async (req, res): Promise<void> => {
  const params = GetGameWinnersParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const winners = await db.select().from(winnersTable).where(eq(winnersTable.gameId, params.data.id));
  const result = await Promise.all(winners.map(async (w) => {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, w.userId));
    return {
      id: w.id,
      gameId: w.gameId,
      userId: w.userId,
      cardId: w.cardId,
      username: user?.username ?? "Desconocido",
      pattern: w.pattern,
      prize: w.prize,
      createdAt: w.createdAt instanceof Date ? w.createdAt.toISOString() : w.createdAt,
    };
  }));
  res.json(result);
});

export default router;

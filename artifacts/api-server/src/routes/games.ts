import { Router, type IRouter } from "express";
import { db, gamesTable, drawnNumbersTable, winnersTable, roomsTable, cardsTable, usersTable, transactionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";
import {
  CreateGameBody, GetGameParams, ControlGameParams, ControlGameBody,
  DrawNumberParams, GetDrawnNumbersParams, GetGameWinnersParams
} from "@workspace/api-zod";
import { getBingoLetter, validatePattern } from "../lib/bingo";
import { emitBallDrawn, emitGameState, emitWinner, emitChatMessage } from "../lib/socket";

const router: IRouter = Router();

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
    res.status(404).json({ error: "Room not found" });
    return;
  }

  const [game] = await db.insert(gamesTable).values({
    roomId: body.data.roomId,
    patternType: body.data.patternType ?? room.patternType,
    prize: body.data.prize ?? room.prize,
    ballInterval: body.data.ballInterval ?? room.ballInterval,
    status: "waiting",
  }).returning();

  await db.update(roomsTable).set({ currentGameId: game.id, status: "playing" }).where(eq(roomsTable.id, room.id));

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
    res.status(404).json({ error: "Game not found" });
    return;
  }
  res.json(serializeGame(game));
});

router.post("/games/:id/control", requireAdmin, async (req, res): Promise<void> => {
  const params = ControlGameParams.safeParse(req.params);
  const body = ControlGameBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, params.data.id));
  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }

  let updateData: Record<string, any> = {};
  const action = body.data.action;

  switch (action) {
    case "start":
      updateData = { status: "playing", startedAt: new Date() };
      break;
    case "pause":
      updateData = { status: "paused" };
      break;
    case "resume":
      updateData = { status: "playing" };
      break;
    case "finish":
      updateData = { status: "finished", finishedAt: new Date() };
      await db.update(roomsTable).set({ status: "active", currentGameId: null }).where(eq(roomsTable.id, game.roomId));
      break;
    case "restart":
      await db.delete(drawnNumbersTable).where(eq(drawnNumbersTable.gameId, game.id));
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
    res.status(404).json({ error: "Game not found" });
    return;
  }
  if (game.status !== "playing") {
    res.status(400).json({ error: "Game not in playing state" });
    return;
  }

  const drawn = await db.select().from(drawnNumbersTable).where(eq(drawnNumbersTable.gameId, game.id));
  const drawnSet = new Set(drawn.map((d) => d.number));

  // Generate all 75 numbers excluding drawn
  const allNums = Array.from({ length: 75 }, (_, i) => i + 1).filter((n) => !drawnSet.has(n));
  if (allNums.length === 0) {
    res.status(400).json({ error: "All numbers have been drawn" });
    return;
  }

  const number = allNums[Math.floor(Math.random() * allNums.length)];
  const letter = getBingoLetter(number);

  const [drawnNum] = await db.insert(drawnNumbersTable).values({
    gameId: game.id,
    number,
    letter,
  }).returning();

  // Update all cards that have this number
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
      username: user?.username ?? "Unknown",
      pattern: w.pattern,
      prize: w.prize,
      createdAt: w.createdAt instanceof Date ? w.createdAt.toISOString() : w.createdAt,
    };
  }));
  res.json(result);
});

export default router;

import { Router, type IRouter } from "express";
import { db, cardsTable, gamesTable, roomsTable, usersTable, winnersTable, transactionsTable, drawnNumbersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { BuyCardBody, GetCardParams, ClaimBingoParams, ClaimBingoBody } from "@workspace/api-zod";
import { generateCard, validatePattern, nextColorTheme } from "../lib/bingo";
import { emitWinner, emitChatMessage } from "../lib/socket";

const router: IRouter = Router();

function serializeCard(c: any) {
  return {
    id: c.id,
    userId: c.userId,
    gameId: c.gameId,
    roomId: c.roomId,
    numbers: c.numbers,
    markedNumbers: c.markedNumbers,
    isWinner: c.isWinner,
    colorTheme: c.colorTheme,
    purchasedAt: c.purchasedAt instanceof Date ? c.purchasedAt.toISOString() : c.purchasedAt,
  };
}

router.get("/cards", requireAuth, async (req: any, res): Promise<void> => {
  const cards = await db.select().from(cardsTable).where(eq(cardsTable.userId, req.userId));
  res.json(cards.map(serializeCard));
});

router.post("/cards", requireAuth, async (req: any, res): Promise<void> => {
  const body = BuyCardBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, body.data.gameId));
  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }

  const [room] = await db.select().from(roomsTable).where(eq(roomsTable.id, game.roomId));
  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }

  const qty = body.data.quantity ?? 1;
  const totalCost = room.cardPrice * qty;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId));
  if (!user || user.balance < totalCost) {
    res.status(400).json({ error: "Insufficient balance" });
    return;
  }

  // Deduct balance
  await db.update(usersTable).set({ balance: user.balance - totalCost }).where(eq(usersTable.id, req.userId));
  await db.insert(transactionsTable).values({
    userId: req.userId,
    type: "purchase",
    amount: totalCost,
    description: `Compra de ${qty} carton(es) - Sala ${room.name}`,
  });

  const cards = [];
  for (let i = 0; i < qty; i++) {
    const grid = generateCard();
    const [card] = await db.insert(cardsTable).values({
      userId: req.userId,
      gameId: body.data.gameId,
      roomId: game.roomId,
      numbers: JSON.stringify(grid),
      markedNumbers: "[]",
      isWinner: false,
      colorTheme: nextColorTheme(),
    }).returning();
    cards.push(card);
  }

  res.status(201).json(serializeCard(cards[0]));
});

router.get("/cards/:id", requireAuth, async (req: any, res): Promise<void> => {
  const params = GetCardParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [card] = await db.select().from(cardsTable).where(and(
    eq(cardsTable.id, params.data.id),
    eq(cardsTable.userId, req.userId),
  ));
  if (!card) {
    res.status(404).json({ error: "Card not found" });
    return;
  }
  res.json(serializeCard(card));
});

router.post("/cards/:id/claim", requireAuth, async (req: any, res): Promise<void> => {
  const params = ClaimBingoParams.safeParse(req.params);
  const body = ClaimBingoBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const [card] = await db.select().from(cardsTable).where(and(
    eq(cardsTable.id, params.data.id),
    eq(cardsTable.userId, req.userId),
  ));
  if (!card) {
    res.status(404).json({ error: "Card not found" });
    return;
  }
  if (card.isWinner) {
    res.status(400).json({ error: "Already claimed" });
    return;
  }

  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, card.gameId));
  if (!game || game.status !== "playing") {
    res.status(400).json({ error: "Game not active" });
    return;
  }

  const grid: number[][] = JSON.parse(card.numbers);
  const markedNums: number[] = JSON.parse(card.markedNumbers || "[]");

  const valid = validatePattern(grid, markedNums, body.data.pattern as any);
  if (!valid) {
    res.status(400).json({ error: "Invalid bingo claim" });
    return;
  }

  // Mark winner
  await db.update(cardsTable).set({ isWinner: true }).where(eq(cardsTable.id, card.id));
  await db.update(gamesTable).set({ winnerId: req.userId, winnerCardId: card.id, status: "finished", finishedAt: new Date() }).where(eq(gamesTable.id, game.id));
  await db.update(roomsTable).set({ status: "active", currentGameId: null }).where(eq(roomsTable.id, game.roomId));

  const [winner] = await db.insert(winnersTable).values({
    gameId: game.id,
    userId: req.userId,
    cardId: card.id,
    pattern: body.data.pattern,
    prize: game.prize,
  }).returning();

  // Credit prize
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId));
  if (user) {
    await db.update(usersTable).set({
      balance: user.balance + game.prize,
      totalWins: user.totalWins + 1,
    }).where(eq(usersTable.id, req.userId));
    await db.insert(transactionsTable).values({
      userId: req.userId,
      type: "prize",
      amount: game.prize,
      description: `Premio BINGO - ${body.data.pattern}`,
    });

    emitWinner(game.roomId, {
      gameId: game.id,
      userId: req.userId,
      username: user.username,
      cardId: card.id,
      pattern: body.data.pattern,
      prize: game.prize,
    });
  }

  res.json({
    id: winner.id,
    gameId: winner.gameId,
    userId: winner.userId,
    cardId: winner.cardId,
    username: user?.username ?? "Unknown",
    pattern: winner.pattern,
    prize: winner.prize,
    createdAt: winner.createdAt instanceof Date ? winner.createdAt.toISOString() : winner.createdAt,
  });
});

export default router;

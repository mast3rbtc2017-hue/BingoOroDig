import { Router } from "express";
import { z } from "zod";
import { db, FieldValue, nextId, Timestamp } from "../lib/firestore";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { generateCard, validatePattern, nextColorTheme } from "../lib/bingo";
import { getGame, getRoom } from "../lib/autoDraw";
import { stopAutoTimer } from "../lib/autoDraw";

const router = Router();

const BuyCardBody = z.object({
  gameId: z.number(),
  quantity: z.number().optional(),
});

const ClaimBingoBody = z.object({
  pattern: z.string(),
});

function serializeCard(c: Record<string, unknown>) {
  return {
    id: c.id,
    userId: c.userId,
    gameId: c.gameId,
    roomId: c.roomId,
    numbers: c.numbers,
    markedNumbers: c.markedNumbers,
    isWinner: c.isWinner,
    colorTheme: c.colorTheme,
    purchasedAt:
      c.purchasedAt instanceof Timestamp
        ? c.purchasedAt.toDate().toISOString()
        : c.purchasedAt,
  };
}

router.get("/cards", requireAuth, async (req: AuthedRequest, res) => {
  const snap = await db
    .collection("cards")
    .where("userUid", "==", req.userUid)
    .get();
  res.json(
    snap.docs
      .map((d) => serializeCard({ id: Number(d.id), ...d.data() }))
      .sort((a, b) => String(b.purchasedAt).localeCompare(String(a.purchasedAt))),
  );
});

router.post("/cards", requireAuth, async (req: AuthedRequest, res) => {
  const body = BuyCardBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const game = await getGame(body.data.gameId);
  if (!game) {
    res.status(404).json({ error: "Partida no encontrada" });
    return;
  }
  if (game.status === "finished" || game.status === "paused") {
    res.status(400).json({ error: "La partida no acepta nuevos cartones en este momento" });
    return;
  }

  const room = await getRoom(game.roomId as number);
  if (!room) {
    res.status(404).json({ error: "Sala no encontrada" });
    return;
  }

  const qty = body.data.quantity ?? 1;
  const totalCost = (room.cardPrice as number) * qty;
  const userRef = db.collection("users").doc(req.userUid!);
  const userSnap = await userRef.get();
  const user = userSnap.data()!;
  if (user.balance < totalCost) {
    res.status(400).json({ error: "Saldo insuficiente" });
    return;
  }

  await userRef.update({ balance: user.balance - totalCost });

  await userRef.collection("transactions").add({
    userId: user.id,
    type: "purchase",
    amount: totalCost,
    description: `Compra de ${qty} cartón(es) — Sala ${room.name}`,
    createdAt: FieldValue.serverTimestamp(),
  });

  const cards = [];
  for (let i = 0; i < qty; i++) {
    const cardId = await nextId("cards");
    const grid = generateCard();
    const card = {
      id: cardId,
      userId: user.id,
      userUid: req.userUid,
      gameId: body.data.gameId,
      roomId: game.roomId,
      numbers: JSON.stringify(grid),
      markedNumbers: "[]",
      isWinner: false,
      colorTheme: nextColorTheme(),
      purchasedAt: FieldValue.serverTimestamp(),
    };
    await db.collection("cards").doc(String(cardId)).set(card);
    cards.push(card);
  }

  res.status(201).json(
    serializeCard({ ...cards[0], purchasedAt: new Date() }),
  );
});

router.get("/cards/:id", requireAuth, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const snap = await db.collection("cards").doc(String(id)).get();
  if (!snap.exists || snap.data()?.userUid !== req.userUid) {
    res.status(404).json({ error: "Cartón no encontrado" });
    return;
  }
  res.json(serializeCard({ id, ...snap.data()! }));
});

router.post("/cards/:id/claim", requireAuth, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const body = ClaimBingoBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Solicitud inválida" });
    return;
  }

  const cardRef = db.collection("cards").doc(String(id));
  const cardSnap = await cardRef.get();
  if (!cardSnap.exists || cardSnap.data()?.userUid !== req.userUid) {
    res.status(404).json({ error: "Cartón no encontrado" });
    return;
  }
  const card = cardSnap.data()!;

  if (card.isWinner) {
    res.status(400).json({ error: "Ya reclamado" });
    return;
  }

  const game = await getGame(card.gameId);
  if (!game || game.status !== "playing") {
    res.status(400).json({ error: "La partida no está activa" });
    return;
  }

  const drawnSnap = await db
    .collection("games")
    .doc(String(card.gameId))
    .collection("drawnNumbers")
    .get();
  const drawnNums = drawnSnap.docs.map((d) => d.data().number as number);
  const grid: number[][] = JSON.parse(card.numbers);

  const valid = validatePattern(grid, drawnNums, body.data.pattern as never);
  if (!valid) {
    res.status(400).json({ error: "¡El patrón de bingo no es válido aún!" });
    return;
  }

  stopAutoTimer(card.gameId);

  await cardRef.update({ isWinner: true });
  await db.collection("games").doc(String(card.gameId)).update({
    winnerId: req.userId,
    winnerCardId: id,
    status: "finished",
    finishedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await db.collection("rooms").doc(String(card.roomId)).update({
    status: "active",
    currentGameId: null,
    updatedAt: FieldValue.serverTimestamp(),
  });

  const winnerId = await nextId("winners");
  const winner = {
    id: winnerId,
    gameId: card.gameId,
    userId: req.userId,
    cardId: id,
    pattern: body.data.pattern,
    prize: game.prize,
    username: req.userProfile?.username,
    createdAt: FieldValue.serverTimestamp(),
  };

  await db.collection("games").doc(String(card.gameId)).collection("winners").doc(String(winnerId)).set(winner);
  await db.collection("winners").doc(String(winnerId)).set(winner);

  const userRef = db.collection("users").doc(req.userUid!);
  const userSnap = await userRef.get();
  const user = userSnap.data()!;
  await userRef.update({
    balance: user.balance + (game.prize as number),
    totalWins: (user.totalWins ?? 0) + 1,
  });

  await userRef.collection("transactions").add({
    userId: user.id,
    type: "prize",
    amount: game.prize,
    description: `¡BINGO! Premio — patrón ${body.data.pattern}`,
    createdAt: FieldValue.serverTimestamp(),
  });

  res.json({
    id: winnerId,
    gameId: card.gameId,
    userId: req.userId,
    cardId: id,
    username: user.username,
    pattern: body.data.pattern,
    prize: game.prize,
    createdAt: new Date().toISOString(),
  });
});

export default router;

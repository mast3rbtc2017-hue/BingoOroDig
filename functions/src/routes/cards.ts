import { Router } from "express";
import { z } from "zod";
import { db, FieldValue, nextId, Timestamp } from "../lib/firestore";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { generateCard, nextColorTheme } from "../lib/bingo";
import { getGame } from "../lib/autoDraw";
import { resolveGameSettings } from "../lib/gameMeta";
import { submitBingoClaim } from "../lib/bingoClaims";

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
    claimStatus: c.claimStatus ?? null,
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

  const settings = await resolveGameSettings(game);

  const qty = body.data.quantity ?? 1;
  const totalCost = settings.cardPrice * qty;
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
    description: `Compra de ${qty} cartón(es) — ${(game.title as string) || `Sorteo #${body.data.gameId}`}`,
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
      roomId: body.data.gameId,
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

  try {
    const result = await submitBingoClaim(req, id, body.data.pattern);
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al reclamar";
    res.status(400).json({ error: message });
  }
});

export default router;

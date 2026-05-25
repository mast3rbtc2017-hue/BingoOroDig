import { Router } from "express";
import { db, FieldValue, nextId, Timestamp } from "../lib/firestore";
import { requireAuth, requireAdmin, type AuthedRequest } from "../lib/auth";
import { getGame, serializeGame, stopAutoTimer, startAutoTimer } from "../lib/autoDraw";
import {
  ballIntervalSecs,
  processScheduledGames,
  shouldAutoDrawBalls,
  startGameById,
} from "../lib/scheduler";
import { syncGameSettings } from "../lib/gameMeta";
import { drawBallForGame, serializeDrawn } from "../lib/gameLogic";
import { getUserByLegacyId } from "../lib/auth";
import {
  approveBingoClaim,
  rejectBingoClaim,
  serializeBingoClaim,
} from "../lib/bingoClaims";

const router = Router();

router.get("/games", requireAuth, async (_req, res) => {
  await processScheduledGames();
  const snap = await db.collection("games").orderBy("createdAt", "desc").get();
  res.json(snap.docs.map((d) => serializeGame({ id: Number(d.id), ...d.data() })));
});

const LOBBY_STATUSES = ["waiting", "playing", "paused", "finished"];

/** Sorteos visibles en el lobby (sin salas) */
router.get("/games/lobby", requireAuth, async (_req, res) => {
  await processScheduledGames();
  const snap = await db.collection("games").get();
  const items: Array<{
    game: ReturnType<typeof serializeGame>;
    winnerUsername: string | null;
  }> = [];

  for (const doc of snap.docs) {
    const raw = { id: Number(doc.id), ...doc.data() } as Record<string, unknown>;
    const status = raw.status as string;
    if (!LOBBY_STATUSES.includes(status)) continue;

    let winnerUsername: string | null = null;
    if (raw.winnerId) {
      const winner = await getUserByLegacyId(raw.winnerId as number);
      winnerUsername = winner?.username ?? null;
    }

    items.push({
      game: serializeGame(raw),
      winnerUsername,
    });
  }

  const order: Record<string, number> = {
    playing: 0,
    paused: 1,
    waiting: 2,
    finished: 3,
  };
  items.sort(
    (a, b) =>
      (order[a.game.status as string] ?? 9) - (order[b.game.status as string] ?? 9),
  );

  res.json(items);
});

router.post("/games/tick-schedule", requireAuth, async (_req, res) => {
  const started = await processScheduledGames();
  res.json({ started });
});

router.post("/games", requireAdmin, async (req, res) => {
  const {
    title,
    description,
    mode,
    patternType,
    prize,
    ballInterval,
    cardPrice,
    maxPlayers,
    type,
    scheduledAt,
  } = req.body;

  if (!title || !String(title).trim()) {
    res.status(400).json({ error: "El título del sorteo es obligatorio" });
    return;
  }

  const gameId = await nextId("games");
  const meta = syncGameSettings({
    cardPrice: cardPrice != null ? Number(cardPrice) : undefined,
    maxPlayers: maxPlayers != null ? Number(maxPlayers) : undefined,
    ballInterval: ballInterval != null ? Number(ballInterval) : undefined,
    prize: prize != null ? Number(prize) : undefined,
    patternType: patternType ?? "line",
    type: type ?? "classic",
  });

  const game = {
    id: gameId,
    title: String(title).trim(),
    description: description ? String(description) : null,
    mode: mode || "manual",
    ...meta,
    status: "waiting",
    winnerId: null,
    winnerCardId: null,
    pendingReview: false,
    scheduledAt: scheduledAt
      ? Timestamp.fromDate(new Date(scheduledAt as string))
      : null,
    startedAt: null,
    finishedAt: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await db.collection("games").doc(String(gameId)).set(game);

  res.status(201).json(serializeGame({ ...game, createdAt: new Date() }));
});

router.get("/games/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  await processScheduledGames();
  const game = await getGame(id);
  if (!game) {
    res.status(404).json({ error: "Partida no encontrada" });
    return;
  }
  res.json(serializeGame(game));
});

router.patch("/games/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const game = await getGame(id);
  if (!game) {
    res.status(404).json({ error: "Partida no encontrada" });
    return;
  }
  if (game.status === "playing") {
    res.status(400).json({ error: "No puedes editar una partida en curso" });
    return;
  }
  const updates: Record<string, unknown> = { ...req.body, updatedAt: FieldValue.serverTimestamp() };
  if (updates.scheduledAt) {
    updates.scheduledAt = Timestamp.fromDate(new Date(updates.scheduledAt as string));
  }
  await db.collection("games").doc(String(id)).update(updates);
  const updated = await getGame(id);
  res.json(serializeGame(updated!));
});

router.delete("/games/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const game = await getGame(id);
  if (!game) {
    res.status(404).json({ error: "Partida no encontrada" });
    return;
  }
  stopAutoTimer(id);

  const gameRef = db.collection("games").doc(String(id));
  const batch = db.batch();

  const subcols = ["drawnNumbers", "winners", "bingoClaims", "messages"] as const;
  for (const sub of subcols) {
    const snap = await gameRef.collection(sub).get();
    for (const d of snap.docs) batch.delete(d.ref);
  }

  const cards = await db.collection("cards").where("gameId", "==", id).get();
  for (const c of cards.docs) batch.delete(c.ref);

  batch.delete(gameRef);
  await batch.commit();

  res.json({ ok: true });
});

router.post("/games/:id/control", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { action } = req.body;
  if (!action) {
    res.status(400).json({ error: "Acción requerida" });
    return;
  }

  const game = await getGame(id);
  if (!game) {
    res.status(404).json({ error: "Partida no encontrada" });
    return;
  }
  let updateData: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  switch (action) {
    case "start":
      if (game.status !== "waiting") {
        res.status(400).json({ error: "Solo se puede iniciar una partida en espera" });
        return;
      }
      await startGameById(id);
      const startedGame = await getGame(id);
      res.json(serializeGame(startedGame!));
      return;
    case "pause":
      if (game.status !== "playing") {
        res.status(400).json({ error: "La partida no está en curso" });
        return;
      }
      updateData.status = "paused";
      stopAutoTimer(id);
      break;
    case "resume":
      if (game.status !== "paused") {
        res.status(400).json({ error: "La partida no está pausada" });
        return;
      }
      updateData.status = "playing";
      if (shouldAutoDrawBalls(game)) {
        startAutoTimer(id, ballIntervalSecs(game));
      }
      break;
    case "finish":
      updateData = {
        ...updateData,
        status: "finished",
        finishedAt: FieldValue.serverTimestamp(),
      };
      stopAutoTimer(id);
      break;
    case "restart": {
      const drawn = await db.collection("games").doc(String(id)).collection("drawnNumbers").get();
      const batch = db.batch();
      for (const d of drawn.docs) batch.delete(d.ref);
      const winners = await db.collection("games").doc(String(id)).collection("winners").get();
      for (const w of winners.docs) batch.delete(w.ref);
      const cards = await db.collection("cards").where("gameId", "==", id).get();
      for (const c of cards.docs) {
        batch.update(c.ref, { isWinner: false, markedNumbers: "[]" });
      }
      await batch.commit();
      stopAutoTimer(id);
      updateData = {
        ...updateData,
        status: "waiting",
        startedAt: null,
        finishedAt: null,
        winnerId: null,
        winnerCardId: null,
      };
      break;
    }
    default:
      res.status(400).json({ error: "Acción inválida" });
      return;
  }

  await db.collection("games").doc(String(id)).update(updateData);
  const updated = await getGame(id);
  res.json(serializeGame(updated!));
});

router.post("/games/:id/draw", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const game = await getGame(id);
  if (!game) {
    res.status(404).json({ error: "Partida no encontrada" });
    return;
  }
  if (game.status !== "playing") {
    res.status(400).json({ error: "La partida no está activa" });
    return;
  }
  const result = await drawBallForGame(id);
  if (!result) {
    res.status(400).json({ error: "No se pudo sortear" });
    return;
  }
  res.json(result);
});

router.get("/games/:id/numbers", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const snap = await db
    .collection("games")
    .doc(String(id))
    .collection("drawnNumbers")
    .orderBy("drawnAt")
    .get();
  res.json(
    snap.docs.map((d) =>
      serializeDrawn({ id: d.id, gameId: id, ...d.data() }),
    ),
  );
});

router.get("/games/:id/winners", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const snap = await db.collection("games").doc(String(id)).collection("winners").get();
  const result = await Promise.all(
    snap.docs.map(async (d) => {
      const w = d.data();
      const user = await getUserByLegacyId(w.userId);
      return {
        id: w.id ?? d.id,
        gameId: w.gameId,
        userId: w.userId,
        cardId: w.cardId,
        username: user?.username ?? "Desconocido",
        pattern: w.pattern,
        prize: w.prize,
        createdAt:
          w.createdAt instanceof Timestamp
            ? w.createdAt.toDate().toISOString()
            : w.createdAt,
      };
    }),
  );
  res.json(result);
});

router.get("/games/:id/bingo-claims", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const status = (req.query.status as string) || "pending";
  const col = db.collection("games").doc(String(id)).collection("bingoClaims");
  const snap =
    status === "all" ? await col.get() : await col.where("status", "==", status).get();
  const claims = snap.docs
    .map((d) => serializeBingoClaim({ id: Number(d.id), ...d.data() }))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  res.json(claims);
});

router.post("/games/:id/bingo-claims/:claimId/approve", requireAdmin, async (req: AuthedRequest, res) => {
  const gameId = Number(req.params.id);
  const claimId = Number(req.params.claimId);
  const result = await approveBingoClaim(gameId, claimId, req.userProfile?.username ?? "admin");
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ ok: true, prize: result.prize });
});

router.post("/games/:id/bingo-claims/:claimId/reject", requireAdmin, async (req: AuthedRequest, res) => {
  const gameId = Number(req.params.id);
  const claimId = Number(req.params.claimId);
  const result = await rejectBingoClaim(gameId, claimId, req.userProfile?.username ?? "admin");
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ ok: true });
});

export default router;

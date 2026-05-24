import { Router } from "express";
import { db, FieldValue, nextId, Timestamp } from "../lib/firestore";
import { requireAuth, requireAdmin, type AuthedRequest } from "../lib/auth";
import {
  getGame,
  getRoom,
  serializeGame,
  startAutoTimer,
  stopAutoTimer,
} from "../lib/autoDraw";
import {
  ballIntervalSecs,
  processScheduledGames,
  shouldAutoDrawBalls,
  startGameById,
} from "../lib/scheduler";
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

router.post("/games/tick-schedule", requireAuth, async (_req, res) => {
  const started = await processScheduledGames();
  res.json({ started });
});

router.post("/games", requireAdmin, async (req, res) => {
  const { roomId, title, description, mode, patternType, prize, ballInterval, scheduledAt } =
    req.body;
  if (!roomId) {
    res.status(400).json({ error: "roomId requerido" });
    return;
  }

  const room = await getRoom(Number(roomId));
  if (!room) {
    res.status(404).json({ error: "Sala no encontrada" });
    return;
  }

  if (room.currentGameId) {
    await db
      .collection("games")
      .doc(String(room.currentGameId))
      .update({ status: "finished", finishedAt: FieldValue.serverTimestamp() });
    stopAutoTimer(room.currentGameId as number);
  }

  const gameId = await nextId("games");
  const game = {
    id: gameId,
    roomId: Number(roomId),
    title: title || null,
    description: description || null,
    mode: mode || "manual",
    patternType: patternType ?? room.patternType,
    prize: prize != null ? Number(prize) : room.prize,
    ballInterval: ballInterval != null ? Number(ballInterval) : room.ballInterval,
    status: "waiting",
    winnerId: null,
    winnerCardId: null,
    scheduledAt: scheduledAt
      ? Timestamp.fromDate(new Date(scheduledAt as string))
      : null,
    startedAt: null,
    finishedAt: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await db.collection("games").doc(String(gameId)).set(game);
  await db.collection("rooms").doc(String(roomId)).update({
    currentGameId: gameId,
    status: "playing",
    updatedAt: FieldValue.serverTimestamp(),
  });

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

  const roomsSnap = await db.collection("rooms").where("currentGameId", "==", id).get();
  const batch = db.batch();
  for (const r of roomsSnap.docs) {
    batch.update(r.ref, { currentGameId: null, status: "active" });
  }

  const drawn = await db.collection("games").doc(String(id)).collection("drawnNumbers").get();
  for (const d of drawn.docs) batch.delete(d.ref);
  const winners = await db.collection("games").doc(String(id)).collection("winners").get();
  for (const w of winners.docs) batch.delete(w.ref);
  batch.delete(db.collection("games").doc(String(id)));
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
  const room = await getRoom(game.roomId as number);

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
      if (shouldAutoDrawBalls(game, room)) {
        startAutoTimer(id, game.roomId as number, ballIntervalSecs(game, room));
      }
      break;
    case "finish":
      updateData = {
        ...updateData,
        status: "finished",
        finishedAt: FieldValue.serverTimestamp(),
      };
      stopAutoTimer(id);
      await db.collection("rooms").doc(String(game.roomId)).update({
        status: "active",
        currentGameId: null,
        updatedAt: FieldValue.serverTimestamp(),
      });
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
  const result = await drawBallForGame(id, game.roomId as number);
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

import { db, FieldValue, nextId, Timestamp } from "./firestore";
import { notifyUser } from "./notifications";
import { formatCOP } from "./currency";
import { validatePattern, type Pattern } from "./bingo";
import { getGame, stopAutoTimer } from "./autoDraw";
import type { AuthedRequest } from "./auth";

export function serializeBingoClaim(c: Record<string, unknown>) {
  return {
    id: c.id,
    gameId: c.gameId,
    roomId: c.roomId,
    cardId: c.cardId,
    userId: c.userId,
    username: c.username,
    pattern: c.pattern,
    patternValid: c.patternValid ?? null,
    status: c.status,
    createdAt:
      c.createdAt instanceof Timestamp
        ? c.createdAt.toDate().toISOString()
        : c.createdAt,
    reviewedAt:
      c.reviewedAt instanceof Timestamp
        ? c.reviewedAt.toDate().toISOString()
        : c.reviewedAt ?? null,
  };
}

export async function postSystemMessage(roomId: number, content: string): Promise<void> {
  const msgId = await nextId("messages");
  await db
    .collection("rooms")
    .doc(String(roomId))
    .collection("messages")
    .doc(String(msgId))
    .set({
      id: msgId,
      roomId,
      userId: null,
      username: "Sistema",
      avatarUrl: null,
      content,
      type: "system",
      createdAt: FieldValue.serverTimestamp(),
    });
}

export async function pauseGameForReview(gameId: number): Promise<void> {
  stopAutoTimer(gameId);
  await db.collection("games").doc(String(gameId)).update({
    status: "paused",
    pendingReview: true,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function getDrawnNumbers(gameId: number): Promise<number[]> {
  const snap = await db
    .collection("games")
    .doc(String(gameId))
    .collection("drawnNumbers")
    .get();
  return snap.docs.map((d) => d.data().number as number);
}

export async function countPendingClaims(gameId: number): Promise<number> {
  const snap = await db
    .collection("games")
    .doc(String(gameId))
    .collection("bingoClaims")
    .where("status", "==", "pending")
    .get();
  return snap.size;
}

export async function approveBingoClaim(
  gameId: number,
  claimId: number,
  adminUsername: string,
): Promise<{ ok: boolean; error?: string; prize?: number }> {
  const claimRef = db.collection("games").doc(String(gameId)).collection("bingoClaims").doc(String(claimId));
  const claimSnap = await claimRef.get();
  if (!claimSnap.exists) return { ok: false, error: "Reclamo no encontrado" };

  const claim = claimSnap.data()!;
  if (claim.status !== "pending") return { ok: false, error: "Este reclamo ya fue revisado" };

  const game = await getGame(gameId);
  if (!game) return { ok: false, error: "Partida no encontrada" };

  const cardRef = db.collection("cards").doc(String(claim.cardId));
  const cardSnap = await cardRef.get();
  if (!cardSnap.exists) return { ok: false, error: "Cartón no encontrado" };

  const card = cardSnap.data()!;
  const drawnNums = await getDrawnNumbers(gameId);
  const grid: number[][] = JSON.parse(card.numbers as string);
  const pattern = claim.pattern as Pattern;
  const valid = validatePattern(grid, drawnNums, pattern);

  if (!valid) {
    await claimRef.update({
      status: "rejected",
      patternValid: false,
      reviewedBy: adminUsername,
      reviewedAt: FieldValue.serverTimestamp(),
    });
    await cardRef.update({ claimStatus: null });
    const pending = await countPendingClaims(gameId);
    if (pending === 0) {
      await db.collection("games").doc(String(gameId)).update({
        pendingReview: false,
        status: "playing",
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await postSystemMessage(
      claim.roomId as number,
      `❌ BINGO de ${claim.username} rechazado — patrón no válido. Sorteo reanudado.`,
    );
    return { ok: false, error: "Patrón no válido — reclamo rechazado" };
  }

  stopAutoTimer(gameId);

  await cardRef.update({ isWinner: true, claimStatus: "approved" });
  await claimRef.update({
    status: "approved",
    patternValid: true,
    reviewedBy: adminUsername,
    reviewedAt: FieldValue.serverTimestamp(),
  });

  await db.collection("games").doc(String(gameId)).update({
    winnerId: claim.userId,
    winnerCardId: claim.cardId,
    status: "finished",
    pendingReview: false,
    finishedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await db.collection("rooms").doc(String(claim.roomId)).update({
    status: "active",
    updatedAt: FieldValue.serverTimestamp(),
  });

  const winnerId = await nextId("winners");
  const winner = {
    id: winnerId,
    gameId,
    userId: claim.userId,
    cardId: claim.cardId,
    pattern: claim.pattern,
    prize: game.prize,
    username: claim.username,
    createdAt: FieldValue.serverTimestamp(),
  };

  await db.collection("games").doc(String(gameId)).collection("winners").doc(String(winnerId)).set(winner);
  await db.collection("winners").doc(String(winnerId)).set(winner);

  const userRef = db.collection("users").doc(String(claim.userUid));
  const userSnap = await userRef.get();
  if (userSnap.exists) {
    const user = userSnap.data()!;
    await userRef.update({
      balance: (user.balance ?? 0) + (game.prize as number),
      totalWins: (user.totalWins ?? 0) + 1,
    });
    await userRef.collection("transactions").add({
      userId: user.id,
      type: "prize",
      amount: game.prize,
      description: `¡BINGO! Premio — patrón ${claim.pattern}`,
      createdAt: FieldValue.serverTimestamp(),
    });
    await notifyUser(String(claim.userUid), {
      type: "bingo_approved",
      title: "¡BINGO confirmado!",
      message: `Tu premio de ${formatCOP(game.prize as number)} fue acreditado. Patrón: ${claim.pattern}`,
      gameId,
      roomId: claim.roomId as number,
      amount: game.prize as number,
    });
  }

  await postSystemMessage(
    claim.roomId as number,
    `🎉 ¡BINGO confirmado! ${claim.username} ganó ${formatCOP(game.prize as number)}`,
  );

  return { ok: true, prize: game.prize as number };
}

export async function rejectBingoClaim(
  gameId: number,
  claimId: number,
  adminUsername: string,
): Promise<{ ok: boolean; error?: string }> {
  const claimRef = db.collection("games").doc(String(gameId)).collection("bingoClaims").doc(String(claimId));
  const claimSnap = await claimRef.get();
  if (!claimSnap.exists) return { ok: false, error: "Reclamo no encontrado" };

  const claim = claimSnap.data()!;
  if (claim.status !== "pending") return { ok: false, error: "Este reclamo ya fue revisado" };

  await claimRef.update({
    status: "rejected",
    reviewedBy: adminUsername,
    reviewedAt: FieldValue.serverTimestamp(),
  });

  await db.collection("cards").doc(String(claim.cardId)).update({ claimStatus: null });

  const pending = await countPendingClaims(gameId);
  if (pending === 0) {
    await db.collection("games").doc(String(gameId)).update({
      pendingReview: false,
      status: "playing",
      updatedAt: FieldValue.serverTimestamp(),
    });
    await postSystemMessage(
      claim.roomId as number,
      `Sorteo reanudado tras revisión (${adminUsername}).`,
    );
  }

  await postSystemMessage(
    claim.roomId as number,
    `❌ BINGO de ${claim.username} rechazado por ${adminUsername}.`,
  );

  return { ok: true };
}

export async function submitBingoClaim(
  req: AuthedRequest,
  cardId: number,
  pattern: string,
): Promise<Record<string, unknown>> {
  const cardRef = db.collection("cards").doc(String(cardId));
  const cardSnap = await cardRef.get();
  if (!cardSnap.exists || cardSnap.data()?.userUid !== req.userUid) {
    throw new Error("Cartón no encontrado");
  }
  const card = cardSnap.data()!;

  if (card.isWinner) throw new Error("Ya ganaste con este cartón");
  if (card.claimStatus === "pending") throw new Error("Tu bingo ya está en revisión");

  const game = await getGame(card.gameId as number);
  if (!game || game.status !== "playing") {
    throw new Error("La partida no está activa");
  }

  const existing = await db
    .collection("games")
    .doc(String(card.gameId))
    .collection("bingoClaims")
    .where("cardId", "==", cardId)
    .where("status", "==", "pending")
    .limit(1)
    .get();
  if (!existing.empty) throw new Error("Ya tienes un bingo en revisión");

  const drawnNums = await getDrawnNumbers(card.gameId as number);
  const grid: number[][] = JSON.parse(card.numbers as string);
  const patternValid = validatePattern(grid, drawnNums, pattern as Pattern);

  const claimId = await nextId("bingoClaims");
  const claim = {
    id: claimId,
    gameId: card.gameId,
    roomId: card.roomId,
    cardId,
    userId: req.userId,
    userUid: req.userUid,
    username: req.userProfile?.username ?? "Jugador",
    pattern,
    patternValid,
    status: "pending",
    createdAt: FieldValue.serverTimestamp(),
  };

  await db
    .collection("games")
    .doc(String(card.gameId))
    .collection("bingoClaims")
    .doc(String(claimId))
    .set(claim);

  await cardRef.update({ claimStatus: "pending" });
  await pauseGameForReview(card.gameId as number);

  await postSystemMessage(
    card.roomId as number,
    `🔔 ${req.userProfile?.username} cantó ¡BINGO! — Sorteo pausado. Pendiente revisión del admin.`,
  );

  return {
    status: "pending",
    claimId,
    patternValid,
    message: "¡BINGO registrado! El sorteo se detuvo. Esperando verificación del administrador.",
  };
}

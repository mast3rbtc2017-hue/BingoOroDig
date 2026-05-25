import { db, FieldValue, Timestamp } from "./firestore";
import { nextId } from "./firestore";
import { formatCOP } from "./currency";
import {
  formatDrawColombia,
  parseScheduledDrawColombia,
  RAFFLE_TIMEZONE,
} from "./raffleTime";
import { notifyUser } from "./notifications";
import { getUserByLegacyId } from "./auth";

export type RaffleStatus = "draft" | "open" | "closed" | "drawn" | "cancelled";

export async function getRaffle(id: number): Promise<Record<string, unknown> | null> {
  const snap = await db.collection("raffles").doc(String(id)).get();
  if (!snap.exists) return null;
  return { id: Number(snap.id), ...snap.data() };
}

export function serializeRaffle(r: Record<string, unknown>) {
  const scheduledDrawAt =
    r.scheduledDrawAt instanceof Timestamp
      ? r.scheduledDrawAt.toDate().toISOString()
      : (r.scheduledDrawAt as string | null | undefined) ?? null;
  const drawnAt =
    r.drawnAt instanceof Timestamp
      ? r.drawnAt.toDate().toISOString()
      : (r.drawnAt as string | null | undefined) ?? null;

  return {
    id: r.id,
    title: r.title,
    description: r.description ?? null,
    prizeTitle: r.prizeTitle ?? null,
    prizeDescription: r.prizeDescription ?? null,
    imageUrl: r.imageUrl ?? null,
    rules: r.rules ?? null,
    status: r.status as RaffleStatus,
    ticketPrice: r.ticketPrice,
    totalNumbers: r.totalNumbers,
    soldCount: r.soldCount ?? 0,
    scheduledDrawAt,
    scheduledDrawAtLabel: scheduledDrawAt
      ? formatDrawColombia(scheduledDrawAt)
      : null,
    timezone: RAFFLE_TIMEZONE,
    drawnAt,
    winningNumber: r.winningNumber ?? null,
    winnerUserId: r.winnerUserId ?? null,
    winnerUsername: r.winnerUsername ?? null,
    createdAt:
      r.createdAt instanceof Timestamp
        ? r.createdAt.toDate().toISOString()
        : r.createdAt,
    updatedAt:
      r.updatedAt instanceof Timestamp
        ? r.updatedAt.toDate().toISOString()
        : r.updatedAt,
  };
}

export async function getSoldNumbers(raffleId: number): Promise<number[]> {
  const snap = await db
    .collection("raffles")
    .doc(String(raffleId))
    .collection("soldNumbers")
    .get();
  return snap.docs.map((d) => Number(d.id)).filter((n) => !Number.isNaN(n));
}

export async function drawRaffle(raffleId: number): Promise<Record<string, unknown>> {
  const raffle = await getRaffle(raffleId);
  if (!raffle) throw new Error("Rifa no encontrada");
  if (raffle.status === "drawn") throw new Error("Esta rifa ya fue sorteada");
  if (raffle.status === "cancelled") throw new Error("Rifa cancelada");

  const soldSnap = await db
    .collection("raffles")
    .doc(String(raffleId))
    .collection("soldNumbers")
    .get();

  if (soldSnap.empty) {
    throw new Error("No hay números vendidos para sortear");
  }

  const pick = soldSnap.docs[Math.floor(Math.random() * soldSnap.docs.length)];
  const winningNumber = Number(pick.id);
  const ticket = pick.data();
  const winnerUid = ticket.userUid as string;
  const winnerUserId = ticket.userId as number;

  const winner = await getUserByLegacyId(winnerUserId);
  const winnerUsername = winner?.username ?? "Jugador";

  await db.collection("raffles").doc(String(raffleId)).update({
    status: "drawn",
    winningNumber,
    winnerUserId,
    winnerUid,
    winnerUsername,
    drawnAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await notifyUser(winnerUid, {
    type: "raffle_won",
    title: "¡Ganaste la rifa!",
    message: `Tu número ${winningNumber} ganó: ${raffle.prizeTitle ?? raffle.title}`,
    amount: typeof raffle.prizeValue === "number" ? raffle.prizeValue : undefined,
  });

  const updated = await getRaffle(raffleId);
  return serializeRaffle(updated!);
}

export async function processScheduledRaffles(): Promise<number> {
  const now = Timestamp.now();
  const snap = await db
    .collection("raffles")
    .where("status", "in", ["open", "closed"])
    .get();

  let processed = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    const scheduled = data.scheduledDrawAt;
    if (!scheduled || !(scheduled instanceof Timestamp)) continue;
    if (scheduled.toMillis() > now.toMillis()) continue;

    const id = Number(doc.id);
    if (data.status === "open") {
      await db.collection("raffles").doc(String(id)).update({
        status: "closed",
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    try {
      await drawRaffle(id);
      processed++;
    } catch (e) {
      console.warn("[raffles] auto-draw skipped", id, e);
    }
  }
  return processed;
}

export { parseScheduledDrawColombia, formatDrawColombia };

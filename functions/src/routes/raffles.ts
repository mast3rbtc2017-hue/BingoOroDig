import { Router } from "express";
import { z } from "zod";
import { db, FieldValue, Timestamp, nextId } from "../lib/firestore";
import { requireAuth, requireAdmin, type AuthedRequest } from "../lib/auth";
import { formatCOP } from "../lib/currency";
import {
  drawRaffle,
  getRaffle,
  getSoldNumbers,
  processScheduledRaffles,
  serializeRaffle,
  parseScheduledDrawColombia,
} from "../lib/raffles";
import { uploadRaffleImage } from "../lib/storageUpload";

const router = Router();

const UploadImageBody = z.object({
  imageBase64: z.string().min(50),
  contentType: z
    .string()
    .regex(/^image\/(jpeg|jpg|png|webp|gif)$/i, "Tipo de imagen no válido"),
});

const CreateRaffleBody = z.object({
  title: z.string().min(3).max(120),
  description: z.string().max(2000).optional(),
  prizeTitle: z.string().min(2).max(120),
  prizeDescription: z.string().max(2000).optional(),
  imageUrl: z
    .string()
    .url()
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  rules: z.string().max(3000).optional(),
  ticketPrice: z.number().min(1000).max(5_000_000),
  totalNumbers: z.number().int().min(10).max(500),
  scheduledDrawAt: z.string().optional().nullable(),
  publish: z.boolean().optional(),
});

const BuyTicketsBody = z.object({
  numbers: z.array(z.number().int().positive()).min(1).max(20),
});

const ControlBody = z.object({
  action: z.enum(["publish", "close", "draw", "cancel", "reopen"]),
});

router.post("/raffles/upload-image", requireAdmin, async (req: AuthedRequest, res) => {
  const body = UploadImageBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  let b64 = body.data.imageBase64.trim();
  const comma = b64.indexOf(",");
  if (comma >= 0) b64 = b64.slice(comma + 1);

  let buffer: Buffer;
  try {
    buffer = Buffer.from(b64, "base64");
  } catch {
    res.status(400).json({ error: "Imagen base64 inválida" });
    return;
  }

  try {
    const url = await uploadRaffleImage(
      buffer,
      body.data.contentType.toLowerCase() === "image/jpg"
        ? "image/jpeg"
        : body.data.contentType.toLowerCase(),
      req.userUid!,
    );
    res.status(201).json({ url });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error al subir imagen";
    res.status(500).json({ error: message });
  }
});

router.get("/raffles", requireAuth, async (_req, res) => {
  await processScheduledRaffles();
  const snap = await db.collection("raffles").orderBy("createdAt", "desc").get();
  const publicStatuses = ["open", "closed", "drawn"];
  const items = snap.docs
    .map((d) => serializeRaffle({ id: Number(d.id), ...d.data() }))
    .filter((r) => publicStatuses.includes(r.status));
  res.json(items);
});

router.get("/raffles/admin", requireAdmin, async (_req, res) => {
  await processScheduledRaffles();
  const snap = await db.collection("raffles").orderBy("createdAt", "desc").get();
  res.json(snap.docs.map((d) => serializeRaffle({ id: Number(d.id), ...d.data() })));
});

router.post("/raffles/tick-schedule", requireAuth, async (_req, res) => {
  const n = await processScheduledRaffles();
  res.json({ processed: n });
});

router.get("/raffles/:id", requireAuth, async (req, res) => {
  await processScheduledRaffles();
  const id = Number(req.params.id);
  const raffle = await getRaffle(id);
  if (!raffle) {
    res.status(404).json({ error: "Rifa no encontrada" });
    return;
  }
  const soldNumbers = await getSoldNumbers(id);
  res.json({
    ...serializeRaffle(raffle),
    soldNumbers,
    availableCount: (raffle.totalNumbers as number) - soldNumbers.length,
  });
});

router.post("/raffles", requireAdmin, async (req, res) => {
  const body = CreateRaffleBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  let scheduledTs: Timestamp | null = null;
  if (body.data.scheduledDrawAt) {
    const d = parseScheduledDrawColombia(body.data.scheduledDrawAt);
    if (Number.isNaN(d.getTime())) {
      res.status(400).json({ error: "Fecha de sorteo inválida (use hora Colombia)" });
      return;
    }
    if (d.getTime() <= Date.now()) {
      res.status(400).json({ error: "La fecha del sorteo debe ser futura" });
      return;
    }
    scheduledTs = Timestamp.fromDate(d);
  }

  const id = await nextId("raffles");
  const status = body.data.publish ? "open" : "draft";

  const doc = {
    id,
    title: body.data.title.trim(),
    description: body.data.description?.trim() ?? null,
    prizeTitle: body.data.prizeTitle.trim(),
    prizeDescription: body.data.prizeDescription?.trim() ?? null,
    imageUrl: body.data.imageUrl ?? null,
    rules: body.data.rules?.trim() ?? null,
    ticketPrice: body.data.ticketPrice,
    totalNumbers: body.data.totalNumbers,
    soldCount: 0,
    status,
    scheduledDrawAt: scheduledTs,
    drawnAt: null,
    winningNumber: null,
    winnerUserId: null,
    winnerUid: null,
    winnerUsername: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await db.collection("raffles").doc(String(id)).set(doc);
  const created = await getRaffle(id);
  res.status(201).json(serializeRaffle(created!));
});

router.patch("/raffles/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const raffle = await getRaffle(id);
  if (!raffle) {
    res.status(404).json({ error: "Rifa no encontrada" });
    return;
  }
  if (raffle.status === "drawn") {
    res.status(400).json({ error: "No puedes editar una rifa ya sorteada" });
    return;
  }

  const updates: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };
  const allowed = [
    "title",
    "description",
    "prizeTitle",
    "prizeDescription",
    "imageUrl",
    "rules",
    "ticketPrice",
    "totalNumbers",
  ] as const;
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (req.body.scheduledDrawAt !== undefined) {
    if (!req.body.scheduledDrawAt) {
      updates.scheduledDrawAt = null;
    } else {
      const d = parseScheduledDrawColombia(String(req.body.scheduledDrawAt));
      if (Number.isNaN(d.getTime())) {
        res.status(400).json({ error: "Fecha inválida" });
        return;
      }
      updates.scheduledDrawAt = Timestamp.fromDate(d);
    }
  }

  await db.collection("raffles").doc(String(id)).update(updates);
  const updated = await getRaffle(id);
  res.json(serializeRaffle(updated!));
});

router.delete("/raffles/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const raffle = await getRaffle(id);
  if (!raffle) {
    res.status(404).json({ error: "Rifa no encontrada" });
    return;
  }

  const soldSnap = await db
    .collection("raffles")
    .doc(String(id))
    .collection("soldNumbers")
    .get();
  const batch = db.batch();
  for (const d of soldSnap.docs) batch.delete(d.ref);
  batch.delete(db.collection("raffles").doc(String(id)));
  await batch.commit();
  res.json({ ok: true });
});

router.post("/raffles/:id/control", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const body = ControlBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const raffle = await getRaffle(id);
  if (!raffle) {
    res.status(404).json({ error: "Rifa no encontrada" });
    return;
  }

  switch (body.data.action) {
    case "publish":
      if (raffle.status !== "draft") {
        res.status(400).json({ error: "Solo borradores pueden publicarse" });
        return;
      }
      await db.collection("raffles").doc(String(id)).update({
        status: "open",
        updatedAt: FieldValue.serverTimestamp(),
      });
      break;
    case "close":
      if (raffle.status !== "open") {
        res.status(400).json({ error: "La rifa no está abierta" });
        return;
      }
      await db.collection("raffles").doc(String(id)).update({
        status: "closed",
        updatedAt: FieldValue.serverTimestamp(),
      });
      break;
    case "reopen":
      if (raffle.status !== "closed") {
        res.status(400).json({ error: "Solo rifas cerradas pueden reabrirse" });
        return;
      }
      await db.collection("raffles").doc(String(id)).update({
        status: "open",
        updatedAt: FieldValue.serverTimestamp(),
      });
      break;
    case "draw": {
      const result = await drawRaffle(id);
      res.json(result);
      return;
    }
    case "cancel":
      await db.collection("raffles").doc(String(id)).update({
        status: "cancelled",
        updatedAt: FieldValue.serverTimestamp(),
      });
      break;
  }

  const updated = await getRaffle(id);
  res.json(serializeRaffle(updated!));
});

router.post("/raffles/:id/tickets", requireAuth, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const body = BuyTicketsBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const raffle = await getRaffle(id);
  if (!raffle || raffle.status !== "open") {
    res.status(400).json({ error: "Esta rifa no acepta compras ahora" });
    return;
  }

  const totalNumbers = raffle.totalNumbers as number;
  const ticketPrice = raffle.ticketPrice as number;
  const numbers = [...new Set(body.data.numbers)];

  for (const n of numbers) {
    if (n < 1 || n > totalNumbers) {
      res.status(400).json({ error: `Número ${n} fuera de rango (1-${totalNumbers})` });
      return;
    }
  }

  const soldCount = (raffle.soldCount as number) ?? 0;
  if (soldCount + numbers.length > totalNumbers) {
    res.status(400).json({ error: "No quedan suficientes números disponibles" });
    return;
  }

  const userRef = db.collection("users").doc(req.userUid!);
  const userSnap = await userRef.get();
  const user = userSnap.data()!;
  const totalCost = ticketPrice * numbers.length;
  if ((user.balance as number) < totalCost) {
    res.status(400).json({ error: "Saldo insuficiente" });
    return;
  }

  const raffleRef = db.collection("raffles").doc(String(id));
  const soldRefs = numbers.map((n) => raffleRef.collection("soldNumbers").doc(String(n)));

  try {
    await db.runTransaction(async (tx) => {
      for (const ref of soldRefs) {
        const existing = await tx.get(ref);
        if (existing.exists) {
          throw new Error(`El número ${ref.id} ya está vendido`);
        }
      }
      const freshUser = await tx.get(userRef);
      const bal = freshUser.data()!.balance as number;
      if (bal < totalCost) throw new Error("Saldo insuficiente");

      tx.update(userRef, { balance: bal - totalCost });
      tx.update(raffleRef, {
        soldCount: soldCount + numbers.length,
        updatedAt: FieldValue.serverTimestamp(),
      });

      const now = FieldValue.serverTimestamp();
      for (const n of numbers) {
        tx.set(raffleRef.collection("soldNumbers").doc(String(n)), {
          number: n,
          userId: user.id,
          userUid: req.userUid,
          username: user.username,
          purchasedAt: now,
        });
      }
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "No se pudo comprar";
    res.status(400).json({ error: msg });
    return;
  }

  await userRef.collection("transactions").add({
    userId: user.id,
    type: "purchase",
    amount: totalCost,
    description: `Rifa: ${raffle.title} — números ${numbers.join(", ")}`,
    createdAt: FieldValue.serverTimestamp(),
  });

  const soldNumbers = await getSoldNumbers(id);
  const updatedUser = (await userRef.get()).data()!;

  res.status(201).json({
    numbers,
    totalCost,
    newBalance: updatedUser.balance,
    soldNumbers,
  });
});

router.get("/raffles/:id/my-numbers", requireAuth, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const snap = await db
    .collection("raffles")
    .doc(String(id))
    .collection("soldNumbers")
    .where("userUid", "==", req.userUid)
    .get();
  res.json(snap.docs.map((d) => Number(d.id)).sort((a, b) => a - b));
});

export default router;

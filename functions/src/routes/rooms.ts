import { Router } from "express";
import { z } from "zod";
import { db, FieldValue, nextId, Timestamp } from "../lib/firestore";
import { requireAuth, requireAdmin } from "../lib/auth";

const router = Router();

function serializeRoom(r: Record<string, unknown>) {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    type: r.type,
    status: r.status,
    cardPrice: r.cardPrice,
    maxPlayers: r.maxPlayers,
    ballInterval: r.ballInterval,
    prize: r.prize,
    patternType: r.patternType,
    playerCount: r.playerCount,
    currentGameId: r.currentGameId ?? null,
    createdAt:
      r.createdAt instanceof Timestamp
        ? r.createdAt.toDate().toISOString()
        : r.createdAt,
  };
}

const CreateRoomBody = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.string().default("classic"),
  cardPrice: z.number().default(10),
  maxPlayers: z.number().default(100),
  ballInterval: z.number().default(5),
  prize: z.number().default(500),
  patternType: z.string().default("line"),
});

router.get("/rooms", requireAuth, async (_req, res) => {
  const snap = await db.collection("rooms").where("isActive", "==", true).get();
  const rooms = snap.docs
    .map((d) => serializeRoom({ id: Number(d.id), ...d.data() }))
    .sort((a, b) => Number(a.id) - Number(b.id));
  res.json(rooms);
});

router.post("/rooms", requireAdmin, async (req, res) => {
  const body = CreateRoomBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const id = await nextId("rooms");
  const room = {
    id,
    name: body.data.name,
    description: body.data.description ?? null,
    type: body.data.type,
    cardPrice: body.data.cardPrice,
    maxPlayers: body.data.maxPlayers,
    ballInterval: body.data.ballInterval,
    prize: body.data.prize,
    patternType: body.data.patternType,
    status: "active",
    playerCount: 0,
    currentGameId: null,
    isActive: true,
    createdAt: FieldValue.serverTimestamp(),
  };
  await db.collection("rooms").doc(String(id)).set(room);
  res.status(201).json(serializeRoom({ ...room, createdAt: new Date() }));
});

router.get("/rooms/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const snap = await db.collection("rooms").doc(String(id)).get();
  if (!snap.exists) {
    res.status(404).json({ error: "Room not found" });
    return;
  }
  res.json(serializeRoom({ id, ...snap.data()! }));
});

router.patch("/rooms/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const ref = db.collection("rooms").doc(String(id));
  const snap = await ref.get();
  if (!snap.exists) {
    res.status(404).json({ error: "Room not found" });
    return;
  }
  await ref.update(req.body);
  const updated = await ref.get();
  res.json(serializeRoom({ id, ...updated.data()! }));
});

router.delete("/rooms/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.collection("rooms").doc(String(id)).update({ isActive: false });
  res.sendStatus(204);
});

export default router;

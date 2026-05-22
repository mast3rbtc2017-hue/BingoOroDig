import { Router, type IRouter } from "express";
import { db, roomsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";
import { CreateRoomBody, GetRoomParams, UpdateRoomParams, UpdateRoomBody, DeleteRoomParams } from "@workspace/api-zod";

const router: IRouter = Router();

function serializeRoom(r: any) {
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
    currentGameId: r.currentGameId,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
  };
}

router.get("/rooms", requireAuth, async (_req, res): Promise<void> => {
  const rooms = await db.select().from(roomsTable).where(eq(roomsTable.isActive, true)).orderBy(roomsTable.id);
  res.json(rooms.map(serializeRoom));
});

router.post("/rooms", requireAdmin, async (req, res): Promise<void> => {
  const body = CreateRoomBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [room] = await db.insert(roomsTable).values({
    name: body.data.name,
    description: body.data.description ?? null,
    type: body.data.type,
    cardPrice: body.data.cardPrice,
    maxPlayers: body.data.maxPlayers,
    ballInterval: body.data.ballInterval,
    prize: body.data.prize,
    patternType: body.data.patternType,
    status: "active",
  }).returning();
  res.status(201).json(serializeRoom(room));
});

router.get("/rooms/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetRoomParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [room] = await db.select().from(roomsTable).where(eq(roomsTable.id, params.data.id));
  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }
  res.json(serializeRoom(room));
});

router.patch("/rooms/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateRoomParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = UpdateRoomBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [room] = await db.update(roomsTable).set(body.data as any).where(eq(roomsTable.id, params.data.id)).returning();
  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }
  res.json(serializeRoom(room));
});

router.delete("/rooms/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteRoomParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.update(roomsTable).set({ isActive: false }).where(eq(roomsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;

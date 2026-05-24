import { Router } from "express";
import { z } from "zod";
import { db, FieldValue, nextId, Timestamp } from "../lib/firestore";
import { requireAuth, type AuthedRequest } from "../lib/auth";

const router = Router();

const SendChatBody = z.object({
  content: z.string().min(1),
});

function serializeMsg(m: Record<string, unknown>) {
  return {
    id: m.id,
    roomId: m.roomId,
    userId: m.userId,
    username: m.username,
    avatarUrl: m.avatarUrl,
    content: m.content,
    type: m.type,
    createdAt:
      m.createdAt instanceof Timestamp
        ? m.createdAt.toDate().toISOString()
        : m.createdAt,
  };
}

router.get("/chat/:roomId", requireAuth, async (req, res) => {
  const roomId = Number(req.params.roomId);
  const snap = await db
    .collection("rooms")
    .doc(String(roomId))
    .collection("messages")
    .orderBy("createdAt")
    .limit(100)
    .get();
  res.json(snap.docs.map((d) => serializeMsg({ id: Number(d.id) || d.id, ...d.data() })));
});

router.post("/chat/:roomId", requireAuth, async (req: AuthedRequest, res) => {
  const roomId = Number(req.params.roomId);
  const body = SendChatBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const msgId = await nextId("messages");
  const msg = {
    id: msgId,
    roomId,
    userId: req.userId,
    username: req.userProfile?.username ?? "Unknown",
    avatarUrl: req.userProfile?.avatarUrl ?? null,
    content: body.data.content,
    type: "user",
    createdAt: FieldValue.serverTimestamp(),
  };

  await db.collection("rooms").doc(String(roomId)).collection("messages").doc(String(msgId)).set(msg);

  res.status(201).json(serializeMsg({ ...msg, createdAt: new Date() }));
});

export default router;

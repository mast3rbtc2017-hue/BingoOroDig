import { Router, type IRouter } from "express";
import { db, chatMessagesTable, transactionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { GetChatMessagesParams, SendChatMessageParams, SendChatMessageBody } from "@workspace/api-zod";
import { emitChatMessage } from "../lib/socket";

const router: IRouter = Router();

function serializeMsg(m: any) {
  return {
    id: m.id,
    roomId: m.roomId,
    userId: m.userId,
    username: m.username,
    avatarUrl: m.avatarUrl,
    content: m.content,
    type: m.type,
    createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : m.createdAt,
  };
}

router.get("/chat/:roomId", requireAuth, async (req, res): Promise<void> => {
  const params = GetChatMessagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const msgs = await db.select().from(chatMessagesTable)
    .where(eq(chatMessagesTable.roomId, params.data.roomId))
    .orderBy(chatMessagesTable.createdAt)
    .limit(100);
  res.json(msgs.map(serializeMsg));
});

router.post("/chat/:roomId", requireAuth, async (req: any, res): Promise<void> => {
  const params = SendChatMessageParams.safeParse(req.params);
  const body = SendChatMessageBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { db: dbLib, usersTable } = await import("@workspace/db");
  const { eq: eqFn } = await import("drizzle-orm");
  const [user] = await dbLib.select().from(usersTable).where(eqFn(usersTable.id, req.userId));

  const [msg] = await db.insert(chatMessagesTable).values({
    roomId: params.data.roomId,
    userId: req.userId,
    username: user?.username ?? "Unknown",
    avatarUrl: user?.avatarUrl ?? null,
    content: body.data.content,
    type: "user",
  }).returning();

  const result = serializeMsg(msg);
  emitChatMessage(params.data.roomId, result);

  res.status(201).json(result);
});

export default router;

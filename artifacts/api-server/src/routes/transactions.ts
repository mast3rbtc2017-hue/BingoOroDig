import { Router, type IRouter } from "express";
import { db, transactionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.get("/transactions", requireAuth, async (req: any, res): Promise<void> => {
  const txs = await db.select().from(transactionsTable)
    .where(eq(transactionsTable.userId, req.userId))
    .orderBy(transactionsTable.createdAt);
  res.json(txs.map((t) => ({
    id: t.id,
    userId: t.userId,
    type: t.type,
    amount: t.amount,
    description: t.description,
    createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt,
  })));
});

export default router;

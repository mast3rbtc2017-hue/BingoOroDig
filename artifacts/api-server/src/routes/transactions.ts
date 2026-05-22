import { Router, type IRouter } from "express";
import { db, transactionsTable, usersTable } from "@workspace/db";
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

router.post("/transactions/deposit", requireAuth, async (req: any, res): Promise<void> => {
  const amount = Number(req.body?.amount);
  if (!amount || amount < 1 || amount > 10000) {
    res.status(400).json({ error: "Monto inválido (1–10000)" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId));
  if (!user) {
    res.status(404).json({ error: "Usuario no encontrado" });
    return;
  }

  const newBalance = user.balance + amount;
  await db.update(usersTable).set({ balance: newBalance }).where(eq(usersTable.id, req.userId));

  const [tx] = await db.insert(transactionsTable).values({
    userId: req.userId,
    type: "deposit",
    amount,
    description: `Recarga de saldo — $${amount}`,
  }).returning();

  res.status(201).json({
    id: tx.id,
    userId: tx.userId,
    type: tx.type,
    amount: tx.amount,
    description: tx.description,
    newBalance,
    createdAt: tx.createdAt instanceof Date ? tx.createdAt.toISOString() : tx.createdAt,
  });
});

export default router;

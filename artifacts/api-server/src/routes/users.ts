import { Router, type IRouter } from "express";
import { db, usersTable, transactionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";
import { UpdateUserBody, UpdateUserParams, UpdateUserBalanceBody, UpdateUserBalanceParams, ToggleBlockUserBody, ToggleBlockUserParams } from "@workspace/api-zod";

const router: IRouter = Router();

function serializeUser(user: any) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    role: user.role,
    balance: user.balance,
    isBlocked: user.isBlocked,
    totalWins: user.totalWins,
    totalGamesPlayed: user.totalGamesPlayed,
    createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt,
  };
}

router.get("/users", requireAdmin, async (_req, res): Promise<void> => {
  const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
  res.json(users.map(serializeUser));
});

router.get("/users/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.id));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(serializeUser(user));
});

router.patch("/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = UpdateUserBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [user] = await db.update(usersTable).set(body.data).where(eq(usersTable.id, params.data.id)).returning();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(serializeUser(user));
});

router.patch("/users/:id/balance", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateUserBalanceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = UpdateUserBalanceBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [current] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.id));
  if (!current) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const newBalance = current.balance + body.data.amount;
  const [user] = await db.update(usersTable)
    .set({ balance: newBalance })
    .where(eq(usersTable.id, params.data.id))
    .returning();

  await db.insert(transactionsTable).values({
    userId: params.data.id,
    type: body.data.amount >= 0 ? "deposit" : "withdrawal",
    amount: Math.abs(body.data.amount),
    description: body.data.reason ?? (body.data.amount >= 0 ? "Recarga por admin" : "Retiro por admin"),
  });

  res.json(serializeUser(user));
});

router.patch("/users/:id/block", requireAdmin, async (req, res): Promise<void> => {
  const params = ToggleBlockUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = ToggleBlockUserBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [user] = await db.update(usersTable)
    .set({ isBlocked: body.data.isBlocked })
    .where(eq(usersTable.id, params.data.id))
    .returning();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(serializeUser(user));
});

export default router;

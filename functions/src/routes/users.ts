import { Router } from "express";
import { z } from "zod";
import { db, FieldValue } from "../lib/firestore";
import { requireAuth, requireAdmin, serializeUser, getUserByLegacyId } from "../lib/auth";

const router = Router();

const UpdateUserBody = z.object({
  displayName: z.string().optional(),
  role: z.string().optional(),
});

const BalanceBody = z.object({
  amount: z.number(),
  reason: z.string().optional(),
});

const BlockBody = z.object({
  isBlocked: z.boolean(),
});

router.get("/users", requireAdmin, async (_req, res) => {
  const snap = await db.collection("users").get();
  const users = snap.docs.map((d) => serializeUser(d.data()));
  users.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  res.json(users);
});

router.get("/users/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const user = await getUserByLegacyId(id);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(user);
});

router.patch("/users/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const body = UpdateUserBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const q = await db.collection("users").where("id", "==", id).limit(1).get();
  if (q.empty) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  await q.docs[0].ref.update(body.data);
  const updated = await q.docs[0].ref.get();
  res.json(serializeUser(updated.data()!));
});

router.patch("/users/:id/balance", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const body = BalanceBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const q = await db.collection("users").where("id", "==", id).limit(1).get();
  if (q.empty) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const ref = q.docs[0].ref;
  const current = q.docs[0].data();
  const newBalance = current.balance + body.data.amount;
  await ref.update({ balance: newBalance });
  await ref.collection("transactions").add({
    userId: id,
    type: body.data.amount >= 0 ? "deposit" : "withdrawal",
    amount: Math.abs(body.data.amount),
    description:
      body.data.reason ??
      (body.data.amount >= 0 ? "Recarga por admin" : "Retiro por admin"),
    createdAt: FieldValue.serverTimestamp(),
  });
  const updated = await ref.get();
  res.json(serializeUser(updated.data()!));
});

router.patch("/users/:id/block", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const body = BlockBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const q = await db.collection("users").where("id", "==", id).limit(1).get();
  if (q.empty) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  await q.docs[0].ref.update({ isBlocked: body.data.isBlocked });
  const updated = await q.docs[0].ref.get();
  res.json(serializeUser(updated.data()!));
});

export default router;

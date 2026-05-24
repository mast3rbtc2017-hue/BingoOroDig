import { Router } from "express";
import { db, FieldValue, Timestamp } from "../lib/firestore";
import { requireAuth, type AuthedRequest } from "../lib/auth";

const router = Router();

router.get("/transactions", requireAuth, async (req: AuthedRequest, res) => {
  const snap = await db
    .collection("users")
    .doc(req.userUid!)
    .collection("transactions")
    .orderBy("createdAt")
    .get();

  res.json(
    snap.docs.map((d) => {
      const t = d.data();
      return {
        id: t.id ?? d.id,
        userId: t.userId,
        type: t.type,
        amount: t.amount,
        description: t.description,
        createdAt:
          t.createdAt instanceof Timestamp
            ? t.createdAt.toDate().toISOString()
            : t.createdAt,
      };
    }),
  );
});

router.post("/transactions/deposit", requireAuth, async (req: AuthedRequest, res) => {
  const amount = Number(req.body?.amount);
  if (!amount || amount < 1 || amount > 10000) {
    res.status(400).json({ error: "Monto inválido (1–10000)" });
    return;
  }

  const userRef = db.collection("users").doc(req.userUid!);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    res.status(404).json({ error: "Usuario no encontrado" });
    return;
  }
  const user = userSnap.data()!;
  const newBalance = user.balance + amount;
  await userRef.update({ balance: newBalance });

  const txRef = await userRef.collection("transactions").add({
    userId: user.id,
    type: "deposit",
    amount,
    description: `Recarga de saldo — $${amount}`,
    createdAt: FieldValue.serverTimestamp(),
  });

  res.status(201).json({
    id: txRef.id,
    userId: user.id,
    type: "deposit",
    amount,
    description: `Recarga de saldo — $${amount}`,
    newBalance,
    createdAt: new Date().toISOString(),
  });
});

export default router;

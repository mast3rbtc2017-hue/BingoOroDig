import { Router } from "express";
import { db } from "../lib/firestore";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { serializeNotification } from "../lib/notifications";

const router = Router();

router.get("/notifications", requireAuth, async (req: AuthedRequest, res) => {
  const snap = await db
    .collection("users")
    .doc(req.userUid!)
    .collection("notifications")
    .limit(40)
    .get();
  const rows = snap.docs
    .map((d) => serializeNotification({ id: Number(d.id), ...d.data() }))
    .sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt as string).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt as string).getTime() : 0;
      return tb - ta;
    });
  res.json(rows);
});

router.patch("/notifications/:id/read", requireAuth, async (req: AuthedRequest, res) => {
  const id = req.params.id;
  const ref = db
    .collection("users")
    .doc(req.userUid!)
    .collection("notifications")
    .doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    res.status(404).json({ error: "Notificación no encontrada" });
    return;
  }
  await ref.update({ read: true });
  res.json({ ok: true });
});

router.post("/notifications/read-all", requireAuth, async (req: AuthedRequest, res) => {
  const snap = await db
    .collection("users")
    .doc(req.userUid!)
    .collection("notifications")
    .where("read", "==", false)
    .get();
  const batch = db.batch();
  for (const d of snap.docs) {
    batch.update(d.ref, { read: true });
  }
  await batch.commit();
  res.json({ ok: true, count: snap.size });
});

export default router;

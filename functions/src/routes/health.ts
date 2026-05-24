import { Router } from "express";
import { getFirebaseStatus } from "../lib/firestore";

const router = Router();

router.get("/healthz", (_req, res) => {
  const fb = getFirebaseStatus();
  res.status(200).json({
    status: fb.ok ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    firebase: fb,
  });
});

export default router;

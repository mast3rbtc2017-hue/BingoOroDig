import { Router } from "express";
import { z } from "zod";
import { db, Timestamp } from "../lib/firestore";
import { requireAuth, requireAdmin, type AuthedRequest } from "../lib/auth";
import {
  executeRouletteSpin,
  spinsUntilNextWin,
  getNumberColor,
  getRouletteConfig,
  isWinAllowedSpin,
  serializeSpin,
  updateRouletteConfig,
} from "../lib/roulette";

const router = Router();

const BetSchema = z.object({
  number: z.number().int().min(0).max(36),
  amount: z.number().positive(),
});

const SpinBody = z.object({
  bets: z.array(BetSchema).min(1).max(37),
});

const ConfigBody = z.object({
  enabled: z.boolean().optional(),
  winEveryNRouletteSpins: z.number().int().min(1).max(1000).optional(),
  minBet: z.number().positive().optional(),
  maxBet: z.number().positive().optional(),
  maxBetsPerSpin: z.number().int().min(1).max(37).optional(),
  payoutMultiplier: z.number().int().min(1).max(100).optional(),
});

router.get("/roulette/config", requireAuth, async (_req, res) => {
  const config = await getRouletteConfig();
  res.json({
    ...config,
    winAllowedNow: isWinAllowedSpin(config),
    spinsUntilNextWin: spinsUntilNextWin(config),
  });
});

router.patch("/roulette/config", requireAdmin, async (req, res) => {
  const body = ConfigBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const updated = await updateRouletteConfig(body.data);
  res.json({
    ...updated,
    winAllowedNow: isWinAllowedSpin(updated),
    spinsUntilNextWin: spinsUntilNextWin(updated),
  });
});

router.post("/roulette/spin", requireAuth, async (req: AuthedRequest, res) => {
  const body = SpinBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  try {
    const result = await executeRouletteSpin(
      req.userUid!,
      req.userId!,
      req.userProfile?.username ?? "Jugador",
      body.data.bets,
    );
    res.json({
      ...result,
      color: getNumberColor(result.winningNumber),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error en la ruleta";
    res.status(400).json({ error: message });
  }
});

router.get("/roulette/history", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const limit = Math.min(50, Number(req.query.limit) || 20);
    const snap = await db
      .collection("rouletteSpins")
      .where("userUid", "==", req.userUid!)
      .limit(80)
      .get();
    const rows = snap.docs
      .map((d) => serializeSpin({ id: Number(d.id), ...d.data() }))
      .sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt as string).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt as string).getTime() : 0;
        return tb - ta;
      })
      .slice(0, limit);
    res.json(rows);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al cargar historial";
    res.status(500).json({ error: message });
  }
});

router.get("/roulette/admin/spins", requireAdmin, async (req, res) => {
  const limit = Math.min(100, Number(req.query.limit) || 50);
  const snap = await db
    .collection("rouletteSpins")
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  res.json(snap.docs.map((d) => serializeSpin({ id: Number(d.id), ...d.data() })));
});

export default router;

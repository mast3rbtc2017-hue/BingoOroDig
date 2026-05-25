import { Router } from "express";
import { z } from "zod";
import {
  auth,
  authEmailForUsername,
  db,
  FieldValue,
  nextId,
} from "../lib/firestore";
import { requireAuth, serializeUser, type AuthedRequest } from "../lib/auth";

const router = Router();

const RegisterBody = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  displayName: z.string().optional(),
});

const LoginBody = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { username, password, displayName } = parsed.data;
  const normalized = username.trim().toLowerCase();
  const email = authEmailForUsername(normalized);

  const existing = await db.collection("usernames").doc(normalized).get();
  if (existing.exists) {
    res.status(400).json({ error: "Username already taken" });
    return;
  }

  try {
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: displayName ?? username,
    });

    const legacyId = await nextId("users");
    const adminsSnap = await db.collection("users").where("role", "==", "admin").limit(1).get();
    const isFirstAdmin = adminsSnap.empty && normalized === "admin";

    const profile = {
      uid: userRecord.uid,
      id: legacyId,
      username: normalized,
      displayName: displayName ?? username,
      avatarUrl: null,
      role: isFirstAdmin ? "admin" : "player",
      balance: 50_000,
      isBlocked: false,
      totalWins: 0,
      totalGamesPlayed: 0,
      createdAt: FieldValue.serverTimestamp(),
    };

    await db.collection("users").doc(userRecord.uid).set(profile);
    await db.collection("usernames").doc(normalized).set({ uid: userRecord.uid });

    await db.collection("users").doc(userRecord.uid).collection("transactions").add({
      userId: legacyId,
      type: "deposit",
      amount: 50_000,
      description: "Bono de bienvenida (COP)",
      createdAt: FieldValue.serverTimestamp(),
    });

    const customToken = await auth.createCustomToken(userRecord.uid);

    res.status(201).json({
      token: customToken,
      user: {
        id: legacyId,
        username: normalized,
        displayName: profile.displayName,
        avatarUrl: null,
        role: isFirstAdmin ? "admin" : "player",
        balance: 50_000,
        isBlocked: false,
        totalWins: 0,
        totalGamesPlayed: 0,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Registration failed";
    res.status(400).json({ error: message });
  }
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const email = authEmailForUsername(parsed.data.username);

  try {
    const userRecord = await auth.getUserByEmail(email);
    const snap = await db.collection("users").doc(userRecord.uid).get();
    if (!snap.exists) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const data = snap.data()!;
    if (data.isBlocked) {
      res.status(403).json({ error: "Account is blocked" });
      return;
    }
    const customToken = await auth.createCustomToken(userRecord.uid);
    const user = serializeUser(data);
    res.json({ token: customToken, user });
  } catch {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

router.post("/auth/logout", (_req, res) => {
  res.json({ ok: true });
});

router.get("/auth/me", requireAuth, async (req: AuthedRequest, res) => {
  res.json(req.userProfile);
});

export default router;

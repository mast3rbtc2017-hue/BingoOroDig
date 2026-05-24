import type { Request, Response, NextFunction } from "express";
import { auth, db } from "./firestore";

export interface UserProfile {
  uid: string;
  id: number;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: string;
  balance: number;
  isBlocked: boolean;
  totalWins: number;
  totalGamesPlayed: number;
  createdAt: string;
}

export interface AuthedRequest extends Request {
  userUid?: string;
  userId?: number;
  userRole?: string;
  userProfile?: UserProfile;
}

export function serializeUser(data: FirebaseFirestore.DocumentData): UserProfile {
  return {
    uid: data.uid,
    id: data.id,
    username: data.username,
    displayName: data.displayName ?? null,
    avatarUrl: data.avatarUrl ?? null,
    role: data.role ?? "player",
    balance: data.balance ?? 0,
    isBlocked: data.isBlocked ?? false,
    totalWins: data.totalWins ?? 0,
    totalGamesPlayed: data.totalGamesPlayed ?? 0,
    createdAt:
      data.createdAt?.toDate?.()?.toISOString?.() ??
      data.createdAt ??
      new Date().toISOString(),
  };
}

export async function getUserByUid(uid: string): Promise<UserProfile | null> {
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) return null;
  return serializeUser(snap.data()!);
}

export async function getUserByLegacyId(id: number): Promise<UserProfile | null> {
  const q = await db.collection("users").where("id", "==", id).limit(1).get();
  if (q.empty) return null;
  return serializeUser(q.docs[0].data());
}

export async function verifyIdToken(token: string): Promise<string | null> {
  try {
    const decoded = await auth.verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}

export async function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = header.slice(7);
  const uid = await verifyIdToken(token);
  if (!uid) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
  const profile = await getUserByUid(uid);
  if (!profile) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  if (profile.isBlocked) {
    res.status(403).json({ error: "Account is blocked" });
    return;
  }
  req.userUid = uid;
  req.userId = profile.id;
  req.userRole = profile.role;
  req.userProfile = profile;
  next();
}

export function requireAdmin(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): void {
  requireAuth(req, res, () => {
    if (req.userRole !== "admin") {
      res.status(403).json({ error: "Admin only" });
      return;
    }
    next();
  });
}

import { Router } from "express";
import { db, Timestamp } from "../lib/firestore";
import { requireAuth, requireAdmin, getUserByLegacyId } from "../lib/auth";

const router = Router();

router.get("/stats/dashboard", requireAdmin, async (_req, res) => {
  const usersSnap = await db.collection("users").get();
  const roomsSnap = await db.collection("rooms").where("isActive", "==", true).get();
  const gamesSnap = await db.collection("games").where("status", "==", "playing").get();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cardsSnap = await db.collection("cards").get();
  const cardsToday = cardsSnap.docs.filter((d) => {
    const t = d.data().purchasedAt;
    const date = t instanceof Timestamp ? t.toDate() : new Date(t);
    return date >= today;
  }).length;

  let totalPrizesToday = 0;
  let totalRevenue = 0;
  for (const u of usersSnap.docs) {
    const txs = await u.ref.collection("transactions").get();
    for (const tx of txs.docs) {
      const data = tx.data();
      const created =
        data.createdAt instanceof Timestamp
          ? data.createdAt.toDate()
          : new Date(data.createdAt);
      if (data.type === "prize" && created >= today) {
        totalPrizesToday += data.amount;
      }
      if (data.type === "purchase") {
        totalRevenue += data.amount;
      }
    }
  }

  const winnersSnap = await db
    .collection("winners")
    .orderBy("createdAt", "desc")
    .limit(5)
    .get();

  const recentWinners = await Promise.all(
    winnersSnap.docs.map(async (d) => {
      const w = d.data();
      const user = await getUserByLegacyId(w.userId);
      return {
        id: w.id ?? d.id,
        gameId: w.gameId,
        userId: w.userId,
        cardId: w.cardId,
        username: user?.username ?? w.username ?? "Unknown",
        pattern: w.pattern,
        prize: w.prize,
        createdAt:
          w.createdAt instanceof Timestamp
            ? w.createdAt.toDate().toISOString()
            : w.createdAt,
      };
    }),
  );

  res.json({
    totalUsers: usersSnap.size,
    onlineUsers: Math.floor(Math.random() * 20) + 5,
    activeGames: gamesSnap.size,
    totalRooms: roomsSnap.size,
    totalCardsToday: cardsToday,
    totalPrizesToday,
    totalRevenue,
    recentWinners,
  });
});

router.get("/stats/leaderboard", requireAuth, async (_req, res) => {
  const usersSnap = await db.collection("users").get();
  const users = usersSnap.docs.map((d) => d.data());
  const sorted = [...users].sort((a, b) => (b.totalWins ?? 0) - (a.totalWins ?? 0)).slice(0, 20);

  const prizes = await Promise.all(
    sorted.map(async (u) => {
      const txs = await db.collection("users").doc(u.uid).collection("transactions").get();
      return txs.docs
        .filter((t) => t.data().type === "prize")
        .reduce((sum, t) => sum + (t.data().amount ?? 0), 0);
    }),
  );

  res.json(
    sorted.map((u, idx) => ({
      userId: u.id,
      username: u.username,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      totalWins: u.totalWins ?? 0,
      totalPrize: prizes[idx],
      rank: idx + 1,
    })),
  );
});

export default router;

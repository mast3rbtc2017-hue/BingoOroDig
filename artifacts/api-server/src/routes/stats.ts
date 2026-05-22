import { Router, type IRouter } from "express";
import { db, usersTable, roomsTable, gamesTable, cardsTable, winnersTable, transactionsTable } from "@workspace/db";
import { eq, sql, gte } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";

const router: IRouter = Router();

router.get("/stats/dashboard", requireAdmin, async (_req, res): Promise<void> => {
  const [totalUsersResult] = await db.select({ count: sql<number>`count(*)` }).from(usersTable);
  const [totalRoomsResult] = await db.select({ count: sql<number>`count(*)` }).from(roomsTable).where(eq(roomsTable.isActive, true));
  const [activeGamesResult] = await db.select({ count: sql<number>`count(*)` }).from(gamesTable).where(eq(gamesTable.status, "playing"));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [cardsToday] = await db.select({ count: sql<number>`count(*)` }).from(cardsTable).where(gte(cardsTable.purchasedAt, today));
  const prizesTodayResult = await db.select({ total: sql<number>`coalesce(sum(amount), 0)` }).from(transactionsTable).where(
    sql`type = 'prize' AND created_at >= ${today}`
  );
  const revenueResult = await db.select({ total: sql<number>`coalesce(sum(amount), 0)` }).from(transactionsTable).where(
    sql`type = 'purchase'`
  );

  const recentWinnersRaw = await db.select().from(winnersTable).orderBy(winnersTable.createdAt).limit(5);
  const recentWinners = await Promise.all(recentWinnersRaw.map(async (w) => {
    const [user] = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, w.userId));
    return {
      id: w.id,
      gameId: w.gameId,
      userId: w.userId,
      cardId: w.cardId,
      username: user?.username ?? "Unknown",
      pattern: w.pattern,
      prize: w.prize,
      createdAt: w.createdAt instanceof Date ? w.createdAt.toISOString() : w.createdAt,
    };
  }));

  res.json({
    totalUsers: Number(totalUsersResult?.count ?? 0),
    onlineUsers: Math.floor(Math.random() * 20) + 5,
    activeGames: Number(activeGamesResult?.count ?? 0),
    totalRooms: Number(totalRoomsResult?.count ?? 0),
    totalCardsToday: Number(cardsToday?.count ?? 0),
    totalPrizesToday: Number(prizesTodayResult[0]?.total ?? 0),
    totalRevenue: Number(revenueResult[0]?.total ?? 0),
    recentWinners,
  });
});

router.get("/stats/leaderboard", requireAuth, async (_req, res): Promise<void> => {
  const users = await db.select().from(usersTable).orderBy(usersTable.totalWins).limit(20);
  const sorted = [...users].sort((a, b) => b.totalWins - a.totalWins);

  const prizes = await Promise.all(sorted.map(async (u) => {
    const result = await db.select({ total: sql<number>`coalesce(sum(amount), 0)` })
      .from(transactionsTable)
      .where(sql`user_id = ${u.id} AND type = 'prize'`);
    return Number(result[0]?.total ?? 0);
  }));

  res.json(sorted.map((u, idx) => ({
    userId: u.id,
    username: u.username,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    totalWins: u.totalWins,
    totalPrize: prizes[idx],
    rank: idx + 1,
  })));
});

export default router;

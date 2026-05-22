import { pgTable, serial, integer, text, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const gamesTable = pgTable("bingo_games", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  status: text("status").notNull().default("waiting"),
  patternType: text("pattern_type").notNull().default("line"),
  ballInterval: integer("ball_interval").notNull().default(5),
  prize: real("prize").notNull().default(500),
  winnerId: integer("winner_id"),
  winnerCardId: integer("winner_card_id"),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const drawnNumbersTable = pgTable("drawn_numbers", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").notNull(),
  number: integer("number").notNull(),
  letter: text("letter").notNull(),
  drawnAt: timestamp("drawn_at").notNull().defaultNow(),
});

export const insertGameSchema = createInsertSchema(gamesTable).omit({ id: true, createdAt: true });
export type InsertGame = z.infer<typeof insertGameSchema>;
export type Game = typeof gamesTable.$inferSelect;
export type DrawnNumber = typeof drawnNumbersTable.$inferSelect;

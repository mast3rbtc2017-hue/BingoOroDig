import { pgTable, serial, integer, text, boolean, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const cardsTable = pgTable("bingo_cards", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  gameId: integer("game_id").notNull(),
  roomId: integer("room_id").notNull(),
  numbers: text("numbers").notNull(),
  markedNumbers: text("marked_numbers").notNull().default("[]"),
  isWinner: boolean("is_winner").notNull().default(false),
  colorTheme: text("color_theme").notNull().default("gold"),
  purchasedAt: timestamp("purchased_at").notNull().defaultNow(),
});

export const winnersTable = pgTable("winners", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").notNull(),
  userId: integer("user_id").notNull(),
  cardId: integer("card_id").notNull(),
  pattern: text("pattern").notNull(),
  prize: real("prize").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCardSchema = createInsertSchema(cardsTable).omit({ id: true, purchasedAt: true });
export type InsertCard = z.infer<typeof insertCardSchema>;
export type Card = typeof cardsTable.$inferSelect;
export type Winner = typeof winnersTable.$inferSelect;

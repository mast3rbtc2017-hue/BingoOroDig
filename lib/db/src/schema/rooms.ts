import { pgTable, serial, text, real, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const roomsTable = pgTable("bingo_rooms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull().default("classic"),
  status: text("status").notNull().default("active"),
  cardPrice: real("card_price").notNull().default(10),
  maxPlayers: integer("max_players").notNull().default(100),
  ballInterval: integer("ball_interval").notNull().default(5),
  prize: real("prize").notNull().default(500),
  patternType: text("pattern_type").notNull().default("line"),
  playerCount: integer("player_count").notNull().default(0),
  currentGameId: integer("current_game_id"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertRoomSchema = createInsertSchema(roomsTable).omit({ id: true, createdAt: true });
export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type Room = typeof roomsTable.$inferSelect;

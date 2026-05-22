import { Server as HttpServer } from "http";
import { Server as IOServer } from "socket.io";
import { logger } from "./logger";

let io: IOServer | null = null;

export function initSocket(httpServer: HttpServer): IOServer {
  io = new IOServer(httpServer, {
    path: "/api/socket.io",
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    logger.info({ socketId: socket.id }, "Socket connected");

    socket.on("join_room", ({ roomId }: { roomId: number }) => {
      socket.join(`room:${roomId}`);
      logger.info({ socketId: socket.id, roomId }, "Joined room");
    });

    socket.on("leave_room", ({ roomId }: { roomId: number }) => {
      socket.leave(`room:${roomId}`);
      logger.info({ socketId: socket.id, roomId }, "Left room");
    });

    socket.on("disconnect", () => {
      logger.info({ socketId: socket.id }, "Socket disconnected");
    });
  });

  return io;
}

export function getIO(): IOServer {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
}

export function emitToRoom(roomId: number, event: string, data: unknown): void {
  if (io) {
    io.to(`room:${roomId}`).emit(event, data);
  }
}

export function emitBallDrawn(roomId: number, data: {
  gameId: number; number: number; letter: string; drawnAt: string;
}): void {
  emitToRoom(roomId, "ball_drawn", data);
}

export function emitGameState(roomId: number, data: {
  gameId: number; status: string;
}): void {
  emitToRoom(roomId, "game_state", data);
}

export function emitWinner(roomId: number, data: {
  gameId: number; userId: number; username: string; cardId: number; pattern: string; prize: number;
}): void {
  emitToRoom(roomId, "winner", data);
}

export function emitChatMessage(roomId: number, message: unknown): void {
  emitToRoom(roomId, "chat_message", { roomId, message });
}

export function emitPlayerUpdate(roomId: number, playerCount: number, joined: boolean): void {
  emitToRoom(roomId, joined ? "player_joined" : "player_left", { roomId, playerCount });
}

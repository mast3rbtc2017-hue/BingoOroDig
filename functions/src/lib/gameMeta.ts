import { getRoom } from "./autoDraw";

export type GameSettings = {
  cardPrice: number;
  maxPlayers: number;
  ballInterval: number;
  prize: number;
  patternType: string;
  type: string;
};

const DEFAULTS: GameSettings = {
  cardPrice: 5000,
  maxPlayers: 100,
  ballInterval: 8,
  prize: 50_000,
  patternType: "line",
  type: "classic",
};

/** Config del sorteo (campos en el documento game; fallback sala legacy) */
export async function resolveGameSettings(
  game: Record<string, unknown>,
): Promise<GameSettings> {
  if (game.cardPrice != null) {
    return {
      cardPrice: Number(game.cardPrice),
      maxPlayers: Number(game.maxPlayers ?? 100),
      ballInterval: Number(game.ballInterval ?? 8),
      prize: Number(game.prize ?? 50_000),
      patternType: String(game.patternType ?? "line"),
      type: String(game.type ?? "classic"),
    };
  }

  if (game.roomId) {
    const room = await getRoom(game.roomId as number);
    if (room) {
      return {
        cardPrice: Number(room.cardPrice ?? DEFAULTS.cardPrice),
        maxPlayers: Number(room.maxPlayers ?? DEFAULTS.maxPlayers),
        ballInterval: Number(game.ballInterval ?? room.ballInterval ?? DEFAULTS.ballInterval),
        prize: Number(game.prize ?? room.prize ?? DEFAULTS.prize),
        patternType: String(game.patternType ?? room.patternType ?? DEFAULTS.patternType),
        type: String(room.type ?? DEFAULTS.type),
      };
    }
  }

  return {
    ...DEFAULTS,
    ballInterval: Number(game.ballInterval ?? DEFAULTS.ballInterval),
    prize: Number(game.prize ?? DEFAULTS.prize),
    patternType: String(game.patternType ?? DEFAULTS.patternType),
  };
}

export function syncGameSettings(settings: Partial<GameSettings>): Record<string, unknown> {
  return {
    cardPrice: Number(settings.cardPrice ?? DEFAULTS.cardPrice),
    maxPlayers: Number(settings.maxPlayers ?? DEFAULTS.maxPlayers),
    ballInterval: Number(settings.ballInterval ?? DEFAULTS.ballInterval),
    prize: Number(settings.prize ?? DEFAULTS.prize),
    patternType: settings.patternType ?? DEFAULTS.patternType,
    type: settings.type ?? DEFAULTS.type,
    playerCount: 0,
  };
}

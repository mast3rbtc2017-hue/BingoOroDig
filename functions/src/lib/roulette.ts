import { db, FieldValue, Timestamp } from "./firestore";
import { nextId } from "./firestore";

/** Orden físico de la ruleta europea (37 números) */
export const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
  24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
] as const;

export const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export const ALL_NUMBERS = Array.from({ length: 37 }, (_, i) => i);

export type RouletteBet = { number: number; amount: number };

export type RouletteConfig = {
  enabled: boolean;
  winEveryNBingoGames: number;
  minBet: number;
  maxBet: number;
  maxBetsPerSpin: number;
  payoutMultiplier: number;
  bingoGamesFinished: number;
  lastRouletteWinBingoCount: number;
  totalSpins: number;
};

const DEFAULT_CONFIG: RouletteConfig = {
  enabled: true,
  winEveryNBingoGames: 10,
  minBet: 1,
  maxBet: 500,
  maxBetsPerSpin: 8,
  payoutMultiplier: 35,
  bingoGamesFinished: 0,
  lastRouletteWinBingoCount: 0,
  totalSpins: 0,
};

const CONFIG_REF = db.collection("settings").doc("roulette");

export function getNumberColor(n: number): "green" | "red" | "black" {
  if (n === 0) return "green";
  return RED_NUMBERS.has(n) ? "red" : "black";
}

export function wheelIndexForNumber(n: number): number {
  const idx = WHEEL_ORDER.indexOf(n as (typeof WHEEL_ORDER)[number]);
  return idx >= 0 ? idx : 0;
}

export function serializeConfig(data: Record<string, unknown>): RouletteConfig {
  return {
    enabled: data.enabled !== false,
    winEveryNBingoGames: Math.max(1, Number(data.winEveryNBingoGames ?? 10)),
    minBet: Math.max(1, Number(data.minBet ?? 1)),
    maxBet: Math.max(1, Number(data.maxBet ?? 500)),
    maxBetsPerSpin: Math.max(1, Math.min(37, Number(data.maxBetsPerSpin ?? 8))),
    payoutMultiplier: Math.max(1, Number(data.payoutMultiplier ?? 35)),
    bingoGamesFinished: Number(data.bingoGamesFinished ?? 0),
    lastRouletteWinBingoCount: Number(data.lastRouletteWinBingoCount ?? 0),
    totalSpins: Number(data.totalSpins ?? 0),
  };
}

export async function getRouletteConfig(): Promise<RouletteConfig> {
  const snap = await CONFIG_REF.get();
  if (!snap.exists) {
    await CONFIG_REF.set({ ...DEFAULT_CONFIG, updatedAt: FieldValue.serverTimestamp() });
    return { ...DEFAULT_CONFIG };
  }
  return serializeConfig(snap.data()!);
}

export async function updateRouletteConfig(
  patch: Partial<RouletteConfig>,
): Promise<RouletteConfig> {
  await CONFIG_REF.set(
    { ...patch, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
  return getRouletteConfig();
}

/** Llamar cuando termina una partida de bingo */
export async function recordBingoGameFinished(): Promise<RouletteConfig> {
  const snap = await CONFIG_REF.get();
  const current = snap.exists ? serializeConfig(snap.data()!) : { ...DEFAULT_CONFIG };
  const bingoGamesFinished = current.bingoGamesFinished + 1;
  await CONFIG_REF.set(
    { bingoGamesFinished, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
  return getRouletteConfig();
}

export function isWinAllowedSpin(config: RouletteConfig): boolean {
  const since = config.bingoGamesFinished - config.lastRouletteWinBingoCount;
  return since >= config.winEveryNBingoGames;
}

export function gamesUntilNextWin(config: RouletteConfig): number {
  const since = config.bingoGamesFinished - config.lastRouletteWinBingoCount;
  const rem = config.winEveryNBingoGames - since;
  return Math.max(0, rem);
}

export function pickWinningNumber(
  bets: RouletteBet[],
  allowWin: boolean,
): number {
  const betNumbers = new Set(bets.map((b) => b.number));
  const unbet = ALL_NUMBERS.filter((n) => !betNumbers.has(n));

  if (allowWin && betNumbers.size > 0) {
    const withBets = [...betNumbers];
    return withBets[Math.floor(Math.random() * withBets.length)]!;
  }

  if (unbet.length > 0) {
    return unbet[Math.floor(Math.random() * unbet.length)]!;
  }

  return ALL_NUMBERS[Math.floor(Math.random() * ALL_NUMBERS.length)]!;
}

export async function executeRouletteSpin(
  userUid: string,
  userId: number,
  username: string,
  bets: RouletteBet[],
): Promise<{
  winningNumber: number;
  totalBet: number;
  totalPayout: number;
  netResult: number;
  newBalance: number;
  winAllowed: boolean;
  gamesUntilNextWin: number;
  spinId: number;
}> {
  const config = await getRouletteConfig();
  if (!config.enabled) {
    throw new Error("La ruleta está desactivada temporalmente");
  }

  if (!bets.length) {
    throw new Error("Debes apostar al menos a un número");
  }
  if (bets.length > config.maxBetsPerSpin) {
    throw new Error(`Máximo ${config.maxBetsPerSpin} números por jugada`);
  }

  const seen = new Set<number>();
  for (const b of bets) {
    if (b.number < 0 || b.number > 36 || !Number.isInteger(b.number)) {
      throw new Error("Número inválido (0–36)");
    }
    if (seen.has(b.number)) {
      throw new Error("No puedes apostar dos veces al mismo número");
    }
    seen.add(b.number);
    if (b.amount < config.minBet || b.amount > config.maxBet) {
      throw new Error(`Apuesta por número: $${config.minBet}–$${config.maxBet}`);
    }
  }

  const totalBet = bets.reduce((s, b) => s + b.amount, 0);
  const userRef = db.collection("users").doc(userUid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new Error("Usuario no encontrado");
  const user = userSnap.data()!;
  if (user.balance < totalBet) {
    throw new Error("Saldo insuficiente");
  }

  const winAllowed = isWinAllowedSpin(config);
  const winningNumber = pickWinningNumber(bets, winAllowed);

  let totalPayout = 0;
  for (const b of bets) {
    if (b.number === winningNumber) {
      totalPayout += b.amount + b.amount * config.payoutMultiplier;
    }
  }

  const netResult = totalPayout - totalBet;
  const newBalance = user.balance - totalBet + totalPayout;

  const spinId = await nextId("rouletteSpins");
  const spinRecord = {
    id: spinId,
    userId,
    userUid,
    username,
    bets,
    winningNumber,
    totalBet,
    totalPayout,
    netResult,
    winAllowed,
    color: getNumberColor(winningNumber),
    createdAt: FieldValue.serverTimestamp(),
  };

  await db.collection("rouletteSpins").doc(String(spinId)).set(spinRecord);
  await userRef.update({ balance: newBalance });

  const configUpdate: Record<string, unknown> = {
    totalSpins: config.totalSpins + 1,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (winAllowed) {
    configUpdate.lastRouletteWinBingoCount = config.bingoGamesFinished;
  }
  await CONFIG_REF.set(configUpdate, { merge: true });

  await userRef.collection("transactions").add({
    userId,
    type: "purchase",
    amount: totalBet,
    description: `Ruleta — apuesta $${totalBet} (${bets.length} números)`,
    createdAt: FieldValue.serverTimestamp(),
  });

  if (totalPayout > 0) {
    await userRef.collection("transactions").add({
      userId,
      type: "prize",
      amount: totalPayout,
      description: `Ruleta — ganaste $${totalPayout} en el ${winningNumber}`,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  const updatedConfig = await getRouletteConfig();

  return {
    winningNumber,
    totalBet,
    totalPayout,
    netResult,
    newBalance,
    winAllowed,
    gamesUntilNextWin: gamesUntilNextWin(updatedConfig),
    spinId,
  };
}

export function serializeSpin(d: Record<string, unknown>) {
  return {
    id: d.id,
    userId: d.userId,
    username: d.username,
    bets: d.bets,
    winningNumber: d.winningNumber,
    totalBet: d.totalBet,
    totalPayout: d.totalPayout,
    netResult: d.netResult,
    winAllowed: d.winAllowed,
    color: d.color,
    createdAt:
      d.createdAt instanceof Timestamp
        ? d.createdAt.toDate().toISOString()
        : d.createdAt,
  };
}

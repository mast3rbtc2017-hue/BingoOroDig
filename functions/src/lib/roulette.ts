import { db, FieldValue, Timestamp } from "./firestore";
import { nextId } from "./firestore";
import { formatCOP } from "./currency";

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
  winEveryNRouletteSpins: number;
  minBet: number;
  maxBet: number;
  maxBetsPerSpin: number;
  payoutMultiplier: number;
  totalSpins: number;
  lastWinAllowedAtSpin: number;
};

const DEFAULT_CONFIG: RouletteConfig = {
  enabled: true,
  winEveryNRouletteSpins: 10,
  minBet: 1000,
  maxBet: 500000,
  maxBetsPerSpin: 8,
  payoutMultiplier: 35,
  totalSpins: 0,
  lastWinAllowedAtSpin: 0,
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

/** Migra campos antiguos (bingo) a contadores por giro de ruleta */
export function serializeConfig(data: Record<string, unknown>): RouletteConfig {
  const winEvery =
    Number(data.winEveryNRouletteSpins ?? data.winEveryNBingoGames ?? 10) || 10;
  return {
    enabled: data.enabled !== false,
    winEveryNRouletteSpins: Math.max(1, winEvery),
    minBet: Math.max(1, Number(data.minBet ?? 1)),
    maxBet: Math.max(1, Number(data.maxBet ?? 500)),
    maxBetsPerSpin: Math.max(1, Math.min(37, Number(data.maxBetsPerSpin ?? 8))),
    payoutMultiplier: Math.max(1, Number(data.payoutMultiplier ?? 35)),
    totalSpins: Number(data.totalSpins ?? 0),
    lastWinAllowedAtSpin: Number(
      data.lastWinAllowedAtSpin ?? data.lastRouletteWinBingoCount ?? 0,
    ),
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
  patch: Partial<RouletteConfig> & Record<string, unknown>,
): Promise<RouletteConfig> {
  const clean: Record<string, unknown> = { ...patch, updatedAt: FieldValue.serverTimestamp() };
  delete clean.winEveryNBingoGames;
  delete clean.bingoGamesFinished;
  delete clean.lastRouletteWinBingoCount;
  await CONFIG_REF.set(clean, { merge: true });
  return getRouletteConfig();
}

/** Cada N giros de ruleta se permite un resultado ganador (número apostado) */
export function isWinAllowedSpin(config: RouletteConfig): boolean {
  const since = config.totalSpins - config.lastWinAllowedAtSpin;
  return since >= config.winEveryNRouletteSpins;
}

export function spinsUntilNextWin(config: RouletteConfig): number {
  const since = config.totalSpins - config.lastWinAllowedAtSpin;
  const rem = config.winEveryNRouletteSpins - since;
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
  spinsUntilNextWin: number;
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
      throw new Error(`Apuesta por número: ${formatCOP(config.minBet)}–${formatCOP(config.maxBet)}`);
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

  const newTotalSpins = config.totalSpins + 1;
  const configUpdate: Record<string, unknown> = {
    totalSpins: newTotalSpins,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (winAllowed) {
    configUpdate.lastWinAllowedAtSpin = newTotalSpins;
  }
  await CONFIG_REF.set(configUpdate, { merge: true });

  await userRef.collection("transactions").add({
    userId,
    type: "purchase",
    amount: totalBet,
    description: `Ruleta — apuesta ${formatCOP(totalBet)} (${bets.length} números)`,
    createdAt: FieldValue.serverTimestamp(),
  });

  if (totalPayout > 0) {
    await userRef.collection("transactions").add({
      userId,
      type: "prize",
      amount: totalPayout,
      description: `Ruleta — ganaste ${formatCOP(totalPayout)} en el ${winningNumber}`,
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
    spinsUntilNextWin: spinsUntilNextWin(updatedConfig),
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

/**
 * Prueba API ruleta (lógica casa + spin).
 * Uso: node scripts/test-roulette.mjs
 */
const API = (process.env.API_URL || "https://bingoorodig-api.onrender.com").replace(/\/+$/, "");
const USER = process.env.TEST_USER || "jugador1";
const PASS = process.env.TEST_PASS || "BingoJugador2026!";

async function req(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `${res.status} ${path}`);
  return data;
}

async function login() {
  const data = await req("/api/auth/login", {
    method: "POST",
    body: { username: USER, password: PASS },
  });
  return data.token;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  console.log("API:", API);
  const token = await login();
  console.log("✓ Login", USER);

  const cfg = await req("/api/roulette/config", { token });
  console.log("✓ Config", {
    winEveryNBingoGames: cfg.winEveryNBingoGames,
    winAllowedNow: cfg.winAllowedNow,
    gamesUntilNextWin: cfg.gamesUntilNextWin,
    minBet: cfg.minBet,
  });

  const bets = [{ number: 7, amount: cfg.minBet }];
  const spin = await req("/api/roulette/spin", {
    method: "POST",
    token,
    body: { bets },
  });
  console.log("✓ Spin", {
    winning: spin.winningNumber,
    color: spin.color,
    totalBet: spin.totalBet,
    totalPayout: spin.totalPayout,
    net: spin.netResult,
    winAllowed: spin.winAllowed,
  });

  const betNums = new Set(bets.map((b) => b.number));
  if (!spin.winAllowed) {
    assert(!betNums.has(spin.winningNumber), "Sin premio permitido: debe caer en número sin apuesta");
    console.log("✓ Casa: número sin apuesta", spin.winningNumber);
  } else {
    assert(betNums.has(spin.winningNumber), "Con premio permitido: debe caer en número apostado");
    console.log("✓ Premio permitido en número apostado");
  }

  const hist = await req("/api/roulette/history?limit=3", { token });
  assert(Array.isArray(hist) && hist.length >= 1, "Historial vacío");
  assert(hist[0].winningNumber === spin.winningNumber, "Historial no coincide");
  console.log("✓ Historial propio", hist.length, "filas");

  console.log("\n✅ Ruleta OK");
}

main().catch((e) => {
  console.error("\n❌", e.message);
  process.exit(1);
});

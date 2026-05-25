/**
 * Prueba API ruleta (lógica casa + spin).
 * Uso: node scripts/test-roulette.mjs
 */
const API = (process.env.API_URL || "https://bingoorodig-api.onrender.com").replace(/\/+$/, "");
const USER = process.env.TEST_USER || "jugador1";
const PASS = process.env.TEST_PASS || "BingoJugador2026!";
const FIREBASE_API_KEY =
  process.env.FIREBASE_API_KEY || "AIzaSyDTolx2K9rMTkBUq7S1CcRnBFZn1XphDdc";

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
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: data.token, returnSecureToken: true }),
    },
  );
  const fb = await res.json();
  if (!res.ok) throw new Error(fb.error?.message || "Firebase signIn failed");
  return fb.idToken;
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
    winEveryNRouletteSpins: cfg.winEveryNRouletteSpins,
    winAllowedNow: cfg.winAllowedNow,
    spinsUntilNextWin: cfg.spinsUntilNextWin,
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

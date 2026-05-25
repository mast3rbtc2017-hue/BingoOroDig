/**
 * Prueba local: npm run build && node lib/test/raffleImage.test.js
 */
import {
  validateRaffleImageUrl,
  buildDataUrlFromPayload,
  MAX_RAFFLE_IMAGE_BYTES,
} from "../lib/raffleImage";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

// 1x1 PNG rojo en base64
const tinyPngB64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const tinyDataUrl = `data:image/png;base64,${tinyPngB64}`;

assert(validateRaffleImageUrl(tinyDataUrl) === tinyDataUrl, "acepta PNG pequeño");
assert(validateRaffleImageUrl(null) === null, "null permitido");

let threw = false;
try {
  validateRaffleImageUrl("https://example.com/x.png");
} catch {
  threw = true;
}
assert(!threw, "acepta URL https legacy");

try {
  validateRaffleImageUrl("data:text/plain;base64,abc");
  assert(false, "debe rechazar no-imagen");
} catch {
  assert(true, "rechaza data URL no imagen");
}

const built = buildDataUrlFromPayload(tinyPngB64, "image/png");
assert(built.startsWith("data:image/png;base64,"), "build desde base64");

const bigB64 = "A".repeat(MAX_RAFFLE_IMAGE_BYTES + 5000);
try {
  buildDataUrlFromPayload(bigB64, "image/jpeg");
  assert(false, "debe rechazar imagen enorme");
} catch {
  assert(true, "rechaza > MAX_RAFFLE_IMAGE_BYTES");
}

console.log("✓ Todas las pruebas de raffleImage pasaron");
console.log(`  Límite imagen: ${MAX_RAFFLE_IMAGE_BYTES} bytes`);

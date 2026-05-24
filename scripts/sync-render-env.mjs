/**
 * Genera .env para importar en Render y opcionalmente sube vía API.
 * Uso: node scripts/sync-render-env.mjs [ruta-al-json]
 */
import fs from "node:fs";
import path from "node:path";

const jsonPath =
  process.argv[2] ??
  "C:\\Users\\Usuario\\Desktop\\bingoorodig-firebase-adminsdk-fbsvc-e237c01cf8.json";

const serviceId = "srv-d894ndul51nc7382r590";
const apiKeyPath = path.join(
  process.env.USERPROFILE ?? "",
  "Desktop",
  ".render-api-key",
);

const sa = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const desktopEnv = path.join(
  process.env.USERPROFILE ?? "",
  "Desktop",
  "render-import-bingoorodig.env",
);

const envContent = [
  "GOOGLE_CLOUD_PROJECT=bingoorodig",
  "NODE_ENV=production",
  "NODE_VERSION=20",
  "FRONTEND_URL=https://bingoorodig.web.app,https://bingoorodig.firebaseapp.com",
  `FIREBASE_CLIENT_EMAIL=${sa.client_email}`,
  `FIREBASE_PRIVATE_KEY=${JSON.stringify(sa.private_key)}`,
].join("\n");

fs.writeFileSync(desktopEnv, envContent, "utf8");
console.log("Created:", desktopEnv);

async function putEnv(key, value) {
  const url = `https://api.render.com/v1/services/${serviceId}/env-vars/${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ value }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${key}: ${res.status} ${text}`);
  }
  console.log("Set", key);
}

async function deleteEnv(key) {
  const url = `https://api.render.com/v1/services/${serviceId}/env-vars/${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (res.status === 404) return;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DELETE ${key}: ${res.status} ${text}`);
  }
  console.log("Deleted", key);
}

async function deploy() {
  const url = `https://api.render.com/v1/services/${serviceId}/deploys`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ clearCache: "clear" }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`deploy: ${res.status} ${text}`);
  }
  console.log("Deploy triggered");
}

let apiKey = process.env.RENDER_API_KEY?.trim();
if (!apiKey && fs.existsSync(apiKeyPath)) {
  apiKey = fs.readFileSync(apiKeyPath, "utf8").trim();
}

if (!apiKey) {
  fs.writeFileSync(
    apiKeyPath,
    "# Pega aquí tu API key de Render (https://dashboard.render.com/u/settings#api-keys)\n# Borra esta línea y pega solo la key que empieza con rnd_\n",
    "utf8",
  );
  console.log("No RENDER_API_KEY. Created template:", apiKeyPath);
  console.log("Import manual: Render → Environment → Add from .env →", desktopEnv);
  process.exit(0);
}

try {
  await deleteEnv("FIREBASE_SERVICE_ACCOUNT");
  await putEnv("FIREBASE_CLIENT_EMAIL", sa.client_email);
  await putEnv("FIREBASE_PRIVATE_KEY", sa.private_key);
  await putEnv("GOOGLE_CLOUD_PROJECT", "bingoorodig");
  await putEnv("FRONTEND_URL", "https://bingoorodig.web.app,https://bingoorodig.firebaseapp.com");
  await putEnv("NODE_ENV", "production");
  await putEnv("NODE_VERSION", "20");
  await deploy();
  console.log("Done. Check https://bingoorodig-api.onrender.com/api/healthz");
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

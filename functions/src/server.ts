/**
 * Standalone HTTP server for Render (and local API dev).
 */
import app from "./app";
import { getFirebaseStatus } from "./lib/firestore";

const rawPort = process.env.PORT ?? "8080";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT: "${rawPort}"`);
}

const fb = getFirebaseStatus();
if (!fb.ok) {
  console.warn("[startup] Firebase not fully configured:", fb.error);
} else {
  console.log("[startup] Firebase OK, project:", fb.projectId);
}

const server = app.listen(port, "0.0.0.0", () => {
  console.log(`Bingo OroDig API listening on port ${port}`);
});

server.on("error", (err) => {
  console.error("[startup] Server error:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("[startup] Unhandled rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[startup] Uncaught exception:", err);
  process.exit(1);
});

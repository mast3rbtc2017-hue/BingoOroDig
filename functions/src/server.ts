/**
 * Standalone HTTP server for Render (and local API dev).
 * Cloud Functions use index.ts instead.
 */
import app from "./app";

const rawPort = process.env.PORT ?? "8080";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT: "${rawPort}"`);
}

app.listen(port, "0.0.0.0", () => {
  console.log(`Bingo OroDig API listening on port ${port}`);
});

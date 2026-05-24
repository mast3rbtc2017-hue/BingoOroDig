import { onRequest } from "firebase-functions/v2/https";
import app from "./app";

export const api = onRequest(
  {
    region: "us-central1",
    memory: "512MiB",
    timeoutSeconds: 120,
    maxInstances: 10,
  },
  app,
);

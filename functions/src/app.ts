import express from "express";
import cors from "cors";
import router from "./routes";

const app = express();

const defaultOrigins = [
  "https://bingoorodig.web.app",
  "https://bingoorodig.firebaseapp.com",
  "http://localhost:4173",
  "http://localhost:5173",
  "http://127.0.0.1:4173",
];

const allowedOrigins = new Set(
  [
    ...defaultOrigins,
    ...(process.env.FRONTEND_URL ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    ...(process.env.CORS_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  ],
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, origin ?? true);
        return;
      }
      console.warn("CORS blocked:", origin);
      callback(null, false);
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "8mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req, res) => {
  res.json({
    service: "Bingo OroDig API",
    health: "/api/healthz",
    project: process.env.GOOGLE_CLOUD_PROJECT ?? "bingoorodig",
  });
});

app.use("/api", router);

export default app;

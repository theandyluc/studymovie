import { Hono } from "hono";
import { cors } from "hono/cors";
import { SITE_URL } from "./env.js";
import { requireAuth } from "./middleware/auth.js";
import { getMe } from "./api/me.js";

/**
 * Backend API service — DÙNG CHUNG cho web frontend + extension.
 * TIP-003: thêm CORS (chỉ origin frontend), middleware auth, endpoint mẫu /api/me.
 * Nghiệp vụ khác (sessions/vocab/leaderboard...) thêm ở các TIP sau (Blueprint mục 6).
 */
export const app = new Hono();

// CORS: CHỈ cho origin frontend (KHÔNG mở '*'); cho header Authorization.
app.use(
  "*",
  cors({
    origin: SITE_URL,
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  })
);

// Public
app.get("/health", (c) => c.json({ status: "ok" }));

// Protected (cần Bearer token hợp lệ)
app.get("/api/me", requireAuth, getMe);

export default app;

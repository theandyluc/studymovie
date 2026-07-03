import { Hono } from "hono";
import { cors } from "hono/cors";
import { SITE_URL } from "./env.js";
import { requireAuth } from "./middleware/auth.js";
import { requireActive } from "./middleware/active.js";
import { getMe } from "./api/me.js";
import { getLookup } from "./api/lookup.js";
import { postLookupContext } from "./api/lookup-context.js";
import { postVocabulary, getVocabulary, deleteVocabulary, postMarkLearned } from "./api/vocabulary.js";
import { getDashboard } from "./api/dashboard.js";
import { getLeaderboard } from "./api/leaderboard.js";
import { getProfile, patchProfile } from "./api/profile.js";
import { postStudySession } from "./api/study-session.js";
import { getPlaylist, postPlaylist, patchPlaylist, deletePlaylist } from "./api/playlist.js";
import { postCreateOrder, getOrder, postSepayWebhook } from "./api/payment.js";
import { getLevel, setLevel } from "./api/level.js";
import { getAccessStatus } from "./api/access.js";
import {
  getAdminStats,
  getAdminUsers,
  postAdminPrice,
  postAdminGrantPro,
  postAdminSetAdmin,
} from "./api/admin.js";
import {
  getWeeklyPlan,
  postWeeklyPlan,
  patchWeeklyPlan,
  deleteWeeklyPlan,
} from "./api/weekly-plan.js";

/**
 * Backend API service — DÙNG CHUNG cho web frontend + extension.
 * TIP-003: thêm CORS (chỉ origin frontend), middleware auth, endpoint mẫu /api/me.
 * Nghiệp vụ khác (sessions/vocab/leaderboard...) thêm ở các TIP sau (Blueprint mục 6).
 */
export const app = new Hono();

// CORS: web frontend (SITE_URL — production set qua env Vercel) + localhost dev +
// popup/background extension (chrome-extension://<id>). KHÔNG mở '*'.
const DEV_ORIGIN = "http://localhost:3000";
function allowedOrigin(origin: string | undefined): string | null {
  if (!origin) return SITE_URL; // request không có Origin (server-to-server) — vô hại
  if (origin === SITE_URL || origin === DEV_ORIGIN) return origin;
  if (origin.startsWith("chrome-extension://")) return origin;
  return null; // chặn mọi origin khác
}

app.use(
  "*",
  cors({
    origin: (origin) => allowedOrigin(origin),
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  })
);

// Public
app.get("/health", (c) => c.json({ status: "ok" }));
// SePay webhook (TIP-013): KHÔNG qua JWT user — SePay gọi. Tự verify `Authorization: Apikey`.
app.post("/api/sepay-webhook", postSepayWebhook);

// Protected (cần Bearer token hợp lệ)
app.get("/api/me", requireAuth, getMe);
app.get("/api/access-status", requireAuth, getAccessStatus); // WEB-TRIAL TIP-019b
// TIP-062 — requireActive (SAU requireAuth) chặn khi HẾT HẠN cho endpoint "dùng dịch vụ".
app.get("/api/lookup", requireAuth, requireActive, getLookup); // EXT-02: tra nghĩa (từ điển, IPA/audio)
app.post("/api/lookup-context", requireAuth, requireActive, postLookupContext); // TIP-038: nghĩa theo ngữ cảnh (AI)
app.post("/api/vocabulary", requireAuth, requireActive, postVocabulary); // EXT-02: lưu từ
app.post("/api/vocabulary/mark-learned", requireAuth, requireActive, postMarkLearned); // WEB-FLASH2 TIP-026
app.get("/api/vocabulary", requireAuth, getVocabulary); // WEB-03: danh sách
app.delete("/api/vocabulary/:id", requireAuth, deleteVocabulary); // WEB-03: xóa
app.get("/api/dashboard", requireAuth, getDashboard); // WEB-02
app.get("/api/level", requireAuth, getLevel); // WEB-LEVEL TIP-016
app.post("/api/level", requireAuth, setLevel); // WEB-LEVEL TIP-016
app.get("/api/admin/stats", requireAuth, getAdminStats); // WEB-ADMIN TIP-020 (RPC fail-closed)
app.get("/api/admin/users", requireAuth, getAdminUsers); // WEB-ADMIN TIP-020
app.post("/api/admin/price", requireAuth, postAdminPrice); // WEB-ADMIN TIP-020
app.post("/api/admin/grant-pro", requireAuth, postAdminGrantPro); // WEB-ADMIN TIP-020
app.post("/api/admin/set-admin", requireAuth, postAdminSetAdmin); // WEB-ADMIN TIP-020
app.get("/api/weekly-plan", requireAuth, getWeeklyPlan); // WEB-PLAN TIP-017
app.post("/api/weekly-plan", requireAuth, postWeeklyPlan); // WEB-PLAN TIP-017
app.patch("/api/weekly-plan/:id", requireAuth, patchWeeklyPlan); // WEB-PLAN TIP-017
app.delete("/api/weekly-plan/:id", requireAuth, deleteWeeklyPlan); // WEB-PLAN TIP-017
app.get("/api/leaderboard", requireAuth, getLeaderboard); // WEB-07
app.get("/api/profile", requireAuth, getProfile); // WEB-09
app.patch("/api/profile", requireAuth, patchProfile); // WEB-09
app.post("/api/study-session", requireAuth, requireActive, postStudySession); // EXT-03 timer (TIP-062 gate)
app.get("/api/playlist", requireAuth, getPlaylist); // WEB-06
app.post("/api/playlist", requireAuth, postPlaylist); // WEB-06
app.patch("/api/playlist/:id", requireAuth, patchPlaylist); // WEB-06
app.delete("/api/playlist/:id", requireAuth, deletePlaylist); // WEB-06
app.post("/api/payment/create-order", requireAuth, postCreateOrder); // BE-05 TIP-013
app.get("/api/payment/order/:code", requireAuth, getOrder); // BE-05 TIP-013

export default app;

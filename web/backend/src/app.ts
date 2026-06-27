import { Hono } from "hono";

/**
 * Backend API service — DÙNG CHUNG cho web frontend + extension.
 * TIP-001: skeleton, chỉ có health-check. Nghiệp vụ (api/services/repositories/
 * integrations) thêm ở các TIP sau theo Blueprint mục 6.
 */
export const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));

export default app;

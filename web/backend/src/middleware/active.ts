// TIP-062 — Middleware chặn khi subscription HẾT HẠN. Chạy SAU requireAuth (cần c.get("token")).
// Gọi RPC get_access_status (trial 24h HOẶC đã trả). Chỉ chặn khi has_access === false → 403.
// Lỗi RPC / thiếu field → FAIL-OPEN (next) để không chặn oan khi lỗi hệ thống
// (đây là gate phụ phí, không phải gate bảo mật — dữ liệu vẫn được RLS bảo vệ).
import type { MiddlewareHandler } from "hono";
import { getUserClient } from "../lib/supabase.js";

export const requireActive: MiddlewareHandler = async (c, next) => {
  try {
    const { data, error } = await getUserClient(c.get("token")).rpc("get_access_status");
    if (!error && (data as { has_access?: boolean } | null)?.has_access === false) {
      return c.json({ error: "subscription_expired" }, 403);
    }
  } catch {
    /* fail-open: lỗi hệ thống không được chặn oan người còn hạn */
  }
  await next();
};

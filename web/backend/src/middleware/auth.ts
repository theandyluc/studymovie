// TIP-003 — Middleware xác thực JWT.
// Đọc "Authorization: Bearer <token>", verify bằng supabase.auth.getUser(token)
// (không tự verify JWT secret). Hợp lệ -> gắn user vào context; không -> 401.
import type { MiddlewareHandler } from "hono";
import type { User } from "@supabase/supabase-js";
import { getServiceClient } from "../lib/supabase.js";

declare module "hono" {
  interface ContextVariableMap {
    user: User;
    token: string;
  }
}

export const requireAuth: MiddlewareHandler = async (c, next) => {
  const authz = c.req.header("Authorization") ?? "";
  const m = authz.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    return c.json({ error: "missing bearer token" }, 401);
  }
  const { data, error } = await getServiceClient().auth.getUser(m[1]);
  if (error || !data.user) {
    return c.json({ error: "invalid token" }, 401);
  }
  c.set("user", data.user);
  c.set("token", m[1]); // dùng cho getUserClient (RPC cần auth.uid)
  await next();
};

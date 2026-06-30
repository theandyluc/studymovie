// TIP-020 — Admin endpoints. Tầng bảo mật THẬT = RPC tự check is_caller_admin (fail-closed).
// Ở đây chỉ proxy RPC qua getUserClient (auth.uid). RPC raise 'forbidden' → trả 403.
import type { Context } from "hono";
import { getUserClient } from "../lib/supabase.js";

// Gọi RPC; lỗi 'forbidden' → 403, lỗi khác → 500.
async function callRpc(c: Context, fn: string, args?: Record<string, unknown>) {
  const { data, error } = await getUserClient(c.get("token")).rpc(fn, args);
  if (error) {
    const code = /forbidden/i.test(error.message) ? 403 : 500;
    return c.json({ error: error.message }, code);
  }
  return c.json(data ?? { ok: true });
}

export const getAdminStats = (c: Context) => callRpc(c, "admin_get_stats");
export const getAdminUsers = (c: Context) => callRpc(c, "admin_list_users");

export async function postAdminPrice(c: Context) {
  let body: { price?: unknown };
  try {
    body = (await c.req.json()) as { price?: unknown };
  } catch {
    return c.json({ error: "invalid json" }, 400);
  }
  const price = Math.round(Number(body.price));
  if (!Number.isFinite(price) || price <= 0) return c.json({ error: "invalid_price" }, 400);
  return callRpc(c, "admin_set_pro_price", { p_price: price });
}

export async function postAdminGrantPro(c: Context) {
  let body: { user_id?: unknown; days?: unknown };
  try {
    body = (await c.req.json()) as { user_id?: unknown; days?: unknown };
  } catch {
    return c.json({ error: "invalid json" }, 400);
  }
  const userId = typeof body.user_id === "string" ? body.user_id : "";
  const days = Math.round(Number(body.days));
  if (!userId) return c.json({ error: "missing user_id" }, 400);
  if (!Number.isFinite(days) || days <= 0) return c.json({ error: "invalid_days" }, 400);
  return callRpc(c, "admin_grant_pro", { p_user_id: userId, p_days: days });
}

export async function postAdminSetAdmin(c: Context) {
  let body: { user_id?: unknown; is_admin?: unknown };
  try {
    body = (await c.req.json()) as { user_id?: unknown; is_admin?: unknown };
  } catch {
    return c.json({ error: "invalid json" }, 400);
  }
  const userId = typeof body.user_id === "string" ? body.user_id : "";
  if (!userId) return c.json({ error: "missing user_id" }, 400);
  if (typeof body.is_admin !== "boolean") return c.json({ error: "is_admin phải boolean" }, 400);
  return callRpc(c, "admin_set_admin", { p_user_id: userId, p_is_admin: body.is_admin });
}

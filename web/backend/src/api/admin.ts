// TIP-020 — Admin endpoints. Tầng bảo mật THẬT = RPC tự check is_caller_admin (fail-closed).
// Ở đây chỉ proxy RPC qua getUserClient (auth.uid). RPC raise 'forbidden' → trả 403.
import type { Context } from "hono";
import { getUserClient, getServiceClient } from "../lib/supabase.js";

// Gọi RPC; lỗi 'forbidden' → 403, lỗi khác → 500.
async function callRpc(c: Context, fn: string, args?: Record<string, unknown>) {
  const { data, error } = await getUserClient(c.get("token")).rpc(fn, args);
  if (error) {
    const code = /forbidden/i.test(error.message) ? 403 : 500;
    return c.json({ error: error.message }, code);
  }
  return c.json(data ?? { ok: true });
}

// TIP-096 — tạo/xoá tài khoản THẬT (auth.users) cần Admin Auth API (service_role), RPC thường
// không làm được. Gate bằng đúng RPC is_caller_admin() (fail-closed, giống mọi admin action khác)
// TRƯỚC khi dùng service client — service_role không bao giờ chạy khi chưa xác nhận là admin.
async function requireCallerAdmin(c: Context): Promise<boolean> {
  const { data, error } = await getUserClient(c.get("token")).rpc("is_caller_admin");
  return !error && data === true;
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

// TIP-096 — tạo tài khoản thủ công (email + mật khẩu, tự xác nhận email — admin tạo hộ, khỏi verify).
export async function postAdminCreateUser(c: Context) {
  if (!(await requireCallerAdmin(c))) return c.json({ error: "forbidden" }, 403);
  let body: { email?: unknown; password?: unknown };
  try {
    body = (await c.req.json()) as { email?: unknown; password?: unknown };
  } catch {
    return c.json({ error: "invalid json" }, 400);
  }
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ error: "invalid_email" }, 400);
  if (password.length < 6) return c.json({ error: "invalid_password" }, 400);
  const { data, error } = await getServiceClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true, user_id: data.user?.id });
}

// TIP-096 — xoá tài khoản thủ công (auth.users; cascade xoá profiles/subscriptions/vocab qua FK).
export async function deleteAdminUser(c: Context) {
  if (!(await requireCallerAdmin(c))) return c.json({ error: "forbidden" }, 403);
  const userId = c.req.param("id");
  if (!userId) return c.json({ error: "missing id" }, 400);
  const { error } = await getServiceClient().auth.admin.deleteUser(userId);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
}

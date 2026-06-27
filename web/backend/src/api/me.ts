// TIP-003 — GET /api/me (protected): trả profile của user hiện tại.
// Dùng để test chuỗi auth end-to-end (frontend -> Bearer -> backend -> Supabase).
import type { Context } from "hono";
import { getServiceClient } from "../lib/supabase.js";

export async function getMe(c: Context) {
  const user = c.get("user");
  const { data, error } = await getServiceClient()
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (error) {
    return c.json({ error: error.message }, 500);
  }
  return c.json({ user: { id: user.id, email: user.email }, profile: data });
}

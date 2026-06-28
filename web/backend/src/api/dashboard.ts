// TIP-007 — GET /api/dashboard: gọi RPC get_dashboard() (auth.uid của user).
import type { Context } from "hono";
import { getUserClient } from "../lib/supabase.js";

export async function getDashboard(c: Context) {
  const { data, error } = await getUserClient(c.get("token")).rpc("get_dashboard");
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
}

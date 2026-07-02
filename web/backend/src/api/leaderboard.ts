// TIP-007/058 — GET /api/leaderboard?period=week|month|all: RPC get_leaderboard(p_period)
// (compute-on-read). period không hợp lệ → mặc định 'week'.
import type { Context } from "hono";
import { getUserClient } from "../lib/supabase.js";

export async function getLeaderboard(c: Context) {
  const raw = (c.req.query("period") ?? "week").toLowerCase();
  const period = raw === "month" || raw === "all" ? raw : "week";
  const { data, error } = await getUserClient(c.get("token")).rpc("get_leaderboard", { p_period: period });
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
}

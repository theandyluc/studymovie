// TIP-007 — GET /api/leaderboard: gọi RPC get_leaderboard_weekly() (tuần ISO, compute-on-read).
import type { Context } from "hono";
import { getUserClient } from "../lib/supabase.js";

export async function getLeaderboard(c: Context) {
  const { data, error } = await getUserClient(c.get("token")).rpc("get_leaderboard_weekly");
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
}

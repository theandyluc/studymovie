// TIP-019b — GET /api/access-status: gọi RPC get_access_status (trial 24h + paid). getUserClient (auth.uid).
import type { Context } from "hono";
import { getUserClient } from "../lib/supabase.js";

export async function getAccessStatus(c: Context) {
  const { data, error } = await getUserClient(c.get("token")).rpc("get_access_status");
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
}

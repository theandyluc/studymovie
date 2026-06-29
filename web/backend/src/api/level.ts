// TIP-016 — Level system: GET tiến độ (get_level_progress, có side-effect tự lên cấp),
// POST đặt/đổi level (set_current_level). Dùng getUserClient (RPC cần auth.uid()).
import type { Context } from "hono";
import { getUserClient } from "../lib/supabase.js";

const LEVELS = ["A0", "A1", "A2", "B1", "B2", "C1", "C2"];

export async function getLevel(c: Context) {
  const { data, error } = await getUserClient(c.get("token")).rpc("get_level_progress");
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
}

export async function setLevel(c: Context) {
  let body: { level?: unknown };
  try {
    body = (await c.req.json()) as { level?: unknown };
  } catch {
    return c.json({ error: "invalid json" }, 400);
  }
  const level = typeof body.level === "string" ? body.level : "";
  if (!LEVELS.includes(level)) return c.json({ error: "invalid_level" }, 400);

  const { error } = await getUserClient(c.get("token")).rpc("set_current_level", { p_level: level });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
}

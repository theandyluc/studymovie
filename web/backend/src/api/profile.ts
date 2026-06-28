// TIP-007 — GET/PATCH /api/profile: đọc/cập nhật nickname + daily_commit_minutes của user.
import type { Context } from "hono";
import { getUserClient } from "../lib/supabase.js";

const COLS = "nickname, avatar_url, daily_commit_minutes";

export async function getProfile(c: Context) {
  const user = c.get("user");
  const { data, error } = await getUserClient(c.get("token"))
    .from("profiles")
    .select(COLS)
    .eq("id", user.id)
    .maybeSingle();
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ profile: data });
}

type ProfileBody = { nickname?: unknown; daily_commit_minutes?: unknown };

export async function patchProfile(c: Context) {
  const user = c.get("user");

  let body: ProfileBody;
  try {
    body = (await c.req.json()) as ProfileBody;
  } catch {
    return c.json({ error: "invalid json" }, 400);
  }

  const patch: { nickname?: string; daily_commit_minutes?: number } = {};
  if (typeof body.nickname === "string") patch.nickname = body.nickname.trim().slice(0, 50);
  if (typeof body.daily_commit_minutes === "number" && Number.isFinite(body.daily_commit_minutes)) {
    patch.daily_commit_minutes = Math.max(1, Math.min(600, Math.round(body.daily_commit_minutes)));
  }
  if (Object.keys(patch).length === 0) {
    return c.json({ error: "nothing to update" }, 400);
  }

  const { data, error } = await getUserClient(c.get("token"))
    .from("profiles")
    .update(patch)
    .eq("id", user.id)
    .select(COLS)
    .maybeSingle();
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ profile: data });
}

// TIP-017 — Kế hoạch tuần (weekly_plans) CRUD. getUserClient (RLS auth.uid()=user_id).
// Mọi ô text tự do; toggle done qua PATCH. KHÔNG đụng playlist.
import type { Context } from "hono";
import { getUserClient } from "../lib/supabase.js";

const COLS = "id, plan_date, video_link, committed_time, done, created_at";
const str = (v: unknown): string => (typeof v === "string" ? v : "");

export async function getWeeklyPlan(c: Context) {
  const user = c.get("user");
  const { data, error } = await getUserClient(c.get("token"))
    .from("weekly_plans")
    .select(COLS)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ items: data ?? [] });
}

export async function postWeeklyPlan(c: Context) {
  const user = c.get("user");
  let body: { plan_date?: unknown; video_link?: unknown; committed_time?: unknown };
  try {
    body = (await c.req.json()) as typeof body;
  } catch {
    return c.json({ error: "invalid json" }, 400);
  }
  const row = {
    user_id: user.id,
    plan_date: str(body.plan_date),
    video_link: str(body.video_link),
    committed_time: str(body.committed_time),
  };
  const { data, error } = await getUserClient(c.get("token"))
    .from("weekly_plans")
    .insert(row)
    .select(COLS)
    .maybeSingle();
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ item: data });
}

export async function patchWeeklyPlan(c: Context) {
  const user = c.get("user");
  const id = c.req.param("id");
  if (!id) return c.json({ error: "missing id" }, 400);
  let body: { plan_date?: unknown; video_link?: unknown; committed_time?: unknown; done?: unknown };
  try {
    body = (await c.req.json()) as typeof body;
  } catch {
    return c.json({ error: "invalid json" }, 400);
  }
  const patch: Record<string, string | boolean> = {};
  if (typeof body.plan_date === "string") patch.plan_date = body.plan_date;
  if (typeof body.video_link === "string") patch.video_link = body.video_link;
  if (typeof body.committed_time === "string") patch.committed_time = body.committed_time;
  if (typeof body.done === "boolean") patch.done = body.done;
  if (Object.keys(patch).length === 0) return c.json({ error: "nothing to update" }, 400);

  const { data, error } = await getUserClient(c.get("token"))
    .from("weekly_plans")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select(COLS)
    .maybeSingle();
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ item: data });
}

export async function deleteWeeklyPlan(c: Context) {
  const user = c.get("user");
  const id = c.req.param("id");
  if (!id) return c.json({ error: "missing id" }, 400);
  const { error, count } = await getUserClient(c.get("token"))
    .from("weekly_plans")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ deleted: (count ?? 0) > 0 });
}

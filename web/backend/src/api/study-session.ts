// TIP-010 — POST /api/study-session (protected): ghi 1 phiên học (delta) từ timer extension.
// study_sessions có started_at/ended_at NOT NULL và RPC nhóm theo started_at (UTC+7),
// nên set ended_at=now(), started_at=now()-duration. Timer chỉ gửi duration_sec (giây).
import type { Context } from "hono";
import { getUserClient } from "../lib/supabase.js";

const MAX_SEC = 3600; // chặn giá trị vô lý / lần flush

export async function postStudySession(c: Context) {
  const user = c.get("user");

  let body: { duration_sec?: unknown };
  try {
    body = (await c.req.json()) as { duration_sec?: unknown };
  } catch {
    return c.json({ error: "invalid json" }, 400);
  }

  const sec = Math.round(Number(body.duration_sec));
  if (!Number.isFinite(sec) || sec <= 0 || sec > MAX_SEC) {
    return c.json({ error: "invalid duration_sec" }, 400);
  }

  const ended = new Date();
  const started = new Date(ended.getTime() - sec * 1000);

  const { error } = await getUserClient(c.get("token"))
    .from("study_sessions")
    .insert({
      user_id: user.id,
      started_at: started.toISOString(),
      ended_at: ended.toISOString(),
      duration_sec: sec,
    });
  if (error) return c.json({ error: error.message }, 500);

  return c.json({ ok: true, duration_sec: sec });
}

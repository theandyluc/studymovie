// TIP-078 — Cache phụ đề Việt (VI) theo video_id, dùng chung giữa mọi user.
// Google (timedtext tlang=vi) thỉnh thoảng chặn anti-bot theo phiên trình duyệt cá nhân.
// Extension vẫn tự fetch từ trình duyệt như cũ; thành công thì POST lên đây để cache lại,
// video sau đó GET trước — có cache thì dùng luôn, không cần gọi Google nữa.
import type { Context } from "hono";
import { getServiceClient } from "../lib/supabase.js";

const MAX_CUES = 20000; // cap an toàn (video cực dài) — tránh payload rác/quá khổ

function isValidVideoId(id: string | undefined): id is string {
  return typeof id === "string" && /^[a-zA-Z0-9_-]{11}$/.test(id);
}

export async function getViCaption(c: Context) {
  const videoId = c.req.param("videoId");
  if (!isValidVideoId(videoId)) return c.json({ error: "invalid videoId" }, 400);

  const { data, error } = await getServiceClient()
    .from("vi_caption_cache")
    .select("vi")
    .eq("video_id", videoId)
    .maybeSingle();
  if (error) return c.json({ error: error.message }, 500);
  if (!data) return c.json({ found: false }, 404);
  return c.json({ found: true, vi: data.vi });
}

export async function postViCaption(c: Context) {
  const videoId = c.req.param("videoId");
  if (!isValidVideoId(videoId)) return c.json({ error: "invalid videoId" }, 400);

  let body: { vi?: unknown };
  try {
    body = (await c.req.json()) as { vi?: unknown };
  } catch {
    return c.json({ error: "invalid json" }, 400);
  }
  if (!Array.isArray(body.vi) || body.vi.length === 0 || body.vi.length > MAX_CUES) {
    return c.json({ error: "invalid vi cues" }, 400);
  }

  // Đã có cache rồi thì thôi (người đến sau không cần ghi đè — tránh ghi lặp vô ích).
  const { data: existed } = await getServiceClient()
    .from("vi_caption_cache")
    .select("video_id")
    .eq("video_id", videoId)
    .maybeSingle();
  if (existed) return c.json({ ok: true, note: "already cached" });

  const { error } = await getServiceClient()
    .from("vi_caption_cache")
    .insert({ video_id: videoId, vi: body.vi, cue_count: body.vi.length });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
}

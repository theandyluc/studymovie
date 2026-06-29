// TIP-011 — Playlist CRUD. Bảng playlist_items(id,user_id,youtube_url,video_id,title,
// thumbnail_url,is_done,sort_order,created_at). Dùng getUserClient (RLS auth.uid()=user_id).
// Tiêu đề lấy qua YouTube oEmbed SERVER-SIDE (miễn phí, không key); lỗi → title tạm.
import type { Context } from "hono";
import { getUserClient } from "../lib/supabase.js";

const COLS = "id, youtube_url, video_id, title, thumbnail_url, is_done, created_at";

// Parse videoId từ các dạng URL YouTube phổ biến.
function parseVideoId(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "");
  let id: string | null = null;
  if (host === "youtu.be") {
    id = u.pathname.slice(1).split("/")[0] || null;
  } else if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else {
      const m = u.pathname.match(/^\/(shorts|embed|live)\/([^/?]+)/);
      if (m) id = m[2];
    }
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

async function fetchTitle(videoId: string): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const watch = `https://www.youtube.com/watch?v=${videoId}`;
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(watch)}&format=json`,
      { signal: ctrl.signal }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: string };
    return typeof data.title === "string" && data.title.trim() ? data.title.trim() : null;
  } catch {
    return null; // timeout/network/lỗi → fallback, KHÔNG chặn
  } finally {
    clearTimeout(timer);
  }
}

export async function getPlaylist(c: Context) {
  const user = c.get("user");
  const { data, error } = await getUserClient(c.get("token"))
    .from("playlist_items")
    .select(COLS)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ items: data ?? [] });
}

export async function postPlaylist(c: Context) {
  const user = c.get("user");
  let body: { url?: unknown };
  try {
    body = (await c.req.json()) as { url?: unknown };
  } catch {
    return c.json({ error: "invalid json" }, 400);
  }
  const url = typeof body.url === "string" ? body.url.trim() : "";
  const videoId = parseVideoId(url);
  if (!videoId) return c.json({ error: "invalid_youtube_url" }, 400);

  const title = (await fetchTitle(videoId)) ?? videoId; // oEmbed lỗi → title tạm = videoId
  const row = {
    user_id: user.id,
    youtube_url: `https://www.youtube.com/watch?v=${videoId}`,
    video_id: videoId,
    title,
    thumbnail_url: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    is_done: false,
  };
  const { data, error } = await getUserClient(c.get("token"))
    .from("playlist_items")
    .insert(row)
    .select(COLS)
    .maybeSingle();
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ item: data });
}

export async function patchPlaylist(c: Context) {
  const user = c.get("user");
  const id = c.req.param("id");
  if (!id) return c.json({ error: "missing id" }, 400);
  let body: { is_done?: unknown };
  try {
    body = (await c.req.json()) as { is_done?: unknown };
  } catch {
    return c.json({ error: "invalid json" }, 400);
  }
  if (typeof body.is_done !== "boolean") return c.json({ error: "is_done phải boolean" }, 400);

  const { data, error } = await getUserClient(c.get("token"))
    .from("playlist_items")
    .update({ is_done: body.is_done })
    .eq("id", id)
    .eq("user_id", user.id)
    .select(COLS)
    .maybeSingle();
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ item: data });
}

export async function deletePlaylist(c: Context) {
  const user = c.get("user");
  const id = c.req.param("id");
  if (!id) return c.json({ error: "missing id" }, 400);
  const { error, count } = await getUserClient(c.get("token"))
    .from("playlist_items")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ deleted: (count ?? 0) > 0 });
}

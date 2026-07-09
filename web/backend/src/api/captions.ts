// TIP-101 — Cache + dịch phụ đề Việt theo video_id, dùng chung giữa mọi user.
// Đảo D-1: KHÔNG còn phụ thuộc YouTube tlang=vi. Tự ghép cụm ASR thành câu (1 lần/video,
// không tốn AI) rồi dịch bằng GPT-4o-mini CHỈ đoạn học viên thực sự xem tới (bám tiến độ
// xem, không dịch trước cả video — tránh tốn phí cho phần không ai xem).
import type { Context } from "hono";
import { waitUntil } from "@vercel/functions";
import { getServiceClient } from "../lib/supabase.js";
import { groupIntoSentences, TRANSLATE_BATCH_SIZE, type RawCue } from "../lib/sentence-group.js";
import { translateBatch } from "../lib/translate-batch.js";

const MAX_CUES = 20000; // cap an toàn (video cực dài) — tránh payload rác/quá khổ
const CONTEXT_SENTENCES = 2; // số câu trước đó gửi kèm làm ngữ cảnh dịch

function isValidVideoId(id: string | undefined): id is string {
  return typeof id === "string" && /^[a-zA-Z0-9_-]{11}$/.test(id);
}

function isValidRawCueArray(v: unknown): v is RawCue[] {
  return (
    Array.isArray(v) &&
    v.every(
      (c) =>
        c &&
        typeof c === "object" &&
        typeof (c as RawCue).start === "number" &&
        typeof (c as RawCue).dur === "number" &&
        typeof (c as RawCue).text === "string"
    )
  );
}

export async function getViCaption(c: Context) {
  const videoId = c.req.param("videoId");
  if (!isValidVideoId(videoId)) return c.json({ error: "invalid videoId" }, 400);

  const { data, error } = await getServiceClient()
    .from("vi_caption_cache")
    .select("en, vi")
    .eq("video_id", videoId)
    .maybeSingle();
  if (error) return c.json({ error: error.message }, 500);
  if (!data) return c.json({ found: false }, 404);
  return c.json({ found: true, en: data.en, vi: data.vi });
}

export async function postCaptionsTranslate(c: Context) {
  const videoId = c.req.param("videoId");
  if (!isValidVideoId(videoId)) return c.json({ error: "invalid videoId" }, 400);

  let body: { fromIndex?: unknown; count?: unknown; en?: unknown };
  try {
    body = (await c.req.json()) as { fromIndex?: unknown; count?: unknown; en?: unknown };
  } catch {
    return c.json({ error: "invalid json" }, 400);
  }
  const fromIndexRaw = Number(body.fromIndex);
  const countRaw = Number(body.count);
  if (!Number.isFinite(fromIndexRaw) || fromIndexRaw < 0) return c.json({ error: "invalid fromIndex" }, 400);
  if (!Number.isFinite(countRaw) || countRaw <= 0) return c.json({ error: "invalid count" }, 400);
  const count = Math.min(countRaw, TRANSLATE_BATCH_SIZE);

  const sb = getServiceClient();
  const { data: existed, error: readErr } = await sb
    .from("vi_caption_cache")
    .select("en, vi")
    .eq("video_id", videoId)
    .maybeSingle();
  if (readErr) return c.json({ error: readErr.message }, 500);

  let grouped: RawCue[];
  let vi: string[];

  if (existed) {
    grouped = existed.en as RawCue[];
    vi = existed.vi as string[];
  } else {
    if (!isValidRawCueArray(body.en) || body.en.length === 0 || body.en.length > MAX_CUES) {
      return c.json({ error: "missing/invalid en (bắt buộc khi video chưa có cache)" }, 400);
    }
    grouped = groupIntoSentences(body.en);
    vi = new Array(grouped.length).fill("") as string[];
    if (grouped.length === 0) {
      waitUntil(
        Promise.resolve(sb.from("vi_caption_cache").insert({ video_id: videoId, en: [], vi: [], cue_count: 0 })).then(
          ({ error }) => {
            if (error) console.warn("[captions-translate] cache lỗi (empty):", error.message);
          }
        )
      );
      return c.json({ en: [], vi: [] });
    }
  }

  const fromIndex = Math.min(fromIndexRaw, grouped.length);
  const toIndex = Math.min(fromIndex + count, grouped.length);
  const targets: number[] = [];
  for (let i = fromIndex; i < toIndex; i++) {
    if (vi[i] === "") targets.push(i);
  }

  if (targets.length > 0) {
    const contextStart = Math.max(0, fromIndex - CONTEXT_SENTENCES);
    const context = [];
    for (let i = contextStart; i < fromIndex; i++) {
      if (vi[i]) context.push({ en: grouped[i].text, vi: vi[i] });
    }
    const translated = await translateBatch(
      targets.map((i) => grouped[i].text),
      context
    );
    if (translated) {
      targets.forEach((i, k) => {
        vi[i] = translated[k] ?? "";
      });
    }

    // Ghi cache chạy nền (waitUntil) — không chặn response, nhưng đảm bảo ghi xong trên
    // serverless (khác "void promise" thường, không có gì đảm bảo chạy hết sau khi trả response).
    waitUntil(
      Promise.resolve(
        sb
          .from("vi_caption_cache")
          .upsert({ video_id: videoId, en: grouped, vi, cue_count: grouped.length }, { onConflict: "video_id" })
      ).then(({ error }) => {
        if (error) console.warn("[captions-translate] cache lỗi:", error.message);
      })
    );
  }

  return c.json({ en: grouped, vi });
}

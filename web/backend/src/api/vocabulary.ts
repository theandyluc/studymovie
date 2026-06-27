// TIP-005 — POST /api/vocabulary (protected): lưu từ cho user hiện tại.
// Idempotent theo UNIQUE(user_id, word): trùng -> không tạo mới, không lỗi.
import type { Context } from "hono";
import { getServiceClient } from "../lib/supabase.js";

type VocabBody = {
  word?: string;
  lemma?: string | null;
  ipa?: string | null;
  meaning_vi?: string | null;
  example?: string | null;
  audio_url?: string | null;
};

export async function postVocabulary(c: Context) {
  const user = c.get("user");

  let body: VocabBody;
  try {
    body = (await c.req.json()) as VocabBody;
  } catch {
    return c.json({ error: "invalid json" }, 400);
  }

  const word = (body.word ?? "").trim();
  if (!word) return c.json({ error: "missing word" }, 400);

  const row = {
    user_id: user.id,
    word,
    lemma: body.lemma ?? null,
    ipa: body.ipa ?? null,
    meaning_vi: body.meaning_vi ?? null,
    example: body.example ?? null,
    audio_url: body.audio_url ?? null,
  };

  const { data, error } = await getServiceClient()
    .from("vocabulary")
    .upsert(row, { onConflict: "user_id,word", ignoreDuplicates: true })
    .select()
    .maybeSingle();

  if (error) return c.json({ error: error.message }, 500);

  // ignoreDuplicates: nếu đã có -> không insert -> data null.
  return c.json({ saved: true, duplicate: data === null, item: data });
}

// TIP-006 — GET /api/vocabulary: danh sách từ của user (mới nhất trước).
export async function getVocabulary(c: Context) {
  const user = c.get("user");
  const { data, error } = await getServiceClient()
    .from("vocabulary")
    .select("id, word, lemma, ipa, meaning_vi, example, audio_url, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ items: data ?? [] });
}

// TIP-006 — DELETE /api/vocabulary/:id: chỉ xóa từ của chính user.
export async function deleteVocabulary(c: Context) {
  const user = c.get("user");
  const id = c.req.param("id");
  if (!id) return c.json({ error: "missing id" }, 400);

  const { error, count } = await getServiceClient()
    .from("vocabulary")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("user_id", user.id); // chốt chặn: không xóa được của user khác
  if (error) return c.json({ error: error.message }, 500);

  return c.json({ deleted: (count ?? 0) > 0 });
}

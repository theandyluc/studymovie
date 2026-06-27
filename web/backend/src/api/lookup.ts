// TIP-005 — GET /api/lookup?word= (protected): tra nghĩa qua RPC lookup_word
// (lemmatize + tra bảng dictionary). D-2: tra từ điển, KHÔNG dịch máy.
import type { Context } from "hono";
import { getServiceClient } from "../lib/supabase.js";

export async function getLookup(c: Context) {
  const word = (c.req.query("word") ?? "").trim();
  if (!word) return c.json({ error: "missing word" }, 400);

  const { data, error } = await getServiceClient().rpc("lookup_word", { p_word: word });
  if (error) return c.json({ error: error.message }, 500);

  // data = { lemma, ipa, meanings, audio_url } hoặc null nếu không tìm thấy.
  return c.json({ word, result: data ?? null });
}

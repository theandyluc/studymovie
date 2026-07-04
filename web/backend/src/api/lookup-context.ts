// TIP-038 — POST /api/lookup-context {word, sentence} (protected).
// Trả nghĩa VN NGẮN GỌN của `word` TRONG câu `sentence` bằng OpenAI gpt-4o-mini.
// Luồng: cache (bảng ai_context_meaning) → OpenAI → upsert cache.
// Fallback an toàn: thiếu key / thiếu câu / lỗi / timeout → { source: "fallback" }
//   (client tự dùng nghĩa từ điển của /api/lookup — KHÔNG vỡ UX). IPA/audio do /api/lookup lo.
import type { Context } from "hono";
import { getServiceClient } from "../lib/supabase.js";
import { OPENAI_API_KEY, OPENAI_MODEL } from "../env.js";

const MAX_SENTENCE = 500; // cắt câu để làm khoá cache (tránh vượt giới hạn index)

async function askOpenAI(word: string, sentence: string): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    // TIP-071 — dựng body theo model: GPT-5 (nano/mini) không nhận temperature/max_tokens;
    // dùng max_completion_tokens + reasoning_effort. gpt-4o-mini giữ temperature 0.
    const isGpt5 = /^gpt-5/.test(OPENAI_MODEL);
    const reqBody: Record<string, unknown> = {
      model: OPENAI_MODEL,
      max_completion_tokens: 256, // thay max_tokens (GPT-5 bắt buộc); output ngắn nên không tốn thêm
      messages: [
        {
          role: "system",
          content:
            "Bạn là từ điển Anh-Việt. Cho một CÂU tiếng Anh và một TỪ trong câu, trả về DUY NHẤT một " +
            "nghĩa tiếng Việt NGẮN GỌN (1–3 từ) của từ đó, ĐÚNG ngữ cảnh câu. QUY TẮC BẮT BUỘC: chỉ MỘT " +
            "nghĩa (không đưa lựa chọn thay thế), KHÔNG dùng dấu '/', KHÔNG liệt kê, KHÔNG giải thích, " +
            "KHÔNG dấu ngoặc/tiền tố, KHÔNG viết hoa (trừ danh từ riêng). Nếu từ đa nghĩa, chọn nghĩa " +
            "phù hợp nhất ngữ cảnh. Chỉ trả nghĩa.",
        },
        {
          role: "user",
          content: `Câu: "${sentence}"\nTừ: "${word}"\nNghĩa tiếng Việt ngắn gọn của "${word}" trong câu trên:`,
        },
      ],
    };
    if (isGpt5) reqBody.reasoning_effort = "minimal"; // GPT-5: nhanh + rẻ
    else reqBody.temperature = 0; // 4o-mini: deterministic
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify(reqBody),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const txt = j.choices?.[0]?.message?.content?.trim();
    return txt && txt.length > 0 ? txt.replace(/^["'.\s]+|["'.\s]+$/g, "") : null;
  } catch {
    return null; // timeout / network
  } finally {
    clearTimeout(timer);
  }
}

export async function postLookupContext(c: Context) {
  const body = (await c.req.json().catch(() => ({}))) as { word?: unknown; sentence?: unknown };
  const word = String(body.word ?? "").trim();
  const sentence = String(body.sentence ?? "").trim().slice(0, MAX_SENTENCE);
  if (!word) return c.json({ error: "missing word" }, 400);
  // Thiếu câu hoặc chưa cấu hình key → fallback (client dùng nghĩa từ điển).
  if (!sentence || !OPENAI_API_KEY) return c.json({ source: "fallback" });

  const lw = word.toLowerCase();
  const sb = getServiceClient();

  // 1) Cache
  const { data: cached } = await sb
    .from("ai_context_meaning")
    .select("meaning_vi")
    .eq("word", lw)
    .eq("sentence", sentence)
    .maybeSingle();
  if (cached?.meaning_vi) return c.json({ word, meaning_vi: cached.meaning_vi, source: "ai-cache" });

  // 2) OpenAI
  const meaning = await askOpenAI(word, sentence);
  if (!meaning) return c.json({ source: "fallback" });

  // 3) Upsert cache (lỗi cache không chặn trả kết quả)
  const { error } = await sb
    .from("ai_context_meaning")
    .upsert({ word: lw, sentence, meaning_vi: meaning }, { onConflict: "word,sentence" });
  if (error) console.warn("[lookup-context] cache lỗi:", error.message);

  return c.json({ word, meaning_vi: meaning, source: "ai" });
}

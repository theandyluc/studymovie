// TIP-101 — Dịch 1 lô câu tiếng Anh sang tiếng Việt bằng OpenAI (structured JSON output).
// Mẫu request giống lookup-context.ts (fetch + AbortController + timeout an toàn).
import { OPENAI_API_KEY, OPENAI_MODEL } from "../env.js";

const TIMEOUT_MS = 20_000;

export interface TranslateContext {
  en: string;
  vi: string;
}

// Trả về null khi lỗi/timeout — gọi nơi khác coi là "chưa dịch được", không vỡ luồng chính.
export async function translateBatch(sentences: string[], context: TranslateContext[] = []): Promise<string[] | null> {
  if (sentences.length === 0) return [];
  if (!OPENAI_API_KEY) return null;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const isGpt5 = /^gpt-5/.test(OPENAI_MODEL);
    const contextBlock =
      context.length > 0
        ? "Ngữ cảnh câu TRƯỚC ĐÓ (CHỈ để hiểu mạch chuyện — đại từ, nhân vật — KHÔNG dịch lại):\n" +
          context.map((c) => `EN: ${c.en}\nVI: ${c.vi}`).join("\n") +
          "\n\n"
        : "";
    const reqBody: Record<string, unknown> = {
      model: OPENAI_MODEL,
      max_completion_tokens: Math.max(512, sentences.length * 60),
      messages: [
        {
          role: "system",
          content:
            "Bạn là dịch giả Anh-Việt chuyên phụ đề phim/video. Dịch các câu tiếng Anh sau sang tiếng " +
            "Việt tự nhiên, đúng văn phong HỘI THOẠI đời thường (không dịch máy móc/quá trang trọng). " +
            "QUY TẮC BẮT BUỘC: 1) Trả về ĐÚNG số lượng bản dịch bằng số câu đầu vào (mảng translations), " +
            "THEO ĐÚNG THỨ TỰ. 2) Mỗi phần tử translations[i] là bản dịch của sentences[i] tương ứng, " +
            "KHÔNG gộp/tách câu. 3) Giữ ý nghĩa, ngữ cảnh, mức độ trang trọng/thô tục sát với câu gốc " +
            "(đây là phụ đề video thật). 4) KHÔNG thêm chú thích, KHÔNG thêm số thứ tự, KHÔNG thêm dấu " +
            "ngoặc giải thích.",
        },
        {
          role: "user",
          content: `${contextBlock}Câu cần dịch:\n${JSON.stringify({ sentences })}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "vi_translations",
          strict: true,
          schema: {
            type: "object",
            properties: { translations: { type: "array", items: { type: "string" } } },
            required: ["translations"],
            additionalProperties: false,
          },
        },
      },
    };
    if (isGpt5) reqBody.reasoning_effort = "minimal";
    else reqBody.temperature = 0;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify(reqBody),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = j.choices?.[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { translations?: unknown };
    if (!Array.isArray(parsed.translations) || parsed.translations.length !== sentences.length) return null;
    return parsed.translations.map((t) => (typeof t === "string" ? t.trim() : ""));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

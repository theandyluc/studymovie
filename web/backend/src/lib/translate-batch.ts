// TIP-101 — Dịch 1 lô câu tiếng Anh sang tiếng Việt bằng OpenAI.
// Mẫu request giống lookup-context.ts (fetch + AbortController + timeout an toàn).
// LƯU Ý: dùng response_format "json_object" (JSON mode nhẹ, đã ổn định lâu) thay vì
// "json_schema"+strict — thử strict mode trước nhưng bị chậm bất thường (hay vượt timeout,
// xem log Vercel "This operation was aborted") + đôi lúc lệch số lượng phần tử trả về.
import { OPENAI_API_KEY, OPENAI_MODEL } from "../env.js";

const TIMEOUT_MS = 22_000;

export interface TranslateContext {
  en: string;
  vi: string;
}

// Trả về null khi lỗi/timeout — gọi nơi khác coi là "chưa dịch được", không vỡ luồng chính.
// TIP-101 — lô lớn thất bại (lệch số lượng/parse lỗi) → tự chia đôi, dịch riêng từng nửa
// (đệ quy) thay vì bỏ trắng CẢ lô — tránh 1 đoạn khó dịch chặn đứng cả cửa sổ đệm phía sau.
export async function translateBatch(sentences: string[], context: TranslateContext[] = []): Promise<string[] | null> {
  if (sentences.length === 0) return [];
  const direct = await callOpenAI(sentences, context);
  if (direct) return direct;
  if (sentences.length <= 3) return null; // đã đủ nhỏ, hết cách chia tiếp

  const mid = Math.ceil(sentences.length / 2);
  const [r1, r2] = await Promise.all([
    translateBatch(sentences.slice(0, mid), context),
    translateBatch(sentences.slice(mid), context),
  ]);
  if (!r1 && !r2) return null;
  return [...(r1 ?? sentences.slice(0, mid).map(() => "")), ...(r2 ?? sentences.slice(mid).map(() => ""))];
}

async function callOpenAI(sentences: string[], context: TranslateContext[]): Promise<string[] | null> {
  if (!OPENAI_API_KEY) {
    console.warn("[translate-batch] thiếu OPENAI_API_KEY");
    return null;
  }

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
            "QUY TẮC BẮT BUỘC: 1) Trả lời DUY NHẤT bằng JSON hợp lệ, dạng " +
            '{"translations": ["...", "...", ...]}. 2) Mảng translations phải có ĐÚNG số phần tử ' +
            "bằng số câu đầu vào, THEO ĐÚNG THỨ TỰ — đây là điều QUAN TRỌNG NHẤT, đếm lại số câu đầu " +
            "vào trước khi trả lời. 3) translations[i] là bản dịch của sentences[i] tương ứng, KHÔNG " +
            "gộp/tách câu. 4) Giữ ý nghĩa, ngữ cảnh, mức độ trang trọng/thô tục sát với câu gốc (đây " +
            "là phụ đề video thật). 5) KHÔNG thêm chú thích, KHÔNG thêm số thứ tự, KHÔNG thêm dấu " +
            "ngoặc giải thích trong mỗi bản dịch.",
        },
        {
          role: "user",
          content: `${contextBlock}Câu cần dịch (JSON, ${sentences.length} câu):\n${JSON.stringify({ sentences })}`,
        },
      ],
      response_format: { type: "json_object" },
    };
    if (isGpt5) reqBody.reasoning_effort = "minimal";
    else reqBody.temperature = 0;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify(reqBody),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn("[translate-batch] OpenAI lỗi", res.status, body.slice(0, 500));
      return null;
    }
    const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = j.choices?.[0]?.message?.content;
    if (!raw) {
      console.warn("[translate-batch] response rỗng", JSON.stringify(j).slice(0, 500));
      return null;
    }
    let parsed: { translations?: unknown };
    try {
      parsed = JSON.parse(raw) as { translations?: unknown };
    } catch (e) {
      console.warn("[translate-batch] JSON.parse lỗi:", (e as Error).message, "raw:", raw.slice(0, 500));
      return null;
    }
    if (!Array.isArray(parsed.translations) || parsed.translations.length !== sentences.length) {
      console.warn(
        "[translate-batch] số lượng lệch: input",
        sentences.length,
        "output",
        Array.isArray(parsed.translations) ? parsed.translations.length : typeof parsed.translations,
        "raw:",
        raw.slice(0, 800)
      );
      return null;
    }
    return parsed.translations.map((t) => (typeof t === "string" ? t.trim() : ""));
  } catch (e) {
    console.warn("[translate-batch] exception:", (e as Error).message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// TIP-101 — Dịch câu tiếng Anh sang tiếng Việt bằng OpenAI.
// LƯU Ý QUAN TRỌNG: dịch TỪNG CÂU MỘT (gọi SONG SONG, không phải nối tiếp), KHÔNG bắt AI trả
// về 1 mảng nhiều câu cùng lúc. Đã thử cách "1 lô nhiều câu -> 1 mảng JSON" (structured output
// rồi tới json_object) nhưng model RẤT HAY tự ý gộp nhiều câu input thành 1 câu dịch dù đã dặn
// rõ "giữ đúng số lượng, không gộp" — log Vercel cho thấy lỗi này xảy ra ở GẦN NHƯ MỌI lô dịch,
// không phải hiếm gặp. Dịch từng câu riêng loại bỏ hẳn lớp lỗi "đếm/gộp sai" vì không còn khái
// niệm mảng nhiều phần tử phải khớp số lượng nữa — mỗi câu là 1 lần gọi độc lập, kết quả là
// chính bản dịch của câu đó (text thuần, giống mẫu lookup-context.ts đã chạy ổn định).
// Gọi SONG SONG (Promise.all) để không cộng dồn độ trễ — tốc độ tổng ~ 1 lần gọi chậm nhất,
// không phải tổng thời gian của từng câu.
import { OPENAI_API_KEY, OPENAI_MODEL } from "../env.js";

const TIMEOUT_MS = 12_000;

export interface TranslateContext {
  en: string;
  vi: string;
}

async function translateOne(sentence: string, context: TranslateContext[]): Promise<string | null> {
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
      max_completion_tokens: 200,
      messages: [
        {
          role: "system",
          content:
            "Bạn là dịch giả Anh-Việt chuyên phụ đề phim/video. Dịch câu tiếng Anh sau sang tiếng Việt " +
            "tự nhiên, đúng văn phong HỘI THOẠI đời thường (không dịch máy móc/quá trang trọng). Giữ " +
            "ý nghĩa, ngữ cảnh, mức độ trang trọng/thô tục sát với câu gốc (đây là phụ đề video thật). " +
            "CHỈ trả lời DUY NHẤT bản dịch của câu đó, KHÔNG thêm chú thích, KHÔNG lặp lại câu gốc, " +
            "KHÔNG thêm dấu ngoặc giải thích.",
        },
        {
          role: "user",
          content: `${contextBlock}Câu cần dịch:\n"${sentence}"\nBản dịch tiếng Việt:`,
        },
      ],
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
      console.warn("[translate-batch] OpenAI lỗi", res.status, body.slice(0, 300));
      return null;
    }
    const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const txt = j.choices?.[0]?.message?.content?.trim();
    return txt && txt.length > 0 ? txt.replace(/^["'\s]+|["'\s]+$/g, "") : null;
  } catch (e) {
    console.warn("[translate-batch] exception:", (e as Error).message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Trả về null CHỈ KHI TẤT CẢ câu đều thất bại — thất bại từng câu riêng lẻ (mạng/timeout) chỉ
// làm câu đó = "" (gọi nơi khác coi là "chưa dịch được câu này", không vỡ cả lô).
export async function translateBatch(sentences: string[], context: TranslateContext[] = []): Promise<string[] | null> {
  if (sentences.length === 0) return [];
  const results = await Promise.all(sentences.map((s) => translateOne(s, context)));
  if (results.every((r) => r === null)) return null;
  return results.map((r) => r ?? "");
}

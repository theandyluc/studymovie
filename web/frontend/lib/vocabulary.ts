/* ============================================================
   GIẢI THÍCH CHO KHÁCH — File: lib/vocabulary.ts
   ------------------------------------------------------------
   Trung tâm xử lý TỪ VỰNG của người dùng:
   - fetchVocab / addVocab / deleteVocab: lấy, thêm, xoá từ.
   - markLearned: đánh dấu một số từ là "đã học".
   - firstIpa: một từ có thể có nhiều cách phiên âm; hàm này lấy
     cách đọc đầu tiên cho gọn để hiển thị.
   - buildQuiz + quizableItems: tạo bộ câu hỏi trắc nghiệm 4 đáp án
     từ chính danh sách từ của người dùng (dùng cho phần Kiểm tra).
   - STUDY_SELECTION_KEY: "chìa khoá" để nhớ các từ người dùng chọn
     ở trang Từ vựng rồi mang sang trang Học/Flashcard.

   Lưu ý: các phần "interface" chỉ mô tả dữ liệu có những trường gì.
   ============================================================ */
// TIP-006 — Logic vocabulary (tách khỏi presentation để reskin theo Figma sau).
import { apiFetch } from "./apiClient";

export interface VocabItem {
  id: string;
  word: string;
  lemma: string | null;
  ipa: string | null;
  meaning_vi: string | null;
  example: string | null;
  audio_url: string | null;
  learned_at: string | null; // TIP-024: null = "Từ mới"; có giá trị = "Đã học"
  created_at: string;
}

// TIP-039 — Chuẩn hoá về 1 phiên âm: nhiều biến thể FVDP ngăn bằng "," / ";" (vd "ænd, ənd, ən").
// Lấy cái đầu (ưu tiên UK — FVDP đã thiên Anh-Anh), bỏ dấu "/" thừa. Trả null nếu rỗng.
export function firstIpa(ipa: string | null | undefined): string | null {
  if (!ipa) return null;
  const first = ipa.replace(/\//g, "").split(/[,;]/)[0].trim();
  return first || null;
}

export async function fetchVocab(): Promise<VocabItem[]> {
  const { items } = await apiFetch<{ items: VocabItem[] }>("/api/vocabulary");
  return items;
}

// TIP-024/TIP-081 — thêm từ thủ công từ web ({word, meaning_vi}). Idempotent: trùng → duplicate=true.
// TIP-081 — BUG FIX: trước đây chỉ gửi {word, meaning_vi} lên /api/vocabulary → backend lưu
// ipa=null (nó KHÔNG tự tra từ điển, xem web/backend/src/api/vocabulary.ts). Extension có phiên âm
// vì gọi RIÊNG /api/lookup khi bắt từ từ video; web thêm tay lại bỏ qua bước này. Giờ gọi
// /api/lookup trước để lấy ipa/audio_url thật (từ điển FVDP hoặc Free Dictionary API — KHÔNG phải
// AI), rồi mới POST kèm theo. Lookup lỗi/không tìm thấy → vẫn lưu bình thường, chỉ là ipa=null.
export async function addVocab(
  word: string,
  meaning_vi: string
): Promise<{ saved: boolean; duplicate: boolean; item: VocabItem | null }> {
  let ipa: string | null = null;
  let audio_url: string | null = null;
  try {
    const lookup = await apiFetch<{ result: { ipa: string | null; audio_url: string | null } | null }>(
      `/api/lookup?word=${encodeURIComponent(word)}`
    );
    ipa = lookup.result?.ipa ?? null;
    audio_url = lookup.result?.audio_url ?? null;
  } catch {
    /* tra từ điển thất bại (rate-limit/network/không tìm thấy) → vẫn lưu từ, chỉ thiếu phiên âm */
  }
  return apiFetch("/api/vocabulary", {
    method: "POST",
    body: JSON.stringify({ word, meaning_vi, ipa, audio_url }),
  });
}

export async function deleteVocab(id: string): Promise<boolean> {
  const { deleted } = await apiFetch<{ deleted: boolean }>(`/api/vocabulary/${id}`, { method: "DELETE" });
  return deleted;
}

// TIP-026 — đánh dấu các từ đã học (learned_at=now), idempotent (chỉ set khi null). Trả số cập nhật.
export async function markLearned(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const { updated } = await apiFetch<{ updated: number }>("/api/vocabulary/mark-learned", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
  return updated;
}

// TIP-026 — selection truyền giữa /tu-vung → /hoc-tu-vung qua sessionStorage.
export const STUDY_SELECTION_KEY = "sm-study-selection";

export type QuizDirection = "en2vi" | "vi2en";

export interface QuizQuestion {
  id: string;
  prompt: string;
  // TIP-081 — phiên âm của prompt (chỉ có khi prompt là từ tiếng Anh, chiều en2vi); vi2en → null.
  ipa: string | null;
  options: string[];
  answerIndex: number;
}

export const MAX_QUIZ = 20;

// (Giải thích) Hàm "xáo bài": trộn ngẫu nhiên thứ tự một danh sách,
// dùng để đảo thứ tự câu hỏi và các đáp án cho mỗi lần làm quiz.
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Chỉ dùng từ có cả word + meaning_vi cho quiz (đáp án cần 2 chiều).
export function quizableItems(items: VocabItem[]): VocabItem[] {
  return items.filter((i) => i.word.trim() && (i.meaning_vi ?? "").trim());
}

// (Giải thích) Cách tạo đề trắc nghiệm:
//   • Mỗi từ được hỏi 1 lần (tối đa 20 câu).
//   • Mỗi câu có 4 lựa chọn: 1 đáp án đúng + 3 đáp án sai lấy ngẫu
//     nhiên từ các từ khác của chính người dùng.
//   • "dir" quyết định chiều hỏi: Anh→Việt (hiện từ, chọn nghĩa)
//     hoặc Việt→Anh (hiện nghĩa, chọn từ).
// TIP-073 — `askItems` (tuỳ chọn): CHỈ hỏi các từ này (vd selection người dùng chọn);
//   ĐÁP ÁN NHIỄU vẫn lấy từ toàn kho `items`. Bỏ trống → hỏi toàn bộ như cũ (tương thích ngược).
export function buildQuiz(items: VocabItem[], dir: QuizDirection, askItems?: VocabItem[]): QuizQuestion[] {
  const pool = quizableItems(items); // kho cho đáp án nhiễu
  const asked = askItems ? quizableItems(askItems) : pool; // câu hỏi
  const valOf = (it: VocabItem): string => (dir === "en2vi" ? (it.meaning_vi ?? "") : it.word);
  const promptOf = (it: VocabItem): string => (dir === "en2vi" ? it.word : (it.meaning_vi ?? ""));

  return shuffle(asked)
    .slice(0, MAX_QUIZ)
    .map((it) => {
      const correct = valOf(it);
      const distractors: string[] = [];
      for (const o of shuffle(pool)) {
        if (o.id === it.id) continue;
        const v = valOf(o);
        if (v !== correct && !distractors.includes(v)) distractors.push(v);
        if (distractors.length === 3) break;
      }
      const options = shuffle([correct, ...distractors]);
      return {
        id: it.id,
        prompt: promptOf(it),
        ipa: dir === "en2vi" ? it.ipa : null,
        options,
        answerIndex: options.indexOf(correct),
      };
    });
}

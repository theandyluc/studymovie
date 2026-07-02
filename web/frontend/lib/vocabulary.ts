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

// TIP-024 — thêm từ thủ công từ web ({word, meaning_vi}). Idempotent: trùng → duplicate=true.
export async function addVocab(
  word: string,
  meaning_vi: string
): Promise<{ saved: boolean; duplicate: boolean; item: VocabItem | null }> {
  return apiFetch("/api/vocabulary", {
    method: "POST",
    body: JSON.stringify({ word, meaning_vi }),
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
  options: string[];
  answerIndex: number;
}

export const MAX_QUIZ = 20;

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

// Tạo bộ câu hỏi: mỗi từ hỏi 1 lần, 4 đáp án = 1 đúng + 3 sai random từ chính vocab user.
export function buildQuiz(items: VocabItem[], dir: QuizDirection): QuizQuestion[] {
  const pool = quizableItems(items);
  const valOf = (it: VocabItem): string => (dir === "en2vi" ? (it.meaning_vi ?? "") : it.word);
  const promptOf = (it: VocabItem): string => (dir === "en2vi" ? it.word : (it.meaning_vi ?? ""));

  return shuffle(pool)
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
      return { id: it.id, prompt: promptOf(it), options, answerIndex: options.indexOf(correct) };
    });
}

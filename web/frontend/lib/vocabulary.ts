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
  created_at: string;
}

export async function fetchVocab(): Promise<VocabItem[]> {
  const { items } = await apiFetch<{ items: VocabItem[] }>("/api/vocabulary");
  return items;
}

export async function deleteVocab(id: string): Promise<boolean> {
  const { deleted } = await apiFetch<{ deleted: boolean }>(`/api/vocabulary/${id}`, { method: "DELETE" });
  return deleted;
}

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

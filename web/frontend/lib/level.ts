// TIP-016 — Level system (CEFR). Gọi backend /api/level (qua apiFetch → getUserClient RPC).
import { apiFetch } from "./apiClient";

export const LEVELS = ["A0", "A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type Level = (typeof LEVELS)[number];

export interface LevelProgress {
  needs_input?: boolean;
  is_max?: boolean;
  current_level?: Level;
  target_level?: Level;
  target_hours?: number;
  studied_hours?: number;
  remaining_hours?: number;
  percent?: number;
  just_leveled_up?: boolean;
  old_level?: Level | null;
  new_level?: Level | null;
}

export const fetchLevel = (): Promise<LevelProgress> => apiFetch<LevelProgress>("/api/level");

export const setLevel = (level: Level | string): Promise<{ ok: boolean }> =>
  apiFetch<{ ok: boolean }>("/api/level", { method: "POST", body: JSON.stringify({ level }) });

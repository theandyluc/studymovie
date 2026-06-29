// TIP-017 — Kế hoạch tuần (weekly_plans). Gọi backend /api/weekly-plan (getUserClient + RLS).
import { apiFetch } from "./apiClient";

export interface WeeklyPlan {
  id: string;
  plan_date: string | null;
  video_link: string | null;
  committed_time: string | null;
  done: boolean;
  created_at: string;
}

export interface PlanInput {
  plan_date: string;
  video_link: string;
  committed_time: string;
}

export const fetchWeeklyPlan = (): Promise<WeeklyPlan[]> =>
  apiFetch<{ items: WeeklyPlan[] }>("/api/weekly-plan").then((r) => r.items);

export const addWeeklyPlan = (input: PlanInput): Promise<WeeklyPlan> =>
  apiFetch<{ item: WeeklyPlan }>("/api/weekly-plan", {
    method: "POST",
    body: JSON.stringify(input),
  }).then((r) => r.item);

export const updateWeeklyPlan = (
  id: string,
  patch: Partial<PlanInput & { done: boolean }>
): Promise<WeeklyPlan> =>
  apiFetch<{ item: WeeklyPlan }>(`/api/weekly-plan/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  }).then((r) => r.item);

export const deleteWeeklyPlan = (id: string): Promise<boolean> =>
  apiFetch<{ deleted: boolean }>(`/api/weekly-plan/${id}`, { method: "DELETE" }).then((r) => r.deleted);

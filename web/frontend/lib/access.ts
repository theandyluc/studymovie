// TIP-019b — Access status (trial 24h + paid). Gọi backend /api/access-status.
import { apiFetch } from "./apiClient";

export interface AccessStatus {
  has_access: boolean;
  reason: "paid" | "trial" | "expired";
  trial_expires_at: string | null;
  paid_until: string | null;
}

export const fetchAccessStatus = (): Promise<AccessStatus> =>
  apiFetch<AccessStatus>("/api/access-status");

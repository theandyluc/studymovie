/* ============================================================
   GIẢI THÍCH CHO KHÁCH — File: lib/access.ts
   ------------------------------------------------------------
   File này hỏi máy chủ: "Người dùng này còn được vào học không?"
   Câu trả lời gồm:
   - has_access: còn quyền vào học hay không (đúng/sai).
   - reason: lý do — "paid" (đã trả tiền), "trial" (đang dùng thử
     miễn phí 24 giờ), hoặc "expired" (đã hết hạn).
   - thời điểm hết hạn dùng thử / hết hạn gói đã mua.

   Kết quả này dùng để chặn các trang học khi người dùng hết hạn.
   ============================================================ */
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

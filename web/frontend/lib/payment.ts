/* ============================================================
   GIẢI THÍCH CHO KHÁCH — File: lib/payment.ts
   ------------------------------------------------------------
   Xử lý việc MUA GÓI PRO bằng chuyển khoản qua mã QR (VietQR):
   - createOrder: tạo một đơn hàng mới, máy chủ trả về mã đơn, số
     tiền, ảnh mã QR và nội dung chuyển khoản.
   - fetchOrderStatus: hỏi máy chủ xem đơn đã được thanh toán chưa
     ("pending" = đang chờ, "paid" = đã trả, "expired" = hết hạn).

   Trang thanh toán sẽ gọi fetchOrderStatus lặp lại vài giây/lần để
   tự nhận biết khi tiền đã tới, không cần người dùng bấm gì.
   ============================================================ */
// TIP-013 — Logic thanh toán Pro (VietQR + poll trạng thái đơn).
import { apiFetch } from "./apiClient";

export interface PaymentOrder {
  code: string;
  amount: number;
  qr_url: string;
  bank: { bank_id: string; account_no: string; account_name: string };
  content: string;
}

export interface OrderStatus {
  code: string;
  amount: number;
  status: "pending" | "paid" | "expired";
  paid_at: string | null;
}

export const createOrder = (): Promise<PaymentOrder> =>
  apiFetch<PaymentOrder>("/api/payment/create-order", { method: "POST" });

export const fetchOrderStatus = (code: string): Promise<OrderStatus> =>
  apiFetch<OrderStatus>(`/api/payment/order/${encodeURIComponent(code)}`);

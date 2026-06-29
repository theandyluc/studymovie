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

/* ============================================================
   GIẢI THÍCH CHO KHÁCH — File: lib/admin.ts
   ------------------------------------------------------------
   Các thao tác dành riêng cho TRANG QUẢN TRỊ (admin):
   - fetchAdminStats: thống kê tổng số người dùng, số người đã mua
     Pro, tổng doanh thu.
   - fetchAdminUsers: danh sách toàn bộ người dùng.
   - setProPrice: đặt giá gói Pro.
   - grantPro: tặng/kích hoạt Pro cho một người dùng trong X ngày.
   - setUserAdmin: cấp hoặc thu quyền admin cho một người dùng.

   Máy chủ luôn tự kiểm tra người gọi có đúng là admin không, nên
   người thường có mở link này cũng không dùng được (bị chặn ở máy chủ).
   ============================================================ */
// TIP-020 — Admin API (backend /api/admin/*; RPC fail-closed is_caller_admin).
import { apiFetch } from "./apiClient";

export interface AdminStats {
  total_users: number;
  pro_users: number;
  revenue: number;
  daily_new_users: { date: string; count: number }[]; // TIP-097 — 7 ngày gần nhất
}

export interface AdminUser {
  id: string;
  email: string | null;
  created_at: string;
  status: "paid" | "trial" | "expired";
  paid_until: string | null;
  is_admin: boolean;
}

export const fetchAdminStats = (): Promise<AdminStats> => apiFetch<AdminStats>("/api/admin/stats");
export const fetchAdminUsers = (): Promise<AdminUser[]> => apiFetch<AdminUser[]>("/api/admin/users");

export const setProPrice = (price: number): Promise<{ ok: boolean }> =>
  apiFetch("/api/admin/price", { method: "POST", body: JSON.stringify({ price }) });

export const grantPro = (user_id: string, days: number): Promise<{ ok: boolean }> =>
  apiFetch("/api/admin/grant-pro", { method: "POST", body: JSON.stringify({ user_id, days }) });

export const setUserAdmin = (user_id: string, is_admin: boolean): Promise<{ ok: boolean }> =>
  apiFetch("/api/admin/set-admin", { method: "POST", body: JSON.stringify({ user_id, is_admin }) });

// TIP-096 — tạo/xoá tài khoản thủ công (Admin Auth API qua backend, service_role chỉ ở server).
export const createAccount = (email: string, password: string): Promise<{ ok: boolean; user_id?: string }> =>
  apiFetch("/api/admin/create-user", { method: "POST", body: JSON.stringify({ email, password }) });

export const deleteAccount = (user_id: string): Promise<{ ok: boolean }> =>
  apiFetch(`/api/admin/users/${encodeURIComponent(user_id)}`, { method: "DELETE" });

// TIP-100 — mật khẩu phụ vào trang /admin (so khớp ở backend, không lộ giá trị thật ở client).
export const verifyAdminPagePassword = (password: string): Promise<{ ok: boolean }> =>
  apiFetch("/api/admin/verify-page-password", { method: "POST", body: JSON.stringify({ password }) });

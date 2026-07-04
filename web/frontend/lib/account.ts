/* ============================================================
   GIẢI THÍCH CHO KHÁCH — File: lib/account.ts
   ------------------------------------------------------------
   File này gom mọi thao tác liên quan đến TÀI KHOẢN và số liệu
   học tập của người dùng, gồm:
   - fetchDashboard: lấy số liệu trang "Tiến độ học" (streak, số
     phút học hôm nay, biểu đồ tuần/tháng, tổng từ đã học...).
   - fetchLeaderboard: lấy bảng xếp hạng (tuần / tháng / toàn thời gian).
   - fetchMe: lấy thông tin người đang đăng nhập (email, có phải
     admin không, tình trạng gói).
   - fetchProfile / updateProfile: xem và sửa hồ sơ (biệt danh,
     số phút cam kết học mỗi ngày).
   - subscriptionText: đổi tình trạng gói thành câu chữ dễ đọc
     (ví dụ "Dùng thử — còn 5 giờ").

   Các "interface" phía trên chỉ là bản mô tả HÌNH DẠNG dữ liệu
   (có những trường gì), giúp code chặt chẽ, không phải logic chạy.
   ============================================================ */
// TIP-007 — Logic dashboard / leaderboard / profile (tách khỏi presentation).
import { apiFetch } from "./apiClient";

export interface DayPoint {
  date: string;
  minutes: number;
}
export interface Dashboard {
  streak: number;
  today_met: boolean;
  today_minutes: number;
  daily_commit_minutes: number;
  week: DayPoint[];
  month: DayPoint[];
  total_minutes?: number; // TIP-033 (có sau khi áp migration 011; fallback 0 nếu chưa)
  vocab_learned?: number; // TIP-033
}

export interface LeaderRow {
  rank: number | null;
  user_id: string;
  nickname: string | null;
  avatar_url: string | null;
  minutes: number;
}
export interface Leaderboard {
  week_start: string;
  top: LeaderRow[];
  caller: LeaderRow | null;
}

export interface Profile {
  nickname: string | null;
  avatar_url: string | null;
  daily_commit_minutes: number;
}

export interface Subscription {
  status: "trial" | "active" | "expired";
  trial_ends_at: string | null;
  paid_until: string | null;
}
export interface Me {
  user: { id: string; email: string | null };
  profile: { nickname: string | null; avatar_url: string | null; is_admin?: boolean } | null;
  subscription: Subscription | null;
  is_active: boolean;
}

export const fetchDashboard = (): Promise<Dashboard> => apiFetch<Dashboard>("/api/dashboard");
export type LeaderPeriod = "week" | "month" | "all"; // TIP-058
export const fetchLeaderboard = (period: LeaderPeriod = "week"): Promise<Leaderboard> =>
  apiFetch<Leaderboard>(`/api/leaderboard?period=${period}`);
export const fetchMe = (): Promise<Me> => apiFetch<Me>("/api/me");

export const fetchProfile = (): Promise<Profile> =>
  apiFetch<{ profile: Profile }>("/api/profile").then((r) => r.profile);

export const updateProfile = (
  patch: Partial<Pick<Profile, "nickname" | "daily_commit_minutes">>
): Promise<Profile> =>
  apiFetch<{ profile: Profile }>("/api/profile", { method: "PATCH", body: JSON.stringify(patch) }).then(
    (r) => r.profile
  );

// Mô tả trạng thái subscription (chỉ đọc).
export function subscriptionText(me: Me): string {
  const s = me.subscription;
  if (me.is_active && s?.status === "trial" && s.trial_ends_at) {
    const hrs = Math.max(0, Math.ceil((new Date(s.trial_ends_at).getTime() - Date.now()) / 3_600_000));
    return `Dùng thử — còn ${hrs} giờ`;
  }
  if (me.is_active && s?.status === "active" && s.paid_until) {
    return `Đã kích hoạt đến ${new Date(s.paid_until).toLocaleDateString("vi-VN")}`;
  }
  return "Đã hết hạn";
}

"use client";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@/hooks/useUser";
import { fetchAccessStatus } from "@/lib/access";

/* ============================================================
   GIẢI THÍCH CHO KHÁCH — File: components/AccessGuard.tsx
   ------------------------------------------------------------
   "Người gác cửa quyền học". Khác với AuthGuard (chỉ hỏi đã đăng
   nhập chưa), file này kiểm tra người dùng CÒN QUYỀN HỌC không
   (còn dùng thử miễn phí hoặc đã mua Pro).
   - Danh sách PROTECTED bên dưới là các trang cần quyền học.
   - Nếu hết hạn → tự đưa sang trang thanh toán (/thanh-toan).
   - Nếu việc kiểm tra bị lỗi tạm thời → KHÔNG khoá nhầm (ưu tiên trải
     nghiệm), vì máy chủ vẫn chặn dữ liệu ở phía sau nếu thực sự hết hạn.
   - Không chặn render: nội dung hiện ngay, việc kiểm tra chạy nền.
   ============================================================ */
// TIP-019b — Chặn TRANG HỌC khi hết trial + chưa trả → redirect /thanh-toan.
// KHÔNG chặn: / (login), /thanh-toan, /cam-on, /ho-tro, /blog (tránh redirect loop).
const PROTECTED = [
  "/dashboard",
  "/tu-vung",
  "/hoc-tu-vung",
  "/kiem-tra-anh-viet",
  "/kiem-tra-viet-anh",
  "/playlist",
  "/leaderboard",
  "/settings",
];
const PAYWALL_REDIRECT = process.env.NEXT_PUBLIC_PAYWALL_REDIRECT ?? "/thanh-toan";
const isProtected = (p: string): boolean => PROTECTED.some((r) => p === r || p.startsWith(r + "/"));

export function AccessGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useUser();
  const router = useRouter();

  // TIP-041 — KHÔNG chặn render: hiện nội dung NGAY, check quyền chạy nền.
  // Backend đã chặn dữ liệu server-side nên thấy shell mà hết hạn cũng không lấy được data;
  // guard chỉ là UX redirect. Hết quyền → redirect /thanh-toan. Lỗi → fail-open.
  useEffect(() => {
    if (!isProtected(pathname) || loading || !user) return;
    let active = true;
    fetchAccessStatus()
      .then((s) => {
        if (active && !s.has_access) router.replace(PAYWALL_REDIRECT);
      })
      .catch(() => {
        /* fail-open: lỗi tạm thời không khoá nhầm người đang có quyền */
      });
    return () => {
      active = false;
    };
  }, [pathname, user, loading, router]);

  return <>{children}</>;
}

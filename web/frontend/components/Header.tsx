/* ============================================================
   GIẢI THÍCH CHO KHÁCH — File: components/Header.tsx
   ------------------------------------------------------------
   Thanh điều hướng trên cùng (luôn dính ở đầu trang). Gồm:
   - Logo "SM." ở góc trái.
   - Các liên kết: Tiến độ học, Từ vựng, Hỗ trợ — chỉ hiện khi đã
     đăng nhập.
   - Liên kết "Admin" CHỈ hiện với tài khoản quản trị (kiểm tra bằng
     cách hỏi máy chủ). Nếu có trục trặc thì mặc định ẨN cho an toàn.
   ============================================================ */
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@/hooks/useUser";
import { fetchMe } from "@/lib/account";

// TIP-019a — Nav route VN: Tiến độ học / Từ vựng / Hỗ trợ. (TIP-036 bỏ Blog)
// TIP-042: /ho-tro redirect NGOÀI (Facebook) → tắt prefetch để Next không fetch RSC bị CORS chặn.
// TIP-043: bỏ avatar+tên+dropdown (đăng xuất ở popup extension; /playlist, /leaderboard, /settings,
//   /admin vẫn vào được bằng URL — bảng xếp hạng đã nhúng trong dashboard).
const MAIN_NAV: { href: string; label: string; prefetch?: false }[] = [
  { href: "/dashboard", label: "Tiến độ học" },
  { href: "/tu-vung", label: "Từ vựng" },
  { href: "/ho-tro", label: "Hỗ trợ", prefetch: false },
];

export function Header() {
  const { user } = useUser();
  const [isAdmin, setIsAdmin] = useState(false);

  // TIP-059 — chỉ hiện link Admin cho tài khoản admin (is_admin từ /api/me). Fail-closed (lỗi → ẩn).
  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    let ok = true;
    fetchMe()
      .then((me) => {
        if (ok) setIsAdmin(!!me.profile?.is_admin);
      })
      .catch(() => {
        if (ok) setIsAdmin(false);
      });
    return () => {
      ok = false;
    };
  }, [user]);

  // Logo "SM." — chữ đen đậm + chấm accent (vàng).
  const logo = (
    <Link href="/" className="font-heading text-xl font-extrabold tracking-tight text-foreground">
      SM<span className="text-accent">.</span>
    </Link>
  );

  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3">
        {/* Nav dạng PILL bo tròn full, nền trắng, shadow nhẹ — container cố định 696x68 */}
        <nav className="flex h-[68px] w-[696px] items-center gap-6 rounded-pill border border-border bg-surface px-5 shadow-card">
          {logo}
          {user ? (
            <div className="hidden items-center gap-5 md:flex">
              {isAdmin ? (
                <Link
                  href="/admin"
                  className="font-heading text-[20px] font-medium tracking-[-0.03em] text-[#1F1F1F] opacity-100 transition-opacity hover:opacity-60"
                >
                  Admin
                </Link>
              ) : null}
              {MAIN_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={item.prefetch}
                  className="font-heading text-[20px] font-medium tracking-[-0.03em] text-[#1F1F1F] opacity-100 transition-opacity hover:opacity-60"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          ) : null}
        </nav>
      </div>
    </header>
  );
}

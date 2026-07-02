"use client";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@/hooks/useUser";
import { PageLoading } from "@/components/ui/Spinner";
import { fetchAccessStatus } from "@/lib/access";

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
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!isProtected(pathname)) {
      setChecking(false);
      return;
    }
    if (loading) {
      setChecking(true);
      return; // chờ biết đã đăng nhập chưa
    }
    if (!user) {
      setChecking(false);
      return; // chưa login → để AuthForm/AuthGuard của trang redirect về "/"
    }
    let active = true;
    setChecking(true);
    fetchAccessStatus()
      .then((s) => {
        if (!active) return;
        if (s.has_access) setChecking(false);
        else router.replace(PAYWALL_REDIRECT); // hết trial + chưa trả → trang thanh toán
      })
      .catch(() => {
        // Lỗi tạm thời → fail-open (không khoá nhầm người đang có quyền); lần điều hướng sau check lại.
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [pathname, user, loading, router]);

  if (isProtected(pathname) && checking) {
    return <PageLoading />;
  }
  return <>{children}</>;
}

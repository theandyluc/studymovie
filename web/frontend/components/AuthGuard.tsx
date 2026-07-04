"use client";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/useUser";
import { PageLoading } from "@/components/ui/Spinner";

/* ============================================================
   GIẢI THÍCH CHO KHÁCH — File: components/AuthGuard.tsx
   ------------------------------------------------------------
   "Người gác cửa đăng nhập". Bọc quanh những trang chỉ dành cho
   người ĐÃ đăng nhập. Cách hoạt động:
   - Đang kiểm tra → hiện màn hình chờ.
   - Chưa đăng nhập → tự đưa về trang chủ ("/") để đăng nhập.
   - Đã đăng nhập → cho xem nội dung trang.
   ============================================================ */
// Bọc route cần đăng nhập: chưa login -> redirect về trang login ("/").
export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [user, loading, router]);

  if (loading) return <PageLoading />;
  if (!user) return null;
  return <>{children}</>;
}

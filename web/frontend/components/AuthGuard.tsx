"use client";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/useUser";
import { PageLoading } from "@/components/ui/Spinner";

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

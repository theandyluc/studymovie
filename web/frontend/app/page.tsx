"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/hooks/useUser";
import { Card } from "@/components/ui/Card";
import { PageLoading } from "@/components/ui/Spinner";

// WEB-01 / TIP-055 — Auth CHỈ ở extension. Web nhận session từ extension (đồng bộ ext→web TIP-047):
// đã có session → vào /dashboard; chưa có → hiện prompt hướng dẫn đăng nhập bằng tiện ích.
export default function LoginPage() {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [user, loading, router]);

  if (loading || user) return <PageLoading />;

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Card className="w-full max-w-sm text-center">
        <h1 className="font-heading text-2xl font-bold">StudyMovie</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Vui lòng đăng nhập bằng tiện ích StudyMovie trên trình duyệt để sử dụng.
        </p>
        <Link
          href="/ho-tro"
          prefetch={false}
          className="mt-4 inline-block text-sm text-primary hover:underline"
        >
          Cần hỗ trợ?
        </Link>
      </Card>
    </div>
  );
}

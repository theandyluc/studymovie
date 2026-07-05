"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/hooks/useUser";
import { getSupabase } from "@/lib/supabaseClient";
import { Card } from "@/components/ui/Card";
import { PageLoading } from "@/components/ui/Spinner";

/* ============================================================
   GIẢI THÍCH CHO KHÁCH — File: app/page.tsx  (trang chủ "/")
   ------------------------------------------------------------
   Đây là trang đầu tiên khi mở web. Quy tắc đăng nhập của StudyMovie:
   việc đăng nhập diễn ra ở TIỆN ÍCH trình duyệt, web nhận lại phiên
   đăng nhập đó.
   - Nếu đã đăng nhập → tự chuyển vào trang Tiến độ học (/tien-do-hoc).
   - Nếu chưa → hiện lời nhắc đăng nhập bằng tiện ích StudyMovie.
   - Trường hợp đặc biệt: nếu tiện ích mở web kèm "?login=google", web
     sẽ tự khởi động đăng nhập Google.
   ============================================================ */
// WEB-01 / TIP-055 — Auth CHỈ ở extension. Web nhận session từ extension (đồng bộ ext→web TIP-047):
// đã có session → vào /tien-do-hoc; chưa có → hiện prompt hướng dẫn đăng nhập bằng tiện ích.
export default function LoginPage() {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/tien-do-hoc");
  }, [user, loading, router]);

  // TIP-055b — extension mở /?login=google → web tự chạy Google OAuth (redirect qua Google → /auth/callback).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("login") === "google") {
      const sb = getSupabase();
      const site = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
      if (sb) void sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${site}/auth/callback` } });
    }
  }, []);

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

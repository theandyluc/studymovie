"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabaseClient";
import { PageLoading } from "@/components/ui/Spinner";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

// Callback OAuth — exchange code -> session -> về /dashboard.
export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // Chặn double-invoke của React StrictMode (dev): code PKCE chỉ dùng được 1 lần,
  // lần exchange thứ 2 sẽ thiếu code_verifier (đã bị xoá) -> lỗi.
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const run = async () => {
      const sb = getSupabase();
      if (!sb) {
        setError("Chưa cấu hình Supabase env.");
        return;
      }
      const params = new URLSearchParams(window.location.search);
      const oauthErr = params.get("error_description") ?? params.get("error");
      if (oauthErr) {
        setError(oauthErr);
        return;
      }
      const code = params.get("code");
      if (!code) {
        setError("Thiếu mã 'code' trong URL callback.");
        return;
      }
      // ⚠️ Truyền ĐÚNG mã code (không phải cả URL) — đây là root cause của
      // "invalid flow state": auth_code phải khớp flow state trên server.
      const { error: exErr } = await sb.auth.exchangeCodeForSession(code);
      if (exErr) {
        setError(exErr.message);
        return;
      }
      router.replace("/dashboard");
    };
    run();
  }, [router]);

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-sm text-center">
          <h1 className="font-heading text-lg font-semibold">Đăng nhập thất bại</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <Button className="mt-4 w-full" onClick={() => router.replace("/")}>
            Thử lại
          </Button>
        </Card>
      </div>
    );
  }
  return <PageLoading label="Đang hoàn tất đăng nhập…" />;
}

"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabaseClient";
import { PageLoading } from "@/components/ui/Spinner";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

/* ============================================================
   GIẢI THÍCH CHO KHÁCH — File: app/auth/callback/page.tsx
   ------------------------------------------------------------
   Trang "trung chuyển" sau khi đăng nhập Google (hoặc bấm link xác
   nhận email). Google gửi người dùng về đây kèm một "mã", trang này
   đổi mã đó lấy phiên đăng nhập thật rồi đưa vào trang Tiến độ học.
   - Nếu thành công → chuyển sang /dashboard.
   - Nếu lỗi → hiện thông báo "Đăng nhập thất bại" và nút "Thử lại".
   (Người dùng thường chỉ thấy màn hình chờ thoáng qua ở đây.)
   ============================================================ */
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
      const tokenHash = params.get("token_hash");
      const type = params.get("type");
      if (code) {
        // OAuth / PKCE (Google + link xác nhận email dạng code). Truyền ĐÚNG mã code (không phải cả
        // URL) — root cause "invalid flow state": auth_code phải khớp flow state trên server.
        const { error: exErr } = await sb.auth.exchangeCodeForSession(code);
        if (exErr) {
          setError(exErr.message);
          return;
        }
      } else if (tokenHash && type) {
        // TIP-046 — link xác nhận email dạng token_hash+type (verifyOtp).
        const { error: vErr } = await sb.auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash });
        if (vErr) {
          setError(vErr.message);
          return;
        }
      } else {
        setError("Thiếu mã xác thực trong URL callback.");
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
  return <PageLoading />;
}

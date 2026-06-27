"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabaseClient";
import { PageLoading } from "@/components/ui/Spinner";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

// Callback OAuth — exchange code -> session -> về /dashboard.
export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const sb = getSupabase();
      if (!sb) {
        setError("Chưa cấu hình Supabase env.");
        return;
      }
      const { error: exErr } = await sb.auth.exchangeCodeForSession(window.location.href);
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

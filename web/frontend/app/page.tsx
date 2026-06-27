"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabaseClient";
import { useUser } from "@/hooks/useUser";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageLoading } from "@/components/ui/Spinner";

// WEB-01 — Trang login (Google OAuth).
export default function LoginPage() {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [user, loading, router]);

  const signIn = async () => {
    const sb = getSupabase();
    if (!sb) {
      alert("Chưa cấu hình Supabase (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).");
      return;
    }
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${site}/auth/callback` },
    });
  };

  if (loading || user) return <PageLoading label="Đang tải…" />;

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-sm text-center">
        <h1 className="font-heading text-2xl font-bold">StudyMovie</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Học tiếng Anh qua YouTube với phụ đề song ngữ.
        </p>
        <Button className="mt-6 w-full" onClick={signIn}>
          Đăng nhập với Google
        </Button>
      </Card>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabaseClient";
import { useUser } from "@/hooks/useUser";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageLoading } from "@/components/ui/Spinner";
import { toast } from "@/components/ui/feedback";

// Map lỗi Supabase → thông báo tiếng Việt thân thiện (mirror extension TIP-027).
function mapAuthError(m: string): string {
  if (/invalid login credentials/i.test(m)) return "Email hoặc mật khẩu không đúng.";
  if (/email not confirmed/i.test(m)) return "Email chưa được xác nhận. Vui lòng mở hộp thư và bấm link xác nhận.";
  if (/already registered|already exists/i.test(m)) return "Email đã được đăng ký. Vui lòng đăng nhập.";
  if (/password.*(6|at least|weak)|weak password/i.test(m)) return "Mật khẩu quá yếu (tối thiểu 6 ký tự).";
  if (/rate limit|too many/i.test(m)) return "Thao tác quá nhanh, vui lòng thử lại sau ít phút.";
  return m;
}

// WEB-01 / TIP-046 — Trang login: email/mật khẩu (đăng nhập + đăng ký) + Google OAuth.
export default function LoginPage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [user, loading, router]);

  const siteUrl = (): string => process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;

  const signInGoogle = async () => {
    const sb = getSupabase();
    if (!sb) {
      toast("Chưa cấu hình Supabase (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).", "error");
      return;
    }
    await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${siteUrl()}/auth/callback` },
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const em = email.trim();
    const pw = password;
    if (!em || !pw) {
      setMsg({ text: "Nhập đủ email và mật khẩu.", ok: false });
      return;
    }
    const sb = getSupabase();
    if (!sb) {
      setMsg({ text: "Chưa cấu hình Supabase.", ok: false });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      if (authMode === "register") {
        const { data, error } = await sb.auth.signUp({
          email: em,
          password: pw,
          options: { emailRedirectTo: `${siteUrl()}/auth/callback` },
        });
        if (error) {
          setMsg({ text: mapAuthError(error.message), ok: false });
        } else if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          // Supabase anti-enumeration: email ĐÃ tồn tại → trả success rỗng (identities=[]).
          setAuthMode("login");
          setMsg({
            text: "Email đã được đăng ký. Vui lòng đăng nhập (hoặc dùng Google nếu bạn tạo bằng Google).",
            ok: false,
          });
        } else if (!data.session) {
          // Confirm email ON, user mới → chưa có session → chờ xác nhận email.
          setAuthMode("login");
          setMsg({ text: "Đã gửi email xác nhận. Mở hộp thư và bấm link để kích hoạt, rồi đăng nhập.", ok: true });
        }
        // (Có session ngay = confirm off → useEffect tự redirect /dashboard.)
      } else {
        const { error } = await sb.auth.signInWithPassword({ email: em, password: pw });
        if (error) setMsg({ text: mapAuthError(error.message), ok: false });
        // Thành công → useUser onAuthStateChange → useEffect redirect /dashboard.
      }
    } catch (err) {
      setMsg({ text: mapAuthError(err instanceof Error ? err.message : String(err)), ok: false });
    } finally {
      setBusy(false);
    }
  };

  if (loading || user) return <PageLoading />;

  const isReg = authMode === "register";
  const inputCls = "w-full rounded-btn border border-border bg-surface px-3 py-2 text-sm";

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Card className="w-full max-w-sm">
        <div className="text-center">
          <h1 className="font-heading text-2xl font-bold">StudyMovie</h1>
          <p className="mt-1 text-sm text-muted-foreground">Học tiếng Anh qua YouTube với phụ đề song ngữ.</p>
        </div>

        <form onSubmit={submit} className="mt-5 space-y-2">
          <input
            type="email"
            className={inputCls}
            placeholder="Email"
            value={email}
            autoComplete="email"
            onChange={(e) => {
              setEmail(e.target.value);
              setMsg(null);
            }}
          />
          <input
            type="password"
            className={inputCls}
            placeholder="Mật khẩu"
            value={password}
            autoComplete={isReg ? "new-password" : "current-password"}
            onChange={(e) => {
              setPassword(e.target.value);
              setMsg(null);
            }}
          />
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? (isReg ? "Đang tạo…" : "Đang đăng nhập…") : isReg ? "Tạo tài khoản" : "Đăng nhập"}
          </Button>
        </form>

        {msg ? (
          <p className={`mt-2 text-sm ${msg.ok ? "text-success-foreground" : "text-danger-foreground"}`}>{msg.text}</p>
        ) : null}

        <button
          type="button"
          onClick={() => {
            setAuthMode(isReg ? "login" : "register");
            setMsg(null);
          }}
          className="mt-3 w-full text-sm text-muted-foreground hover:text-foreground"
        >
          {isReg ? "Đã có tài khoản? Đăng nhập" : "Chưa có tài khoản? Đăng ký"}
        </button>

        <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> hoặc <span className="h-px flex-1 bg-border" />
        </div>

        <Button variant="ghost" className="w-full" onClick={signInGoogle}>
          Đăng nhập với Google
        </Button>
      </Card>
    </div>
  );
}

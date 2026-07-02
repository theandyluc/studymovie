"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabaseClient";
import { useUser } from "@/hooks/useUser";
import { fetchMe } from "@/lib/account";
import { Avatar } from "@/components/ui/Avatar";
import { ThemeToggle } from "@/components/ThemeToggle";

// TIP-019a — Nav route VN: Tiến độ học / Từ vựng / Blog / Hỗ trợ.
// Playlist / Bảng xếp hạng / Cài đặt giữ trong dropdown avatar (KHÔNG mất truy cập).
const MAIN_NAV = [
  { href: "/dashboard", label: "Tiến độ học" },
  { href: "/tu-vung", label: "Từ vựng" },
  { href: "/ho-tro", label: "Hỗ trợ" },
];
const MENU = [
  { href: "/playlist", label: "Playlist" },
  { href: "/leaderboard", label: "Bảng xếp hạng" },
  { href: "/settings", label: "Cài đặt" },
];

export function Header() {
  const { user } = useUser();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Chỉ hiện link /admin cho admin (is_admin từ /api/me). Server vẫn chặn API nếu không phải admin.
  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    let active = true;
    fetchMe()
      .then((me) => {
        if (active) setIsAdmin(!!me.profile?.is_admin);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [user]);

  const signOut = async () => {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    setOpen(false);
    router.replace("/");
  };

  const meta = (user?.user_metadata ?? {}) as { full_name?: string; name?: string; avatar_url?: string };
  const displayName = meta.full_name ?? meta.name ?? user?.email ?? "";

  // Logo "SM." — chữ đen đậm + chấm accent (vàng).
  const logo = (
    <Link href="/" className="font-heading text-xl font-extrabold tracking-tight text-foreground">
      SM<span className="text-accent">.</span>
    </Link>
  );

  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3">
        {/* Nav dạng PILL bo tròn full, nền trắng, shadow nhẹ */}
        <nav className="flex flex-1 items-center gap-6 rounded-pill border border-border bg-surface px-5 py-2.5 shadow-card">
          {logo}
          {user ? (
            <div className="hidden items-center gap-5 md:flex">
              {MAIN_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          ) : null}
        </nav>

        <ThemeToggle />

        {user ? (
          <div className="relative flex items-center">
            <button
              onClick={() => setOpen((o) => !o)}
              className="flex items-center gap-2"
              aria-haspopup="menu"
              aria-expanded={open}
            >
              <Avatar src={meta.avatar_url} name={displayName} />
              <span className="hidden max-w-[160px] truncate text-sm text-foreground sm:inline">
                {displayName}
              </span>
            </button>
            {open ? (
              <>
                {/* backdrop bấm ra ngoài để đóng */}
                <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
                <div className="absolute right-0 top-12 z-50 w-48 overflow-hidden rounded-card border border-border bg-surface py-1 shadow-lg">
                  {MENU.map((m) => (
                    <Link
                      key={m.href}
                      href={m.href}
                      onClick={() => setOpen(false)}
                      className="block px-4 py-2 text-sm text-foreground hover:bg-surface-muted"
                    >
                      {m.label}
                    </Link>
                  ))}
                  {isAdmin ? (
                    <Link
                      href="/admin"
                      onClick={() => setOpen(false)}
                      className="block px-4 py-2 text-sm text-foreground hover:bg-surface-muted"
                    >
                      Admin
                    </Link>
                  ) : null}
                  <button
                    onClick={signOut}
                    className="block w-full px-4 py-2 text-left text-sm text-foreground hover:bg-surface-muted"
                  >
                    Đăng xuất
                  </button>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}

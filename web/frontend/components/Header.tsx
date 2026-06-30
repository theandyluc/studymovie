"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabaseClient";
import { useUser } from "@/hooks/useUser";
import { Avatar } from "@/components/ui/Avatar";

// TIP-019a — Nav route VN: Tiến độ học / Từ vựng / Blog / Hỗ trợ.
// Playlist / Bảng xếp hạng / Cài đặt giữ trong dropdown avatar (KHÔNG mất truy cập).
const MAIN_NAV = [
  { href: "/dashboard", label: "Tiến độ học" },
  { href: "/tu-vung", label: "Từ vựng" },
  { href: "/blog", label: "Blog" },
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

  const signOut = async () => {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    setOpen(false);
    router.replace("/");
  };

  const meta = (user?.user_metadata ?? {}) as { full_name?: string; name?: string; avatar_url?: string };
  const displayName = meta.full_name ?? meta.name ?? user?.email ?? "";

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-heading text-lg font-bold text-primary">
            StudyMovie
          </Link>
          {user ? (
            <nav className="hidden items-center gap-4 md:flex">
              {MAIN_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>

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

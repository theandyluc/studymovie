"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabaseClient";
import { useUser } from "@/hooks/useUser";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";

// Nav placeholder — các trang sẽ làm ở TIP sau (tạm disabled trừ Dashboard).
const NAV: { href: string; label: string; enabled: boolean }[] = [
  { href: "/dashboard", label: "Dashboard", enabled: true },
  { href: "/vocabulary", label: "Từ vựng", enabled: true },
  { href: "#", label: "Playlist", enabled: false },
  { href: "/leaderboard", label: "Bảng xếp hạng", enabled: true },
  { href: "/settings", label: "Cài đặt", enabled: true },
];

export function Header() {
  const { user } = useUser();
  const router = useRouter();

  const signOut = async () => {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
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
              {NAV.map((item) =>
                item.enabled ? (
                  <Link key={item.label} href={item.href} className="text-sm text-muted-foreground hover:text-foreground">
                    {item.label}
                  </Link>
                ) : (
                  <span key={item.label} className="cursor-not-allowed text-sm text-muted-foreground/50" title="Sắp có">
                    {item.label}
                  </span>
                )
              )}
            </nav>
          ) : null}
        </div>

        {user ? (
          <div className="flex items-center gap-3">
            <Avatar src={meta.avatar_url} name={displayName} />
            <span className="hidden max-w-[160px] truncate text-sm text-foreground sm:inline">{displayName}</span>
            <Button variant="ghost" onClick={signOut}>
              Đăng xuất
            </Button>
          </div>
        ) : null}
      </div>
    </header>
  );
}

"use client";
import Link from "next/link";
import { useUser } from "@/hooks/useUser";
import { ThemeToggle } from "@/components/ThemeToggle";

// TIP-019a — Nav route VN: Tiến độ học / Từ vựng / Hỗ trợ. (TIP-036 bỏ Blog)
// TIP-042: /ho-tro redirect NGOÀI (Facebook) → tắt prefetch để Next không fetch RSC bị CORS chặn.
// TIP-043: bỏ avatar+tên+dropdown (đăng xuất ở popup extension; /playlist, /leaderboard, /settings,
//   /admin vẫn vào được bằng URL — bảng xếp hạng đã nhúng trong dashboard).
const MAIN_NAV: { href: string; label: string; prefetch?: false }[] = [
  { href: "/dashboard", label: "Tiến độ học" },
  { href: "/tu-vung", label: "Từ vựng" },
  { href: "/ho-tro", label: "Hỗ trợ", prefetch: false },
];

export function Header() {
  const { user } = useUser();

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
                  prefetch={item.prefetch}
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          ) : null}
        </nav>

        <ThemeToggle />
      </div>
    </header>
  );
}

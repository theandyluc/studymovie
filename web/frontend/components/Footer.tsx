import Link from "next/link";

// Footer site-wide — luôn hiển thị (cả khi chưa đăng nhập) để user & reviewer Chrome Web Store
// truy cập được Chính sách quyền riêng tư mà không cần gõ URL.
export function Footer() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row">
        <span>© {2026} StudyMovie</span>
        <nav className="flex items-center gap-5">
          <Link href="/privacy" className="transition-colors hover:text-foreground">
            Chính sách quyền riêng tư
          </Link>
          <Link href="/ho-tro" className="transition-colors hover:text-foreground">
            Hỗ trợ
          </Link>
        </nav>
      </div>
    </footer>
  );
}

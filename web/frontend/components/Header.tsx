/* ============================================================
   GIẢI THÍCH CHO KHÁCH — File: components/Header.tsx
   ------------------------------------------------------------
   Thanh điều hướng trên cùng (luôn dính ở đầu trang). Gồm:
   - Logo "SM." ở góc trái.
   - Các liên kết: Tiến độ học, Từ vựng, Hỗ trợ — chỉ hiện khi đã
     đăng nhập.
   - KHÔNG có link "Admin" trên nav (bỏ theo yêu cầu) — trang /admin
     vẫn vào được bằng cách gõ thẳng URL, tự bảo vệ độc lập ở phía
     trang đó (kiểm tra is_admin qua API, không phải admin → /dashboard).
   ============================================================ */
"use client";
import Link from "next/link";
import { useUser } from "@/hooks/useUser";

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

  // Logo icon "film-open-star" — chỉ icon, không kèm chữ. Vị trí Figma: x=35, căn giữa dọc theo nav.
  const logo = (
    <Link href="/" className="absolute left-[85px] top-1/2 flex -translate-y-1/2 items-center text-foreground">
      <svg
        width="44"
        height="44"
        viewBox="0 0 44 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-[44px] w-[44px]"
      >
        <path
          d="M36.025 11.9167L31.0017 5.42667L38.2067 3.99667L39.6367 11.1833L36.025 11.9167ZM30.635 12.9617L25.6117 6.49L22 7.205L27.0417 13.6767L30.635 12.9617ZM34.8333 23.8333C36.85 23.8333 38.72 24.3833 40.3333 25.3183V18.3333H3.66667V36.6667C3.66667 37.6391 4.05297 38.5718 4.74061 39.2594C5.42824 39.947 6.36087 40.3333 7.33333 40.3333H25.3183C24.3833 38.72 23.8333 36.85 23.8333 34.8333C23.8333 28.765 28.765 23.8333 34.8333 23.8333ZM7.62667 10.0833L5.83 10.4317C4.87976 10.6264 4.04463 11.188 3.50579 11.9945C2.96694 12.8011 2.76784 13.7876 2.95167 14.74L3.66667 18.3333L12.65 16.555L7.62667 10.0833ZM21.6517 14.7583L16.6283 8.25L13.0167 9.00167L18.0583 15.4733L21.6517 14.7583ZM42.1667 32.7983L36.8683 32.34L34.8333 27.5L32.7617 32.34L27.5 32.7983L31.4967 36.245L30.25 41.3967L34.8333 38.665L39.325 41.3967L38.1333 36.245L42.1667 32.7983Z"
          fill="currentColor"
        />
      </svg>
    </Link>
  );

  // TIP-081 — x/y tuyệt đối theo Figma: nav 696x68, border #e6e6e6, fill #fcfcfc (khớp token border/surface).
  // Vị trí text: "Tiến độ học" x=295, "Từ vựng" x=435, "Hỗ trợ" x=554, tất cả y=18.
  // TIP-081 — nav bar giảm còn 596px (636-40); dịch cả cụm sang trái 20px để vẫn căn giữa (~86px mỗi bên).
  const NAV_X: Record<string, number> = {
    "/dashboard": 185,
    "/tu-vung": 335,
    "/ho-tro": 454,
  };
  const navLinkCls =
    "font-heading absolute top-[18px] text-[20px] font-normal tracking-[-0.03em] text-[#1F1F1F] opacity-100 transition-opacity hover:opacity-60";

  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1280px] items-center justify-center gap-3 px-4 pb-3 pt-[40px]">
        {/* Nav dạng PILL bo tròn full, nền trắng — container cố định 696x60, vị trí item tuyệt đối theo Figma (không shadow) */}
        <nav className="relative h-[60px] w-[596px] rounded-pill border border-border bg-surface">
          {logo}
          {user ? (
            <>
              {MAIN_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={item.prefetch}
                  className={navLinkCls}
                  style={{ left: NAV_X[item.href] }}
                >
                  {item.label}
                </Link>
              ))}
            </>
          ) : null}
        </nav>
      </div>
    </header>
  );
}

"use client";
import { useEffect, useState } from "react";

// TIP-034 — Nút chuyển sáng/tối. Toggle class 'dark' trên <html> + lưu localStorage.
// Icon khởi tạo sau mount (đọc class do anti-FOUC script đặt) → tránh lệch SSR.
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    const el = document.documentElement;
    if (next) el.classList.add("dark");
    else el.classList.remove("dark");
    try {
      localStorage.setItem("sm-theme", next ? "dark" : "light");
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      onClick={toggle}
      aria-label="Chuyển chế độ sáng/tối"
      title="Chế độ sáng/tối"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-base shadow-card hover:bg-surface-muted"
    >
      {/* dark đang bật → hiện mặt trời (bấm để sáng); ngược lại hiện mặt trăng */}
      {mounted ? (dark ? "☀️" : "🌙") : ""}
    </button>
  );
}

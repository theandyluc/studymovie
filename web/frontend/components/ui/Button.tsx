/* GIẢI THÍCH CHO KHÁCH — components/ui/Button.tsx
   "Viên gạch" nút bấm dùng lại khắp nơi. Có nhiều kiểu (variant):
   primary (nút tối chủ đạo), ghost/outline (viền nhẹ), info/success/
   danger (xanh/lá/đỏ). Nhờ dùng chung một nút, cả web trông đồng nhất
   và khi đổi phong cách chỉ cần sửa ở đây. */
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "outline" | "info" | "success" | "danger";

// UI primitive — style hoàn toàn từ design tokens (xem globals.css). TIP-021: theme sáng.
export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-btn px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const variants: Record<Variant, string> = {
    primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
    ghost: "border border-border bg-surface text-foreground hover:bg-surface-muted",
    outline: "border border-border bg-transparent text-foreground hover:bg-surface-muted",
    info: "bg-info text-info-foreground hover:opacity-90",
    success: "bg-success text-success-foreground hover:opacity-90",
    danger: "bg-danger text-danger-foreground hover:opacity-90",
  };
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

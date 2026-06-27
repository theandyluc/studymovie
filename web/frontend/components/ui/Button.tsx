import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost";

// UI primitive — style hoàn toàn từ design tokens (xem globals.css).
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
  };
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

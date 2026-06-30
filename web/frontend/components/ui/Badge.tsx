import type { HTMLAttributes } from "react";

type Tone = "info" | "success" | "danger" | "neutral";

// TIP-021 — Pill trạng thái (vd "Từ mới" = danger, "Đã học" = success). Dùng lại ở TIP sau.
export function Badge({
  tone = "neutral",
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  const tones: Record<Tone, string> = {
    info: "bg-info text-info-foreground",
    success: "bg-success text-success-foreground",
    danger: "bg-danger text-danger-foreground",
    neutral: "bg-surface-muted text-muted-foreground",
  };
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}
      {...props}
    />
  );
}

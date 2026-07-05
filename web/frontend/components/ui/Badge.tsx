/* GIẢI THÍCH CHO KHÁCH — components/ui/Badge.tsx
   "Nhãn dán" nhỏ hình viên thuốc để hiển thị trạng thái bằng màu,
   ví dụ: "Từ mới" (đỏ) và "Đã học" (xanh lá). Chỉ để nhìn cho dễ
   phân biệt, không bấm được. */
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
      className={`inline-flex items-center rounded-pill px-2.5 py-0.5 text-sm font-normal ${tones[tone]} ${className}`}
      {...props}
    />
  );
}

/* GIẢI THÍCH CHO KHÁCH — components/ui/Card.tsx
   "Thẻ" nền trắng, bo góc, có đổ bóng nhẹ — dùng để bọc từng khối
   nội dung (ví dụ: một ô thống kê, một biểu mẫu). Giúp mọi khối
   trên web trông gọn gàng và giống nhau. */
import type { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-card border border-border bg-surface p-6 shadow-card ${className}`}
      {...props}
    />
  );
}

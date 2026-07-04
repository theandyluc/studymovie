/* GIẢI THÍCH CHO KHÁCH — components/ui/Skeleton.tsx
   "Khung xám nhấp nháy" hiện tạm ở đúng vị trí nội dung trong lúc chờ
   dữ liệu về. Nhờ vậy bố cục trang không bị nhảy giật khi nội dung
   thật xuất hiện — cảm giác mượt hơn màn hình trắng trơn. */
// UX #6 — Khối skeleton (xám nhấp nháy) giữ đúng bố cục lúc tải, tránh nhảy layout.
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-card bg-surface-muted ${className}`} />;
}

// UX #6 — Khối skeleton (xám nhấp nháy) giữ đúng bố cục lúc tải, tránh nhảy layout.
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-card bg-surface-muted ${className}`} />;
}

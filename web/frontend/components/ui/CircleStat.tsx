/* GIẢI THÍCH CHO KHÁCH — components/ui/CircleStat.tsx
   "Vòng tròn số liệu": một vòng tròn mảnh với con số lớn ở giữa,
   dùng ở trang Tiến độ học (giờ đã học, số từ, chuỗi ngày...).
   Nếu truyền thêm "percent" (phần trăm), vòng sẽ vẽ một cung màu tím
   chạy theo tiến độ — dùng cho ô "Mục tiêu tiếp theo". */
// TIP-033 — Vòng tròn stat theo Figma: ring mảnh + giá trị ở giữa.
// Dùng cho Dashboard: 3 stat (giờ học / từ vựng / streak) = ring xám trơn;
// vòng "Mục tiêu tiếp theo" = ring có cung tiến độ tím (truyền percent).

export function CircleStat({
  value,
  label,
  percent,
  size = 100,
  valueClassName = "text-2xl font-semibold",
}: {
  value: string;
  label?: string;
  percent?: number; // 0..100 → vẽ cung accent (tím). Bỏ trống = ring xám trơn.
  size?: number;
  valueClassName?: string; // TIP-081 — cỡ chữ + độ đậm giá trị do nơi gọi quyết định (theo Figma từng ô)
}) {
  const r = 47.25; // TIP-081 — border 1.5px trên vòng 100px (Figma) ≈ bán kính 100/2 - 1.5/2
  const circ = 2 * Math.PI * r;
  const p = percent == null ? null : Math.min(100, Math.max(0, percent));
  const off = p == null ? 0 : circ * (1 - p / 100);

  return (
    <div className="flex flex-col items-center gap-[10px]">
      {/* TIP-081 — tiêu đề đậm #1f1f1f 18px medium (theo Figma), cách vòng tròn 10px.
          Bỏ min-h-[2.5rem] cũ (di sản layout lưới 2 dòng) — nó làm tổng chiều cao tràn khỏi card 174px. */}
      {label ? <span className="font-heading text-center text-lg font-normal text-foreground">{label}</span> : null}
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" strokeWidth="1.5" className="stroke-border" />
          {p != null ? (
            <circle
              cx="50"
              cy="50"
              r={r}
              fill="none"
              strokeWidth="3"
              strokeLinecap="round"
              className="stroke-level-ring"
              strokeDasharray={circ}
              strokeDashoffset={off}
            />
          ) : null}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-heading tracking-[-0.03em] ${valueClassName}`}>{value}</span>
        </div>
      </div>
    </div>
  );
}

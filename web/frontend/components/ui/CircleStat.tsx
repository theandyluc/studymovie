// TIP-033 — Vòng tròn stat theo Figma: ring mảnh + giá trị ở giữa.
// Dùng cho Dashboard: 3 stat (giờ học / từ vựng / streak) = ring xám trơn;
// vòng "Mục tiêu tiếp theo" = ring có cung tiến độ tím (truyền percent).

export function CircleStat({
  value,
  label,
  percent,
  size = 104,
}: {
  value: string;
  label?: string;
  percent?: number; // 0..100 → vẽ cung accent (tím). Bỏ trống = ring xám trơn.
  size?: number;
}) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const p = percent == null ? null : Math.min(100, Math.max(0, percent));
  const off = p == null ? 0 : circ * (1 - p / 100);

  return (
    <div className="flex flex-col items-center gap-2">
      {label ? <span className="text-sm text-muted-foreground">{label}</span> : null}
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" strokeWidth="6" className="stroke-chart-base" />
          {p != null ? (
            <circle
              cx="50"
              cy="50"
              r={r}
              fill="none"
              strokeWidth="6"
              strokeLinecap="round"
              className="stroke-level-ring"
              strokeDasharray={circ}
              strokeDashoffset={off}
            />
          ) : null}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold">{value}</span>
        </div>
      </div>
    </div>
  );
}

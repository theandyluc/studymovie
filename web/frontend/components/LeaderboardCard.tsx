"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { useUser } from "@/hooks/useUser";
import { fetchLeaderboard, type Leaderboard, type LeaderRow, type LeaderPeriod } from "@/lib/account";

/* ============================================================
   GIẢI THÍCH CHO KHÁCH — File: components/LeaderboardCard.tsx
   ------------------------------------------------------------
   Thẻ "Bảng xếp hạng" nằm trong trang Tiến độ học. Hiển thị:
   - 3 tab: Tuần / Tháng / Toàn thời gian.
   - Top 5 người học nhiều nhất, kèm huy chương 🥇🥈🥉 cho 3 hạng đầu.
   - Nếu bạn không nằm trong Top 5, dòng của bạn được "ghim" hiện thêm
     ở dưới để bạn luôn thấy vị trí của mình.
   ============================================================ */
// TIP-033 — Card Bảng xếp hạng trên Dashboard (theo Figma: tab + huy chương + ghim user).
// Reuse backend leaderboard TUẦN hiện có (giữ trang /leaderboard riêng song song).
// Tab "Tháng"/"Toàn thời gian" = visual theo Figma nhưng CHƯA có RPC → disabled ("Sắp có").

function fmtHm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m.toString().padStart(2, "0")}m` : `${m}m`;
}
function medal(rank: number | null): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return rank ? `${rank}` : "—";
}

function Row({ row, me }: { row: LeaderRow; me?: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-btn px-2 py-1.5 ${me ? "bg-surface-muted" : ""}`}>
      <span className="w-6 shrink-0 text-center text-sm">{medal(row.rank)}</span>
      <Avatar src={row.avatar_url} name={row.nickname} size={28} />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {row.nickname ?? "Người dùng"} {me ? <span className="text-xs text-primary">(bạn)</span> : null}
      </span>
      <span className="shrink-0 text-sm text-muted-foreground">{fmtHm(row.minutes)}</span>
    </div>
  );
}

// TIP-058 — 3 kỳ chạy thật.
const TABS: { label: string; period: LeaderPeriod }[] = [
  { label: "Tuần", period: "week" },
  { label: "Tháng", period: "month" },
  { label: "Toàn thời gian", period: "all" },
];
const EMPTY_TEXT: Record<LeaderPeriod, string> = {
  week: "Tuần này chưa ai có giờ học.",
  month: "Tháng này chưa ai có giờ học.",
  all: "Chưa ai có giờ học.",
};

export function LeaderboardCard() {
  const { user } = useUser();
  const [period, setPeriod] = useState<LeaderPeriod>("week");
  const [data, setData] = useState<Leaderboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setData(null);
    setError(null);
    fetchLeaderboard(period)
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      active = false;
    };
  }, [period]);

  const uid = user?.id;
  const top5 = data?.top.slice(0, 5) ?? [];
  const meInTop = uid ? data?.top.find((r) => r.user_id === uid) : undefined;
  const inTop5 = !!meInTop && (meInTop.rank ?? 999) <= 5;
  const pinRow: LeaderRow | null = inTop5 ? null : (meInTop ?? data?.caller ?? null);

  return (
    <Card className="flex flex-col">
      <h2 className="text-center font-medium">Bảng xếp hạng</h2>

      {/* TIP-058 — Tab pill 3 kỳ chạy thật */}
      <div className="mx-auto mt-3 flex rounded-pill border border-border p-0.5 text-sm">
        {TABS.map((t) => {
          const active = t.period === period;
          return (
            <button
              key={t.period}
              onClick={() => setPeriod(t.period)}
              className={`rounded-pill px-3 py-1 transition-colors ${
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex-1 space-y-1">
        {error ? (
          <p className="text-sm text-danger-foreground">Không tải được: {error}</p>
        ) : !data ? (
          <p className="text-sm text-muted-foreground">Đang tải…</p>
        ) : top5.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{EMPTY_TEXT[period]}</p>
        ) : (
          <>
            {top5.map((r) => (
              <Row key={r.user_id} row={r} me={!!uid && r.user_id === uid} />
            ))}
            {pinRow ? (
              <>
                <div className="my-1 border-t border-dashed border-border" />
                <Row row={pinRow} me />
              </>
            ) : null}
          </>
        )}
      </div>
    </Card>
  );
}

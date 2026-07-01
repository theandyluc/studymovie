"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { useUser } from "@/hooks/useUser";
import { fetchLeaderboard, type Leaderboard, type LeaderRow } from "@/lib/account";

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

const TABS = ["Tuần", "Tháng", "Toàn thời gian"] as const;

export function LeaderboardCard() {
  const { user } = useUser();
  const [data, setData] = useState<Leaderboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLeaderboard()
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const uid = user?.id;
  const top5 = data?.top.slice(0, 5) ?? [];
  const meInTop = uid ? data?.top.find((r) => r.user_id === uid) : undefined;
  const inTop5 = !!meInTop && (meInTop.rank ?? 999) <= 5;
  const pinRow: LeaderRow | null = inTop5 ? null : (meInTop ?? data?.caller ?? null);

  return (
    <Card className="flex flex-col">
      <h2 className="text-center font-medium">Bảng xếp hạng</h2>

      {/* Tab pill (Figma) — chỉ Tuần có dữ liệu; Tháng/Toàn thời gian chờ RPC */}
      <div className="mx-auto mt-3 flex rounded-pill border border-border p-0.5 text-sm">
        {TABS.map((t) => {
          const active = t === "Tuần";
          return (
            <span
              key={t}
              title={active ? undefined : "Sắp có"}
              className={`rounded-pill px-3 py-1 ${
                active ? "bg-primary text-primary-foreground" : "cursor-not-allowed text-muted-foreground/60"
              }`}
            >
              {t}
            </span>
          );
        })}
      </div>

      <div className="mt-3 flex-1 space-y-1">
        {error ? (
          <p className="text-sm text-red-600">Không tải được: {error}</p>
        ) : !data ? (
          <p className="text-sm text-muted-foreground">Đang tải…</p>
        ) : top5.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Tuần này chưa ai có giờ học.</p>
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

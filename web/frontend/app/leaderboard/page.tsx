"use client";
import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { PageLoading } from "@/components/ui/Spinner";
import { useUser } from "@/hooks/useUser";
import { fetchLeaderboard, type Leaderboard, type LeaderRow } from "@/lib/account";

function fmt(minutes: number): string {
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}p`;
  return `${minutes} phút`;
}
function medal(rank: number | null): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return rank ? `#${rank}` : "—";
}

function Row({ row, me }: { row: LeaderRow; me?: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-card border p-3 ${me ? "border-primary bg-surface-muted" : "border-border bg-surface"}`}>
      <span className="w-8 text-center text-lg">{medal(row.rank)}</span>
      <Avatar src={row.avatar_url} name={row.nickname} size={32} />
      <span className="min-w-0 flex-1 truncate font-medium">
        {row.nickname ?? "Người dùng"} {me ? <span className="text-xs text-primary">(bạn)</span> : null}
      </span>
      <span className="text-sm text-muted-foreground">{fmt(row.minutes)}</span>
    </div>
  );
}

function LeaderboardInner() {
  const { user } = useUser();
  const [data, setData] = useState<Leaderboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLeaderboard()
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (error) return <Card><p className="text-sm text-red-600">Không tải được bảng xếp hạng: {error}</p></Card>;
  if (!data) return <PageLoading label="Đang tải bảng xếp hạng…" />;

  const uid = user?.id;
  // TIP-028 — chỉ hiện TOP 5; user hạng 6–20 hoặc ngoài 20 → ghim dòng riêng bên dưới.
  const top5 = data.top.slice(0, 5);
  const meInTop = uid ? data.top.find((r) => r.user_id === uid) : undefined;
  const inTop5 = !!meInTop && (meInTop.rank ?? 999) <= 5;
  const pinRow: LeaderRow | null = inTop5 ? null : (meInTop ?? data.caller ?? null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-heading text-2xl font-bold">Bảng xếp hạng tuần</h1>
        <span className="text-xs text-muted-foreground">Reset mỗi thứ Hai (tuần ISO) · từ {data.week_start}</span>
      </div>

      {top5.length === 0 ? (
        <Card>
          <p className="text-muted-foreground">Tuần này chưa ai có giờ học. Hãy học để lên bảng!</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {top5.map((r) => (
            <Row key={r.user_id} row={r} me={!!uid && r.user_id === uid} />
          ))}
        </div>
      )}

      {/* Ghim dòng của user nếu ngoài top 5 */}
      {pinRow ? (
        <>
          <p className="pt-2 text-center text-xs text-muted-foreground">— Vị trí của bạn —</p>
          <Row row={pinRow} me />
        </>
      ) : null}
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <AuthGuard>
      <LeaderboardInner />
    </AuthGuard>
  );
}

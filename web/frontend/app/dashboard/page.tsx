"use client";
import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { Card } from "@/components/ui/Card";
import { PageLoading } from "@/components/ui/Spinner";
import { fetchDashboard, type Dashboard, type DayPoint } from "@/lib/account";

// Biểu đồ cột bằng div (không thêm thư viện chart — gọn, dễ reskin).
function BarChart({ data }: { data: DayPoint[] }) {
  const max = Math.max(1, ...data.map((d) => d.minutes));
  return (
    <div className="flex h-40 items-end gap-1 overflow-x-auto">
      {data.map((d) => (
        <div key={d.date} className="flex min-w-[14px] flex-1 flex-col items-center gap-1" title={`${d.date}: ${d.minutes} phút`}>
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t bg-primary"
              style={{ height: `${(d.minutes / max) * 100}%`, minHeight: d.minutes > 0 ? "3px" : "0" }}
            />
          </div>
          <span className="text-[9px] text-muted-foreground">{d.date.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

function DashboardInner() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<"week" | "month">("week");

  useEffect(() => {
    fetchDashboard()
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (error) return <Card><p className="text-sm text-red-600">Không tải được dashboard: {error}</p></Card>;
  if (!data) return <PageLoading label="Đang tải dashboard…" />;

  const goal = data.daily_commit_minutes || 30;
  const pct = Math.min(100, Math.round((data.today_minutes / goal) * 100));
  const points = range === "week" ? data.week : data.month;

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl font-bold">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="flex items-center gap-4">
          <span className={`text-4xl ${data.today_met ? "" : "grayscale opacity-50"}`} aria-hidden>
            🔥
          </span>
          <div>
            <p className="text-3xl font-bold">{data.streak}</p>
            <p className="text-sm text-muted-foreground">
              ngày streak {data.today_met ? "· hôm nay đã đạt" : "· hôm nay chưa đạt"}
            </p>
          </div>
        </Card>

        <Card>
          <p className="text-sm text-muted-foreground">Hôm nay</p>
          <p className="mt-1 font-medium">
            {data.today_minutes} / {goal} phút
          </p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
        </Card>
      </div>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">Giờ học theo ngày (phút)</h2>
          <div className="flex gap-1">
            <button
              onClick={() => setRange("week")}
              className={`rounded-btn px-3 py-1 text-sm ${range === "week" ? "bg-primary text-primary-foreground" : "border border-border"}`}
            >
              Tuần
            </button>
            <button
              onClick={() => setRange("month")}
              className={`rounded-btn px-3 py-1 text-sm ${range === "month" ? "bg-primary text-primary-foreground" : "border border-border"}`}
            >
              Tháng
            </button>
          </div>
        </div>
        {points.some((d) => d.minutes > 0) ? (
          <BarChart data={points} />
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Chưa có dữ liệu giờ học. Hãy học qua extension (timer) để thấy biểu đồ.
          </p>
        )}
      </Card>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardInner />
    </AuthGuard>
  );
}

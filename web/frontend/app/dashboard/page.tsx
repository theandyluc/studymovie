"use client";
import { useCallback, useEffect, useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageLoading } from "@/components/ui/Spinner";
import { fetchDashboard, type Dashboard, type DayPoint } from "@/lib/account";
import { fetchLevel, setLevel, LEVELS, type LevelProgress } from "@/lib/level";
import { WeeklyPlanTable } from "@/components/WeeklyPlan";

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

// Vòng tròn tiến độ (SVG) — % giờ đã học / giờ mục tiêu.
function ProgressRing({ percent, center }: { percent: number; center: string }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const p = Math.min(100, Math.max(0, percent));
  const off = circ * (1 - p / 100);
  return (
    <div className="relative h-28 w-28">
      <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="9" className="stroke-surface-muted" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          className="stroke-primary"
          strokeDasharray={circ}
          strokeDashoffset={off}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold">{center}</span>
        <span className="text-xs text-muted-foreground">{Math.round(p)}%</span>
      </div>
    </div>
  );
}

// Form chọn level (dùng cho nhập lần đầu + đổi level).
function LevelPicker({
  initial,
  saving,
  onSave,
  onCancel,
}: {
  initial: string;
  saving: boolean;
  onSave: (lv: string) => void;
  onCancel?: () => void;
}) {
  const [sel, setSel] = useState(initial);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <select
        value={sel}
        onChange={(e) => setSel(e.target.value)}
        className="rounded-btn border border-border px-3 py-2 text-sm"
      >
        {LEVELS.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>
      <Button onClick={() => onSave(sel)} disabled={saving}>
        {saving ? "Đang lưu…" : "Lưu"}
      </Button>
      {onCancel ? (
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Hủy
        </Button>
      ) : null}
    </div>
  );
}

// Section Level: 2 card (Level hiện tại + Mục tiêu tiếp theo) + nhập lần đầu + thông báo lên cấp.
function LevelSection() {
  const [lv, setLv] = useState<LevelProgress | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [congrats, setCongrats] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchLevel()
      .then((d) => {
        setLv(d);
        if (d.just_leveled_up && d.new_level) setCongrats(d.new_level);
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (level: string) => {
    setSaving(true);
    try {
      await setLevel(level);
      setEditing(false);
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (err) return <Card><p className="text-sm text-red-600">Không tải được level: {err}</p></Card>;
  if (!lv) return <Card><p className="text-sm text-muted-foreground">Đang tải level…</p></Card>;

  const congratsBanner = congrats ? (
    <div className="flex items-center justify-between rounded-card border border-primary bg-primary/10 px-4 py-3">
      <p className="text-sm font-medium">🎉 Chúc mừng! Bạn đã lên cấp {congrats}.</p>
      <button onClick={() => setCongrats(null)} className="text-sm text-muted-foreground hover:text-foreground">
        ✕
      </button>
    </div>
  ) : null;

  // Chưa nhập level → 1 card cho chọn.
  if (lv.needs_input) {
    return (
      <div className="space-y-4">
        {congratsBanner}
        <Card>
          <p className="text-sm text-muted-foreground">Level hiện tại</p>
          <p className="mt-1 text-sm">Chọn trình độ tiếng Anh hiện tại của bạn (A0–C2) để theo dõi mục tiêu.</p>
          <LevelPicker initial="A1" saving={saving} onSave={save} />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {congratsBanner}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Card Level hiện tại */}
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Level hiện tại</p>
            {!editing ? (
              <button onClick={() => setEditing(true)} className="text-xs text-muted-foreground hover:text-foreground">
                Đổi level
              </button>
            ) : null}
          </div>
          {editing ? (
            <LevelPicker initial={lv.current_level ?? "A1"} saving={saving} onSave={save} onCancel={() => setEditing(false)} />
          ) : (
            <p className="mt-1 text-4xl font-bold">{lv.current_level}</p>
          )}
        </Card>

        {/* Card Mục tiêu tiếp theo */}
        <Card className="flex items-center gap-4">
          {lv.is_max ? (
            <div>
              <p className="text-sm text-muted-foreground">Mục tiêu tiếp theo</p>
              <p className="mt-1 text-lg font-semibold">🏆 Đã đạt cấp cao nhất (C2)</p>
            </div>
          ) : (
            <>
              <div
                title={`Số giờ mục tiêu: ${lv.target_hours}h / Số giờ còn lại: ${lv.remaining_hours}h`}
              >
                <ProgressRing percent={lv.percent ?? 0} center={lv.target_level ?? ""} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Mục tiêu tiếp theo</p>
                <p className="mt-1 text-2xl font-bold">{lv.target_level}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {lv.studied_hours}h / {lv.target_hours}h
                </p>
                <p className="text-sm text-muted-foreground">Còn lại {lv.remaining_hours}h</p>
              </div>
            </>
          )}
        </Card>
      </div>
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

      <LevelSection />

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

      <WeeklyPlanTable />
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

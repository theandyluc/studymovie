"use client";
import { useCallback, useEffect, useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CircleStat } from "@/components/ui/CircleStat";
import { Skeleton } from "@/components/ui/Skeleton";
import { fetchDashboard, type Dashboard } from "@/lib/account";
import { fetchLevel, setLevel, LEVELS, type LevelProgress } from "@/lib/level";
import { WeeklyPlanTable } from "@/components/WeeklyPlan";
import { LeaderboardCard } from "@/components/LeaderboardCard";

/* ============================================================
   GIẢI THÍCH CHO KHÁCH — File: app/dashboard/page.tsx
   ------------------------------------------------------------
   Trang "Tiến độ học" — màn hình chính sau khi đăng nhập. Gồm:
   - Hàng trên: 3 vòng số liệu (tổng giờ học, số từ đã học, chuỗi ngày
     học liên tiếp) và thẻ Level (cấp hiện tại + mục tiêu cấp kế tiếp).
   - Hàng dưới: bảng "Kế hoạch tuần này" và thẻ "Bảng xếp hạng".
   Điểm hay: khi người dùng học ở tab/tiện ích khác rồi quay lại tab này,
   trang TỰ cập nhật số liệu mới mà không nhấp nháy (làm mới ngầm).
   ============================================================ */
// TIP-033 — format tổng phút → "12h30m" (theo Figma).
function fmtStudy(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h${m.toString().padStart(2, "0")}m` : `${m}m`;
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

// (Giải thích) Thẻ "Level": hiện cấp hiện tại và mục tiêu cấp kế tiếp.
// Nếu người dùng chưa từng chọn cấp → hiện ô cho chọn. Khi đủ giờ học để
// lên cấp, hệ thống báo "Chúc mừng bạn lên cấp". Người dùng có thể tự đổi cấp.
// Card Level (Figma): 1 card, 2 vòng tròn — Level hiện tại (ring trơn) + Mục tiêu (ring cung tím).
function LevelCard() {
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

  // TIP-054 — cập nhật "giờ đã học/mục tiêu" khi quay lại tab.
  useEffect(() => {
    load();
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", load);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", load);
    };
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

  if (err) return <Card><p className="text-sm text-danger-foreground">Không tải được level: {err}</p></Card>;
  if (!lv) return <Card><p className="text-sm text-muted-foreground">Đang tải</p></Card>;

  // Chưa nhập level → card cho chọn.
  if (lv.needs_input) {
    return (
      <Card>
        <p className="text-sm text-muted-foreground">Level hiện tại</p>
        <p className="mt-1 text-sm">Chọn trình độ tiếng Anh hiện tại của bạn (A0–C2) để theo dõi mục tiêu.</p>
        <LevelPicker initial="A1" saving={saving} onSave={save} />
      </Card>
    );
  }

  return (
    <Card>
      {congrats ? (
        <div className="mb-3 flex items-center justify-between rounded-btn border border-primary bg-primary/10 px-3 py-2">
          <p className="text-sm font-medium">🎉 Chúc mừng! Bạn đã lên cấp {congrats}.</p>
          <button onClick={() => setCongrats(null)} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
      ) : null}

      {editing ? (
        <div>
          <p className="text-sm text-muted-foreground">Đổi level hiện tại</p>
          <LevelPicker initial={lv.current_level ?? "A1"} saving={saving} onSave={save} onCancel={() => setEditing(false)} />
        </div>
      ) : (
        <div className="grid grid-cols-2 items-start gap-4">
          {/* Level hiện tại */}
          <div className="flex flex-col items-center gap-1">
            <CircleStat value={lv.current_level ?? "—"} label="Level hiện tại" />
            <button onClick={() => setEditing(true)} className="text-xs text-muted-foreground hover:text-foreground">
              Đổi level
            </button>
          </div>

          {/* Mục tiêu tiếp theo */}
          <div className="flex flex-col items-center gap-1">
            {lv.is_max ? (
              <>
                <span className="text-sm text-muted-foreground">Mục tiêu tiếp theo</span>
                <div className="flex h-[104px] items-center px-2 text-center text-base font-semibold">
                  🏆 Đã đạt cấp cao nhất (C2)
                </div>
              </>
            ) : (
              <>
                <CircleStat value={lv.target_level ?? "—"} label="Mục tiêu tiếp theo" percent={lv.percent ?? 0} />
                <p className="text-sm text-muted-foreground">
                  {lv.studied_hours}h / {lv.target_hours}h
                </p>
                <p className="text-xs text-muted-foreground">Còn lại {lv.remaining_hours}h</p>
              </>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function DashboardInner() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  // TIP-054 — tự refetch khi quay lại tab (extension ghi giờ học ở tab khác → web cập nhật ngay).
  // Refetch NGẦM: không reset data → không nháy skeleton (AC-2).
  useEffect(() => {
    const load = () => {
      fetchDashboard()
        .then(setData)
        .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    };
    load();
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", load);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", load);
    };
  }, []);

  if (error) return <Card><p className="text-sm text-danger-foreground">Không tải được dashboard: {error}</p></Card>;
  if (!data)
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-72 lg:col-span-2" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl font-bold">Tiến độ học</h1>

      {/* Hàng 1: 3 vòng stat | Level */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="grid grid-cols-3 gap-2">
            {/* TIP-076 — hiện thời gian học HÔM NAY (all-time đã có ở thẻ Level). */}
            <CircleStat label="Thời gian học hôm nay" value={fmtStudy(data.today_minutes ?? 0)} />
            <CircleStat label="Từ vựng đã học" value={String(data.vocab_learned ?? 0)} />
            <CircleStat label="Số ngày liên tiếp" value={String(data.streak)} />
          </div>
        </Card>

        <LevelCard />
      </div>

      {/* Hàng 2: Kế hoạch tuần | Bảng xếp hạng */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <WeeklyPlanTable />
        </div>
        <div className="lg:col-span-1">
          <LeaderboardCard />
        </div>
      </div>
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

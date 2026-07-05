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
   GIẢI THÍCH CHO KHÁCH — File: app/tien-do-hoc/page.tsx
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
    <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
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
// TIP-081 — tooltip "Mục tiêu tiếp theo": giờ dạng thập phân kiểu VN, làm tròn 1 số sau phẩy.
// 42h30m → 42.5 → "42,5h"; số nguyên (vd 42) → "42h" (không ép hiện ",0").
function fmtHoursVN(hours: number): string {
  return `${hours.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}h`;
}

function LevelCard() {
  const [lv, setLv] = useState<LevelProgress | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
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
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  // TIP-085 — card LUÔN cố định 374x174 (y hệt card stat) ở MỌI trạng thái (lỗi/đang tải/
  // chưa chọn level/đã chọn level) — trước đây chỉ trạng thái "đã chọn" mới cố định kích
  // thước, còn lại tự co giãn theo nội dung (p-6, không khai h/w) → lệch hàng với card stat.
  const cardCls = "flex h-[174px] w-[374px] items-center justify-center rounded-card border border-border bg-surface p-6 text-center";
  if (err) return <div className={cardCls}><p className="text-sm text-danger-foreground">Không tải được level: {err}</p></div>;
  if (!lv) return <div className={cardCls}><p className="text-sm text-muted-foreground">Đang tải</p></div>;

  // Chưa nhập level → card cho chọn. pt-[18px] để "Level hiện tại" cùng y với headline CircleStat
  // (card "đã chọn" bên dưới: cụm CircleStat bắt đầu từ pt-[18px] tính từ viền trên card).
  if (lv.needs_input) {
    return (
      <div className="h-[174px] w-[374px] rounded-card border border-border bg-surface px-6 pt-[18px] text-center">
        <p className="font-heading text-lg font-normal text-foreground">Level hiện tại</p>
        <p className="mt-1 text-sm">Chọn trình độ tiếng Anh hiện tại của bạn</p>
        <LevelPicker initial="A1" saving={saving} onSave={save} />
      </div>
    );
  }

  // TIP-081 — card 374x174 (y hệt kích thước/khoảng cách card stat: circle 100x100, pt 18px, gap label-circle 10px)
  return (
    <div className="h-[174px] w-[374px] rounded-card border border-border bg-surface">
      {congrats ? (
        <div className="mx-3 mt-3 flex items-center justify-between rounded-btn border border-primary bg-primary/10 px-3 py-2">
          <p className="text-sm font-medium">🎉 Chúc mừng! Bạn đã lên cấp {congrats}.</p>
          <button onClick={() => setCongrats(null)} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
      ) : null}

      <div className="flex items-start justify-center gap-[50px] pt-[18px]">
        {/* TIP-081 — Level hiện tại: CHỈ nhập 1 lần lúc đầu (needs_input ở trên), không cho đổi lại nữa. */}
        <div className="flex flex-col items-center gap-1">
          <CircleStat value={lv.current_level ?? "—"} label="Level hiện tại" valueClassName="text-[32px] font-medium" />
        </div>

        {/* Mục tiêu tiếp theo */}
        <div className="flex flex-col items-center gap-1">
          {lv.is_max ? (
            <>
              <span className="font-heading text-lg font-normal text-foreground">Mục tiêu tiếp theo</span>
              <div className="flex h-[100px] items-center px-2 text-center text-base font-semibold">
                🏆 Đã đạt cấp cao nhất (C2)
              </div>
            </>
          ) : (
            // TIP-081 — bỏ text luôn hiện; thay bằng tooltip 113x34 hiện khi hover vòng tròn.
            <div className="group relative">
              <CircleStat
                value={lv.target_level ?? "—"}
                label="Mục tiêu tiếp theo"
                percent={lv.percent ?? 0}
                valueClassName="text-[32px] font-medium"
              />
              {/* TIP-081 — tiếp tục chỉnh: gap -1px (1.1→0.1), py +2px (2.2→4.2), rồi phóng to +10%
                  (w 124→136.4, px 7.7→8.47, py 4.2→4.62, gap 0.1→0.11, text 11→12.1, radius 5.5→6.05). */}
              <div className="pointer-events-none absolute left-[calc(100%+8px)] top-[38px] flex w-max flex-col justify-center gap-[0.11px] whitespace-nowrap rounded-[6.05px] border border-border bg-surface px-[8.47px] py-[4.62px] text-[12.1px] font-medium tracking-[-0.03em] text-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                <p>
                  Số giờ đã học: <span>{fmtHoursVN(lv.studied_hours ?? 0)}</span>
                </p>
                <p>
                  Số giờ mục tiêu: <span>{fmtHoursVN(lv.target_hours ?? 0)}</span>
                </p>
                <p>
                  Số giờ còn lại: <span>{fmtHoursVN(lv.remaining_hours ?? 0)}</span>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
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
      {/* TIP-081 — Figma không có heading riêng trong nội dung (chỉ ở nav) → giữ h1 cho a11y/SEO nhưng ẩn hình ảnh */}
      <h1 className="sr-only">Tiến độ học</h1>

      {/* Hàng 1: 3 vòng stat | Level — 2 card cách nhau 24px, cả cụm căn giữa layout */}
      <div className="flex flex-wrap justify-center gap-6">
        {/* TIP-081 — card cố định 659x174 theo Figma (x=112,y=161). KHÔNG dùng <Card> (nó có sẵn p-6
            — Tailwind v4 sinh CSS theo thứ tự quét file nên "p-0" đè lên không chắc thắng), viết
            border/bg/radius trực tiếp để kiểm soát padding chính xác, tránh xung đột cascade. */}
        <div className="h-[174px] w-[659px] rounded-card border border-border bg-surface">
          <div className="flex items-start justify-center gap-[50px] pt-[18px]">
            {/* TIP-076 — hiện thời gian học HÔM NAY (all-time đã có ở thẻ Level). */}
            <CircleStat
              label="Thời gian học hôm nay"
              value={fmtStudy(data.today_minutes ?? 0)}
              valueClassName="text-lg font-medium"
            />
            <CircleStat
              label="Tổng thời gian đã học"
              value={fmtStudy(data.total_minutes ?? 0)}
              valueClassName="text-lg font-medium"
            />
            <CircleStat
              label="Số ngày liên tiếp"
              value={String(data.streak)}
              valueClassName="text-[32px] font-medium"
            />
          </div>
        </div>

        <LevelCard />
      </div>

      {/* Hàng 2: Kế hoạch tuần (659, thẳng theo card stat) | Bảng xếp hạng (374, thẳng theo card level) */}
      <div className="flex flex-wrap justify-center gap-6">
        <WeeklyPlanTable />
        <LeaderboardCard />
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

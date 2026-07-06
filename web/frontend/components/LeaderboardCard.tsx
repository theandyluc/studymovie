"use client";
import { useEffect, useRef, useState } from "react";
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
// TIP-081 — Figma: hạng 1-3 = ruy băng huy chương (vàng/bạc/đồng) đứng cạnh avatar (không đè lên); hạng 4+ chỉ hiện số thường.
// Vị trí gốc Figma (row "Frame 34" trong card Bảng xếp hạng, x=795,y=349): badge x=814,y=443 → tương đối 19,94.
const MEDAL_COLOR: Record<number, string> = { 1: "#F8D582", 2: "#D9D9D9", 3: "#C99A5B" };
function RibbonBadge({ rank }: { rank: number }) {
  return (
    <span className="relative h-10 w-10 shrink-0">
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M32.5 16.4288C32.5 17.9953 32.1848 19.5464 31.5723 20.9937C30.9598 22.441 30.0621 23.756 28.9304 24.8637C27.7986 25.9714 26.1954 26.5352 24.7167 27.1347C23.2181 27.7423 21.8963 28.1681 20.3125 28.3575C18.7171 28.1715 17.1272 28.049 15.6485 27.4495C14.1699 26.85 12.8263 25.9714 11.6946 24.8637C10.5629 23.756 9.6652 22.441 9.05272 20.9937C8.44024 19.5464 8.125 17.9953 8.125 16.4288C8.125 13.2651 9.40904 10.2309 11.6946 7.99385C13.9802 5.75678 17.0802 4.5 20.3125 4.5C23.5448 4.5 26.6448 5.75678 28.9304 7.99385C31.216 10.2309 32.5 13.2651 32.5 16.4288ZM12.8115 34.5V25.8306C14.3115 27.5 17.3116 28 20.3125 28.3575C23.3116 28 25.2934 26.7126 27.7934 25.7338V34.5H27.8115L20.3125 30.5L12.8115 34.5Z"
          fill={MEDAL_COLOR[rank] ?? MEDAL_COLOR[3]}
        />
      </svg>
      <span className="absolute inset-0 flex translate-y-[2px] items-center justify-center pb-3 text-sm font-bold text-[#fcfcfc]">
        {rank}
      </span>
    </span>
  );
}
function RankBadge({ rank }: { rank: number | null }) {
  if (rank == null) return null;
  if (rank <= 3) return <RibbonBadge rank={rank} />;
  // TIP-081 — khung 40x40 y hệt RibbonBadge (h-10 w-10, flex center) để số hạng 4+ căn dọc đúng tâm như badge.
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center text-sm font-semibold text-foreground">
      {rank}
    </span>
  );
}

// TIP-081 — badge→avatar 10px, avatar→tên 5px, tên→giờ đẩy sát phải (ml-auto) để cột giờ luôn thẳng hàng
// giữa các dòng (tên dài/ngắn khác nhau) — thay vì margin cố định 85px chỉ đúng cho đúng độ dài tên trong mock.
function Row({ row, me }: { row: LeaderRow; me?: boolean }) {
  const nameRef = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);

  // TIP-081 — chỉ hiện tooltip khi tên THẬT SỰ bị cắt (scrollWidth > clientWidth), không phải luôn hiện.
  useEffect(() => {
    const check = () => {
      const el = nameRef.current;
      if (el) setTruncated(el.scrollWidth > el.clientWidth);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [row.nickname]);

  return (
    <div className={`flex items-center px-2 py-1 ${me ? "rounded-[10px] bg-surface-muted" : "rounded-btn"}`}>
      <RankBadge rank={row.rank} />
      <span className="ml-[10px] shrink-0">
        <Avatar src={row.avatar_url} name={row.nickname} size={40} />
      </span>
      {/* TIP-081 — mr-[10px] đảm bảo LUÔN cách text giờ học tối thiểu 10px kể cả khi tên bị truncate.
          "(bạn)" tách RIÊNG khỏi span truncate của tên (shrink-0) — trước đây nằm chung 1 span nên
          tên dài (vd "Nguyễn Văn Minh Bạn") chiếm hết chỗ, đẩy "(bạn)" bị cắt mất theo dấu "…". */}
      <span className="group relative ml-[10px] mr-[10px] flex min-w-0 flex-1 items-baseline">
        <span ref={nameRef} className="font-heading truncate text-sm font-normal text-foreground">
          {row.nickname ?? "Người dùng"}
        </span>
        {me ? <span className="ml-1 shrink-0 text-xs text-primary">(bạn)</span> : null}
        {truncated ? (
          <span className="pointer-events-none absolute left-0 top-full z-10 mt-1 whitespace-nowrap rounded-btn border border-border bg-surface px-2 py-1 text-xs text-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
            {row.nickname ?? "Người dùng"}
          </span>
        ) : null}
      </span>
      <span className="ml-auto shrink-0 text-sm text-[#ccc]">{fmtHm(row.minutes)}</span>
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
    // TIP-081 — kích thước 374x448 theo Figma (thẳng theo card Level)
    <div className="flex h-[448px] w-[374px] flex-col rounded-card border border-border bg-surface px-6 pb-[13px] pt-[13px]">
      {/* TIP-081 — headline x=921,y=362 (Figma) → relative to card (795,349) = 126,13 */}
      <h2 className="font-heading text-center text-lg font-normal text-foreground">Bảng xếp hạng</h2>

      {/* TIP-058 — Tab pill 3 kỳ chạy thật */}
      <div className="mx-auto mt-[15px] flex rounded-pill border border-border p-0.5 text-sm">
        {TABS.map((t) => {
          const active = t.period === period;
          return (
            <button
              key={t.period}
              onClick={() => setPeriod(t.period)}
              className={`font-heading rounded-pill px-3 py-1 text-xs font-normal transition-colors ${
                active ? "bg-[#e6e6e6] text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* TIP-081 — h-448 cố định: bỏ dòng kẻ ghim (hạng 6 giờ liền kề top 5, không "xa" nữa) +
          giảm padding dòng + gap 8px (chẵn) để đúng 6 dòng vừa khít trong card, không tràn. */}
      <div className="mt-3 flex-1 space-y-[8px]">
        {error ? (
          <p className="text-sm text-danger-foreground">Không tải được: {error}</p>
        ) : !data ? (
          <p className="text-sm font-normal tracking-[-0.03em] text-foreground">Đang tải…</p>
        ) : top5.length === 0 ? (
          <p className="py-6 text-center text-sm font-normal text-foreground">{EMPTY_TEXT[period]}</p>
        ) : (
          <>
            {top5.map((r) => (
              <Row key={r.user_id} row={r} me={!!uid && r.user_id === uid} />
            ))}
            {pinRow ? <Row row={pinRow} me /> : null}
          </>
        )}
      </div>
    </div>
  );
}

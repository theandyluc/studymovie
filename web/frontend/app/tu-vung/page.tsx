"use client";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { fetchVocab, addVocab, deleteVocab, STUDY_SELECTION_KEY, type VocabItem } from "@/lib/vocabulary";
import { toast, confirmDialog } from "@/components/ui/feedback";
import { DeleteIcon, CheckboxIcon } from "@/components/ui/icons";

/* ============================================================
   GIẢI THÍCH CHO KHÁCH — File: app/tu-vung/page.tsx
   ------------------------------------------------------------
   Trang "Từ vựng" — quản lý toàn bộ từ đã lưu. Gồm:
   - Biểu đồ cột "Từ vựng đã học theo ngày" + vòng tròn tổng số từ đã học.
   - Bảng danh sách từ: số thứ tự, từ (kèm phiên âm + nút loa), nghĩa,
     ngày thêm, trạng thái ("Từ mới"/"Đã học").
   - Công cụ: ô tìm kiếm, lọc theo ngày, lọc theo trạng thái, phân trang.
   - Thêm từ thủ công; xoá từ (có hỏi xác nhận).
   - Tích chọn từ rồi bấm "Học các từ đã chọn" để sang trang Flashcard.
   Phần dưới có một số hàm phụ trợ (định dạng ngày, tính trục biểu đồ) —
   mỗi hàm đều có chú thích riêng ngay phía trên.
   ============================================================ */
// (Giải thích) Phát file âm thanh đọc từ (khi bấm nút loa 🔊).
function playAudio(url: string): void {
  try {
    void new Audio(url).play();
  } catch {
    /* ignore */
  }
}
// TIP-081 — luôn dd/mm/yyyy có số 0 đứng trước (toLocaleDateString tùy trình duyệt có thể trả "5/7/2026").
const fmtDate = (s: string): string => {
  const d = new Date(s);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
};
const inputCls = "rounded-btn border border-border px-3 py-2 text-sm";
const PAGE_SIZE = 6;

const dayKeyVN = (iso: string): string => new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString().slice(0, 10);
function parseVNDate(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const dd = m[1].padStart(2, "0"), mm = m[2].padStart(2, "0");
  return `${m[3]}-${mm}-${dd}`;
}

type StatusFilter = "all" | "new" | "learned";

// TIP-064 — trục Y "đẹp": step nice-number (1/2/5 × 10^n), ~4 mốc tròn (0/2/4, 0/10/20/30…).
// Đếm từ = số nguyên → kẹp step ≥ 1 (không có mốc lẻ 0.5).
function niceAxis(rawMax: number): { niceMax: number; ticks: number[] } {
  const target = 3; // ~3 khoảng → ~4 mốc
  const rough = Math.max(1, rawMax) / target;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  const rawStep = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const step = Math.max(1, Math.round(rawStep)); // số nguyên
  const niceMax = Math.max(step, Math.ceil(rawMax / step) * step);
  const ticks: number[] = [];
  for (let t = niceMax; t >= 0; t -= step) ticks.push(t);
  return { niceMax, ticks };
}

// TIP-081 — card cố định 366x229 theo Figma. LUÔN đúng 7 ngày gần nhất (bỏ cửa sổ co giãn cũ).
// Cột: width 20px cố định, cách nhau 20px, fill #e6e6e6, hover #c0e1ff (đổi qua token chart-base/chart-bar).
function LearnedChart({ items }: { items: VocabItem[] }) {
  const days = useMemo(() => {
    const base = new Date(Date.now() + 7 * 3600_000);
    base.setUTCHours(0, 0, 0, 0); // UTC-midnight của ngày hôm nay theo giờ VN
    const todayMs = base.getTime();
    const learnedKeys = items.filter((i) => i.learned_at).map((i) => dayKeyVN(i.learned_at as string));
    return Array.from({ length: 7 }, (_, idx) => {
      const d = new Date(todayMs - (6 - idx) * 86400_000);
      const key = d.toISOString().slice(0, 10);
      return { key, label: `${key.slice(8, 10)}/${key.slice(5, 7)}`, count: learnedKeys.filter((k) => k === key).length };
    });
  }, [items]);
  const rawMax = Math.max(1, ...days.map((d) => d.count));
  const { niceMax, ticks } = niceAxis(rawMax);

  return (
    <div className="h-[229px] w-[366px] rounded-card border border-border bg-surface p-4">
      <h2 className="font-heading text-center text-lg font-normal text-foreground">Từ vựng đã học theo ngày</h2>
      <div className="mt-[17px] flex h-[130px] gap-2">
        {/* trục y — số tròn căn phải, xám 9px, medium; đặt tuyệt đối để tâm chữ trùng đúng tâm line lưới */}
        <div className="relative w-6 py-1 text-right text-[9px] font-medium tabular-nums text-[#cccccc]">
          {ticks.map((t, i) => (
            <span
              key={i}
              className="absolute right-[5px] -translate-y-1/2"
              style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}
            >
              {t}
            </span>
          ))}
        </div>
        {/* cột — width 20px cố định, cách nhau 20px */}
        <div className="relative flex h-full flex-1 items-end gap-[20px]">
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
            {ticks.map((_, i) => (
              <div key={i} className="border-t border-border/50" />
            ))}
          </div>
          {days.map((d) => (
            <div key={d.key} className="group relative flex h-full w-[20px] shrink-0 flex-col items-center justify-end" title={`${d.label}: ${d.count} từ`}>
              <div
                className="relative w-[20px] rounded-t-md bg-chart-base transition-colors group-hover:bg-chart-bar"
                style={{ height: `${(d.count / niceMax) * 100}%`, minHeight: d.count > 0 ? "4px" : "0" }}
              >
                <span className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 flex h-[32.4px] w-[48.6px] -translate-x-1/2 items-center justify-center whitespace-nowrap rounded-lg border border-border bg-surface text-[16.2px] font-medium opacity-0 transition-opacity group-hover:opacity-100">
                  {d.count}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* TIP-081 — ml-[32px] = w-6 (24px) trục y + gap-2 (8px) của hàng cột phía trên, để label thẳng
          hàng đúng tâm mỗi cột (trước đó thiếu 8px gap này → label bị lệch trái so với cột). */}
      <div className="ml-[30px] mt-1 flex gap-[20px]">
        {days.map((d) => (
          <span key={d.key} className="w-[20px] shrink-0 text-center text-[9px] font-medium text-[#cccccc]">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// TIP-081 — card cố định 366x229; vòng tròn 135x135, số 48px, letter-spacing -3%.
// Heading top-align bằng p-4 (giống LearnedChart) để 2 heading 2 card cùng hàng ngang đúng y;
// vòng tròn cách heading đúng 24px (mt-[24px]) thay vì canh giữa cả khối theo chiều dọc như trước.
function TotalLearnedRing({ count }: { count: number }) {
  return (
    <div className="h-[229px] w-[366px] rounded-card border border-border bg-surface p-4">
      <h2 className="font-heading text-center text-lg font-normal text-foreground">Tổng số từ vựng đã học</h2>
      <div className="mt-[24px] flex justify-center">
        <div className="flex h-[135px] w-[135px] items-center justify-center rounded-full border-[1.5px] border-border">
          <span className="font-heading text-[44px] font-semibold tracking-[-0.03em] text-foreground">{count}</span>
        </div>
      </div>
    </div>
  );
}

// TIP-081 — đóng popup khi chuột rời khỏi HÌNH CHỮ NHẬT GỘP (bounding box) của nút bấm + popup,
// thay vì dùng onMouseLeave gốc của DOM: popup được đặt bằng absolute lệch xa nút (để khớp vị trí
// dòng đầu tiên trong bảng) nên đường chuột di chuyển từ nút tới popup có thể lướt qua phần tử khác
// (không phải con cháu của wrapper) → mouseleave gốc sẽ tắt popup oan giữa chừng. Cách này tự tính
// toạ độ chuột so với hình chữ nhật gộp của cả 2 khối, bất kể có khe hở hay phần tử xen giữa.
function useCloseOnLeaveRect(open: boolean, close: () => void, refs: Array<RefObject<HTMLElement | null>>): void {
  useEffect(() => {
    if (!open) return;
    const onMove = (e: MouseEvent) => {
      const rects = refs.map((r) => r.current?.getBoundingClientRect()).filter((r): r is DOMRect => !!r);
      if (rects.length === 0) return;
      const left = Math.min(...rects.map((r) => r.left));
      const right = Math.max(...rects.map((r) => r.right));
      const top = Math.min(...rects.map((r) => r.top));
      const bottom = Math.max(...rects.map((r) => r.bottom));
      if (e.clientX < left || e.clientX > right || e.clientY < top || e.clientY > bottom) {
        close();
      }
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [open]);
}

// Icon phễu lọc (header cột).
// TIP-081 — icon filter theo Figma (thay ký tự ▽).
function FilterIcon({
  active,
  onClick,
  onClear,
}: {
  active: boolean;
  onClick: () => void;
  onClear?: () => void;
}) {
  return (
    <span className="relative ml-1 inline-flex align-middle">
      <button
        onClick={onClick}
        aria-label="Lọc"
        className={`inline-flex ${active ? "text-primary" : "text-[#cccccc] hover:text-foreground"}`}
      >
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M12.5 1.875H2.5C2.33424 1.875 2.17527 1.94085 2.05806 2.05806C1.94085 2.17527 1.875 2.33424 1.875 2.5V3.49125C1.87504 3.657 1.94091 3.81594 2.05812 3.93313L6.06687 7.94188C6.18409 8.05906 6.24996 8.218 6.25 8.38375V12.0119C6.25 12.1512 6.29656 12.2865 6.38228 12.3964C6.46801 12.5062 6.58797 12.5843 6.72312 12.6181L7.97312 12.9306C8.06528 12.9537 8.16149 12.9555 8.25443 12.9358C8.34738 12.9161 8.43461 12.8755 8.50951 12.8171C8.58441 12.7586 8.64499 12.6839 8.68666 12.5985C8.72834 12.5131 8.75 12.4194 8.75 12.3244V8.38375C8.75004 8.218 8.81591 8.05906 8.93313 7.94188L12.9419 3.93313C13.0591 3.81594 13.125 3.657 13.125 3.49125V2.5C13.125 2.33424 13.0592 2.17527 12.9419 2.05806C12.8247 1.94085 12.6658 1.875 12.5 1.875Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {active && onClear ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          aria-label="Xóa lọc"
          className="absolute -bottom-1 -right-1 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-primary text-[7px] leading-none text-white"
        >
          ×
        </button>
      ) : null}
    </span>
  );
}

function VocabList() {
  const router = useRouter();
  const [items, setItems] = useState<VocabItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Form thêm từ (toggle inline)
  const [showAdd, setShowAdd] = useState(false);
  const [word, setWord] = useState("");
  const [meaning, setMeaning] = useState("");
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState<string | null>(null);
  // Search + lọc + phân trang
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [dateInput, setDateInput] = useState("");
  const [dateApplied, setDateApplied] = useState("");
  const [page, setPage] = useState(1);
  const [openFilter, setOpenFilter] = useState<null | "date" | "status">(null);
  const filterRef = useRef<HTMLDivElement | null>(null);
  // TIP-081 — vùng "còn hover" phải là HÌNH CHỮ NHẬT gộp (bounding box) của nút bấm + popup,
  // không phải mouseleave gốc của trình duyệt (dễ tắt nhầm khi chuột lướt qua khe hở giữa 2 khối
  // do popup lệch xa nút bằng absolute). Theo dõi bằng mousemove + so toạ độ, không phụ thuộc DOM.
  const addWrapRef = useRef<HTMLDivElement | null>(null);
  const addPopupRef = useRef<HTMLDivElement | null>(null);
  const dateWrapRef = useRef<HTMLDivElement | null>(null);
  const datePopupRef = useRef<HTMLDivElement | null>(null);
  const statusWrapRef = useRef<HTMLDivElement | null>(null);
  const statusPopupRef = useRef<HTMLDivElement | null>(null);
  useCloseOnLeaveRect(showAdd, () => setShowAdd(false), [addWrapRef, addPopupRef]);
  useCloseOnLeaveRect(openFilter === "date", () => setOpenFilter(null), [dateWrapRef, datePopupRef]);
  useCloseOnLeaveRect(openFilter === "status", () => setOpenFilter(null), [statusWrapRef, statusPopupRef]);

  useEffect(() => {
    fetchVocab()
      .then(setItems)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  // TIP-073 — tự cập nhật khi quay lại tab (vd vừa lưu từ qua extension). Chỉ setItems (không set null
  // nên không nháy loading); filter/trang/selected giữ nguyên.
  useEffect(() => {
    const refetch = () => {
      if (document.visibilityState === "visible") fetchVocab().then(setItems).catch(() => {});
    };
    document.addEventListener("visibilitychange", refetch);
    window.addEventListener("focus", refetch);
    return () => {
      document.removeEventListener("visibilitychange", refetch);
      window.removeEventListener("focus", refetch);
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, status, dateApplied]);

  const onAdd = async () => {
    const w = word.trim();
    const m = meaning.trim();
    if (!w || !m) {
      setAddMsg("Nhập đủ Từ Tiếng Anh và Nghĩa Tiếng Việt.");
      return;
    }
    setAdding(true);
    setAddMsg(null);
    try {
      const r = await addVocab(w, m);
      if (r.duplicate || !r.item) {
        setAddMsg(`Đã có từ "${w}" trong danh sách.`);
      } else {
        setItems((cur) => [r.item as VocabItem, ...(cur ?? [])]);
        setWord("");
        setMeaning("");
        setShowAdd(false);
      }
    } catch (e) {
      setAddMsg("Không thêm được từ: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setAdding(false);
    }
  };

  const onDelete = async (it: VocabItem) => {
    if (!(await confirmDialog({ title: `Xóa từ "${it.word}"?`, danger: true, confirmText: "Xóa" }))) return;
    setBusy(it.id);
    try {
      await deleteVocab(it.id);
      setItems((cur) => (cur ?? []).filter((x) => x.id !== it.id));
    } catch (e) {
      toast("Xóa lỗi: " + (e instanceof Error ? e.message : String(e)), "error");
    } finally {
      setBusy(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const studyAll = () => {
    try {
      sessionStorage.removeItem(STUDY_SELECTION_KEY);
    } catch {
      /* ignore */
    }
    router.push("/hoc-tu-vung");
  };
  const studySelected = () => {
    if (selected.size === 0) {
      studyAll();
      return;
    }
    try {
      sessionStorage.setItem(STUDY_SELECTION_KEY, JSON.stringify([...selected]));
    } catch {
      /* ignore */
    }
    router.push("/hoc-tu-vung");
  };

  const applyDate = () => {
    const key = parseVNDate(dateInput);
    setDateApplied(dateInput.trim() === "" ? "" : (key ?? "__invalid__"));
    setOpenFilter(null);
  };
  const clearDate = () => {
    setDateInput("");
    setDateApplied("");
  };

  // (Giải thích) Lọc danh sách từ theo cả 3 điều kiện cùng lúc: từ khoá tìm
  // kiếm, trạng thái (tất cả / từ mới / đã học), và ngày thêm. Kết quả này
  // là danh sách hiển thị trong bảng.
  const filtered = useMemo(() => {
    const all = items ?? [];
    const q = search.trim().toLowerCase();
    return all.filter((it) => {
      if (q && !(it.word.toLowerCase().includes(q) || (it.meaning_vi ?? "").toLowerCase().includes(q))) return false;
      if (status === "new" && it.learned_at) return false;
      if (status === "learned" && !it.learned_at) return false;
      if (dateApplied && dateApplied !== "__invalid__" && dayKeyVN(it.created_at) !== dateApplied) return false;
      return true;
    });
  }, [items, search, status, dateApplied]);

  if (error) {
    return (
      <Card>
        <p className="text-sm text-danger-foreground">Không tải được từ vựng: {error}</p>
      </Card>
    );
  }
  if (!items)
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );

  const totalLearned = items.filter((i) => i.learned_at).length;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, pageCount);
  const start = (pageSafe - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  // Chọn tất cả (theo bộ lọc hiện tại, mọi trang).
  const filteredIds = filtered.map((i) => i.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
  const toggleAll = () => {
    setSelected((cur) => {
      const next = new Set(cur);
      if (allSelected) filteredIds.forEach((id) => next.delete(id));
      else filteredIds.forEach((id) => next.add(id));
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Hàng 1: biểu đồ + vòng tròn tổng — 2 card 366x229, cách nhau 25px (theo Figma), căn giữa layout */}
      <div className="flex flex-wrap justify-center gap-[25px]">
        <LearnedChart items={items} />
        <TotalLearnedRing count={totalLearned} />
      </div>

      {/* TIP-081 — card 880x333, căn giữa layout. Headline "Danh sách từ vựng" KHÔNG nằm trong card
          (Figma: x=217,y=406, ngoài card) → tách thành toolbar riêng phía trên, cùng hàng với search+button. */}
      <div className="mx-auto w-[880px]">
        {/* Toolbar ngoài card: tiêu đề (trái) + search 271x32 + nút Thêm (cách nhau 8px, phải) */}
        <div className="relative flex flex-wrap items-center gap-3 pb-[17px] pl-[17px]">
          <h2 className="font-heading text-lg font-normal text-foreground">Danh sách từ vựng</h2>
          {/* TIP-081 — cả cụm dịch trái 5px (-ml-[5px] thay vì ml-auto căn sát phải) */}
          <div className="ml-auto mr-[11px] flex items-center gap-[8px]">
            <div className="relative h-[32px] w-[271px]">
              <svg
                width="16"
                height="16"
                viewBox="0 0 22 22"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2"
              >
                <path
                  d="M19.2502 19.25L15.2691 15.2689M15.2691 15.2689C15.9501 14.5879 16.4903 13.7795 16.8588 12.8898C17.2274 12 17.417 11.0464 17.417 10.0833C17.417 9.12029 17.2274 8.16667 16.8588 7.27692C16.4903 6.38718 15.9501 5.57874 15.2691 4.89776C14.5881 4.21678 13.7797 3.67659 12.8899 3.30805C12.0002 2.9395 11.0466 2.74982 10.0835 2.74982C9.12047 2.74982 8.16685 2.9395 7.2771 3.30805C6.38736 3.67659 5.57892 4.21678 4.89794 4.89776C3.52264 6.27306 2.75 8.13837 2.75 10.0833C2.75 12.0283 3.52264 13.8936 4.89794 15.2689C6.27324 16.6442 8.13855 17.4169 10.0835 17.4169C12.0285 17.4169 13.8938 16.6442 15.2691 15.2689Z"
                  stroke="#CCCCCC"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <input
                className={`${inputCls} h-[32px] w-[271px] pl-8`}
                placeholder="Tìm kiếm…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div ref={addWrapRef} className="inline-flex">
              <Button variant="info" onClick={() => setShowAdd((s) => !s)} className="h-[32px] w-[137px] font-normal">
                + Thêm từ vựng
              </Button>
            </div>
          </div>

          {/* TIP-081 — form thêm từ nổi gần viền phải card (không phải khối full-width bên dưới nữa):
              đúng 3 ô — Từ Tiếng Anh, Nghĩa Tiếng Việt, nút Lưu — theo ảnh mẫu. */}
          {showAdd ? (
            <div ref={addPopupRef} className="absolute right-[-167px] top-0 z-20 flex w-[160px] flex-col gap-2">
              <input
                className={`${inputCls} h-[32px]`}
                placeholder="Từ Tiếng Anh"
                value={word}
                onChange={(e) => {
                  setWord(e.target.value);
                  setAddMsg(null);
                }}
              />
              <input
                className={`${inputCls} h-[32px]`}
                placeholder="Nghĩa Tiếng Việt"
                value={meaning}
                onChange={(e) => {
                  setMeaning(e.target.value);
                  setAddMsg(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void onAdd();
                }}
              />
              <button
                type="button"
                onClick={onAdd}
                disabled={adding}
                className="h-[32px] rounded-[5px] bg-success px-3 text-sm font-normal text-success-foreground disabled:opacity-50"
              >
                {adding ? "Đang lưu…" : "Lưu"}
              </button>
              {addMsg ? <span className="text-xs text-muted-foreground">{addMsg}</span> : null}
            </div>
          ) : null}
        </div>

        {/* Card bảng — h cố định 333px (PAGE_SIZE=6 dòng vừa khít). KHÔNG có px-6 ở container: line
            dưới header/mỗi dòng cần full width sát viền card, nên padding ngang chuyển xuống từng
            phần con (form/table cell/footer) thay vì bọc ở ngoài. */}
        {/* TIP-081 — bỏ h cố định: 6 dòng đầy đủ tự nhiên = đúng 343.5px (pt+thead+tbody+mt+footer+pb
            đã tính khớp), nhưng khi trang cuối ít hơn 6 từ, card tự co viền dưới theo đúng số dòng
            thật, vẫn giữ đúng khoảng cách 8px trên/dưới nút "Học các từ đã chọn". */}
        <div className="w-[880px] rounded-card border border-border bg-surface pb-[7.5px] pt-[6px]">
        {/* Bảng */}
        {items.length === 0 ? (
          <p className="mx-6 mt-4 text-muted-foreground">
            Chưa có từ nào. Thêm ở trên, hoặc lưu từ khi xem video bằng extension StudyMovie.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                {/* TIP-081 — colgroup để cột dữ liệu (STT/Từ vựng/Nghĩa/Ngày thêm) khớp đúng vị trí
                    header phía trên (đo thật bằng Playwright: STT text x=37, Từ vựng x=119, Nghĩa
                    x=243, Ngày thêm x=403 → quy ra width từng cột). Cột còn lại để auto theo nội dung. */}
                <colgroup>
                  <col style={{ width: 118 }} />
                  <col style={{ width: 125 }} />
                  <col style={{ width: 175 }} />
                  <col style={{ width: 149 }} />
                  <col style={{ width: 90 }} />
                  <col style={{ width: 183 }} />
                </colgroup>
                <thead>
                  {/* TIP-081 — header là 1 hàng flex phủ full (colSpan) thay vì mỗi nhãn 1 <th> riêng,
                      vì <th>/<td> không nhận margin (chỉ padding) nên không thể tạo khoảng cách tuyệt đối
                      "cách chữ trước Npx" giữa các nhãn nếu để mỗi nhãn là 1 cột riêng. */}
                  <tr className="border-b border-border text-left text-[#ccc]">
                    <th colSpan={7} className="p-0 font-normal">
                      <div className="relative flex h-9 items-center text-sm">
                        <span className="pl-[37px]">STT</span>
                        <span className="ml-[51px]">Từ vựng</span>
                        <span className="ml-[76px]">Nghĩa</span>
                        <div ref={dateWrapRef} className="relative ml-[138px] flex items-center">
                          <span>Ngày thêm</span>
                          <FilterIcon
                            active={!!dateApplied}
                            onClick={() => setOpenFilter((f) => (f === "date" ? null : "date"))}
                            onClear={clearDate}
                          />
                          {openFilter === "date" ? (
                            <div
                              ref={(el) => {
                                filterRef.current = el;
                                datePopupRef.current = el;
                              }}
                              className="absolute left-[-16.5px] top-[36.5px] z-20 flex items-center gap-[2px] text-left font-normal normal-case text-foreground"
                            >
                              <input
                                className="h-[26px] w-[104px] rounded-[5px] border border-border bg-white px-2 text-[10px] leading-[12px]"
                                placeholder="DD/MM/YYYY"
                                value={dateInput}
                                onChange={(e) => setDateInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") applyDate();
                                }}
                              />
                              <button
                                type="button"
                                onClick={applyDate}
                                className="h-[26px] w-[50px] whitespace-nowrap rounded-[5px] bg-success text-[10px] font-normal leading-[12px] text-success-foreground"
                              >
                                Áp dụng
                              </button>
                              {dateApplied === "__invalid__" ? (
                                <p className="absolute left-0 top-[36px] whitespace-nowrap text-xs text-danger-foreground">Ngày không hợp lệ.</p>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        <div ref={statusWrapRef} className="relative ml-[61px] flex items-center">
                          <span>Trạng thái</span>
                          <FilterIcon
                            active={status !== "all"}
                            onClick={() => setOpenFilter((f) => (f === "status" ? null : "status"))}
                            onClear={() => setStatus("all")}
                          />
                          {openFilter === "status" ? (
                            <div ref={statusPopupRef} className="absolute left-[5.35px] top-[37.5px] z-20 flex w-max gap-[5px] text-left normal-case">
                              <button
                                type="button"
                                onClick={() => {
                                  setStatus("learned");
                                  setOpenFilter(null);
                                }}
                                className="flex h-[24px] w-[64px] items-center justify-center whitespace-nowrap rounded-pill border border-current bg-white text-sm font-normal text-success-foreground"
                              >
                                Đã học
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setStatus("new");
                                  setOpenFilter(null);
                                }}
                                className="flex h-[24px] w-[64px] items-center justify-center whitespace-nowrap rounded-pill border border-current bg-white text-sm font-normal text-danger-foreground"
                              >
                                Từ mới
                              </button>
                            </div>
                          ) : null}
                        </div>
                        {/* TIP-081 — cách filter "Trạng thái" 62px; chữ trước, checkbox sau (đổi chỗ),
                            dùng CheckboxIcon dùng chung để đồng bộ style với checkbox trong bảng. */}
                        <button
                          type="button"
                          onClick={toggleAll}
                          aria-label="Chọn tất cả từ (theo bộ lọc)"
                          className="ml-[62px] mr-2 inline-flex cursor-pointer items-center gap-1.5"
                        >
                          <span>Học từ này?</span>
                          <CheckboxIcon checked={allSelected} />
                        </button>
                        <span className="w-10 pr-6" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-muted-foreground">
                        Không có từ khớp bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    pageItems.map((it, i) => (
                      <tr
                      key={it.id}
                      onClick={() => toggleSelect(it.id)}
                      className="group h-[42px] cursor-pointer border-b border-border transition-colors hover:bg-surface-muted"
                    >
                        {/* TIP-081 — bỏ py-2 (td dùng vertical-align:middle mặc định để tự căn giữa
                            theo chiều cao 42px của <tr>); pl-6/pr-6 ở cột đầu/cuối bù cho card bỏ px-6. */}
                        {/* TIP-081 — bỏ text-center: kết hợp với pl-25 sẽ tự căn giữa lại trong phần
                            còn lại (lệch khỏi tâm chữ "STT" ở header) → chỉ dùng pl-[25px] cho đúng tâm. */}
                        <td className="pl-[25px] pr-2">
                          <span className="inline-flex h-[21px] w-[51px] items-center justify-center rounded-pill border border-border text-sm font-normal text-foreground">
                            {String(start + i + 1).padStart(3, "0")}
                          </span>
                        </td>
                        <td className="pr-2">
                          <span className="-ml-[5px] font-normal">{it.word}</span>
                          {it.audio_url ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                playAudio(it.audio_url as string);
                              }}
                              aria-label="Phát âm"
                              className="ml-1 align-middle text-sm"
                            >
                              🔊
                            </button>
                          ) : null}
                        </td>
                        <td className="pr-2">{it.meaning_vi || <span className="text-muted-foreground">—</span>}</td>
                        <td className="pr-2">{fmtDate(it.created_at)}</td>
                        {/* TIP-081 — cột cố định width (colgroup) đúng bằng vùng chữ "Trạng thái" ở header
                            + text-center → badge tự căn giữa cột, trùng tâm chữ header (margin âm trước đó
                            làm lệch cả cột kế bên do ảnh hưởng tới auto layout của table). */}
                        <td className="pr-2 text-center">
                          {it.learned_at ? <Badge tone="success">Đã học</Badge> : <Badge tone="danger">Từ mới</Badge>}
                        </td>
                        <td className="pr-2 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelect(it.id);
                            }}
                            aria-label={`Chọn học từ ${it.word}`}
                            className="inline-flex"
                          >
                            <CheckboxIcon checked={selected.has(it.id)} />
                          </button>
                        </td>
                        <td className="pr-6 text-center">
                          <button
                            disabled={busy === it.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              void onDelete(it);
                            }}
                            title="Xóa"
                            className="-ml-[15px] inline-flex text-[#cccccc] transition-colors hover:text-[#1f1f1f]"
                          >
                            <DeleteIcon />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer: đếm + phân trang + Học các từ đã chọn */}
            <div className="relative mx-6 mt-[7.5px] flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
              <span className="ml-[5px] text-xs font-normal text-[#ccc]">
                {filtered.length === 0 ? (
                  "Hiển thị 0 trong tổng số 0 từ vựng"
                ) : (
                  <>
                    Hiển thị <span className="font-normal text-foreground">{start + 1}</span>
                    <span className="font-normal text-foreground">–</span>
                    <span className="font-normal text-foreground">{start + pageItems.length}</span> trong tổng số{" "}
                    <span className="font-normal text-foreground">{filtered.length}</span> từ vựng
                  </>
                )}
              </span>
              {/* TIP-081 — cố định combo phân trang tại đúng tâm card (absolute + left-1/2 -translate-x-1/2),
                  không phụ thuộc độ rộng text/nút 2 bên (vốn thay đổi theo số liệu/số từ đã chọn). */}
              <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-1">
                <button
                  type="button"
                  disabled={pageSafe <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="inline-flex items-center justify-center px-1 text-[15.4px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ‹
                </button>
                <span className="px-1">
                  {pageSafe}/{pageCount}
                </span>
                <button
                  type="button"
                  disabled={pageSafe >= pageCount}
                  onClick={() => setPage((p) => p + 1)}
                  className="inline-flex items-center justify-center px-1 text-[15.4px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ›
                </button>
              </div>
              <button
                type="button"
                onClick={studySelected}
                className="inline-flex h-[32px] items-center justify-center rounded-btn bg-info px-3 text-sm font-normal text-info-foreground hover:opacity-90"
              >
                Học các từ đã chọn{selected.size > 0 ? ` (${selected.size})` : ""}
              </button>
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
}

export default function VocabularyPage() {
  return (
    <AuthGuard>
      <VocabList />
    </AuthGuard>
  );
}

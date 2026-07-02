"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { fetchVocab, addVocab, deleteVocab, STUDY_SELECTION_KEY, type VocabItem } from "@/lib/vocabulary";
import { toast, confirmDialog } from "@/components/ui/feedback";

function playAudio(url: string): void {
  try {
    void new Audio(url).play();
  } catch {
    /* ignore */
  }
}
const fmtDate = (s: string): string => new Date(s).toLocaleDateString("vi-VN");
const inputCls = "rounded-btn border border-border px-3 py-2 text-sm";
const PAGE_SIZE = 10;

const dayKeyVN = (iso: string): string => new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString().slice(0, 10);
function parseVNDate(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const dd = m[1].padStart(2, "0"), mm = m[2].padStart(2, "0");
  return `${m[3]}-${mm}-${dd}`;
}

type StatusFilter = "all" | "new" | "learned";

// Biểu đồ 7 ngày (Figma): cột xám + cột cao nhất xanh + tooltip hộp số; có trục y + lưới.
function LearnedChart({ items }: { items: VocabItem[] }) {
  const days = useMemo(() => {
    const base = new Date(Date.now() + 7 * 3600_000);
    base.setUTCHours(0, 0, 0, 0);
    const learnedKeys = items.filter((i) => i.learned_at).map((i) => dayKeyVN(i.learned_at as string));
    return Array.from({ length: 7 }, (_, idx) => {
      const d = new Date(base.getTime() - (6 - idx) * 86400_000);
      const key = d.toISOString().slice(0, 10);
      return { key, label: `${key.slice(8, 10)}/${key.slice(5, 7)}`, count: learnedKeys.filter((k) => k === key).length };
    });
  }, [items]);
  const max = Math.max(1, ...days.map((d) => d.count));
  const ticks = [max, Math.round((max * 2) / 3), Math.round(max / 3), 0];

  return (
    <Card>
      <h2 className="mb-4 text-center font-medium">Từ vựng đã học theo ngày</h2>
      <div className="flex gap-2">
        {/* trục y */}
        <div className="flex h-40 flex-col justify-between py-1 text-[10px] text-muted-foreground">
          {ticks.map((t, i) => (
            <span key={i}>{t}</span>
          ))}
        </div>
        {/* cột */}
        <div className="relative flex h-40 flex-1 items-end gap-2">
          {/* lưới ngang */}
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
            {ticks.map((_, i) => (
              <div key={i} className="border-t border-border/60" />
            ))}
          </div>
          {days.map((d) => {
            const peak = d.count === max && d.count > 0;
            return (
              <div key={d.key} className="relative flex flex-1 flex-col items-center justify-end gap-1" title={`${d.label}: ${d.count} từ`}>
                {peak ? (
                  <span className="absolute -top-1 z-10 rounded-btn border border-border bg-surface px-2 py-0.5 text-xs font-semibold shadow-card">
                    {d.count}
                  </span>
                ) : null}
                <div
                  className={`w-full rounded-t ${peak ? "bg-chart-bar" : "bg-chart-base"}`}
                  style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count > 0 ? "3px" : "0" }}
                />
              </div>
            );
          })}
        </div>
      </div>
      <div className="ml-8 mt-1 flex gap-2">
        {days.map((d) => (
          <span key={d.key} className="flex-1 text-center text-[10px] text-muted-foreground">
            {d.label}
          </span>
        ))}
      </div>
    </Card>
  );
}

// Vòng tròn tổng (Figma): ring MẢNH + số lớn giữa.
function TotalLearnedRing({ count }: { count: number }) {
  return (
    <Card className="flex flex-col items-center justify-center">
      <h2 className="mb-4 text-center font-medium">Tổng số từ vựng đã học</h2>
      <div className="flex h-40 w-40 items-center justify-center rounded-full border-4 border-chart-base">
        <span className="text-4xl font-bold">{count}</span>
      </div>
    </Card>
  );
}

// Icon phễu lọc (header cột).
function FilterIcon({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Lọc"
      className={`ml-1 align-middle text-xs ${active ? "text-primary" : "text-muted-foreground/60 hover:text-foreground"}`}
    >
      ▽
    </button>
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

  useEffect(() => {
    fetchVocab()
      .then(setItems)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
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
  const someSelected = filteredIds.some((id) => selected.has(id));
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
      {/* Hàng 1: biểu đồ + vòng tròn tổng */}
      <div className="grid gap-4 sm:grid-cols-2">
        <LearnedChart items={items} />
        <TotalLearnedRing count={totalLearned} />
      </div>

      {/* Card danh sách */}
      <Card>
        {/* Toolbar: tiêu đề + search + Thêm từ vựng */}
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-medium">Danh sách từ vựng</h2>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <input
              className={`${inputCls} min-w-[160px]`}
              placeholder="🔍 Tìm kiếm…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button variant="info" onClick={() => setShowAdd((s) => !s)}>
              + Thêm từ vựng
            </Button>
          </div>
        </div>

        {/* Form thêm từ (ẩn/hiện) */}
        {showAdd ? (
          <div className="mt-3 rounded-card border border-border bg-surface-muted p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                className={inputCls}
                placeholder="Từ Tiếng Anh"
                value={word}
                onChange={(e) => {
                  setWord(e.target.value);
                  setAddMsg(null);
                }}
              />
              <input
                className={inputCls}
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
            </div>
            <div className="mt-2 flex items-center gap-3">
              <Button onClick={onAdd} disabled={adding}>
                {adding ? "Đang lưu…" : "Lưu"}
              </Button>
              <Button variant="ghost" onClick={() => setShowAdd(false)}>
                Huỷ
              </Button>
              {addMsg ? <span className="text-sm text-muted-foreground">{addMsg}</span> : null}
            </div>
          </div>
        ) : null}

        {/* Bảng */}
        {items.length === 0 ? (
          <p className="mt-4 text-muted-foreground">
            Chưa có từ nào. Thêm ở trên, hoặc lưu từ khi xem video bằng extension StudyMovie.
          </p>
        ) : (
          <>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="w-14 py-2 pr-2 text-center">STT</th>
                    <th className="py-2 pr-2">Từ vựng</th>
                    <th className="py-2 pr-2">Nghĩa</th>
                    <th className="relative py-2 pr-2">
                      Ngày thêm
                      <FilterIcon active={!!dateApplied} onClick={() => setOpenFilter((f) => (f === "date" ? null : "date"))} />
                      {openFilter === "date" ? (
                        <div ref={filterRef} className="absolute left-0 top-9 z-20 w-56 rounded-card border border-border bg-surface p-3 shadow-lg">
                          <input
                            className={`${inputCls} w-full`}
                            placeholder="DD/MM/YYYY"
                            value={dateInput}
                            onChange={(e) => setDateInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") applyDate();
                            }}
                          />
                          <div className="mt-2 flex gap-2">
                            <Button onClick={applyDate}>Áp dụng</Button>
                            <Button variant="ghost" onClick={clearDate}>
                              Xóa
                            </Button>
                          </div>
                          {dateApplied === "__invalid__" ? (
                            <p className="mt-1 text-xs text-danger-foreground">Ngày không hợp lệ.</p>
                          ) : null}
                        </div>
                      ) : null}
                    </th>
                    <th className="relative py-2 pr-2">
                      Trạng thái
                      <FilterIcon active={status !== "all"} onClick={() => setOpenFilter((f) => (f === "status" ? null : "status"))} />
                      {openFilter === "status" ? (
                        <div className="absolute left-0 top-9 z-20 w-40 overflow-hidden rounded-card border border-border bg-surface py-1 shadow-lg">
                          {(["all", "new", "learned"] as StatusFilter[]).map((s) => (
                            <button
                              key={s}
                              onClick={() => {
                                setStatus(s);
                                setOpenFilter(null);
                              }}
                              className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-surface-muted ${status === s ? "font-semibold text-primary" : ""}`}
                            >
                              {s === "all" ? "Tất cả" : s === "new" ? "Từ mới" : "Đã học"}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </th>
                    <th className="py-2 pr-2 text-center">
                      <label className="inline-flex cursor-pointer items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = someSelected && !allSelected;
                          }}
                          onChange={toggleAll}
                          aria-label="Chọn tất cả từ (theo bộ lọc)"
                        />
                        <span>Học từ này?</span>
                      </label>
                    </th>
                    <th className="w-10 py-2"></th>
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
                      className={`group cursor-pointer border-b border-border transition-colors hover:bg-surface-muted ${
                        selected.has(it.id) ? "bg-info/60" : ""
                      }`}
                    >
                        <td className="py-2 pr-2 text-center">
                          <span className="inline-flex min-w-[36px] justify-center rounded-pill border border-border px-2 py-0.5 text-xs text-muted-foreground">
                            {String(start + i + 1).padStart(3, "0")}
                          </span>
                        </td>
                        <td className="py-2 pr-2">
                          <span className="font-medium">{it.word}</span>
                          {it.ipa ? <span className="ml-1 text-xs text-muted-foreground">/{it.ipa}/</span> : null}
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
                        <td className="py-2 pr-2">{it.meaning_vi || <span className="text-muted-foreground">—</span>}</td>
                        <td className="py-2 pr-2">{fmtDate(it.created_at)}</td>
                        <td className="py-2 pr-2">
                          {it.learned_at ? <Badge tone="success">Đã học</Badge> : <Badge tone="danger">Từ mới</Badge>}
                        </td>
                        <td className="py-2 pr-2 text-center">
                          <input
                            type="checkbox"
                            checked={selected.has(it.id)}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => toggleSelect(it.id)}
                            aria-label={`Chọn học từ ${it.word}`}
                          />
                        </td>
                        <td className="py-2 text-center">
                          <button
                            disabled={busy === it.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              void onDelete(it);
                            }}
                            title="Xóa"
                            className="text-muted-foreground/40 hover:text-danger-foreground group-hover:text-muted-foreground"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer: đếm + phân trang + Học các từ đã chọn */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
              <span>
                {filtered.length === 0
                  ? "Hiển thị 0 trong tổng số 0 từ vựng"
                  : `Hiển thị ${start + 1}–${start + pageItems.length} trong tổng số ${filtered.length} từ vựng`}
              </span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" disabled={pageSafe <= 1} onClick={() => setPage((p) => p - 1)}>
                  ‹
                </Button>
                <span className="px-1">
                  {pageSafe}/{pageCount}
                </span>
                <Button variant="ghost" disabled={pageSafe >= pageCount} onClick={() => setPage((p) => p + 1)}>
                  ›
                </Button>
              </div>
              <Button variant="info" onClick={studySelected}>
                Học các từ đã chọn{selected.size > 0 ? ` (${selected.size})` : ""}
              </Button>
            </div>
          </>
        )}
      </Card>
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

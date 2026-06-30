"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageLoading } from "@/components/ui/Spinner";
import { fetchVocab, addVocab, deleteVocab, type VocabItem } from "@/lib/vocabulary";

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

// ── Ngày theo UTC+7 ('YYYY-MM-DD') — cộng 7h rồi lấy phần ngày UTC (độc lập timezone máy).
const dayKeyVN = (iso: string): string => new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString().slice(0, 10);
// DD/MM/YYYY → 'YYYY-MM-DD' (null nếu không hợp lệ).
function parseVNDate(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const dd = m[1].padStart(2, "0"), mm = m[2].padStart(2, "0");
  return `${m[3]}-${mm}-${dd}`;
}

type StatusFilter = "all" | "new" | "learned";

// Biểu đồ: 7 ngày gần nhất (UTC+7) — số từ learned_at rơi vào ngày đó.
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
  return (
    <Card>
      <h2 className="mb-3 text-center font-medium">Từ vựng đã học theo ngày</h2>
      <div className="flex h-36 items-end gap-2">
        {days.map((d) => {
          const peak = d.count === max && d.count > 0;
          return (
            <div key={d.key} className="flex flex-1 flex-col items-center gap-1" title={`${d.label}: ${d.count} từ`}>
              <span className="text-xs text-muted-foreground">{d.count > 0 ? d.count : ""}</span>
              <div className="flex w-full flex-1 items-end">
                <div
                  className={`w-full rounded-t ${peak ? "bg-chart-bar" : "bg-chart-base"}`}
                  style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count > 0 ? "3px" : "0" }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">{d.label}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function TotalLearnedRing({ count }: { count: number }) {
  return (
    <Card className="flex flex-col items-center justify-center">
      <h2 className="mb-3 text-center font-medium">Tổng số từ vựng đã học</h2>
      <div className="flex h-36 w-36 items-center justify-center rounded-full border-8 border-chart-base">
        <span className="text-4xl font-bold">{count}</span>
      </div>
    </Card>
  );
}

// WEB-03 / TIP-024 / TIP-025 — list + thêm từ + search/lọc/phân trang/biểu đồ (client-side).
function VocabList() {
  const [items, setItems] = useState<VocabItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // Form thêm từ
  const [word, setWord] = useState("");
  const [meaning, setMeaning] = useState("");
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState<string | null>(null);
  // Search + lọc + phân trang (client-side)
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [dateInput, setDateInput] = useState(""); // ô đang gõ DD/MM/YYYY
  const [dateApplied, setDateApplied] = useState(""); // ngày đã Áp dụng ('YYYY-MM-DD' hoặc "")
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchVocab()
      .then(setItems)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  // Đổi search/lọc → về trang 1.
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
      }
    } catch (e) {
      setAddMsg("Không thêm được từ: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setAdding(false);
    }
  };

  const onDelete = async (it: VocabItem) => {
    if (!confirm(`Xóa từ "${it.word}"?`)) return;
    setBusy(it.id);
    try {
      await deleteVocab(it.id);
      setItems((cur) => (cur ?? []).filter((x) => x.id !== it.id));
    } catch (e) {
      alert("Xóa lỗi: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  };

  const applyDate = () => {
    const key = parseVNDate(dateInput);
    setDateApplied(dateInput.trim() === "" ? "" : (key ?? "__invalid__"));
  };
  const clearDate = () => {
    setDateInput("");
    setDateApplied("");
  };

  // Lọc client-side (AND): search + trạng thái + ngày thêm.
  const filtered = useMemo(() => {
    const all = items ?? [];
    const q = search.trim().toLowerCase();
    return all.filter((it) => {
      if (q && !(it.word.toLowerCase().includes(q) || (it.meaning_vi ?? "").toLowerCase().includes(q))) return false;
      if (status === "new" && it.learned_at) return false;
      if (status === "learned" && !it.learned_at) return false;
      if (dateApplied && dayKeyVN(it.created_at) !== dateApplied) return false;
      return true;
    });
  }, [items, search, status, dateApplied]);

  if (error) {
    return (
      <Card>
        <p className="text-sm text-red-600">Không tải được từ vựng: {error}</p>
      </Card>
    );
  }
  if (!items) return <PageLoading label="Đang tải từ vựng…" />;

  const totalLearned = items.filter((i) => i.learned_at).length;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, pageCount);
  const start = (pageSafe - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold">Từ vựng ({items.length})</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/hoc-tu-vung">
            <Button>Flashcard</Button>
          </Link>
          <Link href="/kiem-tra-anh-viet">
            <Button variant="ghost">Quiz EN→VI</Button>
          </Link>
          <Link href="/kiem-tra-viet-anh">
            <Button variant="ghost">Quiz VI→EN</Button>
          </Link>
        </div>
      </div>

      {/* Biểu đồ + vòng tròn (TIP-025) */}
      <div className="grid gap-4 sm:grid-cols-2">
        <LearnedChart items={items} />
        <TotalLearnedRing count={totalLearned} />
      </div>

      {/* Form thêm từ (TIP-024) */}
      <Card className="space-y-2">
        <p className="text-sm font-medium">Thêm từ vựng</p>
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
        <div className="flex items-center gap-3">
          <Button onClick={onAdd} disabled={adding}>
            {adding ? "Đang lưu…" : "Lưu"}
          </Button>
          {addMsg ? <span className="text-sm text-muted-foreground">{addMsg}</span> : null}
        </div>
      </Card>

      {/* Search + lọc (TIP-025) */}
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className={`${inputCls} min-w-[180px] flex-1`}
            placeholder="🔍 Tìm kiếm từ hoặc nghĩa…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
            <option value="all">Tất cả</option>
            <option value="new">Từ mới</option>
            <option value="learned">Đã học</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Lọc theo ngày thêm:</span>
          <input
            className={`${inputCls} w-40`}
            placeholder="DD/MM/YYYY"
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyDate();
            }}
          />
          <Button variant="ghost" onClick={applyDate}>
            Áp dụng
          </Button>
          {dateApplied ? (
            <Button variant="ghost" onClick={clearDate}>
              Xóa lọc
            </Button>
          ) : null}
          {dateApplied === "__invalid__" ? (
            <span className="text-sm text-red-600">Ngày không hợp lệ (DD/MM/YYYY).</span>
          ) : null}
        </div>
      </Card>

      {/* Danh sách */}
      {items.length === 0 ? (
        <Card>
          <p className="text-muted-foreground">
            Chưa có từ nào. Thêm thủ công ở trên, hoặc lưu từ khi xem video bằng extension StudyMovie.
          </p>
        </Card>
      ) : (
        <Card>
          <h2 className="mb-3 font-medium">Danh sách từ vựng</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="w-12 py-2 pr-2">STT</th>
                  <th className="py-2 pr-2">Từ vựng</th>
                  <th className="py-2 pr-2">Nghĩa</th>
                  <th className="py-2 pr-2">Ngày thêm</th>
                  <th className="py-2 pr-2">Trạng thái</th>
                  <th className="w-12 py-2 pr-2"></th>
                </tr>
              </thead>
              <tbody>
                {pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted-foreground">
                      Không có từ khớp bộ lọc.
                    </td>
                  </tr>
                ) : (
                  pageItems.map((it, i) => (
                    <tr key={it.id} className="border-b border-border">
                      <td className="py-2 pr-2 text-muted-foreground">{String(start + i + 1).padStart(3, "0")}</td>
                      <td className="py-2 pr-2">
                        <span className="font-medium">{it.word}</span>
                        {it.ipa ? <span className="ml-1 text-xs text-muted-foreground">/{it.ipa}/</span> : null}
                        {it.audio_url ? (
                          <button
                            onClick={() => playAudio(it.audio_url as string)}
                            aria-label="Phát âm"
                            className="ml-1 align-middle text-sm"
                          >
                            🔊
                          </button>
                        ) : null}
                      </td>
                      <td className="py-2 pr-2">
                        {it.meaning_vi || <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-2 pr-2">{fmtDate(it.created_at)}</td>
                      <td className="py-2 pr-2">
                        {it.learned_at ? <Badge tone="success">Đã học</Badge> : <Badge tone="danger">Từ mới</Badge>}
                      </td>
                      <td className="py-2 pr-2">
                        <button
                          disabled={busy === it.id}
                          onClick={() => onDelete(it)}
                          title="Xóa"
                          className="text-muted-foreground hover:text-foreground"
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

          {/* Phân trang */}
          <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {filtered.length === 0
                ? "Hiển thị 0 trong tổng số 0 từ vựng"
                : `Hiển thị ${start + 1}–${start + pageItems.length} trong tổng số ${filtered.length} từ vựng`}
            </span>
            <div className="flex gap-1">
              <Button variant="ghost" disabled={pageSafe <= 1} onClick={() => setPage((p) => p - 1)}>
                ‹
              </Button>
              <span className="px-2 py-2">
                {pageSafe}/{pageCount}
              </span>
              <Button variant="ghost" disabled={pageSafe >= pageCount} onClick={() => setPage((p) => p + 1)}>
                ›
              </Button>
            </div>
          </div>
        </Card>
      )}
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

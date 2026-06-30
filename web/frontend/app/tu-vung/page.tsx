"use client";
import { useEffect, useState } from "react";
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

// WEB-03 / TIP-024 — danh sách từ (bảng + trạng thái Từ mới/Đã học) + thêm từ thủ công + 3 nút ôn.
function VocabList() {
  const [items, setItems] = useState<VocabItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // Form thêm từ
  const [word, setWord] = useState("");
  const [meaning, setMeaning] = useState("");
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchVocab()
      .then(setItems)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

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
        setItems((cur) => [r.item as VocabItem, ...(cur ?? [])]); // mới nhất lên đầu
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

  if (error) {
    return (
      <Card>
        <p className="text-sm text-red-600">Không tải được từ vựng: {error}</p>
      </Card>
    );
  }
  if (!items) return <PageLoading label="Đang tải từ vựng…" />;

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

      {/* Form thêm từ vựng */}
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

      {/* Danh sách từ vựng */}
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
                {items.map((it, i) => (
                  <tr key={it.id} className="border-b border-border">
                    <td className="py-2 pr-2 text-muted-foreground">{String(i + 1).padStart(3, "0")}</td>
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
                    <td className="py-2 pr-2">{it.meaning_vi || <span className="text-muted-foreground">—</span>}</td>
                    <td className="py-2 pr-2">{fmtDate(it.created_at)}</td>
                    <td className="py-2 pr-2">
                      {it.learned_at ? (
                        <Badge tone="success">Đã học</Badge>
                      ) : (
                        <Badge tone="danger">Từ mới</Badge>
                      )}
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
                ))}
              </tbody>
            </table>
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

"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageLoading } from "@/components/ui/Spinner";
import { fetchVocab, deleteVocab, type VocabItem } from "@/lib/vocabulary";

function playAudio(url: string): void {
  try {
    void new Audio(url).play();
  } catch {
    /* ignore */
  }
}

// WEB-03 — danh sách từ + xóa + 3 nút ôn (học TẤT CẢ từ, không tick chọn).
function VocabList() {
  const [items, setItems] = useState<VocabItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetchVocab()
      .then(setItems)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

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

      {items.length === 0 ? (
        <Card>
          <p className="text-muted-foreground">
            Chưa có từ nào. Hãy lưu từ khi xem video bằng extension StudyMovie (click từ trong phụ đề → Lưu).
          </p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => {
            const audio = it.audio_url;
            return (
              <li key={it.id}>
                <Card className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{it.word}</span>
                      {it.ipa ? <span className="text-sm text-muted-foreground">/{it.ipa}/</span> : null}
                      {audio ? (
                        <button onClick={() => playAudio(audio)} aria-label="Phát âm" className="text-sm">
                          🔊
                        </button>
                      ) : null}
                    </div>
                    <p className="text-sm">
                      {it.meaning_vi || <span className="text-muted-foreground">(chưa có nghĩa)</span>}
                    </p>
                    {it.example ? (
                      <p className="mt-1 truncate text-xs italic text-muted-foreground">{it.example}</p>
                    ) : null}
                  </div>
                  <Button variant="ghost" disabled={busy === it.id} onClick={() => onDelete(it)}>
                    {busy === it.id ? "Đang xóa…" : "Xóa"}
                  </Button>
                </Card>
              </li>
            );
          })}
        </ul>
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

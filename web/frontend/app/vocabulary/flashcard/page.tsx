"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageLoading } from "@/components/ui/Spinner";
import { fetchVocab, type VocabItem } from "@/lib/vocabulary";

function playAudio(url: string): void {
  try {
    void new Audio(url).play();
  } catch {
    /* ignore */
  }
}

// WEB-04 — Flashcard: dùng TẤT CẢ từ. Lật thẻ, trước/sau.
function Flashcards() {
  const [items, setItems] = useState<VocabItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    fetchVocab()
      .then(setItems)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (error) return <Card><p className="text-sm text-red-600">Lỗi: {error}</p></Card>;
  if (!items) return <PageLoading label="Đang tải…" />;
  if (items.length === 0) {
    return (
      <Card className="text-center">
        <p className="text-muted-foreground">Chưa có từ nào để học.</p>
        <Link href="/vocabulary">
          <Button className="mt-4" variant="ghost">Quay lại</Button>
        </Link>
      </Card>
    );
  }

  const it = items[idx];
  const audio = it.audio_url;
  const go = (d: number) => {
    setFlipped(false);
    setIdx((i) => Math.min(items.length - 1, Math.max(0, i + d)));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/vocabulary" className="text-sm text-muted-foreground hover:text-foreground">
          ← Từ vựng
        </Link>
        <span className="text-sm text-muted-foreground">
          {idx + 1}/{items.length}
        </span>
      </div>

      <Card
        onClick={() => setFlipped((f) => !f)}
        className="flex min-h-[220px] cursor-pointer flex-col items-center justify-center text-center"
      >
        {!flipped ? (
          <>
            <p className="text-3xl font-bold">{it.word}</p>
            {it.ipa ? <p className="mt-1 text-muted-foreground">/{it.ipa}/</p> : null}
            {audio ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  playAudio(audio);
                }}
                className="mt-2 text-xl"
                aria-label="Phát âm"
              >
                🔊
              </button>
            ) : null}
          </>
        ) : (
          <>
            <p className="text-xl">{it.meaning_vi || "(chưa có nghĩa)"}</p>
            {it.example ? <p className="mt-3 text-sm italic text-muted-foreground">{it.example}</p> : null}
          </>
        )}
        <p className="mt-4 text-xs text-muted-foreground">Bấm thẻ để lật</p>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="ghost" disabled={idx === 0} onClick={() => go(-1)}>
          ← Trước
        </Button>
        <Button disabled={idx === items.length - 1} onClick={() => go(1)}>
          Sau →
        </Button>
      </div>
    </div>
  );
}

export default function FlashcardPage() {
  return (
    <AuthGuard>
      <Flashcards />
    </AuthGuard>
  );
}

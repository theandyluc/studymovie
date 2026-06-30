"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageLoading } from "@/components/ui/Spinner";
import { fetchVocab, type VocabItem } from "@/lib/vocabulary";

// TIP-018 — localStorage nhớ đã xem hướng dẫn lần đầu.
const TUTORIAL_KEY = "sm-flashcard-tutorial-seen";

// Đọc từ tiếng Anh bằng Web Speech API (fallback khi không có audio URL).
function speak(text: string): void {
  try {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

// Phát âm 1 từ: ưu tiên audio URL (TIP-009), lỗi/không có → fallback speechSynthesis.
// try/catch + catch() nuốt lỗi autoplay (AC-5: không vỡ UI nếu trình duyệt chặn).
function playWord(it: VocabItem): void {
  const url = it.audio_url;
  if (url) {
    try {
      const a = new Audio(url);
      const p = a.play();
      if (p && typeof p.then === "function") p.catch(() => speak(it.word));
      return;
    } catch {
      /* rơi xuống speak */
    }
  }
  speak(it.word);
}

// WEB-04 — Flashcard: dùng TẤT CẢ từ. Lật thẻ (bấm), trước/sau (nút).
// TIP-018: + overlay hướng dẫn lần đầu + tự phát audio mỗi thẻ mới (giữ nguyên tương tác nút).
function Flashcards() {
  const [items, setItems] = useState<VocabItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    fetchVocab()
      .then(setItems)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  // Hướng dẫn lần đầu: chưa có key → hiện overlay (chạy client-only).
  useEffect(() => {
    try {
      if (localStorage.getItem(TUTORIAL_KEY) !== "1") setShowTutorial(true);
    } catch {
      /* localStorage không khả dụng → bỏ qua, vào thẳng */
    }
  }, []);

  const dismissTutorial = useCallback(() => {
    try {
      localStorage.setItem(TUTORIAL_KEY, "1");
    } catch {
      /* ignore */
    }
    setShowTutorial(false);
  }, []);

  // Tự phát audio khi sang THẺ MỚI (đổi idx) — không phát khi đang xem hướng dẫn.
  // Phát 1 lần mỗi thẻ (deps = idx); lật thẻ không đổi idx nên không phát lại.
  useEffect(() => {
    if (!items || items.length === 0 || showTutorial) return;
    playWord(items[idx]);
  }, [idx, items, showTutorial]);

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
  const go = (d: number) => {
    setFlipped(false);
    setIdx((i) => Math.min(items.length - 1, Math.max(0, i + d)));
  };

  return (
    <div className="space-y-4">
      {/* Overlay hướng dẫn lần đầu — mô tả ĐÚNG tương tác thật (bấm thẻ + nút, KHÔNG kéo) */}
      {showTutorial ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-sm text-center">
            <h2 className="font-heading text-lg font-bold">Cách dùng Học từ vựng</h2>
            <ul className="mt-3 space-y-2 text-left text-sm text-muted-foreground">
              <li>👆 <b>Bấm vào thẻ</b> để lật xem nghĩa &amp; ví dụ.</li>
              <li>↔️ Dùng nút <b>← Trước</b> / <b>Sau →</b> để chuyển thẻ.</li>
              <li>🔊 Mỗi thẻ mới sẽ <b>tự phát âm</b>; bấm nút loa để nghe lại.</li>
            </ul>
            <Button className="mt-4 w-full" onClick={dismissTutorial}>
              Bắt đầu
            </Button>
          </Card>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <Link href="/vocabulary" className="text-sm text-muted-foreground hover:text-foreground">
          ← Từ vựng
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowTutorial(true)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Hướng dẫn
          </button>
          <span className="text-sm text-muted-foreground">
            {idx + 1}/{items.length}
          </span>
        </div>
      </div>

      <Card
        onClick={() => setFlipped((f) => !f)}
        className="flex min-h-[220px] cursor-pointer flex-col items-center justify-center text-center"
      >
        {!flipped ? (
          <>
            <p className="text-3xl font-bold">{it.word}</p>
            {it.ipa ? <p className="mt-1 text-muted-foreground">/{it.ipa}/</p> : null}
            <button
              onClick={(e) => {
                e.stopPropagation();
                playWord(it);
              }}
              className="mt-2 text-xl"
              aria-label="Phát âm"
            >
              🔊
            </button>
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

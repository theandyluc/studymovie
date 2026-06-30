"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageLoading } from "@/components/ui/Spinner";
import { fetchVocab, markLearned, STUDY_SELECTION_KEY, type VocabItem } from "@/lib/vocabulary";

const TUTORIAL_KEY = "sm-flashcard-tutorial-seen";
const SWIPE_THRESHOLD = 90; // px — kéo vượt mức này mới đổi thẻ; chưa đủ → nảy về.

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
function playWord(it: VocabItem): void {
  const url = it.audio_url;
  if (url) {
    try {
      const a = new Audio(url);
      const p = a.play();
      if (p && typeof p.then === "function") p.catch(() => speak(it.word));
      return;
    } catch {
      /* fall to speak */
    }
  }
  speak(it.word);
}

// Đọc selection (id từ đã chọn ở /tu-vung) từ sessionStorage. KHÔNG xóa ở đây — /tu-vung quản lý.
function readSelection(): string[] {
  try {
    const raw = sessionStorage.getItem(STUDY_SELECTION_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

// WEB-04 / TIP-018 / TIP-026 — Flashcard SWIPE: kéo đổi thẻ, chạm lật, audio tự phát,
// tutorial "kéo", học từ ĐÃ CHỌN (sessionStorage), đánh dấu "đã học" (mark-learned), ≡ menu.
function Flashcards() {
  const [all, setAll] = useState<VocabItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Swipe state
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const movedRef = useRef(false);

  useEffect(() => {
    fetchVocab()
      .then(setAll)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  // Selection: nếu có id đã chọn → chỉ học các từ đó (giữ thứ tự list); else học tất cả.
  const items = useMemo(() => {
    if (!all) return null;
    const sel = readSelection();
    if (sel.length === 0) return all;
    const set = new Set(sel);
    const picked = all.filter((it) => set.has(it.id));
    return picked.length > 0 ? picked : all;
  }, [all]);

  useEffect(() => {
    try {
      if (localStorage.getItem(TUTORIAL_KEY) !== "1") setShowTutorial(true);
    } catch {
      /* ignore */
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

  // Thẻ MỚI hiện ra → tự phát audio + đánh dấu "đã học" (mark-learned, idempotent, fire-and-forget).
  useEffect(() => {
    if (!items || items.length === 0 || showTutorial) return;
    const cur = items[idx];
    if (!cur) return;
    playWord(cur);
    void markLearned([cur.id]).catch(() => undefined);
  }, [idx, items, showTutorial]);

  if (error) return <Card><p className="text-sm text-red-600">Lỗi: {error}</p></Card>;
  if (!items) return <PageLoading label="Đang tải…" />;
  if (items.length === 0) {
    return (
      <Card className="text-center">
        <p className="text-muted-foreground">Chưa có từ nào để học.</p>
        <Link href="/tu-vung">
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

  // ── Swipe (pointer events, không thư viện) ──
  const onPointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
    movedRef.current = false;
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - startX.current;
    if (Math.abs(dx) > 6) movedRef.current = true;
    setDragX(dx);
  };
  const onPointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    const dx = dragX;
    setDragX(0);
    if (dx >= SWIPE_THRESHOLD) {
      go(1); // kéo phải → thẻ tiếp theo
    } else if (dx <= -SWIPE_THRESHOLD) {
      go(-1); // kéo trái → thẻ trước
    } else if (!movedRef.current) {
      setFlipped((f) => !f); // chạm (không kéo) → lật thẻ
    }
    // chưa đủ ngưỡng & có kéo → nảy về (dragX đã reset 0)
  };

  const cardStyle: React.CSSProperties = {
    transform: `translateX(${dragX}px) rotate(${dragX * 0.03}deg)`,
    transition: dragging ? "none" : "transform 0.2s ease",
    touchAction: "pan-y",
  };

  return (
    <div className="space-y-4">
      {/* Tutorial lần đầu — mô tả KÉO (swipe) */}
      {showTutorial ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-sm text-center">
            <h2 className="font-heading text-lg font-bold">Cách dùng Học từ vựng</h2>
            <ul className="mt-3 space-y-2 text-left text-sm text-muted-foreground">
              <li>👉 <b>Giữ thẻ và kéo sang phải</b> để xem thẻ tiếp theo; kéo <b>sang trái</b> để quay lại.</li>
              <li>👆 <b>Chạm vào thẻ</b> để lật xem nghĩa &amp; ví dụ.</li>
              <li>🔊 Mỗi thẻ mới sẽ <b>tự phát âm</b>; bấm nút loa để nghe lại.</li>
            </ul>
            <Button className="mt-4 w-full" onClick={dismissTutorial}>
              Bắt đầu
            </Button>
          </Card>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <Link href="/tu-vung" className="text-sm text-muted-foreground hover:text-foreground">
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
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={cardStyle}
        className="flex min-h-[240px] cursor-grab select-none flex-col items-center justify-center text-center active:cursor-grabbing"
      >
        {!flipped ? (
          <>
            <p className="text-3xl font-bold">{it.word}</p>
            {it.ipa ? <p className="mt-1 text-muted-foreground">/{it.ipa}/</p> : null}
            <button
              onPointerDown={(e) => e.stopPropagation()}
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
        <p className="mt-4 text-xs text-muted-foreground">Kéo để chuyển thẻ · chạm để lật</p>
      </Card>

      {/* ≡ menu chuyển nhanh Học từ vựng / Kiểm tra Anh-Việt / Kiểm tra Việt-Anh */}
      <div className="relative flex justify-center">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-lg shadow-card hover:bg-surface-muted"
          title="Menu"
        >
          ≡
        </button>
        {menuOpen ? (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} aria-hidden />
            <div className="absolute bottom-12 z-50 w-56 overflow-hidden rounded-card border border-border bg-surface py-1 shadow-card">
              {[
                { href: "/hoc-tu-vung", label: "Học từ vựng" },
                { href: "/kiem-tra-anh-viet", label: "Kiểm tra Anh-Việt" },
                { href: "/kiem-tra-viet-anh", label: "Kiểm tra Việt-Anh" },
              ].map((m) => (
                <Link
                  key={m.href}
                  href={m.href}
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-2 text-center text-sm hover:bg-surface-muted"
                >
                  {m.label}
                </Link>
              ))}
            </div>
          </>
        ) : null}
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

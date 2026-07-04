"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageLoading } from "@/components/ui/Spinner";
import { fetchVocab, markLearned, firstIpa, STUDY_SELECTION_KEY, type VocabItem } from "@/lib/vocabulary";

/* ============================================================
   GIẢI THÍCH CHO KHÁCH — File: app/hoc-tu-vung/page.tsx
   ------------------------------------------------------------
   Trang "Học từ vựng" bằng THẺ LẬT (flashcard):
   - Mỗi thẻ hiện từ tiếng Anh + phiên âm + nghĩa; chạm vào thẻ để xem
     câu ví dụ.
   - Kéo thẻ sang trái/phải (hoặc dùng phím mũi tên) để chuyển thẻ; trên
     máy tính còn có nút ‹ › hiện khi rê chuột.
   - Mỗi thẻ mới sẽ tự đọc to từ và tự đánh dấu "đã học".
   - Lần đầu vào sẽ có hướng dẫn nhỏ (overlay) chỉ cách kéo thẻ.
   - Nếu người dùng đã chọn sẵn một số từ ở trang Từ vựng thì chỉ học các
     từ đó; nếu không, học toàn bộ.
   ============================================================ */
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

// WEB-04 / TIP-018 / TIP-026 / TIP-033 — Flashcard theo Figma: thẻ dọc (portrait), từ + loa
// góc trên, nghĩa dưới, chấm đen góc dưới-phải; kéo đổi thẻ, chạm mở ví dụ, audio tự phát,
// tutorial overlay (thẻ mờ + con trỏ + hướng dẫn kéo), menu ≡ chuyển Học/Kiểm tra.
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
  const [exit, setExit] = useState<0 | 1 | -1>(0); // TIP-074: hướng thẻ bay ra (0 = không)
  const startX = useRef(0);
  const movedRef = useRef(false);

  useEffect(() => {
    fetchVocab()
      .then(setAll)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

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

  // Thẻ MỚI → tự phát audio + đánh dấu "đã học" (idempotent, fire-and-forget).
  useEffect(() => {
    if (!items || items.length === 0 || showTutorial) return;
    const cur = items[idx];
    if (!cur) return;
    playWord(cur);
    void markLearned([cur.id]).catch(() => undefined);
  }, [idx, items, showTutorial]);

  // UX #3 — phím tắt: ← → đổi thẻ, Space/Enter lật.
  useEffect(() => {
    if (showTutorial) return;
    const onKey = (e: KeyboardEvent) => {
      if (!items || items.length === 0) return;
      if (e.key === "ArrowRight") {
        setFlipped(false);
        setIdx((i) => Math.min(items.length - 1, i + 1));
      } else if (e.key === "ArrowLeft") {
        setFlipped(false);
        setIdx((i) => Math.max(0, i - 1));
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, showTutorial]);

  if (error) return <Card><p className="text-sm text-danger-foreground">Lỗi: {error}</p></Card>;
  if (!items) return <PageLoading />;
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

  // TIP-074 — swipe có animation: thẻ bay hẳn ra theo hướng, rồi đổi thẻ.
  const commitSwipe = (dir: 1 | -1) => {
    setDragX(0);
    setExit(dir);
    window.setTimeout(() => {
      go(dir);
      setExit(0);
    }, 250);
  };

  // (Giải thích) Xử lý thao tác KÉO THẺ bằng chuột/ngón tay:
  //   • bấm giữ → ghi lại điểm bắt đầu;
  //   • di chuyển → thẻ trượt theo tay;
  //   • thả ra → nếu kéo đủ xa thì chuyển thẻ, nếu chỉ chạm nhẹ thì lật thẻ.
  // ── Swipe (pointer events) ──
  const onPointerDown = (e: React.PointerEvent) => {
    if (exit !== 0) return; // đang bay ra → bỏ qua thao tác mới
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
    // Kéo đủ ngưỡng + còn thẻ theo hướng đó → bay ra; thẻ đầu/cuối → snap về; chạm nhẹ → lật.
    if (dx >= SWIPE_THRESHOLD && idx < items.length - 1) commitSwipe(1);
    else if (dx <= -SWIPE_THRESHOLD && idx > 0) commitSwipe(-1);
    else if (!movedRef.current) {
      setDragX(0);
      setFlipped((f) => !f);
    } else {
      setDragX(0); // snap về (không đủ ngưỡng hoặc hết thẻ)
    }
  };

  // TIP-074 — exit≠0: thẻ trượt+xoay+mờ bay ra; else: kéo theo tay (hoặc nảy về khi thả).
  const cardStyle: React.CSSProperties =
    exit !== 0
      ? {
          transform: `translateX(${exit * 130}%) rotate(${exit * 8}deg)`,
          opacity: 0,
          transition: "transform .25s ease-out, opacity .25s ease-out",
          touchAction: "pan-y",
        }
      : {
          transform: `translateX(${dragX}px) rotate(${dragX * 0.03}deg)`,
          transition: dragging ? "none" : "transform .2s ease",
          touchAction: "pan-y",
        };

  // Thẻ dọc (portrait) — nội dung dùng chung cho thẻ thật + thẻ mờ tutorial.
  const renderCard = (ghost = false) => (
    <div
      className={`relative flex min-h-[260px] w-full max-w-xs flex-col justify-center rounded-card border border-border bg-surface p-6 shadow-card ${
        ghost ? "opacity-70" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-2xl font-bold">{it.word}</span>
        {!ghost ? (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              playWord(it);
            }}
            className="text-lg"
            aria-label="Phát âm"
          >
            🔊
          </button>
        ) : (
          <span className="text-lg">🔊</span>
        )}
      </div>
      {firstIpa(it.ipa) ? <span className="mt-0.5 text-sm text-muted-foreground">/{firstIpa(it.ipa)}/</span> : null}
      <span className="mt-1 text-base text-muted-foreground">{it.meaning_vi || "(chưa có nghĩa)"}</span>
      {!ghost && flipped && it.example ? (
        <p className="mt-4 text-sm italic text-muted-foreground">{it.example}</p>
      ) : null}
      {/* chấm đen góc dưới-phải (Figma) */}
      <span className="absolute bottom-4 right-4 h-3 w-3 rounded-full bg-foreground" />
    </div>
  );

  return (
    <div className="flex flex-col items-center gap-6 py-6">
      {/* Tutorial lần đầu (Figma): overlay tối + thẻ mờ + con trỏ + hướng dẫn kéo */}
      {showTutorial ? (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-black/60 p-4"
          onClick={dismissTutorial}
        >
          <div className="relative">
            {renderCard(true)}
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-4xl">🖱️</span>
          </div>
          <p className="text-center font-semibold text-white">Giữ thẻ và kéo sang phải để xem thẻ tiếp theo</p>
          <p className="text-xs text-white/70">(Chạm để bắt đầu)</p>
        </div>
      ) : null}

      {/* TIP-074 — thẻ chính: SWIPE có animation (bỏ nút ‹ ›; phím ← → vẫn đổi thẻ). */}
      <div className="relative">
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={cardStyle}
          className="cursor-grab select-none active:cursor-grabbing"
        >
          {renderCard(false)}
        </div>
      </div>

      {/* ≡ menu chuyển Học từ vựng / Kiểm tra Anh-Việt / Kiểm tra Việt-Anh */}
      <div className="relative flex justify-center">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-lg shadow-card hover:bg-surface-muted"
          title="Menu"
        >
          ≡
        </button>
        {menuOpen ? (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} aria-hidden />
            {/* Menu dọc nền tối (Figma) */}
            <div className="absolute bottom-14 z-50 w-56 overflow-hidden rounded-card bg-primary py-1 text-primary-foreground shadow-lg">
              {[
                { href: "/kiem-tra-anh-viet", label: "Kiểm tra Anh-Việt" },
                { href: "/hoc-tu-vung", label: "Học từ vựng" },
                { href: "/kiem-tra-viet-anh", label: "Kiểm tra Việt-Anh" },
              ].map((m) => (
                <Link
                  key={m.href}
                  href={m.href}
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-2.5 text-center text-sm hover:bg-white/10"
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

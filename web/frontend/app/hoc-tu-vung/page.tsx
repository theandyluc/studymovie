"use client";
import { useEffect, useMemo, useRef, useState } from "react";
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
   - Nếu người dùng đã chọn sẵn một số từ ở trang Từ vựng thì chỉ học các
     từ đó; nếu không, học toàn bộ.
   ============================================================ */
// (Chỉnh được) SWIPE_THRESHOLD = số pixel phải kéo ngang tối thiểu để ĐỔI thẻ.
// Tăng số → phải kéo xa hơn mới đổi (đỡ đổi nhầm); giảm → vuốt nhạy hơn.
const SWIPE_THRESHOLD = 90; // px — kéo vượt mức này mới đổi thẻ; chưa đủ → nảy về.
const TUTORIAL_KEY = "sm-flashcard-tutorial-seen";

// TIP-081 — icon con trỏ hướng dẫn kéo (Figma "Vector", stroke trắng 1.4px, không fill).
function CursorHintIcon() {
  return (
    <svg width="44" height="51" viewBox="0 0 44 51" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M42.1803 20.0177L3.45082 0.87221C3.12188 0.722643 2.76045 0.670286 2.40537 0.720768C2.05029 0.77125 1.71499 0.922661 1.43552 1.15872C1.15605 1.39479 0.942979 1.70658 0.819208 2.06057C0.695436 2.41457 0.665648 2.79739 0.733044 3.16787L8.14894 47.4457C8.19399 47.8544 8.35359 48.2398 8.6074 48.5527C8.8612 48.8655 9.19773 49.0918 9.57411 49.2026C9.95048 49.3134 10.3497 49.3038 10.7208 49.1749C11.092 49.0461 11.4183 48.8038 11.6582 48.479L19.5266 37.1138C19.6964 36.9288 19.9033 36.786 20.1323 36.696C20.3612 36.6059 20.6064 36.5708 20.8498 36.5932C21.0933 36.6156 21.3289 36.695 21.5396 36.8255C21.7502 36.956 21.9304 37.1345 22.0672 37.3477L30.7055 49.085C31.0261 49.5185 31.4969 49.8004 32.0146 49.8691C32.5324 49.9377 33.0549 49.7874 33.4676 49.4511L37.6985 46.0322C37.9009 45.8479 38.0655 45.6222 38.1823 45.3687C38.2992 45.1153 38.3658 44.8395 38.3781 44.5581C38.3904 44.2767 38.3482 43.9957 38.254 43.732C38.1598 43.4683 38.0157 43.2276 37.8303 43.0245L29.1969 31.3167C29.0431 31.1197 28.9336 30.8887 28.8765 30.6409C28.8194 30.3931 28.8162 30.1349 28.8673 29.8857C28.9183 29.6364 29.0222 29.4025 29.1711 29.2014C29.3201 29.0004 29.5103 28.8374 29.7275 28.7246L42.2369 23.7355C42.5631 23.5581 42.8358 23.2885 43.0242 22.9568C43.2127 22.6251 43.3095 22.2446 43.3036 21.8581C43.2977 21.4717 43.1894 21.0946 42.991 20.7694C42.7925 20.4443 42.5118 20.1839 42.1803 20.0177Z"
        stroke="white"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// TIP-081 — vòng tròn trắng mờ xuất hiện dưới con trỏ (Figma), opacity 0.5 đã có sẵn trong path.
function CircleHintIcon() {
  return (
    <svg width="57" height="60" viewBox="0 0 57 60" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        opacity="0.5"
        d="M28.4463 59.896C24.5112 59.896 20.8132 59.1093 17.3522 57.5361C13.8913 55.9628 10.8807 53.8295 8.32055 51.1362C5.76038 48.4429 3.73405 45.2734 2.24157 41.6277C0.74909 37.982 0.00190002 34.0888 3.6008e-06 29.948C-0.00189282 25.8072 0.745297 21.9139 2.24157 18.2683C3.73785 14.6226 5.76417 11.4531 8.32055 8.75979C10.8769 6.06646 13.8875 3.93317 17.3522 2.3599C20.817 0.786634 24.515 0 28.4463 0C32.3776 0 36.0756 0.786634 39.5404 2.3599C43.0051 3.93317 46.0157 6.06646 48.5721 8.75979C51.1284 11.4531 53.1557 14.6226 54.6539 18.2683C56.152 21.9139 56.8983 25.8072 56.8926 29.948C56.8869 34.0888 56.1397 37.982 54.651 41.6277C53.1623 45.2734 51.136 48.4429 48.5721 51.1362C46.0081 53.8295 42.9975 55.9638 39.5404 57.5391C36.0832 59.1143 32.3852 59.9 28.4463 59.896Z"
        fill="white"
      />
    </svg>
  );
}

// TIP-081 — icon loa 18x18 theo Figma (thay emoji 🔊).
function SpeakerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g className="opacity-50 transition-opacity group-hover:opacity-100">
        <path
          d="M10.125 2.81251C10.125 2.70187 10.0924 2.5937 10.0312 2.50152C9.97 2.40934 9.883 2.33724 9.78105 2.29426C9.67911 2.25127 9.56676 2.2393 9.45805 2.25984C9.34934 2.28039 9.2491 2.33253 9.16987 2.40976L5.877 5.61601H3.9375C3.48995 5.61601 3.06072 5.7938 2.74426 6.11026C2.42779 6.42673 2.25 6.85595 2.25 7.30351V10.6673C2.25 11.1148 2.42779 11.544 2.74426 11.8605C3.06072 12.177 3.48995 12.3548 3.9375 12.3548H5.87587L9.16875 15.5891C9.24785 15.6667 9.34809 15.7191 9.45688 15.7399C9.56568 15.7607 9.67819 15.7489 9.78032 15.706C9.88244 15.6631 9.96963 15.5911 10.0309 15.4988C10.0923 15.4066 10.125 15.2983 10.125 15.1875V2.81251ZM11.3749 5.83763C11.4209 5.77975 11.4778 5.73151 11.5425 5.69566C11.6071 5.65981 11.6782 5.63705 11.7517 5.6287C11.8251 5.62034 11.8995 5.62654 11.9705 5.64695C12.0416 5.66735 12.1079 5.70157 12.1657 5.74763L12.168 5.74876L12.1702 5.75101L12.1759 5.75551L12.1927 5.77013L12.2445 5.81513C12.2857 5.85263 12.339 5.90588 12.4042 5.97488C12.5314 6.11326 12.6967 6.31463 12.8599 6.58238C13.1872 7.12238 13.5045 7.92451 13.5045 8.99888C13.5045 10.0721 13.1872 10.8754 12.8599 11.4154C12.7286 11.6329 12.576 11.8368 12.4042 12.024C12.332 12.101 12.2562 12.1746 12.177 12.2445L12.168 12.2524H12.1669C12.1669 12.2524 11.664 12.5258 11.376 12.1646C11.2834 12.0488 11.2403 11.901 11.2561 11.7535C11.2719 11.606 11.3453 11.4708 11.4604 11.3771L11.4626 11.3749L11.4829 11.3569C11.5039 11.3381 11.5357 11.3063 11.5785 11.2613C11.699 11.1289 11.806 10.985 11.898 10.8315C12.1342 10.4434 12.3795 9.83926 12.3795 8.99776C12.3795 8.15626 12.1342 7.55438 11.898 7.16738C11.7822 6.97656 11.6431 6.80085 11.484 6.64426L11.4637 6.62626C11.3477 6.53326 11.2732 6.39808 11.2565 6.25029C11.2399 6.1025 11.2824 5.95413 11.3749 5.83763ZM13.2896 3.49763C13.232 3.44997 13.1655 3.41427 13.094 3.39261C13.0224 3.37095 12.9473 3.36377 12.8729 3.37148C12.7986 3.37919 12.7265 3.40165 12.661 3.43753C12.5954 3.47342 12.5376 3.52201 12.491 3.58048C12.4445 3.63894 12.41 3.70611 12.3897 3.77804C12.3694 3.84997 12.3636 3.92524 12.3727 3.99943C12.3818 4.07363 12.4056 4.14527 12.4427 4.21016C12.4798 4.27505 12.5294 4.3319 12.5887 4.37738L12.6011 4.38863L12.6596 4.43926C12.7136 4.48651 12.789 4.55963 12.8857 4.65863C13.077 4.85776 13.3357 5.15701 13.5945 5.55188C14.112 6.34051 14.6295 7.50151 14.6295 9.00451C14.6339 10.2311 14.2736 11.4312 13.5945 12.4526C13.3357 12.8464 13.077 13.1434 12.8857 13.3414C12.7952 13.4355 12.7006 13.5255 12.6022 13.6114L12.5899 13.6226H12.5887C12.4752 13.7166 12.4031 13.8514 12.3879 13.9979C12.3727 14.1445 12.4156 14.2912 12.5074 14.4065C12.5993 14.5217 12.7327 14.5964 12.8789 14.6143C13.0252 14.6322 13.1727 14.592 13.2896 14.5024L13.3267 14.472L13.4111 14.3989C13.482 14.3348 13.5799 14.2436 13.6957 14.1233C14.0078 13.7992 14.2888 13.4467 14.535 13.0703C15.3342 11.8653 15.7581 10.4504 15.7534 9.00451C15.7563 7.55746 15.3325 6.14167 14.535 4.93426C14.2887 4.55746 14.0081 4.20421 13.6969 3.87901C13.5792 3.75688 13.4561 3.64013 13.3279 3.52913L13.302 3.50776L13.2941 3.50101L13.2919 3.49876L13.2896 3.49763Z"
          fill="#1F1F1F"
        />
      </g>
    </svg>
  );
}

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
// menu ≡ chuyển Học/Kiểm tra.
function Flashcards() {
  const [all, setAll] = useState<VocabItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // TIP-081 — tutorial overlay: nền tối 50% + con trỏ hoạt hình lặp vô hạn theo chu kỳ 3 pha:
  // 0 (0-1s) chỉ con trỏ; 1 (1-2s) thêm vòng tròn dưới con trỏ; 2 (2-3s) cả 2 trượt sang phải 100px
  // rồi dừng, hết 3s thì lặp lại từ pha 0.
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialPhase, setTutorialPhase] = useState<0 | 1 | 2>(0);
  // Swipe state
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  // exit: hướng thẻ đang "bay ra" khi vuốt (1 = bay sang phải để qua thẻ kế, -1 = sang trái về thẻ trước,
  // 0 = đứng yên). Dùng để chạy hiệu ứng trượt trước khi đổi nội dung thẻ.
  const [exit, setExit] = useState<0 | 1 | -1>(0); // TIP-074: hướng thẻ bay ra (0 = không)
  // TIP-081 — cờ tắt transition đúng 1 frame khi vừa đổi sang thẻ kế (idx đổi + exit reset về 0).
  // Không có cờ này thì cùng 1 DOM node (thẻ chính) sẽ "animate" từ vị trí bay-ra (translateX 130%)
  // về vị trí nghỉ (0%) bằng transition "transform .2s ease" → nhìn như thẻ MỚI bay vào từ chỗ thẻ
  // CŨ vừa bay ra. Ta muốn thẻ mới hiện ra ngay tại chỗ (đã có sẵn trong stack), không bay vào.
  const [justSwitched, setJustSwitched] = useState(false);
  const startX = useRef(0);
  const movedRef = useRef(false);

  useEffect(() => {
    if (!justSwitched) return;
    const raf = requestAnimationFrame(() => setJustSwitched(false));
    return () => cancelAnimationFrame(raf);
  }, [justSwitched]);

  useEffect(() => {
    fetchVocab()
      .then(setAll)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  // TIP-081 — chỉ hiện tutorial LẦN ĐẦU vào trang; nhớ qua localStorage để lần sau không hiện lại.
  useEffect(() => {
    try {
      if (localStorage.getItem(TUTORIAL_KEY) !== "1") setShowTutorial(true);
    } catch {
      /* ignore */
    }
  }, []);

  const dismissTutorial = () => {
    try {
      localStorage.setItem(TUTORIAL_KEY, "1");
    } catch {
      /* ignore */
    }
    setShowTutorial(false);
  };

  // TIP-081 — vòng lặp vô hạn 3 pha (1s mỗi pha) cho hoạt hình con trỏ hướng dẫn.
  useEffect(() => {
    if (!showTutorial) return;
    let cancelled = false;
    const timers: number[] = [];
    const cycle = () => {
      if (cancelled) return;
      setTutorialPhase(0);
      timers.push(window.setTimeout(() => !cancelled && setTutorialPhase(1), 1000));
      timers.push(window.setTimeout(() => !cancelled && setTutorialPhase(2), 2000));
      timers.push(window.setTimeout(() => !cancelled && cycle(), 3000));
    };
    cycle();
    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [showTutorial]);

  const items = useMemo(() => {
    if (!all) return null;
    const sel = readSelection();
    if (sel.length === 0) return all;
    const set = new Set(sel);
    const picked = all.filter((it) => set.has(it.id));
    return picked.length > 0 ? picked : all;
  }, [all]);

  // Thẻ MỚI → tự phát audio + đánh dấu "đã học" (idempotent, fire-and-forget).
  useEffect(() => {
    if (!items || items.length === 0) return;
    const cur = items[idx];
    if (!cur) return;
    playWord(cur);
    void markLearned([cur.id]).catch(() => undefined);
  }, [idx, items]);

  // UX #3 — phím tắt: ← → đổi thẻ, Space/Enter lật.
  useEffect(() => {
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
  }, [items]);

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
  // commitSwipe: khi vuốt đủ mạnh → cho thẻ BAY RA (setExit) rồi ĐỢI 250ms mới đổi sang thẻ kế (go).
  // (Chỉnh được) 250 = thời gian hiệu ứng bay. Nếu đổi số này PHẢI đổi khớp ".25s" trong cardStyle bên dưới.
  const commitSwipe = (dir: 1 | -1) => {
    setDragX(0);
    setExit(dir);
    window.setTimeout(() => {
      setJustSwitched(true);
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
    // Khi thả tay: kéo phải đủ ngưỡng → qua thẻ KẾ; kéo trái đủ ngưỡng → về thẻ TRƯỚC;
    // đang ở thẻ đầu/cuối thì chỉ bật về chỗ cũ; chạm nhẹ (không kéo) → LẬT thẻ xem ví dụ.
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
      ? // (Chỉnh được) Hiệu ứng thẻ bay ra: translateX(±130%) = bay xa cỡ nào; rotate(±8deg) = độ nghiêng;
        // transition .25s = thời gian bay (khớp 250ms ở commitSwipe). Bỏ rotate nếu không muốn thẻ nghiêng.
        {
          transform: `translateX(${exit * 130}%) rotate(${exit * 8}deg)`,
          opacity: 0,
          transition: "transform .25s ease-out, opacity .25s ease-out",
          touchAction: "pan-y",
        }
      : {
          transform: `translateX(${dragX}px) rotate(${dragX * 0.03}deg)`,
          transition: dragging || justSwitched ? "none" : "transform .2s ease",
          touchAction: "pan-y",
        };

  // Thẻ dọc (portrait). (Chỉnh được) w/h = kích thước thẻ.
  // TIP-081 — nhận "cardItem" riêng (mặc định = thẻ đang xem "it") để 2 lớp thẻ nền phía sau có thể
  // hiện đúng nội dung thẻ TIẾP THEO thật (items[idx+1]/[idx+2]) thay vì trống, để khi vuốt thẻ trước
  // đi thì thẻ sau lộ ra đã có sẵn chữ, không bị trắng trơn.
  // "ghost" = không tương tác được (ẩn nút loa, ẩn ví dụ) — dùng cho thẻ nền stack phía sau.
  const renderCard = (ghost = false, cardItem: VocabItem = it) => (
    <div className="relative flex h-[412px] w-[300px] flex-col justify-center rounded-card border border-border bg-surface p-6">
      {/* TIP-081 — cả khối (chữ Anh + icon loa + phiên âm + nghĩa) neo tại (30,30) từ padding-box
          của card (absolute không phụ thuộc p-6). Phiên âm/nghĩa cách lề trái 30px giống chữ Anh,
          mỗi dòng cách dòng trên 5px (mt-[5px]) — dùng flow bên trong khối thay vì absolute từng dòng. */}
      <div className="absolute left-[30px] top-[30px] flex flex-col items-start">
        <div className="flex items-baseline gap-[10px]">
          <span className="text-[28px] font-bold leading-none tracking-[-0.03em]">{cardItem.word}</span>
          {!ghost ? (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                playWord(cardItem);
              }}
              className="group flex h-[18px] w-[18px] items-center justify-center"
              aria-label="Phát âm"
            >
              <SpeakerIcon />
            </button>
          ) : (
            <span className="flex h-[18px] w-[18px] items-center justify-center">
              <SpeakerIcon />
            </span>
          )}
        </div>
        {firstIpa(cardItem.ipa) ? (
          <span className="mt-[5px] text-sm text-muted-foreground">/{firstIpa(cardItem.ipa)}/</span>
        ) : null}
        <span className="mt-[5px] text-base tracking-[-0.03em] text-foreground">{cardItem.meaning_vi || "(chưa có nghĩa)"}</span>
      </div>
      {!ghost && flipped && cardItem.example ? (
        <p className="mt-4 text-sm italic text-muted-foreground">{cardItem.example}</p>
      ) : null}
      {/* TIP-081 — vòng tròn đen góc dưới-phải (Figma), 25x25, cách viền dưới/phải card 21px */}
      <svg
        width="25"
        height="25"
        viewBox="0 0 25 25"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute bottom-[21px] right-[21px]"
      >
        <path
          d="M12.5 22.9166C11.059 22.9166 9.70484 22.643 8.43748 22.0958C7.17012 21.5486 6.06769 20.8066 5.13019 19.8698C4.19269 18.933 3.45068 17.8305 2.90415 16.5625C2.35762 15.2944 2.08401 13.9403 2.08331 12.5C2.08262 11.0597 2.35623 9.70554 2.90415 8.43748C3.45206 7.16942 4.19408 6.06699 5.13019 5.13019C6.0663 4.19338 7.16873 3.45137 8.43748 2.90415C9.70623 2.35692 11.0604 2.08331 12.5 2.08331C13.9396 2.08331 15.2937 2.35692 16.5625 2.90415C17.8312 3.45137 18.9337 4.19338 19.8698 5.13019C20.8059 6.06699 21.5482 7.16942 22.0969 8.43748C22.6455 9.70554 22.9187 11.0597 22.9166 12.5C22.9146 13.9403 22.641 15.2944 22.0958 16.5625C21.5507 17.8305 20.8087 18.933 19.8698 19.8698C18.9309 20.8066 17.8285 21.5489 16.5625 22.0969C15.2965 22.6448 13.9423 22.918 12.5 22.9166Z"
          fill="#1F1F1F"
        />
      </svg>
    </div>
  );

  return (
    <div className="flex flex-col items-center gap-6 py-6">
      {/* TIP-081 — Tutorial, bước 1: nền tối phủ toàn trang, opacity 50%. */}
      {showTutorial ? (
        <div className="fixed inset-0 z-40 cursor-pointer bg-black/50" onClick={dismissTutorial} aria-hidden />
      ) : null}

      {/* TIP-081 — Tutorial: con trỏ hoạt hình, neo tại (left 564.83px, bottom 301px) so với viewport.
          Pha 0 (0-1s): chỉ con trỏ. Pha 1 (1-2s): thêm vòng tròn trắng mờ ở LỚP DƯỚI con trỏ (z thấp
          hơn), cùng vị trí. Pha 2 (2-3s): cả cụm trượt sang phải 100px (transition), giữ nguyên tới
          hết chu kỳ rồi lặp lại (useEffect ở trên reset về pha 0). */}
      {showTutorial ? (
        <div
          className="pointer-events-none fixed z-50"
          style={{
            left: 634.83,
            bottom: 301,
            transform: `translateX(${tutorialPhase === 2 ? 160 : 0}px)`,
            transition: "transform 0.4s ease",
          }}
          aria-hidden
        >
          <div className="relative" style={{ width: 44, height: 51 }}>
            {tutorialPhase >= 1 ? (
              <div
                className="absolute left-1/2 top-1/2 z-0"
                style={{ transform: "translate(calc(-50% - 20px), calc(-50% - 30px))" }}
              >
                <CircleHintIcon />
              </div>
            ) : null}
            <div className="relative z-10">
              <CursorHintIcon />
            </div>
          </div>
        </div>
      ) : null}

      {/* TIP-081 — text hướng dẫn: căn giữa toàn layout (không theo x của combo, vì combo còn di
          chuyển ngang), cách ĐÁY combo (bottom:301px) đúng 30px → bottom:271px + translateY(100%)
          để mép TRÊN của text nằm đúng tại mốc 271px thay vì mép dưới. */}
      {showTutorial ? (
        <p
          className="pointer-events-none fixed left-1/2 z-50 whitespace-nowrap text-[22px] font-medium tracking-[-0.03em] text-white"
          style={{ bottom: 191, transform: "translate(-50%, 100%)" }}
        >
          Giữ thẻ và kéo sang phải để xem thẻ tiếp theo
        </p>
      ) : null}

      {/* TIP-081 — stack thẻ nền CHỈ hiện khi thật sự còn thẻ kế tiếp (items[idx+1]/[idx+2]) — hết
          thẻ (đang ở thẻ cuối) thì KHÔNG hiện thẻ nền trơn giả nữa, để đúng số thẻ còn lại thật.
          Dùng scaleX (chỉ co CHIỀU NGANG nhẹ 3%/6%, KHÔNG scale chiều cao — nếu scale đều cả 2 chiều
          thì mép dưới bị co theo, cộng với offset top sẽ triệt tiêu lẫn nhau khiến phần "lộ ra" ở đáy
          biến mất) để mép dưới thật sự lộ ra theo đúng top offset. */}
      <div className="relative mt-[20px]">
        {items[idx + 2] ? (
          <div
            className="absolute left-1/2 top-[16px] z-0"
            style={{ transform: "translateX(-50%) scaleX(0.94)", transformOrigin: "top center" }}
          >
            {renderCard(true, items[idx + 2])}
          </div>
        ) : null}
        {items[idx + 1] ? (
          <div
            className="absolute left-1/2 top-[8px] z-[1]"
            style={{ transform: "translateX(-50%) scaleX(0.97)", transformOrigin: "top center" }}
          >
            {renderCard(true, items[idx + 1])}
          </div>
        ) : null}
        {/* TIP-074 — thẻ chính: SWIPE có animation (bỏ nút ‹ ›; phím ← → vẫn đổi thẻ). */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={cardStyle}
          className="relative z-[2] cursor-grab select-none active:cursor-grabbing"
        >
          {renderCard(false)}
        </div>
      </div>

      {/* TIP-081 — menu chuyển Học/Kiểm tra: nút 40x40, viền #e6e6e6 (token border), KHÔNG shadow,
          cố định cách đáy layout 48px (fixed, không nằm trong flow gap-6 nữa). */}
      <div className="fixed bottom-[48px] left-1/2 z-40 flex -translate-x-1/2 justify-center">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-[#ffffff] hover:bg-surface-muted"
          title="Menu"
        >
          {/* TIP-081 — phủ đen 50% TRỰC TIẾP (giống hệt phép biến đổi của backdrop toàn trang:
              black/50 lên nền trắng gốc), KHÔNG dùng opacity trên nút — vì nút vẽ SAU backdrop
              (đã xám 127) nên opacity sẽ pha với 127 (ra 191) chứ không pha với trắng gốc (ra 127.5
              — đúng bằng màu nền trang, vì cả hai cùng là trắng bị phủ đen/50 như nhau). */}
          {showTutorial ? <span className="pointer-events-none absolute -inset-px rounded-full bg-black/50" /> : null}
          {menuOpen ? (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M15.3662 2.86623C15.602 2.63853 15.9177 2.51254 16.2455 2.51539C16.5732 2.51823 16.8867 2.6497 17.1185 2.88146C17.3503 3.11322 17.4817 3.42673 17.4846 3.75448C17.4874 4.08222 17.3614 4.39798 17.1337 4.63373L11.7675 9.99998L17.1337 15.3662C17.2531 15.4815 17.3483 15.6195 17.4139 15.772C17.4794 15.9245 17.5139 16.0885 17.5153 16.2545C17.5167 16.4205 17.4851 16.5851 17.4223 16.7387C17.3594 16.8923 17.2666 17.0319 17.1492 17.1492C17.0319 17.2666 16.8923 17.3594 16.7387 17.4223C16.5851 17.4851 16.4205 17.5167 16.2545 17.5153C16.0885 17.5139 15.9245 17.4794 15.772 17.4139C15.6195 17.3483 15.4815 17.2531 15.3662 17.1337L9.99998 11.7675L4.63373 17.1337C4.51842 17.2531 4.38049 17.3483 4.22799 17.4139C4.07548 17.4794 3.91146 17.5139 3.74548 17.5153C3.57951 17.5167 3.41491 17.4851 3.26129 17.4223C3.10767 17.3594 2.9681 17.2666 2.85074 17.1492C2.73337 17.0319 2.64055 16.8923 2.5777 16.7387C2.51485 16.5851 2.48322 16.4205 2.48467 16.2545C2.48611 16.0885 2.52059 15.9245 2.5861 15.772C2.65161 15.6195 2.74684 15.4815 2.86623 15.3662L8.23248 9.99998L2.86623 4.63373C2.74684 4.51842 2.65161 4.38049 2.5861 4.22799C2.52059 4.07548 2.48611 3.91146 2.48467 3.74548C2.48322 3.57951 2.51485 3.41491 2.5777 3.26129C2.64055 3.10767 2.73337 2.9681 2.85074 2.85074C2.9681 2.73337 3.10767 2.64055 3.26129 2.5777C3.41491 2.51485 3.57951 2.48322 3.74548 2.48467C3.91146 2.48611 4.07548 2.52059 4.22799 2.5861C4.38049 2.65161 4.51842 2.74684 4.63373 2.86623L9.99998 8.23248L15.3662 2.86623Z"
                fill="black"
              />
            </svg>
          ) : (
            <svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M4.16667 18.75C3.87153 18.75 3.62431 18.65 3.425 18.45C3.2257 18.25 3.1257 18.0028 3.125 17.7083C3.12431 17.4139 3.22431 17.1667 3.425 16.9667C3.6257 16.7667 3.87292 16.6667 4.16667 16.6667H20.8333C21.1285 16.6667 21.376 16.7667 21.576 16.9667C21.776 17.1667 21.8757 17.4139 21.875 17.7083C21.8743 18.0028 21.7743 18.2503 21.575 18.451C21.3757 18.6517 21.1285 18.7514 20.8333 18.75H4.16667ZM4.16667 13.5417C3.87153 13.5417 3.62431 13.4417 3.425 13.2417C3.2257 13.0417 3.1257 12.7944 3.125 12.5C3.12431 12.2056 3.22431 11.9583 3.425 11.7583C3.6257 11.5583 3.87292 11.4583 4.16667 11.4583H20.8333C21.1285 11.4583 21.376 11.5583 21.576 11.7583C21.776 11.9583 21.8757 12.2056 21.875 12.5C21.8743 12.7944 21.7743 13.042 21.575 13.2427C21.3757 13.4434 21.1285 13.5431 20.8333 13.5417H4.16667ZM4.16667 8.33333C3.87153 8.33333 3.62431 8.23333 3.425 8.03333C3.2257 7.83333 3.1257 7.58611 3.125 7.29167C3.12431 6.99722 3.22431 6.75 3.425 6.55C3.6257 6.35 3.87292 6.25 4.16667 6.25H20.8333C21.1285 6.25 21.376 6.35 21.576 6.55C21.776 6.75 21.8757 6.99722 21.875 7.29167C21.8743 7.58611 21.7743 7.83368 21.575 8.03437C21.3757 8.23507 21.1285 8.33472 20.8333 8.33333H4.16667Z"
                fill="#1F1F1F"
              />
            </svg>
          )}
        </button>
        {menuOpen ? (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} aria-hidden />
            {/* TIP-081 — menu ngang 700x66, viền #e6e6e6 (border-border), bo góc 10px, fill #fcfcfc
                (bg-surface), cách đỉnh nút burger (40px) 25px → bottom = 40+25 = 65px. "Học từ vựng"
                ở giữa; "Kiểm tra Anh-Việt" cách 64px bên trái, "Kiểm tra Việt-Anh" cách 65px bên phải
                (margin riêng từng bên, không dùng gap chung). */}
            <div className="absolute bottom-[55px] left-1/2 z-50 inline-flex -translate-x-1/2 items-center rounded-[20px] border border-border bg-surface px-[45px] py-[16px]">
              <Link
                href="/kiem-tra-anh-viet"
                onClick={() => setMenuOpen(false)}
                className="mr-[64px] whitespace-nowrap text-[18px] font-medium tracking-[-0.03em] text-[#cccccc] hover:text-foreground"
              >
                Kiểm tra Anh-Việt
              </Link>
              <Link
                href="/hoc-tu-vung"
                onClick={() => setMenuOpen(false)}
                className="whitespace-nowrap text-[18px] font-medium tracking-[-0.03em] text-[#cccccc] hover:text-foreground"
              >
                Học từ vựng
              </Link>
              <Link
                href="/kiem-tra-viet-anh"
                onClick={() => setMenuOpen(false)}
                className="ml-[65px] whitespace-nowrap text-[18px] font-medium tracking-[-0.03em] text-[#cccccc] hover:text-foreground"
              >
                Kiểm tra Việt-Anh
              </Link>
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

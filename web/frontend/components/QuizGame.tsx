"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageLoading } from "@/components/ui/Spinner";
import { fetchVocab, buildQuiz, quizableItems, firstIpa, STUDY_SELECTION_KEY, type QuizDirection, type QuizQuestion } from "@/lib/vocabulary";

// TIP-081 — icon loa 18x18, adapt nguyên xi từ app/hoc-tu-vung/page.tsx (thay emoji 🔊).
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

// TIP-073 — đọc selection người dùng chọn ở /tu-vung (nếu có) → quiz CHỈ hỏi các từ đó.
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

// (Giải thích) Hàm đọc to một từ tiếng Anh bằng giọng máy có sẵn của
// trình duyệt (dùng cho nút loa 🔊). Nếu trình duyệt không hỗ trợ thì bỏ qua.
// TIP-081 — sound đúng/sai khi hiện đáp án (file test tự tạo, đặt ở public/sounds/ — thay bằng
// file thật của bạn nếu muốn, chỉ cần giữ đúng tên/đường dẫn).
function playSound(kind: "correct" | "wrong"): void {
  try {
    void new Audio(`/sounds/${kind}.wav`).play();
  } catch {
    /* ignore */
  }
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

/* ============================================================
   GIẢI THÍCH CHO KHÁCH — File: components/QuizGame.tsx
   ------------------------------------------------------------
   Trò chơi TRẮC NGHIỆM từ vựng, dùng chung cho cả 2 chiều:
   Anh→Việt và Việt→Anh (quyết định bằng "direction").
   Cách chơi:
   - Bên trái là thẻ câu hỏi, bên phải là 4 đáp án.
   - Người dùng bấm chọn (hoặc gõ phím 1–4). Ô vừa chọn sáng xanh
     dương, rồi hiện đúng (xanh lá) / sai (đỏ), sau đó TỰ sang câu kế.
   - Trả lời sai được xem lâu hơn một chút để kịp học đáp án đúng.
   - Hết câu thì hiện điểm và nút "Làm lại".
   - Cần tối thiểu 4 từ mới chơi được; nếu ít hơn sẽ báo nhắc lưu thêm từ.
   ============================================================ */
// WEB-05 / TIP-019a / TIP-033 — Quiz 2 chiều dùng chung (Figma: thẻ hỏi dọc bên trái,
// 4 đáp án bên phải, tự sang câu sau khi chọn, menu ≡ dưới). direction qua prop.
export function QuizGame({ direction }: { direction: QuizDirection }) {
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tooFew, setTooFew] = useState(false);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false); // false = pha "đang chọn" (xanh dương); true = hiện đúng/sai
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const revealRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pickRef = useRef<(i: number) => void>(() => {});
  const advanceRef = useRef<() => void>(() => {});

  useEffect(() => {
    fetchVocab()
      .then((items) => {
        if (quizableItems(items).length < 4) {
          setTooFew(true); // cần ≥4 tổng để có đủ đáp án nhiễu
          return;
        }
        // TIP-073 — có selection → CHỈ hỏi các từ đã chọn; rỗng → hỏi toàn bộ.
        const sel = readSelection();
        const selectedItems = sel.length ? items.filter((it) => sel.includes(it.id)) : [];
        const quiz = buildQuiz(items, direction, selectedItems.length ? selectedItems : undefined);
        if (quiz.length === 0) {
          setTooFew(true); // từ đã chọn không đủ điều kiện (thiếu nghĩa) → nhắc
          return;
        }
        setQuestions(quiz);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [direction]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (revealRef.current) clearTimeout(revealRef.current);
  }, []);

  // TIP-081 — câu MỚI (chiều Anh→Việt) → tự đọc to từ tiếng Anh, giống app/hoc-tu-vung
  // (chiều Việt→Anh thì prompt là nghĩa tiếng Việt, không tự đọc).
  useEffect(() => {
    if (!questions || questions.length === 0 || direction !== "en2vi") return;
    const cur = questions[idx];
    if (!cur) return;
    speak(cur.prompt);
  }, [idx, questions, direction]);

  // UX #3 — phím tắt: 1-4 chọn đáp án; Enter/Space qua câu (khi đã trả lời).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= "1" && e.key <= "4") {
        pickRef.current(Number(e.key) - 1);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        advanceRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (error) return <Card><p className="text-sm text-danger-foreground">Lỗi: {error}</p></Card>;

  if (tooFew) {
    return (
      <Card className="text-center">
        <p className="font-medium">Cần ít nhất 4 từ để làm quiz.</p>
        <p className="mt-1 text-sm text-muted-foreground">Hãy lưu thêm từ qua extension khi xem video.</p>
        <Link href="/tu-vung">
          <Button className="mt-4" variant="ghost">Quay lại</Button>
        </Link>
      </Card>
    );
  }

  if (!questions) return <PageLoading label="Đang tạo quiz…" />;

  if (done) {
    return (
      <Card className="mx-auto max-w-sm text-center">
        <h1 className="font-heading text-xl font-normal">Kết quả</h1>
        <p className="mt-2 text-3xl font-normal text-primary">
          {score}/{questions.length}
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Button
            variant="info"
            onClick={() => {
              setIdx(0);
              setSelected(null);
              setScore(0);
              setDone(false);
            }}
          >
            Làm lại
          </Button>
          <Link href="/tu-vung">
            <Button variant="ghost">Về từ vựng</Button>
          </Link>
        </div>
      </Card>
    );
  }

  const q = questions[idx];
  // UX #7 — qua câu ngay (bấm Enter/Space) khi đã trả lời; huỷ timer tự động.
  const advanceNow = () => {
    if (selected === null) return; // chưa trả lời → không skip
    if (revealRef.current) clearTimeout(revealRef.current);
    if (timerRef.current) clearTimeout(timerRef.current);
    setSelected(null);
    setRevealed(false);
    if (idx + 1 >= questions.length) setDone(true);
    else setIdx(idx + 1);
  };
  const pick = (i: number) => {
    if (selected !== null) return;
    const correct = i === q.answerIndex;
    setSelected(i);
    setRevealed(false);
    if (correct) setScore((s) => s + 1);
    // Pha 1: xanh dương (đang chọn) → Pha 2: hiện đúng/sai → tự sang câu.
    // UX #7: trả lời SAI cho xem lâu hơn (2.6s) để học đáp án đúng; đúng thì 1.5s.
    revealRef.current = setTimeout(() => {
      setRevealed(true);
      playSound(correct ? "correct" : "wrong");
    }, 450);
    timerRef.current = setTimeout(() => {
      setSelected(null);
      setRevealed(false);
      if (idx + 1 >= questions.length) setDone(true);
      else setIdx(idx + 1);
    }, correct ? 1500 : 2600);
  };
  pickRef.current = pick;
  advanceRef.current = advanceNow;

  return (
    <div className="relative w-full">
      {/* TIP-081 — gộp thẻ câu hỏi + 4 đáp án vào 1 cụm, căn giữa layout bằng left-1/2 +
          -translate-x-1/2 (thay vì neo toạ độ tuyệt đối x=298 cố định như trước), gap 40px giữ
          nguyên khoảng cách cũ giữa 2 khối. */}
      <div className="absolute left-1/2 top-[56px] flex -translate-x-1/2 items-start gap-[40px]">
        {/* Thẻ câu hỏi: size/style adapt từ app/hoc-tu-vung (300x412, border-border, bg-surface,
            p-6, rounded-card, KHÔNG shadow). */}
        <div className="relative flex h-[400px] w-[300px] flex-col justify-center rounded-card border border-border bg-surface p-6">
          {/* TIP-081 — vị trí/size/style text tiếng Anh + phiên âm + icon loa adapt từ
              app/hoc-tu-vung: neo (30,30), size 28px/bold/tracking -3%, icon 18x18 căn baseline
              cách nhau 10px, phiên âm cách chữ 5px (chỉ hiện khi prompt là từ tiếng Anh). */}
          <div className="absolute left-[30px] top-[30px] flex flex-col items-start">
            <div className="flex items-baseline gap-[10px]">
              <span className="text-[28px] font-bold leading-none tracking-[-0.03em]">{q.prompt}</span>
              {direction === "en2vi" ? (
                <button
                  onClick={() => speak(q.prompt)}
                  className="group flex h-[18px] w-[18px] items-center justify-center"
                  aria-label="Phát âm"
                >
                  <SpeakerIcon />
                </button>
              ) : null}
            </div>
            {firstIpa(q.ipa) ? <span className="mt-[5px] text-sm text-muted-foreground">/{firstIpa(q.ipa)}/</span> : null}
          </div>
          {/* TIP-081 — vòng tròn đen góc dưới-phải, adapt nguyên xi từ app/hoc-tu-vung (25x25,
              cách viền dưới/phải 21px), thay cho chấm tròn nhỏ cũ. */}
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

        {/* 4 đáp án: trắng mặc định → đúng=xanh lá, sai-chọn=hồng. Mỗi thẻ trả lời 300x88. */}
        <div className="flex h-[400px] w-[300px] flex-col justify-center gap-3">
          {q.options.map((opt, i) => {
            let cls = "border-border bg-surface hover:bg-surface-muted"; // mặc định: trắng
            if (selected !== null) {
              if (!revealed) {
                // Pha đang chọn: ô vừa chọn = xanh dương, còn lại mờ.
                // TIP-081 — "viền đen" báo lỗi hoá ra là do border-info-foreground (#1f1f1f, token chữ
                // dùng để đọc được TRÊN nền info, không phải màu viền) — không giống success/danger
                // (2 token đó vốn đã là màu xanh lá/đỏ thật). Đổi sang #005FB9 (xanh dương đã dùng
                // cho checkmark trong app) để border khớp đúng tông "đang chọn" màu xanh dương.
                cls = i === selected ? "border-[#005FB9] bg-info text-info-foreground" : "border-border bg-surface opacity-70";
              } else if (i === q.answerIndex) {
                cls = "border-success-foreground bg-success text-success-foreground"; // đúng = xanh lá
              } else if (i === selected) {
                cls = "border-danger-foreground bg-danger text-danger-foreground"; // chọn sai = hồng
              } else {
                cls = "border-border bg-surface opacity-60";
              }
            }
            return (
              <button
                key={i}
                onClick={() => pick(i)}
                disabled={selected !== null}
                className={`flex h-[88px] w-[300px] items-center justify-center rounded-card border text-center text-[20px] font-normal tracking-[-0.03em] outline-none transition-colors focus:outline-none focus-visible:outline-none ${cls}`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      {/* TIP-081 — menu chuyển Học/Kiểm tra: adapt nguyên xi từ app/hoc-tu-vung (nút 40x40, viền
          #e6e6e6/border-border, KHÔNG shadow, icon hamburger/X, popup ngang 700 rộng). Giữ vị trí
          y hệt hoc-tu-vung: fixed cách đáy layout 48px, không phụ thuộc vị trí thẻ câu hỏi ở trên. */}
      <div className="fixed bottom-[48px] left-1/2 z-40 flex -translate-x-1/2 justify-center">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-[#ffffff] hover:bg-surface-muted"
          title="Menu"
        >
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

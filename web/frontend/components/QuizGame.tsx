"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageLoading } from "@/components/ui/Spinner";
import { fetchVocab, buildQuiz, quizableItems, type QuizDirection, type QuizQuestion } from "@/lib/vocabulary";

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

  useEffect(() => {
    fetchVocab()
      .then((items) => {
        if (quizableItems(items).length < 4) {
          setTooFew(true);
          return;
        }
        setQuestions(buildQuiz(items, direction));
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [direction]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (revealRef.current) clearTimeout(revealRef.current);
  }, []);

  if (error) return <Card><p className="text-sm text-red-600">Lỗi: {error}</p></Card>;

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
        <h1 className="font-heading text-xl font-bold">Kết quả</h1>
        <p className="mt-2 text-3xl font-bold text-primary">
          {score}/{questions.length}
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Button
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
  const pick = (i: number) => {
    if (selected !== null) return;
    setSelected(i);
    setRevealed(false);
    if (i === q.answerIndex) setScore((s) => s + 1);
    // Pha 1: xanh dương (đang chọn) → Pha 2: hiện đúng/sai → tự sang câu (Figma không có nút).
    revealRef.current = setTimeout(() => setRevealed(true), 450);
    timerRef.current = setTimeout(() => {
      setSelected(null);
      setRevealed(false);
      if (idx + 1 >= questions.length) setDone(true);
      else setIdx(idx + 1);
    }, 1600);
  };

  return (
    <div className="flex flex-col items-center gap-6 py-6">
      <div className="grid w-full max-w-3xl items-center gap-6 md:grid-cols-2">
        {/* Thẻ hỏi (Figma: dọc, chữ trên-trái + loa nếu là từ tiếng Anh, chấm đen góc dưới) */}
        <div className="relative flex min-h-[300px] flex-col rounded-card border border-border bg-surface p-6 shadow-card">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{q.prompt}</span>
            {direction === "en2vi" ? (
              <button onClick={() => speak(q.prompt)} className="text-lg" aria-label="Phát âm">
                🔊
              </button>
            ) : null}
          </div>
          <span className="absolute bottom-4 right-4 h-3 w-3 rounded-full bg-foreground" aria-hidden />
        </div>

        {/* 4 đáp án: trắng mặc định → đúng=xanh lá, sai-chọn=hồng */}
        <div className="flex flex-col justify-center gap-3">
          {q.options.map((opt, i) => {
            let cls = "border-border bg-surface hover:bg-surface-muted"; // mặc định: trắng
            if (selected !== null) {
              if (!revealed) {
                // Pha đang chọn: ô vừa chọn = xanh dương, còn lại mờ.
                cls = i === selected ? "border-info-foreground bg-info text-info-foreground" : "border-border bg-surface opacity-70";
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
                className={`w-full rounded-card border px-4 py-4 text-center text-sm font-medium transition-colors ${cls}`}
              >
                {opt}
              </button>
            );
          })}
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

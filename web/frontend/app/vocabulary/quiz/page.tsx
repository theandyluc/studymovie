"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageLoading } from "@/components/ui/Spinner";
import { fetchVocab, buildQuiz, quizableItems, type QuizDirection, type QuizQuestion } from "@/lib/vocabulary";

// WEB-05 — Quiz 2 chiều EN→VI / VI→EN. 4 đáp án (1 đúng + 3 sai random từ vocab user).
function Quiz() {
  const [dir, setDir] = useState<QuizDirection>("en2vi");
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tooFew, setTooFew] = useState(false);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const mode = new URLSearchParams(window.location.search).get("mode");
    const d: QuizDirection = mode === "vi2en" ? "vi2en" : "en2vi";
    setDir(d);
    fetchVocab()
      .then((items) => {
        if (quizableItems(items).length < 4) {
          setTooFew(true);
          return;
        }
        setQuestions(buildQuiz(items, d));
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (error) return <Card><p className="text-sm text-red-600">Lỗi: {error}</p></Card>;

  if (tooFew) {
    return (
      <Card className="text-center">
        <p className="font-medium">Cần ít nhất 4 từ để làm quiz.</p>
        <p className="mt-1 text-sm text-muted-foreground">Hãy lưu thêm từ qua extension khi xem video.</p>
        <Link href="/vocabulary">
          <Button className="mt-4" variant="ghost">Quay lại</Button>
        </Link>
      </Card>
    );
  }

  if (!questions) return <PageLoading label="Đang tạo quiz…" />;

  if (done) {
    return (
      <Card className="text-center">
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
          <Link href="/vocabulary">
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
    if (i === q.answerIndex) setScore((s) => s + 1);
  };
  const next = () => {
    if (idx + 1 >= questions.length) {
      setDone(true);
    } else {
      setIdx((i) => i + 1);
      setSelected(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/vocabulary" className="text-sm text-muted-foreground hover:text-foreground">
          ← Từ vựng
        </Link>
        <span className="text-sm text-muted-foreground">
          {dir === "en2vi" ? "EN → VI" : "VI → EN"} · Câu {idx + 1}/{questions.length} · Điểm {score}
        </span>
      </div>

      <Card>
        <p className="mb-4 text-center text-2xl font-semibold">{q.prompt}</p>
        <div className="grid gap-2">
          {q.options.map((opt, i) => {
            let cls = "border-border bg-surface hover:bg-surface-muted";
            if (selected !== null) {
              if (i === q.answerIndex) cls = "border-green-600 bg-green-50";
              else if (i === selected) cls = "border-red-600 bg-red-50";
              else cls = "border-border bg-surface opacity-60";
            }
            return (
              <button
                key={i}
                onClick={() => pick(i)}
                disabled={selected !== null}
                className={`w-full rounded-btn border px-4 py-2 text-left text-sm transition-colors ${cls}`}
              >
                {opt}
              </button>
            );
          })}
        </div>
        {selected !== null ? (
          <Button className="mt-4 w-full" onClick={next}>
            {idx + 1 >= questions.length ? "Xem kết quả" : "Câu tiếp →"}
          </Button>
        ) : null}
      </Card>
    </div>
  );
}

export default function QuizPage() {
  return (
    <AuthGuard>
      <Quiz />
    </AuthGuard>
  );
}

"use client";
import { AuthGuard } from "@/components/AuthGuard";
import { QuizGame } from "@/components/QuizGame";

// TIP-019a — Quiz Việt→Anh (canonical VN). Route cũ /vocabulary/quiz?mode=vi2en redirect về đây.
export default function KiemTraVietAnhPage() {
  return (
    <AuthGuard>
      <QuizGame direction="vi2en" />
    </AuthGuard>
  );
}

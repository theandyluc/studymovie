"use client";
import { AuthGuard } from "@/components/AuthGuard";
import { QuizGame } from "@/components/QuizGame";

// TIP-019a — Quiz Anh→Việt (canonical VN). Route cũ /vocabulary/quiz?mode=en2vi redirect về đây.
export default function KiemTraAnhVietPage() {
  return (
    <AuthGuard>
      <QuizGame direction="en2vi" />
    </AuthGuard>
  );
}

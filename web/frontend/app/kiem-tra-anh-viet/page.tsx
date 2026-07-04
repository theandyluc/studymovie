"use client";
import { AuthGuard } from "@/components/AuthGuard";
import { QuizGame } from "@/components/QuizGame";

/* GIẢI THÍCH CHO KHÁCH — app/kiem-tra-anh-viet/page.tsx
   Trang "Kiểm tra Anh→Việt": hiện từ tiếng Anh, người dùng chọn nghĩa
   tiếng Việt đúng. Trang này chỉ mở trò chơi trắc nghiệm (QuizGame) ở
   chiều "en2vi" và yêu cầu đã đăng nhập. */
// TIP-019a — Quiz Anh→Việt (canonical VN). Route cũ /vocabulary/quiz?mode=en2vi redirect về đây.
export default function KiemTraAnhVietPage() {
  return (
    <AuthGuard>
      <QuizGame direction="en2vi" />
    </AuthGuard>
  );
}

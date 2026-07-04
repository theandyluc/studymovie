"use client";
import { AuthGuard } from "@/components/AuthGuard";
import { QuizGame } from "@/components/QuizGame";

/* GIẢI THÍCH CHO KHÁCH — app/kiem-tra-viet-anh/page.tsx
   Trang "Kiểm tra Việt→Anh": hiện nghĩa tiếng Việt, người dùng chọn từ
   tiếng Anh đúng. Trang này chỉ mở trò chơi trắc nghiệm (QuizGame) ở
   chiều "vi2en" và yêu cầu đã đăng nhập. */
// TIP-019a — Quiz Việt→Anh (canonical VN). Route cũ /vocabulary/quiz?mode=vi2en redirect về đây.
export default function KiemTraVietAnhPage() {
  return (
    <AuthGuard>
      <QuizGame direction="vi2en" />
    </AuthGuard>
  );
}

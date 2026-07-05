/* ============================================================
   GIẢI THÍCH CHO KHÁCH — File: app/layout.tsx
   ------------------------------------------------------------
   "Khung sườn" chung bọc quanh MỌI trang của web. Ở đây đặt:
   - Phông chữ Inter (hỗ trợ tiếng Việt) dùng cho toàn trang.
   - Thanh điều hướng trên cùng (Header).
   - Vùng nội dung chính, được "Người gác cửa quyền học" (AccessGuard)
     bảo vệ.
   - Toaster + ConfirmHost: hệ thống thông báo và hộp xác nhận dùng chung.
   - Tiêu đề + mô tả trang (metadata) hiện trên tab trình duyệt và Google.
   ============================================================ */
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { AccessGuard } from "@/components/AccessGuard";
import { Toaster, ConfirmHost } from "@/components/ui/feedback";

// TIP-021 — Inter (hỗ trợ tiếng Việt), nạp qua next/font → biến --font-inter cho @theme.
const inter = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata = {
  title: "StudyMovie",
  description: "Học tiếng Anh qua YouTube với phụ đề song ngữ.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" className={inter.variable}>
      <body className="flex min-h-screen flex-col" suppressHydrationWarning>
        <Header />
        {/* TIP-081 — khung layout khớp frame Figma 1280px (không phải 1024px/max-w-5xl cũ) */}
        <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-8">
          <AccessGuard>{children}</AccessGuard>
        </main>
        <Toaster />
        <ConfirmHost />
      </body>
    </html>
  );
}

import type { ReactNode } from "react";
import "./globals.css";
import { Header } from "@/components/Header";
import { AccessGuard } from "@/components/AccessGuard";

export const metadata = {
  title: "StudyMovie",
  description: "Học tiếng Anh qua YouTube với phụ đề song ngữ.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-screen">
        <Header />
        <main className="mx-auto w-full max-w-5xl px-4 py-8">
          <AccessGuard>{children}</AccessGuard>
        </main>
      </body>
    </html>
  );
}

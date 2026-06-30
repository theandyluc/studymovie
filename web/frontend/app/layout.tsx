import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { AccessGuard } from "@/components/AccessGuard";

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
      <body className="min-h-screen">
        <Header />
        <main className="mx-auto w-full max-w-5xl px-4 py-8">
          <AccessGuard>{children}</AccessGuard>
        </main>
      </body>
    </html>
  );
}

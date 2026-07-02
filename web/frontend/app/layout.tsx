import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
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
    <html lang="vi" className={inter.variable} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        {/* TIP-034 anti-FOUC: đặt class 'dark' TRƯỚC khi paint để không lóe sáng */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('sm-theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}`,
          }}
        />
        <Header />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
          <AccessGuard>{children}</AccessGuard>
        </main>
        <Footer />
        <Toaster />
        <ConfirmHost />
      </body>
    </html>
  );
}

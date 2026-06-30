"use client";
import Link from "next/link";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

// TIP-019a — Trang cảm ơn sau thanh toán. KHÔNG bị access guard chặn (019b allowlist).
function ThankYou() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Card className="w-full max-w-md text-center">
        <div className="text-5xl">🎉</div>
        <h1 className="mt-3 font-heading text-2xl font-bold">Cảm ơn bạn đã nâng cấp Pro!</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tài khoản của bạn đã được kích hoạt. Chúc bạn học tiếng Anh hiệu quả cùng StudyMovie.
        </p>
        <Link href="/dashboard" className="mt-5 inline-block">
          <Button>Vào học</Button>
        </Link>
      </Card>
    </div>
  );
}

export default function CamOnPage() {
  return (
    <AuthGuard>
      <ThankYou />
    </AuthGuard>
  );
}

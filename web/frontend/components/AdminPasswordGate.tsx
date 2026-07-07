"use client";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { toast } from "@/components/ui/feedback";
import { ApiError } from "@/lib/apiClient";
import { verifyAdminPagePassword } from "@/lib/admin";

/* ============================================================
   GIẢI THÍCH CHO KHÁCH — File: components/AdminPasswordGate.tsx
   ------------------------------------------------------------
   Lớp khoá THÊM cho trang /admin, ngoài việc phải đăng nhập bằng
   tài khoản admin. Mỗi khi mở trang này ở một tab mới (hoặc trình
   duyệt mới), phải nhập đúng mật khẩu mới xem được nội dung.
   Mật khẩu thật chỉ nằm ở máy chủ (biến môi trường ADMIN_PAGE_PASSWORD),
   trình duyệt chỉ gửi mật khẩu người nhập lên để máy chủ so khớp.
   ============================================================ */
// TIP-100 — sessionStorage: mở tab mới / đóng trình duyệt -> phải nhập lại.
const UNLOCK_KEY = "sm-admin-unlocked";

export function AdminPasswordGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(
    () => typeof window !== "undefined" && sessionStorage.getItem(UNLOCK_KEY) === "1"
  );
  const [password, setPassword] = useState("");
  const [checking, setChecking] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!password || checking) return;
    setChecking(true);
    try {
      const res = await verifyAdminPagePassword(password);
      if (res.ok) {
        sessionStorage.setItem(UNLOCK_KEY, "1");
        setUnlocked(true);
      } else {
        toast("Sai mật khẩu", "error");
        setPassword("");
      }
    } catch (err) {
      toast(err instanceof ApiError ? "Không kiểm tra được, thử lại" : "Có lỗi xảy ra", "error");
    } finally {
      setChecking(false);
    }
  }

  if (unlocked) return <>{children}</>;

  return (
    <div className="mx-auto max-w-sm">
      <Card className="space-y-4">
        <h1 className="font-heading text-lg font-bold">Trang quản trị</h1>
        <p className="text-sm text-muted-foreground">Nhập mật khẩu để tiếp tục.</p>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-btn border border-border px-3 py-2 text-sm"
            placeholder="Mật khẩu"
          />
          <Button type="submit" className="w-full" disabled={checking}>
            {checking ? "Đang kiểm tra…" : "Vào trang"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

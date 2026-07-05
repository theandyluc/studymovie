/* ============================================================
   GIẢI THÍCH CHO KHÁCH — File: hooks/useUser.ts
   ------------------------------------------------------------
   Đây là "công tắc" giúp mọi màn hình biết: HIỆN AI ĐANG ĐĂNG NHẬP?
   - Khi trang vừa mở, nó hỏi Supabase xem có phiên đăng nhập không
     (trong lúc chờ thì "loading = đang tải").
   - Nó cũng lắng nghe khi trạng thái đăng nhập thay đổi (đăng nhập,
     đăng xuất) để cập nhật ngay.

   Một mẹo nhỏ trong file: mỗi lần người dùng bấm qua lại tab, Supabase
   hay báo lại "vẫn người này". Code chỉ cập nhật khi NGƯỜI DÙNG THẬT SỰ
   đổi, tránh việc màn hình nhấp nháy / tải lại không cần thiết.
   ============================================================ */
"use client";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabaseClient";

// DEV-ONLY: giả lập user đã login để xem UI local khi chưa có Supabase/extension.
// Bật bằng NEXT_PUBLIC_DEV_FAKE_LOGIN=1 trong .env.local (không commit/push lên main).
const DEV_FAKE_USER =
  process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_DEV_FAKE_LOGIN === "1"
    ? ({ id: "dev-fake-user", email: "dev@local.test" } as User)
    : null;

/** Theo dõi user đăng nhập (client-side). loading=true cho tới khi biết trạng thái. */
export function useUser(): { user: User | null; loading: boolean } {
  const [user, setUser] = useState<User | null>(DEV_FAKE_USER);
  const [loading, setLoading] = useState(!DEV_FAKE_USER);

  useEffect(() => {
    if (DEV_FAKE_USER) return;
    const sb = getSupabase();
    if (!sb) {
      setLoading(false);
      return;
    }
    let active = true;
    sb.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    // Supabase fire lại SIGNED_IN/TOKEN_REFRESHED mỗi lần tab được focus → nếu setUser với
    // object mới (dù cùng user) sẽ khiến AccessGuard refetch + flash loading ("auto reload").
    // → Chỉ đổi khi ID user THẬT SỰ khác; cùng user thì giữ nguyên reference.
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      const next = session?.user ?? null;
      setUser((prev) => (prev?.id === next?.id ? prev : next));
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}

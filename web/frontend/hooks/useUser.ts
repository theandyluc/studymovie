"use client";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabaseClient";

/** Theo dõi user đăng nhập (client-side). loading=true cho tới khi biết trạng thái. */
export function useUser(): { user: User | null; loading: boolean } {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

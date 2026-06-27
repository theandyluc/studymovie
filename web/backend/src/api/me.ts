// TIP-003 — GET /api/me (protected): profile của user hiện tại.
// TIP-004 — kèm subscription + cờ is_active tính SERVER-SIDE theo now()
//   (extension/web KHÔNG tự quyết hết hạn — luôn hỏi server).
import type { Context } from "hono";
import { getServiceClient } from "../lib/supabase.js";

type Subscription = {
  status: "trial" | "active" | "expired";
  trial_ends_at: string | null;
  paid_until: string | null;
};

function computeIsActive(sub: Subscription | null): boolean {
  if (!sub) return false;
  const now = Date.now();
  if (sub.status === "active" && sub.paid_until && new Date(sub.paid_until).getTime() > now) {
    return true;
  }
  if (sub.status === "trial" && sub.trial_ends_at && new Date(sub.trial_ends_at).getTime() > now) {
    return true;
  }
  return false;
}

export async function getMe(c: Context) {
  const user = c.get("user");
  const sb = getServiceClient();

  const [{ data: profile, error: pErr }, { data: sub, error: sErr }] = await Promise.all([
    sb.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    sb
      .from("subscriptions")
      .select("status, trial_ends_at, paid_until")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (pErr) return c.json({ error: pErr.message }, 500);
  if (sErr) return c.json({ error: sErr.message }, 500);

  return c.json({
    user: { id: user.id, email: user.email },
    profile,
    subscription: sub,
    is_active: computeIsActive(sub as Subscription | null),
  });
}

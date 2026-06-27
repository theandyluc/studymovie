// TIP-003 — Verify chuỗi auth end-to-end của backend (AC-6).
// Yêu cầu: backend đang chạy ở NEXT_PUBLIC_BACKEND_URL.
// CHẠY (từ repo root):  node --env-file=.env web/backend/verify_auth.mjs
//   Tạo user tạm (admin) -> đăng nhập lấy access_token -> gọi /api/me có/không token
//   -> kiểm 200/401 -> XOÁ user. Không để lại dữ liệu test.

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;
const backend = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8787";
if (!url || !serviceKey || !anonKey) {
  console.error("Thiếu SUPABASE_URL / SERVICE_ROLE / ANON trong .env");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const results = [];
const ok = (name, pass, detail) => {
  results.push(pass);
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
};

let userId = null;
const email = `tip003-verify-${Math.floor(Date.now() / 1000)}@studymovie.test`;
const password = "Verify-" + Math.random().toString(36).slice(2) + "!9";

try {
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name: "TIP003 Verify" },
  });
  if (cErr) throw new Error("createUser: " + cErr.message);
  userId = created.user.id;

  // không token -> 401
  const r401 = await fetch(`${backend}/api/me`);
  ok("AC-6 /api/me KHÔNG token -> 401", r401.status === 401, `status=${r401.status}`);

  // token sai -> 401
  const rBad = await fetch(`${backend}/api/me`, { headers: { Authorization: "Bearer not-a-real-token" } });
  ok("AC-6 /api/me token sai -> 401", rBad.status === 401, `status=${rBad.status}`);

  // đăng nhập lấy token
  const userClient = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: si, error: siErr } = await userClient.auth.signInWithPassword({ email, password });
  if (siErr) throw new Error("signIn: " + siErr.message);
  const token = si.session.access_token;

  // có token -> 200 + profile đúng user
  const r200 = await fetch(`${backend}/api/me`, { headers: { Authorization: `Bearer ${token}` } });
  const body = await r200.json();
  ok("AC-6 /api/me CÓ token -> 200", r200.status === 200, `status=${r200.status}`);
  ok("AC-6 /api/me trả đúng user", body?.user?.id === userId, `me.id=${(body?.user?.id ?? "∅").slice(0, 8)}…`);
  ok("AC-6 /api/me kèm profile (trigger)", !!body?.profile && body.profile.id === userId, `profile.nickname=${body?.profile?.nickname}`);
  ok("AC-7 /api/me kèm subscription (trial)", !!body?.subscription && body.subscription.status === "trial", `status=${body?.subscription?.status}`);
  ok("AC-7 is_active server-side (trial mới -> true)", body?.is_active === true, `is_active=${body?.is_active}`);

  // CORS: preflight từ origin lạ không được phép
  const rCors = await fetch(`${backend}/api/me`, {
    method: "OPTIONS",
    headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "GET" },
  });
  const allowOrigin = rCors.headers.get("access-control-allow-origin");
  ok("AC-6 CORS không mở cho origin lạ", allowOrigin !== "*" && allowOrigin !== "https://evil.example", `allow-origin=${allowOrigin ?? "∅"}`);
} catch (e) {
  ok("FATAL", false, e.message);
} finally {
  if (userId) {
    await admin.auth.admin.deleteUser(userId);
    console.log(`[cleanup] đã xoá user tạm ${userId.slice(0, 8)}…`);
  }
}

const failed = results.filter((p) => !p).length;
console.log(`\n=== ${results.length - failed}/${results.length} PASS ===`);
process.exit(failed ? 1 : 0);

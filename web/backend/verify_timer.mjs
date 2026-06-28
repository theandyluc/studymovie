// TIP-010 — Verify POST /api/study-session end-to-end. Backend chạy ở NEXT_PUBLIC_BACKEND_URL.
// CHẠY: node --env-file=.env web/backend/verify_timer.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;
const backend = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8787";
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const results = [];
const ok = (n, p, d) => { results.push(p); console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); };

let userId = null;
try {
  const email = `tip010-${Math.floor(Date.now() / 1000)}@studymovie.test`;
  const password = "Verify-" + Math.random().toString(36).slice(2) + "!9";
  const { data: created, error: ce } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (ce) throw new Error("createUser: " + ce.message);
  userId = created.user.id;
  const uc = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: si } = await uc.auth.signInWithPassword({ email, password });
  const auth = { Authorization: `Bearer ${si.session.access_token}`, "Content-Type": "application/json" };
  const post = (b) => fetch(`${backend}/api/study-session`, { method: "POST", headers: auth, body: JSON.stringify(b) });

  // 401
  const r401 = await fetch(`${backend}/api/study-session`, { method: "POST", body: JSON.stringify({ duration_sec: 60 }) });
  ok("AC-7 KHÔNG token -> 401", r401.status === 401, `status=${r401.status}`);

  // hợp lệ: 120s + 90s
  const a = await post({ duration_sec: 120 });
  const b = await post({ duration_sec: 90 });
  ok("AC-3/7 POST 120s -> ok", a.status === 200, `status=${a.status}`);
  ok("AC-4 POST 90s -> ok (2 phiên)", b.status === 200, `status=${b.status}`);

  // study_sessions: 2 row, tổng 210s, started_at hôm nay
  const { data: rows } = await admin.from("study_sessions").select("duration_sec, started_at, ended_at").eq("user_id", userId);
  const total = (rows ?? []).reduce((s, r) => s + r.duration_sec, 0);
  ok("AC-3 study_sessions có 2 row, tổng 210s", (rows?.length ?? 0) === 2 && total === 210, `count=${rows?.length} total=${total}`);
  const startedToday = (rows ?? []).every((r) => new Date(r.started_at) <= new Date(r.ended_at));
  ok("AC-3 started_at <= ended_at (interval hợp lệ)", startedToday, "");

  // today_minutes phản ánh (210s = 3 phút)
  const { data: mins } = await admin.rpc("today_minutes", { p_user_id: userId });
  ok("AC-5 today_minutes phản ánh (~3)", mins === 3, `today_minutes=${mins}`);

  // invalid
  for (const v of [0, -5, 99999, "abc"]) {
    const r = await post({ duration_sec: v });
    ok(`AC-7 duration_sec=${v} -> 400`, r.status === 400, `status=${r.status}`);
  }
} catch (e) {
  ok("FATAL", false, e.message);
} finally {
  if (userId) {
    await admin.from("study_sessions").delete().eq("user_id", userId);
    await admin.auth.admin.deleteUser(userId);
  }
  console.log("[cleanup] đã xoá study_sessions + user tạm");
}
const failed = results.filter((p) => !p).length;
console.log(`\n=== ${results.length - failed}/${results.length} PASS ===`);
process.exit(failed ? 1 : 0);

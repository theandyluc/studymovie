// TIP-007 — Verify /api/dashboard + /api/leaderboard + /api/profile end-to-end (AC-1,2,3,5,6).
// Tạo 2 user tạm (A,B) + seed study_sessions tuần này → kiểm dashboard (A) + leaderboard
// (A,B xếp hạng) + profile GET/PATCH (A) → XOÁ cả 2 user. CHẠY: node --env-file=.env web/backend/verify_account.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;
const backend = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8787";
if (!url || !serviceKey || !anonKey) {
  console.error("Thiếu env");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const results = [];
const ok = (n, p, d) => {
  results.push(p);
  console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`);
};

function ymdUTC7(off = 0) {
  const utc7 = new Date(Date.now() + off * 86400000 + 7 * 3600000);
  return utc7.toISOString().slice(0, 10);
}
function session(uid, ymd, minutes) {
  const started = `${ymd}T05:00:00+07:00`;
  const sec = minutes * 60;
  return { user_id: uid, started_at: started, ended_at: new Date(new Date(started).getTime() + sec * 1000).toISOString(), duration_sec: sec };
}
async function mkUser(tag, nickname) {
  const email = `tip007-${tag}-${Math.floor(Date.now() / 1000)}@studymovie.test`;
  const password = "Verify-" + Math.random().toString(36).slice(2) + "!9";
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: nickname } });
  if (error) throw new Error("createUser " + tag + ": " + error.message);
  const uc = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: si, error: se } = await uc.auth.signInWithPassword({ email, password });
  if (se) throw new Error("signIn " + tag + ": " + se.message);
  return { id: data.user.id, token: si.session.access_token };
}

let A = null;
let B = null;
try {
  A = await mkUser("a", "User A");
  B = await mkUser("b", "User B");
  const authA = { Authorization: `Bearer ${A.token}`, "Content-Type": "application/json" };

  // 401
  const r401 = await fetch(`${backend}/api/dashboard`);
  ok("AC-6 /api/dashboard KHÔNG token -> 401", r401.status === 401, `status=${r401.status}`);

  // seed: A 35' hôm nay (đạt goal 30), B 60' hôm nay
  await admin.from("study_sessions").insert([session(A.id, ymdUTC7(0), 35), session(B.id, ymdUTC7(0), 60)]);

  // Dashboard A
  const dash = await (await fetch(`${backend}/api/dashboard`, { headers: authA })).json();
  ok("AC-1 dashboard streak/today_met/today_minutes", dash.streak === 1 && dash.today_met === true && dash.today_minutes === 35, `streak=${dash.streak} met=${dash.today_met} min=${dash.today_minutes}`);
  ok("AC-2 dashboard week[7]/month[30]", Array.isArray(dash.week) && dash.week.length === 7 && dash.month.length === 30, `week=${dash.week?.length} month=${dash.month?.length}`);

  // Profile GET + PATCH
  const prof1 = (await (await fetch(`${backend}/api/profile`, { headers: authA })).json()).profile;
  ok("AC-3 GET /api/profile", !!prof1 && typeof prof1.daily_commit_minutes === "number", `commit=${prof1?.daily_commit_minutes}`);
  const prof2 = (await (await fetch(`${backend}/api/profile`, { method: "PATCH", headers: authA, body: JSON.stringify({ nickname: "Nick A", daily_commit_minutes: 45 }) })).json()).profile;
  ok("AC-3 PATCH /api/profile cập nhật", prof2?.nickname === "Nick A" && prof2?.daily_commit_minutes === 45, `nick=${prof2?.nickname} commit=${prof2?.daily_commit_minutes}`);
  const prof3 = (await (await fetch(`${backend}/api/profile`, { headers: authA })).json()).profile;
  ok("AC-3 reload thấy giá trị mới", prof3?.nickname === "Nick A" && prof3?.daily_commit_minutes === 45, `nick=${prof3?.nickname}`);

  // Leaderboard (A): B (60) trên A (35); A có mặt
  const lb = await (await fetch(`${backend}/api/leaderboard`, { headers: authA })).json();
  const ids = (lb.top ?? []).map((r) => r.user_id);
  const idxA = ids.indexOf(A.id);
  const idxB = ids.indexOf(B.id);
  ok("AC-5 leaderboard có A và B", idxA >= 0 && idxB >= 0, `top=${lb.top?.length}`);
  ok("AC-5 B (60') xếp trên A (35')", idxB >= 0 && idxA >= 0 && idxB < idxA, `idxB=${idxB} idxA=${idxA}`);
  ok("AC-5 dòng caller (A) hiển thị", idxA >= 0 || (lb.caller && lb.caller.user_id === A.id), `caller=${lb.caller ? lb.caller.user_id?.slice(0, 6) : "trong top"}`);
} catch (e) {
  ok("FATAL", false, e.message);
} finally {
  for (const u of [A, B]) {
    if (u) {
      await admin.from("study_sessions").delete().eq("user_id", u.id);
      await admin.auth.admin.deleteUser(u.id);
    }
  }
  console.log("[cleanup] đã xoá user tạm A,B");
}

const failed = results.filter((p) => !p).length;
console.log(`\n=== ${results.length - failed}/${results.length} PASS ===`);
process.exit(failed ? 1 : 0);

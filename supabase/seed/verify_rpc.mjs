// TIP-002 — Seed test tối thiểu + verify RPC (AC-4 trigger, AC-5 RPC, AC-3 RLS spot-check).
//
// CHẠY:  node --env-file=.env supabase/seed/verify_rpc.mjs
//   Tạo 1 user tạm (auth.admin) -> kiểm trigger sinh profiles+subscriptions;
//   seed study_sessions; gọi RPC bằng JWT của chính user; cuối cùng XOÁ user (cascade).
//   KHÔNG để lại dữ liệu test trong DB.

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;
if (!url || !serviceKey || !anonKey) {
  console.error("Thiếu SUPABASE_URL / SERVICE_ROLE / ANON key trong .env");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

// Ngày theo UTC+7
function ymdUTC7(offsetDays = 0) {
  const now = new Date(Date.now() + offsetDays * 86400000);
  const utc7 = new Date(now.getTime() + 7 * 3600000);
  return utc7.toISOString().slice(0, 10);
}
function sessionRow(userId, ymd, minutes) {
  const started = `${ymd}T05:00:00+07:00`; // 12:00 trưa giờ VN
  const sec = minutes * 60;
  const end = new Date(new Date(started).getTime() + sec * 1000).toISOString();
  return { user_id: userId, started_at: started, ended_at: end, duration_sec: sec };
}

const results = [];
const ok = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
};

let userId = null;
const email = `tip002-verify-${Math.floor(Date.now() / 1000)}@studymovie.test`;
const password = "Verify-" + Math.random().toString(36).slice(2) + "!9";

try {
  // 1) Tạo user -> trigger
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name: "TIP002 Verify", name: "TIP002 Verify" },
  });
  if (cErr) throw new Error("createUser: " + cErr.message);
  userId = created.user.id;
  await new Promise((r) => setTimeout(r, 800)); // chờ trigger

  // AC-4: profiles + subscriptions auto-create
  const { data: prof } = await admin.from("profiles").select("*").eq("id", userId).maybeSingle();
  ok("AC-4 trigger -> profiles", !!prof, prof ? `nickname=${prof.nickname}, commit=${prof.daily_commit_minutes}` : "không thấy profile");
  const { data: sub } = await admin.from("subscriptions").select("*").eq("user_id", userId).maybeSingle();
  const trialOk = sub && sub.status === "trial" && sub.trial_ends_at &&
    Math.abs(new Date(sub.trial_ends_at).getTime() - (Date.now() + 24 * 3600000)) < 10 * 60000;
  ok("AC-4 trigger -> subscriptions(trial,+24h)", !!trialOk, sub ? `status=${sub.status}, ends=${sub.trial_ends_at}` : "không thấy");

  // 2) Seed study_sessions: hôm nay, hôm qua, hôm kia đều ĐẠT (35' > 30'); hôm kìa-1 bỏ trống
  //    -> streak ngược từ hôm qua: hôm qua(1) + hôm kia(2) rồi đứt; +hôm nay = 3
  const seed = [sessionRow(userId, ymdUTC7(0), 35), sessionRow(userId, ymdUTC7(-1), 35), sessionRow(userId, ymdUTC7(-2), 35)];
  const { error: sErr } = await admin.from("study_sessions").insert(seed);
  if (sErr) throw new Error("seed sessions: " + sErr.message);

  // 3) Đăng nhập bằng user để có JWT (auth.uid())
  const userClient = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: signIn, error: siErr } = await userClient.auth.signInWithPassword({ email, password });
  if (siErr) throw new Error("signIn: " + siErr.message);
  ok("AC-3 login user (JWT)", !!signIn.session, `uid=${signIn.user.id.slice(0, 8)}…`);

  // AC-5: get_dashboard
  const { data: dash, error: dErr } = await userClient.rpc("get_dashboard");
  if (dErr) throw new Error("get_dashboard: " + dErr.message);
  ok("AC-5 get_dashboard streak=3", dash.streak === 3, `streak=${dash.streak}`);
  ok("AC-5 get_dashboard today_met=true", dash.today_met === true, `today_met=${dash.today_met}, today_minutes=${dash.today_minutes}`);
  ok("AC-5 get_dashboard week[7]/month[30]", Array.isArray(dash.week) && dash.week.length === 7 && dash.month.length === 30, `week=${dash.week?.length}, month=${dash.month?.length}`);

  // AC-5: today_minutes
  const { data: tm, error: tErr } = await userClient.rpc("today_minutes", { p_user_id: userId });
  if (tErr) throw new Error("today_minutes: " + tErr.message);
  ok("AC-5 today_minutes=35", tm === 35, `=${tm}`);

  // today_minutes của user khác -> phải bị chặn (forbidden)
  const { error: fErr } = await userClient.rpc("today_minutes", { p_user_id: "00000000-0000-0000-0000-000000000000" });
  ok("AC-3 today_minutes(other) bị chặn", !!fErr, fErr ? "forbidden như mong đợi" : "KHÔNG bị chặn!");

  // AC-5: leaderboard
  const { data: lb, error: lErr } = await userClient.rpc("get_leaderboard_weekly");
  if (lErr) throw new Error("get_leaderboard_weekly: " + lErr.message);
  const inBoard = JSON.stringify(lb.top).includes(userId) || (lb.caller && lb.caller.user_id === userId);
  ok("AC-5 leaderboard có caller", inBoard, `top=${lb.top.length}, week_start=${lb.week_start}`);

  // AC-6: lookup_word (cần dictionary đã import)
  const { data: lw } = await userClient.rpc("lookup_word", { p_word: "running" });
  ok("AC-6 lookup_word('running')->run", !!lw && !!lw.meanings, lw ? `lemma=${lw.lemma}, ipa=${lw.ipa ?? "∅"}` : "null (dictionary chưa import?)");
  const { data: lw2 } = await userClient.rpc("lookup_word", { p_word: "run" });
  ok("AC-6 lookup_word('run')", !!lw2, lw2 ? `lemma=${lw2.lemma}` : "null");

  // AC-3: RLS — user chỉ thấy dữ liệu của mình (sessions = 3 đã seed)
  const { data: myS } = await userClient.from("study_sessions").select("id");
  ok("AC-3 RLS study_sessions chỉ của mình", Array.isArray(myS) && myS.length === 3, `thấy ${myS?.length} dòng`);
  // dictionary đọc được khi authenticated
  const { data: dictRead, error: drErr } = await userClient.from("dictionary").select("lemma").limit(1);
  ok("AC-3 dictionary authenticated SELECT", !drErr && Array.isArray(dictRead), drErr ? drErr.message : "đọc được");
} catch (e) {
  ok("FATAL", false, e.message);
} finally {
  if (userId) {
    await admin.from("study_sessions").delete().eq("user_id", userId);
    await admin.auth.admin.deleteUser(userId);
    console.log(`[cleanup] đã xoá user tạm ${userId.slice(0, 8)}… (cascade).`);
  }
}

const failed = results.filter((r) => !r.pass);
console.log(`\n=== ${results.length - failed.length}/${results.length} PASS ===`);
process.exit(failed.length ? 1 : 0);

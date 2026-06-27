// TIP-005 — Verify /api/lookup + /api/vocabulary end-to-end (AC-7).
// Yêu cầu backend chạy ở NEXT_PUBLIC_BACKEND_URL.
// CHẠY (repo root):  node --env-file=.env web/backend/verify_vocab.mjs
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
const email = `tip005-verify-${Math.floor(Date.now() / 1000)}@studymovie.test`;
const password = "Verify-" + Math.random().toString(36).slice(2) + "!9";

try {
  const { data: created, error: cErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (cErr) throw new Error("createUser: " + cErr.message);
  userId = created.user.id;

  // 401 không token
  const r401 = await fetch(`${backend}/api/lookup?word=run`);
  ok("AC-7 /api/lookup KHÔNG token -> 401", r401.status === 401, `status=${r401.status}`);

  // đăng nhập lấy token
  const uc = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: si, error: siErr } = await uc.auth.signInWithPassword({ email, password });
  if (siErr) throw new Error("signIn: " + siErr.message);
  const auth = { Authorization: `Bearer ${si.session.access_token}`, "Content-Type": "application/json" };

  // lookup 'running' -> có nghĩa
  const lr = await fetch(`${backend}/api/lookup?word=running`, { headers: auth });
  const lb = await lr.json();
  ok("AC-7 /api/lookup('running') -> 200 + result", lr.status === 200 && !!lb.result, `lemma=${lb?.result?.lemma}`);

  // save vocab (example = câu chứa từ)
  const payload = {
    word: "running",
    lemma: lb?.result?.lemma ?? "running",
    ipa: lb?.result?.ipa ?? null,
    meaning_vi: "chạy (ví dụ)",
    example: "He is running in the park.",
    audio_url: null,
  };
  const sv = await fetch(`${backend}/api/vocabulary`, { method: "POST", headers: auth, body: JSON.stringify(payload) });
  const svb = await sv.json();
  ok("AC-5/7 POST /api/vocabulary lần 1 -> saved", sv.status === 200 && svb.saved === true && svb.duplicate === false, `duplicate=${svb.duplicate}`);

  // save lại -> duplicate, không lỗi
  const sv2 = await fetch(`${backend}/api/vocabulary`, { method: "POST", headers: auth, body: JSON.stringify(payload) });
  const sv2b = await sv2.json();
  ok("AC-5 lưu trùng -> không lỗi, duplicate=true", sv2.status === 200 && sv2b.duplicate === true, `status=${sv2.status}, duplicate=${sv2b.duplicate}`);

  // kiểm DB có đúng 1 dòng + example đúng
  const { data: rows } = await admin.from("vocabulary").select("*").eq("user_id", userId).eq("word", "running");
  ok("AC-5 DB có đúng 1 dòng vocab + example", Array.isArray(rows) && rows.length === 1 && rows[0].example === payload.example, `count=${rows?.length}`);
  const runId = rows?.[0]?.id;

  // GET danh sách (chứa running)
  const lst = await (await fetch(`${backend}/api/vocabulary`, { headers: auth })).json();
  ok("AC-8 GET /api/vocabulary chứa từ", Array.isArray(lst.items) && lst.items.some((i) => i.id === runId), `count=${lst.items?.length}`);

  // GET 401 không token
  const l401 = await fetch(`${backend}/api/vocabulary`);
  ok("AC-8 GET /api/vocabulary KHÔNG token -> 401", l401.status === 401, `status=${l401.status}`);

  // DELETE id giả -> deleted=false (không xóa của user khác / không tồn tại)
  const delFake = await (await fetch(`${backend}/api/vocabulary/00000000-0000-0000-0000-000000000000`, { method: "DELETE", headers: auth })).json();
  ok("AC-8 DELETE id lạ -> deleted=false", delFake.deleted === false, `deleted=${delFake.deleted}`);

  // DELETE running -> deleted=true
  const del = await (await fetch(`${backend}/api/vocabulary/${runId}`, { method: "DELETE", headers: auth })).json();
  ok("AC-2 DELETE /api/vocabulary/:id -> deleted=true", del.deleted === true, `deleted=${del.deleted}`);

  // GET lại không còn
  const lst2 = await (await fetch(`${backend}/api/vocabulary`, { headers: auth })).json();
  ok("AC-2 sau xóa, list không còn từ", Array.isArray(lst2.items) && !lst2.items.some((i) => i.id === runId), `count=${lst2.items?.length}`);
} catch (e) {
  ok("FATAL", false, e.message);
} finally {
  if (userId) {
    await admin.from("vocabulary").delete().eq("user_id", userId);
    await admin.auth.admin.deleteUser(userId);
    console.log(`[cleanup] đã xoá user tạm ${userId.slice(0, 8)}…`);
  }
}

const failed = results.filter((p) => !p).length;
console.log(`\n=== ${results.length - failed}/${results.length} PASS ===`);
process.exit(failed ? 1 : 0);

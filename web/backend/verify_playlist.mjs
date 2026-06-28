// TIP-011 — Verify playlist CRUD end-to-end. Backend chạy ở NEXT_PUBLIC_BACKEND_URL.
// CHẠY: node --env-file=.env web/backend/verify_playlist.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;
const backend = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8787";
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const results = [];
const ok = (n, p, d) => { results.push(p); console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); };

const VID = "dQw4w9WgXcQ";
let userId = null;
try {
  const email = `tip011-${Math.floor(Date.now() / 1000)}@studymovie.test`;
  const password = "Verify-" + Math.random().toString(36).slice(2) + "!9";
  const { data: created, error: ce } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (ce) throw new Error("createUser: " + ce.message);
  userId = created.user.id;
  const uc = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: si } = await uc.auth.signInWithPassword({ email, password });
  const auth = { Authorization: `Bearer ${si.session.access_token}`, "Content-Type": "application/json" };
  const J = (r) => r.json();

  // 401
  const r401 = await fetch(`${backend}/api/playlist`);
  ok("AC-7 GET KHÔNG token -> 401", r401.status === 401, `status=${r401.status}`);

  // POST link sai -> 400
  for (const bad of ["not a url", "https://google.com/x"]) {
    const r = await fetch(`${backend}/api/playlist`, { method: "POST", headers: auth, body: JSON.stringify({ url: bad }) });
    ok(`AC-1 link sai (${bad.slice(0, 18)}) -> 400`, r.status === 400, `status=${r.status}`);
  }

  // POST hợp lệ (watch?v=)
  const add = await J(await fetch(`${backend}/api/playlist`, { method: "POST", headers: auth, body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${VID}&t=30s` }) }));
  ok("AC-1 thêm video -> video_id + thumbnail", add.item?.video_id === VID && /img\.youtube\.com/.test(add.item?.thumbnail_url ?? ""), `vid=${add.item?.video_id}`);
  ok("AC-1 tiêu đề tự động (oEmbed) hoặc fallback", !!add.item?.title, `title=${(add.item?.title ?? "").slice(0, 40)}`);
  const id = add.item?.id;

  // youtu.be cũng parse được
  const add2 = await J(await fetch(`${backend}/api/playlist`, { method: "POST", headers: auth, body: JSON.stringify({ url: `https://youtu.be/${VID}` }) }));
  ok("AC-1 youtu.be parse được", add2.item?.video_id === VID, `vid=${add2.item?.video_id}`);

  // GET list
  const list = await J(await fetch(`${backend}/api/playlist`, { headers: auth }));
  ok("AC-2 GET list có video", Array.isArray(list.items) && list.items.some((i) => i.id === id), `count=${list.items?.length}`);

  // PATCH done toggle
  const p1 = await J(await fetch(`${backend}/api/playlist/${id}`, { method: "PATCH", headers: auth, body: JSON.stringify({ is_done: true }) }));
  ok("AC-4 PATCH is_done=true", p1.item?.is_done === true, `is_done=${p1.item?.is_done}`);
  const p2 = await J(await fetch(`${backend}/api/playlist/${id}`, { method: "PATCH", headers: auth, body: JSON.stringify({ is_done: false }) }));
  ok("AC-4 PATCH is_done=false (toggle)", p2.item?.is_done === false, `is_done=${p2.item?.is_done}`);

  // DELETE id lạ -> false
  const delFake = await J(await fetch(`${backend}/api/playlist/00000000-0000-0000-0000-000000000000`, { method: "DELETE", headers: auth }));
  ok("AC-7 DELETE id lạ -> deleted=false", delFake.deleted === false, `deleted=${delFake.deleted}`);
  // DELETE thật
  const del = await J(await fetch(`${backend}/api/playlist/${id}`, { method: "DELETE", headers: auth }));
  ok("AC-5 DELETE -> deleted=true", del.deleted === true, `deleted=${del.deleted}`);
  const list2 = await J(await fetch(`${backend}/api/playlist`, { headers: auth }));
  ok("AC-5 sau xóa list không còn", !list2.items.some((i) => i.id === id), `count=${list2.items?.length}`);
} catch (e) {
  ok("FATAL", false, e.message);
} finally {
  if (userId) {
    await admin.from("playlist_items").delete().eq("user_id", userId);
    await admin.auth.admin.deleteUser(userId);
  }
  console.log("[cleanup] đã xoá playlist_items + user tạm");
}
const failed = results.filter((p) => !p).length;
console.log(`\n=== ${results.length - failed}/${results.length} PASS ===`);
process.exit(failed ? 1 : 0);

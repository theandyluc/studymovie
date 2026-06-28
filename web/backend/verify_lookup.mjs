// TIP-009 — Verify lookup end-to-end: lemmatize (FVDP) + fallback Free Dictionary + cache + 404 + 401.
// Yêu cầu backend chạy ở NEXT_PUBLIC_BACKEND_URL. CHẠY: node --env-file=.env web/backend/verify_lookup.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;
const backend = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8787";
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const results = [];
const ok = (n, p, d) => { results.push(p); console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); };

const FAKE = "zzzxqmadeupword";
let userId = null;
try {
  const email = `tip009-${Math.floor(Date.now() / 1000)}@studymovie.test`;
  const password = "Verify-" + Math.random().toString(36).slice(2) + "!9";
  const { data: created, error: ce } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (ce) throw new Error("createUser: " + ce.message);
  userId = created.user.id;
  const uc = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: si } = await uc.auth.signInWithPassword({ email, password });
  const auth = { Authorization: `Bearer ${si.session.access_token}` };
  const lk = async (w) => (await fetch(`${backend}/api/lookup?word=${encodeURIComponent(w)}`, { headers: auth })).json();

  // 401
  const r401 = await fetch(`${backend}/api/lookup?word=run`);
  ok("AC-8 /api/lookup KHÔNG token -> 401", r401.status === 401, `status=${r401.status}`);

  // AC-1 lemmatize mới
  const bigger = await lk("bigger");
  ok("AC-1 bigger -> nghĩa (FVDP, lemma big)", !!bigger.result && bigger.source === "fvdp", `lemma=${bigger.result?.lemma} src=${bigger.source}`);
  const dogs = await lk("dog's");
  ok("AC-1 dog's -> nghĩa (lemma dog)", !!dogs.result, `lemma=${dogs.result?.lemma}`);

  // đảm bảo neuron sạch trước test (xóa cache free_dict cũ nếu có)
  await admin.from("dictionary").delete().eq("lemma", "neuron").eq("source", "free_dict");

  // AC-2 fallback Free Dictionary
  const neuron1 = await lk("neuron");
  ok("AC-2 neuron -> fallback free_dict + định nghĩa", !!neuron1.result && neuron1.source === "free_dict" && (neuron1.result.meanings?.length ?? 0) > 0, `src=${neuron1.source} senses=${neuron1.result?.meanings?.length}`);
  ok("AC-4 neuron có audio/IPA (nếu API cung cấp)", neuron1.result?.ipa != null || neuron1.result?.audio_url != null, `ipa=${neuron1.result?.ipa ?? "∅"} audio=${neuron1.result?.audio_url ? "có" : "∅"}`);

  // AC-3 cache: row đã ghi source free_dict
  const { data: cached } = await admin.from("dictionary").select("lemma, source").eq("lemma", "neuron").maybeSingle();
  ok("AC-3 cache: dictionary có neuron source=free_dict", cached?.source === "free_dict", `source=${cached?.source}`);
  // lần 2: vẫn trả (đi qua RPC/cache, không cần API)
  const neuron2 = await lk("neuron");
  ok("AC-3 neuron lần 2 vẫn trả (từ cache)", !!neuron2.result && neuron2.source === "free_dict", `src=${neuron2.source}`);

  // AC-5 404
  const fake = await lk(FAKE);
  ok("AC-5 từ bịa -> not_found, không crash", fake.result === null && fake.status === "not_found", `status=${fake.status}`);
} catch (e) {
  ok("FATAL", false, e.message);
} finally {
  // dọn cache test (giữ bảng sạch + test lặp lại được). neuron free_dict là test-artifact ở đây.
  await admin.from("dictionary").delete().eq("lemma", "neuron").eq("source", "free_dict");
  await admin.from("dictionary").delete().eq("lemma", FAKE);
  if (userId) await admin.auth.admin.deleteUser(userId);
  console.log("[cleanup] đã xoá cache test + user tạm");
}
const failed = results.filter((p) => !p).length;
console.log(`\n=== ${results.length - failed}/${results.length} PASS ===`);
process.exit(failed ? 1 : 0);

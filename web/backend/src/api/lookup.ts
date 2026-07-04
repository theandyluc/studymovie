// TIP-005/009 — GET /api/lookup?word= (protected).
// 1) RPC lookup_word (FVDP, nghĩa VI). Miss →
// 2) Fallback Free Dictionary API (server-side): định nghĩa EN + IPA + audio + ví dụ.
//    (Đây là TỪ ĐIỂN tra cứu, KHÔNG dịch máy — vẫn đúng D-2.)
// 3) Cache kết quả API vào bảng dictionary (source='free_dict') → lần sau khỏi gọi lại.
import type { Context } from "hono";
import { getServiceClient } from "../lib/supabase.js";

interface Sense {
  pos: string | null;
  sense: string;
  examples: { en: string; vi: string | null }[];
}
interface LookupResult {
  lemma: string;
  ipa: string | null;
  meanings: Sense[];
  audio_url: string | null;
  source: string;
}

// ---- Free Dictionary API (api.dictionaryapi.dev) ----
interface FdPhonetic { text?: string; audio?: string }
interface FdDef { definition?: string; example?: string }
interface FdMeaning { partOfSpeech?: string; definitions?: FdDef[] }
interface FdEntry { phonetic?: string; phonetics?: FdPhonetic[]; meanings?: FdMeaning[] }

type FdResult =
  | { ok: true; ipa: string | null; audio_url: string | null; meanings: Sense[] }
  | { ok: false; status: "not_found" | "error"; message?: string };

// TIP-039 — chỉ 1 phiên âm sạch (bỏ "/" thừa, lấy cái đầu nếu chuỗi có nhiều biến thể ",/;").
function firstIpa(ipa: string | null): string | null {
  if (!ipa) return null;
  const first = ipa.replace(/\//g, "").split(/[,;]/)[0].trim();
  return first || null;
}

async function freeDictLookup(word: string): Promise<FdResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000); // TIP-069: fail-fast, tránh kéo dài chuỗi ứng viên
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      { signal: ctrl.signal }
    );
    if (res.status === 404) return { ok: false, status: "not_found" };
    if (res.status === 429) return { ok: false, status: "error", message: "rate_limited" };
    if (!res.ok) return { ok: false, status: "error", message: `http_${res.status}` };

    const arr = (await res.json()) as FdEntry[];
    if (!Array.isArray(arr) || arr.length === 0) return { ok: false, status: "not_found" };

    const phonetics: FdPhonetic[] = [];
    let plainPhonetic: string | null = null;
    const meanings: Sense[] = [];
    for (const entry of arr) {
      if (!plainPhonetic && entry.phonetic) plainPhonetic = entry.phonetic;
      for (const p of entry.phonetics ?? []) phonetics.push(p);
      for (const m of entry.meanings ?? []) {
        for (const d of m.definitions ?? []) {
          if (!d.definition) continue;
          if (meanings.length >= 6) break;
          meanings.push({
            pos: m.partOfSpeech ?? null,
            sense: d.definition,
            examples: d.example ? [{ en: d.example, vi: null }] : [],
          });
        }
      }
    }
    if (meanings.length === 0) return { ok: false, status: "not_found" };

    // TIP-039 — ưu tiên bản UK (audio url chứa -uk/_uk); IPA + audio lấy từ mục UK nếu có.
    const isUk = (p: FdPhonetic) => !!p.audio && /[-_/]uk/i.test(p.audio);
    const uk = phonetics.find(isUk);
    const ipaRaw = uk?.text ?? phonetics.find((p) => p.text)?.text ?? plainPhonetic ?? null;
    const audio = uk?.audio ?? phonetics.find((p) => p.audio && p.audio.length > 0)?.audio ?? null;
    return { ok: true, ipa: firstIpa(ipaRaw), audio_url: audio, meanings };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return { ok: false, status: "error", message: aborted ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
  }
}

// TIP-068 — TTS fallback: mọi từ có loa (đọc qua <audio>, không vướng CORS).
const ttsUrl = (w: string): string =>
  `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=${encodeURIComponent(w)}`;

// TIP-068 — sinh ứng viên dạng gốc (heuristic EN): raw TRƯỚC, rồi các dạng gốc để lấy IPA.
function lemmaCandidates(w: string): string[] {
  const c = new Set<string>([w]);
  if (w.length > 4 && w.endsWith("ies")) c.add(w.slice(0, -3) + "y"); // studies→study
  if (w.length > 3 && w.endsWith("es")) c.add(w.slice(0, -2)); // boxes→box
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) c.add(w.slice(0, -1)); // moments→moment
  if (w.length > 4 && w.endsWith("ied")) c.add(w.slice(0, -3) + "y"); // carried→carry (trước -ed để vào top 3)
  if (w.length > 4 && w.endsWith("ed")) {
    c.add(w.slice(0, -2)); // walked→walk
    c.add(w.slice(0, -1)); // faked→fake
  }
  if (w.length > 5 && w.endsWith("ing")) {
    const base = w.slice(0, -3);
    c.add(base); // making→mak…
    c.add(base + "e"); // making→make
    if (base.length > 1 && base[base.length - 1] === base[base.length - 2]) c.add(base.slice(0, -1)); // running→run
  }
  return [...c];
}

// Gắn audio TTS nếu thiếu audio từ điển; giữ shape { word, result, source }.
function withAudio(word: string, found: { result: LookupResult; source: string }) {
  const r = found.result;
  return {
    word,
    result: { ...r, audio_url: r.audio_url || ttsUrl(r.lemma || word) },
    source: found.source,
  };
}

export async function getLookup(c: Context) {
  const word = (c.req.query("word") ?? "").trim().toLowerCase();
  if (!word) return c.json({ error: "missing word" }, 400);

  const sb = getServiceClient();

  // TIP-068 — thử lần lượt raw + dạng gốc (~3 ứng viên đầu để tránh gọi free-dict quá nhiều).
  // Chọn kết quả ĐẦU TIÊN CÓ IPA; nếu không có → kết quả đầu tiên tìm được (có meaning); hết → not_found.
  const cands = lemmaCandidates(word).slice(0, 3);
  let firstFound: { result: LookupResult; source: string } | null = null;
  let lastFail: { status: "not_found" | "error"; message?: string } | null = null;

  for (const cand of cands) {
    // 1) FVDP qua RPC (bảng dictionary đã gồm cache free_dict → RPC tìm thấy luôn).
    const { data, error } = await sb.rpc("lookup_word", { p_word: cand });
    if (error) return c.json({ error: error.message }, 500);

    let found: { result: LookupResult; source: string } | null = null;
    if (data && (data as { meanings?: unknown }).meanings) {
      const r = data as LookupResult;
      found = { result: r, source: r.source ?? "fvdp" };
    } else {
      // 2) Fallback Free Dictionary API cho ứng viên này.
      const fb = await freeDictLookup(cand);
      if (fb.ok) {
        // 3) Cache vào dictionary (idempotent theo lemma).
        const row = { lemma: cand, ipa: fb.ipa, meanings: fb.meanings, audio_url: fb.audio_url, source: "free_dict" };
        const { error: cacheErr } = await sb.from("dictionary").upsert(row, { onConflict: "lemma" });
        if (cacheErr) console.warn("[lookup] cache lỗi:", cacheErr.message);
        found = {
          result: { lemma: cand, ipa: fb.ipa, meanings: fb.meanings, audio_url: fb.audio_url, source: "free_dict" },
          source: "free_dict",
        };
      } else {
        lastFail = { status: fb.status, message: fb.message };
      }
    }

    if (found) {
      if (!firstFound) firstFound = found;
      if (firstIpa(found.result.ipa)) return c.json(withAudio(word, found)); // có IPA → chọn ngay
    }
  }

  if (firstFound) return c.json(withAudio(word, firstFound)); // có meaning nhưng không IPA
  return c.json({ word, result: null, status: lastFail?.status ?? "not_found", message: lastFail?.message ?? null });
}

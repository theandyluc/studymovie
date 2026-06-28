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

async function freeDictLookup(word: string): Promise<FdResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
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

    let ipa: string | null = null;
    let audio: string | null = null;
    const meanings: Sense[] = [];
    for (const entry of arr) {
      if (!ipa) ipa = entry.phonetic ?? entry.phonetics?.find((p) => p.text)?.text ?? null;
      if (!audio) audio = entry.phonetics?.find((p) => p.audio && p.audio.length > 0)?.audio ?? null;
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
    return { ok: true, ipa, audio_url: audio, meanings };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return { ok: false, status: "error", message: aborted ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
  }
}

export async function getLookup(c: Context) {
  const word = (c.req.query("word") ?? "").trim().toLowerCase();
  if (!word) return c.json({ error: "missing word" }, 400);

  const sb = getServiceClient();

  // 1) FVDP qua RPC (đã có cache free_dict cũng nằm trong bảng dictionary → RPC tìm thấy luôn).
  const { data, error } = await sb.rpc("lookup_word", { p_word: word });
  if (error) return c.json({ error: error.message }, 500);
  if (data && (data as { meanings?: unknown }).meanings) {
    const r = data as LookupResult;
    return c.json({ word, result: r, source: r.source ?? "fvdp" });
  }

  // 2) Fallback Free Dictionary API.
  const fb = await freeDictLookup(word);
  if (!fb.ok) {
    return c.json({ word, result: null, status: fb.status, message: fb.message ?? null });
  }

  // 3) Cache vào dictionary (idempotent theo lemma).
  const row = { lemma: word, ipa: fb.ipa, meanings: fb.meanings, audio_url: fb.audio_url, source: "free_dict" };
  const { error: cacheErr } = await sb.from("dictionary").upsert(row, { onConflict: "lemma" });
  if (cacheErr) {
    // Cache lỗi không nên chặn trả kết quả cho user.
    console.warn("[lookup] cache lỗi:", cacheErr.message);
  }

  const result: LookupResult = {
    lemma: word,
    ipa: fb.ipa,
    meanings: fb.meanings,
    audio_url: fb.audio_url,
    source: "free_dict",
  };
  return c.json({ word, result, source: "free_dict" });
}

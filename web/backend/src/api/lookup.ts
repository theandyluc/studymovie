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
export function firstIpa(ipa: string | null): string | null {
  if (!ipa) return null;
  const first = ipa.replace(/\//g, "").split(/[,;]/)[0].trim();
  return first || null;
}

export async function freeDictLookup(word: string): Promise<FdResult> {
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

    const meanings: Sense[] = [];
    for (const entry of arr) {
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

    // Từ đồng âm khác nghĩa/từ loại (vd "lead", "content", "read") có NHIỀU entry với phiên âm
    // khác nhau. Gộp phonetics từ mọi entry lại rồi lấy "cái đầu tiên" (cách cũ) có thể lấy
    // nhầm phiên âm của một entry/nghĩa khác. dictionaryapi.dev xếp entry theo độ phổ biến →
    // chỉ lấy phonetics của ENTRY ĐẦU TIÊN có dữ liệu, không trộn với các entry sau.
    // LƯU Ý (bug đã sửa): entry đầu có thể có `phonetics` KHÔNG RỖNG nhưng TOÀN audio, không có
    // `text` nào cả (vd "does" — entry[0] chỉ có audio, entry[1] mới có text "/dəʊz/") — nếu chỉ
    // check "length > 0" sẽ chọn nhầm entry[0] làm chính rồi bỏ lỡ IPA text ở entry sau. Phải đòi
    // hỏi entry có ÍT NHẤT 1 phonetic CÓ TEXT (hoặc field `phonetic` phẳng) mới coi là "chính".
    const primaryEntry =
      arr.find((e) => e.phonetics?.some((p) => p.text) || e.phonetic) ?? arr[0];
    const phonetics = primaryEntry.phonetics ?? [];
    const plainPhonetic = primaryEntry.phonetic ?? null;

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

// TIP-101h — từ phủ định rút gọn ("doesn't", "couldn't"...) HẦU HẾT không có mục riêng ở cả FVDP
// lẫn Free Dictionary API (đã kiểm tra thật: chỉ "don't"/"isn't" có sẵn, còn lại 404) → không có
// IPA/nghĩa từ điển, dù /api/lookup-context (AI) vẫn dịch đúng "không" (không phụ thuộc từ điển).
// Cho các từ này thử thêm ứng viên = ĐỘNG TỪ GỐC (does, could...) để ít nhất có phiên âm hiển
// thị — chấp nhận không phản ánh đúng 100% cách phát âm "-n't" thêm vào, còn hơn trống trơn.
// Bảng tường minh (không dùng regex cắt đuôi) vì bất quy tắc: "can't"→"can" (chỉ thêm "'t", KHÔNG
// phải "n't" dù "can" đã có sẵn chữ n), "won't"→"will" (bất quy tắc hoàn toàn, không liên quan
// mặt chữ).
const NEGATION_CONTRACTION_BASE: Record<string, string> = {
  "don't": "do",
  "doesn't": "does",
  "didn't": "did",
  "isn't": "is",
  "aren't": "are",
  "wasn't": "was",
  "weren't": "were",
  "can't": "can",
  "couldn't": "could",
  "won't": "will",
  "wouldn't": "would",
  "shan't": "shall",
  "shouldn't": "should",
  "mustn't": "must",
  "needn't": "need",
  "haven't": "have",
  "hasn't": "has",
  "hadn't": "had",
};

// TIP-068 — sinh ứng viên dạng gốc (heuristic EN): raw TRƯỚC, rồi các dạng gốc để lấy IPA.
// Mỗi nhóm đuôi dùng else-if (loại nhánh chồng chéo, vd "studies" vừa khớp "ies" vừa khớp
// "es"/"s" → tránh sinh ứng viên rác như "studi"/"studie"). Trong nhóm "-ing", ưu tiên dạng
// phụ âm đôi rút gọn (getting→get, running→run) lên TRƯỚC base/base+e vì đây là quy tắc rõ
// ràng, phổ biến nhất — trước đây nó bị đẩy xuống cuối danh sách và bị cắt mất bởi giới hạn
// số ứng viên thử, khiến chọn nhầm sang candidate sai ("gett") và tra phải phiên âm khác.
export function lemmaCandidates(w: string): string[] {
  const c: string[] = [w];
  const add = (x: string): void => {
    if (x && !c.includes(x)) c.push(x);
  };

  if (NEGATION_CONTRACTION_BASE[w]) add(NEGATION_CONTRACTION_BASE[w]);

  if (w.length > 4 && w.endsWith("ies")) {
    add(w.slice(0, -3) + "y"); // studies→study
  } else if (w.length > 3 && w.endsWith("es")) {
    add(w.slice(0, -2)); // boxes→box
  } else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) {
    add(w.slice(0, -1)); // moments→moment
  }

  if (w.length > 4 && w.endsWith("ied")) {
    add(w.slice(0, -3) + "y"); // carried→carry
  } else if (w.length > 4 && w.endsWith("ed")) {
    add(w.slice(0, -1)); // faked→fake
    add(w.slice(0, -2)); // walked→walk
  }

  if (w.length > 5 && w.endsWith("ing")) {
    const base = w.slice(0, -3);
    if (base.length > 1 && base[base.length - 1] === base[base.length - 2]) {
      add(base.slice(0, -1)); // getting→get, running→run — ưu tiên cao nhất
    }
    add(base + "e"); // making→make
    add(base); // fill→fill
  }

  return c;
}

// TIP-XXX — FVDP là data cộng đồng import 1 lần (GPL, 103k mục, xem Blueprint), một số dòng
// bị lỗi khi import khiến IPA bị cắt cụt bất thường (vd "communication" → chỉ còn "co").
// Heuristic: IPA (sau khi làm sạch) ngắn bất thường so với độ dài từ → nghi bị cắt cụt.
// Bỏ qua từ ngắn (<5 ký tự) vì IPA ngắn với từ ngắn là bình thường, dễ báo nhầm.
export function isLikelyTruncatedIpa(ipa: string | null, word: string): boolean {
  if (!ipa || word.length < 5) return false;
  const clean = firstIpa(ipa) ?? "";
  return clean.length < Math.max(3, word.length * 0.35);
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

  // TIP-068 — thử lần lượt raw + dạng gốc (tối đa 4 ứng viên: đủ cho mọi nhóm đuôi kể cả
  // "-ing" phụ âm đôi, xem lemmaCandidates — để tránh gọi free-dict quá nhiều).
  // Chọn kết quả ĐẦU TIÊN CÓ IPA; nếu không có → kết quả đầu tiên tìm được (có meaning); hết → not_found.
  const cands = lemmaCandidates(word).slice(0, 4);
  let firstFound: { result: LookupResult; source: string } | null = null;
  let lastFail: { status: "not_found" | "error"; message?: string } | null = null;

  for (const cand of cands) {
    // 1) FVDP qua RPC (bảng dictionary đã gồm cache free_dict → RPC tìm thấy luôn).
    const { data, error } = await sb.rpc("lookup_word", { p_word: cand });
    if (error) return c.json({ error: error.message }, 500);

    let found: { result: LookupResult; source: string } | null = null;
    if (data && (data as { meanings?: unknown }).meanings) {
      const r = data as LookupResult;
      if (!r.ipa || isLikelyTruncatedIpa(r.ipa, cand)) {
        // IPA FVDP THIẾU HẲN (null/rỗng — nhiều mục FVDP không có IPA, vd "does") hoặc NGHI bị
        // cắt cụt → thử vá bằng Free Dictionary (giữ nguyên nghĩa VI của FVDP, chỉ thay ipa/audio
        // nếu bản vá trông hợp lệ hơn) rồi ghi đè lại cache cho lần sau.
        const fb = await freeDictLookup(cand);
        if (fb.ok && fb.ipa && !isLikelyTruncatedIpa(fb.ipa, cand)) {
          const fixed: LookupResult = { ...r, ipa: fb.ipa, audio_url: r.audio_url || fb.audio_url };
          const { error: fixErr } = await sb.from("dictionary").update({ ipa: fixed.ipa, audio_url: fixed.audio_url }).eq("lemma", r.lemma);
          if (fixErr) console.warn("[lookup] vá ipa lỗi:", fixErr.message);
          found = { result: fixed, source: r.source ?? "fvdp" };
        } else {
          found = { result: r, source: r.source ?? "fvdp" }; // không vá được → vẫn trả bản cũ (dù nghi)
        }
      } else {
        found = { result: r, source: r.source ?? "fvdp" };
      }
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

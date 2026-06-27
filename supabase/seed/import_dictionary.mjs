// TIP-002 / BE-06 — Import từ điển EN-VI vào bảng `dictionary`.
//
// NGUỒN: Free Vietnamese Dictionary Project (FVDP), © Hồ Ngọc Đức — từ điển EN-VI
//   tự do, được phép phân phối lại (cần ghi credit nguồn trong app, theo Blueprint mục 0).
//   Bản dữ liệu lấy qua mirror GitHub manhminno/English-Vietnamese-Dictionary
//   (data/english-vietnamese.txt, ~108k mục, có IPA + nghĩa + ví dụ).
//   Nguồn gốc minhqnd/dictionary (SQLite) hiện KHÔNG truy cập được (repo rỗng) → dùng FVDP.
//
// CHẠY:  node --env-file=.env supabase/seed/import_dictionary.mjs
//   Đọc SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY từ .env (server-side, KHÔNG hardcode).
//   Idempotent: upsert theo PK `lemma`. Chạy lại được.
//
// Format FVDP:
//   @headword /ipa/            -> mục từ mới
//   *  từ loại                 -> part of speech
//   -  nghĩa                   -> 1 nét nghĩa
//   =ví dụ+bản dịch            -> ví dụ cho nét nghĩa gần nhất

import { createClient } from "@supabase/supabase-js";

const SOURCE_URL =
  "https://raw.githubusercontent.com/manhminno/English-Vietnamese-Dictionary/master/data/english-vietnamese.txt";
const BATCH = 500;
// Giới hạn số mục import (0 = full). Có thể đặt qua env DICT_LIMIT để import nhanh khi dev.
const LIMIT = Number(process.env.DICT_LIMIT ?? 0);

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Thiếu SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Chạy với: node --env-file=.env ...");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

function parse(text) {
  // Bỏ BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const lines = text.split(/\r?\n/);
  const byLemma = new Map();
  let cur = null;
  let curPos = null;
  let curSense = null;

  const flushSense = () => {
    if (cur && curSense) cur.meanings.push(curSense);
    curSense = null;
  };
  const flushEntry = () => {
    flushSense();
    if (cur && cur.lemma) {
      const prev = byLemma.get(cur.lemma);
      if (prev) {
        prev.meanings.push(...cur.meanings);
        if (!prev.ipa && cur.ipa) prev.ipa = cur.ipa;
      } else {
        byLemma.set(cur.lemma, cur);
      }
    }
    cur = null;
    curPos = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith("@")) {
      flushEntry();
      const body = line.slice(1);
      const m = body.match(/^([^/]+?)\s*\/(.+?)\//); // headword + IPA đầu tiên
      const word = (m ? m[1] : body).trim();
      const ipa = m ? m[2].trim() : null;
      cur = { lemma: word.toLowerCase(), word, ipa, meanings: [] };
    } else if (cur && line.startsWith("*")) {
      flushSense();
      curPos = line.slice(1).replace(/\s+/g, " ").trim();
    } else if (cur && line.startsWith("-")) {
      flushSense();
      curSense = { pos: curPos, sense: line.slice(1).trim(), examples: [] };
    } else if (cur && line.startsWith("=")) {
      const ex = line.slice(1);
      const plus = ex.indexOf("+");
      const en = (plus >= 0 ? ex.slice(0, plus) : ex).replace(/_/g, " ").trim();
      const vi = plus >= 0 ? ex.slice(plus + 1).trim() : null;
      if (!curSense) curSense = { pos: curPos, sense: null, examples: [] };
      curSense.examples.push({ en, vi });
    }
  }
  flushEntry();
  return [...byLemma.values()];
}

async function main() {
  console.log("[import] tải nguồn FVDP …");
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`tải nguồn thất bại: HTTP ${res.status}`);
  const text = await res.text();
  console.log(`[import] tải xong ${(text.length / 1e6).toFixed(1)} MB, parse …`);

  let entries = parse(text);
  console.log(`[import] parse được ${entries.length} mục từ`);
  if (LIMIT > 0) {
    entries = entries.slice(0, LIMIT);
    console.log(`[import] DICT_LIMIT=${LIMIT} -> chỉ import ${entries.length} mục`);
  }

  let done = 0;
  for (let i = 0; i < entries.length; i += BATCH) {
    const chunk = entries.slice(i, i + BATCH).map((e) => ({
      lemma: e.lemma,
      ipa: e.ipa,
      meanings: e.meanings,
      audio_url: null,
    }));
    const { error } = await sb.from("dictionary").upsert(chunk, { onConflict: "lemma" });
    if (error) throw new Error(`upsert batch @${i}: ${error.message}`);
    done += chunk.length;
    if (i % (BATCH * 20) === 0 || done === entries.length) {
      console.log(`[import] ${done}/${entries.length}`);
    }
  }

  const { count } = await sb.from("dictionary").select("*", { count: "exact", head: true });
  console.log(`[import] HOÀN TẤT — bảng dictionary hiện có ${count} dòng.`);
}

main().catch((e) => {
  console.error("[import] LỖI:", e.message);
  process.exit(1);
});

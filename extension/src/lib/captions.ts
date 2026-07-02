// TIP-005 — Helper parse phụ đề (json3) + ghép EN/VI.
// LƯU Ý: KHÔNG fetch baseUrl từ ytInitialPlayerResponse (thiếu chữ ký -> rỗng).
// URL caption ĐÃ KÝ do interceptor (MAIN world) bắt từ chính request của player.
export interface Cue {
  start: number;
  dur: number;
  en: string;
  vi: string;
}

export interface RawCue {
  start: number;
  dur: number;
  text: string;
}

interface Json3Seg {
  utf8?: string;
}
interface Json3Event {
  tStartMs?: number;
  dDurationMs?: number;
  segs?: Json3Seg[];
}
interface Json3 {
  events?: Json3Event[];
}

export function parseJson3(text: string): RawCue[] {
  let data: Json3;
  try {
    data = JSON.parse(text) as Json3;
  } catch {
    return [];
  }
  const out: RawCue[] = [];
  for (const ev of data.events ?? []) {
    if (!ev.segs) continue;
    const t = ev.segs
      .map((s) => s.utf8 ?? "")
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (!t) continue;
    out.push({ start: (ev.tStartMs ?? 0) / 1000, dur: (ev.dDurationMs ?? 0) / 1000, text: t });
  }
  return out;
}

// Đặt/ghi đè 1 query param (giữ nguyên các param đã ký khác).
export function withParam(url: string, key: string, value: string): string {
  const re = new RegExp(`([?&]${key}=)[^&]*`);
  if (re.test(url)) return url.replace(re, `$1${value}`);
  return url + (url.includes("?") ? "&" : "?") + `${key}=${value}`;
}

// TIP-048 — Ghép VI theo ĐỘ CHỒNG THỜI GIAN (không theo index): track VI (auto-dịch YouTube)
// phân đoạn khác EN → ghép index trượt dần → tua tới đoạn sau thì VI lệch. Chọn VI cue chồng
// nhiều nhất với khoảng thời gian của EN cue; không chồng → VI cue chứa mốc giữa EN cue.
function viByOverlap(vi: RawCue[], start: number, dur: number): string {
  const enEnd = start + dur;
  let best = "";
  let bestOv = 0;
  for (const v of vi) {
    const ov = Math.min(enEnd, v.start + v.dur) - Math.max(start, v.start);
    if (ov > bestOv) {
      bestOv = ov;
      best = v.text;
    }
  }
  if (bestOv <= 0) {
    const mid = start + dur / 2;
    const hit = vi.find((x) => mid >= x.start && mid < x.start + x.dur);
    return hit?.text ?? "";
  }
  return best;
}

export function mergeCues(en: RawCue[], vi: RawCue[]): Cue[] {
  return en.map((c) => ({ start: c.start, dur: c.dur, en: c.text, vi: viByOverlap(vi, c.start, c.dur) }));
}

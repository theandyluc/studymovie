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

function viByTime(vi: RawCue[], t: number): string {
  const hit = vi.find((x) => t >= x.start - 0.05 && t < x.start + x.dur + 0.05);
  return hit?.text ?? "";
}

export function mergeCues(en: RawCue[], vi: RawCue[]): Cue[] {
  return en.map((c, i) => ({
    start: c.start,
    dur: c.dur,
    en: c.text,
    vi: vi[i]?.text ?? viByTime(vi, c.start),
  }));
}

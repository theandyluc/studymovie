// TIP-005 — Lấy phụ đề YouTube (EXT-01).
// D-1: EN = caption track gốc; VI = cùng track + `tlang=vi` (YouTube auto-translate).
// Lấy captionTracks từ ytInitialPlayerResponse (fetch lại trang watch, cùng origin
// youtube.com nên baseUrl có chữ ký hợp lệ). Định dạng json3 để parse gọn.

export interface Cue {
  start: number;
  dur: number;
  en: string;
  vi: string;
}

interface CaptionTrack {
  baseUrl?: string;
  languageCode?: string;
  kind?: string;
}
interface PlayerResponse {
  captions?: {
    playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] };
  };
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

// Trích JSON object cân bằng ngoặc ngay sau marker (an toàn với object lồng nhau).
function extractJson(html: string, marker: string): unknown | null {
  const i = html.indexOf(marker);
  if (i < 0) return null;
  const start = html.indexOf("{", i);
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let k = start; k < html.length; k++) {
    const ch = html[k];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') {
      inStr = true;
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, k + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

async function fetchPlayerResponse(videoId: string): Promise<PlayerResponse | null> {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`, {
      credentials: "include",
    });
    if (!res.ok) return null;
    const html = await res.text();
    return extractJson(html, "ytInitialPlayerResponse") as PlayerResponse | null;
  } catch {
    return null;
  }
}

function pickEnglishTrack(tracks: CaptionTrack[]): CaptionTrack | null {
  if (!tracks.length) return null;
  return (
    tracks.find((t) => t.languageCode === "en" && t.kind !== "asr") ??
    tracks.find((t) => (t.languageCode ?? "").startsWith("en")) ??
    tracks[0]
  );
}

async function fetchEvents(baseUrl: string, tlang?: string): Promise<{ start: number; dur: number; text: string }[]> {
  let u = baseUrl;
  u = /fmt=/.test(u) ? u.replace(/fmt=[^&]*/, "fmt=json3") : `${u}&fmt=json3`;
  if (tlang) u += `&tlang=${tlang}`;
  const res = await fetch(u, { credentials: "include" });
  if (!res.ok) return [];
  const data = (await res.json()) as Json3;
  const out: { start: number; dur: number; text: string }[] = [];
  for (const ev of data.events ?? []) {
    if (!ev.segs) continue;
    const text = ev.segs
      .map((s) => s.utf8 ?? "")
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;
    out.push({ start: (ev.tStartMs ?? 0) / 1000, dur: (ev.dDurationMs ?? 0) / 1000, text });
  }
  return out;
}

function viByTime(vi: { start: number; dur: number; text: string }[], t: number): string {
  const hit = vi.find((x) => t >= x.start - 0.05 && t < x.start + x.dur + 0.05);
  return hit?.text ?? "";
}

// Trả mảng cue {start,dur,en,vi}. Rỗng nếu video không có caption (fallback).
export async function loadCues(videoId: string): Promise<Cue[]> {
  const pr = await fetchPlayerResponse(videoId);
  const tracks = pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  const track = pickEnglishTrack(tracks);
  if (!track?.baseUrl) return [];

  const en = await fetchEvents(track.baseUrl);
  if (!en.length) return [];

  let vi: { start: number; dur: number; text: string }[] = [];
  try {
    vi = await fetchEvents(track.baseUrl, "vi"); // auto-translate
  } catch {
    vi = [];
  }

  return en.map((c, i) => ({
    start: c.start,
    dur: c.dur,
    en: c.text,
    vi: vi[i]?.text ?? viByTime(vi, c.start),
  }));
}

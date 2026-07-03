// TIP-005/009 — MAIN-world interceptor (Phương án B + chống anti-bot).
// world:"MAIN", run_at:"document_start". Hook fetch/XHR của PAGE để:
//   - BẮT body EN mà PLAYER đã tải (json3) → KHÔNG re-fetch EN (giảm burst 3→2 request).
//   - VI: chờ ~500ms (tránh burst) rồi fetch tlang=vi; gặp trang "Sorry" (anti-bot) → retry 1 lần.
//   - Phân biệt 3 trạng thái VI: ok / blocked (Sorry) / empty (json3 rỗng hợp lệ).
// → postMessage { cues, videoId, viState } sang content script (ISOLATED).
import { parseJson3, mergeCues, withParam, type RawCue } from "../lib/captions";
export {};

declare global {
  interface Window {
    __smTTInstalled?: boolean;
  }
  interface XMLHttpRequest {
    __smTTUrl?: string;
  }
}

const SM_DEBUG = false; // bật để xem log chẩn đoán caption
const dbg = (...a: unknown[]): void => {
  if (SM_DEBUG) console.log("[StudyMovie/intercept]", ...a);
};

const TT = "/api/timedtext";
const isTT = (u: unknown): u is string => typeof u === "string" && u.includes(TT);
const hasTlang = (u: string): boolean => /[?&]tlang=/.test(u);
const currentVideoId = (): string => new URLSearchParams(location.search).get("v") ?? "";
const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// Trang chặn anti-bot của Google (HTML "Sorry... automated queries").
function isBlockedHtml(body: string): boolean {
  const s = body.trimStart();
  return s.startsWith("<") || /automated queries|unusual traffic|\/sorry\/?/i.test(body);
}

type ViState = "ok" | "blocked" | "empty";
let lastBase = "";

// TIP-063 — chống anti-bot mềm hơn: backoff GIÃN DẦN (không hammer) + retry NỀN + cache theo video.
const VI_BACKOFF = [700, 2000, 5000]; // 3 lần thử tiền cảnh, giãn dần
const BG_RETRY_DELAY = 22_000; // ~22s trước mỗi vòng retry nền
const BG_RETRY_MAX = 2; // tối đa 2 vòng retry nền / video (tránh gọi vô hạn)

// Cache VI theo videoId (in-memory theo phiên tab) → xem lại/tua/quay lại KHÔNG gọi lại Google.
const viCache = new Map<string, RawCue[]>();

// Trạng thái retry nền (chỉ 1 video active tại 1 thời điểm).
let bgTimer: ReturnType<typeof setTimeout> | undefined;
let bgVid = "";
let bgRounds = 0;

function cancelBgRetry(): void {
  if (bgTimer !== undefined) {
    clearTimeout(bgTimer);
    bgTimer = undefined;
  }
}

// Fetch VI với backoff giãn dần; blocked → chờ delay kế thử lại; ok/empty → dừng.
async function fetchVi(viUrl: string, delays: number[]): Promise<{ vi: RawCue[]; viState: ViState }> {
  let vi: RawCue[] = [];
  let viState: ViState = "empty";
  for (let i = 0; i < delays.length; i++) {
    await delay(delays[i]);
    let viRaw = "";
    try {
      viRaw = await (await fetch(viUrl)).text();
    } catch {
      viRaw = "";
    }
    if (isBlockedHtml(viRaw)) {
      viState = "blocked"; // vẫn bị chặn → vòng sau (nếu còn)
      continue;
    }
    vi = parseJson3(viRaw);
    viState = vi.length > 0 ? "ok" : "empty";
    break;
  }
  return { vi, viState };
}

function scheduleBgRetry(vid: string, en: RawCue[], viUrl: string): void {
  if (bgRounds >= BG_RETRY_MAX) {
    dbg("bg retry: đã đạt cap", BG_RETRY_MAX);
    return;
  }
  cancelBgRetry();
  bgTimer = setTimeout(() => void runBgRetry(vid, en, viUrl), BG_RETRY_DELAY);
  dbg(`bg retry: hẹn ${BG_RETRY_DELAY}ms (vòng ${bgRounds + 1}/${BG_RETRY_MAX})`);
}

async function runBgRetry(vid: string, en: RawCue[], viUrl: string): Promise<void> {
  bgTimer = undefined;
  if (currentVideoId() !== vid) return; // đã đổi video → hủy
  if (viCache.has(vid)) return; // đã có VN (nguồn khác) → thôi
  bgRounds++;
  const { vi, viState } = await fetchVi(viUrl, [0, 3000]); // thử ngay + 1 backoff
  if (currentVideoId() !== vid) return; // đổi video khi đang fetch → bỏ
  if (viState === "ok" && vi.length > 0) {
    viCache.set(vid, vi);
    dbg(`bg retry OK: video=${vid} VI=${vi.length} → merge lại`);
    window.postMessage({ __sm: "SM_CUES", cues: mergeCues(en, vi), videoId: vid, viState: "ok" }, "*");
    return;
  }
  if (viState === "blocked") scheduleBgRetry(vid, en, viUrl); // vẫn chặn → vòng nền kế (nếu còn quota)
}

async function handleTimedtext(rawUrl: string, playerBody?: string): Promise<void> {
  if (hasTlang(rawUrl)) return; // chỉ dùng track gốc (EN, chưa dịch) làm base
  const enUrl = withParam(rawUrl, "fmt", "json3");
  if (enUrl === lastBase) return; // tránh xử lý lặp cùng 1 track
  lastBase = enUrl;
  const vid = currentVideoId();

  // Đổi video → hủy retry nền cũ + reset bộ đếm vòng.
  if (vid !== bgVid) {
    cancelBgRetry();
    bgVid = vid;
    bgRounds = 0;
  }

  try {
    // EN: ưu tiên body player ĐÃ tải (nếu là json3) → bớt 1 request. Không parse được → re-fetch json3.
    let en = playerBody ? parseJson3(playerBody) : [];
    if (en.length === 0) {
      en = parseJson3(await (await fetch(enUrl)).text());
    }
    if (en.length === 0) {
      lastBase = "";
      return;
    }

    const viUrl = withParam(enUrl, "tlang", "vi");

    // Cache hit → dùng VN đã lưu, KHÔNG gọi Google.
    const cached = vid ? viCache.get(vid) : undefined;
    if (cached && cached.length > 0) {
      dbg(`video=${vid} dùng VI cache (${cached.length})`);
      window.postMessage({ __sm: "SM_CUES", cues: mergeCues(en, cached), videoId: vid, viState: "ok" }, "*");
      return;
    }

    // VI: backoff giãn dần (tiền cảnh).
    const { vi, viState } = await fetchVi(viUrl, VI_BACKOFF);

    dbg(`video=${vid} EN=${en.length} VI=${vi.length} state=${viState}`);
    if (viState === "ok" && vi.length > 0 && vid) viCache.set(vid, vi);
    window.postMessage({ __sm: "SM_CUES", cues: mergeCues(en, vi), videoId: vid, viState }, "*");

    // Vẫn bị chặn → EN đã hiện (post ở trên); đặt lịch retry NỀN để VN tự xuất hiện sau.
    if (viState === "blocked") scheduleBgRetry(vid, en, viUrl);
  } catch (e) {
    dbg("handleTimedtext error", e);
    lastBase = "";
  }
}

if (!window.__smTTInstalled) {
  window.__smTTInstalled = true;

  const origFetch = window.fetch.bind(window);
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const p = origFetch(input, init);
    if (isTT(url) && !hasTlang(url)) {
      // đọc body của response player (clone để không tiêu thụ mất của player)
      p.then((res) => res.clone().text())
        .then((body) => void handleTimedtext(url, body))
        .catch(() => undefined);
    }
    return p;
  } as typeof window.fetch;

  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
    const u = typeof url === "string" ? url : url.href;
    if (isTT(u)) this.__smTTUrl = u;
    return (origOpen as (...a: unknown[]) => void).apply(this, [method, url, ...rest]);
  } as typeof XMLHttpRequest.prototype.open;

  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
    const u = this.__smTTUrl;
    if (u && !hasTlang(u)) {
      this.addEventListener("load", () => {
        let txt = "";
        try {
          txt = this.responseText;
        } catch {
          txt = "";
        }
        void handleTimedtext(u, txt);
      });
    }
    return (origSend as (...a: unknown[]) => void).apply(this, [body ?? null]);
  } as typeof XMLHttpRequest.prototype.send;

  dbg("interceptor installed (MAIN world)");
}

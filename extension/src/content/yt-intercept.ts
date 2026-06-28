// TIP-005/009 — MAIN-world interceptor (Phương án B + chống anti-bot).
// world:"MAIN", run_at:"document_start". Hook fetch/XHR của PAGE để:
//   - BẮT body EN mà PLAYER đã tải (json3) → KHÔNG re-fetch EN (giảm burst 3→2 request).
//   - VI: chờ ~500ms (tránh burst) rồi fetch tlang=vi; gặp trang "Sorry" (anti-bot) → retry 1 lần.
//   - Phân biệt 3 trạng thái VI: ok / blocked (Sorry) / empty (json3 rỗng hợp lệ).
// → postMessage { cues, videoId, viState } sang content script (ISOLATED).
import { parseJson3, mergeCues, withParam, type Cue } from "../lib/captions";
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

async function handleTimedtext(rawUrl: string, playerBody?: string): Promise<void> {
  if (hasTlang(rawUrl)) return; // chỉ dùng track gốc (EN, chưa dịch) làm base
  const enUrl = withParam(rawUrl, "fmt", "json3");
  if (enUrl === lastBase) return; // tránh xử lý lặp cùng 1 track
  lastBase = enUrl;
  const vid = currentVideoId();

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

    // VI: chờ rồi fetch tlang=vi; gặp "Sorry" → retry 1 lần (backoff).
    const viUrl = withParam(enUrl, "tlang", "vi");
    let vi: ReturnType<typeof parseJson3> = [];
    let viState: ViState = "empty";
    for (let attempt = 0; attempt < 2; attempt++) {
      await delay(attempt === 0 ? 500 : 1500);
      let viRaw = "";
      try {
        viRaw = await (await fetch(viUrl)).text();
      } catch {
        viRaw = "";
      }
      if (isBlockedHtml(viRaw)) {
        viState = "blocked"; // bị chặn → vòng sau retry
        continue;
      }
      vi = parseJson3(viRaw);
      viState = vi.length > 0 ? "ok" : "empty";
      break;
    }

    dbg(`video=${vid} EN=${en.length} VI=${vi.length} state=${viState}`);
    const cues: Cue[] = mergeCues(en, vi);
    window.postMessage({ __sm: "SM_CUES", cues, videoId: vid, viState }, "*");
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

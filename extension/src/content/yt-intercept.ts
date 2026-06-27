// TIP-005 — MAIN-world interceptor (Phương án B).
// world:"MAIN", run_at:"document_start". Hook fetch/XHR của PAGE để bắt URL timedtext
// player YouTube tự gọi (ĐÃ KÝ pot/signature). Lấy URL gốc (EN, chưa tlang) → fetch
// json3 EN + (URL + tlang=vi) VI → ghép cue → postMessage sang content script (ISOLATED).
// Không dùng chrome.* (MAIN world không có).
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

const SM_DEBUG = false; // bật để xem log chẩn đoán caption/SPA
const dbg = (...a: unknown[]): void => {
  if (SM_DEBUG) console.log("[StudyMovie/intercept]", ...a);
};

const TT = "/api/timedtext";
const isTT = (u: unknown): u is string => typeof u === "string" && u.includes(TT);

const currentVideoId = (): string => new URLSearchParams(location.search).get("v") ?? "";

let lastBase = "";

async function buildAndPost(playerUrl: string): Promise<void> {
  if (/[?&]tlang=/.test(playerUrl)) return; // chỉ dùng URL gốc (EN) làm base
  const enUrl = withParam(playerUrl, "fmt", "json3");
  const vid = currentVideoId();
  if (enUrl === lastBase) {
    dbg("bỏ qua (trùng base url)", vid);
    return;
  }
  lastBase = enUrl;
  dbg("bắt timedtext, build cue cho video", vid);
  try {
    const en = parseJson3(await (await fetch(enUrl)).text());
    if (!en.length) {
      dbg("EN parse rỗng, bỏ qua");
      lastBase = "";
      return;
    }
    let vi = en.map(() => ({ start: 0, dur: 0, text: "" }));
    try {
      vi = parseJson3(await (await fetch(withParam(enUrl, "tlang", "vi"))).text());
    } catch {
      /* VI lỗi -> chỉ EN (fallback) */
    }
    const cues: Cue[] = mergeCues(en, vi);
    dbg(`post cue: EN=${en.length} VI=${vi.length} video=${vid}`);
    window.postMessage({ __sm: "SM_CUES", cues, videoId: vid }, "*");
  } catch (e) {
    dbg("buildAndPost error", e);
    lastBase = "";
  }
}

if (!window.__smTTInstalled) {
  window.__smTTInstalled = true;

  const origFetch = window.fetch.bind(window);
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (isTT(url)) void buildAndPost(url);
    return origFetch(input, init);
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
    if (u) this.addEventListener("load", () => void buildAndPost(u));
    return (origSend as (...a: unknown[]) => void).apply(this, [body ?? null]);
  } as typeof XMLHttpRequest.prototype.send;

  dbg("interceptor installed (MAIN world)");
}

// TIP-005/009/101 — MAIN-world interceptor (Phương án B + chống anti-bot cho EN).
// world:"MAIN", run_at:"document_start". Hook fetch/XHR của PAGE để BẮT body EN mà PLAYER đã
// tải (json3) → KHÔNG re-fetch EN (giảm request).
// TIP-101 — Đảo D-1: KHÔNG còn gọi tlang=vi của YouTube. Backend tự ghép cụm ASR thành câu
// (1 lần/video) + dịch bằng GPT-4o-mini CHỈ đoạn học viên xem tới (bám tiến độ xem, không
// dịch trước cả video). Extension chỉ giữ 1 khoảng đệm ~90s phía trước vị trí đang xem, dịch
// tiếp khi gần hết đệm, dịch đúng chỗ khi tua nhảy.
import { parseJson3, withParam, zipCues, type RawCue } from "../lib/captions";
export {};

declare global {
  interface Window {
    __smTTInstalled?: boolean;
  }
  interface XMLHttpRequest {
    __smTTUrl?: string;
  }
}

const SM_DEBUG = false;
const dbg = (...a: unknown[]): void => {
  if (SM_DEBUG) console.log("[StudyMovie/intercept]", ...a);
};

const TT = "/api/timedtext";
const isTT = (u: unknown): u is string => typeof u === "string" && u.includes(TT);
// TIP-063b — track player load KHÔNG chắc là EN (vd video có track mặc định khác EN,
// theo preference tài khoản/kênh) → chỉ tái dùng body player khi ĐÚNG lang=en, không thì bỏ qua
// và fetch lại bằng enUrl (đã ép lang=en) — tránh hiện nhầm phụ đề ngôn ngữ khác làm "EN gốc".
const isEnglishLang = (u: string): boolean => /[?&]lang=en(?:-[a-zA-Z]+)?(?:&|$)/.test(u);
const currentVideoId = (): string => new URLSearchParams(location.search).get("v") ?? "";

type ViState = "ok" | "empty" | "translating" | "failed";

const LOOKAHEAD_SEC = 90; // khoảng đệm phía trước vị trí đang xem
const CHECK_INTERVAL_MS = 4000; // chu kỳ kiểm tra "đủ đệm chưa"
// gọi dịch (có AI) — PHẢI lớn hơn timeout nội bộ backend (translate-batch.ts, 20s) + biên an
// toàn cho relay/network, nếu không 2 timeout gần bằng nhau dễ đua nhau: extension bỏ cuộc
// đúng lúc backend sắp trả lời xong.
const RELAY_TIMEOUT_TRANSLATE_MS = 28000;
// Số câu tối đa MỖI LẦN GỌI dịch — backend giờ dịch TỪNG CÂU SONG SONG (Promise.all), nên thời
// gian chờ = câu CHẬM NHẤT trong lô, không phải tổng cả lô. Đã đo thực tế: 15->6->4 cải thiện
// rõ rệt mỗi lần; thử tiếp 4->2 (kèm CHECK_INTERVAL_MS 2s) lại CHẬM HƠN (10s mở video, 2-4s tua
// không ổn định) — có thể do gọi quá thường xuyên gây tranh chấp/quá tải. QUAY LẠI mức đo được
// tốt nhất: 4 câu/lần, kiểm tra mỗi 4s. KHÔNG giảm thêm nữa trừ khi có dữ liệu đo rõ ràng hơn.
const CHUNK_COUNT = 4;
// TIP-101b — backend dịch SONG SONG từng câu (Promise.all) nên độ trễ 1 lô = câu CHẬM NHẤT
// trong lô, không phải tổng. Câu ĐANG XEM NGAY (gapIdx === startIdx: mở video mới / vừa tua tới
// đúng chỗ chưa dịch) cần trả nhanh nhất có thể → chỉ xin ĐÚNG 1 câu (không dính câu nào khác
// làm chậm theo). Câu kế tiếp sẽ tới ngay sau đó qua lượt ensureBufferAhead() liền kề (thường
// vẫn kịp trước khi học viên đọc xong câu 1). Phần đệm PHÍA TRƯỚC (chưa cần ngay) vẫn xin
// CHUNK_COUNT để đỡ tốn round-trip — ưu tiên khác nhau cho 2 mục đích khác nhau.
const URGENT_CHUNK_COUNT = 1;

let lastBase = "";
let curVid = "";
let groupedEn: RawCue[] = [];
let viArr: string[] = [];
let pendingRange: { from: number; to: number } | null = null;
let bufferTimer: ReturnType<typeof setInterval> | undefined;
let seekedHandler: (() => void) | undefined;

function getVideoEl(): HTMLVideoElement | null {
  return (
    (document.querySelector("video.html5-main-video") as HTMLVideoElement | null) ??
    (document.querySelector("video") as HTMLVideoElement | null)
  );
}

function postCues(vid: string, viState: ViState): void {
  if (currentVideoId() !== vid) return;
  window.postMessage({ __sm: "SM_CUES", cues: zipCues(groupedEn, viArr), videoId: vid, viState }, "*");
}

// TIP-101 — MAIN world không có chrome.runtime → nhờ content script ISOLATED (youtube.ts)
// relay qua window.postMessage (ISOLATED có chrome.runtime, gọi backend qua SM_API proxy).
let translateReqSeq = 0;
function askBackendTranslate(
  videoId: string,
  fromIndex: number,
  count: number,
  rawEn?: RawCue[]
): Promise<{ en: RawCue[]; vi: string[] } | null> {
  return new Promise((resolve) => {
    const reqId = `${videoId}-t${++translateReqSeq}`;
    const timer = setTimeout(() => {
      window.removeEventListener("message", onReply);
      resolve(null);
    }, RELAY_TIMEOUT_TRANSLATE_MS);
    function onReply(e: MessageEvent): void {
      if (e.source !== window) return;
      const d = e.data as { __sm?: string; reqId?: string; en?: RawCue[] | null; vi?: string[] | null } | undefined;
      if (d?.__sm !== "SM_TRANSLATE_RESULT" || d.reqId !== reqId) return;
      clearTimeout(timer);
      window.removeEventListener("message", onReply);
      resolve(d.en && d.vi ? { en: d.en, vi: d.vi } : null);
    }
    window.addEventListener("message", onReply);
    window.postMessage({ __sm: "SM_ASK_TRANSLATE", videoId, fromIndex, count, en: rawEn, reqId }, "*");
  });
}

// Câu cuối cùng có start <= t (câu đang phát tại thời điểm t).
function findIndexAtTime(cues: RawCue[], t: number): number {
  let idx = 0;
  for (let i = 0; i < cues.length; i++) {
    if (cues[i].start <= t) idx = i;
    else break;
  }
  return idx;
}

// TIP-101 — Kiểm tra "đoạn ~90s phía trước vị trí đang xem đã dịch hết chưa", dịch tiếp nếu
// thiếu. Chạy y hệt dù xem tuần tự hay vừa tua nhảy — không cần code riêng cho 2 trường hợp.
async function ensureBufferAhead(): Promise<void> {
  const vid = curVid;
  if (!vid || groupedEn.length === 0) return;
  const video = getVideoEl();
  if (!video) return;
  const t = video.currentTime;
  const startIdx = findIndexAtTime(groupedEn, t);
  const endTime = t + LOOKAHEAD_SEC;
  let gapIdx = -1;
  for (let i = startIdx; i < groupedEn.length && groupedEn[i].start <= endTime; i++) {
    if (viArr[i] === "") {
      gapIdx = i;
      break;
    }
  }
  if (gapIdx === -1) return; // đủ đệm rồi
  if (pendingRange && gapIdx >= pendingRange.from && gapIdx < pendingRange.to) return; // đang chờ đúng đoạn này

  // Câu đang phát NGAY (gapIdx === startIdx) mà chưa có bản dịch → ưu tiên tốc độ (lô nhỏ).
  // Gap ở đâu đó phía trước (đệm trước, chưa cần ngay) → ưu tiên gộp lô cho đỡ tốn round-trip.
  const isUrgent = gapIdx === startIdx;
  const count = Math.min(isUrgent ? URGENT_CHUNK_COUNT : CHUNK_COUNT, groupedEn.length - gapIdx);
  pendingRange = { from: gapIdx, to: gapIdx + count };
  const result = await askBackendTranslate(vid, gapIdx, count);
  if (currentVideoId() !== vid) return; // đã đổi video giữa chừng — bỏ kết quả trễ
  pendingRange = null;
  if (result) {
    groupedEn = result.en;
    viArr = result.vi;
    postCues(vid, "ok");
  }
}

function stopBuffering(): void {
  if (bufferTimer !== undefined) {
    clearInterval(bufferTimer);
    bufferTimer = undefined;
  }
  const video = getVideoEl();
  if (video && seekedHandler) video.removeEventListener("seeked", seekedHandler);
  seekedHandler = undefined;
  pendingRange = null;
}

function startBuffering(): void {
  void ensureBufferAhead(); // ngay lập tức, không đợi hết chu kỳ đầu (tránh mất 4s vô ích)
  bufferTimer = setInterval(() => void ensureBufferAhead(), CHECK_INTERVAL_MS);
  const video = getVideoEl();
  if (video) {
    // TIP-101 — giảm độ trễ khi tua nhảy: kiểm tra NGAY khi vừa tua xong, thay vì chờ
    // tới lượt setInterval kế tiếp (tệ nhất tới 4s).
    seekedHandler = () => void ensureBufferAhead();
    video.addEventListener("seeked", seekedHandler);
  }
}

async function handleTimedtext(rawUrl: string, playerBody?: string): Promise<void> {
  const enUrl = withParam(withParam(rawUrl, "lang", "en"), "fmt", "json3");
  if (enUrl === lastBase) return; // tránh xử lý lặp cùng 1 track
  lastBase = enUrl;
  const vid = currentVideoId();

  try {
    // EN: ưu tiên body player ĐÃ tải (nếu là json3) → bớt 1 request. CHỈ dùng khi request gốc
    // ĐÚNG lang=en — khác ngôn ngữ thì bỏ qua, re-fetch bằng enUrl (đã ép lang=en) cho chắc.
    let en = playerBody && isEnglishLang(rawUrl) ? parseJson3(playerBody) : [];
    if (en.length === 0) {
      en = parseJson3(await (await fetch(enUrl)).text());
    }
    if (en.length === 0) {
      lastBase = "";
      return;
    }

    stopBuffering();
    curVid = vid;

    // Hiện EN ngay (thô, chưa ghép câu) trong lúc chờ cache/dịch — không để màn hình trống.
    groupedEn = en;
    viArr = new Array(en.length).fill("") as string[];
    postCues(vid, "translating");

    // TIP-101 — GỘP "hỏi cache" + "dịch nếu thiếu" thành 1 lần gọi mạng thay vì 2 lần nối tiếp
    // (trước: GET hỏi cache, cache miss mới POST dịch — với video hoàn toàn mới luôn phải chờ
    // đủ cả 2 vòng đi-về). Endpoint dịch đã tự kiểm tra cache trước khi gọi AI, nên gọi thẳng
    // 1 lần là đủ: có cache → trả ngay (không tốn AI); chưa có → dịch lô đầu luôn. Kèm EN thô để
    // backend ghép câu nếu đây là lần đầu video này có người xem (bỏ qua nếu đã có cache).
    // Lô đầu = URGENT_CHUNK_COUNT (nhỏ hơn CHUNK_COUNT): đây là câu SẮP PHÁT NGAY, ưu tiên tốc
    // độ trả về hơn là gộp nhiều câu — startBuffering() bên dưới sẽ tự lấy tiếp phần còn lại.
    const first = vid ? await askBackendTranslate(vid, 0, URGENT_CHUNK_COUNT, en) : null;
    if (currentVideoId() !== vid) return;
    if (first) {
      groupedEn = first.en;
      viArr = first.vi;
      postCues(vid, groupedEn.length === 0 ? "empty" : "ok");
      if (groupedEn.length > 0) startBuffering();
    } else {
      postCues(vid, "failed");
    }
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
    if (isTT(url)) {
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
    if (u) {
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

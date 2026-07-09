// TIP-005 — Content script (ISOLATED) trang watch YouTube.
// Nhận cue (EN/VI) từ interceptor MAIN-world qua window.postMessage (URL caption ĐÃ KÝ),
// dựng overlay 2 dòng (EXT-01), click-từ tra nghĩa + lưu (EXT-02), settings realtime (EXT-04).
// Mọi tương tác DOM player có guard — không throw khi YouTube đổi cấu trúc.
import { type Cue } from "../lib/captions";
import { getSettings, onSettingsChange, DEFAULT_SETTINGS, COLOR_HEX, type Settings } from "../lib/settings";

// Gọi backend QUA background SW (content script ở origin youtube.com bị CORS chặn;
// background dùng origin chrome-extension đã nằm trong allowlist). CORS backend giữ chặt.
interface ApiResp {
  ok: boolean;
  data?: unknown;
  error?: string;
}
function callApi<T>(method: string, path: string, body?: unknown): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "SM_API", method, path, body }, (resp: ApiResp | undefined) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!resp?.ok) {
        reject(new Error(resp?.error ?? "API error"));
        return;
      }
      resolve(resp.data as T);
    });
  });
}

interface Sense {
  pos: string | null;
  sense: string | null;
  examples: { en: string; vi: string | null }[];
}
interface LookupResult {
  lemma: string;
  ipa: string | null;
  meanings: Sense[] | null;
  audio_url: string | null;
  source?: string;
}
interface LookupResponse {
  word: string;
  result: LookupResult | null;
  source?: string;
  status?: string;
  message?: string | null;
}
// TIP-038 — nghĩa theo ngữ cảnh (AI). source: "ai" | "ai-cache" (có nghĩa) | "fallback" (dùng từ điển).
interface ContextResponse {
  word?: string;
  meaning_vi?: string;
  source?: string;
}
// TIP-039 — chỉ 1 phiên âm (FVDP ngăn nhiều biến thể bằng "," / ";"; ưu tiên cái đầu = UK).
function firstIpa(ipa: string | null): string | null {
  if (!ipa) return null;
  const first = ipa.replace(/\//g, "").split(/[,;]/)[0].trim();
  return first || null;
}

const ID = "studymovie-overlay";
let settings: Settings = { ...DEFAULT_SETTINGS };
let cues: Cue[] = [];
let activeIndex = -1;
let popupOpen = false;
let pausedByPopup = false;
let currentVid = "";
let hasAccess = true; // TIP-062: còn quyền dùng dịch vụ? mặc định true = fail-open (chỉ ẩn khi rõ hết hạn)

const SM_DEBUG = false; // bật để xem log chẩn đoán
const dbg = (...a: unknown[]): void => {
  if (SM_DEBUG) console.log("[StudyMovie/content]", ...a);
};
const locVideoId = (): string => new URLSearchParams(location.search).get("v") ?? "";

const getPlayer = (): HTMLElement | null =>
  (document.querySelector("#movie_player") as HTMLElement | null) ??
  (document.querySelector(".html5-video-player") as HTMLElement | null);
const getVideo = (): HTMLVideoElement | null =>
  (document.querySelector("video.html5-main-video") as HTMLVideoElement | null) ??
  (document.querySelector("video") as HTMLVideoElement | null);

function ensureHideNativeStyle(): void {
  let s = document.getElementById("studymovie-hide-native");
  if (!s) {
    s = document.createElement("style");
    s.id = "studymovie-hide-native";
    s.textContent = ".ytp-caption-window-container{display:none !important;}";
    document.documentElement.appendChild(s);
  }
  // Ẩn caption gốc YouTube khi StudyMovie BẬT + CÒN QUYỀN và đang phụ trách (có cue).
  // Tắt StudyMovie (TIP-028) / hết hạn (TIP-062) → gỡ style ẩn → caption gốc YouTube trở lại.
  s.toggleAttribute("disabled", !(settings.enabled && hasAccess && cues.length > 0));
}

// \p{L} = mọi chữ cái Unicode (bắt cả dấu câu lạ trong caption tự động: ’ – — … v.v.,
// không chỉ ASCII). Giữ ' và - vì nằm giữa từ (well-known, don't).
const WORD_EDGE_PUNCT = /^[^\p{L}'-]+|[^\p{L}'-]+$/gu;
function cleanWord(raw: string): string {
  return raw.replace(WORD_EDGE_PUNCT, "").toLowerCase();
}
// Bản hiển thị: bóc dấu câu ở đầu/cuối như cleanWord nhưng GIỮ hoa/thường gốc (tiêu đề popup).
function cleanWordDisplay(raw: string): string {
  return raw.replace(WORD_EDGE_PUNCT, "");
}

// ---- Overlay ----
function removeOverlay(): void {
  document.getElementById(ID)?.remove();
  document.getElementById("studymovie-vinote")?.remove();
  activeIndex = -1;
}

function buildOverlay(): void {
  const player = getPlayer();
  if (!player) return;
  if (document.getElementById(ID)) return;
  const box = document.createElement("div");
  box.id = ID;
  Object.assign(box.style, {
    position: "absolute",
    left: "0",
    right: "0",
    bottom: "20px",
    textAlign: "center",
    pointerEvents: "none",
    zIndex: "60",
    transition: "bottom 0.2s ease", // TIP-023: dời mượt khi control ẩn/hiện
  } as Partial<CSSStyleDeclaration>);
  player.appendChild(box);
  updateOverlayPosition(); // đặt vị trí theo control/full-screen ngay
  activeIndex = -1;
}

// TIP-023 — Dời overlay để KHÔNG bị thanh control YouTube che.
//   controls ẩn = #movie_player có class 'ytp-autohide'; full screen = document.fullscreenElement
//   hoặc player có class 'ytp-fullscreen'. (Rà lại selector nếu YouTube đổi DOM.)
//   Vị trí: thường ẩn 20px/hiện 60px; full screen ẩn 24px/hiện 80px (control bar ~60px).
function updateOverlayPosition(): void {
  const box = document.getElementById(ID) as HTMLDivElement | null;
  const player = getPlayer();
  if (!box || !player) return;
  const fs = !!document.fullscreenElement || player.classList.contains("ytp-fullscreen");
  const controlsHidden = player.classList.contains("ytp-autohide");
  const bottom = fs ? (controlsHidden ? 24 : 80) : controlsHidden ? 20 : 60;
  const px = `${bottom}px`;
  if (box.style.bottom !== px) box.style.bottom = px;
}

// TIP-060 — nền phụ đề dùng màu do user chọn (bgColor) + độ mờ bgOpacity.
function bgRgba(hex: string, opacityPct: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${opacityPct / 100})`;
}

// TIP-022/023/060 — 1 PILL bo tròn nền ôm dòng phụ đề. Tắt nền → trong suốt + text-shadow.
function styleBubble(bubble: HTMLElement): void {
  const bg = settings.bgEnabled;
  Object.assign(bubble.style, {
    display: "inline-block",
    maxWidth: "92%",
    padding: bg ? "4px 14px" : "2px 6px",
    borderRadius: "10px",
    background: bg ? bgRgba(COLOR_HEX[settings.bgColor], settings.bgOpacity) : "transparent",
    textAlign: "center",
    fontFamily: '"Inter", Arial, sans-serif',
  } as Partial<CSSStyleDeclaration>);
}

// EN: size=fontSizePx, đậm; VI: size=80% EN, thường. Màu theo enColor/viColor. Tắt nền → text-shadow.
function styleLine(el: HTMLElement, vi: boolean): void {
  const sizePx = vi ? Math.round(settings.fontSizePx * 0.8) : settings.fontSizePx;
  const colorKey = vi ? settings.viColor : settings.enColor;
  const color = COLOR_HEX[colorKey];
  // Không nền: chữ tối (đen) cần halo sáng; chữ sáng (trắng/vàng) cần bóng tối — cho dễ đọc.
  const shadow = settings.bgEnabled
    ? "none"
    : colorKey === "black"
      ? "0 0 3px rgba(255,255,255,0.95)"
      : "0 1px 3px rgba(0,0,0,0.95)";
  Object.assign(el.style, {
    display: "block",
    fontSize: `${sizePx}px`,
    lineHeight: "1.3",
    color,
    fontWeight: vi ? "400" : "700",
    letterSpacing: "-0.03em",
    textShadow: shadow,
  } as Partial<CSSStyleDeclaration>);
}

function renderCue(idx: number): void {
  const box = document.getElementById(ID) as HTMLDivElement | null;
  if (!box) return;
  box.textContent = "";
  if (idx < 0) return;
  const cue = cues[idx];
  if (!cue) return;

  const showEn = (settings.mode === "en" || settings.mode === "both") && !!cue.en;
  const showVi = (settings.mode === "vi" || settings.mode === "both") && !!cue.vi;
  if (!showEn && !showVi) return;

  const bubble = document.createElement("div");
  styleBubble(bubble);

  if (showEn) {
    const en = document.createElement("div");
    styleLine(en, false);
    en.style.pointerEvents = "auto";
    for (const token of cue.en.split(/(\s+)/)) {
      if (/^\s+$/.test(token)) {
        en.appendChild(document.createTextNode(token));
        continue;
      }
      const w = document.createElement("span");
      w.textContent = token;
      w.style.cursor = "pointer";
      w.addEventListener("mouseenter", () => (w.style.textDecoration = "underline"));
      w.addEventListener("mouseleave", () => (w.style.textDecoration = "none"));
      w.addEventListener("click", (e) => {
        e.stopPropagation();
        void onWordClick(cleanWord(token), token, cue.en);
      });
      en.appendChild(w);
    }
    bubble.appendChild(en);
  }
  if (showVi) {
    const vi = document.createElement("div");
    styleLine(vi, true);
    vi.textContent = cue.vi;
    // Khoảng cách dọc EN↔VI chỉ áp khi hiện cả hai (mode='both').
    if (showEn) vi.style.marginTop = `${settings.lineGapPx}px`;
    bubble.appendChild(vi);
  }
  box.appendChild(bubble);
}

function syncTick(): void {
  if (!settings.enabled || !hasAccess) return; // TIP-028 tắt / TIP-062 hết hạn → không xử lý phụ đề
  const video = getVideo();
  if (!video || !document.getElementById(ID)) return;
  updateOverlayPosition(); // TIP-023: né control YouTube (ẩn/hiện + full screen), poll 250ms
  if (popupOpen) return; // giữ phụ đề đứng yên khi popup mở
  const t = video.currentTime;
  // Chọn cue MỚI NHẤT đã bắt đầu: start lớn nhất thỏa start <= t < start+dur.
  // (Bỏ break + so start lớn nhất → xử lý đúng cue GỐI nhau; không cue nào chứa t → -1 → ẩn.)
  // EN & VI cùng nằm trong cues[idx] nên hiển thị khớp nhau theo cùng logic.
  let idx = -1;
  for (let i = 0; i < cues.length; i++) {
    if (t >= cues[i].start && t < cues[i].start + cues[i].dur) {
      if (idx === -1 || cues[i].start > cues[idx].start) idx = i;
    }
  }
  if (idx !== activeIndex) {
    activeIndex = idx;
    renderCue(idx);
  }
}

// Nhãn trạng thái VI (khi EN-only). state: blocked | empty | null(=ẩn).
function setViNote(text: string | null): void {
  const existing = document.getElementById("studymovie-vinote");
  if (!text) {
    existing?.remove();
    return;
  }
  const player = getPlayer();
  if (!player) return;
  let el = existing as HTMLDivElement | null;
  if (!el) {
    el = document.createElement("div");
    el.id = "studymovie-vinote";
    Object.assign(el.style, {
      position: "absolute",
      left: "0",
      right: "0",
      bottom: "118px",
      textAlign: "center",
      zIndex: "61",
      pointerEvents: "none",
      color: "#fbbf24",
      fontSize: "12px",
      fontFamily: "Arial, sans-serif",
      textShadow: "0 1px 2px rgba(0,0,0,0.85)",
    } as Partial<CSSStyleDeclaration>);
    player.appendChild(el);
  }
  el.textContent = text;
}

// TIP-062 — nhắc nâng cấp khi HẾT HẠN (thay cho phụ đề). show=false → gỡ.
function setAccessNote(show: boolean): void {
  const id = "studymovie-accessnote";
  const existing = document.getElementById(id);
  if (!show) {
    existing?.remove();
    return;
  }
  const player = getPlayer();
  if (!player) return;
  let el = existing as HTMLDivElement | null;
  if (!el) {
    el = document.createElement("div");
    el.id = id;
    Object.assign(el.style, {
      position: "absolute",
      left: "0",
      right: "0",
      bottom: "40px",
      textAlign: "center",
      zIndex: "61",
      pointerEvents: "none",
      color: "#fbbf24",
      fontSize: "13px",
      fontWeight: "600",
      fontFamily: "Arial, sans-serif",
      textShadow: "0 1px 2px rgba(0,0,0,0.9)",
    } as Partial<CSSStyleDeclaration>);
    player.appendChild(el);
  }
  el.textContent = "StudyMovie: hết hạn dùng thử — nâng cấp tại app.studymovie.com";
}

// TIP-062 — lấy trạng thái quyền từ backend (/api/access-status qua proxy). Fail-open khi lỗi.
async function refreshAccess(): Promise<void> {
  try {
    const data = await callApi<{ has_access?: boolean }>("GET", "/api/access-status");
    hasAccess = data?.has_access !== false; // chỉ ẩn khi rõ ràng false
  } catch {
    hasAccess = true; // lỗi mạng / chưa đăng nhập → không chặn oan
  }
  applyAccessGate();
}

// TIP-062 — áp gate quyền: hết hạn → ẩn overlay + nhắc; còn hạn → dựng lại theo settings.
function applyAccessGate(): void {
  ensureHideNativeStyle(); // cập nhật ẩn/hiện caption gốc theo hasAccess
  if (!hasAccess) {
    removeOverlay();
    setViNote(null);
    setAccessNote(true);
    return;
  }
  setAccessNote(false);
  applySettings();
}

// ---- Word popup (tra nghĩa + lưu) ----
function closeWordPopup(resume: boolean): void {
  document.getElementById("studymovie-word")?.remove();
  popupOpen = false;
  if (resume && pausedByPopup) {
    getVideo()?.play().catch(() => undefined);
  }
  pausedByPopup = false;
}

function meaningSummary(result: LookupResult | null): string {
  if (!result?.meanings?.length) return "";
  return result.meanings
    .map((m) => m.sense)
    .filter((s): s is string => !!s)
    .slice(0, 3)
    .join("; ");
}

// TIP-095 — icon loa 18x18, y hệt page hoc-tu-vung (SpeakerIcon), thay nút text "🔊 Phát âm".
const SPEAKER_ICON_SVG =
  '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.125 2.81251C10.125 2.70187 10.0924 2.5937 10.0312 2.50152C9.97 2.40934 9.883 2.33724 9.78105 2.29426C9.67911 2.25127 9.56676 2.2393 9.45805 2.25984C9.34934 2.28039 9.2491 2.33253 9.16987 2.40976L5.877 5.61601H3.9375C3.48995 5.61601 3.06072 5.7938 2.74426 6.11026C2.42779 6.42673 2.25 6.85595 2.25 7.30351V10.6673C2.25 11.1148 2.42779 11.544 2.74426 11.8605C3.06072 12.177 3.48995 12.3548 3.9375 12.3548H5.87587L9.16875 15.5891C9.24785 15.6667 9.34809 15.7191 9.45688 15.7399C9.56568 15.7607 9.67819 15.7489 9.78032 15.706C9.88244 15.6631 9.96963 15.5911 10.0309 15.4988C10.0923 15.4066 10.125 15.2983 10.125 15.1875V2.81251ZM11.3749 5.83763C11.4209 5.77975 11.4778 5.73151 11.5425 5.69566C11.6071 5.65981 11.6782 5.63705 11.7517 5.6287C11.8251 5.62034 11.8995 5.62654 11.9705 5.64695C12.0416 5.66735 12.1079 5.70157 12.1657 5.74763L12.168 5.74876L12.1702 5.75101L12.1759 5.75551L12.1927 5.77013L12.2445 5.81513C12.2857 5.85263 12.339 5.90588 12.4042 5.97488C12.5314 6.11326 12.6967 6.31463 12.8599 6.58238C13.1872 7.12238 13.5045 7.92451 13.5045 8.99888C13.5045 10.0721 13.1872 10.8754 12.8599 11.4154C12.7286 11.6329 12.576 11.8368 12.4042 12.024C12.332 12.101 12.2562 12.1746 12.177 12.2445L12.168 12.2524H12.1669C12.1669 12.2524 11.664 12.5258 11.376 12.1646C11.2834 12.0488 11.2403 11.901 11.2561 11.7535C11.2719 11.606 11.3453 11.4708 11.4604 11.3771L11.4626 11.3749L11.4829 11.3569C11.5039 11.3381 11.5357 11.3063 11.5785 11.2613C11.699 11.1289 11.806 10.985 11.898 10.8315C12.1342 10.4434 12.3795 9.83926 12.3795 8.99776C12.3795 8.15626 12.1342 7.55438 11.898 7.16738C11.7822 6.97656 11.6431 6.80085 11.484 6.64426L11.4637 6.62626C11.3477 6.53326 11.2732 6.39808 11.2565 6.25029C11.2399 6.1025 11.2824 5.95413 11.3749 5.83763ZM13.2896 3.49763C13.232 3.44997 13.1655 3.41427 13.094 3.39261C13.0224 3.37095 12.9473 3.36377 12.8729 3.37148C12.7986 3.37919 12.7265 3.40165 12.661 3.43753C12.5954 3.47342 12.5376 3.52201 12.491 3.58048C12.4445 3.63894 12.41 3.70611 12.3897 3.77804C12.3694 3.84997 12.3636 3.92524 12.3727 3.99943C12.3818 4.07363 12.4056 4.14527 12.4427 4.21016C12.4798 4.27505 12.5294 4.3319 12.5887 4.37738L12.6011 4.38863L12.6596 4.43926C12.7136 4.48651 12.789 4.55963 12.8857 4.65863C13.077 4.85776 13.3357 5.15701 13.5945 5.55188C14.112 6.34051 14.6295 7.50151 14.6295 9.00451C14.6339 10.2311 14.2736 11.4312 13.5945 12.4526C13.3357 12.8464 13.077 13.1434 12.8857 13.3414C12.7952 13.4355 12.7006 13.5255 12.6022 13.6114L12.5899 13.6226H12.5887C12.4752 13.7166 12.4031 13.8514 12.3879 13.9979C12.3727 14.1445 12.4156 14.2912 12.5074 14.4065C12.5993 14.5217 12.7327 14.5964 12.8789 14.6143C13.0252 14.6322 13.1727 14.592 13.2896 14.5024L13.3267 14.472L13.4111 14.3989C13.482 14.3348 13.5799 14.2436 13.6957 14.1233C14.0078 13.7992 14.2888 13.4467 14.535 13.0703C15.3342 11.8653 15.7581 10.4504 15.7534 9.00451C15.7563 7.55746 15.3325 6.14167 14.535 4.93426C14.2887 4.55746 14.0081 4.20421 13.6969 3.87901C13.5792 3.75688 13.4561 3.64013 13.3279 3.52913L13.302 3.50776L13.2941 3.50101L13.2919 3.49876L13.2896 3.49763Z" fill="#1F1F1F"/></svg>';

// TIP-095 — nút Lưu (nền xanh, khớp badge "Đã học" /tu-vung) / Đóng (nền đỏ, khớp badge "Từ mới").
function mkBtn(label: string, onClick: () => void, variant: "save" | "close"): HTMLButtonElement {
  const b = document.createElement("button");
  b.textContent = label;
  const colors =
    variant === "save" ? { bg: "#dcebcc", fg: "#4f9d00" } : { bg: "#f9d8d8", fg: "#e03b3b" };
  Object.assign(b.style, {
    border: "0",
    background: colors.bg,
    color: colors.fg,
    borderRadius: "6px",
    padding: "6px 12px",
    fontSize: "13px",
    fontWeight: "500",
    cursor: "pointer",
    marginTop: "6px",
  } as Partial<CSSStyleDeclaration>);
  b.addEventListener("click", onClick);
  return b;
}

// TIP-070 — phát âm bằng Web Speech API (không tải media ngoài → không vướng CSP media-src YouTube).
function speakWord(text: string): void {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-GB";
    u.rate = 0.9;
    window.speechSynthesis.cancel(); // dừng câu đang đọc (nếu có)
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

// Ưu tiên audio từ điển; bị chặn (CSP)/lỗi/không có URL → fallback speechSynthesis.
function playPronunciation(url: string | null, text: string): void {
  if (url) {
    try {
      const a = new Audio(url);
      void a.play().catch(() => speakWord(text)); // CSP media-src YouTube chặn media ngoài → speak
      return;
    } catch {
      /* fall through */
    }
  }
  speakWord(text);
}

function onWordClick(word: string, surface: string, sentence: string): void {
  if (!word) return;
  if (!hasAccess) {
    // TIP-062: hết hạn → không tra, chỉ nhắc nâng cấp.
    setAccessNote(true);
    return;
  }
  const player = getPlayer();
  if (!player) return;

  const video = getVideo();
  if (video && !video.paused) {
    video.pause();
    pausedByPopup = true;
  }
  popupOpen = true;

  document.getElementById("studymovie-word")?.remove();
  const pop = document.createElement("div");
  pop.id = "studymovie-word";
  Object.assign(pop.style, {
    position: "absolute",
    left: "50%",
    bottom: "150px",
    transform: "translateX(-50%)",
    maxWidth: "360px",
    minWidth: "220px",
    background: "#ffffff",
    color: "#18181b",
    borderRadius: "10px",
    padding: "12px 14px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
    zIndex: "80",
    fontFamily: "Arial, sans-serif",
    fontSize: "14px",
    textAlign: "left",
    pointerEvents: "auto",
  } as Partial<CSSStyleDeclaration>);
  pop.addEventListener("click", (e) => e.stopPropagation());
  player.appendChild(pop);

  // TIP-069 — RENDER DẦN: từ hiện NGAY; IPA/loa vào khi /api/lookup xong; nghĩa AI điền sau.
  // Guard: popup còn mở & đúng element (bỏ qua cập nhật nếu user đã đóng trước khi request về).
  const alive = (): boolean => popupOpen && document.getElementById("studymovie-word") === pop;

  // TIP-095 — hàng từ + icon loa (căn baseline), font/màu đồng bộ page hoc-tu-vung.
  const headRow = document.createElement("div");
  Object.assign(headRow.style, {
    display: "flex",
    alignItems: "baseline",
    gap: "6px",
  } as Partial<CSSStyleDeclaration>);
  const head = document.createElement("span");
  Object.assign(head.style, {
    fontSize: "28px",
    fontWeight: "700",
    lineHeight: "1",
    letterSpacing: "-0.03em",
    color: "#1f1f1f",
  } as Partial<CSSStyleDeclaration>);
  head.textContent = cleanWordDisplay(surface.trim()) || word; // hiện NGAY, không cần request (bỏ dấu câu dính từ)
  const speakerBtn = document.createElement("button");
  speakerBtn.type = "button";
  Object.assign(speakerBtn.style, {
    border: "0",
    background: "none",
    padding: "0",
    margin: "0",
    cursor: "pointer",
    display: "inline-flex",
    opacity: "0.5",
    transition: "opacity 0.15s",
  } as Partial<CSSStyleDeclaration>);
  speakerBtn.innerHTML = SPEAKER_ICON_SVG;
  speakerBtn.addEventListener("mouseenter", () => (speakerBtn.style.opacity = "1"));
  speakerBtn.addEventListener("mouseleave", () => (speakerBtn.style.opacity = "0.5"));
  speakerBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    playPronunciation(currentResult?.audio_url ?? null, currentResult?.lemma || word);
  });
  headRow.appendChild(head);
  headRow.appendChild(speakerBtn);
  pop.appendChild(headRow);

  const sub = document.createElement("div"); // lemma + IPA (điền khi dict xong)
  Object.assign(sub.style, {
    marginTop: "5px",
    fontSize: "14px",
    letterSpacing: "-0.03em",
    color: "#6b7280",
    display: "none",
  } as Partial<CSSStyleDeclaration>);
  pop.appendChild(sub);

  const meaningBox = document.createElement("div");
  Object.assign(meaningBox.style, {
    margin: "8px 0",
    fontSize: "16px",
    letterSpacing: "-0.03em",
    color: "#1f1f1f",
  } as Partial<CSSStyleDeclaration>);
  meaningBox.textContent = "Đang tra nghĩa…";
  pop.appendChild(meaningBox);

  const actions = document.createElement("div"); // hàng nút: Lưu / Đóng
  pop.appendChild(actions);

  // Trạng thái điền dần (đọc lúc bấm Lưu).
  let currentResult: LookupResult | null = null;
  let currentMeaning: string | null = null; // nghĩa để lưu (AI nếu có, else tóm tắt từ điển)
  let aiMeaning: string | null = null;
  let dictSettled = false;
  let ctxSettled = false;
  let dictStatus: string | undefined;

  function renderMeaning(): void {
    if (!alive()) return;
    meaningBox.textContent = "";
    if (aiMeaning) {
      const line = document.createElement("div");
      line.textContent = aiMeaning;
      meaningBox.appendChild(line);
      currentMeaning = aiMeaning;
      return;
    }
    if (!ctxSettled) {
      meaningBox.textContent = "Đang tra nghĩa…"; // chờ AI trước khi rơi về từ điển
      return;
    }
    // AI đã settle, không có nghĩa AI → dùng nghĩa từ điển.
    if (currentResult?.meanings?.length) {
      if (currentResult.source === "free_dict") {
        const tag = document.createElement("div");
        tag.textContent = "📖 định nghĩa tiếng Anh";
        tag.style.cssText = "font-size:11px;color:#4f46e5;margin-bottom:2px;";
        meaningBox.appendChild(tag);
      }
      for (const s of currentResult.meanings.slice(0, 4)) {
        const line = document.createElement("div");
        line.textContent = `• ${s.pos ? `(${s.pos}) ` : ""}${s.sense ?? ""}`;
        meaningBox.appendChild(line);
      }
      currentMeaning = meaningSummary(currentResult);
      return;
    }
    if (!dictSettled) {
      meaningBox.textContent = "Đang tra nghĩa…"; // AI rỗng nhưng dict chưa xong → chờ dict
      return;
    }
    meaningBox.textContent = dictStatus === "error" ? "Lỗi tra cứu, thử lại sau." : "Không tìm thấy nghĩa.";
    currentMeaning = null;
  }

  // Nút Lưu (đọc NGHĨA HIỆN TẠI lúc bấm) + Đóng — có sẵn ngay.
  const saveBtn = mkBtn("Lưu", async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = "Đang lưu…";
    try {
      const r = await callApi<{ saved: boolean; duplicate: boolean }>("POST", "/api/vocabulary", {
        word,
        lemma: currentResult?.lemma ?? word,
        ipa: currentResult?.ipa ?? null,
        meaning_vi: currentMeaning ?? meaningSummary(currentResult),
        example: sentence,
        audio_url: currentResult?.audio_url ?? null,
      });
      saveBtn.textContent = r.duplicate ? "Đã lưu trước đó ✓" : "Đã lưu ✓";
    } catch (e) {
      saveBtn.textContent = `Lỗi: ${e instanceof Error ? e.message : "không lưu được"}`;
      saveBtn.disabled = false;
    }
  }, "save");
  saveBtn.style.marginRight = "6px";
  actions.appendChild(saveBtn);
  actions.appendChild(mkBtn("Đóng", () => closeWordPopup(true), "close"));

  // Fire SONG SONG, KHÔNG await chung.
  void callApi<LookupResponse>("GET", `/api/lookup?word=${encodeURIComponent(word)}`)
    .then((res) => {
      dictSettled = true;
      dictStatus = res.status;
      currentResult = res.result;
      if (!alive()) return;
      const r = res.result;
      const ipa1 = firstIpa(r?.ipa ?? null); // TIP-039/095: chỉ 1 phiên âm, KHÔNG hiện kèm lemma
      if (ipa1) {
        sub.textContent = `/${ipa1}/`;
        sub.style.display = "";
      }
      renderMeaning();
    })
    .catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("HTTP 403")) {
        // TIP-062: hết hạn giữa chừng → khoá dịch vụ + ẩn phụ đề + nhắc.
        hasAccess = false;
        closeWordPopup(true);
        applyAccessGate();
        return;
      }
      dictSettled = true; // lỗi khác → không chặn (AI vẫn có thể ra nghĩa)
      dictStatus = "error";
      renderMeaning();
    });

  void callApi<ContextResponse>("POST", "/api/lookup-context", { word, sentence })
    .then((ctx) => {
      if (ctx.source === "ai" || ctx.source === "ai-cache") aiMeaning = (ctx.meaning_vi ?? "").trim() || null;
    })
    .catch(() => {
      /* AI lỗi → dùng nghĩa từ điển */
    })
    .finally(() => {
      ctxSettled = true;
      renderMeaning();
    });
}

// Click ra ngoài popup -> đóng + chạy tiếp.
document.addEventListener("click", () => {
  if (popupOpen) closeWordPopup(true);
});

// ---- Áp dụng settings realtime (TIP-015: cài đặt từ popup qua chrome.storage) ----
// Cài đặt phụ đề giờ nằm ở POPUP extension (gỡ panel gear trong player của TIP-005).
function applySettings(): void {
  ensureHideNativeStyle();
  // TIP-028 tắt / TIP-062 hết hạn → gỡ overlay + trả caption gốc (ensureHideNativeStyle đã gỡ style ẩn).
  if (!settings.enabled || !hasAccess || !cues.length) {
    removeOverlay();
    return;
  }
  buildOverlay();
  // Áp NGAY lên cue đang hiển thị (đổi cỡ chữ/nền/ẩn-hiện EN-VI không cần reload).
  if (activeIndex >= 0) renderCue(activeIndex);
}

// TIP-101 — Dịch phụ đề Việt DÙNG CHUNG giữa mọi user (qua backend), bám tiến độ xem (không
// dịch trước cả video). MAIN world (yt-intercept.ts) không có chrome.runtime → nhờ content
// script ISOLATED (ở đây) relay gọi backend qua SM_API proxy. Endpoint dịch tự kiểm tra cache
// trước khi gọi AI, nên chỉ cần 1 loại yêu cầu (SM_ASK_TRANSLATE) — không cần hỏi cache riêng.
interface RawCueLike {
  start: number;
  dur: number;
  text: string;
}
function handleAskTranslate(
  videoId: string,
  fromIndex: number,
  count: number,
  en: RawCueLike[] | undefined,
  reqId: string
): void {
  callApi<{ en: RawCueLike[]; vi: string[] }>("POST", `/api/captions-translate/${videoId}`, { fromIndex, count, en })
    .then((r) => {
      window.postMessage({ __sm: "SM_TRANSLATE_RESULT", reqId, en: r.en, vi: r.vi }, "*");
    })
    .catch(() => {
      window.postMessage({ __sm: "SM_TRANSLATE_RESULT", reqId, en: null, vi: null }, "*");
    });
}

// ---- Nhận cue từ interceptor (MAIN world) ----
function onMessage(e: MessageEvent): void {
  if (e.source !== window) return;
  const raw = e.data as
    | {
        __sm?: string;
        cues?: Cue[];
        videoId?: string;
        viState?: string;
        reqId?: string;
        fromIndex?: number;
        count?: number;
        en?: RawCueLike[];
      }
    | null;
  if (
    raw?.__sm === "SM_ASK_TRANSLATE" &&
    raw.videoId &&
    raw.reqId &&
    typeof raw.fromIndex === "number" &&
    typeof raw.count === "number"
  ) {
    handleAskTranslate(raw.videoId, raw.fromIndex, raw.count, raw.en, raw.reqId);
    return;
  }
  const d = raw;
  if (d?.__sm !== "SM_CUES" || !Array.isArray(d.cues)) return;
  dbg("nhận cue", d.cues.length, "video=", d.videoId, "viState=", d.viState);
  cues = d.cues;
  currentVid = d.videoId ?? locVideoId();
  activeIndex = -1;
  ensureHideNativeStyle();
  removeOverlay(); // dựng lại để gắn vào #movie_player hiện tại (YouTube có thể thay DOM player)
  if (settings.enabled && hasAccess && cues.length) {
    // TIP-028: Tắt StudyMovie → vẫn lưu cues (để bật lại dựng ngay) nhưng KHÔNG build overlay.
    buildOverlay();
    setAccessNote(false);
    // Nhãn khi không có VI: phân biệt đang dịch / lỗi dịch / video thật sự không có VI.
    const hasVi = cues.some((c) => c.vi);
    // TIP-101 — "ok" nhưng vẫn KHÔNG có câu nào dịch được (AI lỗi âm thầm, response vẫn 200)
    // → coi như "failed" để báo rõ, tránh im lặng khiến học viên tưởng đang chờ mãi không lỗi gì.
    if (!hasVi && d.viState === "translating") setViNote("Đang dịch phụ đề Việt…");
    else if (!hasVi && (d.viState === "failed" || d.viState === "ok")) setViNote("⚠️ Không dịch được phụ đề Việt lúc này");
    else if (!hasVi && d.viState === "empty") setViNote("Video này không có phụ đề Việt");
    else setViNote(null);
  } else if (!hasAccess && cues.length) {
    setAccessNote(true); // TIP-062: hết hạn nhưng video có phụ đề → nhắc nâng cấp
  }
}

async function init(): Promise<void> {
  settings = await getSettings();
  onSettingsChange((s) => {
    settings = s;
    applySettings();
  });

  window.addEventListener("message", onMessage);
  document.addEventListener("fullscreenchange", updateOverlayPosition); // TIP-023: dời ngay khi vào/ra full screen
  setInterval(syncTick, 250);
  void refreshAccess(); // TIP-062: kiểm tra quyền lúc khởi động

  // SPA: KHÔNG dựa vào yt-navigate-finish (dễ race với lúc cue tới). Thay vào đó:
  // poll location — khi đổi sang video khác thì xoá overlay stale; cue video mới
  // sẽ tới qua SM_CUES (interceptor) và dựng lại overlay.
  setInterval(() => {
    const v = locVideoId();
    if (v !== currentVid) {
      dbg("location đổi video:", v, "(đang có cue video:", currentVid, ") -> xoá overlay stale");
      currentVid = v;
      cues = [];
      removeOverlay();
      void refreshAccess(); // TIP-062: cập nhật quyền mỗi khi đổi video
    }
  }, 500);
}

void init();

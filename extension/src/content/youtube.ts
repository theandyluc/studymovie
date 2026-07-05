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

function cleanWord(raw: string): string {
  return raw.replace(/^[^A-Za-z'-]+|[^A-Za-z'-]+$/g, "").toLowerCase();
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

function mkBtn(label: string, onClick: () => void, ghost = false): HTMLButtonElement {
  const b = document.createElement("button");
  b.textContent = label;
  Object.assign(b.style, {
    border: ghost ? "1px solid #e4e4e7" : "0",
    background: ghost ? "transparent" : "#4f46e5",
    color: ghost ? "#18181b" : "#ffffff",
    borderRadius: "6px",
    padding: "6px 12px",
    fontSize: "13px",
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

  const head = document.createElement("div");
  head.style.fontWeight = "700";
  head.textContent = surface.trim() || word; // hiện NGAY, không cần request
  pop.appendChild(head);

  const sub = document.createElement("div"); // lemma + IPA (điền khi dict xong)
  sub.style.color = "#71717a";
  sub.style.fontSize = "12px";
  sub.style.display = "none";
  pop.appendChild(sub);

  const meaningBox = document.createElement("div");
  meaningBox.style.margin = "8px 0";
  meaningBox.textContent = "Đang tra nghĩa…";
  pop.appendChild(meaningBox);

  const actions = document.createElement("div"); // hàng nút: [Phát âm] Lưu Đóng
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
  });
  saveBtn.style.marginRight = "6px";
  actions.appendChild(saveBtn);
  actions.appendChild(mkBtn("Đóng", () => closeWordPopup(true), true));

  // Fire SONG SONG, KHÔNG await chung.
  void callApi<LookupResponse>("GET", `/api/lookup?word=${encodeURIComponent(word)}`)
    .then((res) => {
      dictSettled = true;
      dictStatus = res.status;
      currentResult = res.result;
      if (!alive()) return;
      const r = res.result;
      if (r && (r.lemma || r.ipa)) {
        const ipa1 = firstIpa(r.ipa); // TIP-039: chỉ 1 phiên âm
        sub.textContent = `${r.lemma ?? word}${ipa1 ? `  /${ipa1}/` : ""}`;
        sub.style.display = "";
      }
      // TIP-070 — luôn có nút Phát âm; dùng audio từ điển nếu có, else speechSynthesis.
      const speakText = r?.lemma || word;
      const audioBtn = mkBtn("🔊 Phát âm", () => playPronunciation(r?.audio_url ?? null, speakText));
      actions.insertBefore(audioBtn, saveBtn); // đứng trước "Lưu"
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

// TIP-078 — Cache phụ đề Việt DÙNG CHUNG giữa mọi user (qua backend), giảm số lần phải
// tự gọi Google (hay bị anti-bot chặn). MAIN world (yt-intercept.ts) không có chrome.runtime
// → nhờ content script ISOLATED (ở đây) relay: hỏi cache lúc cần, đóng góp lại lúc fetch được.
interface RawCueLike {
  start: number;
  dur: number;
  text: string;
}
function handleAskViCache(videoId: string, reqId: string): void {
  callApi<{ found: boolean; vi?: RawCueLike[] }>("GET", `/api/captions-vi/${videoId}`)
    .then((r) => {
      window.postMessage({ __sm: "SM_VI_CACHE_RESULT", reqId, vi: r.found ? (r.vi ?? null) : null }, "*");
    })
    .catch(() => {
      window.postMessage({ __sm: "SM_VI_CACHE_RESULT", reqId, vi: null }, "*"); // lỗi mạng/chưa login → coi như miss
    });
}
function handleContributeViCache(videoId: string, vi: RawCueLike[]): void {
  callApi("POST", `/api/captions-vi/${videoId}`, { vi }).catch(() => {
    /* lỗi thì thôi — không ảnh hưởng người dùng hiện tại, lần sau vẫn có thể đóng góp lại */
  });
}

// ---- Nhận cue từ interceptor (MAIN world) ----
function onMessage(e: MessageEvent): void {
  if (e.source !== window) return;
  const raw = e.data as
    | { __sm?: string; cues?: Cue[]; videoId?: string; viState?: string; reqId?: string; vi?: RawCueLike[] }
    | null;
  if (raw?.__sm === "SM_ASK_VI_CACHE" && raw.videoId && raw.reqId) {
    handleAskViCache(raw.videoId, raw.reqId);
    return;
  }
  if (raw?.__sm === "SM_CONTRIBUTE_VI" && raw.videoId && Array.isArray(raw.vi)) {
    handleContributeViCache(raw.videoId, raw.vi);
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
    // Nhãn khi không có VI: phân biệt bị-chặn (Sorry) vs video thật sự không có VI.
    const hasVi = cues.some((c) => c.vi);
    if (!hasVi && d.viState === "blocked") setViNote("⚠️ Phụ đề Việt tạm bị giới hạn, thử lại sau");
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

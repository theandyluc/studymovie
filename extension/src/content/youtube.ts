// TIP-005 — Content script (ISOLATED) trang watch YouTube.
// Nhận cue (EN/VI) từ interceptor MAIN-world qua window.postMessage (URL caption ĐÃ KÝ),
// dựng overlay 2 dòng (EXT-01), click-từ tra nghĩa + lưu (EXT-02), settings realtime (EXT-04).
// Mọi tương tác DOM player có guard — không throw khi YouTube đổi cấu trúc.
import { type Cue } from "../lib/captions";
import { getSettings, onSettingsChange, DEFAULT_SETTINGS, type Settings } from "../lib/settings";

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

const ID = "studymovie-overlay";
let settings: Settings = { ...DEFAULT_SETTINGS };
let cues: Cue[] = [];
let activeIndex = -1;
let popupOpen = false;
let pausedByPopup = false;
let currentVid = "";

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
  // Ẩn caption gốc YouTube khi overlay của ta đang phụ trách (có cue).
  s.toggleAttribute("disabled", !(cues.length > 0));
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
    bottom: "70px",
    textAlign: "center",
    pointerEvents: "none",
    zIndex: "60",
  } as Partial<CSSStyleDeclaration>);
  player.appendChild(box);
  activeIndex = -1;
}

function applyLineStyle(el: HTMLElement): void {
  const bg = settings.bgEnabled;
  Object.assign(el.style, {
    display: "inline-block",
    maxWidth: "92%",
    margin: "2px auto",
    padding: bg ? "2px 8px" : "2px 4px",
    borderRadius: "4px",
    fontSize: `${settings.fontSizePx}px`,
    lineHeight: "1.3",
    color: "#ffffff",
    // "Màu nền" = ĐỘ ĐẬM nền đen (rgba black, opacity %); tắt → trong suốt + textShadow cho dễ đọc.
    background: bg ? `rgba(0,0,0,${settings.bgOpacity / 100})` : "transparent",
    textShadow: bg ? "none" : "0 1px 3px rgba(0,0,0,0.9)",
    fontFamily: "Arial, sans-serif",
  } as Partial<CSSStyleDeclaration>);
}

function renderCue(idx: number): void {
  const box = document.getElementById(ID) as HTMLDivElement | null;
  if (!box) return;
  box.textContent = "";
  if (idx < 0) return;
  const cue = cues[idx];
  if (!cue) return;

  if (settings.showEn && cue.en) {
    const en = document.createElement("div");
    applyLineStyle(en);
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
    box.appendChild(en);
  }
  if (settings.showVi && cue.vi) {
    if (box.childNodes.length) box.appendChild(document.createElement("br")); // ngăn cách chỉ khi có cả EN
    const vi = document.createElement("div");
    applyLineStyle(vi);
    vi.style.opacity = "0.95";
    vi.textContent = cue.vi;
    box.appendChild(vi);
  }
}

function syncTick(): void {
  const video = getVideo();
  if (!video || !document.getElementById(ID)) return;
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

async function onWordClick(word: string, surface: string, sentence: string): Promise<void> {
  if (!word) return;
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
  pop.textContent = "Đang tra…";
  player.appendChild(pop);

  let res: LookupResponse;
  try {
    res = await callApi<LookupResponse>("GET", `/api/lookup?word=${encodeURIComponent(word)}`);
  } catch (e) {
    pop.textContent = `Lỗi tra nghĩa: ${e instanceof Error ? e.message : String(e)}`;
    return;
  }
  const result = res.result;

  pop.textContent = "";
  const head = document.createElement("div");
  head.style.fontWeight = "700";
  head.textContent = surface.trim() || word;
  pop.appendChild(head);

  if (result) {
    if (result.source === "free_dict") {
      const tag = document.createElement("div");
      tag.textContent = "📖 định nghĩa tiếng Anh";
      tag.style.cssText = "font-size:11px;color:#4f46e5;margin-top:2px;";
      pop.appendChild(tag);
    }
    const sub = document.createElement("div");
    sub.style.color = "#71717a";
    sub.style.fontSize = "12px";
    sub.textContent = `${result.lemma}${result.ipa ? `  /${result.ipa}/` : ""}`;
    pop.appendChild(sub);

    const senses = result.meanings ?? [];
    const list = document.createElement("div");
    list.style.margin = "8px 0";
    if (senses.length) {
      for (const s of senses.slice(0, 4)) {
        const line = document.createElement("div");
        line.textContent = `• ${s.pos ? `(${s.pos}) ` : ""}${s.sense ?? ""}`;
        list.appendChild(line);
      }
    } else {
      list.textContent = "Không tìm thấy nghĩa trong từ điển.";
    }
    pop.appendChild(list);

    if (result.audio_url) {
      const audioUrl = result.audio_url;
      pop.appendChild(
        mkBtn("🔊 Phát âm", () => {
          try {
            void new Audio(audioUrl).play();
          } catch {
            /* ignore */
          }
        })
      );
    }
  } else {
    const none = document.createElement("div");
    none.style.margin = "8px 0";
    none.textContent = res.status === "error" ? "Lỗi tra cứu, thử lại sau." : "Không tìm thấy nghĩa.";
    pop.appendChild(none);
  }

  const saveBtn = mkBtn("Lưu", async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = "Đang lưu…";
    try {
      const r = await callApi<{ saved: boolean; duplicate: boolean }>("POST", "/api/vocabulary", {
        word,
        lemma: result?.lemma ?? word,
        ipa: result?.ipa ?? null,
        meaning_vi: meaningSummary(result),
        example: sentence,
        audio_url: result?.audio_url ?? null,
      });
      saveBtn.textContent = r.duplicate ? "Đã lưu trước đó ✓" : "Đã lưu ✓";
    } catch (e) {
      saveBtn.textContent = `Lỗi: ${e instanceof Error ? e.message : "không lưu được"}`;
      saveBtn.disabled = false;
    }
  });
  saveBtn.style.marginRight = "6px";
  pop.appendChild(saveBtn);
  pop.appendChild(mkBtn("Đóng", () => closeWordPopup(true), true));
}

// Click ra ngoài popup -> đóng + chạy tiếp.
document.addEventListener("click", () => {
  if (popupOpen) closeWordPopup(true);
});

// ---- Áp dụng settings realtime (TIP-015: cài đặt từ popup qua chrome.storage) ----
// Cài đặt phụ đề giờ nằm ở POPUP extension (gỡ panel gear trong player của TIP-005).
function applySettings(): void {
  ensureHideNativeStyle();
  if (!cues.length) {
    removeOverlay();
    return;
  }
  buildOverlay();
  // Áp NGAY lên cue đang hiển thị (đổi cỡ chữ/nền/ẩn-hiện EN-VI không cần reload).
  if (activeIndex >= 0) renderCue(activeIndex);
}

// ---- Nhận cue từ interceptor (MAIN world) ----
function onMessage(e: MessageEvent): void {
  if (e.source !== window) return;
  const d = e.data as { __sm?: string; cues?: Cue[]; videoId?: string; viState?: string } | null;
  if (d?.__sm !== "SM_CUES" || !Array.isArray(d.cues)) return;
  dbg("nhận cue", d.cues.length, "video=", d.videoId, "viState=", d.viState);
  cues = d.cues;
  currentVid = d.videoId ?? locVideoId();
  activeIndex = -1;
  ensureHideNativeStyle();
  removeOverlay(); // dựng lại để gắn vào #movie_player hiện tại (YouTube có thể thay DOM player)
  if (cues.length) {
    buildOverlay();
    // Nhãn khi không có VI: phân biệt bị-chặn (Sorry) vs video thật sự không có VI.
    const hasVi = cues.some((c) => c.vi);
    if (!hasVi && d.viState === "blocked") setViNote("⚠️ Phụ đề Việt tạm bị giới hạn, thử lại sau");
    else if (!hasVi && d.viState === "empty") setViNote("Video này không có phụ đề Việt");
    else setViNote(null);
  }
}

async function init(): Promise<void> {
  settings = await getSettings();
  onSettingsChange((s) => {
    settings = s;
    applySettings();
  });

  window.addEventListener("message", onMessage);
  setInterval(syncTick, 250);

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
    }
  }, 500);
}

void init();

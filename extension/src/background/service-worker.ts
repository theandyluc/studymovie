// TIP-004 — Background: nhận session từ content auth-bridge (shared session), lưu chrome.storage.
// TIP-005 — Proxy API cho content script: content (origin youtube.com, bị CORS chặn) gửi
//   SM_API → background gọi apiExt (origin chrome-extension, được CORS) → trả kết quả.
//   Giữ CORS backend CHẶT (không mở cho youtube.com).
// TIP-014 — Timer THỦ CÔNG Start/Stop. State ở background + chrome.storage (bền khi popup đóng).
//   Flush định kỳ (alarm) khi đang chạy → POST /api/study-session (cộng HẾT). Tắt Chrome đột
//   ngột → onStartup finalize (KHÔNG đếm thời gian Chrome đóng).
import { supabaseExt, EXT_STORAGE_KEY } from "../lib/supabaseExt";
import { apiExt } from "../lib/apiExt";

console.log("[StudyMovie] service worker initialized");

// ── Timer (TIP-014) ──────────────────────────────────────────────────────────
const TIMER_KEY = "sm-timer-state";
const FLUSH_ALARM = "sm-timer-flush";
const FLUSH_PERIOD_MIN = 0.5; // ~30s: chống mất dữ liệu khi tắt Chrome
const MAX_FLUSH_SEC = 86400; // cap an toàn 1 ngày (backend cũng validate)

interface TimerState {
  running: boolean;
  sessionStartedAt: number; // epoch ms khi bắt đầu ĐOẠN chạy hiện tại
  accumulatedSec: number; // TIP-051: giây đã tích ở các đoạn chạy TRƯỚC (chưa tính đoạn đang chạy)
  flushedSec: number; // số giây đã gửi backend trong phiên hiện tại
}
const EMPTY: TimerState = { running: false, sessionStartedAt: 0, accumulatedSec: 0, flushedSec: 0 };

async function getTimer(): Promise<TimerState> {
  const r = await chrome.storage.local.get(TIMER_KEY);
  return { ...EMPTY, ...((r[TIMER_KEY] as Partial<TimerState> | undefined) ?? {}) };
}
async function setTimer(s: TimerState): Promise<void> {
  await chrome.storage.local.set({ [TIMER_KEY]: s });
}
function elapsedSec(s: TimerState): number {
  return s.accumulatedSec + (s.running ? Math.max(0, Math.floor((Date.now() - s.sessionStartedAt) / 1000)) : 0);
}
function publicState(s: TimerState): { running: boolean; paused: boolean; elapsedSec: number } {
  const e = elapsedSec(s);
  return { running: s.running, paused: !s.running && e > 0, elapsedSec: e };
}

// TIP-051: dùng cho CẢ "Bắt đầu" lẫn "Tiếp tục" — EMPTY→start mới; paused→GIỮ accumulated/flushed (resume).
async function startTimer(): Promise<TimerState> {
  const s = await getTimer();
  if (s.running) return s; // idempotent
  const next: TimerState = {
    running: true,
    sessionStartedAt: Date.now(),
    accumulatedSec: s.accumulatedSec,
    flushedSec: s.flushedSec,
  };
  await setTimer(next);
  await chrome.alarms.create(FLUSH_ALARM, { periodInMinutes: FLUSH_PERIOD_MIN });
  return next;
}

// TIP-051: Tạm dừng — chốt đoạn đang chạy vào accumulatedSec, flush phần chưa gửi, dừng alarm.
async function pauseTimer(): Promise<TimerState> {
  const s = await getTimer();
  if (!s.running) return s;
  const seg = Math.max(0, Math.floor((Date.now() - s.sessionStartedAt) / 1000));
  await setTimer({ running: false, sessionStartedAt: 0, accumulatedSec: s.accumulatedSec + seg, flushedSec: s.flushedSec });
  await chrome.alarms.clear(FLUSH_ALARM); // TIP-051b: clear TRƯỚC flush (bớt cửa sổ race)
  await flushTimer();
  return getTimer();
}

// TIP-051b — SERIALIZE flush: alarm (mỗi ~30s) có thể fire xen giữa lúc pause/stop đang await POST →
// 2 flush chồng nhau, cùng delta → backend cộng ĐÔI. Xâu chuỗi để flush chạy tuần tự.
let flushChain: Promise<void> = Promise.resolve();
function flushTimer(): Promise<void> {
  const run = flushChain.then(() => doFlush());
  flushChain = run.catch(() => undefined); // giữ chuỗi chạy tiếp dù 1 flush lỗi
  return run;
}

// Gửi phần CHƯA flush (total - flushedSec). Đúng cho cả running lẫn paused.
async function doFlush(): Promise<void> {
  const s = await getTimer();
  const total = elapsedSec(s);
  const delta = total - s.flushedSec;
  if (delta <= 0) {
    if (!s.running) await chrome.alarms.clear(FLUSH_ALARM); // self-heal alarm mồ côi khi đã dừng/pause
    return;
  }
  const duration_sec = Math.min(delta, MAX_FLUSH_SEC);
  try {
    await apiExt("/api/study-session", {
      method: "POST",
      body: JSON.stringify({ duration_sec }),
    });
    // ĐỌC LẠI: tránh đè state mới (pause/stop vừa đổi accumulated/running); CHỈ tăng flushedSec.
    const cur = await getTimer();
    await setTimer({ ...cur, flushedSec: cur.flushedSec + duration_sec });
  } catch (e) {
    console.warn("[StudyMovie] flush timer lỗi (sẽ gửi lại lần sau):", e);
  }
}

async function stopTimer(): Promise<TimerState> {
  await chrome.alarms.clear(FLUSH_ALARM); // TIP-051b: clear TRƯỚC flush (bớt cửa sổ race)
  await flushTimer(); // chốt phần còn lại (accumulated đúng nhờ elapsedSec)
  await setTimer({ ...EMPTY });
  return { ...EMPTY };
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === FLUSH_ALARM) void flushTimer();
});

// Tắt Chrome đột ngột rồi mở lại: nếu còn running → coi phiên kết thúc ở flush cuối.
// KHÔNG cộng thời gian Chrome đóng (đặt running=false).
chrome.runtime.onStartup.addListener(() => {
  void (async () => {
    const s = await getTimer();
    if (s.running) {
      await setTimer({ ...EMPTY });
      await chrome.alarms.clear(FLUSH_ALARM);
    }
  })();
});

// SW thức dậy (idle-wake / reload extension) mà đang chạy → đảm bảo alarm còn (alarm bị xóa khi reload extension).
void (async () => {
  const s = await getTimer();
  if (s.running) await chrome.alarms.create(FLUSH_ALARM, { periodInMinutes: FLUSH_PERIOD_MIN });
})();

// ── Messaging ─────────────────────────────────────────────────────────────────
type SmSession = { access_token?: string; refresh_token?: string } | null;
interface SmMessage {
  type?: string;
  session?: SmSession;
  method?: string;
  path?: string;
  body?: unknown;
}

chrome.runtime.onMessage.addListener((msg: SmMessage, _sender, sendResponse) => {
  if (msg?.type === "SM_AUTH") {
    void applyAuth(msg.session ?? null);
    return; // không trả lời
  }
  if (msg?.type === "SM_LOGOUT") {
    void handleLogout(); // TIP-044: dọn ext + báo các tab web logout
    return;
  }
  if (msg?.type === "SM_PULL_SESSION") {
    // TIP-047: content web hỏi session ext (khi web trống) → trả raw session (hoặc null).
    void chrome.storage.local
      .get(EXT_STORAGE_KEY)
      .then((r) => sendResponse({ raw: (r[EXT_STORAGE_KEY] as string | undefined) ?? null }));
    return true; // trả lời bất đồng bộ
  }
  if (msg?.type === "SM_LOGIN") {
    void handleLogin(); // TIP-047: ext vừa login → đẩy session sang các tab web
    return;
  }
  if (msg?.type === "SM_API" && msg.path) {
    void handleApi(msg, sendResponse);
    return true; // trả lời bất đồng bộ
  }
  if (msg?.type === "SM_TIMER_START") {
    void startTimer().then((s) => sendResponse(publicState(s)));
    return true;
  }
  if (msg?.type === "SM_TIMER_PAUSE") {
    void pauseTimer().then((s) => sendResponse(publicState(s))); // TIP-051
    return true;
  }
  if (msg?.type === "SM_TIMER_STOP") {
    void stopTimer().then((s) => sendResponse(publicState(s)));
    return true;
  }
  if (msg?.type === "SM_TIMER_STATE") {
    void getTimer().then((s) => sendResponse(publicState(s)));
    return true;
  }
  return;
});

async function handleApi(msg: SmMessage, sendResponse: (r: unknown) => void): Promise<void> {
  try {
    const init: RequestInit = { method: msg.method ?? "GET" };
    if (msg.body !== undefined) init.body = JSON.stringify(msg.body);
    const data = await apiExt(msg.path as string, init);
    sendResponse({ ok: true, data });
  } catch (e) {
    sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}

// TIP-044 — Đồng bộ logout ext→web: đảm bảo ext sạch + gửi SM_LOGOUT tới mọi tab web
// (SITE_URL + localhost dev) để auth-bridge dọn localStorage web + reload về màn login.
async function handleLogout(): Promise<void> {
  await applyAuth(null); // signOut đã chạy ở popup; gọi lại cho chắc ext sạch
  // TIP-044b: gửi tới MỌI tab (không lọc theo SITE_URL — bản dev SITE_URL=localhost sẽ bỏ sót
  // tab app.studymovie.com). auth-bridge chỉ chạy ở tab web (theo manifest) nên chỉ tab web xử lý.
  try {
    const tabs = await chrome.tabs.query({});
    for (const t of tabs) {
      if (t.id != null) chrome.tabs.sendMessage(t.id, { type: "SM_LOGOUT" }).catch(() => {});
    }
  } catch (e) {
    console.warn("[StudyMovie] logout propagate lỗi:", e);
  }
}

// TIP-047 — ext vừa login → đọc raw session ở chrome.storage + gửi SM_SET_SESSION tới MỌI tab
// (chỉ tab web có auth-bridge sẽ nhận & set localStorage + reload → web tự đăng nhập theo).
async function handleLogin(): Promise<void> {
  const r = await chrome.storage.local.get(EXT_STORAGE_KEY);
  const raw = (r[EXT_STORAGE_KEY] as string | undefined) ?? null;
  if (!raw) return;
  try {
    const tabs = await chrome.tabs.query({});
    for (const t of tabs) {
      if (t.id != null) chrome.tabs.sendMessage(t.id, { type: "SM_SET_SESSION", raw }).catch(() => {});
    }
  } catch (e) {
    console.warn("[StudyMovie] login propagate lỗi:", e);
  }
}

async function applyAuth(session: SmSession): Promise<void> {
  try {
    if (session?.access_token && session?.refresh_token) {
      await supabaseExt.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
    } else {
      await supabaseExt.auth.signOut();
    }
  } catch (e) {
    console.warn("[StudyMovie] applyAuth lỗi:", e);
  }
}

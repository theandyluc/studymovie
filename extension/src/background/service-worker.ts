// TIP-004 — Background: nhận session từ content auth-bridge (shared session), lưu chrome.storage.
// TIP-005 — Proxy API cho content script: content (origin youtube.com, bị CORS chặn) gửi
//   SM_API → background gọi apiExt (origin chrome-extension, được CORS) → trả kết quả.
//   Giữ CORS backend CHẶT (không mở cho youtube.com).
// TIP-014 — Timer THỦ CÔNG Start/Stop. State ở background + chrome.storage (bền khi popup đóng).
//   Flush định kỳ (alarm) khi đang chạy → POST /api/study-session (cộng HẾT). Tắt Chrome đột
//   ngột → onStartup finalize (KHÔNG đếm thời gian Chrome đóng).
import { supabaseExt } from "../lib/supabaseExt";
import { apiExt } from "../lib/apiExt";
import { SITE_URL } from "../lib/env";

console.log("[StudyMovie] service worker initialized");

// ── Timer (TIP-014) ──────────────────────────────────────────────────────────
const TIMER_KEY = "sm-timer-state";
const FLUSH_ALARM = "sm-timer-flush";
const FLUSH_PERIOD_MIN = 0.5; // ~30s: chống mất dữ liệu khi tắt Chrome
const MAX_FLUSH_SEC = 86400; // cap an toàn 1 ngày (backend cũng validate)

interface TimerState {
  running: boolean;
  sessionStartedAt: number; // epoch ms khi bấm Bắt đầu (cho hiển thị đếm lên)
  flushedSec: number; // số giây đã gửi backend trong phiên hiện tại
}
const EMPTY: TimerState = { running: false, sessionStartedAt: 0, flushedSec: 0 };

async function getTimer(): Promise<TimerState> {
  const r = await chrome.storage.local.get(TIMER_KEY);
  return { ...EMPTY, ...((r[TIMER_KEY] as Partial<TimerState> | undefined) ?? {}) };
}
async function setTimer(s: TimerState): Promise<void> {
  await chrome.storage.local.set({ [TIMER_KEY]: s });
}
function elapsedSec(s: TimerState): number {
  return s.running ? Math.max(0, Math.floor((Date.now() - s.sessionStartedAt) / 1000)) : 0;
}
function publicState(s: TimerState): { running: boolean; elapsedSec: number } {
  return { running: s.running, elapsedSec: elapsedSec(s) };
}

async function startTimer(): Promise<TimerState> {
  const s = await getTimer();
  if (s.running) return s; // idempotent
  const next: TimerState = { running: true, sessionStartedAt: Date.now(), flushedSec: 0 };
  await setTimer(next);
  await chrome.alarms.create(FLUSH_ALARM, { periodInMinutes: FLUSH_PERIOD_MIN });
  return next;
}

// Gửi phần CHƯA flush của phiên (total - flushedSec). Lỗi → giữ nguyên flushedSec (gửi lại sau).
async function flushTimer(): Promise<void> {
  const s = await getTimer();
  if (!s.running) {
    await chrome.alarms.clear(FLUSH_ALARM); // self-heal alarm mồ côi
    return;
  }
  const total = Math.floor((Date.now() - s.sessionStartedAt) / 1000);
  const delta = total - s.flushedSec;
  if (delta <= 0) return;
  const duration_sec = Math.min(delta, MAX_FLUSH_SEC);
  try {
    await apiExt("/api/study-session", {
      method: "POST",
      body: JSON.stringify({ duration_sec }),
    });
    s.flushedSec += duration_sec;
    await setTimer(s);
  } catch (e) {
    console.warn("[StudyMovie] flush timer lỗi (sẽ gửi lại lần sau):", e);
  }
}

async function stopTimer(): Promise<TimerState> {
  await flushTimer(); // chốt phần còn lại
  await setTimer({ ...EMPTY });
  await chrome.alarms.clear(FLUSH_ALARM);
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
  if (msg?.type === "SM_API" && msg.path) {
    void handleApi(msg, sendResponse);
    return true; // trả lời bất đồng bộ
  }
  if (msg?.type === "SM_TIMER_START") {
    void startTimer().then((s) => sendResponse(publicState(s)));
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
  const patterns = [`${SITE_URL}/*`, "http://localhost:3000/*"];
  try {
    const tabs = await chrome.tabs.query({ url: patterns });
    for (const t of tabs) {
      if (t.id != null) chrome.tabs.sendMessage(t.id, { type: "SM_LOGOUT" }).catch(() => {});
    }
  } catch (e) {
    console.warn("[StudyMovie] logout propagate lỗi:", e);
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

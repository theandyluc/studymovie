// TIP-004 — Auth bridge: chạy trên domain web (NEXT_PUBLIC_SITE_URL), đọc Supabase
// session từ localStorage của web (key `sb-<ref>-auth-token`) rồi gửi về background.
// Poll vì thay đổi localStorage trong CÙNG tab không phát sự kiện 'storage'.
import { SUPABASE_REF } from "../lib/env";

const KEY = `sb-${SUPABASE_REF}-auth-token`;
let last = "";

function extractSession(raw: string | null): unknown {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed && typeof parsed.access_token === "string") return parsed;
    const wrapped = (parsed as { currentSession?: unknown }).currentSession;
    return wrapped ?? null;
  } catch {
    return null;
  }
}

// D-01 — Khi extension bị reload/update, context cũ vô hiệu → chrome.runtime.sendMessage()
// NÉM LỖI ĐỒNG BỘ (không phải promise-reject) → .catch() không bắt được → văng uncaught lặp mãi.
// Fix: phát hiện context chết (chrome.runtime?.id undefined) → stop() poll; bọc sendMessage try/catch đồng bộ.
let timer: ReturnType<typeof setInterval> | null = null;

function contextAlive(): boolean {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

function stop(): void {
  if (timer != null) {
    clearInterval(timer);
    timer = null;
  }
  window.removeEventListener("storage", sync);
}

function sync(): void {
  if (!contextAlive()) {
    stop(); // context invalidated (extension reload) → ngừng poll; refresh tab sẽ nạp bridge mới
    return;
  }
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return;
  }
  if (raw === last) return;
  last = raw ?? "";
  try {
    chrome.runtime.sendMessage({ type: "SM_AUTH", session: extractSession(raw) }).catch(() => {
      /* background có thể đang ngủ; lần poll sau sẽ gửi lại */
    });
  } catch {
    stop(); // sendMessage ném đồng bộ (context invalidated) → ngừng, tránh văng uncaught
  }
}

sync();
timer = setInterval(sync, 1000);
window.addEventListener("storage", sync);

// TIP-044 — nhận lệnh logout từ extension (popup → background) → dọn session web + reload về login.
chrome.runtime.onMessage.addListener((msg: { type?: string }) => {
  if (msg?.type === "SM_LOGOUT") {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    last = "";
    location.reload();
  }
});

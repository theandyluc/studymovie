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
  // TIP-047 — CHỈ gửi khi web CÓ session; web trống KHÔNG đè/đăng xuất extension (logout dùng SM_LOGOUT).
  if (!raw) return;
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

// TIP-044/047 — nhận lệnh từ extension: logout (dọn session web) hoặc set-session (ext login → đẩy sang web).
// Chốt chặn LOOP reload bằng sessionStorage "sm-synced" (mỗi phiên tab chỉ pull/set + reload 1 lần).
chrome.runtime.onMessage.addListener((msg: { type?: string; raw?: string }) => {
  if (msg?.type === "SM_LOGOUT") {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    last = "";
    location.reload();
  } else if (msg?.type === "SM_SET_SESSION" && msg.raw) {
    try {
      sessionStorage.setItem("sm-synced", "1");
      window.localStorage.setItem(KEY, msg.raw);
    } catch {
      /* ignore */
    }
    location.reload();
  }
});

// TIP-047 — Khi tab web tải mà CHƯA có session + chưa đồng bộ phiên này → kéo session từ extension (nếu có).
(() => {
  let empty: boolean;
  try {
    empty = !window.localStorage.getItem(KEY) && !sessionStorage.getItem("sm-synced");
  } catch {
    return;
  }
  if (!empty || !contextAlive()) return;
  try {
    chrome.runtime
      .sendMessage({ type: "SM_PULL_SESSION" })
      .then((resp: { raw?: string | null } | undefined) => {
        if (!resp?.raw) return;
        try {
          sessionStorage.setItem("sm-synced", "1"); // chỉ pull + reload 1 lần/phiên tab
          window.localStorage.setItem(KEY, resp.raw);
        } catch {
          return;
        }
        location.reload();
      })
      .catch(() => {});
  } catch {
    /* context chết */
  }
})();

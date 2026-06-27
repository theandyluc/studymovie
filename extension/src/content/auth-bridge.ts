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

function sync(): void {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return;
  }
  if (raw === last) return;
  last = raw ?? "";
  chrome.runtime.sendMessage({ type: "SM_AUTH", session: extractSession(raw) }).catch(() => {
    /* background có thể đang ngủ; lần poll sau sẽ gửi lại */
  });
}

sync();
setInterval(sync, 1000);
window.addEventListener("storage", sync);

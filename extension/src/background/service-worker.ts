// TIP-004 — Background: nhận session từ content auth-bridge (shared session), lưu chrome.storage.
// TIP-005 — Proxy API cho content script: content (origin youtube.com, bị CORS chặn) gửi
//   SM_API → background gọi apiExt (origin chrome-extension, được CORS) → trả kết quả.
//   Giữ CORS backend CHẶT (không mở cho youtube.com).
import { supabaseExt } from "../lib/supabaseExt";
import { apiExt } from "../lib/apiExt";

console.log("[StudyMovie] service worker initialized");

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
  if (msg?.type === "SM_API" && msg.path) {
    void handleApi(msg, sendResponse);
    return true; // trả lời bất đồng bộ
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

// TIP-004 — Background: nhận session từ content auth-bridge (shared session với web),
// lưu vào chrome.storage qua supabaseExt (setSession) + để autoRefreshToken tự gia hạn.
import { supabaseExt } from "../lib/supabaseExt";

console.log("[StudyMovie] service worker initialized");

type SmSession = { access_token?: string; refresh_token?: string } | null;
type SmMessage = { type?: string; session?: SmSession };

chrome.runtime.onMessage.addListener((msg: SmMessage) => {
  if (msg?.type === "SM_AUTH") {
    void applyAuth(msg.session ?? null);
  }
});

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

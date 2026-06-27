// TIP-004 — Popup: EXT-05 (avatar+tên) + EXT-06 (login + trạng thái sub) + EXT-07 (nâng cấp khi hết hạn).
import { supabaseExt, EXT_STORAGE_KEY } from "../lib/supabaseExt";
import { apiExt } from "../lib/apiExt";
import { SITE_URL } from "../lib/env";

type Me = {
  user: { id: string; email: string | null };
  profile: { nickname: string | null; avatar_url: string | null } | null;
  subscription: { status: "trial" | "active" | "expired"; trial_ends_at: string | null; paid_until: string | null } | null;
  is_active: boolean;
};

const app = document.getElementById("app");

function clear(): void {
  if (app) app.textContent = "";
}
function mount(...nodes: Node[]): void {
  if (!app) return;
  clear();
  for (const n of nodes) app.appendChild(n);
}
function div(cls: string, text?: string): HTMLDivElement {
  const d = document.createElement("div");
  d.className = cls;
  if (text != null) d.textContent = text;
  return d;
}
function button(label: string, onClick: () => void, cls = "btn"): HTMLButtonElement {
  const b = document.createElement("button");
  b.className = cls;
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}
function openTab(url: string): void {
  void chrome.tabs.create({ url });
}

function subStatusText(me: Me): { text: string; expired: boolean } {
  const s = me.subscription;
  if (me.is_active && s?.status === "trial" && s.trial_ends_at) {
    const hrs = Math.max(0, Math.ceil((new Date(s.trial_ends_at).getTime() - Date.now()) / 3_600_000));
    return { text: `Dùng thử: còn ${hrs} giờ`, expired: false };
  }
  if (me.is_active && s?.status === "active" && s.paid_until) {
    return { text: `Đã kích hoạt đến ${new Date(s.paid_until).toLocaleDateString("vi-VN")}`, expired: false };
  }
  return { text: "Đã hết hạn", expired: true };
}

function renderLogin(): void {
  mount(
    div("title", "StudyMovie"),
    div("muted", "Đăng nhập để đồng bộ tài khoản với web."),
    button("Đăng nhập với Google", () => openTab(SITE_URL))
  );
}

function renderUser(me: Me): void {
  const name = me.profile?.nickname ?? me.user.email ?? "Người dùng";
  const avatarUrl = me.profile?.avatar_url ?? null;

  const avatar = avatarUrl ? (() => {
    const img = document.createElement("img");
    img.className = "avatar";
    img.src = avatarUrl;
    img.alt = name;
    img.referrerPolicy = "no-referrer";
    return img as HTMLElement;
  })() : (() => {
    const sp = document.createElement("span");
    sp.className = "avatar";
    sp.textContent = (name.trim().charAt(0) || "?").toUpperCase();
    return sp as HTMLElement;
  })();

  // Khối avatar+email click được → mở Dashboard trên web.
  const row = div("row clickable");
  row.setAttribute("role", "button");
  row.title = "Mở Dashboard";
  row.addEventListener("click", () => openTab(`${SITE_URL}/dashboard`));
  row.appendChild(avatar);
  const info = div("");
  info.appendChild(div("email", me.user.email ?? name));
  row.appendChild(info);

  const sub = subStatusText(me);
  const statusBox = div(`status${sub.expired ? " expired" : ""}`, sub.text);

  const nodes: Node[] = [div("title", "StudyMovie"), row, statusBox];
  if (!me.is_active) {
    nodes.push(button("Nâng cấp", () => openTab(`${SITE_URL}/upgrade`)));
  }
  nodes.push(
    button("Đăng xuất", async () => {
      await supabaseExt.auth.signOut();
      renderLogin();
    }, "btn ghost")
  );
  mount(...nodes);
}

async function render(): Promise<void> {
  const { data } = await supabaseExt.auth.getSession();
  if (!data.session) {
    renderLogin();
    return;
  }
  mount(div("title", "StudyMovie"), div("muted", "Đang tải tài khoản…"));
  try {
    const me = await apiExt<Me>("/api/me");
    renderUser(me);
  } catch (e) {
    mount(
      div("title", "StudyMovie"),
      div("muted", `Không tải được tài khoản: ${e instanceof Error ? e.message : String(e)}`),
      button("Thử lại", () => void render(), "btn ghost")
    );
  }
}

// Tự cập nhật khi bridge truyền session về (lúc popup đang mở).
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[EXT_STORAGE_KEY]) void render();
});

void render();

// TIP-004 — Popup: EXT-05 (avatar+tên) + EXT-06 (login + trạng thái sub) + EXT-07 (nâng cấp khi hết hạn).
import { supabaseExt, EXT_STORAGE_KEY } from "../lib/supabaseExt";
import { apiExt } from "../lib/apiExt";
import { SITE_URL } from "../lib/env";
import {
  getSettings,
  setSettings,
  clampFont,
  FONT_MIN,
  FONT_MAX,
  FONT_STEP,
  type Settings,
} from "../lib/settings";

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

// ── Timer (TIP-014) ─────────────────────────────────────────────────────────
type TimerState = { running: boolean; elapsedSec: number };
let tickHandle: ReturnType<typeof setInterval> | null = null;

function clearTick(): void {
  if (tickHandle != null) {
    clearInterval(tickHandle);
    tickHandle = null;
  }
}
function fmtHMS(total: number): string {
  const t = Math.max(0, total);
  const p = (n: number): string => String(n).padStart(2, "0");
  return `${p(Math.floor(t / 3600))}:${p(Math.floor((t % 3600) / 60))}:${p(t % 60)}`;
}
// Hỏi/đổi state timer ở background (state bền ở đó, không ở popup).
function timerMsg(type: string): Promise<TimerState> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type }, (resp: TimerState | undefined) => {
        if (chrome.runtime.lastError || !resp) resolve({ running: false, elapsedSec: 0 });
        else resolve(resp);
      });
    } catch {
      resolve({ running: false, elapsedSec: 0 });
    }
  });
}

// Card timer: hiển thị HH:MM:SS đếm lên (state lấy từ background), nút Bắt đầu/Kết thúc.
function buildTimerCard(onStopped: () => void): HTMLElement {
  const card = div("timer");
  const label = div("timer-label", "Thời gian học");
  const time = div("timer-time", "00:00:00");
  const controls = div("timer-controls");
  const startBtn = button("▶ Bắt đầu", () => void onStart(), "btn timer-btn");
  const stopBtn = button("■ Kết thúc", () => void onStop(), "btn ghost timer-btn");
  controls.appendChild(startBtn);
  controls.appendChild(stopBtn);
  card.appendChild(label);
  card.appendChild(time);
  card.appendChild(controls);

  let elapsed = 0;
  let running = false;

  const paint = (): void => {
    time.textContent = fmtHMS(elapsed);
    startBtn.disabled = running;
    stopBtn.disabled = !running;
  };
  const startTick = (): void => {
    clearTick();
    tickHandle = setInterval(() => {
      if (running) {
        elapsed += 1;
        time.textContent = fmtHMS(elapsed);
      }
    }, 1000);
  };
  async function onStart(): Promise<void> {
    const s = await timerMsg("SM_TIMER_START");
    running = s.running;
    elapsed = s.elapsedSec;
    paint();
    if (running) startTick();
  }
  async function onStop(): Promise<void> {
    clearTick();
    const s = await timerMsg("SM_TIMER_STOP");
    running = s.running;
    elapsed = s.elapsedSec;
    paint();
    onStopped(); // ghi nhận xong → cập nhật "phút hôm nay"
  }

  // Khởi tạo từ background (popup mở lại vẫn đúng thời gian đã trôi — AC-3).
  void timerMsg("SM_TIMER_STATE").then((s) => {
    running = s.running;
    elapsed = s.elapsedSec;
    paint();
    if (running) startTick();
  });

  return card;
}

// ── Cài đặt phụ đề (TIP-015) ──────────────────────────────────────────────────
// Mỗi thay đổi ghi ngay chrome.storage (setSettings) → content script áp realtime.
function switchRow(label: string, checked: boolean, onChange: (v: boolean) => void): HTMLElement {
  const r = div("set-row");
  r.appendChild(div("set-label", label));
  const sw = document.createElement("label");
  sw.className = "switch";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  input.addEventListener("change", () => onChange(input.checked));
  const slider = document.createElement("span");
  slider.className = "switch-slider";
  sw.appendChild(input);
  sw.appendChild(slider);
  r.appendChild(sw);
  return r;
}

function buildSettingsCard(): HTMLElement {
  const card = div("settings");
  card.appendChild(div("set-title", "Cài đặt"));

  void getSettings().then((s: Settings) => {
    let bgEnabled = s.bgEnabled;
    let bgOpacity = s.bgOpacity;
    let fontSize = clampFont(s.fontSizePx);

    // 1 & 2 — toggle EN / VI
    card.appendChild(switchRow("🇬🇧 Phụ đề Tiếng Anh", s.showEn, (v) => void setSettings({ showEn: v })));
    card.appendChild(switchRow("🇻🇳 Phụ đề Tiếng Việt", s.showVi, (v) => void setSettings({ showVi: v })));

    // 3 — Màu nền (toggle) + độ đậm nền đen %
    const opLabel = div("set-val", `${bgOpacity}%`);
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0";
    slider.max = "100";
    slider.step = "5";
    slider.value = String(bgOpacity);
    slider.className = "set-slider";
    const syncBg = (): void => {
      slider.disabled = !bgEnabled;
      opLabel.style.opacity = bgEnabled ? "1" : "0.4";
    };
    slider.addEventListener("input", () => {
      bgOpacity = Number(slider.value);
      opLabel.textContent = `${bgOpacity}%`;
      void setSettings({ bgOpacity });
    });
    card.appendChild(
      switchRow("Màu nền phụ đề", bgEnabled, (v) => {
        bgEnabled = v;
        syncBg();
        void setSettings({ bgEnabled: v });
      })
    );
    const opRow = div("set-row");
    opRow.appendChild(slider);
    opRow.appendChild(opLabel);
    card.appendChild(opRow);
    syncBg();

    // 4 — Kích thước phụ đề: − [Npx] + (12..32, bước 2)
    const sizeRow = div("set-row");
    sizeRow.appendChild(div("set-label", "Kích thước phụ đề"));
    const stepper = div("stepper");
    const minus = document.createElement("button");
    minus.className = "step-btn";
    minus.textContent = "−";
    const val = div("set-val");
    const plus = document.createElement("button");
    plus.className = "step-btn";
    plus.textContent = "+";
    const paintSize = (): void => {
      val.textContent = `${fontSize}px`;
      minus.disabled = fontSize <= FONT_MIN;
      plus.disabled = fontSize >= FONT_MAX;
    };
    minus.addEventListener("click", () => {
      fontSize = clampFont(fontSize - FONT_STEP);
      paintSize();
      void setSettings({ fontSizePx: fontSize });
    });
    plus.addEventListener("click", () => {
      fontSize = clampFont(fontSize + FONT_STEP);
      paintSize();
      void setSettings({ fontSizePx: fontSize });
    });
    stepper.appendChild(minus);
    stepper.appendChild(val);
    stepper.appendChild(plus);
    sizeRow.appendChild(stepper);
    card.appendChild(sizeRow);
    paintSize();
  });

  return card;
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

  // Phút học hôm nay — cập nhật bất đồng bộ từ /api/dashboard (refresh lại sau khi Kết thúc).
  const minutesBox = div("status", "Hôm nay: … phút");
  const refreshMinutes = (): void => {
    void apiExt<{ today_minutes?: number }>("/api/dashboard")
      .then((d) => {
        minutesBox.textContent = `Hôm nay: ${d.today_minutes ?? 0} phút`;
      })
      .catch(() => {
        minutesBox.textContent = "Hôm nay: — phút";
      });
  };
  refreshMinutes();

  // Timer thủ công (TIP-014): "Thời gian học" HH:MM:SS + Bắt đầu/Kết thúc. State ở background.
  const timerCard = buildTimerCard(refreshMinutes);
  // Cài đặt phụ đề (TIP-015): EN/VI toggle, độ đậm nền, cỡ chữ — áp realtime qua chrome.storage.
  const settingsCard = buildSettingsCard();

  const nodes: Node[] = [div("title", "StudyMovie"), row, timerCard, minutesBox, settingsCard, statusBox];
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
  clearTick(); // huỷ tick cũ trước khi vẽ lại (tránh interval mồ côi)
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

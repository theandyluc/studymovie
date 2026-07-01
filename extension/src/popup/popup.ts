// TIP-004 — Popup: EXT-05 (avatar+tên) + EXT-06 (login + trạng thái sub) + EXT-07 (nâng cấp khi hết hạn).
import { supabaseExt, EXT_STORAGE_KEY } from "../lib/supabaseExt";
import { apiExt } from "../lib/apiExt";
import { SITE_URL } from "../lib/env";
import {
  getSettings,
  setSettings,
  clampFont,
  clampGap,
  FONT_MIN,
  FONT_MAX,
  FONT_STEP,
  GAP_MIN,
  GAP_MAX,
  GAP_STEP,
  type Settings,
  type SubMode,
  type SubColor,
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
  const card = div("card timer-card");
  const label = div("timer-label", "Thời gian học");
  const time = div("timer-time", "00:00:00");
  const controls = div("timer-controls");

  // Nút TRÒN ▶ / ■ + label dưới (Figma). Giữ logic onStart/onStop.
  const startWrap = div("tbtn-wrap");
  const startBtn = button("▶", () => void onStart(), "tbtn");
  startWrap.appendChild(startBtn);
  startWrap.appendChild(div("tbtn-label", "Bắt đầu"));

  const stopWrap = div("tbtn-wrap");
  const stopBtn = button("■", () => void onStop(), "tbtn");
  stopWrap.appendChild(stopBtn);
  stopWrap.appendChild(div("tbtn-label", "Kết thúc"));

  controls.appendChild(startWrap);
  controls.appendChild(stopWrap);
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

// Stepper − [Npx] + (clamp + disable biên). onChange lưu storage.
function stepperRow(
  label: string,
  initial: number,
  min: number,
  max: number,
  step: number,
  clampFn: (n: number) => number,
  onChange: (v: number) => void
): HTMLElement {
  let val = clampFn(initial);
  const row = div("set-row");
  row.appendChild(div("set-label", label));
  const stepper = div("stepper");
  const minus = document.createElement("button");
  minus.className = "step-btn";
  minus.textContent = "−";
  const out = div("set-val");
  const plus = document.createElement("button");
  plus.className = "step-btn";
  plus.textContent = "+";
  const paint = (): void => {
    out.textContent = `${val}px`;
    minus.disabled = val <= min;
    plus.disabled = val >= max;
  };
  minus.addEventListener("click", () => {
    val = clampFn(val - step);
    paint();
    onChange(val);
  });
  plus.addEventListener("click", () => {
    val = clampFn(val + step);
    paint();
    onChange(val);
  });
  stepper.appendChild(minus);
  stepper.appendChild(out);
  stepper.appendChild(plus);
  row.appendChild(stepper);
  paint();
  return row;
}

// Hàng chọn màu chữ (3 chấm trắng/đen/vàng) cho 1 ngôn ngữ.
function colorRow(flagLabel: string, current: SubColor, onPick: (c: SubColor) => void): HTMLElement {
  const r = div("set-row");
  r.appendChild(div("set-label", flagLabel));
  const dots = div("dots");
  (["white", "black", "yellow"] as SubColor[]).forEach((c) => {
    const d = document.createElement("button");
    d.className = `dot-btn dot-${c}${current === c ? " sel" : ""}`;
    d.title = c;
    d.addEventListener("click", () => onPick(c));
    dots.appendChild(d);
  });
  r.appendChild(dots);
  return r;
}

function buildSettingsCard(): HTMLElement {
  const card = div("card settings");
  card.appendChild(div("set-title", "Chế độ phụ đề"));
  const body = div("");
  card.appendChild(body);

  void getSettings().then((s: Settings) => {
    const st: Settings = { ...s };

    const render = (): void => {
      body.textContent = "";

      // Tabs chế độ: Tiếng Anh / Song ngữ / Tiếng Việt
      const seg = div("seg");
      ([["en", "Tiếng Anh"], ["both", "Song ngữ"], ["vi", "Tiếng Việt"]] as [SubMode, string][]).forEach(
        ([m, label]) => {
          const b = document.createElement("button");
          b.className = `seg-btn${st.mode === m ? " active" : ""}`;
          b.textContent = label;
          b.addEventListener("click", () => {
            if (st.mode === m) return;
            st.mode = m;
            void setSettings({ mode: m });
            render(); // ẩn/hiện hàng EN/VI + Khoảng cách theo mode
          });
          seg.appendChild(b);
        }
      );
      body.appendChild(seg);

      // Màu chữ EN / VI (theo mode)
      if (st.mode === "en" || st.mode === "both") {
        body.appendChild(
          colorRow("🇬🇧 Tiếng Anh", st.enColor, (c) => {
            st.enColor = c;
            void setSettings({ enColor: c });
            render();
          })
        );
      }
      if (st.mode === "vi" || st.mode === "both") {
        body.appendChild(
          colorRow("🇻🇳 Tiếng Việt", st.viColor, (c) => {
            st.viColor = c;
            void setSettings({ viColor: c });
            render();
          })
        );
      }

      // Màu nền (toggle) + độ đậm %
      const opLabel = div("set-val", `${st.bgOpacity}%`);
      const slider = document.createElement("input");
      slider.type = "range";
      slider.min = "0";
      slider.max = "100";
      slider.step = "5";
      slider.value = String(st.bgOpacity);
      slider.className = "set-slider";
      slider.disabled = !st.bgEnabled;
      opLabel.style.opacity = st.bgEnabled ? "1" : "0.4";
      slider.addEventListener("input", () => {
        st.bgOpacity = Number(slider.value);
        opLabel.textContent = `${st.bgOpacity}%`;
        void setSettings({ bgOpacity: st.bgOpacity });
      });
      body.appendChild(
        switchRow("Màu nền", st.bgEnabled, (v) => {
          st.bgEnabled = v;
          slider.disabled = !v;
          opLabel.style.opacity = v ? "1" : "0.4";
          void setSettings({ bgEnabled: v });
        })
      );
      const opRow = div("set-row");
      opRow.appendChild(slider);
      opRow.appendChild(opLabel);
      body.appendChild(opRow);

      // Kích thước (EN size) — 12..32 bước 2
      body.appendChild(
        stepperRow("Tʀ Kích thước", st.fontSizePx, FONT_MIN, FONT_MAX, FONT_STEP, clampFont, (v) => {
          st.fontSizePx = v;
          void setSettings({ fontSizePx: v });
        })
      );

      // Khoảng cách EN↔VI — chỉ hiện ở Song ngữ; 2..16 bước 2
      if (st.mode === "both") {
        body.appendChild(
          stepperRow("↕ Khoảng cách", st.lineGapPx, GAP_MIN, GAP_MAX, GAP_STEP, clampGap, (v) => {
            st.lineGapPx = v;
            void setSettings({ lineGapPx: v });
          })
        );
      }
    };

    render();
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

// Logo "SM." — chữ đậm + chấm accent (vàng), đồng bộ web.
function logoNode(): HTMLElement {
  const d = div("logo");
  const sm = document.createElement("span");
  sm.textContent = "SM";
  const dot = document.createElement("span");
  dot.className = "dot";
  dot.textContent = ".";
  d.appendChild(sm);
  d.appendChild(dot);
  return d;
}

// Footer: Đăng xuất + Hỗ trợ + Tắt/Bật StudyMovie (TIP-028, công tắc tổng phụ đề).
function footerNode(onSignOut: () => void): HTMLElement {
  const f = div("footer");
  const out = button("⇥ Đăng xuất", () => void onSignOut(), "footer-link");
  const help = button("✆ Hỗ trợ", () => openTab(`${SITE_URL}/ho-tro`), "footer-link");

  let enabled = true;
  const paint = (): void => {
    power.textContent = enabled ? "⏻ Tắt StudyMovie" : "⏻ Bật StudyMovie";
  };
  const power = button(
    "⏻ Tắt StudyMovie",
    () => {
      enabled = !enabled;
      paint();
      void setSettings({ enabled }); // áp realtime qua chrome.storage → content script
    },
    "footer-link"
  );
  void getSettings().then((s) => {
    enabled = s.enabled;
    paint();
  });

  f.appendChild(out);
  f.appendChild(help);
  f.appendChild(power);
  return f;
}

// TIP-027 — Auth email/mật khẩu (bổ sung Google). Chế độ đăng nhập ↔ đăng ký.
let authMode: "login" | "register" = "login";

// Map lỗi Supabase → thông báo tiếng Việt thân thiện.
function mapAuthError(m: string): string {
  if (/invalid login credentials/i.test(m)) return "Email hoặc mật khẩu không đúng.";
  if (/email not confirmed/i.test(m)) return "Email chưa được xác nhận. Vui lòng mở hộp thư và bấm link xác nhận.";
  if (/already registered|already exists/i.test(m)) return "Email đã được đăng ký. Vui lòng đăng nhập.";
  return m;
}

// notice: thông báo hiện ngay khi vẽ (vd sau đăng ký thành công).
function renderLogin(notice?: { text: string; ok: boolean }): void {
  const isReg = authMode === "register";

  const msg = div("auth-msg");
  const showMsg = (text: string, ok: boolean): void => {
    msg.textContent = text;
    msg.className = `auth-msg ${ok ? "ok" : "err"}`;
    msg.style.display = "block";
  };
  msg.style.display = "none";
  if (notice) showMsg(notice.text, notice.ok);

  const email = document.createElement("input");
  email.type = "email";
  email.placeholder = "Nhập chính xác email của bạn";
  email.className = "auth-input";
  const pass = document.createElement("input");
  pass.type = "password";
  pass.placeholder = "Nhập mật khẩu";
  pass.className = "auth-input";
  pass.addEventListener("keydown", (e) => {
    if (e.key === "Enter") void onSubmit();
  });

  const submit = button(isReg ? "Tạo tài khoản" : "Đăng nhập", () => void onSubmit(), "btn");

  async function onSubmit(): Promise<void> {
    const em = email.value.trim();
    const pw = pass.value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      showMsg("Email không hợp lệ.", false);
      return;
    }
    if (pw.length < 6) {
      showMsg("Mật khẩu tối thiểu 6 ký tự.", false);
      return;
    }
    submit.disabled = true;
    submit.textContent = isReg ? "Đang tạo…" : "Đang đăng nhập…";
    try {
      if (isReg) {
        const { data, error } = await supabaseExt.auth.signUp({ email: em, password: pw });
        if (error) {
          showMsg(mapAuthError(error.message), false);
        } else if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          // Supabase anti-enumeration: email ĐÃ TỒN TẠI (vd đã đăng nhập Google) → trả success rỗng
          // (identities=[]). KHÔNG phải đăng ký thành công → báo đã đăng ký, chuyển sang đăng nhập.
          authMode = "login";
          renderLogin({ text: "Email đã được đăng ký. Vui lòng đăng nhập (hoặc dùng nút Google nếu bạn tạo bằng Google).", ok: false });
          return;
        } else if (!data.session) {
          // Confirm email ON, user MỚI → chưa có session → về mode đăng nhập + báo.
          authMode = "login";
          renderLogin({ text: "Đã gửi email xác nhận. Vui lòng mở hộp thư và bấm link để kích hoạt.", ok: true });
          return;
        }
        // (Nếu có session ngay = confirm off → onChanged listener sẽ tự render user view.)
      } else {
        const { error } = await supabaseExt.auth.signInWithPassword({ email: em, password: pw });
        if (error) showMsg(mapAuthError(error.message), false);
        // Thành công → session ghi chrome.storage → onChanged listener tự render user view.
      }
    } catch (e) {
      showMsg(e instanceof Error ? e.message : String(e), false);
    } finally {
      submit.disabled = false;
      submit.textContent = isReg ? "Tạo tài khoản" : "Đăng nhập";
    }
  }

  // Link đổi mode
  const toggle = button(
    isReg ? "Đã có tài khoản? Đăng nhập" : "Chưa có tài khoản? Đăng ký",
    () => {
      authMode = isReg ? "login" : "register";
      renderLogin();
    },
    "auth-link"
  );

  const divider = div("auth-divider");
  divider.appendChild(document.createElement("span")).textContent = "hoặc";

  const google = button("Đăng nhập với Google", () => openTab(SITE_URL), "btn ghost");

  mount(
    logoNode(),
    div("auth-title", isReg ? "Đăng ký tài khoản" : "Đăng nhập"),
    email,
    pass,
    submit,
    msg,
    toggle,
    divider,
    google
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

  const nodes: Node[] = [logoNode(), row, timerCard, minutesBox, settingsCard, statusBox];
  if (!me.is_active) {
    nodes.push(button("Nâng cấp", () => openTab(`${SITE_URL}/upgrade`)));
  }
  nodes.push(
    footerNode(async () => {
      await supabaseExt.auth.signOut();
      renderLogin();
    })
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
  mount(logoNode(), div("muted", "Đang tải tài khoản…"));
  try {
    const me = await apiExt<Me>("/api/me");
    renderUser(me);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // D-02: 401 = phiên hết hiệu lực (vd user đăng xuất trên web nhưng session cũ còn kẹt)
    // → dọn session rồi về màn login, KHÔNG hiện hộp lỗi. Lỗi khác (mạng/5xx) giữ nguyên.
    if (/HTTP 401/.test(msg)) {
      try {
        await supabaseExt.auth.signOut();
      } catch {
        /* ignore */
      }
      renderLogin();
      return;
    }
    mount(
      logoNode(),
      div("muted", `Không tải được tài khoản: ${msg}`),
      button("Thử lại", () => void render(), "btn ghost")
    );
  }
}

// Tự cập nhật khi bridge truyền session về (lúc popup đang mở).
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[EXT_STORAGE_KEY]) void render();
});

void render();

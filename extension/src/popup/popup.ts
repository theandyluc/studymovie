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

  // TIP-051 — Nút TRÁI = play/pause/resume (đổi theo state); nút PHẢI = ■ Kết thúc.
  const leftWrap = div("tbtn-wrap");
  const leftBtn = button("▶", () => void onLeft(), "tbtn");
  const leftLabel = div("tbtn-label", "Bắt đầu");
  leftWrap.appendChild(leftBtn);
  leftWrap.appendChild(leftLabel);

  const stopWrap = div("tbtn-wrap");
  const stopBtn = button("■", () => void onStop(), "tbtn");
  stopWrap.appendChild(stopBtn);
  stopWrap.appendChild(div("tbtn-label", "Kết thúc"));

  controls.appendChild(leftWrap);
  controls.appendChild(stopWrap);
  card.appendChild(label);
  card.appendChild(time);
  card.appendChild(controls);

  let elapsed = 0;
  let running = false;
  const isPaused = (): boolean => !running && elapsed > 0;

  const paint = (): void => {
    time.textContent = fmtHMS(elapsed);
    if (running) {
      leftBtn.textContent = "⏸";
      leftLabel.textContent = "Tạm dừng";
    } else {
      leftBtn.textContent = "▶";
      leftLabel.textContent = isPaused() ? "Tiếp tục" : "Bắt đầu";
    }
    stopBtn.disabled = !running && !isPaused(); // Kết thúc bật khi running HOẶC paused
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
  const applyState = (s: { running: boolean; elapsedSec: number }): void => {
    running = s.running;
    elapsed = s.elapsedSec;
    paint();
    if (running) startTick();
    else clearTick(); // paused/stopped → không đếm
  };
  async function onLeft(): Promise<void> {
    // running → Tạm dừng; stopped/paused → Bắt đầu/Tiếp tục (background giữ accumulated khi resume).
    applyState(await timerMsg(running ? "SM_TIMER_PAUSE" : "SM_TIMER_START"));
  }
  async function onStop(): Promise<void> {
    clearTick();
    applyState(await timerMsg("SM_TIMER_STOP"));
    onStopped(); // ghi nhận xong → cập nhật "phút hôm nay" (nếu có)
  }

  // Khởi tạo từ background (popup mở lại vẫn đúng state — AC-3: running đếm tiếp, paused giữ số).
  void timerMsg("SM_TIMER_STATE").then(applyState);

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

// TIP-060b — cờ SVG (emoji 🇬🇧/🇻🇳 không hiển thị trên Windows).
const FLAG_GB =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 30" width="18" height="12">' +
  '<clipPath id="smf-gb"><path d="M30 15h30v15zv15H0zH0V0zV0h30z"/></clipPath>' +
  '<path d="M0 0v30h60V0z" fill="#012169"/>' +
  '<path d="M0 0 60 30m0-30L0 30" stroke="#fff" stroke-width="6"/>' +
  '<path d="M0 0 60 30m0-30L0 30" clip-path="url(#smf-gb)" stroke="#C8102E" stroke-width="4"/>' +
  '<path d="M30 0v30M0 15h60" stroke="#fff" stroke-width="10"/>' +
  '<path d="M30 0v30M0 15h60" stroke="#C8102E" stroke-width="6"/></svg>';
const FLAG_VN =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" width="18" height="12">' +
  '<rect width="30" height="20" fill="#da251d"/>' +
  '<path fill="#ff0" d="M15 4l1.76 5.42h5.7l-4.61 3.35 1.76 5.42L15 14.24l-4.61 3.35 1.76-5.42-4.61-3.35h5.7z"/></svg>';

function flagLabel(svg: string, text: string): HTMLElement {
  const s = document.createElement("span");
  s.style.display = "inline-flex";
  s.style.alignItems = "center";
  s.style.gap = "6px";
  const f = document.createElement("span");
  f.style.display = "inline-flex";
  f.innerHTML = svg; // SVG tĩnh (không script) — an toàn trong trang extension
  s.appendChild(f);
  s.appendChild(document.createTextNode(text));
  return s;
}

// Hàng chọn màu chữ (3 chấm trắng/đen/vàng) cho 1 ngôn ngữ.
function colorRow(label: string | HTMLElement, current: SubColor, onPick: (c: SubColor) => void): HTMLElement {
  const r = div("set-row");
  const lbl = div("set-label");
  if (typeof label === "string") lbl.textContent = label;
  else lbl.appendChild(label);
  r.appendChild(lbl);
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
          colorRow(flagLabel(FLAG_GB, "Tiếng Anh"), st.enColor, (c) => {
            st.enColor = c;
            void setSettings({ enColor: c });
            render();
          })
        );
      }
      if (st.mode === "vi" || st.mode === "both") {
        body.appendChild(
          colorRow(flagLabel(FLAG_VN, "Tiếng Việt"), st.viColor, (c) => {
            st.viColor = c;
            void setSettings({ viColor: c });
            render();
          })
        );
      }

      // TIP-050/060 — "Màu nền": toggle bật/tắt + (khi bật) chấm màu chọn nền (đen/trắng/vàng).
      body.appendChild(
        switchRow("Màu nền", st.bgEnabled, (v) => {
          st.bgEnabled = v;
          void setSettings({ bgEnabled: v });
          render(); // hiện/ẩn chấm màu nền
        })
      );
      if (st.bgEnabled) {
        // TIP-060b — 1 chấm bấm đảo đen ↔ trắng (dot-white có viền để thấy).
        const r = div("set-row");
        r.appendChild(div("set-label", "Chọn màu nền"));
        const dots = div("dots");
        const d = document.createElement("button");
        d.className = `dot-btn dot-${st.bgColor} sel`;
        d.title = st.bgColor === "white" ? "Trắng" : "Đen";
        d.addEventListener("click", () => {
          st.bgColor = st.bgColor === "white" ? "black" : "white";
          void setSettings({ bgColor: st.bgColor });
          render();
        });
        dots.appendChild(d);
        r.appendChild(dots);
        body.appendChild(r);
      }

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
      let loggedIn = false;
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
        } else {
          loggedIn = true; // có session ngay (confirm off) → onChanged tự render user view
        }
      } else {
        const { error } = await supabaseExt.auth.signInWithPassword({ email: em, password: pw });
        if (error) showMsg(mapAuthError(error.message), false);
        else loggedIn = true; // session ghi chrome.storage → onChanged tự render user view
      }
      // TIP-047 — login thành công (có session) → đẩy session sang các tab web đang mở.
      if (loggedIn) {
        try {
          await chrome.runtime.sendMessage({ type: "SM_LOGIN" });
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      showMsg(e instanceof Error ? e.message : String(e), false);
    } finally {
      submit.disabled = false;
      submit.textContent = isReg ? "Tạo tài khoản" : "Đăng nhập";
    }
  }

  // TIP-052 — Link đổi mode (dưới cùng)
  const toggle = button(
    isReg ? "Bạn đã có tài khoản? Đăng nhập" : "Bạn chưa có tài khoản? Đăng ký",
    () => {
      authMode = isReg ? "login" : "register";
      renderLogin();
    },
    "auth-switch"
  );

  // TIP-052 — Tab segmented [Đăng nhập | Đăng ký] (nút của mode hiện tại = active).
  const authTabs = div("auth-tabs");
  const loginTab = button(
    "🔓 Đăng nhập",
    () => {
      if (isReg) {
        authMode = "login";
        renderLogin();
      }
    },
    `auth-tab${!isReg ? " active" : ""}`
  );
  const regTab = button(
    "👤 Đăng ký",
    () => {
      if (!isReg) {
        authMode = "register";
        renderLogin();
      }
    },
    `auth-tab${isReg ? " active" : ""}`
  );
  authTabs.append(loginTab, regTab);

  const divider = div("auth-divider");
  divider.appendChild(document.createElement("span")).textContent = "hoặc";

  // Google — mở web để đăng nhập/đăng ký bằng Google (giữ hành vi cũ); text theo mode + logo G.
  const google = button(
    isReg ? "Đăng ký bằng Google" : "Đăng nhập bằng Google",
    () => openTab(`${SITE_URL}/?login=google`), // TIP-055b: web tự chạy Google OAuth theo cờ
    "google-btn"
  );
  google.prepend(div("g-icon", "G"));

  mount(
    authTabs,
    div("auth-title", isReg ? "Đăng ký tài khoản" : "Đăng nhập"),
    google,
    divider,
    div("auth-label", "Email"),
    email,
    div("auth-label", "Mật khẩu"),
    pass,
    submit,
    msg,
    toggle
  );
}

function renderUser(me: Me): void {
  const doSignOut = async (): Promise<void> => {
    await supabaseExt.auth.signOut();
    // TIP-044 — báo background dọn session ở các tab web (đồng bộ logout ext→web).
    try {
      await chrome.runtime.sendMessage({ type: "SM_LOGOUT" });
    } catch {
      /* ignore */
    }
    renderLogin();
  };

  // TIP-050 — Home tối giản theo Figma (đã đăng nhập + còn hạn): chỉ card Thời gian học + card
  // Chế độ phụ đề + bottom bar. Bỏ logo / avatar+email / "Hôm nay" / dòng trạng thái trial.
  if (me.is_active) {
    const settingsCard = buildSettingsCard(); // TIP-015: EN/VI, màu, cỡ chữ — realtime qua chrome.storage
    const timerCard = buildTimerCard(() => {});
    mount(timerCard, settingsCard, footerNode(doSignOut));
    return;
  }

  // TIP-053 — !is_active: màn "Hết hạn dùng thử" theo Figma (sạch, căn giữa).
  const title = div("expired-title", "Hết hạn dùng thử");
  const p = div("expired-msg");
  p.append("Tài khoản của bạn đã hết hạn dùng thử, vui lòng nâng cấp ");
  const a = document.createElement("a");
  a.textContent = "tại đây";
  a.className = "expired-link";
  a.href = "#";
  a.addEventListener("click", (e) => {
    e.preventDefault();
    openTab("https://studymovie.com/gia");
  });
  p.appendChild(a);
  p.append(" để tiếp tục sử dụng.");
  const box = div("expired-box");
  box.append(title, p);

  mount(box, footerNode(doSignOut)); // GIỮ bottom bar (Đăng xuất / Hỗ trợ) để thoát tài khoản
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

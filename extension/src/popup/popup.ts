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
// TIP-085 — nút tab đăng nhập/đăng ký: icon SVG (Figma) + nhãn, thay cho emoji cũ.
const ICON_LOGIN =
  '<svg width="15" height="15" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 8C4 9.414 4 10.1215 4.4395 10.5605C4.76 10.8815 5.2235 10.968 6 10.9915M4 4C4 2.586 4 1.8785 4.4395 1.4395C4.8785 1 5.586 1 7 1H7.5C8.914 1 9.6215 1 10.0605 1.4395C10.5 1.8785 10.5 2.586 10.5 4V8C10.5 9.414 10.5 10.1215 10.0605 10.5605C9.6765 10.945 9.0875 10.993 8 10.999M1.5 4.75V7.25C1.5 8.4285 1.5 9.0175 1.866 9.384C2.232 9.7505 2.8215 9.75 4 9.75M1.866 2.616C2.232 2.25 2.8215 2.25 4 2.25" stroke="#1F1F1F" stroke-linecap="round"/><path d="M3 6H7.5M6.25 4.75L7.5 6L6.25 7.25" stroke="#1F1F1F" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_REGISTER =
  '<svg width="15" height="15" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.94886 7.52813C8.23245 7.37578 8.55706 7.28906 8.90276 7.28906H8.90394C8.93909 7.28906 8.9555 7.24688 8.92972 7.22344C8.5702 6.9008 8.15951 6.64021 7.71448 6.45234C7.70979 6.45 7.70511 6.44883 7.70042 6.44648C8.42815 5.91797 8.90159 5.05898 8.90159 4.08984C8.90159 2.48438 7.60315 1.18359 6.0012 1.18359C4.39925 1.18359 3.10198 2.48438 3.10198 4.08984C3.10198 5.05898 3.57542 5.91797 4.30433 6.44648C4.29964 6.44883 4.29495 6.45 4.29026 6.45234C3.76644 6.67383 3.29651 6.99141 2.89222 7.39688C2.49025 7.7981 2.17024 8.27375 1.95003 8.79727C1.73336 9.30992 1.61643 9.85918 1.6055 10.4156C1.60519 10.4281 1.60738 10.4406 1.61195 10.4522C1.61652 10.4639 1.62338 10.4745 1.63211 10.4834C1.64085 10.4924 1.65129 10.4995 1.66282 10.5044C1.67435 10.5092 1.68674 10.5117 1.69925 10.5117H2.4012C2.45159 10.5117 2.49378 10.4707 2.49495 10.4203C2.51839 9.51562 2.8805 8.66836 3.52151 8.02617C4.18362 7.36172 5.06487 6.99609 6.00237 6.99609C6.66683 6.99609 7.30433 7.18008 7.85394 7.52461C7.86805 7.53348 7.88426 7.53848 7.90093 7.53909C7.91759 7.53971 7.93412 7.53593 7.94886 7.52813ZM6.00237 6.10547C5.46565 6.10547 4.96058 5.8957 4.57972 5.51484C4.39233 5.32794 4.24377 5.10581 4.14261 4.86124C4.04144 4.61667 3.98967 4.35451 3.99026 4.08984C3.99026 3.55195 4.20003 3.0457 4.57972 2.66484C4.9594 2.28398 5.46448 2.07422 6.00237 2.07422C6.54026 2.07422 7.04417 2.28398 7.42503 2.66484C7.61242 2.85175 7.76097 3.07388 7.86214 3.31845C7.9633 3.56301 8.01508 3.82518 8.01448 4.08984C8.01448 4.62773 7.80472 5.13398 7.42503 5.51484C7.04417 5.8957 6.53909 6.10547 6.00237 6.10547ZM10.3125 8.89453H9.32815V7.91016C9.32815 7.85859 9.28597 7.81641 9.2344 7.81641H8.57815C8.52659 7.81641 8.4844 7.85859 8.4844 7.91016V8.89453H7.50003C7.44847 8.89453 7.40628 8.93672 7.40628 8.98828V9.64453C7.40628 9.69609 7.44847 9.73828 7.50003 9.73828H8.4844V10.7227C8.4844 10.7742 8.52659 10.8164 8.57815 10.8164H9.2344C9.28597 10.8164 9.32815 10.7742 9.32815 10.7227V9.73828H10.3125C10.3641 9.73828 10.4063 9.69609 10.4063 9.64453V8.98828C10.4063 8.93672 10.3641 8.89453 10.3125 8.89453Z" fill="#1F1F1F"/></svg>';
const ICON_GOOGLE =
  '<svg width="15" height="15" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#clip0_482_384)"><path opacity="0.987" fill-rule="evenodd" clip-rule="evenodd" d="M5.40718 0.795753C5.95093 0.735003 6.27268 0.735003 6.85693 0.795753C7.89113 0.948825 8.84984 1.42687 9.59443 2.16075C9.09127 2.63635 8.59472 3.1189 8.10493 3.60825C7.16693 2.81325 6.11993 2.62975 4.96393 3.05775C4.11593 3.44775 3.52543 4.07975 3.19243 4.95375C2.64826 4.54863 2.11117 4.13406 1.58143 3.71025C1.54461 3.69087 1.50256 3.68378 1.46143 3.69C2.30293 2.0675 3.61793 1.1025 5.40643 0.795003" fill="#F44336"/><path opacity="0.997" fill-rule="evenodd" clip-rule="evenodd" d="M1.45969 3.69001C1.50219 3.68351 1.54244 3.69026 1.58044 3.71026C2.11019 4.13407 2.64727 4.54863 3.19144 4.95376C3.10581 5.2943 3.05183 5.64203 3.03019 5.99251C3.04869 6.33151 3.10244 6.66426 3.19144 6.99076L1.50019 8.33701C0.763689 6.79801 0.750189 5.24901 1.45969 3.69001Z" fill="#FFC107"/><path opacity="0.999" fill-rule="evenodd" clip-rule="evenodd" d="M9.51405 9.96751C8.98744 9.50309 8.43614 9.06746 7.86255 8.66251C8.43755 8.25651 8.78655 7.69951 8.90955 6.99151H6.0918V5.03476C7.7168 5.02126 9.34105 5.03501 10.9645 5.07601C11.2725 6.74851 10.9168 8.25651 9.8973 9.60001C9.77607 9.72887 9.64766 9.85153 9.51405 9.96751Z" fill="#448AFF"/><path opacity="0.993" fill-rule="evenodd" clip-rule="evenodd" d="M3.19125 6.9915C3.80625 8.52 4.93375 9.2335 6.57375 9.132C7.03412 9.07871 7.47551 8.91788 7.86225 8.6625C8.43625 9.0685 8.98675 9.5035 9.51375 9.9675C8.67874 10.7178 7.61408 11.1631 6.4935 11.2305C6.23891 11.2509 5.98309 11.2509 5.7285 11.2305C3.8195 11.0055 2.41 10.041 1.5 8.337L3.19125 6.9915Z" fill="#43A047"/></g><defs><clipPath id="clip0_482_384"><rect width="15" height="15" fill="white"/></clipPath></defs></svg>';
// TIP-088 — icon nút timer (Figma): play (Bắt đầu/Tiếp tục dùng chung), pause (Tạm dừng), stop (Kết thúc).
const ICON_TIMER_PLAY =
  '<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="0.5" y="0.5" width="39" height="39" rx="19.5" fill="#FCFCFC"/><rect x="0.5" y="0.5" width="39" height="39" rx="19.5" stroke="#E6E6E6" stroke-opacity="0.5"/><path d="M17.3952 27C17.0114 26.9988 16.6322 26.9136 16.2832 26.75C15.9053 26.5797 15.5834 26.3017 15.3559 25.9493C15.1284 25.5969 15.0048 25.185 15 24.7627V14.2387C15.0048 13.8165 15.1284 13.4045 15.3559 13.0521C15.5834 12.6997 15.9053 12.4218 16.2832 12.2514C16.7179 12.0414 17.2016 11.9605 17.6791 12.018C18.1566 12.0754 18.6087 12.2689 18.9839 12.5764L25.2164 17.8384C25.4608 18.0374 25.6582 18.2902 25.7939 18.578C25.9295 18.8658 26 19.1812 26 19.5007C26 19.8202 25.9295 20.1356 25.7939 20.4234C25.6582 20.7113 25.4608 20.9641 25.2164 21.1631L18.9839 26.4251C18.5347 26.7977 17.9737 27.0007 17.3952 27Z" fill="#CCCCCC" fill-opacity="0.8"/></svg>';
const ICON_TIMER_PAUSE =
  '<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="40" height="40" rx="20" fill="#FCFCFC"/><rect x="0.5" y="0.5" width="39" height="39" rx="19.5" stroke="#1F1F1F" stroke-opacity="0.5"/><path d="M15.5 13.25C15.0359 13.25 14.5908 13.4344 14.2626 13.7626C13.9344 14.0908 13.75 14.5359 13.75 15V25C13.75 25.966 14.534 26.75 15.5 26.75H16.5C16.9641 26.75 17.4092 26.5656 17.7374 26.2374C18.0656 25.9092 18.25 25.4641 18.25 25V15C18.25 14.5359 18.0656 14.0908 17.7374 13.7626C17.4092 13.4344 16.9641 13.25 16.5 13.25H15.5ZM22 13.25C21.5359 13.25 21.0908 13.4344 20.7626 13.7626C20.4344 14.0908 20.25 14.5359 20.25 15V25C20.25 25.966 21.034 26.75 22 26.75H23C23.4641 26.75 23.9092 26.5656 24.2374 26.2374C24.5656 25.9092 24.75 25.4641 24.75 25V15C24.75 14.5359 24.5656 14.0908 24.2374 13.7626C23.9092 13.4344 23.4641 13.25 23 13.25H22Z" fill="#1F1F1F" fill-opacity="0.5"/></svg>';
const ICON_TIMER_STOP =
  '<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="0.5" y="0.5" width="39" height="39" rx="19.5" fill="#FCFCFC"/><rect x="0.5" y="0.5" width="39" height="39" rx="19.5" stroke="#E6E6E6" stroke-opacity="0.5"/><path d="M17.3058 11.375C16.3958 11.375 15.6742 11.375 15.0933 11.4225C14.4983 11.4708 13.9958 11.5725 13.5367 11.8058C12.7917 12.1856 12.186 12.7915 11.8067 13.5367C11.5725 13.995 11.4708 14.4983 11.4225 15.0933C11.375 15.6742 11.375 16.3958 11.375 17.3058V21.6942C11.375 22.6042 11.375 23.3258 11.4225 23.9067C11.4708 24.5017 11.5725 25.0042 11.8058 25.4642C12.1857 26.2089 12.7916 26.8142 13.5367 27.1933C13.995 27.4275 14.4983 27.5292 15.0933 27.5775C15.6742 27.625 16.3958 27.625 17.3058 27.625H21.6942C22.6042 27.625 23.3258 27.625 23.9067 27.5775C24.5017 27.5292 25.0042 27.4275 25.4642 27.1942C26.2087 26.8145 26.814 26.2089 27.1933 25.4642C27.4275 25.0042 27.5292 24.5017 27.5775 23.9067C27.625 23.3258 27.625 22.6042 27.625 21.6942V17.3058C27.625 16.3958 27.625 15.6742 27.5775 15.0933C27.5292 14.4983 27.4275 13.9958 27.1942 13.5367C26.8147 12.7918 26.2091 12.1862 25.4642 11.8067C25.0042 11.5725 24.5017 11.4708 23.9067 11.4225C23.3258 11.375 22.6042 11.375 21.6942 11.375H17.3058Z" fill="#CCCCCC" fill-opacity="0.8"/></svg>';
function iconTabButton(icon: string, label: string, onClick: () => void, cls: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.className = cls;
  b.innerHTML = `${icon}<span>${label}</span>`;
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

  // TIP-051/088 — Nút TRÁI = play/pause/resume (icon đổi theo state); nút PHẢI = Kết thúc.
  const leftWrap = div("tbtn-wrap");
  const leftBtn = iconTabButton(ICON_TIMER_PLAY, "", () => void onLeft(), "tbtn");
  const leftLabel = div("tbtn-label", "Bắt đầu");
  leftWrap.appendChild(leftBtn);
  leftWrap.appendChild(leftLabel);

  const stopWrap = div("tbtn-wrap");
  const stopBtn = iconTabButton(ICON_TIMER_STOP, "", () => void onStop(), "tbtn");
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
      leftBtn.innerHTML = ICON_TIMER_PAUSE;
      leftLabel.textContent = "Tạm dừng";
    } else {
      leftBtn.innerHTML = ICON_TIMER_PLAY;
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
// TIP-090 — icon SVG bên trái label cài đặt (Màu nền/Kích thước/Khoảng cách), cách text 2px.
function iconLabel(icon: string, text: string): HTMLElement {
  const s = document.createElement("span");
  s.style.display = "inline-flex";
  s.style.alignItems = "center";
  s.style.gap = "4px";
  s.style.marginLeft = "2px";
  const i = document.createElement("span");
  i.style.display = "inline-flex";
  i.innerHTML = icon;
  s.appendChild(i);
  s.appendChild(document.createTextNode(text));
  return s;
}

// TIP-092 — extra: phần tử tuỳ chọn chèn SAU switch (bên phải, đẩy switch dịch sang trái) —
// dùng cho chấm đổi màu nền ngay trong dòng "Màu nền" khi bật, thay vì tách dòng riêng.
function switchRow(
  icon: string,
  label: string,
  checked: boolean,
  onChange: (v: boolean) => void,
  extra?: HTMLElement
): HTMLElement {
  const r = div("set-row");
  const lbl = div("set-label");
  lbl.appendChild(iconLabel(icon, label));
  r.appendChild(lbl);
  const right = div("switch-group");
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
  right.appendChild(sw);
  if (extra) right.appendChild(extra);
  r.appendChild(right);
  return r;
}

// Stepper − [Npx] + (clamp + disable biên). onChange lưu storage.
function stepperRow(
  icon: string,
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
  const lbl = div("set-label");
  lbl.appendChild(iconLabel(icon, label));
  row.appendChild(lbl);
  const stepper = div("stepper");
  const minus = document.createElement("button");
  minus.className = "step-btn step-btn-minus";
  minus.innerHTML = ICON_STEP_MINUS;
  const plus = document.createElement("button");
  plus.className = "step-btn step-btn-plus";
  plus.innerHTML = ICON_STEP_PLUS;
  const paint = (): void => {
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
  stepper.appendChild(plus);
  row.appendChild(stepper);
  paint();
  return row;
}

// TIP-060b — cờ SVG (emoji 🇬🇧/🇻🇳 không hiển thị trên Windows).
const FLAG_GB =
  '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0 4.5295V6.5H2.814L0 4.5295ZM2.332 15.5H6.5V12.5815L2.332 15.5ZM11.5 12.582V15.5H15.6675L11.5 12.582ZM0 11.5V13.4705L2.815 11.5H0ZM15.6685 2.5H11.5V5.4185L15.6685 2.5ZM18 13.471V11.5H15.1845L18 13.471ZM18 6.5V4.5295L15.1855 6.5H18ZM6.5 2.5H2.332L6.5 5.4185V2.5Z" fill="#00247D"/><path d="M12.5701 11.5L17.4261 14.9005C17.6628 14.6559 17.8332 14.3549 17.9211 14.026L14.3136 11.5H12.5701ZM6.50011 11.5H5.42961L0.574113 14.9C0.834613 15.165 1.16861 15.3545 1.54311 15.4425L6.50011 11.9715V11.5ZM11.5001 6.5H12.5706L17.4261 3.1C17.1609 2.8314 16.8252 2.64332 16.4576 2.5575L11.5001 6.0285V6.5ZM5.42961 6.5L0.574113 3.1C0.337197 3.34457 0.166644 3.64558 0.0786133 3.9745L3.68611 6.5H5.42961Z" fill="#CF1B2B"/><path d="M18 10.5H10.5V15.5H11.5V12.582L15.6675 15.5H16C16.2656 15.4998 16.5285 15.4466 16.7733 15.3437C17.0181 15.2408 17.24 15.0901 17.426 14.9005L12.57 11.5H14.3135L17.921 14.026C17.9675 13.8575 18 13.683 18 13.5V13.471L15.1845 11.5H18V10.5ZM0 10.5V11.5H2.815L0 13.4705V13.5C0 14.0455 0.2195 14.539 0.574 14.9L5.4295 11.5H6.5V11.9715L1.543 15.442C1.69 15.477 1.842 15.5 2 15.5H2.332L6.5 12.5815V15.5H7.5V10.5H0ZM18 4.5C18.0005 3.97596 17.7942 3.47289 17.426 3.1L12.5705 6.5H11.5V6.0285L16.4575 2.5575C16.3077 2.52076 16.1542 2.50146 16 2.5H15.6685L11.5 5.4185V2.5H10.5V7.5H18V6.5H15.1855L18 4.5295V4.5ZM6.5 2.5V5.4185L2.332 2.5H2C1.73437 2.5003 1.47147 2.55352 1.22664 2.65653C0.9818 2.75955 0.759938 2.91031 0.574 3.1L5.4295 6.5H3.686L0.0785 3.9745C0.0290784 4.1454 0.00267879 4.32212 0 4.5L0 4.5295L2.814 6.5H0V7.5H7.5V2.5H6.5Z" fill="#EEEEEE"/><path d="M10.5 7.5V2.5H7.5V7.5H0V10.5H7.5V15.5H10.5V10.5H18V7.5H10.5Z" fill="#CF1B2B"/></svg>';
const FLAG_VN =
  '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 2.5H2C1.46957 2.5 0.960859 2.71071 0.585786 3.08579C0.210714 3.46086 0 3.96957 0 4.5L0 13.5C0 14.0304 0.210714 14.5391 0.585786 14.9142C0.960859 15.2893 1.46957 15.5 2 15.5H16C16.5304 15.5 17.0391 15.2893 17.4142 14.9142C17.7893 14.5391 18 14.0304 18 13.5V4.5C18 3.96957 17.7893 3.46086 17.4142 3.08579C17.0391 2.71071 16.5304 2.5 16 2.5Z" fill="#DA251D"/><path d="M9.8766 8.0185L9.0001 5.321L8.1236 8.0185H5.2876L7.5821 9.685L6.7056 12.3825L9.0001 10.7155L11.2946 12.3825L10.4181 9.685L12.7126 8.0185H9.8766Z" fill="#FFFF00"/></svg>';
// TIP-090 — icon Màu nền/Kích thước/Khoảng cách (Figma), thay placeholder "Tʀ"/"↕" cũ.
const ICON_BG =
  '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.75 5.48333C1.75 4.17667 1.75 3.52333 2.00433 3.024C2.22803 2.58497 2.58497 2.22803 3.024 2.00433C3.52333 1.75 4.17667 1.75 5.48333 1.75H8.51667C9.82333 1.75 10.4767 1.75 10.976 2.00433C11.415 2.22803 11.772 2.58497 11.9957 3.024C12.25 3.52333 12.25 4.17667 12.25 5.48333V8.51667C12.25 9.82333 12.25 10.4767 11.9957 10.976C11.772 11.415 11.415 11.772 10.976 11.9957C10.4767 12.25 9.82333 12.25 8.51667 12.25H5.48333C4.17667 12.25 3.52333 12.25 3.024 11.9957C2.58497 11.772 2.22803 11.415 2.00433 10.976C1.75 10.4767 1.75 9.82333 1.75 8.51667V5.48333Z" stroke="#1F1F1F" stroke-opacity="0.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_FONT_SIZE =
  '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.1665 2.33334V4.08334H4.08317V11.0833H5.83317V4.08334H8.74984V2.33334H1.1665ZM12.2498 5.25001H6.99984V7.00001H8.74984V11.0833H10.4998V7.00001H12.2498V5.25001Z" fill="#1F1F1F" fill-opacity="0.5"/></svg>';
const ICON_GAP =
  '<svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.76025 1.625C1.76025 1.51726 1.80306 1.41392 1.87924 1.33774C1.95543 1.26155 2.05876 1.21875 2.1665 1.21875H10.8332C10.9409 1.21875 11.0442 1.26155 11.1204 1.33774C11.1966 1.41392 11.2394 1.51726 11.2394 1.625C11.2394 1.73274 11.1966 1.83608 11.1204 1.91226C11.0442 1.98845 10.9409 2.03125 10.8332 2.03125H2.1665C2.05876 2.03125 1.95543 1.98845 1.87924 1.91226C1.80306 1.83608 1.76025 1.73274 1.76025 1.625ZM1.76025 11.375C1.76025 11.2673 1.80306 11.1639 1.87924 11.0877C1.95543 11.0116 2.05876 10.9688 2.1665 10.9688H10.8332C10.9409 10.9688 11.0442 11.0116 11.1204 11.0877C11.1966 11.1639 11.2394 11.2673 11.2394 11.375C11.2394 11.4827 11.1966 11.5861 11.1204 11.6623C11.0442 11.7384 10.9409 11.7812 10.8332 11.7812H2.1665C2.05876 11.7812 1.95543 11.7384 1.87924 11.6623C1.80306 11.5861 1.76025 11.4827 1.76025 11.375ZM6.78692 2.69208C6.71075 2.61601 6.60749 2.57327 6.49984 2.57327C6.39218 2.57327 6.28893 2.61601 6.21275 2.69208L4.58775 4.31708C4.51599 4.39409 4.47693 4.49595 4.47878 4.6012C4.48064 4.70645 4.52328 4.80686 4.59771 4.8813C4.67214 4.95573 4.77256 4.99836 4.8778 5.00022C4.98305 5.00208 5.08491 4.96301 5.16192 4.89125L6.09359 3.95958V9.04042L5.16192 8.10875C5.08491 8.03699 4.98305 7.99792 4.8778 7.99978C4.77256 8.00164 4.67214 8.04427 4.59771 8.11871C4.52328 8.19314 4.48064 8.29355 4.47878 8.3988C4.47693 8.50405 4.51599 8.60591 4.58775 8.68292L6.21275 10.3079C6.28893 10.384 6.39218 10.4267 6.49984 10.4267C6.60749 10.4267 6.71075 10.384 6.78692 10.3079L8.41192 8.68292C8.45183 8.64573 8.48385 8.60087 8.50605 8.55104C8.52826 8.50121 8.5402 8.44741 8.54116 8.39287C8.54212 8.33832 8.53209 8.28414 8.51165 8.23355C8.49122 8.18297 8.46081 8.13701 8.42223 8.09844C8.38366 8.05986 8.3377 8.02945 8.28712 8.00902C8.23653 7.98858 8.18235 7.97855 8.1278 7.97951C8.07326 7.98048 8.01946 7.99241 7.96963 8.01462C7.9198 8.03682 7.87495 8.06884 7.83775 8.10875L6.90609 9.04042V3.95958L7.83775 4.89125C7.87495 4.93116 7.9198 4.96318 7.96963 4.98538C8.01946 5.00759 8.07326 5.01953 8.1278 5.02049C8.18235 5.02145 8.23653 5.01142 8.28712 4.99098C8.3377 4.97055 8.38366 4.94014 8.42223 4.90156C8.46081 4.86299 8.49122 4.81703 8.51165 4.76645C8.53209 4.71586 8.54212 4.66168 8.54116 4.60713C8.5402 4.55259 8.52826 4.49879 8.50605 4.44896C8.48385 4.39913 8.45183 4.35428 8.41192 4.31708L6.78692 2.69208Z" fill="#1F1F1F" fill-opacity="0.5"/></svg>';
// TIP-091 — icon +/− stepper (Figma), thay text "−"/"+" cũ.
const ICON_STEP_MINUS =
  '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9.5 6.49899H2.5V5.49899H9.5V6.49899Z" fill="#1F1F1F" fill-opacity="0.5"/></svg>';
const ICON_STEP_PLUS =
  '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 6.49899H6.5V8.99899C6.5 9.1316 6.44732 9.25878 6.35355 9.35255C6.25979 9.44631 6.13261 9.49899 6 9.49899C5.86739 9.49899 5.74022 9.44631 5.64645 9.35255C5.55268 9.25878 5.5 9.1316 5.5 8.99899V6.49899H3C2.86739 6.49899 2.74021 6.44631 2.64645 6.35255C2.55268 6.25878 2.5 6.1316 2.5 5.99899C2.5 5.86638 2.55268 5.73921 2.64645 5.64544C2.74021 5.55167 2.86739 5.49899 3 5.49899H5.5V2.99899C5.5 2.86638 5.55268 2.73921 5.64645 2.64544C5.74022 2.55167 5.86739 2.49899 6 2.49899C6.13261 2.49899 6.25979 2.55167 6.35355 2.64544C6.44732 2.73921 6.5 2.86638 6.5 2.99899V5.49899H9C9.13261 5.49899 9.25979 5.55167 9.35355 5.64544C9.44732 5.73921 9.5 5.86638 9.5 5.99899C9.5 6.1316 9.44732 6.25878 9.35355 6.35255C9.25979 6.44631 9.13261 6.49899 9 6.49899Z" fill="#1F1F1F" fill-opacity="0.5"/></svg>';

function flagLabel(svg: string, text: string): HTMLElement {
  const s = document.createElement("span");
  s.style.display = "inline-flex";
  s.style.alignItems = "center";
  s.style.gap = "2px";
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

      // Tabs chế độ: Tiếng Anh / Song ngữ / Tiếng Việt — TIP-089: 3 nút liền nhau, bo góc riêng theo vị trí.
      const seg = div("seg");
      const SEG_POS = ["seg-btn-first", "seg-btn-middle", "seg-btn-last"];
      ([["en", "Tiếng Anh"], ["both", "Song ngữ"], ["vi", "Tiếng Việt"]] as [SubMode, string][]).forEach(
        ([m, label], i) => {
          const b = document.createElement("button");
          b.className = `seg-btn ${SEG_POS[i]}${st.mode === m ? " active" : ""}`;
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

      // TIP-050/060/092 — "Màu nền": chấm đổi màu LUÔN hiện ngay trong dòng (không phụ thuộc
      // toggle bật/tắt) — bấm chấm đảo màu ngay (chỉ 2 màu: #282828 mặc định / #fcfcfc).
      const bgDot = document.createElement("button");
      bgDot.className = "bg-color-dot";
      bgDot.style.background = st.bgColor === "white" ? "#fcfcfc" : "#282828";
      bgDot.title = st.bgColor === "white" ? "Trắng" : "Đen";
      bgDot.addEventListener("click", () => {
        st.bgColor = st.bgColor === "white" ? "black" : "white";
        void setSettings({ bgColor: st.bgColor });
        render();
      });
      body.appendChild(
        switchRow(
          ICON_BG,
          "Màu nền",
          st.bgEnabled,
          (v) => {
            st.bgEnabled = v;
            void setSettings({ bgEnabled: v });
            render();
          },
          bgDot
        )
      );

      // Kích thước (EN size) — 12..32 bước 2
      body.appendChild(
        stepperRow(ICON_FONT_SIZE, "Kích thước", st.fontSizePx, FONT_MIN, FONT_MAX, FONT_STEP, clampFont, (v) => {
          st.fontSizePx = v;
          void setSettings({ fontSizePx: v });
        })
      );

      // Khoảng cách EN↔VI — chỉ hiện ở Song ngữ; 2..16 bước 2
      if (st.mode === "both") {
        body.appendChild(
          stepperRow(ICON_GAP, "Khoảng cách", st.lineGapPx, GAP_MIN, GAP_MAX, GAP_STEP, clampGap, (v) => {
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


// TIP-094 — Logo icon "film-open-star", y hệt logo web app.studymovie.com (Header.tsx), thay "SM." cũ.
function logoNode(): HTMLElement {
  const d = div("logo");
  d.innerHTML =
    '<svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M36.025 11.9167L31.0017 5.42667L38.2067 3.99667L39.6367 11.1833L36.025 11.9167ZM30.635 12.9617L25.6117 6.49L22 7.205L27.0417 13.6767L30.635 12.9617ZM34.8333 23.8333C36.85 23.8333 38.72 24.3833 40.3333 25.3183V18.3333H3.66667V36.6667C3.66667 37.6391 4.05297 38.5718 4.74061 39.2594C5.42824 39.947 6.36087 40.3333 7.33333 40.3333H25.3183C24.3833 38.72 23.8333 36.85 23.8333 34.8333C23.8333 28.765 28.765 23.8333 34.8333 23.8333ZM7.62667 10.0833L5.83 10.4317C4.87976 10.6264 4.04463 11.188 3.50579 11.9945C2.96694 12.8011 2.76784 13.7876 2.95167 14.74L3.66667 18.3333L12.65 16.555L7.62667 10.0833ZM21.6517 14.7583L16.6283 8.25L13.0167 9.00167L18.0583 15.4733L21.6517 14.7583ZM42.1667 32.7983L36.8683 32.34L34.8333 27.5L32.7617 32.34L27.5 32.7983L31.4967 36.245L30.25 41.3967L34.8333 38.665L39.325 41.3967L38.1333 36.245L42.1667 32.7983Z" fill="currentColor"/></svg>';
  return d;
}

// TIP-094 — màn loading: logo + "StudyMovie" căn giữa layout, vòng tròn xoay bao quanh cả cụm.
function loadingScreen(): HTMLElement {
  const screen = div("loading-screen");
  const wrap = div("loading-ring-wrap");
  wrap.appendChild(div("loading-ring"));
  const content = div("loading-content");
  content.appendChild(logoNode());
  content.appendChild(div("loading-title", "StudyMovie"));
  wrap.appendChild(content);
  screen.appendChild(wrap);
  return screen;
}

// Footer: Đăng xuất + Hỗ trợ + Tắt/Bật StudyMovie (TIP-028, công tắc tổng phụ đề).
// TIP-093 — icon SVG cho footer (Đăng xuất/Hỗ trợ/Tắt StudyMovie), thay emoji cũ.
const ICON_LOGOUT =
  '<svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.625 5L9.74375 5.88125L10.7312 6.875H5.625V8.125H10.7312L9.74375 9.1125L10.625 10L13.125 7.5L10.625 5ZM3.125 3.125H7.5V1.875H3.125C2.4375 1.875 1.875 2.4375 1.875 3.125V11.875C1.875 12.5625 2.4375 13.125 3.125 13.125H7.5V11.875H3.125V3.125Z" fill="#1F1F1F" fill-opacity="0.5"/></svg>';
const ICON_SUPPORT =
  '<svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6.50017 1.08334C9.49179 1.08334 11.9168 3.50839 11.9168 6.50001C11.9168 9.49164 9.49179 11.9167 6.50017 11.9167C5.57823 11.918 4.67135 11.683 3.86604 11.2342L3.70083 11.1378L2.0585 11.6209C1.96913 11.6473 1.87451 11.6503 1.78361 11.6299C1.69272 11.6094 1.60856 11.566 1.53912 11.5039C1.46967 11.4418 1.41724 11.363 1.3868 11.2749C1.35636 11.1868 1.34891 11.0925 1.36517 11.0007L1.37925 10.9417L1.86242 9.29934C1.35165 8.45503 1.08224 7.4868 1.0835 6.50001C1.0835 3.50839 3.50854 1.08334 6.50017 1.08334ZM6.50017 2.16668C5.7243 2.16654 4.96262 2.37471 4.29468 2.76945C3.62674 3.1642 3.07703 3.73103 2.70296 4.41077C2.32888 5.09051 2.14417 5.85821 2.16811 6.63371C2.19205 7.40921 2.42376 8.16406 2.83904 8.81943C2.94629 8.98843 2.99233 9.19643 2.95604 9.4028L2.93492 9.49109L2.69604 10.3041L3.50908 10.0653C3.74363 9.99593 3.98738 10.0382 4.18075 10.1611C4.7486 10.5207 5.39229 10.7432 6.06095 10.8112C6.72962 10.8791 7.40492 10.7905 8.03347 10.5525C8.66202 10.3145 9.22659 9.93357 9.68255 9.43979C10.1385 8.94601 10.4734 8.35293 10.6606 7.70744C10.8479 7.06195 10.8825 6.38175 10.7616 5.72061C10.6407 5.05947 10.3677 4.4355 9.96412 3.89805C9.56055 3.36059 9.0375 2.92438 8.43631 2.62389C7.83512 2.3234 7.17227 2.16687 6.50017 2.16668ZM5.30471 5.30455C5.39798 5.21129 5.52208 5.15527 5.65371 5.14699C5.78535 5.13871 5.91549 5.17875 6.01971 5.25959L6.07063 5.30455L7.31267 6.54659L8.55471 5.30455C8.65219 5.20741 8.78299 5.151 8.92054 5.1468C9.0581 5.1426 9.19209 5.19092 9.29532 5.28194C9.39854 5.37296 9.46325 5.49985 9.4763 5.63685C9.48935 5.77385 9.44977 5.91068 9.36558 6.01955L9.32063 6.07047L7.69563 7.69547C7.60235 7.78873 7.47826 7.84476 7.34662 7.85303C7.21498 7.86131 7.08484 7.82127 6.98063 7.74043L6.92971 7.69547L5.68767 6.45343L4.44563 7.69547C4.34815 7.79262 4.21735 7.84902 4.07979 7.85322C3.94224 7.85742 3.80824 7.8091 3.70502 7.71808C3.60179 7.62707 3.53709 7.50017 3.52403 7.36317C3.51098 7.22617 3.55057 7.08934 3.63475 6.98047L3.67971 6.92955L5.30471 5.30455Z" fill="#1F1F1F" fill-opacity="0.5"/></svg>';
const ICON_POWER =
  '<svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#clip0_785_320)"><path d="M9.14063 1.92644C10.1475 2.50773 10.9343 3.405 11.3792 4.47909C11.8241 5.55317 11.9022 6.74405 11.6013 7.86702C11.3004 8.98999 10.6374 9.98229 9.71502 10.69C8.79268 11.3978 7.66259 11.7814 6.5 11.7814C5.33742 11.7814 4.20732 11.3978 3.28498 10.69C2.36264 9.98229 1.6996 8.98999 1.39871 7.86702C1.09781 6.74405 1.17586 5.55317 1.62076 4.47909C2.06566 3.405 2.85255 2.50773 3.85938 1.92644M6.5 1.21875V5.28125" stroke="#1F1F1F" stroke-opacity="0.5" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></g><defs><clipPath id="clip0_785_320"><rect width="13" height="13" fill="white"/></clipPath></defs></svg>';

function footerNode(onSignOut: () => void): HTMLElement {
  const f = div("footer");
  const out = iconTabButton(ICON_LOGOUT, "Đăng xuất", () => void onSignOut(), "footer-link");
  const help = iconTabButton(ICON_SUPPORT, "Hỗ trợ", () => openTab(`${SITE_URL}/ho-tro`), "footer-link");

  let enabled = true;
  const paint = (): void => {
    power.innerHTML = `${ICON_POWER}<span>${enabled ? "Tắt StudyMovie" : "Bật StudyMovie"}</span>`;
  };
  const power = iconTabButton(
    ICON_POWER,
    "Tắt StudyMovie",
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

  const submit = button(isReg ? "Tạo tài khoản" : "Đăng nhập", () => void onSubmit(), "auth-submit");

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

  // TIP-085 — Link đổi mode (dưới cùng): text tĩnh + link riêng (gạch chân), thay vì 1 nút gộp chữ.
  const toggle = div("auth-toggle");
  const toggleLabel = div("auth-toggle-label", isReg ? "Bạn đã có tài khoản" : "Bạn chưa có tài khoản");
  const toggleLink = button(
    isReg ? "Đăng nhập" : "Đăng ký",
    () => {
      authMode = isReg ? "login" : "register";
      renderLogin();
    },
    "auth-toggle-link"
  );
  toggle.append(toggleLabel, toggleLink);

  // TIP-052 — Tab segmented [Đăng nhập | Đăng ký] (nút của mode hiện tại = active).
  const authTabs = div("auth-tabs");
  const loginTab = iconTabButton(
    ICON_LOGIN,
    "Đăng nhập",
    () => {
      if (isReg) {
        authMode = "login";
        renderLogin();
      }
    },
    `auth-tab auth-tab-login${!isReg ? " active" : ""}`
  );
  const regTab = iconTabButton(
    ICON_REGISTER,
    "Đăng ký",
    () => {
      if (!isReg) {
        authMode = "register";
        renderLogin();
      }
    },
    `auth-tab auth-tab-register${isReg ? " active" : ""}`
  );
  authTabs.append(loginTab, regTab);

  const divider = div("auth-divider");
  divider.appendChild(document.createElement("span")).textContent = "hoặc";

  // Google — mở web để đăng nhập/đăng ký bằng Google (giữ hành vi cũ); text theo mode + logo Google thật.
  const google = iconTabButton(
    ICON_GOOGLE,
    isReg ? "Đăng ký bằng Google" : "Đăng nhập bằng Google",
    () => openTab(`${SITE_URL}/?login=google`), // TIP-055b: web tự chạy Google OAuth theo cờ
    "google-btn"
  );

  mount(
    authTabs,
    div("auth-title", isReg ? "Đăng ký tài khoản" : "Đăng nhập"),
    google,
    divider,
    div("auth-label auth-label-first", "Email"),
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
  mount(loadingScreen());
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

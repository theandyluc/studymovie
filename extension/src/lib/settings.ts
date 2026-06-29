// TIP-005 / TIP-015 — Settings phụ đề (EXT-04), lưu chrome.storage.local, áp realtime.
// TIP-015 gộp model cũ (enabled/mode/textColor/bgColor) → model mới theo Figma + khách:
//   2 toggle EN/VI độc lập, nền = ĐỘ ĐẬM nền đen (opacity %), cỡ chữ 12..32 bước 2.
//   Giữ NGUYÊN key `sm-ext-settings` (không tạo key trùng); field cũ trong storage bị bỏ qua.
export interface Settings {
  showEn: boolean; // hiển thị dòng EN
  showVi: boolean; // hiển thị dòng VI
  bgEnabled: boolean; // có nền đen mờ sau chữ không
  bgOpacity: number; // độ đậm nền đen, phần trăm 0..100
  fontSizePx: number; // cỡ chữ overlay (px) — 12..32, bước 2
}

export const SETTINGS_KEY = "sm-ext-settings";

export const DEFAULT_SETTINGS: Settings = {
  showEn: true,
  showVi: true,
  bgEnabled: true,
  bgOpacity: 20,
  fontSizePx: 20,
};

// Giới hạn cỡ chữ (Design): 12..32, bước 2.
export const FONT_MIN = 12;
export const FONT_MAX = 32;
export const FONT_STEP = 2;
export function clampFont(px: number): number {
  const v = Math.round(px / FONT_STEP) * FONT_STEP;
  return Math.min(FONT_MAX, Math.max(FONT_MIN, v));
}

// Chuẩn hoá: chỉ giữ field hợp lệ của model mới + clamp (bỏ field cũ enabled/mode/textColor/bgColor).
function normalize(raw: Partial<Settings> | undefined): Settings {
  const s = { ...DEFAULT_SETTINGS, ...(raw ?? {}) };
  return {
    showEn: !!s.showEn,
    showVi: !!s.showVi,
    bgEnabled: !!s.bgEnabled,
    bgOpacity: Math.min(100, Math.max(0, Math.round(Number(s.bgOpacity) || 0))),
    fontSizePx: clampFont(Number(s.fontSizePx) || DEFAULT_SETTINGS.fontSizePx),
  };
}

export function getSettings(): Promise<Settings> {
  return new Promise((resolve) => {
    chrome.storage.local.get(SETTINGS_KEY, (r) => {
      resolve(normalize(r?.[SETTINGS_KEY] as Partial<Settings> | undefined));
    });
  });
}

export async function setSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = normalize({ ...(await getSettings()), ...patch });
  return new Promise((resolve) => {
    chrome.storage.local.set({ [SETTINGS_KEY]: next }, () => resolve(next));
  });
}

export function onSettingsChange(cb: (s: Settings) => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[SETTINGS_KEY]) {
      cb(normalize(changes[SETTINGS_KEY].newValue as Partial<Settings> | undefined));
    }
  });
}

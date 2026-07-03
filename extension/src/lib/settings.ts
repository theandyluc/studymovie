// TIP-005 / TIP-015 / TIP-023 — Settings phụ đề (EXT-04), lưu chrome.storage.local, áp realtime.
// TIP-023 mở rộng: mode (en/both/vi) + màu chữ riêng EN/VI + khoảng cách dòng (mode=both).
//   Giữ NGUYÊN key `sm-ext-settings`; MIGRATE model TIP-015 (showEn/showVi) → mode. Field cũ bỏ qua an toàn.
export type SubMode = "en" | "both" | "vi";
export type SubColor = "white" | "black" | "yellow";

export interface Settings {
  enabled: boolean; // TIP-028: công tắc TỔNG bật/tắt toàn bộ phụ đề StudyMovie
  mode: SubMode; // Tiếng Anh / Song ngữ / Tiếng Việt
  enColor: SubColor; // màu chữ dòng EN
  viColor: SubColor; // màu chữ dòng VI
  bgEnabled: boolean; // nền mờ sau chữ
  bgColor: "black" | "white"; // TIP-060b: màu nền phụ đề, chỉ đen ↔ trắng
  bgOpacity: number; // độ đậm nền, % 0..100
  fontSizePx: number; // cỡ chữ EN (px) — 12..32 bước 2; VI = 80% EN
  lineGapPx: number; // khoảng cách dọc EN↔VI (px) — 2..16 bước 2, chỉ dùng mode='both'
}

export const SETTINGS_KEY = "sm-ext-settings";

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  mode: "both",
  enColor: "white",
  viColor: "white",
  bgEnabled: true,
  bgColor: "black",
  bgOpacity: 20,
  fontSizePx: 20,
  lineGapPx: 8,
};

// Cỡ chữ EN: 12..32 bước 2.
export const FONT_MIN = 12;
export const FONT_MAX = 32;
export const FONT_STEP = 2;
export function clampFont(px: number): number {
  const v = Math.round(px / FONT_STEP) * FONT_STEP;
  return Math.min(FONT_MAX, Math.max(FONT_MIN, v));
}

// Khoảng cách dòng: 2..16 bước 2.
export const GAP_MIN = 2;
export const GAP_MAX = 16;
export const GAP_STEP = 2;
export function clampGap(px: number): number {
  const v = Math.round(px / GAP_STEP) * GAP_STEP;
  return Math.min(GAP_MAX, Math.max(GAP_MIN, v));
}

// Map màu chữ → hex.
export const COLOR_HEX: Record<SubColor, string> = {
  white: "#ffffff",
  black: "#000000",
  yellow: "#f5c518",
};

const MODES: SubMode[] = ["en", "both", "vi"];
const COLORS: SubColor[] = ["white", "black", "yellow"];

// Chuẩn hoá + MIGRATE: ưu tiên field mới; nếu thiếu mode → suy từ showEn/showVi (TIP-015).
function normalize(raw: Record<string, unknown> | undefined): Settings {
  const r = raw ?? {};

  let mode: SubMode;
  if (typeof r.mode === "string" && MODES.includes(r.mode as SubMode)) {
    mode = r.mode as SubMode;
  } else {
    // Migrate TIP-015: showEn/showVi → mode.
    const showEn = r.showEn !== false; // mặc định true nếu thiếu
    const showVi = r.showVi !== false;
    if (showEn && !showVi) mode = "en";
    else if (!showEn && showVi) mode = "vi";
    else mode = "both"; // cả hai bật, hoặc cả hai tắt → both (default)
  }

  const color = (v: unknown): SubColor =>
    typeof v === "string" && COLORS.includes(v as SubColor) ? (v as SubColor) : "white";

  return {
    enabled: r.enabled !== false, // mặc định true nếu thiếu
    mode,
    enColor: color(r.enColor),
    viColor: color(r.viColor),
    bgEnabled: r.bgEnabled !== false,
    bgColor: r.bgColor === "white" ? "white" : "black", // TIP-060b: đen ↔ trắng, mặc định đen

    bgOpacity: Math.min(100, Math.max(0, Math.round(Number(r.bgOpacity ?? DEFAULT_SETTINGS.bgOpacity) || 0))),
    fontSizePx: clampFont(Number(r.fontSizePx) || DEFAULT_SETTINGS.fontSizePx),
    lineGapPx: clampGap(Number(r.lineGapPx) || DEFAULT_SETTINGS.lineGapPx),
  };
}

export function getSettings(): Promise<Settings> {
  return new Promise((resolve) => {
    chrome.storage.local.get(SETTINGS_KEY, (r) => {
      resolve(normalize(r?.[SETTINGS_KEY] as Record<string, unknown> | undefined));
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
      cb(normalize(changes[SETTINGS_KEY].newValue as Record<string, unknown> | undefined));
    }
  });
}

// TIP-005 — Settings phụ đề (EXT-04), lưu chrome.storage.local, áp dụng realtime.
export type SubtitleMode = "both" | "en" | "vi";

export interface Settings {
  enabled: boolean;
  mode: SubtitleMode;
  fontSize: number; // px
  textColor: string; // hex
  bgColor: string; // hex
  bgOpacity: number; // 0..1
}

export const SETTINGS_KEY = "sm-ext-settings";

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  mode: "both",
  fontSize: 22,
  textColor: "#ffffff",
  bgColor: "#000000",
  bgOpacity: 0.6,
};

export function getSettings(): Promise<Settings> {
  return new Promise((resolve) => {
    chrome.storage.local.get(SETTINGS_KEY, (r) => {
      const stored = (r?.[SETTINGS_KEY] as Partial<Settings> | undefined) ?? {};
      resolve({ ...DEFAULT_SETTINGS, ...stored });
    });
  });
}

export async function setSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  return new Promise((resolve) => {
    chrome.storage.local.set({ [SETTINGS_KEY]: next }, () => resolve(next));
  });
}

export function onSettingsChange(cb: (s: Settings) => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[SETTINGS_KEY]) {
      const v = (changes[SETTINGS_KEY].newValue as Partial<Settings> | undefined) ?? {};
      cb({ ...DEFAULT_SETTINGS, ...v });
    }
  });
}

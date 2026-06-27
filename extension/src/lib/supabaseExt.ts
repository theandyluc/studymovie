// TIP-004 — Supabase client cho extension.
// Storage adapter = chrome.storage.local; autoRefreshToken để tự gia hạn access_token.
// CHỈ anon key (build-time). KHÔNG service_role.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./env";

const chromeStorageAdapter = {
  getItem: (key: string): Promise<string | null> =>
    new Promise((resolve) => {
      chrome.storage.local.get(key, (r) => resolve((r?.[key] as string | undefined) ?? null));
    }),
  setItem: (key: string, value: string): Promise<void> =>
    new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, () => resolve());
    }),
  removeItem: (key: string): Promise<void> =>
    new Promise((resolve) => {
      chrome.storage.local.remove(key, () => resolve());
    }),
};

export const EXT_STORAGE_KEY = "sm-ext-auth";

export const supabaseExt: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: chromeStorageAdapter,
    storageKey: EXT_STORAGE_KEY,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

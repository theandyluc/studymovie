// TIP-011 — Logic playlist (tách khỏi presentation).
import { apiFetch } from "./apiClient";

export interface PlaylistItem {
  id: string;
  youtube_url: string;
  video_id: string;
  title: string | null;
  thumbnail_url: string | null;
  is_done: boolean;
  created_at: string;
}

export const fetchPlaylist = (): Promise<PlaylistItem[]> =>
  apiFetch<{ items: PlaylistItem[] }>("/api/playlist").then((r) => r.items);

export const addPlaylist = (url: string): Promise<PlaylistItem> =>
  apiFetch<{ item: PlaylistItem }>("/api/playlist", { method: "POST", body: JSON.stringify({ url }) }).then(
    (r) => r.item
  );

export const setPlaylistDone = (id: string, is_done: boolean): Promise<PlaylistItem> =>
  apiFetch<{ item: PlaylistItem }>(`/api/playlist/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ is_done }),
  }).then((r) => r.item);

export const deletePlaylistItem = (id: string): Promise<boolean> =>
  apiFetch<{ deleted: boolean }>(`/api/playlist/${id}`, { method: "DELETE" }).then((r) => r.deleted);

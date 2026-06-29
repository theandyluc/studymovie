"use client";
import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageLoading } from "@/components/ui/Spinner";
import { ApiError } from "@/lib/apiClient";
import { fetchPlaylist, addPlaylist, setPlaylistDone, deletePlaylistItem, type PlaylistItem } from "@/lib/playlist";

// Map lỗi thêm video sang thông báo thân thiện (KHÔNG lộ HTTP/đường dẫn API).
function friendlyAddError(e: unknown): string {
  if (e instanceof ApiError && e.code === "invalid_youtube_url") {
    return "Link không hợp lệ. Vui lòng dán link YouTube (youtube.com hoặc youtu.be).";
  }
  return "Không thêm được video. Vui lòng thử lại.";
}

// WEB-06 — Playlist video YouTube: dán link → thumbnail+tiêu đề tự động → Học/done/xóa.
function PlaylistInner() {
  const [items, setItems] = useState<PlaylistItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [addErr, setAddErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetchPlaylist()
      .then(setItems)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const onAdd = async () => {
    if (!url.trim()) return;
    setAdding(true);
    setAddErr(null);
    try {
      const item = await addPlaylist(url.trim());
      setItems((cur) => [item, ...(cur ?? [])]);
      setUrl("");
    } catch (e) {
      setAddErr(friendlyAddError(e));
    } finally {
      setAdding(false);
    }
  };

  const toggleDone = async (it: PlaylistItem) => {
    setBusy(it.id);
    try {
      const updated = await setPlaylistDone(it.id, !it.is_done);
      setItems((cur) => (cur ?? []).map((x) => (x.id === it.id ? updated : x)));
    } catch (e) {
      alert("Lỗi: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (it: PlaylistItem) => {
    if (!confirm(`Xóa "${it.title ?? it.video_id}"?`)) return;
    setBusy(it.id);
    try {
      await deletePlaylistItem(it.id);
      setItems((cur) => (cur ?? []).filter((x) => x.id !== it.id));
    } catch (e) {
      alert("Lỗi: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  };

  if (error) return <Card><p className="text-sm text-red-600">Không tải được playlist: {error}</p></Card>;

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl font-bold">Playlist</h1>

      <Card className="space-y-2">
        <label className="text-sm text-muted-foreground">Dán link YouTube để thêm vào danh sách học</label>
        <div className="flex flex-wrap gap-2">
          <input
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setAddErr(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void onAdd();
            }}
            placeholder="https://www.youtube.com/watch?v=…"
            className="min-w-0 flex-1 rounded-btn border border-border px-3 py-2 text-sm"
          />
          <Button onClick={onAdd} disabled={adding || !url.trim()}>
            {adding ? "Đang thêm…" : "Thêm"}
          </Button>
        </div>
        {addErr ? <p className="text-sm text-red-600">{addErr}</p> : null}
      </Card>

      {!items ? (
        <PageLoading label="Đang tải playlist…" />
      ) : items.length === 0 ? (
        <Card>
          <p className="text-muted-foreground">Chưa có video. Dán link YouTube ở trên để thêm.</p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.id}>
              <Card className={`flex items-center gap-3 p-3 ${it.is_done ? "opacity-60" : ""}`}>
                {it.thumbnail_url ? (
                  // <img> (không next/image) cho thumbnail YouTube ngoài domain — placeholder.
                  <img src={it.thumbnail_url} alt="" className="h-12 w-20 flex-shrink-0 rounded object-cover" />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-medium ${it.is_done ? "line-through" : ""}`}>
                    {it.title ?? it.video_id}
                  </p>
                  <p className="text-xs text-muted-foreground">{it.is_done ? "✓ Đã học" : "Chưa học"}</p>
                </div>
                <a href={it.youtube_url} target="_blank" rel="noreferrer">
                  <Button>Học</Button>
                </a>
                <Button variant="ghost" disabled={busy === it.id} onClick={() => toggleDone(it)}>
                  {it.is_done ? "Bỏ ✓" : "Xong"}
                </Button>
                <Button variant="ghost" disabled={busy === it.id} onClick={() => remove(it)}>
                  Xóa
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function PlaylistPage() {
  return (
    <AuthGuard>
      <PlaylistInner />
    </AuthGuard>
  );
}

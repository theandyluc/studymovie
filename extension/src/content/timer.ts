// TIP-010 — Auto study timer (ISOLATED content script trên YouTube).
// Đo WALL-CLOCK thời gian video đang PHÁT; flush delta (giây) qua background SM_API → backend.
// - Chỉ tính khi !paused && !ended. Tua/seek dùng wall-clock nên KHÔNG cộng bước nhảy.
// - Không spam: gom local, flush khi pause/ended/đổi video/ẩn tab + định kỳ 60s.
// - Gửi DELTA (đã trừ phần đã gửi) → chống double-count.

const FLUSH_INTERVAL_MS = 60_000;
const MAX_FLUSH_SEC = 3600; // chặn giá trị vô lý/lần flush (backend cũng validate)

let playing = false;
let lastTick = 0; // performance.now() mốc bắt đầu đoạn phát hiện tại
let accumMs = 0; // thời gian phát chưa flush
let attached: HTMLVideoElement | null = null;

const nowMs = (): number => performance.now();
const getVideo = (): HTMLVideoElement | null =>
  (document.querySelector("video.html5-main-video") as HTMLVideoElement | null) ??
  (document.querySelector("video") as HTMLVideoElement | null);

// Dồn thời gian đoạn đang phát vào accum (gọi trước mọi thay đổi trạng thái/flush).
function bank(): void {
  if (playing) {
    accumMs += nowMs() - lastTick;
    lastTick = nowMs();
  }
}
function startPlaying(): void {
  if (playing) return;
  playing = true;
  lastTick = nowMs();
}
function stopPlaying(): void {
  bank();
  playing = false;
}

function flush(): void {
  bank();
  const whole = Math.floor(accumMs / 1000);
  if (whole <= 0) return;
  accumMs -= whole * 1000; // giữ phần lẻ < 1s cho lần sau
  const duration_sec = Math.min(whole, MAX_FLUSH_SEC);
  try {
    chrome.runtime.sendMessage(
      { type: "SM_API", method: "POST", path: "/api/study-session", body: { duration_sec } },
      () => void chrome.runtime.lastError // nuốt lỗi nếu background ngủ
    );
  } catch {
    /* ignore */
  }
}

function attach(): void {
  const v = getVideo();
  if (!v || v === attached) return; // chỉ gắn 1 lần / mỗi element (tránh listener trùng)
  attached = v;
  v.addEventListener("playing", startPlaying);
  v.addEventListener("play", startPlaying);
  v.addEventListener("pause", () => {
    stopPlaying();
    flush();
  });
  v.addEventListener("ended", () => {
    stopPlaying();
    flush();
  });
  v.addEventListener("emptied", () => {
    // đổi video / src bị clear → chốt thời gian video trước
    stopPlaying();
    flush();
  });
  if (!v.paused && !v.ended) startPlaying();
}

setInterval(attach, 1000); // bám video (SPA có thể thay element)
setInterval(() => {
  if (playing) flush();
}, FLUSH_INTERVAL_MS);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) flush(); // tránh mất dữ liệu khi ẩn tab; vẫn tiếp tục tính nếu còn phát
});
window.addEventListener("pagehide", flush);
document.addEventListener("yt-navigate-finish", flush);

attach();

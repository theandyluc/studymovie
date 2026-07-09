// TIP-101 — Ghép cụm ASR rời rạc (YouTube auto-caption) thành câu hoàn chỉnh.
// Hàm thuần, không gọi AI, không I/O — có thể tinh chỉnh threshold tự do (backend-only,
// không cần cập nhật extension qua Chrome Web Store).
export interface RawCue {
  start: number;
  dur: number;
  text: string;
}

export interface GroupConfig {
  gapBreakSec: number; // khoảng lặng giữa 2 cụm >= ngưỡng này -> ngắt câu
  maxGroupDurSec: number; // trần thời lượng 1 câu ghép (nói liên tục không ngừng)
  maxGroupChars: number; // trần số ký tự 1 câu ghép
}

// TIP-101 — hạ trần lần 2 (100 ký tự/7s vẫn bị khách phản hồi "còn dài"). Về sát khung phụ đề
// phim thật (1 dòng ngắn, ~5s đọc kịp): 60 ký tự, 5 giây.
export const DEFAULT_GROUP_CONFIG: GroupConfig = {
  gapBreakSec: 0.9,
  maxGroupDurSec: 5,
  maxGroupChars: 60,
};

// TIP-101 — số câu tối đa dịch trong 1 lần gọi. Trần AN TOÀN cuối cùng phía backend (extension
// tự giới hạn nhỏ hơn — CHUNK_COUNT=15 — nhưng vẫn chặn ở đây phòng client cũ/lỗi gửi count lớn).
// Từng thử 50: log Vercel cho thấy lô 30-50 câu hay khiến OpenAI trả lời vượt timeout.
export const TRANSLATE_BATCH_SIZE = 20;

const SENTENCE_END = /[.!?]["')\]]?$/;

// TIP-101c — thuật toán bên dưới CHỈ GHÉP cụm ASR lại (làm dài hơn) chứ không bao giờ tách
// nhỏ — nên nếu 1 cụm GỐC (YouTube auto-caption trả về) tự nó đã dài hơn maxGroupChars, trần
// không có tác dụng (câu vẫn hiện dài nguyên, kéo bản dịch VI dài theo). Tách trước ở đây theo
// ranh giới từ, chia thời lượng gốc theo tỉ lệ số ký tự mỗi phần (ASR không cho mốc thời gian
// giữa câu nên đây là ước lượng hợp lý, không lệch nhiều với tốc độ nói đều).
function splitOverlongCue(cue: RawCue, maxChars: number): RawCue[] {
  if (cue.text.length <= maxChars) return [cue];
  const words = cue.text.split(/\s+/);
  const parts: string[] = [];
  let curr = "";
  for (const w of words) {
    const next = curr ? `${curr} ${w}` : w;
    if (curr && next.length > maxChars) {
      parts.push(curr);
      curr = w;
    } else {
      curr = next;
    }
  }
  if (curr) parts.push(curr);

  const totalChars = parts.reduce((s, p) => s + p.length, 0) || 1;
  const out: RawCue[] = [];
  let t = cue.start;
  for (const p of parts) {
    const dur = (p.length / totalChars) * cue.dur;
    out.push({ start: t, dur, text: p });
    t += dur;
  }
  return out;
}

export function groupIntoSentences(cues: RawCue[], cfg: GroupConfig = DEFAULT_GROUP_CONFIG): RawCue[] {
  const expanded = cues.flatMap((c) => splitOverlongCue(c, cfg.maxGroupChars));
  const out: RawCue[] = [];
  let bucket: RawCue[] = [];

  const flush = (): void => {
    if (bucket.length === 0) return;
    const first = bucket[0];
    const last = bucket[bucket.length - 1];
    out.push({
      start: first.start,
      dur: last.start + last.dur - first.start,
      text: bucket.map((c) => c.text).join(" ").replace(/\s+/g, " ").trim(),
    });
    bucket = [];
  };

  for (const cue of expanded) {
    if (bucket.length === 0) {
      bucket.push(cue);
      continue;
    }
    const first = bucket[0];
    const prev = bucket[bucket.length - 1];
    const gap = cue.start - (prev.start + prev.dur);
    const wouldDur = cue.start + cue.dur - first.start;
    const wouldChars = bucket.map((c) => c.text).join(" ").length + 1 + cue.text.length;
    // Cụm TRƯỚC đã kết thúc câu (dấu chấm/hỏi/than) -> ngắt TRƯỚC KHI gộp cụm mới vào,
    // dù khoảng lặng giữa 2 cụm rất nhỏ (nói liền không nghỉ nhưng đã hết câu).
    const prevEndsSentence = SENTENCE_END.test(prev.text);

    if (prevEndsSentence || gap >= cfg.gapBreakSec || wouldDur > cfg.maxGroupDurSec || wouldChars > cfg.maxGroupChars) {
      flush();
      bucket.push(cue);
      continue;
    }

    bucket.push(cue);
  }
  flush();

  return out.filter((c) => c.text.length > 0);
}

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

// TIP-101 — hạ trần so với thử nghiệm ban đầu (12s/200 ký tự): hội thoại ASR ít dấu câu hay
// gộp sát trần cũ, ra câu quá dài khó đọc trên phụ đề. Chuẩn phụ đề thông thường ~1-7s hiển thị,
// ~80-100 ký tự/dòng — hạ về mức này.
export const DEFAULT_GROUP_CONFIG: GroupConfig = {
  gapBreakSec: 0.9,
  maxGroupDurSec: 7,
  maxGroupChars: 100,
};

// TIP-101 — số câu tối đa dịch trong 1 lần gọi. Trần AN TOÀN cuối cùng phía backend (extension
// tự giới hạn nhỏ hơn — CHUNK_COUNT=15 — nhưng vẫn chặn ở đây phòng client cũ/lỗi gửi count lớn).
// Từng thử 50: log Vercel cho thấy lô 30-50 câu hay khiến OpenAI trả lời vượt timeout.
export const TRANSLATE_BATCH_SIZE = 20;

const SENTENCE_END = /[.!?]["')\]]?$/;

export function groupIntoSentences(cues: RawCue[], cfg: GroupConfig = DEFAULT_GROUP_CONFIG): RawCue[] {
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

  for (const cue of cues) {
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

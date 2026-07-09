import { describe, expect, it } from "vitest";
import { groupIntoSentences } from "../src/lib/sentence-group.js";

describe("groupIntoSentences", () => {
  it("ghép các cụm liền mạch (gap nhỏ) thành 1 câu", () => {
    const cues = [
      { start: 0, dur: 0.5, text: "Hello" },
      { start: 0.5, dur: 0.5, text: "there," },
      { start: 1.0, dur: 0.5, text: "how are you?" },
    ];
    const out = groupIntoSentences(cues);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({ start: 0, dur: 1.5, text: "Hello there, how are you?" });
  });

  it("ngắt câu khi khoảng lặng >= ngưỡng", () => {
    const cues = [
      { start: 0, dur: 1, text: "First sentence" },
      { start: 3, dur: 1, text: "Second sentence" }, // gap = 2s >= 0.9s
    ];
    const out = groupIntoSentences(cues);
    expect(out).toHaveLength(2);
    expect(out[0].text).toBe("First sentence");
    expect(out[1].text).toBe("Second sentence");
  });

  it("ngắt câu ngay khi có dấu câu kết thúc, dù gap nhỏ", () => {
    const cues = [
      { start: 0, dur: 1, text: "Okay." },
      { start: 1.1, dur: 1, text: "Next one." },
    ];
    const out = groupIntoSentences(cues);
    expect(out).toHaveLength(2);
  });

  it("ngắt khi vượt trần thời lượng (nói liên tục không ngắt)", () => {
    const cues = Array.from({ length: 30 }, (_, i) => ({ start: i, dur: 1, text: `w${i}` }));
    const out = groupIntoSentences(cues, { gapBreakSec: 0.9, maxGroupDurSec: 12, maxGroupChars: 1000 });
    expect(out.length).toBeGreaterThan(1);
    for (const g of out) expect(g.dur).toBeLessThanOrEqual(12);
  });

  it("mảng rỗng trả về mảng rỗng", () => {
    expect(groupIntoSentences([])).toEqual([]);
  });

  it("tách cụm GỐC đã dài hơn maxGroupChars (bug: trước đây thuật toán chỉ ghép, không tách)", () => {
    const longText = "This is one single very long ASR chunk that already exceeds the cap by itself";
    const cues = [{ start: 0, dur: 10, text: longText }];
    const out = groupIntoSentences(cues, { gapBreakSec: 0.9, maxGroupDurSec: 100, maxGroupChars: 20 });
    expect(out.length).toBeGreaterThan(1);
    for (const g of out) expect(g.text.length).toBeLessThanOrEqual(20);
    // Ghép lại đúng nội dung gốc (không mất/lặp từ) và mốc thời gian còn trong khoảng cue gốc.
    expect(out.map((g) => g.text).join(" ")).toBe(longText);
    expect(out[0].start).toBe(0);
    expect(out[out.length - 1].start + out[out.length - 1].dur).toBeCloseTo(10, 5);
  });

  it("cụm gốc ngắn hơn/bằng trần thì không bị tách", () => {
    const cues = [{ start: 0, dur: 1, text: "short" }];
    const out = groupIntoSentences(cues, { gapBreakSec: 0.9, maxGroupDurSec: 100, maxGroupChars: 60 });
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("short");
  });
});

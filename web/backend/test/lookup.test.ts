import { afterEach, describe, expect, it, vi } from "vitest";
import { firstIpa, freeDictLookup, isLikelyTruncatedIpa, lemmaCandidates } from "../src/api/lookup.js";

describe("lemmaCandidates", () => {
  it("thử từ gốc trước tiên", () => {
    expect(lemmaCandidates("communication")[0]).toBe("communication");
  });

  it("ưu tiên dạng phụ âm đôi rút gọn cho '-ing' (getting -> get lọt top 4)", () => {
    const cands = lemmaCandidates("getting").slice(0, 4);
    expect(cands).toContain("get");
  });

  it("running -> run lọt top 4", () => {
    expect(lemmaCandidates("running").slice(0, 4)).toContain("run");
  });

  it("không sinh ứng viên rác khi từ vừa khớp 'ies' vừa khớp 'es'/'s'", () => {
    const cands = lemmaCandidates("studies");
    expect(cands).toEqual(["studies", "study"]);
  });

  it("từ phủ định rút gọn thử thêm động từ gốc (doesn't -> does)", () => {
    const cands = lemmaCandidates("doesn't");
    expect(cands).toEqual(["doesn't", "does"]);
  });

  it("can't -> can (bất quy tắc, không phải cắt đuôi n't)", () => {
    expect(lemmaCandidates("can't")).toContain("can");
  });

  it("won't -> will (bất quy tắc hoàn toàn)", () => {
    expect(lemmaCandidates("won't")).toContain("will");
  });

  it("walked -> walk và fake đều có mặt", () => {
    const cands = lemmaCandidates("walked");
    expect(cands).toContain("walk");
  });
});

describe("firstIpa", () => {
  it("bỏ dấu / và chỉ lấy biến thể đầu tiên", () => {
    expect(firstIpa("/kəˌmjuːnɪˈkeɪʃən/")).toBe("kəˌmjuːnɪˈkeɪʃən");
  });

  it("nhiều biến thể phân tách bằng dấu phẩy -> lấy cái đầu", () => {
    expect(firstIpa("/tə'meɪtəʊ/, /tə'mɑːtəʊ/")).toBe("tə'meɪtəʊ");
  });

  it("null/rỗng -> null", () => {
    expect(firstIpa(null)).toBeNull();
  });
});

describe("isLikelyTruncatedIpa — phát hiện IPA bị cắt cụt (bug FVDP 'communication' -> 'co')", () => {
  it("gắn cờ IPA cực ngắn so với từ dài", () => {
    expect(isLikelyTruncatedIpa("co", "communication")).toBe(true);
  });

  it("không gắn cờ IPA hợp lệ, đầy đủ cho từ dài", () => {
    expect(isLikelyTruncatedIpa("/kəˌmjuːnɪˈkeɪʃən/", "communication")).toBe(false);
  });

  it("không gắn cờ nhầm với từ ngắn có IPA ngắn hợp lệ", () => {
    expect(isLikelyTruncatedIpa("kæt", "cat")).toBe(false);
  });

  it("null IPA -> không gắn cờ (not_found xử lý ở nơi khác)", () => {
    expect(isLikelyTruncatedIpa(null, "communication")).toBe(false);
  });
});

describe("freeDictLookup — bug: entry đầu chỉ có audio (không text) làm mất IPA thật ở entry sau", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("bỏ qua entry[0] không có text IPA, lấy đúng IPA ở entry[1] (case 'does' thật)", async () => {
    const fakeResponse = [
      {
        word: "does",
        phonetics: [{ audio: "https://x/does-1-us.mp3" }], // KHÔNG có text
        meanings: [{ partOfSpeech: "verb", definitions: [{ definition: "auxiliary marker" }] }],
      },
      {
        word: "does",
        phonetic: "/dəʊz/",
        phonetics: [{ text: "/dəʊz/", audio: "" }, { text: "/doʊz/", audio: "https://x/does-2-us.mp3" }],
        meanings: [{ partOfSpeech: "verb", definitions: [{ definition: "to perform" }] }],
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => fakeResponse })
    );
    const res = await freeDictLookup("does");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.ipa).toBe("dəʊz");
  });
});

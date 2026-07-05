// DEV-ONLY: dữ liệu giả để xem UI local khi chưa có backend/Supabase thật.
// Chỉ dùng khi NEXT_PUBLIC_DEV_FAKE_LOGIN=1 (xem apiClient.ts). Không dùng ở production.

const MOCK_DASHBOARD = {
  streak: 12,
  today_met: true,
  today_minutes: 750, // TIP-081 — khớp mock Figma "12h30m"
  daily_commit_minutes: 20,
  week: [
    { date: "2026-06-29", minutes: 25 },
    { date: "2026-06-30", minutes: 40 },
    { date: "2026-07-01", minutes: 0 },
    { date: "2026-07-02", minutes: 18 },
    { date: "2026-07-03", minutes: 22 },
    { date: "2026-07-04", minutes: 32 },
    { date: "2026-07-05", minutes: 0 },
  ],
  month: [],
  total_minutes: 2520, // TIP-081 — 42h, khớp MOCK_LEVEL.studied_hours (42) để 2 ô "Tổng thời gian đã học" và tooltip "Số giờ đã học" ở Mục tiêu tiếp theo cùng 1 số
  vocab_learned: 850,
};

// TIP-081 — top 5 + chính bạn ở hạng 6 (chưa lọt top 5) → hiện "ghim" bên dưới, đúng cơ chế pinRow có sẵn.
const MOCK_LEADERBOARD = {
  week_start: "2026-06-29",
  top: [
    { rank: 1, user_id: "u1", nickname: "Lục Nguyễn Nam Trường", avatar_url: null, minutes: 320 },
    { rank: 2, user_id: "u2", nickname: "Trần Thị Bảo Ngọc", avatar_url: null, minutes: 280 },
    { rank: 3, user_id: "u3", nickname: "Phạm Đức Minh Khoa", avatar_url: null, minutes: 250 },
    { rank: 4, user_id: "u4", nickname: "Đỗ Hoàng Gia Huy", avatar_url: null, minutes: 200 },
    { rank: 5, user_id: "u5", nickname: "Vũ Thị Thu Trang", avatar_url: null, minutes: 180 },
  ],
  caller: { rank: 6, user_id: "dev-fake-user", nickname: "Nguyễn Văn Minh Bạn", avatar_url: null, minutes: 150 },
};

const MOCK_ME = {
  user: { id: "dev-fake-user", email: "dev@local.test" },
  profile: { nickname: "Dev Local", avatar_url: null, is_admin: false },
  subscription: { status: "trial", trial_ends_at: null, paid_until: null },
  is_active: true,
};

interface VocabMock {
  id: string;
  word: string;
  lemma: string | null;
  ipa: string | null;
  meaning_vi: string | null;
  example: string | null;
  audio_url: string | null;
  learned_at: string | null;
  created_at: string;
}

// TIP-081 — learned_at trải đều đúng 7 ngày gần nhất (hôm nay 2026-07-05) để xem thử biểu đồ có số liệu.
function mockLearnedWord(id: string, word: string, meaning_vi: string, day: string, ipa: string | null = null): VocabMock {
  return {
    id,
    word,
    lemma: word,
    ipa,
    meaning_vi,
    example: null,
    audio_url: null,
    learned_at: `${day}T09:00:00Z`,
    created_at: `${day}T08:00:00Z`,
  };
}

// TIP-081 — "let" (không phải const): POST/DELETE bên dưới cần sửa mảng này thật, để "Thêm từ vựng"
// tạo đúng item mới (trước đây luôn trả MOCK_VOCAB_ITEMS[0] cố định → trùng key "v1", lỗi React).
let mockVocabItems: VocabMock[] = [
  {
    id: "v1",
    word: "example",
    lemma: "example",
    ipa: "/ɪɡˈzæmpəl/",
    meaning_vi: "ví dụ",
    example: "This is an example sentence.",
    audio_url: null,
    learned_at: null,
    created_at: "2026-07-05T00:00:00Z",
  },
  {
    id: "v3",
    word: "journey",
    lemma: "journey",
    ipa: "/ˈdʒɜːni/",
    meaning_vi: "hành trình",
    example: "Learning English is a long journey.",
    audio_url: null,
    learned_at: null,
    created_at: "2026-07-03T00:00:00Z",
  },
  // 06-29: 2 từ
  mockLearnedWord("d1a", "apple", "quả táo", "2026-06-29", "/ˈæpəl/"),
  mockLearnedWord("d1b", "banana", "quả chuối", "2026-06-29", "/bəˈnɑːnə/"),
  // 06-30: 4 từ
  mockLearnedWord("d2a", "practice", "luyện tập", "2026-06-30", "/ˈpræktɪs/"),
  mockLearnedWord("d2b", "school", "trường học", "2026-06-30", "/skuːl/"),
  mockLearnedWord("d2c", "teacher", "giáo viên", "2026-06-30", "/ˈtiːtʃər/"),
  mockLearnedWord("d2d", "student", "học sinh", "2026-06-30", "/ˈstuːdənt/"),
  // 07-01: 1 từ
  mockLearnedWord("d3a", "river", "dòng sông", "2026-07-01", "/ˈrɪvər/"),
  // 07-02: 3 từ
  mockLearnedWord("d4a", "mountain", "ngọn núi", "2026-07-02", "/ˈmaʊntən/"),
  mockLearnedWord("d4b", "forest", "khu rừng", "2026-07-02", "/ˈfɔːrɪst/"),
  mockLearnedWord("d4c", "ocean", "đại dương", "2026-07-02", "/ˈoʊʃən/"),
  // 07-03: 5 từ
  mockLearnedWord("d5a", "achieve", "đạt được", "2026-07-03", "/əˈtʃiːv/"),
  mockLearnedWord("d5b", "success", "thành công", "2026-07-03", "/səkˈsɛs/"),
  mockLearnedWord("d5c", "effort", "nỗ lực", "2026-07-03", "/ˈɛfərt/"),
  mockLearnedWord("d5d", "goal", "mục tiêu", "2026-07-03", "/ɡoʊl/"),
  mockLearnedWord("d5e", "dream", "ước mơ", "2026-07-03", "/driːm/"),
  // 07-04: 2 từ
  mockLearnedWord("d6a", "weather", "thời tiết", "2026-07-04", "/ˈwɛðər/"),
  mockLearnedWord("d6b", "season", "mùa", "2026-07-04", "/ˈsiːzən/"),
  // 07-05 (hôm nay): 3 từ
  mockLearnedWord("d7a", "morning", "buổi sáng", "2026-07-05", "/ˈmɔːrnɪŋ/"),
  mockLearnedWord("d7b", "coffee", "cà phê", "2026-07-05", "/ˈkɔːfi/"),
  mockLearnedWord("d7c", "energy", "năng lượng", "2026-07-05", "/ˈɛnərdʒi/"),
];
let mockVocabSeq = 100; // id mới bắt đầu "v100" để không đụng id có sẵn (v1, v3, d1a...)

// TIP-081 — bảng IPA tạm cho mock POST /api/vocabulary (xem giải thích ở nơi dùng bên dưới).
const MOCK_IPA_LOOKUP: Record<string, string> = {
  example: "/ɪɡˈzæmpəl/",
  journey: "/ˈdʒɜːni/",
  apple: "/ˈæpəl/",
  banana: "/bəˈnɑːnə/",
  practice: "/ˈpræktɪs/",
  school: "/skuːl/",
  teacher: "/ˈtiːtʃər/",
  student: "/ˈstuːdənt/",
  river: "/ˈrɪvər/",
  mountain: "/ˈmaʊntən/",
  forest: "/ˈfɔːrɪst/",
  ocean: "/ˈoʊʃən/",
  achieve: "/əˈtʃiːv/",
  success: "/səkˈsɛs/",
  effort: "/ˈɛfərt/",
  goal: "/ɡoʊl/",
  dream: "/driːm/",
  weather: "/ˈwɛðər/",
  season: "/ˈsiːzən/",
  morning: "/ˈmɔːrnɪŋ/",
  coffee: "/ˈkɔːfi/",
  energy: "/ˈɛnərdʒi/",
  // vài từ phổ biến khác hay dùng để test tay:
  hello: "/həˈloʊ/",
  world: "/wɜːrld/",
  book: "/bʊk/",
  water: "/ˈwɔːtər/",
  house: "/haʊs/",
  friend: "/frɛnd/",
  family: "/ˈfæməli/",
  work: "/wɜːrk/",
  time: "/taɪm/",
  love: "/lʌv/",
};

const MOCK_ACCESS_STATUS = {
  has_access: true,
  reason: "trial",
  trial_expires_at: null,
  paid_until: null,
};

const MOCK_LEVEL = {
  current_level: "A2",
  target_level: "B1",
  target_hours: 100,
  studied_hours: 42 + 35 / 60, // TIP-081 — test 42h35m → tooltip phải tự làm tròn "42,6h"
  remaining_hours: 58,
  percent: 42,
};

const MOCK_PLAYLIST_ITEMS = [
  {
    id: "p1",
    youtube_url: "https://youtube.com/watch?v=dev",
    video_id: "dev",
    title: "Video mẫu (dev)",
    thumbnail_url: null,
    is_done: false,
    created_at: "2026-07-01T00:00:00Z",
  },
];

// TIP-081 — "let" (không phải const): PATCH/POST/DELETE bên dưới cần sửa được mảng này thật sự,
// để tick "Hoàn thành?" hay Sửa nội dung phản ánh đúng lên UI thay vì luôn trả về item cố định.
let mockWeeklyPlanItems = [
  {
    id: "w1",
    plan_date: "2026-07-05",
    video_link: "https://youtube.com/watch?v=dev",
    committed_time: "02h30m",
    done: false,
    created_at: "2026-07-01T00:00:00Z",
  },
];
let mockWeeklyPlanSeq = 2;

const MOCK_PAYMENT_ORDER = {
  code: "DEV123",
  amount: 49000,
  qr_url: "",
  bank: { bank_id: "MB", account_no: "0000000000", account_name: "DEV LOCAL" },
  content: "SM DEV123",
};

const MOCK_ORDER_STATUS = { code: "DEV123", amount: 49000, status: "pending", paid_at: null };

/** Trả mock JSON theo path+method, hoặc undefined nếu không match (fallback ra network thật). */
export function resolveDevMock(path: string, method: string, body?: string): unknown | undefined {
  const p = path.split("?")[0];
  const m = method.toUpperCase();
  const parsedBody = (): Record<string, unknown> => {
    try {
      return body ? (JSON.parse(body) as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  };

  if (p === "/api/dashboard" && m === "GET") return MOCK_DASHBOARD;
  if (p === "/api/leaderboard" && m === "GET") return MOCK_LEADERBOARD;
  if (p === "/api/me" && m === "GET") return MOCK_ME;
  if (p === "/api/profile") return { profile: MOCK_ME.profile };
  // TIP-081 — mock GET /api/lookup (tra từ điển IPA/audio, dùng bởi addVocab trước khi lưu).
  // Tra bảng MOCK_IPA_LOOKUP tạm (không phải dictionary thật) — từ không có trong bảng → not_found,
  // khớp đúng hành vi thật khi từ chưa có trong dictionary.
  if (p === "/api/lookup" && m === "GET") {
    const word = new URLSearchParams(path.split("?")[1] ?? "").get("word")?.trim().toLowerCase() ?? "";
    const ipa = MOCK_IPA_LOOKUP[word];
    if (!ipa) return { word, result: null, status: "not_found", message: null };
    return { word, result: { lemma: word, ipa, meanings: [], audio_url: null, source: "mock" } };
  }
  if (p === "/api/vocabulary" && m === "GET") return { items: mockVocabItems };
  if (p === "/api/vocabulary" && m === "POST") {
    const b = parsedBody();
    const word = ((b.word as string) ?? "").trim();
    const meaning_vi = (b.meaning_vi as string) ?? "";
    const existing = mockVocabItems.find((v) => v.word.toLowerCase() === word.toLowerCase());
    if (existing) return { saved: false, duplicate: true, item: null };
    const item: VocabMock = {
      id: `v${mockVocabSeq++}`,
      word,
      lemma: word,
      // TIP-081 — giờ tin theo đúng body (addVocab đã tự gọi /api/lookup trước rồi mới POST kèm
      // ipa/audio_url), khớp hành vi backend thật (vocabulary.ts: `ipa: body.ipa ?? null`).
      ipa: (b.ipa as string | null) ?? null,
      meaning_vi,
      example: null,
      audio_url: (b.audio_url as string | null) ?? null,
      learned_at: null,
      created_at: new Date().toISOString(),
    };
    mockVocabItems = [item, ...mockVocabItems];
    return { saved: true, duplicate: false, item };
  }
  if (p.startsWith("/api/vocabulary/") && m === "DELETE") {
    const id = p.split("/").pop();
    mockVocabItems = mockVocabItems.filter((v) => v.id !== id);
    return { deleted: true };
  }
  if (p === "/api/vocabulary/mark-learned") {
    // TIP-081 — trước đây chỉ giả vờ trả {updated:1} mà KHÔNG thật sự set learned_at trên
    // mockVocabItems → học xong từ mới thêm vẫn mãi ở trạng thái "Từ mới". Sửa: đọc "ids" từ body,
    // set learned_at=now cho đúng các item đó (idempotent — bỏ qua nếu đã có learned_at).
    const b = parsedBody();
    const ids = Array.isArray(b.ids) ? (b.ids as string[]) : [];
    const now = new Date().toISOString();
    let updated = 0;
    mockVocabItems = mockVocabItems.map((v) => {
      if (!ids.includes(v.id) || v.learned_at) return v;
      updated++;
      return { ...v, learned_at: now };
    });
    return { updated };
  }
  if (p === "/api/access-status") return MOCK_ACCESS_STATUS;
  if (p === "/api/level" && m === "GET") return MOCK_LEVEL;
  if (p === "/api/level" && m === "POST") return { ok: true };
  if (p === "/api/playlist" && m === "GET") return { items: MOCK_PLAYLIST_ITEMS };
  if (p === "/api/playlist" && m === "POST") return { item: MOCK_PLAYLIST_ITEMS[0] };
  if (p.startsWith("/api/playlist/") && m === "PATCH") return { item: MOCK_PLAYLIST_ITEMS[0] };
  if (p.startsWith("/api/playlist/") && m === "DELETE") return { deleted: true };
  if (p === "/api/weekly-plan" && m === "GET") return { items: mockWeeklyPlanItems };
  if (p === "/api/weekly-plan" && m === "POST") {
    const b = parsedBody();
    const item = {
      id: `w${mockWeeklyPlanSeq++}`,
      plan_date: (b.plan_date as string) ?? "",
      video_link: (b.video_link as string) ?? "",
      committed_time: (b.committed_time as string) ?? "",
      done: false,
      created_at: new Date().toISOString(),
    };
    mockWeeklyPlanItems = [...mockWeeklyPlanItems, item];
    return { item };
  }
  if (p.startsWith("/api/weekly-plan/") && m === "PATCH") {
    const id = p.split("/").pop();
    const b = parsedBody();
    let updated = mockWeeklyPlanItems.find((x) => x.id === id);
    mockWeeklyPlanItems = mockWeeklyPlanItems.map((x) => {
      if (x.id !== id) return x;
      updated = { ...x, ...b };
      return updated;
    });
    return { item: updated };
  }
  if (p.startsWith("/api/weekly-plan/") && m === "DELETE") {
    const id = p.split("/").pop();
    mockWeeklyPlanItems = mockWeeklyPlanItems.filter((x) => x.id !== id);
    return { deleted: true };
  }
  if (p === "/api/payment/create-order") return MOCK_PAYMENT_ORDER;
  if (p.startsWith("/api/payment/order/")) return MOCK_ORDER_STATUS;

  return undefined;
}

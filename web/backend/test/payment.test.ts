import { describe, it, expect, beforeAll } from "vitest";

// Đặt env TRƯỚC khi import module (env.ts đọc process.env lúc eval). Dùng dynamic import.
process.env.SEPAY_API_KEY = "test-secret-key-123";
process.env.BANK_ID = "MB";
process.env.BANK_ACCOUNT_NO = "0123456789";
process.env.BANK_ACCOUNT_NAME = "NGUYEN VAN A";
process.env.PRO_PRICE = "49000";
process.env.PRO_DURATION_DAYS = "30";

type PaymentMod = typeof import("../src/api/payment.js");
let pay: PaymentMod;
let app: import("hono").Hono;

beforeAll(async () => {
  pay = await import("../src/api/payment.js");
  app = (await import("../src/app.js")).app;
});

const APIKEY = "Apikey test-secret-key-123";

describe("generateOrderCode", () => {
  it("dạng SM + 8 ký tự [A-Z0-9]", () => {
    expect(pay.generateOrderCode()).toMatch(/^SM[A-Z0-9]{8}$/);
  });
  it("hai lần khác nhau", () => {
    expect(pay.generateOrderCode()).not.toBe(pay.generateOrderCode());
  });
});

describe("parseOrderCode", () => {
  it("bóc code từ nội dung CK có text khác", () => {
    expect(pay.parseOrderCode("CK MUA PRO SMABCD12 cam on")).toBe("SMABCD12");
  });
  it("không phân biệt hoa thường (bank hạ thường)", () => {
    expect(pay.parseOrderCode("thanh toan smabcd12")).toBe("SMABCD12");
  });
  it("ưu tiên source đầu (content) rồi tới code", () => {
    expect(pay.parseOrderCode(null, "SMCODE99")).toBe("SMCODE99");
    expect(pay.parseOrderCode("SMFIRST1", "SMCODE99")).toBe("SMFIRST1");
  });
  it("không có code -> null", () => {
    expect(pay.parseOrderCode("noi dung khong hop le", "")).toBeNull();
    expect(pay.parseOrderCode(null, null)).toBeNull();
  });
});

describe("computeNextPaidUntil (cộng dồn, không ghi đè ngắn đi)", () => {
  const now = new Date("2026-06-29T00:00:00.000Z");
  const DAY = 24 * 60 * 60 * 1000;

  it("chưa có hạn -> now + 30 ngày", () => {
    const r = pay.computeNextPaidUntil(null, now, 30);
    expect(r.getTime()).toBe(now.getTime() + 30 * DAY);
  });
  it("còn hạn (tương lai) -> cộng dồn từ hạn cũ", () => {
    const future = new Date(now.getTime() + 10 * DAY).toISOString();
    const r = pay.computeNextPaidUntil(future, now, 30);
    expect(r.getTime()).toBe(now.getTime() + 40 * DAY);
  });
  it("hạn cũ đã qua -> tính từ now (không ngắn đi)", () => {
    const past = new Date(now.getTime() - 10 * DAY).toISOString();
    const r = pay.computeNextPaidUntil(past, now, 30);
    expect(r.getTime()).toBe(now.getTime() + 30 * DAY);
  });
});

describe("buildVietQrUrl (vietqr.app + VA — TIP-067)", () => {
  it("sinh vietqr.app với bank/acc/template/amount/des/showinfo/fullacc/holder", () => {
    const url = pay.buildVietQrUrl(49000, "SMABCD12");
    expect(url).toContain("vietqr.app/img");
    expect(url).toContain("bank=MB");
    expect(url).toContain("acc=0123456789");
    expect(url).toContain("template=compact2");
    expect(url).toContain("amount=49000");
    expect(url).toContain("des=SMABCD12");
    expect(url).toContain("showinfo=true");
    expect(url).toContain("fullacc=true");
    expect(url).toContain("holder=NGUYEN+VAN+A");
  });
});

describe("verifyApiKey", () => {
  it("đúng Apikey -> true", () => {
    expect(pay.verifyApiKey("Apikey test-secret-key-123")).toBe(true);
  });
  it("sai key -> false", () => {
    expect(pay.verifyApiKey("Apikey wrong-key")).toBe(false);
  });
  it("thiếu / sai định dạng -> false", () => {
    expect(pay.verifyApiKey(undefined)).toBe(false);
    expect(pay.verifyApiKey("Bearer test-secret-key-123")).toBe(false);
  });
});

// AC-2 — webhook verify Apikey (chạy qua app.request, không cần DB).
describe("POST /api/sepay-webhook — verify Apikey (AC-2)", () => {
  it("không Authorization -> 401, không xử lý", async () => {
    const res = await app.request("/api/sepay-webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: 1, transferType: "in", transferAmount: 49000, content: "SMABCD12" }),
    });
    expect(res.status).toBe(401);
  });
  it("sai Apikey -> 401", async () => {
    const res = await app.request("/api/sepay-webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Apikey sai-key" },
      body: JSON.stringify({ id: 1, transferType: "in", transferAmount: 49000, content: "SMABCD12" }),
    });
    expect(res.status).toBe(401);
  });
  it("đúng Apikey + giao dịch tiền RA -> 200, bỏ qua (không chạm DB)", async () => {
    const res = await app.request("/api/sepay-webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: APIKEY },
      body: JSON.stringify({ id: 1, transferType: "out", transferAmount: 49000, content: "x" }),
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ success: true });
  });
  it("đúng Apikey + thiếu tx id -> 200, bỏ qua", async () => {
    const res = await app.request("/api/sepay-webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: APIKEY },
      body: JSON.stringify({ transferType: "in", transferAmount: 49000, content: "SMABCD12" }),
    });
    expect(res.status).toBe(200);
  });
});

// TIP-013 — Thanh toán Pro: tạo đơn + VietQR + webhook SePay + kích hoạt Pro.
//
// Luồng: POST /api/payment/create-order (user) -> đơn pending + ảnh VietQR (nội dung CK = code).
//        User chuyển khoản -> SePay POST /api/sepay-webhook -> verify Apikey + đối soát code/
//        số tiền + idempotency theo tx id -> order=paid + subscriptions.paid_until +N ngày.
//        GET /api/payment/order/:code (user) -> frontend poll trạng thái.
//
// BẢO MẬT (Blueprint mục 0/10): webhook KHÔNG qua JWT user (SePay gọi) nhưng PHẢI verify
// header `Authorization: Apikey <SEPAY_API_KEY>`; mọi nhánh không khớp đủ => KHÔNG kích hoạt.
// Ghi DB qua service_role (webhook không có user token). Giá/bank/thời hạn ở env, không hardcode.
import type { Context } from "hono";
import { randomBytes } from "node:crypto";
import { getServiceClient } from "../lib/supabase.js";
import {
  SEPAY_API_KEY,
  BANK_ID,
  BANK_ACCOUNT_NO,
  BANK_ACCOUNT_NAME,
  VIETQR_TEMPLATE,
  PRO_PRICE,
  PRO_DURATION_DAYS,
} from "../env.js";

// ── Pure helpers (unit-test được, không I/O) ────────────────────────────────

// Mã đơn ngắn nhúng nội dung CK: "SM" + 8 ký tự base36 IN HOA (vd SM4F9K2QZ).
// Chỉ [A-Z0-9] để bền với việc ngân hàng/nội dung CK chuẩn hoá hoa-thường.
export function generateOrderCode(): string {
  const raw = randomBytes(8).toString("hex"); // 16 hex
  const b36 = BigInt("0x" + raw).toString(36).toUpperCase();
  return "SM" + b36.slice(-8).padStart(8, "0");
}

// Bóc mã đơn từ nội dung CK (và/hoặc field `code` SePay). Nội dung có thể lẫn text khác,
// có thể bị hạ thường → tìm token SM + >=4 ký tự alnum, trả về IN HOA. Không thấy → null.
export function parseOrderCode(...sources: (string | null | undefined)[]): string | null {
  for (const s of sources) {
    if (!s) continue;
    const m = s.toUpperCase().match(/SM[A-Z0-9]{4,}/);
    if (m) return m[0];
  }
  return null;
}

// paid_until mới = max(now, paid_until hiện tại) + N ngày (CỘNG DỒN nếu còn hạn, không ghi đè ngắn đi).
export function computeNextPaidUntil(
  currentPaidUntil: string | null,
  now: Date,
  durationDays: number
): Date {
  const cur = currentPaidUntil ? new Date(currentPaidUntil).getTime() : 0;
  const base = Math.max(now.getTime(), Number.isFinite(cur) ? cur : 0);
  return new Date(base + durationDays * 24 * 60 * 60 * 1000);
}

// URL ảnh VietQR: api.vietqr.io/image/{BANK_ID}-{ACCOUNT_NO}-{template}.jpg?...
export function buildVietQrUrl(amount: number, addInfo: string): string {
  const base = `https://api.vietqr.io/image/${BANK_ID}-${BANK_ACCOUNT_NO}-${VIETQR_TEMPLATE}.jpg`;
  const qs = new URLSearchParams({
    accountName: BANK_ACCOUNT_NAME,
    amount: String(amount),
    addInfo,
  });
  return `${base}?${qs.toString()}`;
}

// So khớp Apikey an toàn (độ dài + nội dung). Header dạng "Apikey <key>".
export function verifyApiKey(authHeader: string | undefined): boolean {
  if (!SEPAY_API_KEY) return false; // chưa cấu hình key => từ chối tất cả (an toàn mặc định)
  const m = (authHeader ?? "").match(/^Apikey\s+(.+)$/i);
  if (!m) return false;
  const got = m[1].trim();
  if (got.length !== SEPAY_API_KEY.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ SEPAY_API_KEY.charCodeAt(i);
  return diff === 0;
}

// ── Handlers ────────────────────────────────────────────────────────────────

// POST /api/payment/create-order (protected): tạo đơn pending + trả VietQR + thông tin CK.
export async function postCreateOrder(c: Context) {
  const user = c.get("user");
  const sb = getServiceClient();

  // Sinh code duy nhất (retry vài lần phòng trùng — cực hiếm với 8 ký tự base36).
  let code = "";
  let inserted = false;
  for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
    code = generateOrderCode();
    const { error } = await sb
      .from("payment_orders")
      .insert({ code, user_id: user.id, amount: PRO_PRICE, status: "pending" });
    if (!error) {
      inserted = true;
    } else if (!/duplicate|unique/i.test(error.message)) {
      return c.json({ error: error.message }, 500);
    }
  }
  if (!inserted) return c.json({ error: "order_code_collision" }, 500);

  return c.json({
    code,
    amount: PRO_PRICE,
    qr_url: buildVietQrUrl(PRO_PRICE, code),
    bank: { bank_id: BANK_ID, account_no: BANK_ACCOUNT_NO, account_name: BANK_ACCOUNT_NAME },
    content: code, // nội dung chuyển khoản user phải ghi
  });
}

// GET /api/payment/order/:code (protected): trạng thái đơn của chính user (cho frontend poll).
export async function getOrder(c: Context) {
  const user = c.get("user");
  const code = c.req.param("code");
  if (!code) return c.json({ error: "missing code" }, 400);

  const { data, error } = await getServiceClient()
    .from("payment_orders")
    .select("code, amount, status, paid_at")
    .eq("code", code)
    .eq("user_id", user.id) // chỉ đơn của chính mình
    .maybeSingle();
  if (error) return c.json({ error: error.message }, 500);
  if (!data) return c.json({ error: "order_not_found" }, 404);
  return c.json(data);
}

// POST /api/sepay-webhook (KHÔNG qua requireAuth — SePay gọi). CỬA BẢO MẬT.
// Mọi nhánh "không khớp đủ" trả 200 (để SePay không retry vô hạn) NHƯNG không kích hoạt.
export async function postSepayWebhook(c: Context) {
  // 1) Verify Apikey. Sai -> 401, KHÔNG xử lý.
  if (!verifyApiKey(c.req.header("Authorization"))) {
    return c.json({ success: false, error: "unauthorized" }, 401);
  }

  // 2) Parse payload (field theo docs.sepay.vn: id, transferAmount, transferType, content, code).
  // (Đọc body OK trên Vercel nhờ buffer rawBody ở api/index.ts — xem TIP-013 fix.)
  let p: Record<string, unknown>;
  try {
    p = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return c.json({ success: true, note: "invalid json" }); // 200, không xử lý
  }

  const txId = p.id != null ? String(p.id) : "";
  const transferType = typeof p.transferType === "string" ? p.transferType : "";
  const amount = Number(p.transferAmount ?? 0);
  const content = typeof p.content === "string" ? p.content : "";
  const sepayCode = typeof p.code === "string" ? p.code : "";

  // Chỉ xử lý tiền VÀO (in). Tiền ra / thiếu id -> 200, bỏ qua.
  if (transferType && transferType !== "in") return c.json({ success: true, note: "not incoming" });
  if (!txId) return c.json({ success: true, note: "missing tx id" });

  const sb = getServiceClient();

  // 3) Idempotency: tx đã xử lý -> 200, KHÔNG xử lại.
  {
    const { data: existed } = await sb
      .from("payment_orders")
      .select("code")
      .eq("sepay_tx_id", txId)
      .maybeSingle();
    if (existed) return c.json({ success: true, note: "already processed" });
  }

  // 4) Đối soát: bóc mã đơn từ content (ưu tiên) hoặc field code -> tìm đơn pending.
  const orderCode = parseOrderCode(content, sepayCode);
  if (!orderCode) return c.json({ success: true, note: "no order code in content" });

  const { data: order } = await sb
    .from("payment_orders")
    .select("code, user_id, amount, status")
    .eq("code", orderCode)
    .maybeSingle();
  if (!order) return c.json({ success: true, note: "order not found" });
  if (order.status === "paid") return c.json({ success: true, note: "order already paid" });

  // Số tiền phải ĐỦ (>= amount đơn). Thiếu -> log + 200, KHÔNG kích hoạt.
  if (!(amount >= order.amount)) {
    console.warn(`[sepay-webhook] amount ${amount} < ${order.amount} cho đơn ${orderCode}; bỏ qua.`);
    return c.json({ success: true, note: "insufficient amount" });
  }

  // 5a) Đánh dấu đơn paid — GUARD status='pending' để chỉ chuyển 1 lần (chống double-month khi race).
  const now = new Date();
  const { data: paidRows, error: upErr } = await sb
    .from("payment_orders")
    .update({ status: "paid", sepay_tx_id: txId, paid_at: now.toISOString() })
    .eq("code", orderCode)
    .eq("status", "pending")
    .select("user_id");
  if (upErr) {
    // UNIQUE sepay_tx_id hoặc lỗi khác -> coi như đã xử lý nơi khác; không kích hoạt thêm.
    console.warn(`[sepay-webhook] update order ${orderCode} lỗi: ${upErr.message}`);
    return c.json({ success: true, note: "update skipped" });
  }
  if (!paidRows || paidRows.length === 0) {
    return c.json({ success: true, note: "order not pending (race)" }); // đã có request khác xử
  }

  // 5b) Gia hạn subscription: paid_until = max(now, paid_until) + N ngày; status=active.
  const { data: sub } = await sb
    .from("subscriptions")
    .select("paid_until")
    .eq("user_id", order.user_id)
    .maybeSingle();
  const nextPaidUntil = computeNextPaidUntil(sub?.paid_until ?? null, now, PRO_DURATION_DAYS);
  const { error: subErr } = await sb
    .from("subscriptions")
    .update({ status: "active", paid_until: nextPaidUntil.toISOString() })
    .eq("user_id", order.user_id);
  if (subErr) {
    console.error(`[sepay-webhook] đơn ${orderCode} paid nhưng cập nhật subscription lỗi: ${subErr.message}`);
    // Đơn đã paid; trả 200 để SePay không retry. Cần xử lý thủ công nếu xảy ra.
    return c.json({ success: true, note: "order paid; sub update failed" });
  }

  return c.json({ success: true });
}

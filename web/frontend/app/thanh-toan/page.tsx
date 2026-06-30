"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createOrder, fetchOrderStatus, type PaymentOrder } from "@/lib/payment";

const POLL_MS = 4000; // poll trạng thái đơn mỗi 4s
const VND = (n: number) => n.toLocaleString("vi-VN") + "đ";

// WEB-08/BE-05 — Trang nâng cấp Pro: tạo đơn → QR VietQR + thông tin CK → poll tới khi paid.
function UpgradeInner() {
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();

  const stopPoll = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  const checkStatus = useCallback(
    async (code: string) => {
      try {
        const s = await fetchOrderStatus(code);
        if (s.status === "paid") {
          setPaid(true);
          stopPoll();
          router.push("/cam-on"); // TIP-019a: thanh toán thành công → trang cảm ơn
        }
      } catch {
        /* lỗi tạm thời khi poll — bỏ qua, lần sau thử lại */
      }
    },
    [stopPoll, router]
  );

  const onCreate = async () => {
    setCreating(true);
    setErr(null);
    try {
      const o = await createOrder();
      setOrder(o);
    } catch {
      setErr("Không tạo được đơn. Vui lòng thử lại.");
    } finally {
      setCreating(false);
    }
  };

  // Bắt đầu poll khi có đơn (và chưa paid).
  useEffect(() => {
    if (!order || paid) return;
    void checkStatus(order.code);
    timer.current = setInterval(() => void checkStatus(order.code), POLL_MS);
    return stopPoll;
  }, [order, paid, checkStatus, stopPoll]);

  const copyContent = async () => {
    if (!order) return;
    try {
      await navigator.clipboard.writeText(order.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard bị chặn — user tự gõ nội dung */
    }
  };

  if (paid) {
    // Đã thanh toán → đang điều hướng sang /cam-on (router.push trong checkStatus).
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Card className="w-full max-w-md text-center">
          <div className="text-4xl">🎉</div>
          <p className="mt-2 text-sm text-muted-foreground">Thanh toán thành công, đang chuyển trang…</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="font-heading text-2xl font-bold">Nâng cấp Pro</h1>

      {!order ? (
        <Card className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Mở khoá toàn bộ tính năng StudyMovie với gói Pro.
          </p>
          <p className="font-heading text-3xl font-bold">
            {VND(49000)}
            <span className="text-base font-normal text-muted-foreground"> / tháng</span>
          </p>
          <Button onClick={onCreate} disabled={creating} className="w-full">
            {creating ? "Đang tạo đơn…" : "Mua Pro 49.000đ/tháng"}
          </Button>
          {err ? <p className="text-sm text-red-600">{err}</p> : null}
        </Card>
      ) : (
        <Card className="space-y-4">
          <p className="text-center text-sm text-muted-foreground">
            Quét mã QR bằng app ngân hàng, hoặc chuyển khoản đúng thông tin bên dưới.
            <br />
            <span className="font-medium text-foreground">
              Nội dung chuyển khoản phải giữ đúng mã đơn.
            </span>
          </p>

          {/* Ảnh QR VietQR (ngoài domain — dùng <img>, không next/image). */}
          <div className="flex justify-center">
            <img
              src={order.qr_url}
              alt={`Mã QR chuyển khoản ${VND(order.amount)}`}
              className="h-64 w-64 rounded border border-border object-contain"
            />
          </div>

          <dl className="space-y-2 text-sm">
            <Row label="Ngân hàng" value={order.bank.bank_id} />
            <Row label="Số tài khoản" value={order.bank.account_no} />
            <Row label="Chủ tài khoản" value={order.bank.account_name} />
            <Row label="Số tiền" value={VND(order.amount)} />
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Nội dung CK</dt>
              <dd className="flex items-center gap-2">
                <span className="font-mono font-semibold">{order.content}</span>
                <Button variant="ghost" className="px-2 py-1 text-xs" onClick={copyContent}>
                  {copied ? "Đã chép" : "Chép"}
                </Button>
              </dd>
            </div>
          </dl>

          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Spinner /> Đang chờ thanh toán… (tự động cập nhật sau khi chuyển khoản)
          </div>
          <Button variant="ghost" className="w-full" onClick={() => void checkStatus(order.code)}>
            Tôi đã chuyển khoản — kiểm tra lại
          </Button>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function Spinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary" />
  );
}

export default function UpgradePage() {
  return (
    <AuthGuard>
      <UpgradeInner />
    </AuthGuard>
  );
}

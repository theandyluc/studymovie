"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createOrder, fetchOrderStatus, type PaymentOrder } from "@/lib/payment";
import { fetchAccessStatus, type AccessStatus } from "@/lib/access";
import { PageLoading } from "@/components/ui/Spinner";

const POLL_MS = 4000; // poll trạng thái đơn mỗi 4s
const QR_TTL = 300; // đồng hồ đếm ngược 5:00 (cosmetic — thúc đẩy hành động; về 0 KHÔNG huỷ đơn)
const VND = (n: number) => n.toLocaleString("vi-VN") + "đ";
const fmtMMSS = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

// WEB-08/BE-05/TIP-033 — Trang nâng cấp Pro theo Figma: tiêu đề "Quét mã QR bên dưới" +
// countdown lớn + ảnh VietQR (compact2 đã có logo+thông tin CK) → poll tới khi paid.
// Figma: countdown về 0 KHÔNG có gì xảy ra, user vẫn quét được (bỏ trạng thái "hết hạn").
function UpgradeInner() {
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [copied, setCopied] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(QR_TTL);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();
  const [access, setAccess] = useState<AccessStatus | null>(null);
  const [accChecked, setAccChecked] = useState(false);

  useEffect(() => {
    fetchAccessStatus()
      .then(setAccess)
      .catch(() => undefined)
      .finally(() => setAccChecked(true));
  }, []);

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
          router.push("/cam-on");
        }
      } catch {
        /* lỗi tạm thời khi poll — bỏ qua */
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
      setSecondsLeft(QR_TTL); // reset đồng hồ mỗi lần tạo đơn mới
    } catch {
      setErr("Không tạo được đơn. Vui lòng thử lại.");
    } finally {
      setCreating(false);
    }
  };

  // Poll khi có đơn (chưa paid). Countdown về 0 KHÔNG dừng poll (Figma).
  useEffect(() => {
    if (!order || paid) return;
    void checkStatus(order.code);
    timer.current = setInterval(() => void checkStatus(order.code), POLL_MS);
    return stopPoll;
  }, [order, paid, checkStatus, stopPoll]);

  // Đồng hồ đếm ngược 5:00 → về 0 rồi giữ nguyên (không huỷ đơn, không đổi hành vi quét).
  useEffect(() => {
    if (!order || paid) return;
    const iv = setInterval(() => setSecondsLeft((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(iv);
  }, [order, paid]);

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
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Card className="w-full max-w-md text-center">
          <div className="text-4xl">🎉</div>
          <p className="mt-2 text-sm text-muted-foreground">Thanh toán thành công, đang chuyển trang…</p>
        </Card>
      </div>
    );
  }

  if (!accChecked) return <PageLoading label="Đang kiểm tra tài khoản…" />;

  if (access?.reason === "paid") {
    const until = access.paid_until ? new Date(access.paid_until).toLocaleDateString("vi-VN") : null;
    return (
      <div className="mx-auto max-w-md">
        <Card className="text-center">
          <div className="text-4xl">⭐</div>
          <h1 className="mt-2 font-heading text-xl font-bold">Bạn đã là Pro</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {until ? `Gói Pro của bạn có hạn đến ${until}.` : "Tài khoản của bạn đang là Pro."}
          </p>
          <a href="/dashboard" className="mt-4 inline-block">
            <Button>Vào học</Button>
          </a>
        </Card>
      </div>
    );
  }

  // Chưa tạo đơn — màn giới thiệu gói + nút mua.
  if (!order) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <h1 className="font-heading text-2xl font-bold">Nâng cấp Pro</h1>
        <Card className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">Mở khoá toàn bộ tính năng StudyMovie với gói Pro.</p>
          <p className="font-heading text-3xl font-bold">
            {VND(49000)}
            <span className="text-base font-normal text-muted-foreground"> / tháng</span>
          </p>
          <Button onClick={onCreate} disabled={creating} className="w-full">
            {creating ? "Đang tạo đơn…" : "Mua Pro 49.000đ/tháng"}
          </Button>
          {err ? <p className="text-sm text-red-600">{err}</p> : null}
        </Card>
      </div>
    );
  }

  // Đã tạo đơn — màn QR theo Figma (tiêu đề + countdown lớn + ảnh VietQR).
  return (
    <div className="mx-auto max-w-md space-y-5 py-2 text-center">
      <div>
        <h1 className="font-heading text-3xl font-bold">Quét mã QR bên dưới</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sau khi quét mã, vui lòng kiểm tra đúng nội dung chuyển khoản phía dưới.
          <br />
          Hệ thống sẽ tự động kích hoạt sau khi chuyển khoản.
        </p>
      </div>

      {/* Countdown lớn (Figma) */}
      <p className="font-heading text-4xl font-bold tabular-nums">{fmtMMSS(secondsLeft)}</p>

      {/* Ảnh VietQR compact2 — đã gồm logo + tên TK + số TK + số tiền + nội dung CK */}
      <div className="flex justify-center">
        <Card className="inline-block p-3">
          <img
            src={order.qr_url}
            alt={`Mã QR chuyển khoản ${VND(order.amount)} — nội dung ${order.content}`}
            className="mx-auto block h-auto w-72 rounded object-contain"
          />
        </Card>
      </div>

      {/* Nội dung CK + chép (không copy được từ ảnh) */}
      <div className="flex items-center justify-center gap-2 text-sm">
        <span className="text-muted-foreground">Nội dung CK:</span>
        <span className="font-mono font-semibold">{order.content}</span>
        <Button variant="ghost" className="px-2 py-1 text-xs" onClick={copyContent}>
          {copied ? "Đã chép" : "Chép"}
        </Button>
      </div>

      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Đang chờ thanh toán… (tự động cập nhật sau khi chuyển khoản)
      </div>
      <Button variant="ghost" onClick={() => void checkStatus(order.code)}>
        Tôi đã chuyển khoản — kiểm tra lại
      </Button>
    </div>
  );
}

function Spinner() {
  return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary" />;
}

export default function UpgradePage() {
  return (
    <AuthGuard>
      <UpgradeInner />
    </AuthGuard>
  );
}

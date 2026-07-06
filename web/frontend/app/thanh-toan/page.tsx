"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createOrder, fetchOrderStatus, fetchProPrice, type PaymentOrder } from "@/lib/payment";
import { fetchAccessStatus, type AccessStatus } from "@/lib/access";
import { PageLoading } from "@/components/ui/Spinner";

/* ============================================================
   GIẢI THÍCH CHO KHÁCH — File: app/thanh-toan/page.tsx
   ------------------------------------------------------------
   Trang "Nâng cấp Pro" bằng chuyển khoản QR:
   1) Nếu người dùng đã là Pro → hiện thông báo và mời vào học.
   2) Chưa mua → hiện giá gói và nút "Mua Pro".
      TIP-082: nếu vào bằng link ?auto=1 (nút trên landing studymovie.com/gia) →
      bỏ qua màn giá, tự tạo đơn + hiện QR ngay.
   3) Bấm mua (hoặc tự động ở bước 2 khi ?auto=1) → tạo đơn, hiện mã QR VietQR + nội dung chuyển khoản +
      đồng hồ đếm ngược 5 phút.
   4) Trang tự động hỏi máy chủ mỗi vài giây xem tiền đã tới chưa; khi
      đã thanh toán → tự chuyển sang trang "Cảm ơn".
   5) Nếu quá 5 phút chưa trả → mã hết hạn, cho bấm "Tạo mã mới".
   Người dùng không cần bấm xác nhận gì — hệ thống tự nhận biết.
   ============================================================ */
const POLL_MS = 4000; // poll trạng thái đơn mỗi 4s
const QR_TTL = 300; // TIP-028: đồng hồ đếm ngược 5:00; về 0 → hết hạn (dừng poll) + nút "Tạo mã mới"
const VND = (n: number) => n.toLocaleString("vi-VN") + "đ";
const fmtMMSS = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

// WEB-08/BE-05/TIP-033 — Trang nâng cấp Pro theo Figma: tiêu đề "Quét mã QR bên dưới" +
// countdown lớn + ảnh VietQR (compact2 đã có logo+thông tin CK) → poll tới khi paid.
// TIP-028: countdown về 0 → hết hạn (dừng poll) + nút "Tạo mã mới".
function UpgradeInner() {
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(QR_TTL);
  const [expired, setExpired] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();
  const [access, setAccess] = useState<AccessStatus | null>(null);
  const [accChecked, setAccChecked] = useState(false);
  const [price, setPrice] = useState(49000); // TIP-083: fallback trước khi fetch xong
  const searchParams = useSearchParams();
  const autoCreate = searchParams.get("auto") === "1"; // TIP-082: link từ landing studymovie.com/gia
  const autoTried = useRef(false);

  useEffect(() => {
    fetchAccessStatus()
      .then(setAccess)
      .catch(() => undefined)
      .finally(() => setAccChecked(true));
    // TIP-083 — giá hiện tại (đồng bộ khi admin đổi giá ở /admin), không chặn render nếu lỗi.
    fetchProPrice()
      .then((r) => setPrice(r.price))
      .catch(() => undefined);
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
      setExpired(false);
    } catch {
      setErr("Không tạo được đơn. Vui lòng thử lại.");
    } finally {
      setCreating(false);
    }
  };

  // TIP-082 — ?auto=1 (link từ landing /gia): bỏ màn giá, tự tạo đơn ngay khi đủ điều kiện.
  useEffect(() => {
    if (!autoCreate || autoTried.current) return;
    if (!accChecked || order || creating || access?.reason === "paid") return;
    autoTried.current = true;
    void onCreate();
  }, [autoCreate, accChecked, order, creating, access]);

  // Poll khi có đơn (chưa paid, chưa hết hạn).
  useEffect(() => {
    if (!order || paid || expired) return;
    void checkStatus(order.code);
    timer.current = setInterval(() => void checkStatus(order.code), POLL_MS);
    return stopPoll;
  }, [order, paid, expired, checkStatus, stopPoll]);

  // TIP-028 — Đồng hồ đếm ngược 5:00; về 0 → hết hạn (dừng poll).
  useEffect(() => {
    if (!order || paid || expired) return;
    const iv = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setExpired(true);
          stopPoll();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [order, paid, expired, stopPoll]);

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

  if (!accChecked) return <PageLoading />;

  if (access?.reason === "paid") {
    const until = access.paid_until ? new Date(access.paid_until).toLocaleDateString("vi-VN") : null;
    return (
      <div className="mx-auto max-w-md">
        <Card className="text-center">
          <div className="text-4xl">⭐</div>
          <h1 className="mt-2 font-heading text-xl font-bold">Bạn đã là Pro</h1>
          <p className="mt-2 text-sm font-light tracking-[-0.03em] text-[#1f1f1f]">
            {until ? `Gói Pro của bạn có hạn đến ${until}.` : "Tài khoản của bạn đang là Pro."}
          </p>
          <a href="/tien-do-hoc" className="mt-4 inline-block">
            <Button style={{ background: "rgba(31, 31, 31, 0.9)" }}>Vào học</Button>
          </a>
        </Card>
      </div>
    );
  }

  // Chưa tạo đơn — màn giới thiệu gói + nút mua.
  if (!order) {
    return (
      <div className="mx-auto max-w-md text-center">
        <Card className="space-y-4 text-center">
          <div>
            <div className="text-4xl">⏳</div>
            <h1 className="mt-2 font-heading text-2xl font-bold">Hết hạn dùng thử</h1>
            <p className="mt-[5px] text-sm font-normal tracking-[-0.03em] text-[#1f1f1f]">
              Tài khoản của bạn đã hết hạn dùng thử,
              <br />
              vui lòng nâng cấp để tiếp tục sử dụng.
            </p>
          </div>
          <p className="font-heading text-3xl font-bold">
            {VND(price)}
            <span className="text-base font-normal tracking-[-0.03em] text-[#1f1f1f]"> / năm</span>
          </p>
          <Button
            onClick={onCreate}
            disabled={creating}
            className="w-full"
            style={{ background: "rgba(31, 31, 31, 0.9)" }}
          >
            {creating ? "Đang tạo đơn…" : "Nâng cấp ngay"}
          </Button>
          {err ? <p className="text-sm text-danger-foreground">{err}</p> : null}
        </Card>
      </div>
    );
  }

  // Đã tạo đơn — màn QR theo Figma (tiêu đề + countdown lớn + ảnh VietQR).
  return (
    <div className="mx-auto max-w-xl pt-[20px] pb-2 text-center">
      <div>
        <h1 className="font-heading text-[32px] font-bold tracking-[-0.03em]">Quét mã QR bên dưới</h1>
        <p className="mt-[3px] whitespace-nowrap text-[15px] font-light leading-[18px] text-[#1f1f1f]">
          Sau khi quét mã vui lòng kiểm tra đúng nội dung chuyển khoản như hình.
          <br />
          Hệ thống sẽ tự động kích hoạt sau khi chuyển khoản thành công.
        </p>
      </div>

      {expired ? (
        /* TIP-028 — hết hạn: dừng poll, cho tạo mã mới */
        <div className="mt-5 space-y-3">
          <p className="text-sm font-medium text-danger-foreground">Mã QR đã hết hạn</p>
          <Button className="w-full" onClick={() => setOrder(null)}>
            Tạo mã mới
          </Button>
        </div>
      ) : (
        <>
          {/* Countdown lớn (Figma) */}
          <p className="mt-[17px] text-[32px] font-semibold tracking-[-0.03em] tabular-nums">{fmtMMSS(secondsLeft)}</p>

          {/* Ảnh VietQR compact2 — đã gồm logo + tên TK + số TK + số tiền + nội dung CK */}
          <div className="mt-2 flex justify-center">
            <Card className="inline-block p-3">
              <img
                src={order.qr_url}
                alt={`Mã QR chuyển khoản ${VND(order.amount)} — nội dung ${order.content}`}
                className="mx-auto block h-auto w-72 rounded object-contain"
              />
            </Card>
          </div>

          <div className="mt-5 flex items-center justify-center gap-2 whitespace-nowrap text-[15px] font-light leading-[18px] text-[#1f1f1f]">
            <Spinner /> Đang chờ thanh toán… (tự động cập nhật sau khi chuyển khoản)
          </div>
        </>
      )}
    </div>
  );
}

function Spinner() {
  return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary" />;
}

export default function UpgradePage() {
  return (
    <AuthGuard>
      <Suspense fallback={<PageLoading />}>
        <UpgradeInner />
      </Suspense>
    </AuthGuard>
  );
}

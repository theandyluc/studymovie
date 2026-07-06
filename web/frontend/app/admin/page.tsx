"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CircleStat } from "@/components/ui/CircleStat";
import { PageLoading } from "@/components/ui/Spinner";
import { ApiError } from "@/lib/apiClient";
import { toast, confirmDialog } from "@/components/ui/feedback";
import {
  fetchAdminStats,
  fetchAdminUsers,
  setProPrice,
  grantPro,
  setUserAdmin,
  createAccount,
  deleteAccount,
  type AdminStats,
  type AdminUser,
} from "@/lib/admin";

/* ============================================================
   GIẢI THÍCH CHO KHÁCH — File: app/admin/page.tsx
   ------------------------------------------------------------
   Trang QUẢN TRỊ, chỉ dành cho admin. Gồm:
   - 3 ô thống kê: tổng người dùng, số người Pro, doanh thu.
   - Đặt giá gói Pro.
   - Bảng người dùng: xem trạng thái, hạn Pro; bật/tắt quyền admin;
     tặng Pro cho một người trong X ngày.
   BẢO VỆ: nếu người mở không phải admin, máy chủ trả lỗi 403 và trang
   tự chuyển họ về /tien-do-hoc — người thường không xem được nội dung này.
   ============================================================ */
// (Giải thích) Đổi số thành tiền Việt, ví dụ 49000 → "49.000đ".
const VND = (n: number) => n.toLocaleString("vi-VN") + "đ";
const inputCls = "rounded-btn border border-border px-2 py-1 text-sm";

// TIP-097 — trục Y "đẹp" (y hệt /tu-vung: step nice-number, ~4 mốc tròn).
function niceAxis(rawMax: number): { niceMax: number; ticks: number[] } {
  const target = 3;
  const rough = Math.max(1, rawMax) / target;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  const rawStep = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const step = Math.max(1, Math.round(rawStep));
  const niceMax = Math.max(step, Math.ceil(rawMax / step) * step);
  const ticks: number[] = [];
  for (let t = niceMax; t >= 0; t -= step) ticks.push(t);
  return { niceMax, ticks };
}

// TIP-097 — "Tổng user" dạng biểu đồ 7 ngày, y hệt LearnedChart ở /tu-vung (card 366x229,
// cột 20px cách 20px, trục Y ~4 mốc tròn, tooltip số ở đỉnh cột khi hover).
function UserGrowthChart({ daily }: { daily: { date: string; count: number }[] }) {
  const days = daily.map((d) => ({
    key: d.date.slice(0, 10),
    label: `${d.date.slice(8, 10)}/${d.date.slice(5, 7)}`,
    count: d.count,
  }));
  const rawMax = Math.max(1, ...days.map((d) => d.count));
  const { niceMax, ticks } = niceAxis(rawMax);

  return (
    <div className="h-[229px] w-[366px] rounded-card border border-border bg-surface p-4">
      <h2 className="font-heading text-center text-lg font-normal text-foreground">Tổng user theo ngày</h2>
      <div className="mt-[17px] flex h-[130px] gap-2">
        <div className="relative w-6 py-1 text-right text-[9px] font-medium tabular-nums text-[#cccccc]">
          {ticks.map((t, i) => (
            <span
              key={i}
              className="absolute right-[5px] -translate-y-1/2"
              style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}
            >
              {t}
            </span>
          ))}
        </div>
        <div className="relative flex h-full flex-1 items-end gap-[20px]">
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
            {ticks.map((_, i) => (
              <div key={i} className="border-t border-border/50" />
            ))}
          </div>
          {days.map((d) => (
            <div
              key={d.key}
              className="group relative flex h-full w-[20px] shrink-0 flex-col items-center justify-end"
              title={`${d.label}: ${d.count} user mới`}
            >
              <div
                className="relative w-[20px] rounded-t-md bg-chart-base transition-colors group-hover:bg-chart-bar"
                style={{ height: `${(d.count / niceMax) * 100}%`, minHeight: d.count > 0 ? "4px" : "0" }}
              >
                <span className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 flex h-[32.4px] w-[48.6px] -translate-x-1/2 items-center justify-center whitespace-nowrap rounded-lg border border-border bg-surface text-[16.2px] font-medium opacity-0 transition-opacity group-hover:opacity-100">
                  {d.count}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="ml-[30px] mt-1 flex gap-[20px]">
        {days.map((d) => (
          <span key={d.key} className="w-[20px] shrink-0 text-center text-[9px] font-medium text-[#cccccc]">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// Ô gán Pro mỗi dòng: số ngày (mặc định 30) + nút Gán.
function GrantCell({ disabled, onGrant }: { disabled: boolean; onGrant: (days: number) => void }) {
  const [days, setDays] = useState("30");
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min="1"
        value={days}
        onChange={(e) => setDays(e.target.value)}
        className={`w-16 ${inputCls}`}
      />
      <Button variant="ghost" disabled={disabled} onClick={() => onGrant(Math.round(Number(days)) || 30)}>
        Gán Pro
      </Button>
    </div>
  );
}

// TIP-020 — Trang admin. Guard: gọi API admin; 403 (RPC fail-closed) → không phải admin → /tien-do-hoc.
function AdminInner() {
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [price, setPrice] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const load = useCallback(async () => {
    try {
      const [s, u] = await Promise.all([fetchAdminStats(), fetchAdminUsers()]);
      setStats(s);
      setUsers(u);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) setDenied(true);
      else setMsg("Lỗi tải admin: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (denied) router.replace("/tien-do-hoc"); // không phải admin
  }, [denied, router]);

  if (loading) return <PageLoading />;
  if (denied) return <PageLoading label="Không có quyền truy cập — đang chuyển…" />;

  const fail = (e: unknown) => setMsg("Lỗi: " + (e instanceof Error ? e.message : String(e)));

  const onSetPrice = async () => {
    const p = Math.round(Number(price));
    if (!Number.isFinite(p) || p <= 0) {
      setMsg("Giá không hợp lệ.");
      return;
    }
    setBusy("price");
    try {
      await setProPrice(p);
      setMsg(`Đã đặt giá Pro = ${VND(p)} (áp cho đơn tạo sau).`);
      setPrice("");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const onGrant = async (u: AdminUser, days: number) => {
    setBusy(u.id);
    try {
      await grantPro(u.id, days);
      setMsg(`Đã gán Pro ${days} ngày cho ${u.email ?? u.id}.`);
      await load();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const onToggleAdmin = async (u: AdminUser) => {
    setBusy(u.id);
    try {
      await setUserAdmin(u.id, !u.is_admin);
      await load();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const onCreateAccount = async () => {
    const email = newEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMsg("Email không hợp lệ.");
      return;
    }
    if (newPassword.length < 6) {
      setMsg("Mật khẩu tối thiểu 6 ký tự.");
      return;
    }
    setBusy("create");
    try {
      await createAccount(email, newPassword);
      setMsg(`Đã tạo tài khoản ${email}.`);
      setNewEmail("");
      setNewPassword("");
      await load();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const onDeleteAccount = async (u: AdminUser) => {
    if (!(await confirmDialog({ title: `Xoá tài khoản "${u.email ?? u.id}"?`, danger: true, confirmText: "Xoá" })))
      return;
    setBusy(u.id);
    try {
      await deleteAccount(u.id);
      toast(`Đã xoá tài khoản ${u.email ?? u.id}.`);
      await load();
    } catch (e) {
      toast("Xoá lỗi: " + (e instanceof Error ? e.message : String(e)), "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl font-bold">Admin</h1>
      {msg ? <p className="rounded-card border border-border bg-surface-muted px-3 py-2 text-sm">{msg}</p> : null}

      {/* Thống kê */}
      <div className="flex flex-wrap items-center justify-center gap-4">
        <UserGrowthChart daily={stats?.daily_new_users ?? []} />
        <Card className="flex h-[229px] w-[200px] flex-col items-center justify-center">
          <CircleStat
            label="Tổng số user"
            value={String(stats?.total_users ?? 0)}
            valueClassName="text-[32px] font-semibold"
          />
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">User Pro (đang hạn)</p>
          <p className="mt-1 text-2xl font-bold">{stats?.pro_users ?? 0}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">Doanh thu (đơn paid)</p>
          <p className="mt-1 text-2xl font-bold">{VND(stats?.revenue ?? 0)}</p>
        </Card>
      </div>

      {/* Set giá Pro */}
      <Card className="space-y-2">
        <h2 className="font-medium">Giá Pro</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            min="1"
            placeholder="vd 49000"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className={`w-40 ${inputCls}`}
          />
          <Button onClick={onSetPrice} disabled={busy === "price"}>
            {busy === "price" ? "Đang lưu…" : "Đặt giá"}
          </Button>
          <span className="text-xs text-muted-foreground">Lưu vào DB; áp cho đơn tạo sau (chưa set → dùng env).</span>
        </div>
      </Card>

      {/* TIP-096 — Tạo tài khoản thủ công */}
      <Card className="space-y-2">
        <h2 className="font-medium">Tạo tài khoản</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="email"
            placeholder="email@vidu.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className={`w-56 ${inputCls}`}
          />
          <input
            type="password"
            placeholder="Mật khẩu (≥6 ký tự)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={`w-48 ${inputCls}`}
          />
          <Button onClick={onCreateAccount} disabled={busy === "create"}>
            {busy === "create" ? "Đang tạo…" : "Tạo tài khoản"}
          </Button>
          <span className="text-xs text-muted-foreground">Tạo hộ + tự xác nhận email (khỏi cần verify).</span>
        </div>
      </Card>

      {/* Danh sách user */}
      <Card>
        <h2 className="mb-3 font-medium">Người dùng ({users?.length ?? 0})</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-2">Email</th>
                <th className="py-2 pr-2">Ngày tạo</th>
                <th className="py-2 pr-2">Trạng thái</th>
                <th className="py-2 pr-2">Hạn Pro</th>
                <th className="py-2 pr-2 text-center">Admin</th>
                <th className="py-2 pr-2">Gán Pro</th>
                <th className="py-2 pr-2">Xoá</th>
              </tr>
            </thead>
            <tbody>
              {(users ?? []).map((u) => (
                <tr key={u.id} className="border-b border-border">
                  <td className="py-2 pr-2">{u.email ?? "—"}</td>
                  <td className="py-2 pr-2">{new Date(u.created_at).toLocaleDateString("vi-VN")}</td>
                  <td className="py-2 pr-2">{u.status}</td>
                  <td className="py-2 pr-2">
                    {u.paid_until ? new Date(u.paid_until).toLocaleDateString("vi-VN") : "—"}
                  </td>
                  <td className="py-2 pr-2 text-center">
                    <button
                      disabled={busy === u.id}
                      onClick={() => onToggleAdmin(u)}
                      title="Bật/tắt quyền admin"
                      className="text-lg"
                    >
                      {u.is_admin ? "✅" : "⬜"}
                    </button>
                  </td>
                  <td className="py-2 pr-2">
                    <GrantCell disabled={busy === u.id} onGrant={(d) => onGrant(u, d)} />
                  </td>
                  <td className="py-2 pr-2">
                    <Button variant="ghost" disabled={busy === u.id} onClick={() => void onDeleteAccount(u)}>
                      Xoá
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default function AdminPage() {
  return (
    <AuthGuard>
      <AdminInner />
    </AuthGuard>
  );
}

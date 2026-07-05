"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageLoading } from "@/components/ui/Spinner";
import { ApiError } from "@/lib/apiClient";
import {
  fetchAdminStats,
  fetchAdminUsers,
  setProPrice,
  grantPro,
  setUserAdmin,
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

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl font-bold">Admin</h1>
      {msg ? <p className="rounded-card border border-border bg-surface-muted px-3 py-2 text-sm">{msg}</p> : null}

      {/* Thống kê */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-muted-foreground">Tổng user</p>
          <p className="mt-1 text-2xl font-bold">{stats?.total_users ?? 0}</p>
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

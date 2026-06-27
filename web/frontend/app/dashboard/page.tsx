"use client";
import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { useUser } from "@/hooks/useUser";
import { apiFetch } from "@/lib/apiClient";
import { Card } from "@/components/ui/Card";

// Placeholder dashboard — chỉ để chứng minh auth + /api/me. UI thật ở TIP sau (WEB-02).
type MeResponse = {
  user: { id: string; email: string | null };
  profile: { id: string; nickname: string | null; daily_commit_minutes: number } | null;
};

function DashboardInner() {
  const { user } = useUser();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<MeResponse>("/api/me")
      .then(setMe)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl font-bold">Dashboard</h1>
      <Card>
        <p className="text-sm text-muted-foreground">Đã đăng nhập:</p>
        <p className="font-medium">{user?.email}</p>
      </Card>
      <Card>
        <p className="mb-1 text-sm text-muted-foreground">Kết quả GET /api/me (auth end-to-end):</p>
        {error ? (
          <p className="text-sm text-red-600">Lỗi: {error}</p>
        ) : me ? (
          <ul className="text-sm">
            <li>profile.id: {me.profile?.id ?? "∅"}</li>
            <li>nickname: {me.profile?.nickname ?? "∅"}</li>
            <li>daily_commit_minutes: {me.profile?.daily_commit_minutes ?? "∅"}</li>
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Đang tải…</p>
        )}
      </Card>
      <p className="text-xs text-muted-foreground">
        ⚠️ Trang tạm (placeholder). Dashboard thật (streak, đồ thị) ở TIP sau.
      </p>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardInner />
    </AuthGuard>
  );
}

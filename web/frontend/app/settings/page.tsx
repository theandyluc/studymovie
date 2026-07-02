"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageLoading } from "@/components/ui/Spinner";
import { getSupabase } from "@/lib/supabaseClient";
import { fetchProfile, fetchMe, updateProfile, subscriptionText, type Me, type Profile } from "@/lib/account";

const DICT_SOURCE_URL = "https://github.com/manhminno/English-Vietnamese-Dictionary";
const FREEDICT_URL = "https://dictionaryapi.dev/";

function SettingsInner() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [minutes, setMinutes] = useState(30);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([fetchProfile(), fetchMe()])
      .then(([p, m]) => {
        setProfile(p);
        setMe(m);
        setNickname(p.nickname ?? "");
        setMinutes(p.daily_commit_minutes ?? 30);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const p = await updateProfile({ nickname: nickname.trim(), daily_commit_minutes: minutes });
      setProfile(p);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const signOut = async () => {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    router.replace("/");
  };

  if (error) return <Card><p className="text-sm text-danger-foreground">Lỗi: {error}</p></Card>;
  if (!profile || !me) return <PageLoading />;

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl font-bold">Cài đặt</h1>

      <Card className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">Nickname (hiển thị trên bảng xếp hạng)</label>
          <input
            value={nickname}
            onChange={(e) => {
              setNickname(e.target.value);
              setSaved(false);
            }}
            maxLength={50}
            className="w-full rounded-btn border border-border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">Phút cam kết mỗi ngày</label>
          <input
            type="number"
            min={1}
            max={600}
            value={minutes}
            onChange={(e) => {
              setMinutes(Number(e.target.value));
              setSaved(false);
            }}
            className="w-32 rounded-btn border border-border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={saving}>
            {saving ? "Đang lưu…" : "Lưu"}
          </Button>
          {saved ? <span className="text-sm text-success-foreground">Đã lưu ✓</span> : null}
        </div>
      </Card>

      <Card>
        <p className="text-sm text-muted-foreground">Tài khoản</p>
        <p className="font-medium">{me.user.email}</p>
        <p className="mt-2 text-sm text-muted-foreground">Gói: {subscriptionText(me)}</p>
        <Button variant="ghost" className="mt-4" onClick={signOut}>
          Đăng xuất
        </Button>
      </Card>

      <Card className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Nghĩa tiếng Việt: <strong>Free Vietnamese Dictionary Project</strong> © Hồ Ngọc Đức (GNU GPL v2).{" "}
          <a href={DICT_SOURCE_URL} target="_blank" rel="noreferrer" className="text-primary underline">
            Nguồn
          </a>
        </p>
        <p className="text-xs text-muted-foreground">
          Định nghĩa tiếng Anh + phát âm: <strong>Free Dictionary API</strong> (Wiktionary, CC BY-SA).{" "}
          <a href={FREEDICT_URL} target="_blank" rel="noreferrer" className="text-primary underline">
            Nguồn
          </a>
        </p>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <AuthGuard>
      <SettingsInner />
    </AuthGuard>
  );
}

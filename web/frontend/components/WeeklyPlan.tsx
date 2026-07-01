"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  fetchWeeklyPlan,
  addWeeklyPlan,
  updateWeeklyPlan,
  deleteWeeklyPlan,
  type WeeklyPlan,
  type PlanInput,
} from "@/lib/weeklyPlan";
import { toast, confirmDialog } from "@/components/ui/feedback";

const EMPTY: PlanInput = { plan_date: "", video_link: "", committed_time: "" };
const inputCls = "w-full rounded-btn border border-border px-2 py-1 text-sm";

// TIP-017 — Bảng "Kế hoạch tuần này": mọi ô input text, link clickable, tick hoàn thành,
// thêm dòng (Lưu/Huỷ), sửa (✏️) inline, xóa (🗑️). CRUD qua backend /api/weekly-plan (RLS).
export function WeeklyPlanTable() {
  const [items, setItems] = useState<WeeklyPlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<PlanInput>(EMPTY);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PlanInput>(EMPTY);

  useEffect(() => {
    fetchWeeklyPlan()
      .then(setItems)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const fail = (e: unknown) => toast("Lỗi: " + (e instanceof Error ? e.message : String(e)), "error");

  const onAdd = async () => {
    if (!form.plan_date.trim() && !form.video_link.trim() && !form.committed_time.trim()) return;
    setAdding(true);
    try {
      const it = await addWeeklyPlan(form);
      setItems((c) => [...(c ?? []), it]);
      setForm(EMPTY);
    } catch (e) {
      fail(e);
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (it: WeeklyPlan) => {
    setEditId(it.id);
    setEditForm({
      plan_date: it.plan_date ?? "",
      video_link: it.video_link ?? "",
      committed_time: it.committed_time ?? "",
    });
  };

  const saveEdit = async (id: string) => {
    setBusy(id);
    try {
      const up = await updateWeeklyPlan(id, editForm);
      setItems((c) => (c ?? []).map((x) => (x.id === id ? up : x)));
      setEditId(null);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const toggleDone = async (it: WeeklyPlan) => {
    setBusy(it.id);
    try {
      const up = await updateWeeklyPlan(it.id, { done: !it.done });
      setItems((c) => (c ?? []).map((x) => (x.id === it.id ? up : x)));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (it: WeeklyPlan) => {
    if (!(await confirmDialog({ title: "Xóa dòng kế hoạch này?", danger: true, confirmText: "Xóa" }))) return;
    setBusy(it.id);
    try {
      await deleteWeeklyPlan(it.id);
      setItems((c) => (c ?? []).filter((x) => x.id !== it.id));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <h2 className="mb-3 font-medium">Kế hoạch tuần này</h2>

      {error ? (
        <p className="text-sm text-red-600">Không tải được kế hoạch: {error}</p>
      ) : !items ? (
        <p className="text-sm text-muted-foreground">Đang tải…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="w-16 py-2 pr-2"></th>
                <th className="py-2 pr-2">Ngày</th>
                <th className="py-2 pr-2">Link video</th>
                <th className="py-2 pr-2">Thời gian cam kết</th>
                <th className="py-2 pr-2 text-center">Hoàn thành?</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted-foreground">
                    Chưa có kế hoạch. Thêm dòng bên dưới.
                  </td>
                </tr>
              ) : (
                items.map((it) =>
                  editId === it.id ? (
                    <tr key={it.id} className="border-b border-border">
                      <td className="py-2 pr-2">
                        <div className="flex gap-1">
                          <button title="Lưu" disabled={busy === it.id} onClick={() => saveEdit(it.id)}>
                            💾
                          </button>
                          <button title="Huỷ" onClick={() => setEditId(null)}>
                            ✖️
                          </button>
                        </div>
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          className={inputCls}
                          value={editForm.plan_date}
                          onChange={(e) => setEditForm({ ...editForm, plan_date: e.target.value })}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          className={inputCls}
                          value={editForm.video_link}
                          onChange={(e) => setEditForm({ ...editForm, video_link: e.target.value })}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          className={inputCls}
                          value={editForm.committed_time}
                          onChange={(e) => setEditForm({ ...editForm, committed_time: e.target.value })}
                        />
                      </td>
                      <td className="py-2 pr-2 text-center">—</td>
                    </tr>
                  ) : (
                    <tr key={it.id} className={`border-b border-border ${it.done ? "opacity-60" : ""}`}>
                      <td className="py-2 pr-2">
                        <div className="flex gap-1">
                          <button title="Sửa" disabled={busy === it.id} onClick={() => startEdit(it)}>
                            ✏️
                          </button>
                          <button title="Xóa" disabled={busy === it.id} onClick={() => remove(it)}>
                            🗑️
                          </button>
                        </div>
                      </td>
                      <td className="py-2 pr-2">{it.plan_date || "—"}</td>
                      <td className="py-2 pr-2">
                        {it.video_link ? (
                          <a
                            href={it.video_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline break-all"
                          >
                            {it.video_link}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2 pr-2">{it.committed_time || "—"}</td>
                      <td className="py-2 pr-2 text-center">
                        <input
                          type="checkbox"
                          checked={it.done}
                          disabled={busy === it.id}
                          onChange={() => toggleDone(it)}
                        />
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
          {/* TIP-033 — quote động viên (theo Figma) */}
          <p className="mt-3 text-center text-xs italic text-muted-foreground">
            “Bạn sẽ thành công thôi, bởi vì hầu hết mọi người đều rất lười.” — Shahir Zag
          </p>
        </div>
      )}

      {/* Form thêm dòng (Lưu / Huỷ) — không auto-save */}
      <div className="mt-4 border-t border-border pt-3">
        <p className="mb-2 text-sm text-muted-foreground">Thêm dòng</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <input
            className={inputCls}
            placeholder="Ngày (dd/mm/yyyy)"
            value={form.plan_date}
            onChange={(e) => setForm({ ...form, plan_date: e.target.value })}
          />
          <input
            className={inputCls}
            placeholder="Link video"
            value={form.video_link}
            onChange={(e) => setForm({ ...form, video_link: e.target.value })}
          />
          <input
            className={inputCls}
            placeholder="Thời gian cam kết (vd 02h30m)"
            value={form.committed_time}
            onChange={(e) => setForm({ ...form, committed_time: e.target.value })}
          />
        </div>
        <div className="mt-2 flex gap-2">
          <Button onClick={onAdd} disabled={adding}>
            {adding ? "Đang lưu…" : "Lưu"}
          </Button>
          <Button variant="ghost" onClick={() => setForm(EMPTY)} disabled={adding}>
            Huỷ
          </Button>
        </div>
      </div>
    </Card>
  );
}

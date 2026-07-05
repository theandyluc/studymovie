"use client";
import { useEffect, useState } from "react";
import {
  fetchWeeklyPlan,
  addWeeklyPlan,
  updateWeeklyPlan,
  deleteWeeklyPlan,
  type WeeklyPlan,
  type PlanInput,
} from "@/lib/weeklyPlan";
import { toast, confirmDialog } from "@/components/ui/feedback";
import { PencilIcon, DeleteIcon, CheckboxIcon } from "@/components/ui/icons";

const EMPTY: PlanInput = { plan_date: "", video_link: "", committed_time: "" };
const inputCls = "w-full rounded-btn border border-border px-2 py-1 text-sm";

// TIP-081 — hiển thị ngày dạng dd/mm/yyyy (Figma), không dùng dấu "-" của ISO (yyyy-mm-dd) lưu ở DB.
function fmtPlanDate(s: string): string {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}

// TIP-081 — nút Lưu/Huỷ dạng pill nhỏ (xanh/hồng nhạt theo Figma) dùng cho dòng Thêm mới + dòng đang Sửa.
function SaveCancelButtons({
  saving,
  onSave,
  onCancel,
}: {
  saving?: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        disabled={saving}
        onClick={onSave}
        className="w-full rounded-pill bg-success px-3 py-0.5 text-xs font-medium text-success-foreground disabled:opacity-50"
      >
        {saving ? "…" : "Lưu"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="w-full rounded-pill bg-danger px-3 py-0.5 text-xs font-medium text-danger-foreground"
      >
        Huỷ
      </button>
    </div>
  );
}

/* ============================================================
   GIẢI THÍCH CHO KHÁCH — File: components/WeeklyPlan.tsx
   ------------------------------------------------------------
   Bảng "Kế hoạch tuần này" — nơi người dùng tự lên lịch học:
   - LUÔN hiện 7 dòng (ứng với 7 ngày trong tuần). Dòng chưa có kế hoạch
     chỉ hiện 2 icon Sửa/Xóa, các cột còn lại để trống — không có khu
     "Thêm dòng" riêng nữa.
   - Bấm icon bút chì (Sửa) ở dòng nào → dòng đó hiện ô nhập để điền
     Ngày/Link video/Thời gian, bấm Lưu mới ghi (dòng trống → tạo mới,
     dòng đã có dữ liệu → cập nhật).
   - Xoá dòng (icon thùng rác) sẽ hỏi xác nhận trước; dòng trở lại trống,
     tổng số dòng vẫn giữ 7.
   Mọi thay đổi được lưu lên máy chủ; mỗi người chỉ thấy kế hoạch của mình.
   ============================================================ */
// TIP-017/TIP-081 — Bảng "Kế hoạch tuần này": luôn đúng 7 "ô ngày" (item thật + đệm rỗng cho đủ 7).
// Sửa tại chỗ dùng chung cho cả ô rỗng (tạo mới - addWeeklyPlan) lẫn ô đã có dữ liệu (cập nhật -
// updateWeeklyPlan). CRUD qua backend (RLS).
const DAY_COUNT = 7;
const emptyEditKey = (idx: number): string => `__empty_${idx}`;

export function WeeklyPlanTable() {
  const [items, setItems] = useState<WeeklyPlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PlanInput>(EMPTY);

  useEffect(() => {
    fetchWeeklyPlan()
      .then(setItems)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const fail = (e: unknown) => toast("Lỗi: " + (e instanceof Error ? e.message : String(e)), "error");

  const startEdit = (it: WeeklyPlan) => {
    setEditId(it.id);
    setEditForm({
      plan_date: it.plan_date ?? "",
      video_link: it.video_link ?? "",
      committed_time: it.committed_time ?? "",
    });
  };

  const startEditEmpty = (idx: number) => {
    setEditId(emptyEditKey(idx));
    setEditForm(EMPTY);
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

  const saveNewFromEmpty = async (idx: number) => {
    if (!editForm.plan_date.trim() && !editForm.video_link.trim() && !editForm.committed_time.trim()) {
      setEditId(null);
      return;
    }
    const key = emptyEditKey(idx);
    setBusy(key);
    try {
      const it = await addWeeklyPlan(editForm);
      setItems((c) => [...(c ?? []), it]);
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

  // TIP-081 — kích thước 659x448 theo Figma, cột header theo đúng px (colgroup cố định).
  // min-h thay vì h cố định: số dòng kế hoạch có thể nhiều hơn mock Figma, không ép cắt nội dung.
  return (
    <div className="h-[448px] w-[659px] overflow-y-auto rounded-card border border-border bg-surface pt-[13px]">
      <h2 className="font-heading text-center text-lg font-normal text-foreground">Kế hoạch tuần này</h2>

      {error ? (
        <p className="px-6 pt-3 text-sm text-danger-foreground">Không tải được kế hoạch: {error}</p>
      ) : !items ? (
        <p className="px-6 pt-3 text-sm text-muted-foreground">Đang tải…</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-[659px] table-fixed border-collapse text-sm">
            <colgroup>
              <col style={{ width: 82 }} />
              <col style={{ width: 123 }} />
              <col style={{ width: 185 }} />
              <col style={{ width: 179 }} />
              <col style={{ width: 90 }} />
            </colgroup>
            <thead>
              <tr className="border-b border-border text-left text-[#cccccc]">
                <th className="pb-[14px] pt-2"></th>
                <th className="pb-[14px] pt-2 pr-2 text-sm font-normal tracking-[-0.03em]">Ngày</th>
                <th className="pb-[14px] pt-2 pr-2 text-sm font-normal tracking-[-0.03em]">Link video (dự định học)</th>
                <th className="pb-[14px] pt-2 pr-2 text-center text-sm font-normal tracking-[-0.03em]">Thời gian cam kết</th>
                <th className="pb-[14px] pt-2 pr-2 text-center text-sm font-normal tracking-[-0.03em]">Hoàn thành?</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                // TIP-081 — luôn đủ DAY_COUNT (7) dòng: item thật trước, đệm ô rỗng (null) cho đủ 7.
                const slots: (WeeklyPlan | null)[] = [...items];
                while (slots.length < DAY_COUNT) slots.push(null);

                return slots.map((it, idx) => {
                  const key = it ? it.id : emptyEditKey(idx);
                  const editingThis = editId === key;

                  if (editingThis) {
                    return (
                      <tr key={key} className="border-b border-border">
                        <td className="py-2 pr-2"></td>
                        <td className="py-2 pr-2">
                          <input
                            className={inputCls}
                            placeholder="dd/mm/yyyy"
                            value={editForm.plan_date}
                            onChange={(e) => setEditForm({ ...editForm, plan_date: e.target.value })}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            className={inputCls}
                            placeholder="Link video (dự kiến học)"
                            value={editForm.video_link}
                            onChange={(e) => setEditForm({ ...editForm, video_link: e.target.value })}
                          />
                        </td>
                        <td className="py-2 pr-2 text-center">
                          {/* TIP-081 — hộp input căn giữa cột (thẳng theo header "Thời gian cam kết" đang center),
                              nhưng CHỮ bên trong input căn trái (mặc định input) như bạn yêu cầu. */}
                          <input
                            className="relative left-[-7px] mx-auto block w-24 rounded-btn border border-border px-2 py-1 text-left text-sm"
                            placeholder="hhmm"
                            value={editForm.committed_time}
                            onChange={(e) => setEditForm({ ...editForm, committed_time: e.target.value })}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <SaveCancelButtons
                            saving={busy === key}
                            onSave={() => (it ? saveEdit(it.id) : saveNewFromEmpty(idx))}
                            onCancel={() => setEditId(null)}
                          />
                        </td>
                      </tr>
                    );
                  }

                  // Ô trống (chưa có kế hoạch) — chỉ hiện icon Sửa/Xóa, các cột còn lại để trống.
                  if (!it) {
                    return (
                      <tr key={key} className="border-b border-border">
                        <td className="py-0 pr-2">
                          <div className="flex items-center gap-[2px] pb-[12px] pl-[10px] pt-[10px]">
                            <button title="Xóa" disabled className="text-[#cccccc] opacity-30">
                              <DeleteIcon />
                            </button>
                            <button
                              title="Sửa"
                              onClick={() => startEditEmpty(idx)}
                              className="text-[#cccccc] transition-colors hover:text-[#1f1f1f]"
                            >
                              <PencilIcon />
                            </button>
                          </div>
                        </td>
                        <td className="pr-2"></td>
                        <td className="pr-2"></td>
                        <td className="pr-2"></td>
                        <td className="pr-2"></td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={key} className={`border-b border-border align-middle ${it.done ? "opacity-60" : ""}`}>
                      <td className="py-0 pr-2">
                        {/* TIP-081 — 10px lề trái, 10px trên (dưới line header/hàng trước), 2px giữa 2 icon,
                            12px dưới (trên line kế tiếp) → td không padding, height do khối icon quyết định,
                            các ô khác căn giữa theo (vertical-align:middle mặc định của <td>). */}
                        <div className="flex items-center gap-[2px] pb-[12px] pl-[10px] pt-[10px]">
                          <button
                            title="Xóa"
                            disabled={busy === it.id}
                            onClick={() => remove(it)}
                            className="text-[#cccccc] transition-colors hover:text-[#1f1f1f] disabled:opacity-50"
                          >
                            <DeleteIcon />
                          </button>
                          <button
                            title="Sửa"
                            disabled={busy === it.id}
                            onClick={() => startEdit(it)}
                            className="text-[#cccccc] transition-colors hover:text-[#1f1f1f] disabled:opacity-50"
                          >
                            <PencilIcon />
                          </button>
                        </div>
                      </td>
                      <td className="pr-2">{it.plan_date ? fmtPlanDate(it.plan_date) : "—"}</td>
                      <td className="pr-2">
                        {it.video_link ? (
                          <a
                            href={it.video_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block truncate text-[#005fb9] underline"
                          >
                            {it.video_link}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="pr-2 text-center">{it.committed_time || "—"}</td>
                      <td className="pr-2 text-center">
                        <button
                          type="button"
                          aria-label={it.done ? "Bỏ đánh dấu hoàn thành" : "Đánh dấu hoàn thành"}
                          disabled={busy === it.id}
                          onClick={() => toggleDone(it)}
                          className="inline-flex disabled:opacity-50"
                        >
                          <CheckboxIcon checked={it.done} />
                        </button>
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
          {/* TIP-033 — quote động viên (theo Figma) */}
          <p className="mt-[16px] pl-[18px] text-left text-[12px] italic text-foreground">
            “Bạn sẽ thành công thôi, bởi vì hầu hết mọi người đều rất lười”. - Shahir Zag.
          </p>
        </div>
      )}
    </div>
  );
}

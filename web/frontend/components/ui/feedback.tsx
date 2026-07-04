/* ============================================================
   GIẢI THÍCH CHO KHÁCH — File: components/ui/feedback.tsx
   ------------------------------------------------------------
   Hai công cụ báo cho người dùng, đẹp hơn hộp thoại mặc định của
   trình duyệt:
   1) Toast — thông báo nhỏ hiện ở góc phải rồi tự biến mất sau vài
      giây (ví dụ "Xóa lỗi", "Đã lưu"). Có 3 màu: đỏ (lỗi), xanh lá
      (thành công), xám (thông tin).
   2) ConfirmDialog — hộp hỏi "Bạn có chắc không?" trước các thao tác
      nguy hiểm như xoá, để tránh bấm nhầm.

   Hai thành phần <Toaster/> và <ConfirmHost/> được gắn MỘT LẦN ở
   khung chung (layout) nên mọi trang đều dùng được.
   ============================================================ */
"use client";
import { useEffect, useState } from "react";

// UX — Toast + ConfirmDialog dùng chung, thay cho alert()/confirm() gốc trình duyệt.
// Overlay (không sửa layout trang nào). Mount <Toaster/> + <ConfirmHost/> 1 lần trong layout.

// ───────────────── Toast ─────────────────
type Tone = "error" | "success" | "info";
type ToastItem = { id: number; text: string; tone: Tone };
let toastListeners: Array<(items: ToastItem[]) => void> = [];
let toastItems: ToastItem[] = [];
let toastSeq = 0;
function emitToasts(): void {
  for (const l of toastListeners) l(toastItems);
}

export function toast(text: string, tone: Tone = "info"): void {
  const id = ++toastSeq;
  toastItems = [...toastItems, { id, text, tone }];
  emitToasts();
  setTimeout(() => {
    toastItems = toastItems.filter((t) => t.id !== id);
    emitToasts();
  }, 3200);
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    toastListeners.push(setItems);
    return () => {
      toastListeners = toastListeners.filter((l) => l !== setItems);
    };
  }, []);
  if (items.length === 0) return null;
  const toneCls: Record<Tone, string> = {
    error: "border-danger-foreground bg-danger text-danger-foreground",
    success: "border-success-foreground bg-success text-success-foreground",
    info: "border-border bg-surface text-foreground",
  };
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {items.map((t) => (
        <div key={t.id} className={`rounded-card border px-4 py-3 text-sm shadow-lg ${toneCls[t.tone]}`} role="status">
          {t.text}
        </div>
      ))}
    </div>
  );
}

// ───────────────── Confirm dialog ─────────────────
type ConfirmOpts = { title: string; message?: string; confirmText?: string; cancelText?: string; danger?: boolean };
let confirmListener: ((o: ConfirmOpts | null) => void) | null = null;
let confirmResolver: ((v: boolean) => void) | null = null;

// Drop-in thay window.confirm: `if (!(await confirmDialog({title}))) return;`
export function confirmDialog(opts: ConfirmOpts): Promise<boolean> {
  return new Promise((resolve) => {
    confirmResolver = resolve;
    confirmListener?.(opts);
  });
}

export function ConfirmHost() {
  const [opts, setOpts] = useState<ConfirmOpts | null>(null);
  useEffect(() => {
    confirmListener = setOpts;
    return () => {
      confirmListener = null;
    };
  }, []);
  const close = (v: boolean): void => {
    confirmResolver?.(v);
    confirmResolver = null;
    setOpts(null);
  };
  if (!opts) return null;
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4" onClick={() => close(false)}>
      <div
        className="w-full max-w-sm rounded-card border border-border bg-surface p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
      >
        <h3 className="font-heading text-lg font-bold">{opts.title}</h3>
        {opts.message ? <p className="mt-1 text-sm text-muted-foreground">{opts.message}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => close(false)}
            className="rounded-btn border border-border px-4 py-2 text-sm hover:bg-surface-muted"
          >
            {opts.cancelText ?? "Huỷ"}
          </button>
          <button
            onClick={() => close(true)}
            className={`rounded-btn px-4 py-2 text-sm font-medium text-white ${
              opts.danger ? "bg-red-600 hover:bg-red-700" : "bg-primary hover:bg-primary-hover"
            }`}
          >
            {opts.confirmText ?? "Xác nhận"}
          </button>
        </div>
      </div>
    </div>
  );
}

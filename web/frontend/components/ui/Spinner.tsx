/* GIẢI THÍCH CHO KHÁCH — components/ui/Spinner.tsx
   "Vòng xoay đang tải". Spinner là vòng tròn quay nhỏ; PageLoading là
   cả một màn hình chờ (vòng xoay + dòng chữ "Đang tải") hiện khi web
   đang lấy dữ liệu từ máy chủ. */
export function Spinner({ size = 24 }: { size?: number }) {
  return (
    <span
      role="status"
      aria-label="Đang tải"
      style={{ width: size, height: size }}
      className="inline-block animate-spin rounded-full border-2 border-border border-t-primary"
    />
  );
}

export function PageLoading({ label = "Đang tải" }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <Spinner size={32} />
      {label ? <p className="text-sm">{label}</p> : null}
    </div>
  );
}

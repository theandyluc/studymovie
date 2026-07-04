/* GIẢI THÍCH CHO KHÁCH — components/ui/Avatar.tsx
   Ảnh đại diện của người dùng. Nếu có ảnh (ví dụ ảnh Google) thì
   hiển thị ảnh đó; nếu không có ảnh thì hiển thị một vòng tròn với
   chữ cái đầu của tên. Dùng ở bảng xếp hạng, hồ sơ... */
export function Avatar({
  src,
  name,
  size = 32,
}: {
  src?: string | null;
  name?: string | null;
  size?: number;
}) {
  const initial = (name ?? "?").trim().charAt(0).toUpperCase() || "?";
  const dim = { width: size, height: size };
  if (src) {
    // Dùng <img> (không next/image) cho avatar Google ngoài domain — placeholder, reskin sau.
    return (
      <img
        src={src}
        alt={name ?? "avatar"}
        style={dim}
        className="rounded-full object-cover"
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <span
      style={dim}
      className="inline-flex items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground"
    >
      {initial}
    </span>
  );
}

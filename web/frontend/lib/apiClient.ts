/* ============================================================
   GIẢI THÍCH CHO KHÁCH — File: lib/apiClient.ts
   ------------------------------------------------------------
   Đây là "người đưa thư" chung: mỗi khi trang web cần lấy hoặc
   gửi dữ liệu (từ vựng, tiến độ, thanh toán...), nó gọi hàm
   apiFetch ở đây để nói chuyện với máy chủ (backend).

   apiFetch tự động làm 3 việc:
   1) Đính kèm "vé đăng nhập" (token) của người dùng vào mỗi yêu cầu
      để máy chủ biết đây là ai.
   2) Nếu máy chủ báo lỗi, gói lỗi lại (ApiError) kèm mã lỗi để màn
      hình hiển thị thông báo dễ hiểu.
   3) Nếu vé đăng nhập hết hạn (lỗi 401), tự đăng xuất và đưa người
      dùng về trang đầu để đăng nhập lại — tránh bị "kẹt".
   ============================================================ */
// TIP-003 — Gọi backend (NEXT_PUBLIC_BACKEND_URL) kèm Bearer token từ session Supabase.
import { getSupabase } from "./supabaseClient";

const BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";

// Lỗi API mang theo status + code (body.error) để UI map sang thông báo thân thiện.
export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, code?: string) {
    super(code ?? `HTTP ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export async function apiFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    let code: string | undefined;
    try {
      const body = (await res.json()) as { error?: unknown };
      if (typeof body.error === "string") code = body.error;
    } catch {
      /* body không phải JSON */
    }

    // (Giải thích) Lỗi 401 = "vé đăng nhập" không còn hiệu lực (ví dụ người dùng
    // đã đăng xuất ở tiện ích trình duyệt). Ở đây web tự dọn phiên cũ và quay về
    // trang chủ để người dùng đăng nhập lại, thay vì hiện màn hình lỗi khó hiểu.
    // TIP-045 — 401 = token hết hiệu lực (vd bị thu hồi khi đăng xuất ở extension).
    // Dọn session cũ (local) + về trang login để web tự phục hồi, không kẹt "invalid token".
    if (res.status === 401) {
      try {
        await sb?.auth.signOut({ scope: "local" });
      } catch {
        /* ignore */
      }
      if (typeof window !== "undefined" && window.location.pathname !== "/") {
        window.location.replace("/");
      }
    }
    throw new ApiError(res.status, code);
  }
  return (await res.json()) as T;
}

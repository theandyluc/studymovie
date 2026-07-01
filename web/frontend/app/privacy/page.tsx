import Link from "next/link";
import { Card } from "@/components/ui/Card";

// TIP-031 WI-2 — Chính sách quyền riêng tư (public, render tĩnh).
// Dùng cho Chrome Web Store (Privacy policy URL) + minh bạch với người dùng.
// KHÔNG AuthGuard, KHÔNG nằm trong PROTECTED của AccessGuard → ai cũng xem được.

export const metadata = {
  title: "Chính sách quyền riêng tư — StudyMovie",
  description: "StudyMovie thu thập và sử dụng dữ liệu như thế nào.",
};

const CONTACT_EMAIL = "dkhiem2k4@gmail.com";
const UPDATED = "01/07/2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-heading text-lg font-bold">{title}</h2>
      <div className="space-y-2 text-sm text-muted-foreground">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <Card className="space-y-6">
        <div>
          <h1 className="font-heading text-2xl font-bold">Chính sách quyền riêng tư</h1>
          <p className="mt-1 text-xs text-muted-foreground">Cập nhật lần cuối: {UPDATED}</p>
        </div>

        <p className="text-sm text-muted-foreground">
          StudyMovie là dịch vụ học tiếng Anh qua YouTube với phụ đề song ngữ và ôn từ vựng, gồm tiện ích
          Chrome và web app tại app.studymovie.com. Chính sách này giải thích chúng tôi thu thập dữ liệu gì,
          dùng để làm gì, lưu ở đâu và bạn có quyền gì.
        </p>

        <Section title="1. Dữ liệu chúng tôi thu thập">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Thông tin tài khoản:</strong> địa chỉ email, tên hiển thị và ảnh đại diện từ hồ sơ Google
              khi bạn đăng nhập bằng Google (hoặc email &amp; mật khẩu).
            </li>
            <li>
              <strong>Dữ liệu học tập:</strong> thời gian học, tiến độ, cấp độ, chuỗi ngày học (streak) và danh
              sách từ vựng bạn lưu.
            </li>
            <li>
              <strong>Thông tin thanh toán:</strong> khi nâng cấp gói Pro, giao dịch được xử lý qua VietQR/SePay.
              Chúng tôi nhận thông tin xác nhận giao dịch (mã đơn, trạng thái, số tiền) để kích hoạt gói — chúng
              tôi <strong>không</strong> lưu số thẻ hay thông tin ngân hàng đầy đủ của bạn.
            </li>
            <li>
              <strong>Cài đặt tiện ích:</strong> tùy chọn hiển thị phụ đề (chế độ, màu, cỡ chữ…) và phiên đăng
              nhập, lưu cục bộ trong trình duyệt để đồng bộ tài khoản.
            </li>
          </ul>
        </Section>

        <Section title="2. Mục đích sử dụng">
          <ul className="list-disc space-y-1 pl-5">
            <li>Cung cấp và vận hành tính năng học: phụ đề song ngữ, ôn từ vựng, thống kê tiến độ, bảng xếp hạng.</li>
            <li>Xác thực đăng nhập và đồng bộ dữ liệu giữa tiện ích Chrome và web app.</li>
            <li>Xử lý và kích hoạt gói Pro sau thanh toán.</li>
            <li>Cải thiện chất lượng dịch vụ.</li>
          </ul>
          <p>Chúng tôi <strong>không bán</strong> dữ liệu cá nhân của bạn cho bên thứ ba.</p>
        </Section>

        <Section title="3. Lưu trữ dữ liệu">
          <p>
            Dữ liệu được lưu trên hạ tầng <strong>Supabase</strong> (cơ sở dữ liệu PostgreSQL) đặt tại khu vực
            <strong> Singapore</strong>. Chúng tôi áp dụng phân quyền theo từng người dùng (Row Level Security) để
            mỗi tài khoản chỉ truy cập được dữ liệu của chính mình.
          </p>
        </Section>

        <Section title="4. Bên thứ ba">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>YouTube (timedtext):</strong> tiện ích lấy phụ đề công khai của video từ YouTube để hiển thị
              song ngữ. Chúng tôi không gửi dữ liệu cá nhân của bạn cho YouTube.
            </li>
            <li>
              <strong>SePay / VietQR:</strong> xử lý thanh toán và gửi xác nhận giao dịch.
            </li>
            <li>
              <strong>Supabase:</strong> nhà cung cấp xác thực và cơ sở dữ liệu.
            </li>
            <li>
              <strong>Google:</strong> đăng nhập OAuth (chúng tôi chỉ nhận email và hồ sơ cơ bản bạn cho phép).
            </li>
          </ul>
          <p>Chúng tôi không bán, cho thuê hay trao đổi dữ liệu của bạn với bất kỳ bên nào ngoài mục đích vận hành trên.</p>
        </Section>

        <Section title="5. Quyền của bạn">
          <p>
            Bạn có thể xem, chỉnh sửa từ vựng đã lưu và đăng xuất bất cứ lúc nào. Nếu muốn xóa tài khoản và toàn bộ
            dữ liệu liên quan, hãy liên hệ chúng tôi qua email bên dưới — chúng tôi sẽ xử lý yêu cầu.
          </p>
        </Section>

        <Section title="6. Quyền của tiện ích Chrome">
          <p>Tiện ích yêu cầu các quyền tối thiểu để hoạt động:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>storage:</strong> lưu cài đặt phụ đề và phiên đăng nhập cục bộ.</li>
            <li><strong>tabs:</strong> mở trang web app khi bạn thao tác từ popup.</li>
            <li><strong>scripting</strong> + quyền trên youtube.com: chèn lớp phụ đề song ngữ vào trình phát.</li>
            <li><strong>alarms:</strong> ghi nhận thời gian học định kỳ.</li>
            <li><strong>quyền trên app.studymovie.com:</strong> đọc phiên đăng nhập để đồng bộ tài khoản.</li>
          </ul>
        </Section>

        <Section title="7. Liên hệ">
          <p>
            Mọi câu hỏi về quyền riêng tư, vui lòng liên hệ:{" "}
            <a className="text-primary underline" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>

        <div className="border-t border-border pt-4 text-sm">
          <Link href="/" className="text-primary underline">
            ← Về trang chủ
          </Link>
        </div>
      </Card>
    </div>
  );
}

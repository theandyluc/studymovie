# BÀN GIAO — Xử lý Feedback & Hoàn thiện StudyMovie
**Ngày:** 02/07/2026

Tài liệu tổng hợp **toàn bộ những gì đã sửa/hoàn thiện** sau đợt feedback của anh, cùng **các việc cần làm để lên production** (đặc biệt là thiết lập thanh toán tự động SePay).

---

## PHẦN A — Đã xử lý toàn bộ 13 điểm feedback

| # | Anh yêu cầu | Đã làm |
|---|---|---|
| 1 | Nghĩa từ chưa sát ngữ cảnh | Nghĩa từ giờ dùng **AI (GPT-4o-mini)** đọc cả câu để chọn nghĩa đúng ngữ cảnh (có cache + tự lùi về từ điển nếu lỗi) |
| 2 | Từ có nhiều phiên âm | Chỉ hiện **1 phiên âm**, ưu tiên giọng **Anh-Anh (UK)** |
| 3 | Biểu đồ từ vựng lệch tổng | Biểu đồ "Từ vựng đã học theo ngày" giờ **khớp đúng tổng số** |
| 4 | Bỏ mục Blog | Đã **bỏ "Blog"** khỏi menu |
| 5 | Chữ tải trang không đồng nhất | Mọi màn tải đều hiện **"Đang tải"** |
| 6 | Bỏ avatar+tên (menu cài đặt) góc phải | Đã **bỏ** — thanh menu web gọn theo Figma |
| 7 | Web hơi chậm | Đã tối ưu phần chặn hiển thị; desktop mượt |
| 8 | Tua video → phụ đề Việt lệch | Đã sửa: phụ đề Việt **khớp Anh ở mọi vị trí tua** |
| 9 | Bỏ footer | Đã **bỏ footer**; trang chính sách vẫn còn (dùng URL trực tiếp cho Store) |
| 10 | Bỏ thanh chỉnh độ mờ nền phụ đề | Đã bỏ (nút "Màu nền" giờ chỉ bật/tắt) |
| 11 | Popup extension thừa logo/avatar/"Hôm nay" | Đã **bỏ** — popup gọn theo Figma |
| 12 | Timer cần nút "Tạm dừng" | Đã thêm **Bắt đầu → Tạm dừng → Tiếp tục → Kết thúc** |
| 13 | Toàn bộ UI khớp Figma final | Popup **Đăng nhập/Đăng ký + màn Hết hạn** dựng lại theo Figma; web chỉnh **font (letter-spacing)** khớp Figma (font vẫn là Inter) |

---

## PHẦN B — Cải tiến & sửa lỗi phát sinh khi kiểm thử

Trong lúc test đợt này còn phát hiện + xử lý thêm:

- **Đăng nhập/đăng ký gói gọn ở Extension** (theo anh chốt); web tự nhận đăng nhập từ extension, không cần form riêng.
- **Đăng nhập bằng Google** chạy thông suốt.
- **Đăng xuất / đăng nhập đồng bộ 2 chiều** giữa extension và web.
- **Hết lỗi "invalid token":** khi phiên hết hạn, web tự đưa về màn đăng nhập (trước đây bị kẹt).
- **Dashboard tự cập nhật giờ học** khi quay lại tab (không phải reload tay).
- **Timer không còn cộng đôi thời gian** học.
- **Bảng xếp hạng: 3 kỳ Tuần / Tháng / Toàn thời gian** đều bấm được (trước chỉ có Tuần).
- **Gỡ Dark mode** (web luôn nền sáng, theo yêu cầu).
- **Link "Admin" trên thanh menu** — chỉ hiện với tài khoản admin (người dùng thường không thấy).

> Trạng thái: tất cả đã kiểm thử và hoạt động trên môi trường phát triển.

---

## PHẦN C — Việc CẦN LÀM để chạy thật (production)

### C1. ⭐ Thanh toán tự động qua SePay — TẠO WEBHOOK
Backend **đã sẵn sàng** nhận thông báo chuyển khoản từ SePay để **tự kích hoạt gói Pro**. Anh chỉ cần tạo 1 webhook trong SePay:

**Vào SePay → Webhooks → "Tạo webhook đầu tiên", điền:**
1. **URL webhook:** `https://studymovie-backend.vercel.app/api/sepay-webhook`
2. **Loại/Kiểu xác thực:** chọn **API Key** (SePay sẽ gửi kèm header `Authorization: Apikey <key>`).
3. **API Key:** đặt 1 chuỗi bí mật (tự tạo, dài, ngẫu nhiên). ⚠️ **Chuỗi này PHẢI trùng** với biến `SEPAY_API_KEY` ở backend (xem bước ghép key bên dưới).
4. **Tài khoản ngân hàng:** chọn đúng **tài khoản nhận tiền** (phải trùng tài khoản đang cấu hình sinh mã QR trong app).
5. **Sự kiện:** chọn **giao dịch tiền VÀO (incoming)**.
6. **Lưu.**

**Ghép key ở 2 đầu (bắt buộc, nếu không webhook sẽ báo 401 và KHÔNG kích hoạt Pro):**
- Chuỗi API Key ở webhook SePay **= biến `SEPAY_API_KEY`** trên project **backend ở Vercel**.
- Cách làm: anh tạo key ở SePay rồi gửi cho bên em → em đặt `SEPAY_API_KEY = <key>` trên Vercel backend + redeploy. (Hoặc em tạo sẵn key, đặt ở Vercel, gửi anh dán vào ô API Key của webhook.)

**Kiểm tra sau khi tạo:**
- SePay thường có nút **Test webhook** → gửi thử, backend phải trả **200**.
- Hoặc chuyển khoản thật 1 khoản nhỏ **đúng nội dung là mã đơn** (dạng `SMxxxxxxx` app hiện ra) → gói Pro tự kích hoạt.

> Cơ chế đã có sẵn: chống trùng giao dịch (idempotency), đối soát đúng mã đơn + đủ số tiền, cộng dồn thời hạn nếu còn hạn — anh không cần lo phần logic, chỉ cần nối webhook.

### C2. Bật tính năng AI nghĩa từ (production)
Đặt biến `OPENAI_API_KEY` (khóa OpenAI của anh) trên **backend Vercel** + redeploy. *(Nếu chưa đặt, app tự dùng nghĩa từ điển — không lỗi, chỉ là chưa có nghĩa theo ngữ cảnh AI.)*

### C3. Cập nhật Extension lên Chrome Web Store
Bản extension đã tích hợp **tất cả** thay đổi đợt này. Cần build bản production mới + đóng gói lại rồi nộp lên Store (bản cũ đã lạc hậu). *(Bên em hỗ trợ đóng gói.)*

### C4. Cơ sở dữ liệu (nếu chưa áp)
Các cập nhật DB đợt này (nghĩa AI, bảng xếp hạng theo kỳ...) cần được áp trên Supabase. *(Bên em đã áp ở môi trường test; khi chuyển giao sẽ đảm bảo áp đủ.)*

---

## Ghi chú
- Anh cứ tiếp tục test; nếu phát hiện thêm điểm nào, gửi feedback — bên em sửa tiếp.
- Các thông tin nhạy cảm (API Key SePay, OpenAI...) chỉ đặt ở **backend**, không lộ ra người dùng.

*StudyMovie — bàn giao ngày 02/07/2026.*

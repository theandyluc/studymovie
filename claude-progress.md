# claude-progress.md — StudyMovie

> Nhật ký từng session. Mỗi session đọc file này TRƯỚC khi làm, và ghi 1 entry mới ở CUỐI.
> Mục tiêu: session sau pick up đúng chỗ session trước dừng. Mới nhất ở trên cùng.

---

## Trạng thái tổng quan

- **Giai đoạn hiện tại:** GĐ0 — chuẩn bị (chưa scaffold)
- **Feature đang làm:** (chưa bắt đầu)
- **Next:** TIP-001 (INF-01) — scaffold monorepo + Supabase (Singapore) + Google OAuth
- **Blocker:** Chờ Blueprint APPROVED + khách chốt: streak hiển thị khi "hôm nay chưa đạt".

---

## Session log

### Session 0 — Khởi tạo harness (template)
- **Đã làm:** Dựng harness (CLAUDE.md, feature_list.json, claude-progress.md, init.sh) từ Blueprint v1.4. Chưa có code.
- **Còn dở:** Toàn bộ feature ở trạng thái `todo`.
- **Cách resume:** Đọc CLAUDE.md → chạy `./init.sh` → bắt đầu TIP-001 (INF-01).
- **Ghi chú:** Nhớ chọn Supabase region **Singapore** ngay khi tạo project (transfer Cách B yêu cầu cùng region).

<!--
MẪU ENTRY cho session sau (copy lên đầu Session log):

### Session N — <tiêu đề ngắn> (YYYY-MM-DD)
- **TIP/Feature:** <id> — <title>
- **Đã làm:** <tóm tắt>
- **Verification:** <lệnh đã chạy + kết quả: lint/typecheck/test/qa>
- **Còn dở / chưa verify:** <điểm cần làm tiếp>
- **Quyết định mới (nếu có):** <ghi nếu có thay đổi cần ghi vào Blueprint>
- **Cách resume:** <bước cụ thể để session sau tiếp tục>
- **Commit:** <hash / mô tả>
-->

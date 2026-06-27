# StudyMovie Harness — cách dùng

Bộ file này là **harness** cho dự án StudyMovie: môi trường + state + verification + scope + lifecycle
giúp agent (Thợ / Claude Code) chạy đáng tin cậy qua nhiều session, chạy *bên trong* quy trình Vibecode Kit.

## Cài vào repo

Copy các file sau vào **root** của repo `studymovie/`:

```
CLAUDE.md            # operating manual — agent đọc đầu mỗi session
feature_list.json    # STATE: feature nào done/đang làm/chưa (map sang TIP)
claude-progress.md   # STATE: nhật ký từng session
init.sh              # chạy đầu session: install + verify + health
.env.example         # tên biến môi trường (đổi sang key khách lúc bàn giao)
```

Và đặt Blueprint kèm theo (đổi tên cho khớp tham chiếu trong CLAUDE.md):

```
StudyMovie-Blueprint.md   # = StudyMovie-Blueprint-v1.md, nguồn chân lý thiết kế
```

Cấp quyền chạy cho init:

```bash
chmod +x init.sh
```

## Vòng đời mỗi session (tóm tắt)

1. Đọc `CLAUDE.md`
2. `./init.sh`
3. Đọc `claude-progress.md` + `feature_list.json` + `git log`
4. Chọn **1** feature `todo` theo Task Graph → đánh dấu `in_progress`
5. Code theo acceptance của TIP → chạy verification
6. Cập nhật `feature_list.json` + ghi entry `claude-progress.md` → commit clean state

## Lưu ý

- **Windows:** chạy `init.sh` trong WSL2 hoặc Git Bash.
- **Commit harness vào repo** (khác gstack — gstack cài global, không commit).
- **Supabase region = Singapore** ngay từ đầu (transfer Cách B yêu cầu cùng region).
- Harness này là tài sản dự án → bàn giao cho khách để họ maintain tiếp.

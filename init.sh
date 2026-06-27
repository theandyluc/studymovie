#!/usr/bin/env bash
# init.sh — StudyMovie harness init
# Chạy đầu mỗi agent session: install deps + verify tooling + health check.
# Windows: chạy trong WSL2 hoặc Git Bash (xem CLAUDE.md mục 9).
# An toàn để chạy lại nhiều lần; bỏ qua phần chưa scaffold.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

bold() { printf "\033[1m%s\033[0m\n" "$1"; }
ok()   { printf "  \033[32m✓\033[0m %s\n" "$1"; }
warn() { printf "  \033[33m!\033[0m %s\n" "$1"; }
err()  { printf "  \033[31m✗\033[0m %s\n" "$1"; }

FAIL=0

bold "== StudyMovie init =="

# 1) Tooling versions ------------------------------------------------------
bold "1. Tooling"
if command -v node >/dev/null 2>&1; then ok "node $(node -v)"; else err "node chưa cài"; FAIL=1; fi
if command -v npm  >/dev/null 2>&1; then ok "npm $(npm -v)";  else err "npm chưa cài";  FAIL=1; fi
command -v bun      >/dev/null 2>&1 && ok "bun $(bun -v)"           || warn "bun chưa cài (chỉ cần nếu dùng gstack)"
command -v supabase >/dev/null 2>&1 && ok "supabase CLI có"         || warn "supabase CLI chưa cài (cần cho migration)"
command -v git      >/dev/null 2>&1 && ok "git $(git --version | awk '{print $3}')" || { err "git chưa cài"; FAIL=1; }

# 2) Env file --------------------------------------------------------------
bold "2. Env"
if [ -f ".env" ]; then ok ".env tồn tại"
elif [ -f ".env.example" ]; then warn ".env chưa có — copy từ .env.example và điền key"
else warn ".env.example chưa có (sẽ tạo ở TIP-014 / handover)"; fi

# 3) Install deps theo từng package nếu đã scaffold ------------------------
bold "3. Install deps"
install_pkg() {
  local dir="$1"
  if [ -f "$dir/package.json" ]; then
    ( cd "$dir" && npm install --silent ) && ok "installed: $dir" || { err "install fail: $dir"; FAIL=1; }
  else
    warn "bỏ qua $dir (chưa scaffold)"
  fi
}
install_pkg "web/frontend"
install_pkg "web/backend"
install_pkg "extension"

# 4) Verify: lint + typecheck nếu script tồn tại --------------------------
bold "4. Verify (lint + typecheck)"
verify_pkg() {
  local dir="$1"
  [ -f "$dir/package.json" ] || { warn "bỏ qua $dir"; return; }
  if npm --prefix "$dir" run | grep -q " lint";      then ( cd "$dir" && npm run lint --silent )      && ok "lint ok: $dir"      || { err "lint fail: $dir"; FAIL=1; }; fi
  if npm --prefix "$dir" run | grep -q " typecheck"; then ( cd "$dir" && npm run typecheck --silent ) && ok "typecheck ok: $dir" || { err "typecheck fail: $dir"; FAIL=1; }; fi
}
verify_pkg "web/frontend"
verify_pkg "web/backend"
verify_pkg "extension"

# 5) DB migration sanity (chỉ báo, không tự reset) ------------------------
bold "5. Database"
if [ -d "supabase/migrations" ]; then
  N=$(find supabase/migrations -name '*.sql' | wc -l | tr -d ' ')
  ok "migrations: $N file (chạy 'supabase db reset --linked' để dựng lại — KHÔNG tự động ở đây)"
else
  warn "supabase/migrations chưa có (TIP-002)"
fi

# 6) State files -----------------------------------------------------------
bold "6. Harness state"
[ -f "feature_list.json" ]  && ok "feature_list.json"  || warn "thiếu feature_list.json"
[ -f "claude-progress.md" ] && ok "claude-progress.md" || warn "thiếu claude-progress.md"
[ -f "StudyMovie-Blueprint.md" ] && ok "Blueprint" || warn "thiếu StudyMovie-Blueprint.md"

echo
if [ "$FAIL" -eq 0 ]; then
  bold "✓ init OK — đọc claude-progress.md rồi chọn 1 feature 'todo' theo Task Graph."
else
  bold "✗ init có lỗi — sửa các mục ✗ ở trên trước khi bắt đầu code."
fi
exit "$FAIL"

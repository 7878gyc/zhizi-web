#!/usr/bin/env bash
# 生产构建：生成 .next 产物（生产模式，不使用 dev server）
set -euo pipefail
exec pnpm build

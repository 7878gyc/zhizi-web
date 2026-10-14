#!/usr/bin/env bash
# 生产启动：以已构建产物启动（next start），避免开发模式按需编译导致静态资源 500
set -euo pipefail
export PORT="${PORT:-5000}"
exec ./node_modules/.bin/next start -p "$PORT"

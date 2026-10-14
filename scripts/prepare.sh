#!/usr/bin/env bash
# 安装依赖（CI/部署环境）
set -euo pipefail
pnpm install --frozen-lockfile || pnpm install

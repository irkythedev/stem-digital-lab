#!/usr/bin/env bash
# 编译欧姆定律 C++ 计算核 → src/wasm/stemCore.js（SINGLE_FILE ESM）。
#
# 需要 Emscripten（em++）。本机没有时打印安装说明并 exit 1——
# 不会污染默认 `npm run build`：无产物时前端动态 import 失败会静默回退 JS。
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v em++ >/dev/null 2>&1; then
  echo "未找到 em++（Emscripten 编译器）。"
  echo "安装到用户目录（不污染系统）的最短步骤："
  echo "  git clone https://github.com/emscripten-core/emsdk.git ~/emsdk"
  echo "  cd ~/emsdk && ./emsdk install latest && ./emsdk activate latest"
  echo "  echo 'source ~/emsdk/emsdk_env.sh' >> ~/.bashrc"
  echo "  source ~/emsdk/emsdk_env.sh   # 当前 shell 立即生效"
  echo "然后重新运行：bash tools/build-wasm.sh"
  exit 1
fi

mkdir -p src/wasm

em++ cpp/stem_core.cpp -O2 -std=c++17 -lembind \
  -s MODULARIZE=1 -s EXPORT_ES6=1 -s ENVIRONMENT=web \
  -s SINGLE_FILE=1 -s ALLOW_MEMORY_GROWTH=1 -s NO_EXIT_RUNTIME=1 \
  -o src/wasm/stemCore.js

echo "OK: src/wasm/stemCore.js 已生成（SINGLE_FILE，无独立 .wasm）"

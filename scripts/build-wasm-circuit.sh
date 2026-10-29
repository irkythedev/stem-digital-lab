#!/usr/bin/env bash
# 编译电学实验台 C++ 线性核 → src/wasm/circuitBench.js（SINGLE_FILE ESM）。
#
# 与 stemCore.js 完全分离：不改 stem_core.cpp，也不覆盖 stemCore.js。
# 没有 em++ 时打印说明并 exit 1；前端动态 import 失败会静默回退 TS。
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v em++ >/dev/null 2>&1; then
  echo "未找到 em++（Emscripten 编译器）。"
  echo "安装到用户目录（不污染系统）的最短步骤："
  echo "  git clone https://github.com/emscripten-core/emsdk.git ~/emsdk"
  echo "  cd ~/emsdk && ./emsdk install latest && ./emsdk activate latest"
  echo "  echo 'source ~/emsdk/emsdk_env.sh' >> ~/.bashrc"
  echo "  source ~/emsdk/emsdk_env.sh   # 当前 shell 立即生效"
  echo "然后重新运行：bash scripts/build-wasm-circuit.sh"
  exit 1
fi

mkdir -p src/wasm

# ENVIRONMENT=web,node：产物既能在浏览器里动态 import，也能被 Node 下的
# 双引擎对拍单测直接加载（ENVIRONMENT=web 时 Node 侧没有脚本目录来源）。
em++ cpp/circuit_bench_core.cpp -O3 -std=c++17 -lembind \
  -s MODULARIZE=1 -s EXPORT_NAME="createCircuitBenchModule" \
  -s EXPORT_ES6=1 -s ENVIRONMENT=web,node \
  -s SINGLE_FILE=1 -s ALLOW_MEMORY_GROWTH=1 -s NO_EXIT_RUNTIME=1 \
  -o src/wasm/circuitBench.js

echo "OK: src/wasm/circuitBench.js 已生成（SINGLE_FILE，无独立 .wasm）"

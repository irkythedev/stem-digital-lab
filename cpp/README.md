# cpp/ — C++ 计算核（WebAssembly + 命令行）

本目录是欧姆定律、凸透镜成像、二次函数的 C++ 实现：把各 TS 真源
（`src/labs/physics/ohm-core.ts`、`lens-core.ts`、`src/labs/math/quadratic-core.ts`）的
标量公式用 C++ 重写，经 Emscripten 编成**同一份** WebAssembly（SINGLE_FILE）在浏览器
按需调用；另有一份只依赖标准库的命令行版，供 `g++` 直接编译、离线验证欧姆公式。

## 文件

| 文件 | 作用 |
|---|---|
| `ohm_formula.hpp` | 欧姆公式单一事实来源（header-only）。`stem_core.cpp` 与 `cli.cpp` 都 include 它，避免两份公式漂移 |
| `lens_formula.hpp` | 凸透镜成像公式（header-only）：`image_v`，u≈f 返回 NaN 哨兵 |
| `math_fn.hpp` | 初等函数核（header-only）：`quadratic_y` 单点求值 |
| `stem_core.cpp` | Embind 导出层（无 main），只做符号导出，公式在各 hpp |
| `cli.cpp` | 命令行版（无 Emscripten 依赖），`g++` 直接编译 |

## 导出函数与公式（与页面模型一致）

| C++ | JS 真源 | 公式 |
|---|---|---|
| `element_resistance(r, is_bulb, u)` | `elementResistance`（ohm-core.ts） | 定值电阻 = r；灯泡 = r + 0.4·u |
| `current_of(u, r, is_bulb, rp)` | `currentOf`（ohm-core.ts） | 电阻 I = u/(r+rp)；灯泡 I = u/(r + 0.4·u + rp) |
| `image_v(u, f)` | `imageV`（lens-core.ts） | v = u·f/(u−f)；\|u−f\| < 0.01 → NaN（无清晰实像） |
| `quadratic_y(a, b, c, x)` | `quadraticY`（quadratic-core.ts） | y = a·x² + b·x + c |

分母为 0 **不特判**（与 JS 相同的 IEEE 除法语义：inf / nan），短路由交互层处理；
`bool` 适配只发生在 TS 侧（stem-engine.ts），C++ 侧用原生 bool；`image_v` 的
u≈f 阈值在 C++ 内判定（NaN 哨兵），归一 null 由 TS facade 完成。

## 编译 WebAssembly（需要 Emscripten）

完整命令（与 `scripts/build-wasm.sh` 完全一致）：

```bash
mkdir -p src/wasm
em++ cpp/stem_core.cpp -O2 -std=c++17 -lembind \
  -s MODULARIZE=1 -s EXPORT_ES6=1 -s ENVIRONMENT=web \
  -s SINGLE_FILE=1 -s ALLOW_MEMORY_GROWTH=1 -s NO_EXIT_RUNTIME=1 \
  -o src/wasm/stemCore.js
```

或直接：`npm run build:wasm`。

**无 emsdk 时**（装到用户目录，不要 sudo）：

```bash
git clone https://github.com/emscripten-core/emsdk.git ~/emsdk
cd ~/emsdk && ./emsdk install latest && ./emsdk activate latest
echo 'source ~/emsdk/emsdk_env.sh' >> ~/.bashrc
source ~/emsdk/emsdk_env.sh   # 当前 shell 立即生效
```

**浏览器加载路径**：前端门面 `src/labs/physics/stem-engine.ts`（欧姆/透镜/二次共用，
`ohm-engine.ts` 是兼容壳）用动态 import（`new URL(...)`，非静态依赖）加载
`src/wasm/stemCore.js`（SINGLE_FILE ESM，默认导出 factory）。四个导出必须齐全才切
wasm，文件缺失、编译失败或实例化失败一律 catch → 整颗回退各 JS 真源，实验照常可用；
欧姆/透镜/二次实验参数卡会显示当前引擎「计算引擎：C++ WebAssembly」或
「计算引擎：JS 回退」。

没有 em++ 时不需要重新编译 wasm——产物缺省，前端自动走 JS 回退。

## 命令行版（cli.cpp）

不链接 Emscripten，仅标准库：

```bash
g++ -std=c++17 cpp/cli.cpp -o ohm_cli

./ohm_cli --u 6 --r 10 --element resistor --rp 0   # I=0.6
./ohm_cli --u 6 --r 10 --element bulb --rp 0       # I≈0.4838709677
./ohm_cli --u 12 --r 0 --element resistor --rp 0   # I=inf（分母 0，IEEE 语义）
```

`--element` 只接受 `resistor` / `bulb`；缺参或非法参数打印用法到 stderr 并
`exit 1`；成功时一行输出 `I=<电流>`。二进制 `ohm_cli` 不入库（见 .gitignore）。

## 许可

AGPL-3.0（与本站仓库一致）。

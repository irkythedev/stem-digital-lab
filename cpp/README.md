# cpp/ — C++ 计算核（WebAssembly + 命令行）

本目录是全站七处 C++ 计算核的实现：把各 TS 真源
（`src/labs/physics/ohm-core.ts`、`lens-core.ts`、`bulb-core.ts`、`mechanics-core.ts`、
`src/labs/math/quadratic-core.ts`、`inverse-core.ts`、`src/labs/chemistry/titration-core.ts`）
的标量公式用 C++ 重写，经 Emscripten 编成**同一份** WebAssembly（SINGLE_FILE）在浏览器
按需调用；另有两份只依赖标准库的命令行版，供 `g++` 直接编译、离线验证公式。

## 文件

| 文件 | 作用 |
|---|---|
| `ohm_formula.hpp` | 欧姆公式单一事实来源（header-only）。`stem_core.cpp` 与 `cli.cpp` 都 include 它，避免两份公式漂移 |
| `lens_formula.hpp` | 凸透镜成像公式（header-only）：`image_v`，u≈f 返回 NaN 哨兵 |
| `math_fn.hpp` | 初等函数核（header-only）：`quadratic_y` 单点求值、`inverse_y`（x=0 返回 NaN 哨兵） |
| `bulb_formula.hpp` | 灯泡热力学核（header-only）：`bulb_resistance`、`bulb_temp_step`（显式欧拉 + 夹取） |
| `chem_formula.hpp` | 酸碱中和滴定核（header-only）：`ph_from_moles` 单点 pH |
| `mechanics_formula.hpp` | 浮力核（header-only）：`displaced_volume`、`spring_reading` |
| `stem_core.cpp` | Embind 导出层（无 main），只做符号导出，公式在各 hpp |
| `cli.cpp` | 命令行版（无 Emscripten 依赖），`g++` 直接编译，只覆盖欧姆公式 |
| `stem_cli.cpp` | 命令行版（无 Emscripten 依赖），`g++` 直接编译，覆盖全部 10 个导出的 stdin 对拍工具 |

## 导出函数与公式（与页面模型一致）

| C++ | JS 真源 | 公式 |
|---|---|---|
| `element_resistance(r, is_bulb, u)` | `elementResistance`（ohm-core.ts） | 定值电阻 = r；灯泡 = r + 0.4·u |
| `current_of(u, r, is_bulb, rp)` | `currentOf`（ohm-core.ts） | 电阻 I = u/(r+rp)；灯泡 I = u/(r + 0.4·u + rp) |
| `image_v(u, f)` | `imageV`（lens-core.ts） | v = u·f/(u−f)；\|u−f\| < 0.01 → NaN（无清晰实像） |
| `quadratic_y(a, b, c, x)` | `quadraticY`（quadratic-core.ts） | y = a·x² + b·x + c |
| `inverse_y(k, x)` | `inverseY`（inverse-core.ts） | y = k/x；x = 0 → NaN（定义域外哨兵） |
| `bulb_resistance(rated_v, rated_p, temp)` | `bulbResistance`（bulb-core.ts） | R = max(0.01, (V额²/P额)·T/T额) |
| `bulb_temp_step(temp, current, r_now, c_heat, h, t_ambient, rad_k)` | `bulbTempStep`（bulb-core.ts） | ΔT = (I²R − k(T⁴−T环⁴))/C · h，再夹到 [T环, T烧断+200] |
| `ph_from_moles(acid_mol, base_mol, total_volume)` | `phFromMoles`（titration-core.ts） | 等当点 pH=7；酸过量 −log10；碱过量 14+log10；夹到 [0,14] |
| `displaced_volume(vsub, stone_volume)` | `displacedVolume`（mechanics-core.ts） | V排 = 体积 · clamp(浸入比例, 0, 1) |
| `spring_reading(weight, buoyancy)` | `springReading`（mechanics-core.ts） | F示 = max(0, 物重 − 浮力) |

分母为 0 **不特判**（与 JS 相同的 IEEE 除法语义：inf / nan），短路由交互层处理；
`bool` 适配只发生在 TS 侧（stem-engine.ts），C++ 侧用原生 bool；`image_v` 的
u≈f 阈值与 `inverse_y` 的 x = 0 判定在 C++ 内完成（NaN 哨兵），归一 null 由 TS facade 完成。

**NaN 传播纪律**：越界夹取一律写成**比较**（`d < 0.0 ? 0.0 : d`），不用 `std::fmax` /
`std::min` —— `fmax(0, NaN)` 返回 0 而 TS 侧 `Math.max(0, NaN)` 是 NaN，三方对拍要求
NaN 原样穿过。**签名分歧（有意为之）**：`bulb_temp_step` 的 `r_now` / `c_heat` / `rad_k`
与 `spring_reading` 的 `weight` / `buoyancy` 由调用方组装——它们是「额定参数 / 演示物常量 →
该量」的纯换算，留在 TS 侧可保证夹取口径只有一份，C++ 侧只保留需要逐位一致的积分与减法。

## 编译 WebAssembly（需要 Emscripten）

完整命令（可直接复制执行；项目内的构建脚本未随本仓提供）：

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

**浏览器加载路径**：前端门面 `src/labs/physics/stem-engine.ts`（欧姆/透镜/二次/反比例/
灯泡/滴定/浮力共用，`ohm-engine.ts` 是兼容壳）用动态 import（`new URL(...)`，非静态依赖）
加载 `src/wasm/stemCore.js`（SINGLE_FILE ESM，默认导出 factory）。**十个导出必须齐全**才切
wasm，文件缺失、编译失败或实例化失败一律 catch → 整颗回退各 JS 真源，实验照常可用；
接入的实验参数卡会显示当前引擎「计算引擎：C++ WebAssembly」或「计算引擎：JS 回退」。

没有 em++ 时不需要重新编译 wasm——产物缺省，前端自动走 JS 回退。

## 命令行版（cli.cpp）

不链接 Emscripten，仅标准库，只覆盖欧姆公式：

```bash
g++ -std=c++17 cpp/cli.cpp -o ohm_cli

./ohm_cli --u 6 --r 10 --element resistor --rp 0   # I=0.6
./ohm_cli --u 6 --r 10 --element bulb --rp 0       # I≈0.4838709677
./ohm_cli --u 12 --r 0 --element resistor --rp 0   # I=inf（分母 0，IEEE 语义）
```

`--element` 只接受 `resistor` / `bulb`；缺参或非法参数打印用法到 stderr 并
`exit 1`；成功时一行输出 `I=<电流>`。二进制 `ohm_cli` 不入库（见 .gitignore）。

## 命令行版（stem_cli.cpp）——三方对拍真值腿

`src/stem-core-ext.test.ts` 用它做「g++ 原生真值 vs WASM 导出 vs TS 回退」三方对拍：
与 `stem_core.cpp` 导出同一批公式（同一批 hpp），但不链接 Emscripten。

```bash
g++ -std=c++17 cpp/stem_cli.cpp -o stem_cli
```

协议是 stdin（空白分隔，允许换行；一次进程可跑多组）：

```
<op> <参数…>
```

支持 10 个 op，参数顺序与 WASM 导出一一对应（`is_bulb` 取 `0` / `1`）：

```
element_resistance r is_bulb u
current_of u r is_bulb rp
image_v u f
quadratic_y a b c x
inverse_y k x
bulb_resistance rated_v rated_p temp
bulb_temp_step temp current r_now c_heat h t_ambient rad_k
ph_from_moles acid_mol base_mol total_volume
displaced_volume vsub stone_volume
spring_reading weight buoyancy
```

每个 op 输出一行结果（`setprecision(17)`，与 WASM 侧 double 一致；NaN / Inf 按 C++
默认拼写 `nan` / `inf`）；未知 op 或参数不足输出 `FAIL` 并 `exit 1`——绝不用 0 顶替。
测试把二进制编到系统临时目录，不在仓库里留任何可执行文件。

## 许可

AGPL-3.0（与本站仓库一致）。

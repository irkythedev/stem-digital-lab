/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 欧姆定律计算核（纯函数，零 React / DOM / WASM 依赖）。
 *
 * 原样抽离自 src/labs/physics/Ohm.tsx（三幕式探究的纯计算部分）：
 * 含采样上界 12.0001、步长 0.1、定值电阻 R=0 短路返回 []、点为 [I·R_dyn, I]。
 *
 * 数值纪律（2026-10 审计修订）：
 *  ① 采样用**索引乘法**（u = i·0.1），不用 `u += 0.1` 累加——后者到第 120 点已漂移到
 *     11.999999999999973，横轴 109/121 个点带浮点尾数（实测）。
 *  ② **绝不返回 NaN**：无驱动电压（U = 0）且总电阻为 0 时，JS 的 0/0 = NaN 会一路
 *     流进电表读数与 SVG 属性（实测 U=0/R=0/Rp=0 时页面出现 4 处 "NaN"）。
 *     约定：0/0 → 0（没有电源驱动，读数就是 0.00A）；U>0 且总电阻为 0 → Infinity
 *     （真短路，由组件层显示 "∞" 并给告警，本核不吞掉这个语义）。
 *
 * 本模块供 Ohm.tsx 与 smoke 测试共用；后续 C++ → WASM 阶段在其上做同签名替换，
 * 加载失败静默回退本模块，不改变任何调用点语义。
 */

/** 元件类型：定值电阻（线性）或小灯泡（电阻随温度/电压升高，非线性） */
export type ElementType = 'resistor' | 'bulb';

/** 灯泡模型：钨丝电阻随电压（温度）升高，R_eff = R₀ + γ·U */
export const BULB_GAMMA = 0.4; // Ω/V

/** 采样步长与上界（上界留 1e-3 余量给浮点） */
export const SAMPLE_STEP = 0.1;
export const SAMPLE_MAX = 12;
const SAMPLE_EPS = 1e-3;

/** 元件动态电阻：定值电阻 = R，灯泡 = R₀ + γ·U（钨丝升温） */
export function elementResistance(r: number, element: ElementType, u: number): number {
  return element === 'bulb' ? r + BULB_GAMMA * u : r;
}

/**
 * 电路读数：给定电源电压 U、元件 R、元件类型、串联变阻器 Rp，I（A）。
 * 分支电阻为 0（短路）且 U>0 时按 JS 语义返回 Infinity（组件显示 "∞"）；
 * U=0 且总电阻 0 时返回 0 而非 NaN（没有驱动电压 → 读数 0.00A）。
 */
export function currentOf(u: number, r: number, element: ElementType, rp = 0): number {
  const denom = element === 'bulb' ? r + BULB_GAMMA * u + rp : r + rp;
  if (denom === 0) return u === 0 ? 0 : u / denom; // u>0 → Infinity（真短路）
  return u / denom;
}

/**
 * 采样 I-U 曲线：U 为电源电压 ∈ [0, 12]。
 * 返回 [元件两端电压 U_elem, 电流 I]——横轴严格用元件真实压降（伏安法口径），
 * 定值电阻斜率 = 1/R，与结论口径一致；变阻器 Rp 参与分压不影响横轴语义。
 */
export function sampleOhm(r: number, element: ElementType, rp = 0): [number, number][] {
  // 元件短路（R=0 相当于导线）：I-U 图像无有效关系，返回空曲线
  if (element === 'resistor' && r === 0) return [];
  const pts: [number, number][] = [];
  const steps = Math.round((SAMPLE_MAX + SAMPLE_EPS) / SAMPLE_STEP);
  for (let k = 0; k <= steps; k++) {
    const u = k * SAMPLE_STEP; // 索引乘法：横轴无浮点累加漂移
    const i = currentOf(u, r, element, rp);
    pts.push([i * elementResistance(r, element, u), i]);
  }
  return pts;
}

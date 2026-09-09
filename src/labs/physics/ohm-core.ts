/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 欧姆定律计算核（纯函数，零 React / DOM / WASM 依赖）。
 *
 * 原样抽离自 src/labs/physics/Ohm.tsx（三幕式探究的纯计算部分），行为保持零变化：
 * 含采样上界 12.0001、步长 0.1、定值电阻 R=0 短路返回 []、点为 [I·R_dyn, I]、
 * 分母为 0 不特判（保持 JS 除法的 Infinity / NaN 语义，短路逻辑由组件层处理）。
 *
 * 本模块供 Ohm.tsx 与 smoke 测试共用；后续 C++ → WASM 阶段在其上做同签名替换，
 * 加载失败静默回退本模块，不改变任何调用点语义。
 */

/** 元件类型：定值电阻（线性）或小灯泡（电阻随温度/电压升高，非线性） */
export type ElementType = 'resistor' | 'bulb';

/** 灯泡模型：钨丝电阻随电压（温度）升高，R_eff = R₀ + γ·U */
export const BULB_GAMMA = 0.4; // Ω/V

/** 元件动态电阻：定值电阻 = R，灯泡 = R₀ + γ·U（钨丝升温） */
export function elementResistance(r: number, element: ElementType, u: number): number {
  return element === 'bulb' ? r + BULB_GAMMA * u : r;
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
  for (let u = 0; u <= 12.0001; u += 0.1) {
    const i = element === 'bulb' ? u / (r + BULB_GAMMA * u + rp) : u / (r + rp);
    pts.push([i * elementResistance(r, element, u), i]);
  }
  return pts;
}

/** 电路读数：给定电源电压 U、元件 R、元件类型、串联变阻器 Rp，I（A） */
export function currentOf(u: number, r: number, element: ElementType, rp = 0): number {
  if (element === 'bulb') return u / (r + BULB_GAMMA * u + rp);
  return u / (r + rp);
}

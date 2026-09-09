/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 凸透镜成像计算核（纯函数，零 React / DOM / WASM 依赖）。
 *
 * 原样抽离自 src/labs/physics/Lens.tsx 与 src/components/lab/LensBench.tsx
 * （两处此前各持一份相同 imageV，本文件收敛为单一事实源），行为保持零变化：
 * |u - f| < 0.01 → null（u≈f 不成像），否则 v = uf/(u-f)。
 *
 * 供 Lens.tsx / LensBench.tsx / smoke 测试共用；后续 C++ → WASM 阶段在其上做
 * 同签名替换，加载失败静默回退本模块，不改变任何调用点语义。
 */

/**
 * 像距 v = uf/(u-f)（薄透镜公式）。
 * u ≈ f（|u - f| < 0.01）时出射光近似平行，不成清晰实像，返回 null。
 */
export function imageV(u: number, f: number): number | null {
  const diff = u - f;
  if (Math.abs(diff) < 0.01) return null;
  return (u * f) / diff;
}

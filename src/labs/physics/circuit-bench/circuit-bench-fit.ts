/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学实验台 · 数据记录与最小二乘拟合
 *
 * 只做 M1 需要的一元线性拟合（含过原点模式），无第三方依赖。
 * 所有函数对退化输入（0 点、1 点、全部同 x、非有限数）返回可显示的结果，不抛异常。
 */

export interface FitPoint {
  x: number;
  y: number;
}

export interface LinearFit {
  slope: number;
  intercept: number;
  /** 决定系数 R²；过原点模式用未中心化定义 */
  r2: number;
  n: number;
  ok: boolean;
  /** 斜率标准误差（教学展示用，样本 < 3 时返回 0） */
  slopeError: number;
}

export interface FitOptions {
  throughOrigin?: boolean;
}

export function fitLinear(points: FitPoint[], options: FitOptions = {}): LinearFit {
  const pts = (Array.isArray(points) ? points : []).filter(
    (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y),
  );
  const n = pts.length;
  if (n === 0) return { slope: 0, intercept: 0, r2: 0, n: 0, ok: false, slopeError: 0 };

  if (options.throughOrigin) {
    let sxy = 0;
    let sxx = 0;
    let syy = 0;
    for (const p of pts) {
      sxy += p.x * p.y;
      sxx += p.x * p.x;
      syy += p.y * p.y;
    }
    const slope = sxx > 1e-15 ? sxy / sxx : 0;
    const ssRes = pts.reduce((s, p) => s + Math.pow(p.y - slope * p.x, 2), 0);
    const r2 = syy > 1e-15 ? Math.max(0, Math.min(1, 1 - ssRes / syy)) : 0;
    return {
      slope: finiteOr(slope, 0),
      intercept: 0,
      r2: finiteOr(r2, 0),
      n,
      ok: sxx > 1e-15,
      slopeError: 0,
    };
  }

  if (n === 1) {
    return { slope: 0, intercept: pts[0].y, r2: 0, n, ok: false, slopeError: 0 };
  }
  const meanX = pts.reduce((s, p) => s + p.x, 0) / n;
  const meanY = pts.reduce((s, p) => s + p.y, 0) / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const p of pts) {
    const dx = p.x - meanX;
    const dy = p.y - meanY;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  if (sxx <= 1e-15) {
    return { slope: 0, intercept: meanY, r2: 0, n, ok: false, slopeError: 0 };
  }
  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;
  const ssRes = pts.reduce((s, p) => s + Math.pow(p.y - (slope * p.x + intercept), 2), 0);
  const r2 = syy > 1e-15 ? Math.max(0, Math.min(1, 1 - ssRes / syy)) : 1;
  let slopeError = 0;
  if (n >= 3 && sxx > 0) {
    slopeError = Math.sqrt(ssRes / (n - 2) / sxx);
  }
  return {
    slope: finiteOr(slope, 0),
    intercept: finiteOr(intercept, 0),
    r2: finiteOr(r2, 0),
    n,
    ok: Number.isFinite(slope),
    slopeError: finiteOr(slopeError, 0),
  };
}

export function predict(fit: LinearFit, x: number): number {
  return finiteOr(fit.slope * x + fit.intercept, 0);
}

export function residuals(points: FitPoint[], fit: LinearFit): number[] {
  return points.map((p) => finiteOr(p.y - predict(fit, p.x), 0));
}

/** 斜率倒数（用于伏安法 R = U / I 的两种坐标取向）。 */
export function reciprocal(v: number): number {
  return Math.abs(v) > 1e-12 ? 1 / v : Infinity;
}

/**
 * 把「陈旧探针键」拉回当前还存在的探针。
 *
 * 元件被移除（或换成没有该探针的预设）后，`xKey/yKey` 会指向一个不存在的键：
 * 记录按钮要么对着画布上已经不在的元件取数（读数无效，白点一下），要么在下拉里
 * 找不到对应项而显示空白——两种情况下，学生看到的选项与实际记录的量都不一致。
 *
 * 回退顺序：键仍在 → 原样返回；否则优先同量（I/U/P/R 后缀相同的另一个元件，
 * 例如删掉电流表后落到电源电流）；再退到 `preferred` 位置，最后退到首项；
 * 空台返回空串，让下拉框落到 `—` 而不是任意一个不存在的键。
 */
export function reconcileProbeKey(
  key: string,
  options: readonly { key: string }[],
  preferred = 0,
): string {
  if (options.some((o) => o.key === key)) return key;
  const quantity = key.split(':')[1];
  if (quantity) {
    const sameQuantity = options.find((o) => o.key.split(':')[1] === quantity);
    if (sameQuantity) return sameQuantity.key;
  }
  return options[preferred]?.key ?? options[0]?.key ?? '';
}

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\r\n');
}

export function downloadText(filename: string, text: string, mime = 'text/csv;charset=utf-8'): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;
  const blob = new Blob(['﻿', text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function finiteOr(v: number, fallback: number): number {
  return Number.isFinite(v) ? v : fallback;
}

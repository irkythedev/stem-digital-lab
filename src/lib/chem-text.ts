/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 化学式内联空隙压缩（纯函数，仅用于展示层，不改写数据）。
 *
 * 修复：题干里偶发「Fe₂ O₃」这类在「下标数字」与后续元素符号之间的多余空白
 * （多来自 AI 生成的富文本或手工录入时的空格），渲染时压紧为「Fe₂O₃」，与 KMnO₄ 视觉一致。
 * 只处理「下标数字(₀-₉) 后接空白再接大写元素字母」以及「元素符号后接空白再接下标数字」两种模式，
 * 不触碰普通英文/数字间的空格（如 "5 mL"、"a < b"）。
 */
export function compactChemicalSpacing(text: string): string {
  if (!text) return text;
  return text
    .replace(/([₀-₉])\s+(?=[A-Z(])/g, '$1')
    .replace(/([A-Z][a-z]?)\s+(?=[₀-₉])/g, '$1');
}

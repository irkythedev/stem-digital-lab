/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 页面学科/主题名（AI 提示词与出题锚点共用）。
 * 从 AiAssistant.tsx 原样搬出：设置域 Hook 与主组件都要用，放在共享模块避免循环引用。
 */
import { labFromPath } from '../../lib/labs';

/* ── 当前页面 → 主题提示（注入系统提示词） ── */
export function pageSubject(pathname: string, lang: 'zh' | 'en'): string | undefined {
  const zh = lang === 'zh';
  const lab = labFromPath(pathname);
  if (lab) return zh ? `${lab.name.zh}实验` : `${lab.name.en} lab`;
  if (pathname.startsWith('/lab/')) {
    return zh ? '物理化学实验' : 'science lab';
  }
  if (pathname.startsWith('/math-formulas')) return zh ? '数学公式速查' : 'Math formulas';
  if (pathname.startsWith('/physics-formulas')) return zh ? '物理公式速查' : 'Physics formulas';
  if (pathname.startsWith('/physics-constants')) return zh ? '物理常量速查' : 'Physics constants';
  if (pathname.startsWith('/periodic-table')) return zh ? '元素周期表' : 'Periodic table';
  if (pathname.startsWith('/subject/math')) return zh ? '初中数学' : 'Middle-school math';
  if (pathname.startsWith('/subject/physics')) return zh ? '初中物理（苏科版）' : 'Middle-school physics (Su-Ke)';
  if (pathname.startsWith('/subject/chemistry')) return zh ? '初中化学' : 'Middle-school chemistry';
  return undefined;
}

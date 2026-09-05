/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 物理公式「符号 → 中文量名」逐公式映射（苏科版口径）。
 *
 * 为什么按公式配表而非全局符号表：初中物理符号高度多义——
 *   c = 比热容（热量公式）/ 波速（波速公式）
 *   f = 频率（波速/频率公式）/ 焦距（透镜公式）
 *   v = 速度（速度/声速公式）/ 像距（透镜公式）
 *   t = 时间（多数）/ 温度变化量（热量公式 Δt）
 *   h = 深度（液体压强）/ 高度（势能）
 * 全局替换必错，故以「公式中文名」为键，逐公式给出该式内每个符号的量名。
 *
 * 仅用于朗读（latex-speech physics 模式）；数学模式、英文界面不读取本表。
 */

/** 单条公式的符号量名映射（键为 LaTeX 里的裸字母，区分大小写） */
export type PhysSymbolMap = Record<string, string>;

/**
 * 公式中文名 → 符号量名表。
 * 覆盖 PHYSICS_FORMULAS 全部 29 条；键须与 physics-formulas.ts 的 name.zh 一致。
 * 未列出的符号（如常量 g）保留字母原读。
 */
export const PHYS_FORMULA_SYMBOLS: Record<string, PhysSymbolMap> = {
  // ── 力学 ──
  速度: { v: '速度', s: '路程', t: '时间' },
  密度: { rho: '密度', m: '质量', V: '体积' },
  重力: { G: '重力', g: 'g', m: '质量' },
  压强: { p: '压强', F: '压力', S: '受力面积' },
  液体压强: { p: '压强', rho: '液体密度', g: 'g', h: '深度' },
  阿基米德原理: { F: '浮力', G: '排开液重', rho: '液体密度', V: '排开体积', g: 'g' },
  称重法测浮力: { F: '浮力', G: '重力' },
  杠杆平衡条件: { F: '力', l: '力臂' },
  功: { W: '功', F: '力', s: '距离' },
  功率: { P: '功率', W: '功', t: '时间' },
  机械效率: { eta: '机械效率', W: '功' },
  动能: { E: '动能', m: '质量', v: '速度' },
  重力势能: { E: '势能', m: '质量', g: 'g', h: '高度' },
  // ── 热学 ──
  热量: { Q: '热量', c: '比热容', m: '质量', t: '温度' },
  燃料的热值: { Q: '热量', m: '质量', q: '热值' },
  // ── 光学 / 声学 ──
  透镜成像公式: { u: '物距', v: '像距', f: '焦距' },
  波速公式: { c: '波速', lambda: '波长', f: '频率' },
  频率与周期: { f: '频率', T: '周期' },
  声速与波长: { v: '声速', lambda: '波长', f: '频率' },
  // ── 电学 ──
  欧姆定律: { I: '电流', U: '电压', R: '电阻' },
  串联电流规律: { I: '电流' },
  并联电流规律: { I: '电流' },
  串联电压规律: { U: '电压' },
  并联电压规律: { U: '电压' },
  串联电阻规律: { R: '电阻' },
  并联电阻规律: { R: '电阻' },
  电功: { W: '电功', U: '电压', I: '电流', t: '时间' },
  电功率: { P: '电功率', U: '电压', I: '电流' },
  焦耳定律: { Q: '热量', I: '电流', R: '电阻', t: '时间' },
};

/** 从 topic（形如「物理公式：速度」或「速度」）解析出公式中文名，命中则返回其量名表 */
export function symbolsForTopic(topic?: string): PhysSymbolMap | null {
  if (!topic) return null;
  const names = Object.keys(PHYS_FORMULA_SYMBOLS);
  // 1) 精确匹配：去掉「物理公式：」前缀与括号后缀后，整名命中
  const bare = topic.replace(/^物理公式[：:]\s*/, '').replace(/[（(].*?[）)]/g, '').trim();
  if (PHYS_FORMULA_SYMBOLS[bare]) return PHYS_FORMULA_SYMBOLS[bare];
  // 2) 兜底：topic 内嵌公式名时，取「最长匹配」避免「重力势能」误命中「重力」
  let best: string | null = null;
  for (const name of names) {
    if (topic.includes(name) && (best === null || name.length > best.length)) best = name;
  }
  return best ? PHYS_FORMULA_SYMBOLS[best] : null;
}

/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 动态预置问题：把实验当下的读数插进「问 AI」的问题模板。
 *
 * 为什么需要它：本站没有自由输入框，学生能问的问题由页面决定；静态文案只能跟着「页面 / 条目」走，
 * 插进当前读数之后，问题才能跟着学生此刻这一步的数据走——这是这种形态下唯一可行的「因材施问」。
 *
 * 三条硬约束：
 *   ① 任一插值缺失就不生成该条（绝不输出半句话、undefined 或 NaN）；
 *   ② 只指向「观察 / 比较 / 趋势」，不指向结论（与系统提示词的探究型立场一致）；
 *   ③ 拿不到动态问题就回退静态文案，调用方无需分支。
 *
 * 试点实验：ohm（欧姆定律）/ lens（凸透镜成像）/ lever（杠杆）。其余实验返回空数组，行为与改造前一致。
 */

export interface DynamicQuestion {
  /** 取出的读数，供测试断言与后续扩展（如界面上标注「基于你当前读数」） */
  values: Record<string, number | string>;
  zh: string;
  en: string;
  /** reading = 看读数；compare = 比两个读数；trend = 看变化趋势 */
  requires?: 'reading' | 'compare' | 'trend';
}

export type DynamicQuestionBuilder = (state: Record<string, unknown>) => DynamicQuestion[];

/** 有限数校验：NaN / ±Infinity / 非数字一律视为缺失 */
function num(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** 与页面读数一致：保留 2 位小数（页面上就是 0.60A / 6.00V 这种口径） */
function f2(v: number): string {
  return v.toFixed(2);
}

/** 插值完整性：出现 undefined / NaN / null 直接丢弃这一条 */
function clean(q: DynamicQuestion): boolean {
  const s = `${q.zh}${q.en}`;
  return !!s && !/undefined|NaN|null/.test(s);
}

export const DYNAMIC_QUESTION_BUILDERS: Record<string, DynamicQuestionBuilder> = {
  /** 欧姆定律：u 电压 / r 定值电阻 / element（resistor|bulb）/ i 电流读数 */
  ohm: (s) => {
    const u = s.u;
    const i = s.i;
    const isBulb = s.element === 'bulb';
    if (!num(u) || !num(i)) return [];
    const part = isBulb ? '灯泡' : '定值电阻';
    const partEn = isBulb ? 'bulb' : 'fixed resistor';
    const tailZh = isBulb
      ? '同样的电压加在定值电阻上，电流读数更大，为什么灯泡的电流涨得慢？'
      : '我把电压调小一半，电流为什么会跟着一起变小？';
    const tailEn = isBulb
      ? 'At the same voltage the fixed resistor reads a larger current — why does the bulb current rise more slowly?'
      : 'If I halve the voltage, why does the current fall by half as well?';
    return [
      {
        values: { u, i, element: isBulb ? 'bulb' : 'resistor' },
        zh: `我把电压调到 ${f2(u)}V，${part}的电流读数是 ${f2(i)}A，${tailZh}`,
        en: `With the voltage at ${f2(u)}V the ${partEn} current reads ${f2(i)}A. ${tailEn}`,
        requires: 'compare',
      },
    ];
  },

  /** 凸透镜成像：u 物距 / f 焦距 / v 像距（u 与 f 太近时 imageV 返回 null，此时不出题） */
  lens: (s) => {
    const u = s.u;
    const f = s.f;
    const v = s.v;
    if (!num(u) || !num(f) || !num(v)) return [];
    return [
      {
        values: { u, f, v },
        zh: `物距 ${f2(u)}cm、焦距 ${f2(f)}cm 时像距是 ${f2(v)}cm，我把物体再往透镜靠近一点，像距为什么会变大？`,
        en: `With object distance ${f2(u)}cm and focal length ${f2(f)}cm the image distance is ${f2(v)}cm. Why does the image distance grow when I move the object closer to the lens?`,
        requires: 'trend',
      },
    ];
  },

  /** 杠杆：m1/d1 左钩码数与格数、m2/d2 右钩码数与格数、balanced 是否平衡（页面显示「左 2×3 / 右 3×2」） */
  lever: (s) => {
    const m1 = s.m1;
    const d1 = s.d1;
    const m2 = s.m2;
    const d2 = s.d2;
    if (!num(m1) || !num(d1) || !num(m2) || !num(d2)) return [];
    const balanced = s.balanced === true;
    return [
      {
        values: { m1, d1, m2, d2, balanced: balanced ? 1 : 0 },
        zh: `现在左边 ${m1}×${d1}、右边 ${m2}×${d2}，杠杆${balanced ? '刚好平衡' : '往重的一边倾'}，为什么比较这两个乘积就能判断平衡？`,
        en: `Right now the left is ${m1}×${d1} and the right is ${m2}×${d2}, and the lever ${balanced ? 'balances' : 'tilts to the heavier side'}. Why does comparing those two products tell us whether it balances?`,
        requires: 'compare',
      },
    ];
  },
};

/**
 * 对外唯一入口：有动态问题就放首位，静态文案留作兜底；调用方取 [0] 即可。
 * 拿不到动态问题（未注册的 lab / 读数缺失 / 模板不完整）时只返回静态文案，行为与改造前一致。
 */
export function getDynamicQuestions(
  labId: string,
  state: Record<string, unknown>,
  lang: 'zh' | 'en',
  fallback: string,
): string[] {
  const builder = DYNAMIC_QUESTION_BUILDERS[labId];
  if (!builder) return [fallback];
  const dyn = builder(state)
    .filter(clean)
    .map((q) => (lang === 'zh' ? q.zh : q.en))
    .filter((q) => !!q);
  return dyn.length > 0 ? [dyn[0], fallback] : [fallback];
}

/* ── 实验状态注册表（易失） ──
 * 用途：实验页把「当前阶段 + 读数」写进来，构造系统提示词时读取（阶段用于回答立场）。
 * 为什么不用 React context：滑块每动一格都会触发写入，放进 context 会让全局 AI 面板跟着重渲染；
 * 模块级 Map 写入不触发渲染，且只保存本次会话内的易失状态，不落任何持久化。
 */
const LAB_STATE = new Map<string, Record<string, unknown>>();

export function setLabState(labId: string, state: Record<string, unknown>): void {
  if (!labId) return;
  LAB_STATE.set(labId, state);
}

export function getLabState(labId: string): Record<string, unknown> | undefined {
  return labId ? LAB_STATE.get(labId) : undefined;
}

export function clearLabState(labId: string): void {
  LAB_STATE.delete(labId);
}

/** 从当前路径取实验 id（/lab/ohm → ohm） */
export function labIdFromPath(pathname: string): string {
  const m = /\/lab\/([A-Za-z0-9_-]+)/.exec(pathname || '');
  return m ? m[1] : '';
}

/** 实验阶段 → 提示词里的中文/英文标签（三幕式：预测 / 探索 / 结论） */
export function stageLabel(stage: unknown, lang: 'zh' | 'en'): string {
  const key = typeof stage === 'string' ? stage : '';
  const zh: Record<string, string> = { predict: '预测', explore: '探索', conclude: '结论' };
  const en: Record<string, string> = { predict: 'predict', explore: 'explore', conclude: 'conclude' };
  const map = lang === 'zh' ? zh : en;
  return map[key] ?? '';
}

/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 数学公式数据（初中人教版，八下+九上）。
 * 依据：math_kb 公式速查_八下.md + jiushang 章节（一元二次方程/二次函数/圆/概率）提炼。
 * 板块：algebra 代数 / geometry 几何 / function 函数 / stats 统计概率。
 * formula 为 KaTeX 字符串；label 为公式的通俗读法（详情卡展示）。
 */
export type FormulaCategory = 'algebra' | 'geometry' | 'function' | 'stats';

export type FormulaDiagram =
  | { kind: 'pythagorean' | 'chord' | 'inscribed' | 'sector' }
  | { kind: 'linear' | 'quadratic' | 'inverse' | 'kabs' };

export interface MathFormula {
  /** 公式名（卡片主显示） */
  name: { zh: string; en: string };
  /** KaTeX 公式（卡片 + 详情显示） */
  formula: string;
  /** 公式的通俗读法（如"a 的平方加 b 的平方等于 c 的平方"） */
  label: { zh: string; en: string };
  category: FormulaCategory;
  /** 记忆口诀或要点 */
  tip: { zh: string; en: string };
  /** 易错点 */
  pitfall: { zh: string; en: string };
  /** 典型应用 */
  usage: { zh: string; en: string };
  /** 对应教材章节（中文） */
  chapter: string;
  /** 关联实验 id（可选） */
  labId?: string;
  /** 配图类型（详情卡展示的示意图） */
  diagram?: FormulaDiagram;
}

export const FORMULA_CATEGORY_ZH: Record<FormulaCategory, string> = {
  algebra: '代数',
  geometry: '几何',
  function: '函数',
  stats: '统计概率',
};

export const FORMULA_CATEGORY_EN: Record<FormulaCategory, string> = {
  algebra: 'Algebra',
  geometry: 'Geometry',
  function: 'Functions',
  stats: 'Statistics & Probability',
};

export const FORMULAS: MathFormula[] = [
  // ── 代数：整式乘除、二次根式、一元二次方程 ──
  {
    name: { zh: '完全平方公式', en: 'Perfect square formula' },
    formula: '(a \\pm b)^2 = a^2 \\pm 2ab + b^2',
    label: { zh: '两数和（差）的平方等于两数平方和加（减）两数积的 2 倍', en: 'The square of a sum (difference) equals the squares plus (minus) twice the product' },
    category: 'algebra',
    tip: { zh: '口诀：首平方、尾平方、积的 2 倍放中央。', en: 'First squared, last squared, twice the product in between.' },
    pitfall: { zh: '漏写中间的 $\\pm 2ab$；系数要平方（如 $(2x)^2=4x^2$）。', en: 'Forgetting the middle $\\pm 2ab$ term; squaring coefficients (e.g. $(2x)^2=4x^2$).' },
    usage: { zh: '因式分解、简便计算（如 99²=(100-1)²）。', en: 'Factoring, mental arithmetic (e.g. 99²=(100-1)²).' },
    chapter: '八年级上册 整式的乘除',
  },
  {
    name: { zh: '平方差公式', en: 'Difference of squares' },
    formula: 'a^2 - b^2 = (a + b)(a - b)',
    label: { zh: '两数平方差等于两数和与两数差的积', en: 'The difference of two squares equals the product of their sum and difference' },
    category: 'algebra',
    tip: { zh: '口诀：同号平方减异号平方。', en: 'Same-signed squares minus opposite-signed squares.' },
    pitfall: { zh: '注意 $(a-b)^2 \\neq a^2-b^2$（完全不同）。', en: 'Note $(a-b)^2 \\neq a^2-b^2$ (they are different).' },
    usage: { zh: '因式分解、分母有理化。', en: 'Factoring, rationalizing denominators.' },
    chapter: '八年级上册 整式的乘除',
  },
  {
    name: { zh: '二次根式化简', en: 'Simplifying radicals' },
    formula: '\\sqrt{a^2} = |a|, \\quad \\sqrt{ab} = \\sqrt{a}\\sqrt{b}',
    label: { zh: '根号下 a 方等于 a 的绝对值；根号下 ab 等于根号 a 乘根号 b', en: 'Square root of a² is |a|; root of ab splits into root a times root b' },
    category: 'algebra',
    tip: { zh: '$\\sqrt{a^2}=|a|$（a 可能为负，必须取绝对值）。', en: '$\\sqrt{a^2}=|a|$ (a may be negative, take absolute value).' },
    pitfall: { zh: '$\\sqrt{a^2}$ 直接写 a 是错的（a 为负时出错）。', en: 'Writing $\\sqrt{a^2}$ as a directly is wrong when a is negative.' },
    usage: { zh: '二次根式化简与计算。', en: 'Simplifying and computing radicals.' },
    chapter: '八年级下册 第16章 二次根式',
  },
  {
    name: { zh: '一元二次方程求根公式', en: 'Quadratic formula' },
    formula: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
    label: { zh: 'x 等于 2a 分之负 b 加减根号下 b 方减 4ac', en: 'x equals negative b plus or minus the square root of b²−4ac, all over 2a' },
    category: 'algebra',
    tip: { zh: '判别式 $\\Delta=b^2-4ac$：$\\Delta>0$ 两不等实根，$\\Delta=0$ 两相等实根，$\\Delta<0$ 无实根。', en: 'Discriminant $\\Delta=b^2-4ac$: two roots if $>0$, one double root if $=0$, none if $<0$.' },
    pitfall: { zh: '公式中 $-b$ 的负号与分母 $2a$ 别漏；先化一般式 $ax^2+bx+c=0$。', en: 'Do not drop the $-b$ sign or $2a$ denominator; standardize first.' },
    usage: { zh: '解一元二次方程、判断根的情况。', en: 'Solving quadratics, determining root nature.' },
    chapter: '九年级上册 第21章 一元二次方程',
  },
  {
    name: { zh: '配方法（顶点式）', en: 'Completing the square' },
    formula: 'ax^2 + bx + c = a\\left(x + \\frac{b}{2a}\\right)^2 + \\frac{4ac - b^2}{4a}',
    label: { zh: '二次三项式配方为 a 乘括号平方加常数', en: 'Rewrite a quadratic as a times a squared binomial plus a constant' },
    category: 'algebra',
    tip: { zh: '配方本质：加上一次项系数一半的平方再减去。', en: 'Add and subtract the square of half the linear coefficient.' },
    pitfall: { zh: '配方时 $a\\neq 1$ 先提公因式，括号内常数要乘回 a。', en: 'Factor out $a$ first if $a\\neq 1$; account for it in the constant.' },
    usage: { zh: '求最值、解方程、推导顶点坐标。', en: 'Finding extrema, solving, deriving the vertex.' },
    chapter: '九年级上册 第21章 一元二次方程',
    labId: 'quadratic',
  },

  // ── 几何：勾股定理、多边形、圆 ──
  {
    name: { zh: '勾股定理', en: 'Pythagorean theorem' },
    formula: 'a^2 + b^2 = c^2',
    label: { zh: '直角三角形两直角边的平方和等于斜边的平方', en: 'In a right triangle, the squares of the legs sum to the square of the hypotenuse' },
    category: 'geometry',
    tip: { zh: 'c 是斜边（最长边）；常见勾股数 3-4-5、5-12-13。', en: 'c is the hypotenuse; common triples 3-4-5, 5-12-13.' },
    pitfall: { zh: '必须先确定哪条是斜边，别把直角边当 c。', en: 'Identify the hypotenuse first; do not use a leg as c.' },
    usage: { zh: '求边长、判定直角三角形、两点间距离。', en: 'Finding sides, right-triangle tests, distances.' },
    chapter: '八年级下册 第17章 勾股定理',
    labId: 'circle',
    diagram: { kind: 'pythagorean' }
  },
  {
    name: { zh: '多边形内角和', en: 'Sum of interior angles' },
    formula: '(n - 2) \\times 180^\\circ',
    label: { zh: 'n 边形内角和等于 n 减 2 乘 180 度', en: 'An n-gon\'s interior angles sum to (n−2)×180°' },
    category: 'geometry',
    tip: { zh: '外角和恒为 360°，与边数无关。', en: 'The exterior angles always sum to 360°.' },
    pitfall: { zh: 'n 是边数不是顶点数（顶点数=边数）；三角形 n=3 时是 180°。', en: 'n is the side count; for a triangle n=3 gives 180°.' },
    usage: { zh: '多边形角度计算、正多边形内角。', en: 'Angle problems in polygons.' },
    chapter: '八年级上册 第11章 三角形',
  },
  {
    name: { zh: '多边形对角线总数', en: 'Number of diagonals' },
    formula: '\\frac{n(n - 3)}{2}',
    label: { zh: 'n 边形对角线总数等于 n 乘 n 减 3 再除以 2', en: 'An n-gon has n(n−3)/2 diagonals' },
    category: 'geometry',
    tip: { zh: '每个顶点有 n-3 条对角线，总数除 2（每条被数两次）。', en: 'Each vertex has n−3 diagonals; divide by 2 (each counted twice).' },
    pitfall: { zh: '别忘除以 2，否则重复计数。', en: 'Do not forget to divide by 2.' },
    usage: { zh: '多边形对角线计数。', en: 'Counting diagonals.' },
    chapter: '八年级上册 第11章 三角形',
  },
  {
    name: { zh: '垂径定理', en: 'Perpendicular diameter theorem' },
    formula: 'CD \\perp AB \\Rightarrow AD = DB, \\; \\widehat{AC} = \\widehat{CB}',
    label: { zh: '垂直于弦的直径平分弦及弦所对的两条弧', en: 'A diameter perpendicular to a chord bisects the chord and its arcs' },
    category: 'geometry',
    tip: { zh: '圆中"过圆心、垂直弦、平分弦、平分弧"四者知二推二。', en: 'Center, perpendicular, bisects chord, bisects arc: any two imply the rest.' },
    pitfall: { zh: '必须过圆心且垂直弦；垂足不一定是弦中点以外的点。', en: 'Must pass through center and be perpendicular.' },
    usage: { zh: '求弦长、半径、拱高。', en: 'Finding chord lengths, radii, sagittas.' },
    chapter: '九年级上册 第24章 圆',
    labId: 'circle',
    diagram: { kind: 'chord' }
  },
  {
    name: { zh: '圆周角定理', en: 'Inscribed angle theorem' },
    formula: '\\angle BPC = \\frac{1}{2}\\angle BOC',
    label: { zh: '同弧所对圆周角等于圆心角的一半', en: 'An inscribed angle is half the central angle subtending the same arc' },
    category: 'geometry',
    tip: { zh: '直径所对圆周角是 90°（半圆上的圆周角）。', en: 'An angle inscribed in a semicircle is 90°.' },
    pitfall: { zh: '必须同弧（或等弧）；圆周角与圆心角顶点不同。', en: 'Same arc required; vertices differ.' },
    usage: { zh: '圆中角的关系、证明直角。', en: 'Angle relations, proving right angles.' },
    chapter: '九年级上册 第24章 圆',
    labId: 'circle',
    diagram: { kind: 'inscribed' }
  },
  {
    name: { zh: '弧长公式', en: 'Arc length' },
    formula: 'l = \\frac{n\\pi r}{180}',
    label: { zh: '弧长 l 等于 180 分之 nπr（n 为圆心角度数）', en: 'Arc length l = nπr/180 (n in degrees)' },
    category: 'geometry',
    tip: { zh: 'n 是圆心角（度），r 是半径；与扇形面积公式配套记。', en: 'n is the central angle in degrees; pair with sector area.' },
    pitfall: { zh: 'n 用度数而非弧度；别忘了 π。', en: 'Degrees not radians; keep π.' },
    usage: { zh: '弧长、滚动问题。', en: 'Arc lengths, rolling problems.' },
    chapter: '九年级上册 第24章 圆',
    diagram: { kind: 'sector' }
  },
  {
    name: { zh: '扇形面积', en: 'Sector area' },
    formula: 'S = \\frac{n\\pi r^2}{360} = \\frac{1}{2}lr',
    label: { zh: '扇形面积等于 360 分之 nπr 方，也等于二分之一弧长乘半径', en: 'Sector area = nπr²/360, also ½lr' },
    category: 'geometry',
    tip: { zh: '两条公式等价（S=½lr 更常用于已知弧长）。', en: 'Both forms equivalent; ½lr is handy when arc length is known.' },
    pitfall: { zh: '扇形是圆的一部分，n/360 别漏。', en: 'Do not drop the n/360 fraction.' },
    usage: { zh: '扇形面积、圆锥侧面积（S=πrl）。', en: 'Sector and cone lateral areas.' },
    chapter: '九年级上册 第24章 圆',
    diagram: { kind: 'sector' }
  },

  // ── 函数：一次、二次、反比例 ──
  {
    name: { zh: '一次函数', en: 'Linear function' },
    formula: 'y = kx + b \\quad (k \\neq 0)',
    label: { zh: 'y 等于 kx 加 b，k 不为 0', en: 'y = kx + b with k ≠ 0' },
    category: 'function',
    tip: { zh: 'k>0 图像上升，k<0 下降；b 是 y 轴截距。', en: 'k>0 rises, k<0 falls; b is the y-intercept.' },
    pitfall: { zh: 'k=0 是常函数不是一次函数；b 是截距不是与 x 轴交点。', en: 'k=0 is constant, not linear; b is y-intercept.' },
    usage: { zh: '行程、销售等实际问题的建模。', en: 'Modeling real-world linear situations.' },
    chapter: '八年级下册 第19章 一次函数',
    labId: 'linear',
    diagram: { kind: 'linear' }
  },
  {
    name: { zh: '二次函数顶点坐标', en: 'Vertex of a parabola' },
    formula: '\\left(-\\frac{b}{2a}, \\; \\frac{4ac - b^2}{4a}\\right)',
    label: { zh: '顶点横坐标负 2a 分之 b，纵坐标 4a 分之 4ac 减 b 方', en: 'Vertex is (−b/2a, (4ac−b²)/4a)' },
    category: 'function',
    tip: { zh: '对称轴 x=-b/(2a)；a>0 开口向上有最小值，a<0 有最大值。', en: 'Axis x=−b/2a; a>0 opens up (min), a<0 opens down (max).' },
    pitfall: { zh: '顶点纵坐标勿写成 $-b^2/4a$（缺 $4ac$ 项）。', en: 'Do not drop the $4ac$ term in the y-coordinate.' },
    usage: { zh: '求最值、判定开口与对称轴。', en: 'Extrema, opening direction, axis.' },
    chapter: '九年级上册 第22章 二次函数',
    labId: 'quadratic',
    diagram: { kind: 'quadratic' }
  },
  {
    name: { zh: '反比例函数', en: 'Inverse variation' },
    formula: 'y = \\frac{k}{x} \\quad (k \\neq 0)',
    label: { zh: 'y 等于 x 分之 k，k 不为 0', en: 'y = k/x with k ≠ 0' },
    category: 'function',
    tip: { zh: 'k>0 双曲线在一、三象限，k<0 在二、四象限；|k| 越大离原点越远。', en: 'k>0 in quadrants I & III, k<0 in II & IV; larger |k| farther from origin.' },
    pitfall: { zh: '图像是两支曲线，不是一条；$x\\neq 0$。', en: 'Two branches; $x \\neq 0$.' },
    usage: { zh: '反比例关系建模（路程一定时速度与时间）。', en: 'Inverse-relation modeling.' },
    chapter: '九年级上册 第26章 反比例函数',
    labId: 'inverse',
    diagram: { kind: 'inverse' }
  },
  {
    name: { zh: '反比例函数 |k| 的几何意义', en: 'Geometric meaning of |k|' },
    formula: '|k| = S_{\\triangle POA} \\times 2 = |x \\cdot y|',
    label: { zh: '过双曲线上任一点作两轴垂线，围成矩形的面积等于 |k|；三角形 POA 的面积为 |k|/2', en: 'The rectangle formed by a point on the hyperbola and the axes has area |k|; triangle POA has |k|/2' },
    category: 'function',
    tip: { zh: '过双曲线上一点 P 作 $PA\\perp x$ 轴，则 $S_{\\triangle POA} = |k|/2$。', en: 'With $PA\\perp x$-axis, the triangle $POA$ has area $|k|/2$.' },
    pitfall: { zh: '面积取 |k|（k 可能为负）；三角形面积是 |k|/2 不是 |k|。', en: 'Use |k| (k may be negative); the triangle is |k|/2, not |k|.' },
    usage: { zh: '反比例函数与面积综合题（中考常考）。', en: 'Common exam problem combining the hyperbola and areas.' },
    chapter: '九年级上册 第26章 反比例函数',
    labId: 'inverse',
    diagram: { kind: 'kabs' }
  },

  // ── 统计概率 ──
  {
    name: { zh: '方差', en: 'Variance' },
    formula: 's^2 = \\frac{1}{n}\\sum_{i=1}^{n}(x_i - \\bar{x})^2',
    label: { zh: '方差等于各数据与平均数差的平方的平均数', en: 'Variance is the mean of squared deviations from the mean' },
    category: 'stats',
    tip: { zh: '方差衡量数据波动大小；方差越小数据越稳定。', en: 'Variance measures spread; smaller means more stable.' },
    pitfall: { zh: '先算平均数再求差的平方；单位是原数据单位的平方。', en: 'Compute the mean first; units are squared.' },
    usage: { zh: '比较两组数据的稳定性（成绩/产量）。', en: 'Comparing stability of two data sets.' },
    chapter: '八年级下册 第20章 数据的分析',
  },
  {
    name: { zh: '加权平均数', en: 'Weighted average' },
    formula: '\\bar{x} = \\frac{\\sum_{i=1}^{n} x_i w_i}{\\sum_{i=1}^{n} w_i}',
    label: { zh: '加权平均数等于各值乘权重之和除以权重之和', en: 'Weighted average = sum of value×weight over sum of weights' },
    category: 'stats',
    tip: { zh: '权可以是次数、百分比或重要性系数。', en: 'Weights may be frequencies, percentages, or importance.' },
    pitfall: { zh: '权重之和做分母，勿直接除以项数。', en: 'Divide by the weight sum, not the item count.' },
    usage: { zh: '成绩加权、统计报表。', en: 'Weighted grades, statistics.' },
    chapter: '八年级下册 第20章 数据的分析',
  },
  {
    name: { zh: '概率公式', en: 'Probability' },
    formula: 'P(A) = \\frac{m}{n}',
    label: { zh: '事件 A 的概率等于 A 包含的结果数 m 除以总结果数 n', en: 'P(A) = favorable outcomes / total outcomes' },
    category: 'stats',
    tip: { zh: '0 ≤ P(A) ≤ 1；必然事件 P=1，不可能事件 P=0。', en: '0 ≤ P(A) ≤ 1; certain = 1, impossible = 0.' },
    pitfall: { zh: '列举结果时保证等可能；别重复或遗漏。', en: 'Ensure equally likely outcomes; no double counting.' },
    usage: { zh: '摸球、掷骰子等古典概型。', en: 'Classical probability problems.' },
    chapter: '九年级上册 第25章 概率初步',
  },
];

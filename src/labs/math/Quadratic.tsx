/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 数学探究 · 二次函数 y = ax² + bx + c 三幕式探究（人教版 九上第 22 章）
 *
 * 幕 1 预测：给定 y = -2x² + 3，先猜开口方向 / 顶点 / 与 y 轴交点，再揭示图像
 * 幕 2 探索：控制变量卡（a / b / c 各自隔离）+ 钉住曲线对比 + 观察笔记
 * 幕 3 结论：学生总结 a、b、c 各自的作用，对照预测与观察记录
 *
 * 复用组件：CoordPlane（坐标系）、ExploreStage（任务卡+笔记）、ConclusionStage（结论）。
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { setLabState, setPageQuestion } from '../../lib/ai-dynamic-questions';
import { Check, ChevronRight, Minus, Pin, Plus, RotateCcw, X } from 'lucide-react';
import { useApp } from '../../lib/app-context';
import ParamSlider from '../../components/lab/ParamSlider';
import ParamDock from '../../components/lab/ParamDock';
import ToggleSwitch from '../../components/lab/ToggleSwitch';
import CoordPlane, { type CoordCurve, type CoordMarker, type CoordOverlay, mathMinus } from '../../components/lab/CoordPlane';
import ExploreStage, { type Observation, type ExploreCard } from '../../components/lab/ExploreStage';
import Formula from '../../components/ui/Formula';
import StageNav from '../../components/lab/StageNav';
import { loadOhmEngine, sampleQuadratic } from '../physics/stem-engine';
import { quadraticRoots, symPair } from './quadratic-core';
import { boolParam, enumParam, numParam, readUrlParams, useLabUrlSync } from '../../lib/lab-url-state';
import EngineBadge from '../../components/lab/EngineBadge';
import MathCanvasStage from '../../components/lab/MathCanvasStage';
import { ParabolaIcon } from '../../components/ui/LabIcon';
import { getEngineTooltip } from '../../components/lab/engine-copy';

type Stage = 'predict' | 'explore' | 'conclude';

/** 预测题：开口方向 */
type PredictOpen = 'up' | 'down' | null;
/** 预测题：顶点是最高还是最低 */
type PredictVertex = 'max' | 'min' | null;
/** 预测题：与 y 轴交点正负 */
type PredictIntercept = 'pos' | 'neg' | 'zero' | null;

/** 拉平二次函数表达式为 "y = ax² + bx + c" */
function exprOf(a: number, b: number, c: number): string {
  const parts: string[] = [];
  if (a !== 0) parts.push(a === 1 ? 'x²' : a === -1 ? '-x²' : `${a}x²`);
  if (b !== 0) parts.push(b > 0 ? (parts.length ? `+ ${b}x` : `${b}x`) : `- ${Math.abs(b)}x`);
  if (c !== 0 || parts.length === 0) parts.push(c > 0 ? (parts.length ? `+ ${c}` : `${c}`) : `- ${Math.abs(c)}`);
  if (parts.length === 0) return 'y = 0';
  return mathMinus(`y = ${parts.join(' ')}`);
}

/** 顶点式 y = a(x − h)² + k 的表达式（h、k 取一位小数；a = ±1 时省略系数） */
/** 把实验内使用的 Unicode 表达式转成 KaTeX LaTeX（仅用于展示层）。 */
function texExpr(expr: string): string {
  return expr.replace(/²/g, '^2').replace(/−/g, '-');
}

function vertexExprOf(a: number, h: number, k: number): string {
  const f = (v: number) => String(Math.round(v * 10) / 10 || 0);
  const aPart = a === 1 ? '' : a === -1 ? '-' : f(a);
  // h = 0 表示顶点落在 y 轴上：不写括号，直接 ax²（写成 a(x)² 别扭且不合教材书写）
  if (h === 0) {
    if (k === 0) return mathMinus(`y = ${aPart}x²`);
    return mathMinus(`y = ${aPart}x² ${k > 0 ? '+' : '-'} ${f(Math.abs(k))}`);
  }
  const inner = h > 0 ? `x - ${f(h)}` : `x + ${f(-h)}`;
  let s = `${aPart}(${inner})²`;
  if (k !== 0) s += k > 0 ? ` + ${f(k)}` : ` - ${f(-k)}`;
  return mathMinus(`y = ${s}`);
}

/**
 * 由一般式系数反推顶点 (h, k)：h = -b/2a、k = c - b²/4a。
 * 只做数学、保留全精度：切换写法时若在这里取整，eff.b/eff.c 会跟着改，
 * 曲线会在点击瞬间跳变（见审计 I-1）。一位小数只在 vertexExprOf / hText 等显示层做。
 * a = 0 时不是二次函数、没有顶点，返回 null 由调用方禁用顶点式。
 */
function vertexOf(a: number, b: number, c: number): { h: number; k: number } | null {
  if (Math.abs(a) < 1e-9) return null;
  return { h: -b / (2 * a), k: c - (b * b) / (4 * a) };
}

function SheetSlider({
  label,
  value,
  min,
  max,
  step = 0.1,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  const id = useId();
  return (
    <div className="flex h-8 items-center gap-2">
      <label htmlFor={id} className="w-20 shrink-0 text-[0.6875rem] mono-font text-[var(--muted)]">{label}</label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 min-w-0 flex-1 cursor-pointer accent-[var(--accent)]"
      />
      <span className="w-12 shrink-0 text-right text-xs mono-font tabular-nums text-[var(--fg)]">{format(value)}</span>
    </div>
  );
}

const copy = {
  zh: {
    params: '参数',
    paramDock: '调节参数',
    paramDockClose: '收起参数',
    readout: '当前函数',
    reset: '重置',
    // 表达式形式：一般式 / 顶点式（同一抛物线的两种写法）
    formGeneral: '一般式',
    formVertex: '顶点式',
    formGeneralExpr: 'y = ax² + bx + c',
    formVertexExpr: 'y = a(x − h)² + k',
    formHint: '同一个抛物线，两种写法：一般式看 a、b、c，顶点式直接读出顶点 (h, k)。切换不改变图像。',
    vertexDisabled: 'a = 0 时图像是一条直线，没有顶点式可写（先把 a 调离 0）',
    vertexPoint: '顶点',
    vertexAxis: '对称轴',
    vertexDegenerate: 'a = 0 时已经不是二次函数了：图像退化成水平直线 y = k，没有顶点。',
    vertexRule: 'h 管左右（左加右减），k 管上下（上加下减）',
    guides: '辅助线',
    guidesOffHint: '辅助线已关闭：图上不显示对称轴与顶点，读数里也不再给顶点坐标——先自己估计，再打开核对。',
    guessTitle: '猜想顶点对照',
    guessHint: '先填你猜的顶点坐标，再看差多少。顶点式中 h 的符号最容易反着写（左加右减）。',
    guessH: '你猜 h',
    guessK: '你猜 k',
    guessCol: '你的猜想',
    actualCol: '实际顶点',
    diffCol: '差',
    guessEmpty: '两个数都填上就能对照',
    guessRight: '猜对了：差距在 0.1 以内',
    guessWrong: '还差一点，再看看对称轴落在哪个位置',
    translateTitle: '顶点式平移三步',
    translateHint:
      '依次点击，观察抛物线如何平移：对称轴 x=h、顶点 (h,k) 跟着走——这就是配方法化顶点式的直观过程',
    cardsVertex: [
      {
        title: 'h 的左右移',
        prompt: '固定 a=1、k=0，只改 h：h 从 0 变到 2，抛物线往左还是往右移？顶点跟到哪儿了？',
      },
      {
        title: 'k 的上下移',
        prompt: '固定 a=1、h=0，只改 k：k 从 0 变到 3，图像往哪移？',
      },
      {
        title: 'a 的开口',
        prompt: '固定 h=0、k=0，只改 a：a 从 1 变到 2，开口变宽还是变窄？a 为负数呢？',
      },
      {
        title: '自由探索',
        prompt: 'a、h、k 任意组合，钉住几条曲线对比，看看顶点是不是总落在 (h, k)。',
      },
    ],
    // 幕导航
    stagePredict: '预测',
    stageExplore: '探索',
    stageConclude: '结论',
    stageDone: '完成',
    nextStage: '下一步 →',
    redoLabel: '重新探究',
    // 幕1 预测
    predictTitle: '预测',
    predictQuestion: '看这个函数：',
    predictQuestion2: '先别急着看图像，猜一猜：',
    predictQ1: '开口朝哪个方向？',
    predictUp: '向上（∪）',
    predictDown: '向下（∩）',
    predictQ2: '顶点是最高点还是最低点？',
    predictMax: '最高点',
    predictMin: '最低点',
    predictQ3: '图像与 y 轴的交点在？',
    predictPos: '正半轴（0 上方）',
    predictNeg: '负半轴（0 下方）',
    predictZero: '正好在原点',
    predictDone: '已记录你的预测',
    predictHint: '三个都猜完，就可以揭示图像',
    revealLabel: '揭示图像 →',
    // 幕2 探索
    exploreTitle: '探索',
    exploreEmpty: '还没有观察记录。拖动滑块或点任务卡，看到有意思的状态时记一条。',
    notePlaceholder: '写一句话：你观察到了什么？',
    recordLabel: '记一条观察',
    clearLabel: '清空记录',
    tryLabel: '试试这个',
    pinLabel: '钉住这条曲线',
    unpinLabel: '取消钉住',
    pinnedTitle: '已钉住的曲线',
    pinnedCount: (n: number) => `已钉 ${n} 条`,
    clearPinned: '清除钉住',
    pinnedEmpty: '（未钉住。钉住后可与当前曲线对比）',
    cards: [
      {
        title: 'a 的魔法（开口）',
        prompt: '固定 b=0、c=0，只改 a：a 从 1 变到 2，图像开口变宽还是变窄？a 变负数呢？',
      },
      {
        title: 'b 的移动（对称轴）',
        prompt: '固定 a=1、c=0，只改 b：b 从 0 变到 2，图像整体往左还是往右移？',
      },
      {
        title: 'c 的平移（上下）',
        prompt: '固定 a=1、b=0，只改 c：c 从 0 变到 3，图像往哪移？',
      },
      {
        title: '自由探索',
        prompt: '任意拖动 a、b、c，钉住几条曲线对比，找找规律。',
      },
    ],
    // 幕3 结论
    concludeTitle: '结论',
    concludeQuestion: '综合你的探索，a、b、c 各自起什么作用？',
    concludeSkipHint: '还没在预测幕猜过开口/顶点/交点——建议先回预测幕完成预测，再做结论会更有意义。',
    tipsTitle: '考点速记',
    tips: [
      '二次函数 y=ax²+bx+c：a 决定开口方向（a>0 向上）与宽窄（|a| 越大越窄）。',
      '对称轴 x=−b/2a，顶点 (-b/2a, (4ac−b²)/4a)；c 是与 y 轴交点。',
      '平移规律：y=a(x−h)²+k 中 h 左右平移、k 上下平移（左加右减、上加下减）。',
      '求与 x 轴交点：令 y=0 解一元二次方程；Δ=b²−4ac 判断交点个数。',
      '实际应用：最大面积/利润问题常转化为求顶点纵坐标。',
      '忽略空气阻力且 g 近似恒定时，竖直抛体高度 h(t) = −½gt² + v₀t + h₀，是二次函数。',
      '代数推导（顶点公式配方法）：y=ax²+bx+c = a(x+b/2a)² + (4ac−b²)/4a。由平方项 a(x+b/2a)²≥0（a>0 时）或 ≤0（a<0 时），可知对称轴 x=−b/2a，顶点在对称轴上，且 a>0 有最小值、a<0 有最大值——这是顶点纵坐标的代数依据。',
      '与一元二次方程的关系：y=ax²+bx+c 与 x 轴交点即方程 ax²+bx+c=0 的根。',
    ],
    concludeQ1: 'a 的正负决定：',
    concludeQ1Up: '开口方向（正→向上）',
    concludeQ1Down: '开口方向（负→向下）',
    concludeQ1None: '没有作用',
    concludeQ2: '|a| 越大：',
    concludeQ2Narrow: '开口越窄',
    concludeQ2Wide: '开口越宽',
    concludeQ2None: '无影响',
    concludeQ3: 'b 变化：',
    concludeQ3Shift: '使对称轴左右移动（x=−b/2a）',
    concludeQ3Stretch: '使图像上下伸缩',
    concludeQ3None: '无影响',
    concludeQ4: 'c 决定：',
    concludeQ4Intercept: '与 y 轴交点位置',
    concludeQ4Vertex: '顶点的 x 坐标',
    concludeQ4None: '无影响',
    concludeHint: '选完四个，看看结论和你的观察是否一致',
    feedbackTitle: '反馈',
    feedbackText:
      'a 的正负决定开口方向，|a| 决定开口宽窄，b 使图像左右平移（对称轴 x=−b/2a），c 决定图像与 y 轴的交点 (0, c)。你的观察记录验证了这些规律。',
  },
  en: {
    params: 'Parameters',
    paramDock: 'Adjust parameters',
    paramDockClose: 'Hide parameters',
    readout: 'Current function',
    reset: 'Reset',
    // Expression form: general / vertex (the same parabola, two ways)
    formGeneral: 'General',
    formVertex: 'Vertex',
    formGeneralExpr: 'y = ax² + bx + c',
    formVertexExpr: 'y = a(x − h)² + k',
    formHint:
      'One parabola, two ways to write it: general form shows a, b, c; vertex form reads the vertex (h, k) straight off. Switching never moves the graph.',
    vertexDisabled: 'With a = 0 the graph is a line, so there is no vertex form — move a away from 0 first',
    vertexPoint: 'Vertex',
    vertexAxis: 'Axis',
    vertexDegenerate: 'With a = 0 this is no longer quadratic: the graph degenerates to the horizontal line y = k, so it has no vertex.',
    vertexRule: 'h slides left/right, k slides up/down',
    guides: 'Guides',
    guidesOffHint: 'Guides are off: the axis and vertex are hidden on the graph and left out of the readout — estimate them first, then switch back to check.',
    guessTitle: 'Guess the vertex',
    guessHint: 'Type the vertex you expect, then see the difference. The sign of h in vertex form is the easy one to flip.',
    guessH: 'your h',
    guessK: 'your k',
    guessCol: 'Your guess',
    actualCol: 'Actual vertex',
    diffCol: 'Diff',
    guessEmpty: 'Fill both numbers to compare',
    guessRight: 'Spot on: within 0.1',
    guessWrong: 'Not quite — look again at where the axis sits',
    translateTitle: 'Vertex form in three steps',
    translateHint:
      'Click through to watch the parabola translate: the axis x=h and vertex (h,k) follow — the picture behind completing the square',
    cardsVertex: [
      {
        title: 'h: the horizontal slide',
        prompt: 'Fix a=1, k=0 and change only h: as h goes 0 → 2, does the parabola move left or right? Where does the vertex end up?',
      },
      {
        title: 'k: the vertical slide',
        prompt: 'Fix a=1, h=0 and change only k: as k goes 0 → 3, which way does the graph move?',
      },
      {
        title: 'a: the opening',
        prompt: 'Fix h=0, k=0 and change only a: from 1 to 2, does the parabola get wider or narrower? What if a is negative?',
      },
      {
        title: 'Free exploration',
        prompt: 'Combine a, h, k freely, pin a few curves, and check whether the vertex always sits at (h, k).',
      },
    ],
    stagePredict: 'Predict',
    stageExplore: 'Explore',
    stageConclude: 'Conclude',
    stageDone: 'Done',
    nextStage: 'Next →',
    redoLabel: 'Redo',
    predictTitle: 'Predict',
    predictQuestion: 'Look at this function:',
    predictQuestion2: 'Before seeing the graph, guess:',
    predictQ1: 'Which way does it open?',
    predictUp: 'Upward (∪)',
    predictDown: 'Downward (∩)',
    predictQ2: 'Is the vertex a maximum or minimum?',
    predictMax: 'Maximum',
    predictMin: 'Minimum',
    predictQ3: 'Where does the graph cross the y-axis?',
    predictPos: 'Positive side (above 0)',
    predictNeg: 'Negative side (below 0)',
    predictZero: 'Exactly at the origin',
    predictDone: 'Your predictions are recorded',
    predictHint: 'Answer all three to reveal the graph',
    revealLabel: 'Reveal graph →',
    exploreTitle: 'Explore',
    exploreEmpty: 'No observations yet. Drag the sliders or try a card, and note what you see.',
    notePlaceholder: 'Write one sentence: what did you observe?',
    recordLabel: 'Note it',
    clearLabel: 'Clear notes',
    tryLabel: 'Try it',
    pinLabel: 'Pin this curve',
    unpinLabel: 'Unpin',
    pinnedTitle: 'Pinned curves',
    pinnedCount: (n: number) => `${n} pinned`,
    clearPinned: 'Clear pinned',
    pinnedEmpty: '(nothing pinned — pin curves to compare with the current one)',
    cards: [
      {
        title: 'a: the opening',
        prompt: 'Fix b=0, c=0 and change only a: from 1 to 2, does the parabola get narrower or wider? What if a becomes negative?',
      },
      {
        title: 'b: the axis shift',
        prompt: 'Fix a=1, c=0 and change only b: from 0 to 2, does the graph shift left or right?',
      },
      {
        title: 'c: the vertical slide',
        prompt: 'Fix a=1, b=0 and change only c: from 0 to 3, which way does the graph move?',
      },
      {
        title: 'Free exploration',
        prompt: 'Drag a, b, c freely, pin a few curves and look for the pattern.',
      },
    ],
    concludeTitle: 'Conclude',
    concludeQuestion: 'Based on your exploration, what does each of a, b, c do?',
    concludeSkipHint: "You haven't predicted opening/vertex/intercept yet — go back to the Predict stage first.",
    tipsTitle: 'Key Points',
    tips: [
      'Quadratic y=ax²+bx+c: a decides opening direction (a>0 up) and width (larger |a|, narrower).',
      'Axis of symmetry x=−b/2a; vertex (-b/2a, (4ac−b²)/4a); c is the y-intercept.',
      'Shifts: in y=a(x−h)²+k, h shifts horizontally, k vertically.',
      'x-intercepts: set y=0 and solve; Δ=b²−4ac decides how many.',
      'Applications: max area/profit problems reduce to finding the vertex y.',
      'Ignoring air resistance with approximately constant g, vertical projectile height h(t) = −½gt² + v₀t + h₀ is quadratic.',
      'Algebraic derivation (completing the square): y=ax²+bx+c = a(x+b/2a)² + (4ac−b²)/4a. Since a(x+b/2a)²≥0 (a>0) or ≤0 (a<0), the axis is x=−b/2a, the vertex lies on it, and a>0 gives a minimum / a<0 a maximum — the algebraic basis for the vertex y-coordinate.',
      'A graph x-intercept is a root of the equation ax²+bx+c=0.',
    ],
    concludeQ1: 'The sign of a decides:',
    concludeQ1Up: 'opening direction (positive → up)',
    concludeQ1Down: 'opening direction (negative → down)',
    concludeQ1None: 'nothing',
    concludeQ2: 'Larger |a| makes the parabola:',
    concludeQ2Narrow: 'narrower',
    concludeQ2Wide: 'wider',
    concludeQ2None: 'no effect',
    concludeQ3: 'Changing b shifts the graph:',
    concludeQ3Shift: 'left/right (the axis moves)',
    concludeQ3Stretch: 'up/down stretch',
    concludeQ3None: 'no effect',
    concludeQ4: 'c decides:',
    concludeQ4Intercept: 'the y-intercept (0, c)',
    concludeQ4Vertex: 'the x-coordinate of the vertex',
    concludeQ4None: 'no effect',
    concludeHint: 'Answer all four, then see if your conclusion matches your observations',
    feedbackTitle: 'Feedback',
    feedbackText:
      'The sign of a decides the opening direction, |a| decides the width, b shifts the graph horizontally (axis x=−b/2a), and c sets the y-intercept (0, c). Your observations confirm these rules.',
  },
};

/** 预测目标函数：y = -2x² + 3（开口向下、最高点、y 轴正半轴） */
const TARGET_A = -2;
const TARGET_B = 0;
const TARGET_C = 3;

/** GraphLab 固定默认视窗：只在这里定教学尺度，不随包围盒自动缩放。
 *  x 与 y 的跨度接近，避免旧版自动 y 范围把抛物线压成一条细线；
 *  学生可用画布右上角的缩放/重置按钮手动改视口。 */
const DEFAULT_VIEW = { xMin: -10, xMax: 10, yMin: -7, yMax: 5 } as const;
const VIEW_MIN_SPAN = 2;
const VIEW_MAX_SPAN = 24;

/** 顶点式平移动画演示步骤：y=(x-h)²+k 展开为 y=ax²+bx+c（a=1, b=-2h, c=h²+k）。
 *  按教材「配方法 → 顶点式」思路：先右移 h，再上移 k，曲线用已有插值动画平滑变形 + 顶点/对称轴实时跟随。 */
const TRANSLATE_STEPS: { a: number; b: number; c: number; zh: string; en: string; shortZh: string; shortEn: string }[] = [
  { a: 1, b: 0, c: 0, zh: 'y = x²（基准）', en: 'y = x² (base)', shortZh: '基准 y=x²', shortEn: 'Base' },
  { a: 1, b: -2, c: 1, zh: 'y = (x−1)² 右移 1', en: 'y = (x−1)² right 1', shortZh: '右移 1', shortEn: 'Right 1' },
  { a: 1, b: -2, c: 3, zh: 'y = (x−1)²+2 再上移 2', en: 'y = (x−1)²+2 up 2', shortZh: '再上移 2', shortEn: 'Up 2' },
];

const CHECK_ICON = <Check className="inline-block h-3.5 w-3.5 shrink-0 align-[-0.15em]" aria-hidden="true" />;
const X_ICON = <X className="inline-block h-3.5 w-3.5 shrink-0 align-[-0.15em]" aria-hidden="true" />;


/**
 * 题库注册表：选项顺序与判分答案的单一事实源。
 * 渲染侧按同一顺序排布；smoke 守卫解析源码断言二者一致（防「改了渲染忘了改注册表」）。
 */
export const OPTIONS = {
  q1: [['down', 'concludeQ1Down'], ['none', 'concludeQ1None'], ['up', 'concludeQ1Up']],
  q2: [['narrow', 'concludeQ2Narrow'], ['wide', 'concludeQ2Wide'], ['none', 'concludeQ2None']],
  q3: [['none', 'concludeQ3None'], ['shift', 'concludeQ3Shift'], ['stretch', 'concludeQ3Stretch']],
  q4: [['vertex', 'concludeQ4Vertex'], ['none', 'concludeQ4None'], ['intercept', 'concludeQ4Intercept']],
} as const;

/** 每题正确选项值（多解用数组）。 */
export const QUIZ_CORRECT: Record<string, string[]> = {
  q1: ['up'],
  q2: ['narrow'],
  q3: ['shift'],
  q4: ['intercept'],
};

export default function Quadratic() {
  const { lang } = useApp();
  const t = copy[lang];
  const initialUrl = readUrlParams();

  const [stage, setStage] = useState<Stage>(() => enumParam(initialUrl.get('stage'), ['predict', 'explore', 'conclude'] as const, 'predict'));
  // 预测幕：暂存对目标函数的三个猜测；全部回答后揭示图像
  const [predOpen, setPredOpen] = useState<PredictOpen>(null);
  const [predVertex, setPredVertex] = useState<PredictVertex>(null);
  const [predIntercept, setPredIntercept] = useState<PredictIntercept>(null);
  const [revealed, setRevealed] = useState(false);
  // 探索幕：当前参数（初始 = 预测目标函数 y=-2x²+3，揭示后所见即所测）+ 钉住曲线 + 观察记录
  const [a, setA] = useState(() => numParam(initialUrl.get('a'), TARGET_A, -10, 10, { disallowZero: true }));
  const [b, setB] = useState(() => numParam(initialUrl.get('b'), TARGET_B, -20, 20));
  const [c, setC] = useState(() => numParam(initialUrl.get('c'), TARGET_C, -20, 20));
  // 表达式形式：一般式 y=ax²+bx+c ↔ 顶点式 y=a(x−h)²+k（同一条抛物线的两种写法）
  const [form, setForm] = useState<'general' | 'vertex'>(() => enumParam(initialUrl.get('mode'), ['general', 'vertex'] as const, 'general'));
  const [translateOpen, setTranslateOpen] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);
  const [sheetView, setSheetView] = useState({ cx: 0, cy: -1, zoom: 1 });
  const [showLabels, setShowLabels] = useState(true);
  const [inquiryTab, setInquiryTab] = useState<'tasks' | 'steps'>('tasks');
  useEffect(() => {
    const mq = window.matchMedia?.('(min-width: 1024px)');
    const sync = () => setIsDesktop(!!mq?.matches);
    sync();
    mq?.addEventListener?.('change', sync);
    return () => mq?.removeEventListener?.('change', sync);
  }, []);
  const [h, setH] = useState(() => numParam(initialUrl.get('h'), 0, -10, 10));
  const [k, setK] = useState(() => numParam(initialUrl.get('k'), 0, -20, 20));
  /** 参数抽屉的滚动锚点：函数坐标系（预测幕未揭示时是同一容器里的占位卡） */
  const planeRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const canvasPanRef = useRef<{ x: number; y: number; view: typeof view } | null>(null);
  const sheetCanvasRef = useRef<HTMLDivElement>(null);
  const sheetPanRef = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  /** a = 0 时不是二次函数：顶点式无意义，切换按钮禁用并给提示 */
  const canUseVertexForm = Math.abs(a) > 1e-9;
  // 辅助线开关：关掉后画布不画对称轴/顶点/交点，读数也不给顶点坐标（先自己估计，再开回来核对）
  const [showGuides, setShowGuides] = useState(() => boolParam(initialUrl.get('guides'), true));
  // 猜想顶点对照：学生自己填 (h, k)，与公式算出的实际顶点比差值
  const [guessH, setGuessH] = useState('');
  const [guessK, setGuessK] = useState('');
  const [pinned, setPinned] = useState<{ id: number; a: number; b: number; c: number }[]>([]);
  // GraphLab：固定教学视窗 + 手动缩放/重置；a/b/c 变化绝不自动改镜头
  const [view, setView] = useState<{ xMin: number; xMax: number; yMin: number; yMax: number }>({ ...DEFAULT_VIEW });
  const [observations, setObservations] = useState<Observation[]>([]);
  // 结论幕：四组结论（a 正负 / |a| / b / c 的作用），全部选完才算完成
  const [conclusion, setConclusion] = useState<{
    q1: 'up' | 'down' | 'none' | null;
    q2: 'narrow' | 'wide' | 'none' | null;
    q3: 'shift' | 'stretch' | 'none' | null;
    q4: 'intercept' | 'vertex' | 'none' | null;
  }>({ q1: null, q2: null, q3: null, q4: null });

  // 计算引擎（C++ WebAssembly / JS 回退）：默认 JS；mount 后异步尝试加载 WASM，失败静默回退
  const [engineKind, setEngineKind] = useState<'js' | 'wasm'>('js');
  useEffect(() => {
    let alive = true;
    loadOhmEngine().then((k) => {
      if (alive) setEngineKind(k);
    });
    return () => {
      alive = false;
    };
  }, []);

  /** 判分表：引用导出的注册表（单一事实源） */
  const correctKeys = QUIZ_CORRECT;
  const conclusionComplete =
    conclusion.q1 !== null && conclusion.q2 !== null && conclusion.q3 !== null && conclusion.q4 !== null;

  const predComplete = predOpen !== null && predVertex !== null && predIntercept !== null;

  /**
   * 当前生效的系数：顶点式按 y=a(x−h)²+k 展开成 a、b=−2ah、c=ah²+k。
   * 下游（采样 / 标注 / 求根 / 钉住）一律读 eff —— 两种写法共用同一套渲染，不存在两套曲线逻辑。
   */
  const eff = useMemo(
    () => (form === 'vertex' ? { a, b: -2 * a * h, c: a * h * h + k } : { a, b, c }),
    [form, a, b, c, h, k],
  );
  useLabUrlSync({ stage, mode: form, a: eff.a, b: eff.b, c: eff.c, h, k, guides: showGuides }, { stage: 'predict', mode: 'general', a: TARGET_A, b: TARGET_B, c: TARGET_C, h: 0, k: 0, guides: true }, [stage, form, eff.a, eff.b, eff.c, h, k, showGuides]);

  /** 顶点式一次性写入 (a, h, k) 并同步一般式系数——分三次调用单参 setter 会读到旧值，必须整组赋值 */
  const applyVertex = (na: number, nh: number, nk: number) => {
    setA(na);
    setH(nh);
    setK(nk);
    setB(-2 * na * nh);
    setC(na * nh * nh + nk);
  };
  /** 顶点式里改 a：保持顶点 (h, k) 不动，只改开口 */
  const setVertexA = (v: number) => applyVertex(v, h, k);
  /** 顶点式里改 h：顶点左右移动 */
  const setVertexH = (v: number) => applyVertex(a, v, k);
  /** 顶点式里改 k：顶点上下移动 */
  const setVertexK = (v: number) => applyVertex(a, h, v);
  /** 用一组一般式系数同时刷新两种写法的参数（预设按钮 / 任务卡 / 重置共用） */
  const applyGeneral = (na: number, nb: number, nc: number) => {
    setA(na);
    setB(nb);
    setC(nc);
    const v = vertexOf(na, nb, nc);
    if (v) {
      setH(v.h);
      setK(v.k);
    } else {
      // a = 0：没有顶点，h/k 清零（顶点式已被禁用，这里只防脏值）
      setH(0);
      setK(0);
    }
  };
  /** 切换写法：先按当前图像把另一套参数补齐，切换瞬间曲线不动 */
  const switchForm = (next: 'general' | 'vertex') => {
    if (next === form) return;
    if (next === 'vertex') {
      // 全精度写入，保证 eff.a/b/c 与切换前在浮点容差内恒等，图像不跳
      const v = vertexOf(a, b, c);
      if (!v) return;
      setH(v.h);
      setK(v.k);
    } else {
      setB(-2 * a * h);
      setC(a * h * h + k);
    }
    setForm(next);
  };

  const vertex = useMemo(() => {
    if (Math.abs(eff.a) < 1e-9) return null;
    const vh = -eff.b / (2 * eff.a);
    return { h: vh, k: eff.a * vh * vh + eff.b * vh + eff.c };
  }, [eff]);

  // 采样范围跟随当前视窗并额外留 4 单位余量；否则网格扩到 ±8/±11 时曲线会在 ±4 处出现“隐形墙”。
  const sampleXMin = isDesktop ? -24 : view.xMin - 4;
  const sampleXMax = isDesktop ? 24 : view.xMax + 4;

  const currentCurve: CoordCurve = useMemo(
    () => ({
      id: 'main',
      points: sampleQuadratic(eff.a, eff.b, eff.c, sampleXMin, sampleXMax),
      label: form === 'vertex' ? vertexExprOf(eff.a, h, k) : exprOf(eff.a, eff.b, eff.c),
    }),
    [eff, form, h, k, sampleXMin, sampleXMax],
  );

  // 基准残影：同开口的 y = a x²，只作参照，不参与自动 y 范围
  const baseCurve: CoordCurve = useMemo(
    () => ({
      id: 'base',
      points: sampleQuadratic(eff.a, 0, 0, sampleXMin, sampleXMax),
      dashed: true,
      label: `y = ${eff.a === 1 ? '' : eff.a === -1 ? '−' : eff.a}x²`,
      affectsRange: false,
    }),
    [eff.a, sampleXMin, sampleXMax],
  );

  const pinnedCurves: CoordCurve[] = pinned.map((p) => ({
    id: `pin${p.id}`,
    points: sampleQuadratic(p.a, p.b, p.c, sampleXMin, sampleXMax),
    dashed: true,
    label: exprOf(p.a, p.b, p.c),
  }));

  const showBase = showGuides && vertex !== null && (Math.abs(eff.b) > 1e-9 || Math.abs(eff.c) > 1e-9);
  const curves = showBase ? [currentCurve, ...pinnedCurves, baseCurve] : [currentCurve, ...pinnedCurves];

  // 对称点：P(h+d) 与 P′(h−d)，水平弦 + 轴上直角；d 夹在 [0.6, 1.5] 且不出 ±4
  const sym = useMemo(() => {
    if (!showGuides || !vertex) return null;
    const d = Math.min(1.5, 3.6 - Math.abs(vertex.h));
    if (d < 0.6) return null;
    return symPair(eff.a, eff.b, eff.c, vertex.h + d);
  }, [showGuides, vertex, eff]);

  const symOverlays = useMemo<CoordOverlay[]>(() => {
    if (!sym) return [];
    return [
      { kind: 'segment', x1: sym.x2, y1: sym.y, x2: sym.x1, y2: sym.y, dash: '4 3', color: 'var(--accent)', opacity: 0.7 },
      { kind: 'rightAngle', x: sym.axisX, y: sym.y, ux: -1, uy: 0, vx: 0, vy: 1, size: 7, color: 'var(--muted)' },
    ];
  }, [sym]);

  // Manim 式标注：对称轴虚线 + 顶点（随参数实时移动）；a = 0 退化为直线时不标
  const markers = useMemo<CoordMarker[]>(() => {
    if (!vertex) return [];
    const r1 = (v: number) => mathMinus(String(Math.round(v * 10) / 10 || 0));
    const vh = vertex.h;
    const vk = vertex.k;
    const marks: CoordMarker[] = [
      { key: 'axis', vline: { x: vh, label: `x=${r1(vh)}`, color: 'var(--accent)', labelPlace: Math.abs(vh) < 0.6 ? 'bottom' : 'top', noLine: Math.abs(vh) < 0.6 } },
      // 顶点/交点的文字一律落在「开口的反方向」：开口向下（a<0）标在上方，开口向上标在下方。
      // 若统一放右上，开口向下时文字正好落在抛物线内侧、被曲线横穿（实测 a=-2,b=0,c=-4）。
      {
        key: 'vertex',
        dot: { x: vh, y: vk, label: `(${r1(vh)}, ${r1(vk)})`, color: 'var(--accent)', place: a < 0 ? 'above' : 'below' },
      },
    ];
    // 与 x 轴交点：Δ=b²−4ac ≥ 0 才有实根（Δ<0 由核返回空数组，绝不产生 NaN 坐标）
    for (const [i, root] of quadraticRoots(eff.a, eff.b, eff.c).entries()) {
      // 重根与顶点重合时只保留顶点标签，避免 (0,0) 双层文字重叠。
      if (Math.abs(root - vh) < 0.02 && Math.abs(vk) < 0.02) continue;
      marks.push({
        key: `root${i}`,
        // 交点文字朝**外侧**（远离对称轴）：标注若朝内，会沿抛物线内侧延伸、被曲线擦过
        dot: {
          x: root, y: 0, label: `(${r1(root)}, 0)`, color: 'var(--muted)',
          place: a < 0 ? 'above' : 'below',
          side: root < vh ? 'left' : 'right',
        },
      });
    }
    if (sym) {
      marks.push(
        { key: 'symL', dot: { x: sym.x2, y: sym.y, label: 'P′', color: 'var(--accent)', place: a < 0 ? 'above' : 'below', side: 'left' } },
        { key: 'symR', dot: { x: sym.x1, y: sym.y, label: 'P', color: 'var(--accent)', place: a < 0 ? 'above' : 'below', side: 'right' } },
      );
    }
    if (form === 'vertex') {
      marks.push({ key: 'locus', hline: { y: vk, label: `y=${r1(vk)}`, color: 'var(--muted)' } });
    }
    return marks;
  }, [eff, a, vertex, sym, form]);

  /** 手动缩放：以视窗中心为锚点；只允许有限范围，防止学生把坐标轴缩到不可读 */
  const zoomView = (factor: number) => {
    setView((v) => {
      const cx = (v.xMin + v.xMax) / 2;
      const cy = (v.yMin + v.yMax) / 2;
      const spanX = Math.min(VIEW_MAX_SPAN, Math.max(VIEW_MIN_SPAN, (v.xMax - v.xMin) * factor));
      const spanY = Math.min(VIEW_MAX_SPAN, Math.max(VIEW_MIN_SPAN, (v.yMax - v.yMin) * factor));
      return { xMin: cx - spanX / 2, xMax: cx + spanX / 2, yMin: cy - spanY / 2, yMax: cy + spanY / 2 };
    });
  };
  const resetView = () => setView({ ...DEFAULT_VIEW });
  const sheetZoomBy = (factor: number) => {
    setSheetView((v) => ({ ...v, zoom: Math.min(2.6, Math.max(0.45, v.zoom * factor)) }));
  };
  const sheetReset = () => setSheetView({ cx: 0, cy: -1, zoom: 1 });
  const onSheetPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    sheetPanRef.current = { x: e.clientX, y: e.clientY, cx: sheetView.cx, cy: sheetView.cy };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onSheetPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = sheetPanRef.current;
    if (!p || !(e.buttons & 1)) return;
    const scale = 64 * sheetView.zoom;
    setSheetView((v) => ({ ...v, cx: p.cx - (e.clientX - p.x) / scale, cy: p.cy + (e.clientY - p.y) / scale }));
  };
  const onSheetPointerUp = () => { sheetPanRef.current = null; };
  const onSheetWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    sheetZoomBy(e.deltaY < 0 ? 1.08 : 0.92);
  };
  /** 桌面画布：滚轮缩放 + 空白处拖拽平移（不影响画布内按钮/滑块） */
  const onCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDesktop || (e.target as HTMLElement).closest('button,input,label,summary,details')) return;
    canvasPanRef.current = { x: e.clientX, y: e.clientY, view };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onCanvasPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = canvasPanRef.current;
    if (!start || !(e.buttons & 1)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = rect.width / Math.max(1e-9, start.view.xMax - start.view.xMin);
    const scaleY = rect.height / Math.max(1e-9, start.view.yMax - start.view.yMin);
    const dx = (e.clientX - start.x) / scaleX;
    const dy = (e.clientY - start.y) / scaleY;
    setView({
      xMin: start.view.xMin - dx,
      xMax: start.view.xMax - dx,
      yMin: start.view.yMin + dy,
      yMax: start.view.yMax + dy,
    });
  };
  const onCanvasPointerUp = () => { canvasPanRef.current = null; };
  useEffect(() => {
    if (!isDesktop) return;
    const el = canvasRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomView(e.deltaY < 0 ? 0.9 : 1.1);
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [isDesktop]);

  const reset = () => {
    applyGeneral(TARGET_A, TARGET_B, TARGET_C);
  };

  const redoAll = () => {
    setStage('predict');
    setPredOpen(null);
    setPredVertex(null);
    setPredIntercept(null);
    setRevealed(false);
    setForm('general');
    reset();
    setPinned([]);
    setObservations([]);
    setGuessH('');
    setGuessK('');
    setShowGuides(true);
    setConclusion({ q1: null, q2: null, q3: null, q4: null });
  };

  const reveal = () => {
    setRevealed(true);
    setStage('explore');
  };

  const addObservation = (note: string) => {
    setObservations((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        snapshot:
          form === 'vertex'
            ? [
                { label: 'a', value: String(a) },
                { label: 'h', value: String(h) },
                { label: 'k', value: String(k) },
                { label: 'f(x)', value: vertexExprOf(a, h, k) },
              ]
            : [
                { label: 'a', value: String(a) },
                { label: 'b', value: String(b) },
                { label: 'c', value: String(c) },
                { label: 'f(x)', value: exprOf(eff.a, eff.b, eff.c) },
              ],
        note,
      },
    ]);
  };

  const cards: ExploreCard[] =
    form === 'vertex'
      ? [
          {
            key: 'card-h',
            title: t.cardsVertex[0].title,
            prompt: t.cardsVertex[0].prompt,
            tryLabel: t.tryLabel,
            tryIt: () => applyVertex(1, 2, 0),
          },
          {
            key: 'card-k',
            title: t.cardsVertex[1].title,
            prompt: t.cardsVertex[1].prompt,
            tryLabel: t.tryLabel,
            tryIt: () => applyVertex(1, 0, 3),
          },
          {
            key: 'card-a2',
            title: t.cardsVertex[2].title,
            prompt: t.cardsVertex[2].prompt,
            tryLabel: t.tryLabel,
            tryIt: () => applyVertex(-2, 0, 0),
          },
          {
            key: 'card-free',
            title: t.cardsVertex[3].title,
            prompt: t.cardsVertex[3].prompt,
            tryLabel: t.tryLabel,
            tryIt: () => applyVertex(1, 0, 0),
          },
        ]
      : [
          {
            key: 'card-a',
            title: t.cards[0].title,
            prompt: t.cards[0].prompt,
            tryLabel: t.tryLabel,
            tryIt: () => applyGeneral(2, 0, 0),
          },
          {
            key: 'card-b',
            title: t.cards[1].title,
            prompt: t.cards[1].prompt,
            tryLabel: t.tryLabel,
            tryIt: () => applyGeneral(1, 2, 0),
          },
          {
            key: 'card-c',
            title: t.cards[2].title,
            prompt: t.cards[2].prompt,
            tryLabel: t.tryLabel,
            tryIt: () => applyGeneral(1, 0, 3),
          },
          {
            key: 'card-free',
            title: t.cards[3].title,
            prompt: t.cards[3].prompt,
            tryLabel: t.tryLabel,
            tryIt: reset,
          },
        ];

  /** 系数相等（顶点式展开会引入浮点尾巴，钉住判定必须容差比较） */
  const sameCoef = (x: number, y: number) => Math.abs(x - y) < 1e-9;
  const isPinned = pinned.some((p) => sameCoef(p.a, eff.a) && sameCoef(p.b, eff.b) && sameCoef(p.c, eff.c));

  const stageOrder: Stage[] = ['predict', 'explore', 'conclude'];
  const stageIdx = stageOrder.indexOf(stage);

  /** 顶点坐标文本（一位小数，规避 -0） */
  const hText = mathMinus(String(Math.round(h * 10) / 10 || 0));
  const kText = mathMinus(String(Math.round(k * 10) / 10 || 0));

  /* 猜想顶点对照：实际顶点由 eff 的 b、a 算出（两种写法共用），学生填的 (h, k) 与之比差 */
  const guessHNum = guessH.trim() === '' ? null : Number(guessH);
  const guessKNum = guessK.trim() === '' ? null : Number(guessK);
  const guessValid =
    guessHNum !== null && guessKNum !== null && Number.isFinite(guessHNum) && Number.isFinite(guessKNum);
  const safeA = Math.abs(eff.a) > 1e-9 ? eff.a : 1;
  const vAxis = -eff.b / (2 * safeA);
  const vPeak = safeA * vAxis * vAxis + eff.b * vAxis + eff.c;
  const dGuessH = guessValid ? (guessHNum as number) - vAxis : 0;
  const dGuessK = guessValid ? (guessKNum as number) - vPeak : 0;
  const guessOk = guessValid && Math.abs(dGuessH) < 0.1 && Math.abs(dGuessK) < 0.1;
  const f2 = (v: number) => mathMinus(v.toFixed(2));
  const signed = (v: number) => (v > 0 ? '+' : '') + mathMinus(v.toFixed(2));

  const targetCurve: CoordCurve = {
    id: 'target',
    points: sampleQuadratic(TARGET_A, TARGET_B, TARGET_C),
    label: exprOf(TARGET_A, TARGET_B, TARGET_C),
  };

  // AI：实时状态登记（当前阶段 + 生效的 a/b/c），供系统提示词与「问 AI」动态问句读取。
  // 用 eff 而不是 form 里的 h/k：两种写法共用同一套系数，AI 读到的永远是画布上的那条线。
  useEffect(() => {
    setLabState('quadratic', {
      stage,
      a: eff.a,
      b: eff.b,
      c: eff.c,
      revealed,
      ...(vertex ? { vertexH: vertex.h, vertexK: vertex.k } : {}),
    });
  }, [stage, eff, vertex, revealed]);
  // 页面级「问 AI」问句：登记到页级注册表，点击页头入口时取用
  useEffect(() => {
    setPageQuestion('quadratic', lang === 'zh' ? '改变 a、b、c 时，抛物线的开口、顶点和对称轴怎样变化？你观察到什么规律？' : 'As you change a, b and c, how do the opening, vertex and axis of symmetry change? What pattern do you observe?');
  }, [lang]);

  return (
    <MathCanvasStage
      variant={isDesktop ? 'sheet' : 'default'}
      title={lang === 'zh' ? '二次函数' : 'Quadratic'}
      grade={lang === 'zh' ? '7-9 年级' : 'Grades 7-9'}
      backHref="/subject/math"
      backLabel={lang === 'zh' ? '返回数学' : 'Back to Math'}
      labId="quadratic"
      aiQuestion={lang === 'zh' ? '改变 a、b、c 时，抛物线的开口、顶点和对称轴怎样变化？你观察到什么规律？' : 'As you change a, b and c, how do the opening, vertex and axis of symmetry change? What pattern do you observe?'}
      icon={<ParabolaIcon className="h-4 w-4" aria-hidden="true" />}
      shareTitle={lang === 'zh' ? '二次函数 · 数理化数字实验室' : 'Quadratic · STEM Digital Lab'}
      shareText={lang === 'zh' ? '探究二次函数 y=ax²+bx+c 的图像与 a、b、c 的关系' : 'Explore how a, b, c affect the graph of y=ax²+bx+c'}
      center={
        <StageNav
          stage={stage}
          setStage={setStage}
          stageOrder={stageOrder}
          labels={{
            predict: t.stagePredict,
            explore: t.stageExplore,
            conclude: t.stageConclude,
            next: t.nextStage,
            redo: t.redoLabel,
          }}
          onRedo={redoAll}
          isDone={{
            predict: predComplete,
            explore: observations.length > 0,
            conclude: conclusionComplete,
          }}
        />
      }
    >
    <div className="flex flex-col space-y-4 lg:contents">

      {/* 移动端幕导航：桌面已移入 MathCanvasStage 一字页头中央 */}
      <div className="lg:hidden">
      <StageNav
        stage={stage}
        setStage={setStage}
        stageOrder={stageOrder}
        labels={{
          predict: t.stagePredict,
          explore: t.stageExplore,
          conclude: t.stageConclude,
          next: t.nextStage,
          redo: t.redoLabel,
        }}
        onRedo={redoAll}
        isDone={{
          predict: predComplete,
          explore: observations.length > 0,
          conclude: conclusionComplete,
        }}
      />
      </div>
      <div className="grid items-start gap-5 lg:contents lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* 左列：坐标系（预测幕未揭示时隐藏）+ 读数 */}
        <div ref={planeRef} className={`flex flex-col space-y-3 lg:absolute lg:inset-y-0 lg:left-0 lg:z-0 lg:block lg:space-y-0 ${stage === 'conclude' ? 'lg:right-[460px] xl:right-[500px]' : inspectorOpen && stage === 'explore' ? 'lg:right-[330px]' : 'lg:right-0'}`}>
          <div
            ref={canvasRef}
            className="relative overflow-hidden border border-[var(--border)] bg-[var(--card-bg)] lg:h-full lg:border-0 lg:bg-transparent"
            style={{ touchAction: isDesktop ? 'none' : undefined }}
            onPointerDown={onCanvasPointerDown}
            onPointerMove={onCanvasPointerMove}
            onPointerUp={onCanvasPointerUp}
            onPointerCancel={onCanvasPointerUp}
          >
            {/* 画布顶栏：解析式 + 基准图例 + 辅助线 + 手动视口控制；桌面内嵌为画布角标，避免额外占高 */}
            <div data-lab-toolbar="true" className={`flex flex-col gap-1 border-b border-[var(--border)] px-3 py-1 lg:absolute lg:inset-x-0 lg:top-0 lg:z-20 lg:flex lg:h-10 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-2 lg:rounded-none lg:border-0 lg:border-b lg:border-[var(--border)] lg:bg-[var(--card-bg)] lg:px-3 lg:py-0 lg:shadow-none lg:backdrop-blur-none ${stage === 'predict' && !revealed ? 'lg:hidden' : ''}`}>
              <div className="flex w-full min-w-0 items-baseline gap-x-2 gap-y-0.5 overflow-hidden lg:flex-1">
                <span className="hidden shrink-0 text-[0.5625rem] font-bold uppercase tracking-widest text-[var(--muted)] mono-font sm:inline lg:hidden">
                  // {t.readout}
                </span>
                <span className="min-w-0 truncate text-sm text-[var(--fg)]">
                  <Formula tex={texExpr(form === 'vertex' ? vertexExprOf(a, h, k) : exprOf(eff.a, eff.b, eff.c))} />
                </span>
                <span className="hidden shrink-0 items-center gap-1 text-[0.5625rem] mono-font text-[var(--muted)] lg:inline-flex">
                  <span aria-hidden="true">--</span><Formula tex={texExpr(baseCurve.label ?? '')} className="text-[0.6875rem]" />
                </span>
              </div>
              <div className="flex w-full items-center gap-1 lg:w-auto lg:shrink-0">
                <button
                  type="button"
                  onClick={() => zoomView(1.25)}
                  aria-label={lang === 'zh' ? '缩小视口' : 'Zoom out'}
                  title={lang === 'zh' ? '缩小视口' : 'Zoom out'}
                  className="compact inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)]"
                >
                  <Minus className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => zoomView(0.8)}
                  aria-label={lang === 'zh' ? '放大视口' : 'Zoom in'}
                  title={lang === 'zh' ? '放大视口' : 'Zoom in'}
                  className="compact inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)]"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={resetView}
                  aria-label={lang === 'zh' ? '重置视口' : 'Reset view'}
                  title={lang === 'zh' ? '重置视口' : 'Reset view'}
                  className="compact inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)]"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                </button>
                <ToggleSwitch label={t.guides} checked={showGuides} onChange={setShowGuides} compact />
                {!inspectorOpen && stage !== 'predict' && stage !== 'conclude' && (
                  <button type="button" onClick={() => setInspectorOpen(true)} aria-label={lang === 'zh' ? '参数' : 'Parameters'} className="ml-1 inline-flex h-7 items-center rounded border border-[var(--border)] px-2 text-[0.5625rem] mono-font text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)]">
                    « {lang === 'zh' ? '参数' : 'Parameters'}
                  </button>
                )}
              </div>
            </div>

            {stage === 'predict' && !revealed ? (
              <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 p-4 sm:p-6 lg:hidden">
                <p className="text-[0.6875rem] mono-font uppercase tracking-widest text-[var(--muted)]">
                  {t.predictTitle}
                </p>
                <p className="text-sm serif-font text-[var(--fg)]">
                  {t.predictQuestion} <Formula tex={`y = ${TARGET_A}x^2 + ${TARGET_C}`} />
                </p>
                <p className="text-xs text-[var(--muted)] serif-font italic">{t.predictQuestion2}</p>
              </div>
            ) : null}
            <div className={`${stage === 'predict' && !revealed ? 'hidden lg:block' : 'block'} lg:absolute lg:inset-x-0 lg:top-10 lg:bottom-11 lg:h-auto`}>
              <CoordPlane
                curves={stage === 'predict' && !revealed ? [] : curves}
                markers={stage === 'predict' && !revealed ? [] : (showGuides ? markers : [])}
                overlays={stage === 'predict' && !revealed ? [] : (showGuides ? symOverlays : [])}
                xMin={view.xMin}
                xMax={view.xMax}
                yMin={view.yMin}
                yMax={view.yMax}
                ariaLabel={`y = ax² + bx + c graph`}
                xLabel="x"
                yLabel="y"
                framed={false}
                viewWidth={isDesktop ? 920 : 640}
                viewHeight={isDesktop ? 620 : 380}
                fillContainer={isDesktop}
                originXRatio={isDesktop ? 0.5 : undefined}
                bleed={isDesktop}
                showLegend={false}
                clipContent={isDesktop}
                squareGrid={isDesktop}
                maxHeightClass={isDesktop ? 'lg:h-full lg:max-h-none min-h-[280px]' : 'max-h-[min(56vh,520px)] min-h-[280px]'}
              />
            </div>

            {/* 画布底栏：猜想顶点单行条（不单独占卡） */}
            {Math.abs(eff.a) > 1e-9 && stage !== 'conclude' && (
              <div
                className={`flex min-h-[44px] flex-wrap items-center gap-x-2 gap-y-1 border-t border-[var(--border)] px-3 py-0.5 lg:absolute lg:inset-x-0 lg:bottom-0 lg:h-11 lg:z-20 lg:rounded-none lg:border-0 lg:border-t lg:border-[var(--border)] lg:bg-[var(--card-bg)] lg:px-3 lg:shadow-none lg:backdrop-blur-none ${stage === 'predict' && !revealed ? 'lg:hidden' : ''}`}
                title={guessValid ? `h: ${f2(guessHNum as number)} / ${f2(vAxis)} / ${signed(dGuessH)}; k: ${f2(guessKNum as number)} / ${f2(vPeak)} / ${signed(dGuessK)}` : t.guessHint}
              >
                <div className="flex shrink-0 items-baseline gap-2">
                  <h3 className="shrink-0 text-[0.6875rem] font-bold uppercase tracking-widest text-[var(--muted)] mono-font">
                    // {t.guessTitle}
                  </h3>
                  <span className="sr-only">{t.guessHint}</span>
                </div>
                <div className="ml-auto flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:justify-end">
                  <label className="flex items-center gap-1 text-[0.625rem] mono-font text-[var(--muted)]">
                    h
                    <input
                      type="number"
                      step="0.1"
                      inputMode="decimal"
                      value={guessH}
                      onChange={(e) => setGuessH(e.target.value)}
                      aria-label={t.guessH}
                      className="min-h-[40px] w-16 rounded border border-[var(--border)] bg-transparent px-1.5 text-center text-xs mono-font tabular-nums text-[var(--fg)] focus:border-[var(--fg)] focus:outline-none"
                    />
                  </label>
                  <label className="flex items-center gap-1 text-[0.625rem] mono-font text-[var(--muted)]">
                    k
                    <input
                      type="number"
                      step="0.1"
                      inputMode="decimal"
                      value={guessK}
                      onChange={(e) => setGuessK(e.target.value)}
                      aria-label={t.guessK}
                      className="min-h-[40px] w-16 rounded border border-[var(--border)] bg-transparent px-1.5 text-center text-xs mono-font tabular-nums text-[var(--fg)] focus:border-[var(--fg)] focus:outline-none"
                    />
                  </label>
                  {guessValid ? (
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 text-[0.625rem] mono-font ${guessOk ? 'font-semibold text-[var(--fg)]' : 'text-[var(--muted)]'}`}
                      aria-live="polite"
                    >
                      {guessOk ? CHECK_ICON : X_ICON}
                      <span className="hidden sm:inline">{guessOk ? t.guessRight : t.guessWrong}</span>
                      <span className="tabular-nums">Δ {signed(dGuessH)} / {signed(dGuessK)}</span>
                    </span>
                  ) : (
                    <span className="hidden shrink-0 text-[0.625rem] mono-font text-[var(--muted)] sm:inline">{t.guessEmpty}</span>
                  )}
                </div>
              </div>
            )}
            {/* 桌面左下视口缩放组 */}
            <div className="hidden">
              <button type="button" onClick={() => zoomView(1.25)} aria-label={lang === 'zh' ? '缩小视口' : 'Zoom out'} title={lang === 'zh' ? '缩小视口' : 'Zoom out'} className="inline-flex h-9 w-9 items-center justify-center rounded text-[var(--muted)] hover:bg-[var(--accent-light)] hover:text-[var(--fg)]">
                <Minus className="h-4 w-4" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => zoomView(0.8)} aria-label={lang === 'zh' ? '放大视口' : 'Zoom in'} title={lang === 'zh' ? '放大视口' : 'Zoom in'} className="inline-flex h-9 w-9 items-center justify-center rounded text-[var(--muted)] hover:bg-[var(--accent-light)] hover:text-[var(--fg)]">
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
              <button type="button" onClick={resetView} aria-label={lang === 'zh' ? '重置视口' : 'Reset view'} title={lang === 'zh' ? '重置视口' : 'Reset view'} className="inline-flex h-9 w-9 items-center justify-center rounded text-[var(--muted)] hover:bg-[var(--accent-light)] hover:text-[var(--fg)]">
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        {/* 右列：参数 + 三幕 */}
        <div className="flex flex-col space-y-4 lg:contents">
          {/* 参数卡：窄屏收进底部抽屉，桌面变右侧悬浮控制台 */}
          <div className={`${inspectorOpen && stage !== 'predict' && stage !== 'conclude' ? 'lg:absolute lg:inset-y-0 lg:right-0 lg:z-20 lg:flex lg:w-[330px] lg:flex-col lg:overflow-y-auto lg:border-l lg:border-[var(--border)] lg:bg-[var(--card-bg)] lg:p-3.5 lg:shadow-none' : 'lg:hidden'}`}>
          <div className="hidden items-center justify-between border-b border-[var(--border)] pb-2 lg:flex">
            <span className="text-[0.625rem] font-bold uppercase tracking-widest text-[var(--muted)] mono-font">// {lang === 'zh' ? '参数' : 'PARAMETERS'}</span>
            <button type="button" onClick={() => setInspectorOpen(false)} aria-label={lang === 'zh' ? '收起参数' : 'Collapse parameters'} className="inline-flex h-8 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded border border-[var(--border)] px-2 text-[0.5625rem] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)]">
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
              <span>{lang === 'zh' ? '收起' : 'Collapse'}</span>
            </button>
          </div>
          <ParamDock
            title={t.paramDock}
            closeLabel={t.paramDockClose}
            anchorRef={planeRef}
            summary={form === 'vertex' ? vertexExprOf(a, h, k) : exprOf(eff.a, eff.b, eff.c)}
          >
          <div className="border border-[var(--border)] p-4 space-y-4 lg:border-0 lg:p-0">
            <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase lg:hidden">
              // {t.params}
            </h3>
            {/* 写法切换：一般式 ↔ 顶点式（同一条抛物线，切换不成像跳变） */}
            <div className="grid grid-cols-2 gap-2" role="group" aria-label={t.formHint}>
              {(
                [
                  ['general', t.formGeneral, t.formGeneralExpr],
                  ['vertex', t.formVertex, t.formVertexExpr],
                ] as ['general' | 'vertex', string, string][]
              ).map(([v, label, tex]) => {
                // a = 0 时直线没有顶点式：禁用按钮，而不是切过去把图像压成 y=0
                const vertexUnavailable = v === 'vertex' && !canUseVertexForm;
                return (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={form === v}
                    disabled={vertexUnavailable}
                    title={vertexUnavailable ? t.vertexDisabled : undefined}
                    onClick={() => switchForm(v)}
                    className={`min-h-[44px] rounded-lg border px-2 py-1.5 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      form === v
                        ? 'border-[var(--fg)] bg-[var(--accent-light)] text-[var(--fg)]'
                        : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                    }`}
                  >
                    <span className="block text-xs font-semibold">{label}</span>
                    <span className="mt-0.5 block text-[0.625rem] mono-font opacity-80">{tex}</span>
                  </button>
                );
              })}
            </div>
            {!canUseVertexForm && (
              <p className="text-[0.6875rem] mono-font text-[var(--muted)] leading-relaxed">{t.vertexDisabled}</p>
            )}
            {form === 'general' ? (
              <>
                <ParamSlider label="a" value={a} min={-5} max={5} step={0.1} onChange={setA} format={(v) => mathMinus(v.toFixed(1))} />
                <ParamSlider label="b" value={b} min={-6} max={6} step={0.1} onChange={setB} format={(v) => mathMinus(v.toFixed(1))} />
                <ParamSlider label="c" value={c} min={-6} max={6} step={0.1} onChange={setC} format={(v) => mathMinus(v.toFixed(1))} />
              </>
            ) : (
              <>
                <ParamSlider label="a" value={a} min={-5} max={5} step={0.1} onChange={setVertexA} format={(v) => mathMinus(v.toFixed(1))} />
                <ParamSlider label="h" value={h} min={-4} max={4} step={0.1} onChange={setVertexH} format={(v) => mathMinus(v.toFixed(1))} />
                <ParamSlider label="k" value={k} min={-6} max={6} step={0.1} onChange={setVertexK} format={(v) => mathMinus(v.toFixed(1))} />
                <p className="text-[0.6875rem] mono-font text-[var(--muted)] leading-relaxed">{t.vertexRule}</p>
              </>
            )}
            <details
              className="border-t border-[var(--border)] pt-1.5"
              title={t.translateHint}
              open={translateOpen}
              onToggle={(e) => setTranslateOpen(e.currentTarget.open)}
            >
              <summary className="flex min-h-[40px] cursor-pointer list-none items-center justify-between gap-2 text-[0.625rem] font-bold uppercase tracking-widest text-[var(--muted)] mono-font [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block text-[0.625rem] transition-transform duration-150"
                    style={{ transform: translateOpen ? 'rotate(90deg)' : 'none' }}
                    aria-hidden="true"
                  >▸</span>
                  // {t.translateTitle}
                </span>
                <span className="shrink-0 text-[0.5625rem] font-normal normal-case tracking-normal">{lang === 'zh' ? '3 步' : '3 steps'}</span>
              </summary>
              <div className="flex flex-wrap gap-1 pt-1">
                {TRANSLATE_STEPS.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => applyGeneral(s.a, s.b, s.c)}
                    title={lang === 'zh' ? s.zh : s.en}
                    className={`min-h-[40px] px-2 py-1 text-[0.625rem] mono-font border transition-colors ${
                      sameCoef(eff.a, s.a) && sameCoef(eff.b, s.b) && sameCoef(eff.c, s.c)
                        ? 'border-[var(--fg)] bg-[var(--accent-light)] text-[var(--fg)]'
                        : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)]'
                    }`}
                  >
                    {lang === 'zh' ? s.shortZh : s.shortEn}
                  </button>
                ))}
              </div>
            </details>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-2">
              <button
                type="button"
                onClick={reset}
                className="compact inline-flex items-center rounded px-1.5 py-1 text-xs mono-font uppercase text-[var(--muted)] hover:text-[var(--fg)] active:bg-[var(--accent-light)] transition-colors tap-area"
              >
                {t.reset}
              </button>
              <div className="flex flex-wrap items-center gap-1.5">
                {pinned.length > 0 && (
                  <span className="text-[0.625rem] mono-font text-[var(--muted)]">{t.pinnedCount(pinned.length)}</span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (isPinned) {
                      setPinned((prev) => prev.filter((p) => !(sameCoef(p.a, eff.a) && sameCoef(p.b, eff.b) && sameCoef(p.c, eff.c))));
                    } else {
                      setPinned((prev) => [...prev, { id: prev.length + 1, a: eff.a, b: eff.b, c: eff.c }]);
                    }
                  }}
                  aria-pressed={isPinned}
                  className={`compact inline-flex min-h-[32px] items-center gap-1 rounded px-2 py-1 text-[0.625rem] mono-font leading-5 transition-colors ${
                    isPinned
                      ? 'border border-[var(--fg)] bg-[var(--accent-light)] text-[var(--fg)]'
                      : 'border border-[var(--fg)] text-[var(--fg)] hover:bg-[var(--accent-light)]'
                  }`}
                >
                  <Pin
                    className="h-3.5 w-3.5 shrink-0 transition-transform duration-150"
                    style={{ transform: isPinned ? 'rotate(-45deg)' : 'none' }}
                    fill={isPinned ? 'currentColor' : 'none'}
                    aria-hidden="true"
                  /> {isPinned ? t.unpinLabel : t.pinLabel}
                </button>
                {pinned.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPinned([])}
                    aria-label={t.clearPinned}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--accent-light)]"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
                <EngineBadge kind={engineKind} title={getEngineTooltip(engineKind, 'formulas', lang)} />
              </div>
              {pinned.length > 0 && (
                <div className="flex flex-wrap gap-1 border-t border-[var(--border)] pt-1.5">
                  {pinned.map((p) => (
                    <span key={p.id} className="inline-flex max-w-full items-center gap-0.5 rounded border border-[var(--border)] bg-[var(--accent-light)]/50 px-1.5 py-0.5 text-[0.5625rem] mono-font text-[var(--muted)]">
                      <span className="truncate">{exprOf(p.a, p.b, p.c)}</span>
                      <button type="button" onClick={() => setPinned((prev) => prev.filter((x) => x.id !== p.id))} aria-label={`${t.unpinLabel} ${exprOf(p.a, p.b, p.c)}`} className="compact -mr-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full hover:bg-[var(--accent-light)] hover:text-[var(--fg)]"><X className="h-2.5 w-2.5" aria-hidden="true" /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 探索任务：默认只露标题，展开后再进入 1~4 任务卡 */}
            {stage === 'explore' && (
              <details
                className="border-t border-[var(--border)] pt-1.5"
                open={exploreOpen}
                onToggle={(e) => setExploreOpen(e.currentTarget.open)}
              >
                <summary className="flex min-h-[40px] cursor-pointer list-none items-center justify-between gap-2 text-[0.625rem] font-bold uppercase tracking-widest text-[var(--muted)] mono-font [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block text-[0.625rem] transition-transform duration-150"
                      style={{ transform: exploreOpen ? 'rotate(90deg)' : 'none' }}
                      aria-hidden="true"
                    >▸</span>
                    // {t.exploreTitle}
                  </span>
                  <span className="shrink-0 text-[0.5625rem] font-normal normal-case tracking-normal">{lang === 'zh' ? `${cards.length} 个任务` : `${cards.length} tasks`}</span>
                </summary>
                <div className="pt-2 [&>div]:border-0 [&>div]:p-0 [&>div>h3]:hidden">
                  <ExploreStage
                    cards={cards}
                    observations={observations}
                    onAddObservation={addObservation}
                    onClearObservations={() => setObservations([])}
                    notePlaceholder={t.notePlaceholder}
                    recordLabel={t.recordLabel}
                    clearLabel={t.clearLabel}
                    emptyLabel={t.exploreEmpty}
                    title={t.exploreTitle}
                    compact
                  />
                </div>
              </details>
            )}
          </div>
          </ParamDock>
          </div>


          <div className={`space-y-4 ${
            stage === 'conclude'
              ? 'lg:absolute lg:inset-y-0 lg:right-0 lg:z-30 lg:flex lg:w-[460px] xl:w-[500px] lg:flex-col lg:overflow-y-auto lg:border-l lg:border-[var(--border)] lg:bg-[var(--card-bg)] lg:p-3.5 xl:p-4'
              : stage === 'explore'
                ? 'lg:hidden'
                : 'lg:absolute lg:inset-0 lg:z-30 lg:flex lg:items-center lg:justify-center lg:p-4 lg:pointer-events-none [&>*]:lg:pointer-events-auto'
          }`}>
          {/* 幕1 预测 */}
          {stage === 'predict' && (
            <div className="border border-[var(--border)] p-4 space-y-4 lg:max-h-[calc(100%-2rem)] lg:w-full lg:max-w-xl lg:overflow-y-auto lg:rounded-2xl lg:border lg:bg-[var(--card-bg)]/95 lg:p-6 lg:shadow-lg lg:backdrop-blur-md">
              <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
                // {t.predictTitle}
              </h3>
              <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">
                {t.predictQuestion} <Formula tex={`y = ${TARGET_A}x^2 + ${TARGET_C}`} />
              </p>

              {/* 开口方向 */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.predictQ1}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(
                    [
                      ['up', t.predictUp],
                      ['down', t.predictDown],
                    ] as [PredictOpen, string][]
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setPredOpen(v)}
                      className={`text-center text-xs px-3 py-2 border rounded-lg transition-colors min-h-[44px] whitespace-normal break-words leading-snug ${
                        predOpen === v ? 'border-[var(--fg)] bg-[var(--accent-light)] font-semibold text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 顶点 */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.predictQ2}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(
                    [
                      ['max', t.predictMax],
                      ['min', t.predictMin],
                    ] as [PredictVertex, string][]
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setPredVertex(v)}
                      className={`text-center text-xs px-3 py-2 border rounded-lg transition-colors min-h-[44px] whitespace-normal break-words leading-snug ${
                        predVertex === v ? 'border-[var(--fg)] bg-[var(--accent-light)] font-semibold text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 与 y 轴交点 */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.predictQ3}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(
                    [
                      ['pos', t.predictPos],
                      ['neg', t.predictNeg],
                      ['zero', t.predictZero],
                    ] as [PredictIntercept, string][]
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setPredIntercept(v)}
                      className={`text-center text-xs px-3 py-2 border rounded-lg transition-colors min-h-[44px] whitespace-normal break-words leading-snug ${
                        predIntercept === v ? 'border-[var(--fg)] bg-[var(--accent-light)] font-semibold text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {predComplete ? (
                <button
                  type="button"
                  onClick={reveal}
                  className="text-xs mono-font px-3 py-1.5 border border-[var(--fg)] text-[var(--fg)] hover:bg-[var(--accent-light)] transition-colors"
                >
                  {CHECK_ICON} {t.predictDone} — {t.revealLabel}
                </button>
              ) : (
                <p className="text-xs text-[var(--muted)] serif-font italic">{t.predictHint}</p>
              )}
            </div>
          )}

          {/* 幕3 结论（四组选择） */}
          {stage === 'conclude' && (
            <div className="border border-[var(--border)] p-4 space-y-4 lg:max-h-[calc(100%-2rem)] lg:w-full lg:max-w-none lg:overflow-y-auto lg:rounded-2xl lg:border lg:bg-[var(--card-bg)]/95 lg:p-6 lg:shadow-lg lg:backdrop-blur-md">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
                  // {t.concludeTitle}
                </h3>
                <button type="button" onClick={() => setStage('explore')} className="hidden shrink-0 items-center rounded border border-[var(--border)] px-2 py-1 text-[0.5625rem] mono-font text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)] lg:inline-flex">
                  « {lang === 'zh' ? '返回探索调参' : 'Back to Explore'}
                </button>
              </div>
              <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">{t.concludeQuestion}</p>

              {/* 软引导：预测未完成时提示（不硬锁，仍可作答） */}
              {!predComplete && (
                <p className="text-xs text-[var(--muted)] serif-font italic border-l-2 border-[var(--border)] pl-2">
                  {t.concludeSkipHint}
                </p>
              )}
              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.concludeQ1}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(
                    [
                      ['down', t.concludeQ1Down],
                      ['none', t.concludeQ1None],
                      ['up', t.concludeQ1Up],] as ['up' | 'down' | 'none', string][]
                  ).map(([v, label]) => {
                    const selected = conclusion.q1 === v;
                    const correct = correctKeys.q1.includes(v);
                    const showFeedback = conclusion.q1 !== null;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setConclusion((p) => ({ ...p, q1: v }))}
                        className={`text-center text-xs px-2.5 py-2 border rounded-lg transition-colors min-h-[44px] whitespace-normal break-words leading-snug ${
                          selected
                            ? correct
                              ? 'border-[var(--fg)] bg-[var(--accent-light)] font-semibold text-[var(--fg)]'
                              : 'border-[var(--error)] text-[var(--error)]'
                            : showFeedback && correct
                              ? 'border-[var(--muted)] text-[var(--muted)]'
                              : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                        }`}
                      >
                        {selected && (correct ? CHECK_ICON : X_ICON)}
                        {showFeedback && !selected && correct && CHECK_ICON}
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Q2: |a| */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.concludeQ2}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(
                    [
                      ['narrow', t.concludeQ2Narrow],
                      ['wide', t.concludeQ2Wide],
                      ['none', t.concludeQ2None],] as ['narrow' | 'wide' | 'none', string][]
                  ).map(([v, label]) => {
                    const selected = conclusion.q2 === v;
                    const correct = correctKeys.q2.includes(v);
                    const showFeedback = conclusion.q2 !== null;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setConclusion((p) => ({ ...p, q2: v }))}
                        className={`text-center text-xs px-2.5 py-2 border rounded-lg transition-colors min-h-[44px] whitespace-normal break-words leading-snug ${
                          selected
                            ? correct
                              ? 'border-[var(--fg)] bg-[var(--accent-light)] font-semibold text-[var(--fg)]'
                              : 'border-[var(--error)] text-[var(--error)]'
                            : showFeedback && correct
                              ? 'border-[var(--muted)] text-[var(--muted)]'
                              : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                        }`}
                      >
                        {selected && (correct ? CHECK_ICON : X_ICON)}
                        {showFeedback && !selected && correct && CHECK_ICON}
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Q3: b */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.concludeQ3}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(
                    [
                      ['none', t.concludeQ3None],
                      ['shift', t.concludeQ3Shift],
                      ['stretch', t.concludeQ3Stretch],] as ['shift' | 'stretch' | 'none', string][]
                  ).map(([v, label]) => {
                    const selected = conclusion.q3 === v;
                    const correct = correctKeys.q3.includes(v);
                    const showFeedback = conclusion.q3 !== null;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setConclusion((p) => ({ ...p, q3: v }))}
                        className={`text-center text-xs px-2.5 py-2 border rounded-lg transition-colors min-h-[44px] whitespace-normal break-words leading-snug ${
                          selected
                            ? correct
                              ? 'border-[var(--fg)] bg-[var(--accent-light)] font-semibold text-[var(--fg)]'
                              : 'border-[var(--error)] text-[var(--error)]'
                            : showFeedback && correct
                              ? 'border-[var(--muted)] text-[var(--muted)]'
                              : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                        }`}
                      >
                        {selected && (correct ? CHECK_ICON : X_ICON)}
                        {showFeedback && !selected && correct && CHECK_ICON}
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Q4: c */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.concludeQ4}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(
                    [
                      ['vertex', t.concludeQ4Vertex],
                      ['none', t.concludeQ4None],
                      ['intercept', t.concludeQ4Intercept],] as ['intercept' | 'vertex' | 'none', string][]
                  ).map(([v, label]) => {
                    const selected = conclusion.q4 === v;
                    const correct = correctKeys.q4.includes(v);
                    const showFeedback = conclusion.q4 !== null;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setConclusion((p) => ({ ...p, q4: v }))}
                        className={`text-center text-xs px-2.5 py-2 border rounded-lg transition-colors min-h-[44px] whitespace-normal break-words leading-snug ${
                          selected
                            ? correct
                              ? 'border-[var(--fg)] bg-[var(--accent-light)] font-semibold text-[var(--fg)]'
                              : 'border-[var(--error)] text-[var(--error)]'
                            : showFeedback && correct
                              ? 'border-[var(--muted)] text-[var(--muted)]'
                              : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                        }`}
                      >
                        {selected && (correct ? CHECK_ICON : X_ICON)}
                        {showFeedback && !selected && correct && CHECK_ICON}
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {conclusionComplete ? (
                <p className="text-xs mono-font flex items-center gap-1 text-[var(--fg)]">{CHECK_ICON} {t.concludeHint}</p>
              ) : (
                <p className="text-xs text-[var(--muted)] serif-font italic">{t.concludeHint}</p>
              )}
            </div>
          )}

          {/* 完成态 */}
          {stage === 'conclude' && conclusionComplete && (
            <div className="border border-[var(--fg)] p-4 space-y-2 lg:max-h-none lg:w-full lg:max-w-none lg:rounded-xl lg:border lg:bg-[var(--card-bg)]/95 lg:shadow-sm lg:backdrop-blur-md">
              <p className="text-sm font-bold mono-font flex items-center gap-1 text-[var(--fg)]">{CHECK_ICON} {t.stageDone}</p>
              <p className="text-xs text-[var(--muted)] serif-font leading-relaxed">{t.feedbackText}</p>
              <button
                type="button"
                onClick={redoAll}
                className="group inline-flex items-center gap-1.5 text-xs mono-font uppercase text-[var(--fg)] hover:opacity-70"
              >
                <RotateCcw className="w-3.5 h-3.5 opacity-70 group-hover:rotate-[-45deg] transition-transform duration-[var(--dur-base)]" />
                <span>{t.redoLabel}</span>
              </button>
            </div>
          )}

          {/* 考点速记（深化记忆，言简意赅） */}
          {stage === 'conclude' && conclusionComplete && (
            <div className="border border-[var(--border)] p-4 space-y-2">
              <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
                // {t.tipsTitle}
              </h3>
              <ul className="space-y-1.5">
                {t.tips.map((tip, i) => (
                  <li key={i} className="text-xs text-[var(--fg)] serif-font leading-relaxed flex gap-2">
                    <span className="text-[var(--muted)] mono-font shrink-0">{i + 1}.</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
    </MathCanvasStage>
  );
}

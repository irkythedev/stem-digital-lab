/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 数学实验 · 一次函数 y = kx + b 三幕式探究（苏科版 八上）
 *
 * 幕 1 预测：给定 y = 2x - 3，先猜图像形状 / 与 y 轴交点，再揭示
 * 幕 2 探索：控制变量卡（k 斜率 / b 截距 / 特殊点 / 实际建模）+ 钉住曲线 + 观察笔记
 * 幕 3 结论：k 决定倾斜方向与陡缓，b 决定与 y 轴交点
 *
 * 复用组件：CoordPlane、ExploreStage、LabIcon（一次函数用直线图标）。
 */
import { useMemo, useState } from 'react';
import { useApp } from '../../lib/app-context';
import ParamSlider from '../../components/lab/ParamSlider';
import CoordPlane, { type CoordCurve } from '../../components/lab/CoordPlane';
import ExploreStage, { type Observation, type ExploreCard } from '../../components/lab/ExploreStage';
import Formula from '../../components/ui/Formula';

type Stage = 'predict' | 'explore' | 'conclude';

/** 预测题：图像倾斜方向 */
type PredictSlope = 'up' | 'down' | 'flat' | null;
type PredictIntercept = 'pos' | 'neg' | 'zero' | null;

/** 采样一次函数：x ∈ [-4, 4]，y = kx + b */
function sampleLinear(k: number, b: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let x = -4; x <= 4.0001; x += 0.05) {
    pts.push([x, k * x + b]);
  }
  return pts;
}

/** 拉平表达式为 "y = kx + b" */
function exprOf(k: number, b: number): string {
  if (k === 0) return `y = ${b}`;
  const kPart = k === 1 ? 'x' : k === -1 ? '-x' : `${k}x`;
  if (b === 0) return `y = ${kPart}`;
  return `y = ${kPart} ${b > 0 ? `+ ${b}` : `- ${Math.abs(b)}`}`;
}

const copy = {
  zh: {
    prompt: '先预测，再自由探索，最后自己下结论。每一步都可以来回调整。',
    params: '参数',
    readout: '当前函数',
    reset: '重置',
    stagePredict: '预测',
    stageExplore: '探索',
    stageConclude: '结论',
    stageDone: '完成',
    nextStage: '下一步 →',
    redoLabel: '再次实验',
    // 幕1 预测
    predictTitle: '预测',
    predictQuestion: '看这个函数：',
    predictQuestion2: '先别急着看图像，猜一猜：',
    predictQ1: '图像从左到右是上升还是下降？',
    predictUp: '上升（k > 0）',
    predictDown: '下降（k < 0）',
    predictFlat: '水平（k = 0）',
    predictQ2: '图像与 y 轴的交点在？',
    predictInterceptPos: '正半轴（0 上方）',
    predictInterceptNeg: '负半轴（0 下方）',
    predictInterceptZero: '正好在原点',
    predictDone: '已记录你的预测',
    predictHint: '两个都猜完，就可以揭示图像',
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
    pinnedEmpty: '（未钉住。钉住不同 k 的直线，看倾斜变化）',
    cards: [
      {
        title: 'k 的魔法（斜率）',
        prompt: '固定 b=0，只改 k：k 从 1 变 2，直线变陡还是变缓？k 变负数呢？',
      },
      {
        title: 'b 的平移（截距）',
        prompt: '固定 k=1，只改 b：b 从 0 变 3，直线往哪移？与 y 轴交点怎么变？',
      },
      {
        title: '特殊点',
        prompt: '设 k=2、b=-3，看与 y 轴交点是不是 (0,-3)？x=1 时 y 是多少？',
      },
      {
        title: '实际建模',
        prompt: '出租车起步价 8 元（含 2km），之后每 km 2.5 元。费用 y 与里程 x 的关系是 y = 2.5x + 3（超过 2km 部分）。调 k、b 匹配这条线。',
      },
    ],
    // 幕3 结论
    concludeTitle: '结论',
    concludeQuestion: '综合你的探索，k 和 b 各自起什么作用？',
    concludeQ1: 'k 决定：',
    concludeQ1Slope: '直线的倾斜方向与陡缓',
    concludeQ1Shift: '直线的上下平移',
    concludeQ1None: '没有作用',
    concludeQ2: 'b 决定：',
    concludeQ2Intercept: '与 y 轴的交点 (0, b)',
    concludeQ2Slope: '直线的倾斜程度',
    concludeQ2None: '没有作用',
    concludeQ3: '|k| 越大：',
    concludeQ3Steep: '直线越陡',
    concludeQ3Flat: '直线越平缓',
    concludeQ3None: '无影响',
    concludeQ4: 'k > 0 时图像：',
    concludeQ4Up: '从左到右上升（增函数）',
    concludeQ4Down: '从左到右下降（减函数）',
    concludeQ4None: '无规律',
    concludeHint: '选完四个，看看结论和你的观察是否一致',
    feedbackText:
      '一次函数 y = kx + b：k 是斜率，决定直线的倾斜方向（k>0 上升、k<0 下降）与陡缓（|k| 越大越陡）；' +
      'b 是截距，决定直线与 y 轴的交点 (0, b)。实际问题中 k 常表示单位变化量、b 表示初始值。',
    concludeSkipHint: '还没在预测幕猜过倾斜方向——建议先回预测幕完成预测，再做结论会更有意义。',
    tipsTitle: '考点速记',
    tips: [
      '一次函数 y=kx+b：k 是斜率决定倾斜方向与陡缓，b 是截距决定与 y 轴交点 (0,b)。',
      'k>0 图像从左到右上升（增函数），k<0 下降（减函数）。',
      '实际问题中 k 常表示单位变化量（如每 km 单价），b 表示初始值（如起步价）。',
      '两条直线平行 ⇔ k 相等；重合 ⇔ k、b 都相等。',
      '求交点：令两函数值相等解方程；求与坐标轴交点：令 x=0 或 y=0。',
    ],
  },
  en: {
    prompt: 'Predict first, explore freely, then draw your own conclusion. You can move back and forth at any time.',
    params: 'Parameters',
    readout: 'Current function',
    reset: 'Reset',
    stagePredict: 'Predict',
    stageExplore: 'Explore',
    stageConclude: 'Conclude',
    stageDone: 'Done',
    nextStage: 'Next →',
    redoLabel: 'Redo',
    predictTitle: 'Predict',
    predictQuestion: 'Look at this function:',
    predictQuestion2: 'Before seeing the graph, guess:',
    predictQ1: 'Does the line rise or fall from left to right?',
    predictUp: 'Rises (k > 0)',
    predictDown: 'Falls (k < 0)',
    predictFlat: 'Horizontal (k = 0)',
    predictQ2: 'Where does the line cross the y-axis?',
    predictInterceptPos: 'Above 0 (positive)',
    predictInterceptNeg: 'Below 0 (negative)',
    predictInterceptZero: 'At the origin',
    predictDone: 'Your prediction is recorded',
    predictHint: 'Answer both to reveal the graph',
    revealLabel: 'Reveal graph →',
    exploreTitle: 'Explore',
    exploreEmpty: 'No observations yet. Drag the sliders or try a card, and note what you see.',
    notePlaceholder: 'Write one sentence: what did you observe?',
    recordLabel: 'Note it',
    clearLabel: 'Clear notes',
    tryLabel: 'Try it',
    pinLabel: 'Pin this line',
    unpinLabel: 'Unpin',
    pinnedTitle: 'Pinned lines',
    pinnedEmpty: '(nothing pinned — pin lines with different k and watch the slope change)',
    cards: [
      {
        title: 'k: the slope',
        prompt: 'Fix b=0 and change only k: from 1 to 2, does the line get steeper or flatter? What if k goes negative?',
      },
      {
        title: 'b: the intercept',
        prompt: 'Fix k=1 and change only b: from 0 to 3, which way does the line move? Where does it cross the y-axis?',
      },
      {
        title: 'Special points',
        prompt: 'Set k=2, b=-3. Does the line cross the y-axis at (0,-3)? What is y when x=1?',
      },
      {
        title: 'Real-world model',
        prompt: 'A taxi charges 8 yuan for the first 2 km, then 2.5 yuan per km. The fare y vs distance x is y = 2.5x + 3 (beyond 2 km). Match k and b to this line.',
      },
    ],
    concludeTitle: 'Conclude',
    concludeQuestion: 'Based on your exploration, what do k and b do?',
    concludeQ1: 'k decides:',
    concludeQ1Slope: 'the slope direction and steepness',
    concludeQ1Shift: 'vertical shift of the line',
    concludeQ1None: 'nothing',
    concludeQ2: 'b decides:',
    concludeQ2Intercept: 'the y-intercept (0, b)',
    concludeQ2Slope: 'the steepness',
    concludeQ2None: 'nothing',
    concludeQ3: 'Larger |k| makes the line:',
    concludeQ3Steep: 'steeper',
    concludeQ3Flat: 'flatter',
    concludeQ3None: 'no effect',
    concludeQ4: 'When k > 0, the graph:',
    concludeQ4Up: 'rises left to right (increasing)',
    concludeQ4Down: 'falls left to right (decreasing)',
    concludeQ4None: 'no pattern',
    concludeHint: 'Answer all four, then see if your conclusion matches your observations',
    feedbackText:
      'For y = kx + b: k is the slope — it decides the direction (k>0 rises, k<0 falls) and steepness (larger |k|, steeper); ' +
      'b is the intercept — it decides where the line crosses the y-axis at (0, b). In real problems, k is often the rate of change and b the initial value.',
    concludeSkipHint: "You haven't predicted the slope direction yet — go back to the Predict stage first.",
    tipsTitle: 'Key Points',
    tips: [
      'Linear functions y=kx+b: k is the slope (direction & steepness), b is the y-intercept (0,b).',
      'k>0: rises left-to-right (increasing); k<0: falls (decreasing).',
      'In real problems k is often the unit rate (e.g. price per km), b the initial value (e.g. base fare).',
      'Two lines are parallel iff k is equal; identical iff k and b are both equal.',
      'To find intersections: set the two functions equal; for axis intercepts set x=0 or y=0.',
    ],
  },
};

/** 预测目标函数：y = 2x - 3（上升、截距 -3） */
const TARGET_K = 2;
const TARGET_B = -3;

export default function Linear() {
  const { lang } = useApp();
  const t = copy[lang];

  const [stage, setStage] = useState<Stage>('predict');
  const [predSlope, setPredSlope] = useState<PredictSlope>(null);
  const [predIntercept, setPredIntercept] = useState<PredictIntercept>(null);
  const [revealed, setRevealed] = useState(false);
  const [k, setK] = useState(TARGET_K);
  const [b, setB] = useState(TARGET_B);
  const [pinned, setPinned] = useState<{ id: number; k: number; b: number }[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [conclusion, setConclusion] = useState<{
    q1: 'slope' | 'shift' | 'none' | null;
    q2: 'intercept' | 'slope' | 'none' | null;
    q3: 'steep' | 'flat' | 'none' | null;
    q4: 'up' | 'down' | 'none' | null;
  }>({ q1: null, q2: null, q3: null, q4: null });

  const correctKeys = { q1: 'slope', q2: 'intercept', q3: 'steep', q4: 'up' } as const;
  const conclusionComplete =
    conclusion.q1 !== null && conclusion.q2 !== null && conclusion.q3 !== null && conclusion.q4 !== null;
  const predComplete = predSlope !== null && predIntercept !== null;

  const currentCurve: CoordCurve = useMemo(
    () => ({
      id: 'main',
      points: sampleLinear(k, b),
      label: exprOf(k, b),
    }),
    [k, b],
  );

  const pinnedCurves: CoordCurve[] = pinned.map((p) => ({
    id: `pin${p.id}`,
    points: sampleLinear(p.k, p.b),
    dashed: true,
    label: exprOf(p.k, p.b),
  }));

  const curves = [currentCurve, ...pinnedCurves];

  const reset = () => {
    setK(TARGET_K);
    setB(TARGET_B);
  };

  const redoAll = () => {
    setStage('predict');
    setPredSlope(null);
    setRevealed(false);
    setK(TARGET_K);
    setB(TARGET_B);
    setPinned([]);
    setObservations([]);
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
        snapshot: [
          { label: 'k', value: String(k) },
          { label: 'b', value: String(b) },
          { label: 'f(x)', value: exprOf(k, b) },
        ],
        note,
      },
    ]);
  };

  const cards: ExploreCard[] = [
    {
      key: 'card-k',
      title: t.cards[0].title,
      prompt: t.cards[0].prompt,
      tryLabel: t.tryLabel,
      tryIt: () => {
        setK(2);
        setB(0);
      },
    },
    {
      key: 'card-b',
      title: t.cards[1].title,
      prompt: t.cards[1].prompt,
      tryLabel: t.tryLabel,
      tryIt: () => {
        setK(1);
        setB(3);
      },
    },
    {
      key: 'card-point',
      title: t.cards[2].title,
      prompt: t.cards[2].prompt,
      tryLabel: t.tryLabel,
      tryIt: () => {
        setK(2);
        setB(-3);
      },
    },
    {
      key: 'card-model',
      title: t.cards[3].title,
      prompt: t.cards[3].prompt,
      tryLabel: t.tryLabel,
      tryIt: () => {
        setK(2.5);
        setB(3);
      },
    },
  ];

  const isPinned = pinned.some((p) => p.k === k && p.b === b);

  const stageOrder: Stage[] = ['predict', 'explore', 'conclude'];
  const stageIdx = stageOrder.indexOf(stage);

  return (
    <div className="flex flex-col space-y-6">
      <p className="text-sm text-[var(--muted)] serif-font italic leading-relaxed">{t.prompt}</p>

      <div className="flex justify-center py-2">
        <Formula tex="y = kx + b" block className="text-lg" />
      </div>

      {/* 幕导航 */}
      <div className="flex items-center gap-2 text-[11px] mono-font uppercase tracking-widest text-[var(--muted)]">
        {stageOrder.map((s, i) => (
          <span key={s} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden="true">/</span>}
            <button
              type="button"
              onClick={() => setStage(s)}
              className={`transition-colors ${stage === s ? 'font-bold text-[var(--fg)]' : 'hover:text-[var(--fg)]'}`}
            >
              {s === 'predict' && t.stagePredict}
              {s === 'explore' && t.stageExplore}
              {s === 'conclude' && t.stageConclude}
            </button>
          </span>
        ))}
        <span className="ml-auto">
          {stageIdx < 2 ? (
            <button
              type="button"
              onClick={() => setStage(stageOrder[stageIdx + 1])}
              className="underline text-[var(--fg)] hover:opacity-70"
            >
              {t.nextStage}
            </button>
          ) : (
            <button
              type="button"
              onClick={redoAll}
              className="underline text-[var(--muted)] hover:text-[var(--fg)]"
            >
              {t.redoLabel} ↻
            </button>
          )}
        </span>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
        {/* 左列：坐标系 + 读数 */}
        <div className="flex flex-col space-y-6">
          {stage === 'predict' && !revealed ? (
            <div className="border border-[var(--border)] p-6 flex flex-col items-center justify-center min-h-[240px] gap-2">
              <p className="text-[11px] mono-font uppercase tracking-widest text-[var(--muted)]">
                {t.predictTitle}
              </p>
              <p className="text-sm serif-font text-[var(--fg)]">
                {t.predictQuestion} <Formula tex={`y = ${TARGET_K}x ${TARGET_B < 0 ? '-' : '+'} ${Math.abs(TARGET_B)}`} />
              </p>
              <p className="text-xs text-[var(--muted)] serif-font italic">{t.predictQuestion2}</p>
            </div>
          ) : (
            <CoordPlane curves={curves} xMin={-4} xMax={4} ariaLabel={`y = kx + b graph`} xLabel="x" yLabel="y" />
          )}

          <div className="border border-[var(--border)] p-4">
            <h3 className="text-[11px] font-bold tracking-widest text-[var(--muted)] mono-font uppercase mb-2">
              // {t.readout}
            </h3>
            <p className="text-sm mono-font text-[var(--fg)]">{exprOf(k, b)}</p>
          </div>
        </div>

        {/* 右列：参数 + 三幕 */}
        <div className="flex flex-col space-y-6">
          <div className="border border-[var(--border)] p-4 space-y-4">
            <h3 className="text-[11px] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
              // {t.params}
            </h3>
            <ParamSlider label="k" value={k} min={-3} max={3} step={0.1} onChange={setK} format={(v) => v.toFixed(1)} />
            <ParamSlider label="b" value={b} min={-5} max={5} step={0.1} onChange={setB} format={(v) => v.toFixed(1)} />
            <button
              type="button"
              onClick={reset}
              className="text-xs mono-font uppercase underline text-[var(--muted)] hover:text-[var(--fg)]"
            >
              {t.reset}
            </button>
          </div>

          {/* 幕1 预测 */}
          {stage === 'predict' && (
            <div className="border border-[var(--border)] p-4 space-y-4">
              <h3 className="text-[11px] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
                // {t.predictTitle}
              </h3>
              <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">
                {t.predictQuestion} <Formula tex={`y = ${TARGET_K}x ${TARGET_B < 0 ? '-' : '+'} ${Math.abs(TARGET_B)}`} />
              </p>

              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.predictQ1}</p>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ['up', t.predictUp],
                      ['down', t.predictDown],
                      ['flat', t.predictFlat],
                    ] as [PredictSlope, string][]
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setPredSlope(v)}
                      className={`text-left text-xs px-2 py-1.5 border transition-colors ${
                        predSlope === v ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.predictQ2}</p>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ['pos', t.predictInterceptPos],
                      ['neg', t.predictInterceptNeg],
                      ['zero', t.predictInterceptZero],
                    ] as [PredictIntercept, string][]
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setPredIntercept(v)}
                      className={`text-left text-xs px-2 py-1.5 border transition-colors ${
                        predIntercept === v ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
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
                  ✓ {t.predictDone} — {t.revealLabel}
                </button>
              ) : (
                <p className="text-xs text-[var(--muted)] serif-font italic">{t.predictHint}</p>
              )}
            </div>
          )}

          {/* 幕2 探索 */}
          {stage === 'explore' && (
            <div className="space-y-6">
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
              />

              {/* 钉住曲线对比 */}
              <div className="border border-[var(--border)] p-4 space-y-3">
                <h3 className="text-[11px] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
                  // {t.pinnedTitle}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    if (isPinned) {
                      setPinned((prev) => prev.filter((p) => !(p.k === k && p.b === b)));
                    } else {
                      setPinned((prev) => [...prev, { id: prev.length + 1, k, b }]);
                    }
                  }}
                  className={`text-xs mono-font px-2 py-1 border transition-colors ${
                    isPinned
                      ? 'border-[var(--muted)] text-[var(--muted)]'
                      : 'border-[var(--fg)] text-[var(--fg)] hover:bg-[var(--accent-light)]'
                  }`}
                >
                  {isPinned ? t.unpinLabel : t.pinLabel}
                </button>
                {pinned.length === 0 ? (
                  <p className="text-xs text-[var(--muted)] serif-font italic">{t.pinnedEmpty}</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {pinned.map((p) => (
                      <span key={p.id} className="text-[11px] mono-font px-1.5 py-0.5 border border-[var(--border)] text-[var(--muted)]">
                        {exprOf(p.k, p.b)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 幕3 结论（四组选择） */}
          {stage === 'conclude' && (
            <div className="border border-[var(--border)] p-4 space-y-4">
              <h3 className="text-[11px] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
                // {t.concludeTitle}
              </h3>
              <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">{t.concludeQuestion}</p>

              {!predComplete && (
                <p className="text-xs text-[var(--muted)] serif-font italic border-l-2 border-[var(--border)] pl-2">
                  {t.concludeSkipHint}
                </p>
              )}

              {/* Q1: k */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.concludeQ1}</p>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ['slope', t.concludeQ1Slope],
                      ['shift', t.concludeQ1Shift],
                      ['none', t.concludeQ1None],
                    ] as ['slope' | 'shift' | 'none', string][]
                  ).map(([v, label]) => {
                    const selected = conclusion.q1 === v;
                    const correct = correctKeys.q1 === v;
                    const showFeedback = conclusion.q1 !== null;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setConclusion((p) => ({ ...p, q1: v }))}
                        className={`text-left text-xs px-2 py-1.5 border transition-colors ${
                          selected
                            ? correct
                              ? 'border-[var(--fg)] text-[var(--fg)]'
                              : 'border-[var(--error)] text-[var(--error)]'
                            : showFeedback && correct
                              ? 'border-[var(--muted)] text-[var(--muted)]'
                              : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                        }`}
                      >
                        {selected && (correct ? '✓ ' : '✗ ')}
                        {showFeedback && !selected && correct && '✓ '}
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Q2: b */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.concludeQ2}</p>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ['intercept', t.concludeQ2Intercept],
                      ['slope', t.concludeQ2Slope],
                      ['none', t.concludeQ2None],
                    ] as ['intercept' | 'slope' | 'none', string][]
                  ).map(([v, label]) => {
                    const selected = conclusion.q2 === v;
                    const correct = correctKeys.q2 === v;
                    const showFeedback = conclusion.q2 !== null;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setConclusion((p) => ({ ...p, q2: v }))}
                        className={`text-left text-xs px-2 py-1.5 border transition-colors ${
                          selected
                            ? correct
                              ? 'border-[var(--fg)] text-[var(--fg)]'
                              : 'border-[var(--error)] text-[var(--error)]'
                            : showFeedback && correct
                              ? 'border-[var(--muted)] text-[var(--muted)]'
                              : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                        }`}
                      >
                        {selected && (correct ? '✓ ' : '✗ ')}
                        {showFeedback && !selected && correct && '✓ '}
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Q3: |k| */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.concludeQ3}</p>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ['steep', t.concludeQ3Steep],
                      ['flat', t.concludeQ3Flat],
                      ['none', t.concludeQ3None],
                    ] as ['steep' | 'flat' | 'none', string][]
                  ).map(([v, label]) => {
                    const selected = conclusion.q3 === v;
                    const correct = correctKeys.q3 === v;
                    const showFeedback = conclusion.q3 !== null;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setConclusion((p) => ({ ...p, q3: v }))}
                        className={`text-left text-xs px-2 py-1.5 border transition-colors ${
                          selected
                            ? correct
                              ? 'border-[var(--fg)] text-[var(--fg)]'
                              : 'border-[var(--error)] text-[var(--error)]'
                            : showFeedback && correct
                              ? 'border-[var(--muted)] text-[var(--muted)]'
                              : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                        }`}
                      >
                        {selected && (correct ? '✓ ' : '✗ ')}
                        {showFeedback && !selected && correct && '✓ '}
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Q4: k>0 */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.concludeQ4}</p>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ['up', t.concludeQ4Up],
                      ['down', t.concludeQ4Down],
                      ['none', t.concludeQ4None],
                    ] as ['up' | 'down' | 'none', string][]
                  ).map(([v, label]) => {
                    const selected = conclusion.q4 === v;
                    const correct = correctKeys.q4 === v;
                    const showFeedback = conclusion.q4 !== null;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setConclusion((p) => ({ ...p, q4: v }))}
                        className={`text-left text-xs px-2 py-1.5 border transition-colors ${
                          selected
                            ? correct
                              ? 'border-[var(--fg)] text-[var(--fg)]'
                              : 'border-[var(--error)] text-[var(--error)]'
                            : showFeedback && correct
                              ? 'border-[var(--muted)] text-[var(--muted)]'
                              : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                        }`}
                      >
                        {selected && (correct ? '✓ ' : '✗ ')}
                        {showFeedback && !selected && correct && '✓ '}
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {conclusionComplete ? (
                <p className="text-xs mono-font text-[var(--fg)]">✓ {t.concludeHint}</p>
              ) : (
                <p className="text-xs text-[var(--muted)] serif-font italic">{t.concludeHint}</p>
              )}
            </div>
          )}

          {/* 完成态 */}
          {stage === 'conclude' && conclusionComplete && (
            <div className="border border-[var(--fg)] p-4 space-y-2">
              <p className="text-sm font-bold mono-font text-[var(--fg)]">✓ {t.stageDone}</p>
              <p className="text-xs text-[var(--muted)] serif-font leading-relaxed">{t.feedbackText}</p>
              <button
                type="button"
                onClick={redoAll}
                className="text-xs mono-font uppercase underline text-[var(--fg)] hover:opacity-70"
              >
                {t.redoLabel} ↻
              </button>
            </div>
          )}

          {/* 考点速记（深化记忆，言简意赅） */}
          {stage === 'conclude' && conclusionComplete && (
            <div className="border border-[var(--border)] p-4 space-y-2">
              <h3 className="text-[11px] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
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
  );
}

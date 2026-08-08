/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 数学探究 · 反比例函数 y = k/x 三幕式探究（人教版 八下）
 *
 * 幕 1 预测：给定 y = 4/x，先猜图像所在象限，再揭示图像
 * 幕 2 探索：控制变量卡（k 正负 / |k| 大小 / 特殊点）+ 钉住曲线对比 + 观察笔记
 * 幕 3 结论：学生总结 k 正负、|k| 的作用，对照预测与观察记录
 *
 * 复用组件：CoordPlane（坐标系，segments 绘制双曲线两支）、ExploreStage、LabIcon。
 */
import { useMemo, useState } from 'react';
import { useApp } from '../../lib/app-context';
import ParamSlider from '../../components/lab/ParamSlider';
import CoordPlane, { type CoordCurve } from '../../components/lab/CoordPlane';
import ExploreStage, { type Observation, type ExploreCard } from '../../components/lab/ExploreStage';
import Formula from '../../components/ui/Formula';

type Stage = 'predict' | 'explore' | 'conclude';

/** 预测题：k>0 时图像在哪些象限 */
type PredictQuadrant = 'i-iii' | 'ii-iv' | 'all' | 'none' | null;
type PredictQuadrantNeg = 'i-iii-neg' | 'ii-iv-neg' | 'all-neg' | 'none-neg' | null;

/**
 * 采样反比例函数：x ∈ [-4, 4]，跳过 x=0 邻域，分两支。
 * 第一象限/第三象限（k>0）或第二/第四象限（k<0）。
 */
function sampleInverse(k: number): [number, number][][] {
  // 反比例函数定义 k ≠ 0；k=0 时返回空段（不画任何曲线）
  if (k === 0) return [[], []];
  const neg: [number, number][] = [];
  const pos: [number, number][] = [];
  for (let x = -4; x <= -0.15; x += 0.05) neg.push([x, k / x]);
  for (let x = 0.15; x <= 4.0001; x += 0.05) pos.push([x, k / x]);
  return [neg, pos];
}

const copy = {
  zh: {
    prompt: '先预测，再自由探索，最后自己下结论。每一步都可以来回调整。',
    params: '参数',
    readout: '当前函数',
    reset: '重置',
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
    predictQ1: 'k > 0 时，图像在哪两个象限？',
    predictQ1Iiii: '第一、第三象限',
    predictQ1Iiiv: '第二、第四象限',
    predictQ1All: '四个象限都有',
    predictQ1None: '不经过任何象限',
    predictQ2: 'k < 0 时，图像在哪两个象限？',
    predictQ2Iiii: '第一、第三象限',
    predictQ2Iiiv: '第二、第四象限',
    predictQ2All: '四个象限都有',
    predictQ2None: '不经过任何象限',
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
    pinnedEmpty: '（未钉住。钉住后可与当前曲线对比）',
    cards: [
      {
        title: 'k 的正负（象限）',
        prompt: '固定 k=1 再看 k=-1：图像所在象限变了吗？两支曲线分别在哪？',
      },
      {
        title: '|k| 的大小（远近）',
        prompt: 'k 从 1 变到 4：曲线离原点更近还是更远？形状变了吗？',
      },
      {
        title: '特殊点',
        prompt: 'k=4 时，x=1 对应 y=？x=2 呢？这些点都在曲线上吗？',
      },
      {
        title: '自由探索',
        prompt: '任意调 k（包括小数、负数），钉住几条曲线对比，找找规律。',
      },
    ],
    // 幕3 结论
    concludeTitle: '结论',
    concludeQuestion: '综合你的探索，k 的作用是什么？',
    concludeSkipHint: '还没在预测幕猜过象限分布——建议先回预测幕完成预测，再做结论会更有意义。',
    tipsTitle: '考点速记',
    tips: [
      '反比例函数 y=k/x（k≠0）：k>0 图像在一、三象限，k<0 在二、四象限。',
      '|k| 决定曲线离原点的远近，但形状不变（相似形）。',
      '两支曲线无限接近坐标轴但永不相交（渐近线）。',
      '图像上任意一点向两轴作垂线，与坐标轴围成的矩形面积为 |k|。',
      '反比例与一次函数结合求交点：联立方程求解。',
      '实际应用：压强与受力面积（p=F/S）、电阻与电流（U 固定时 I=U/R）。',
      '功 W 一定时，功率 P=W/t 与时间 t 成反比。',
      '代数推导（象限判定）：y=k/x，k>0 时 x 与 y 同号（同正或同负），故点在一、三象限；k<0 时 x 与 y 异号，在二、四象限。图像上任一点 (x,k/x) 向两轴作垂线，矩形面积 = |x·k/x| = |k|（定值），这是矩形面积为 |k| 的代数依据。',
    ],
    concludeQ1: 'k 的正负决定：',
    concludeQ1Quad: '图像所在象限',
    concludeQ1Shape: '曲线形状',
    concludeQ1None: '没有作用',
    concludeQ2: '|k| 越大：',
    concludeQ2Near: '曲线离原点越近',
    concludeQ2Far: '曲线离原点越远',
    concludeQ2None: '无影响',
    concludeQ3: '|k| 变化时曲线形状：',
    concludeQ3Same: '不变（相似形）',
    concludeQ3Diff: '改变',
    concludeQ3None: '无影响',
    concludeQ4: '图像与坐标轴：',
    concludeQ4NoCross: '永不相交（无限接近）',
    concludeQ4Cross: '会相交',
    concludeQ4None: '无影响',
    concludeHint: '选完四个，看看结论和你的观察是否一致',
    feedbackTitle: '反馈',
    feedbackText:
      'k 的正负决定双曲线所在的象限（k>0 在一、三象限，k<0 在二、四象限）；|k| 决定曲线离原点的远近，但形状不变；两支曲线都无限接近坐标轴但永不相交。',
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
    predictQ1: 'When k > 0, which quadrants does the graph occupy?',
    predictQ1Iiii: 'Quadrants I and III',
    predictQ1Iiiv: 'Quadrants II and IV',
    predictQ1All: 'All four quadrants',
    predictQ1None: 'None',
    predictQ2: 'When k < 0, which quadrants does the graph occupy?',
    predictQ2Iiii: 'Quadrants I and III',
    predictQ2Iiiv: 'Quadrants II and IV',
    predictQ2All: 'All four quadrants',
    predictQ2None: 'None',
    predictDone: 'Your prediction is recorded',
    predictHint: 'Answer both to reveal the graph',
    revealLabel: 'Reveal graph →',
    exploreTitle: 'Explore',
    exploreEmpty: 'No observations yet. Drag the slider or try a card, and note what you see.',
    notePlaceholder: 'Write one sentence: what did you observe?',
    recordLabel: 'Note it',
    clearLabel: 'Clear notes',
    tryLabel: 'Try it',
    pinLabel: 'Pin this curve',
    unpinLabel: 'Unpin',
    pinnedTitle: 'Pinned curves',
    pinnedEmpty: '(nothing pinned — pin curves to compare with the current one)',
    cards: [
      {
        title: 'k: the quadrants',
        prompt: 'Look at k=1, then k=-1: do the quadrants change? Where are the two branches?',
      },
      {
        title: '|k|: the distance',
        prompt: 'Change k from 1 to 4: does the curve get closer to or farther from the origin? Does its shape change?',
      },
      {
        title: 'Special points',
        prompt: 'With k=4, what is y when x=1? When x=2? Are these points on the curve?',
      },
      {
        title: 'Free exploration',
        prompt: 'Try any k (decimals, negatives), pin a few curves and look for the pattern.',
      },
    ],
    concludeTitle: 'Conclude',
    concludeQuestion: 'Based on your exploration, what does k do?',
    concludeSkipHint: "You haven't predicted the quadrants yet — go back to the Predict stage first.",
    tipsTitle: 'Key Points',
    tips: [
      'Inverse variation y=k/x (k≠0): k>0 in quadrants I & III, k<0 in II & IV.',
      '|k| decides the distance from the origin; the shape stays the same (similar).',
      'The two branches approach the axes infinitely but never cross them (asymptotes).',
      'The rectangle formed by any point and the axes has area |k|.',
      'To find intersections with a linear function, solve the equations together.',
      'For fixed work W, power P=W/t is inversely proportional to time t.',
      'Algebraic derivation (quadrant rule): y=k/x. If k>0 then x and y have the same sign, so points lie in quadrants I & III; if k<0 they differ, so II & IV. For any point (x, k/x), the rectangle with the axes has area = |x·k/x| = |k| (constant) — the algebraic basis for the |k| rectangle.',
    ],
    concludeQ1: 'The sign of k decides:',
    concludeQ1Quad: 'which quadrants the graph occupies',
    concludeQ1Shape: 'the shape of the curve',
    concludeQ1None: 'nothing',
    concludeQ2: 'Larger |k|:',
    concludeQ2Near: 'curve closer to the origin',
    concludeQ2Far: 'curve farther from the origin',
    concludeQ2None: 'no effect',
    concludeQ3: 'When |k| changes, the shape:',
    concludeQ3Same: 'stays the same (similar)',
    concludeQ3Diff: 'changes',
    concludeQ3None: 'no effect',
    concludeQ4: 'The graph and the axes:',
    concludeQ4NoCross: 'never intersect (approaches infinitely)',
    concludeQ4Cross: 'do intersect',
    concludeQ4None: 'no effect',
    concludeHint: 'Answer all four, then see if your conclusion matches your observations',
    feedbackTitle: 'Feedback',
    feedbackText:
      'The sign of k decides which quadrants the hyperbola occupies (k>0: I & III, k<0: II & IV); |k| decides how far the curve sits from the origin, but the shape stays the same; both branches approach the axes infinitely but never cross them.',
  },
};

/** 预测目标函数：y = 4/x */
const TARGET_K = 4;

export default function Inverse() {
  const { lang } = useApp();
  const t = copy[lang];

  const [stage, setStage] = useState<Stage>('predict');
  const [predQuadrant, setPredQuadrant] = useState<PredictQuadrant>(null);
  const [predQuadrantNeg, setPredQuadrantNeg] = useState<PredictQuadrantNeg>(null);
  const [revealed, setRevealed] = useState(false);
  const [k, setK] = useState(TARGET_K);
  const [pinned, setPinned] = useState<{ id: number; k: number }[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [conclusion, setConclusion] = useState<{
    q1: 'quad' | 'shape' | 'none' | null;
    q2: 'near' | 'far' | 'none' | null;
    q3: 'same' | 'diff' | 'none' | null;
    q4: 'nocross' | 'cross' | 'none' | null;
  }>({ q1: null, q2: null, q3: null, q4: null });

  const correctKeys = { q1: 'quad', q2: 'far', q3: 'same', q4: 'nocross' } as const;
  const conclusionComplete =
    conclusion.q1 !== null && conclusion.q2 !== null && conclusion.q3 !== null && conclusion.q4 !== null;
  const predComplete = predQuadrant !== null && predQuadrantNeg !== null;

  const currentCurve: CoordCurve = useMemo(
    () => ({
      id: 'main',
      segments: sampleInverse(k),
      label: `y = ${k}/x`,
    }),
    [k],
  );

  const pinnedCurves: CoordCurve[] = pinned.map((p) => ({
    id: `pin${p.id}`,
    segments: sampleInverse(p.k),
    dashed: true,
    label: `y = ${p.k}/x`,
  }));

  const curves = [currentCurve, ...pinnedCurves];

  const reset = () => setK(TARGET_K);

  const redoAll = () => {
    setStage('predict');
    setPredQuadrant(null);
    setRevealed(false);
    setK(TARGET_K);
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
          { label: 'f(x)', value: `${k}/x` },
        ],
        note,
      },
    ]);
  };

  const cards: ExploreCard[] = [
    {
      key: 'card-sign',
      title: t.cards[0].title,
      prompt: t.cards[0].prompt,
      tryLabel: t.tryLabel,
      tryIt: () => setK(-1),
    },
    {
      key: 'card-size',
      title: t.cards[1].title,
      prompt: t.cards[1].prompt,
      tryLabel: t.tryLabel,
      tryIt: () => setK(4),
    },
    {
      key: 'card-points',
      title: t.cards[2].title,
      prompt: t.cards[2].prompt,
      tryLabel: t.tryLabel,
      tryIt: () => setK(4),
    },
    {
      key: 'card-free',
      title: t.cards[3].title,
      prompt: t.cards[3].prompt,
      tryLabel: t.tryLabel,
      tryIt: () => setK(1.5),
    },
  ];

  const isPinned = pinned.some((p) => p.k === k);

  const stageOrder: Stage[] = ['predict', 'explore', 'conclude'];
  const stageIdx = stageOrder.indexOf(stage);

  return (
    <div className="flex flex-col space-y-6">

      <div className="flex justify-center py-2">
        <Formula tex="y = \frac{k}{x}" block className="text-lg" />
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
        {/* 左列：坐标系（预测幕未揭示时隐藏）+ 读数 */}
        <div className="flex flex-col space-y-6">
          {stage === 'predict' && !revealed ? (
            <div className="border border-[var(--border)] p-6 flex flex-col items-center justify-center min-h-[240px] gap-2">
              <p className="text-[11px] mono-font uppercase tracking-widest text-[var(--muted)]">
                {t.predictTitle}
              </p>
              <p className="text-sm serif-font text-[var(--fg)]">
                {t.predictQuestion} <Formula tex={`y = \\frac{${TARGET_K}}{x}`} />
              </p>
              <p className="text-xs text-[var(--muted)] serif-font italic">{t.predictQuestion2}</p>
            </div>
          ) : (
            <CoordPlane curves={curves} xMin={-4} xMax={4} ariaLabel={`y = k/x graph`} xLabel="x" yLabel="y" />
          )}

          <div className="border border-[var(--border)] p-4">
            <h3 className="text-[11px] font-bold tracking-widest text-[var(--muted)] mono-font uppercase mb-2">
              // {t.readout}
            </h3>
            <p className="text-sm mono-font text-[var(--fg)]">y = {k}/x</p>
          </div>
        </div>

        {/* 右列：参数 + 三幕 */}
        <div className="flex flex-col space-y-6">
          <div className="border border-[var(--border)] p-4 space-y-4">
            <h3 className="text-[11px] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
              // {t.params}
            </h3>
            <ParamSlider
              label="k"
              value={k}
              min={-6}
              max={6}
              step={0.1}
              onChange={(v) => setK(v === 0 ? (k > 0 ? 0.1 : -0.1) : v)}
              format={(v) => v.toFixed(1)}
            />
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
                {t.predictQuestion} <Formula tex={`y = \\frac{${TARGET_K}}{x}`} />
              </p>

              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.predictQ1}</p>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ['i-iii', t.predictQ1Iiii],
                      ['ii-iv', t.predictQ1Iiiv],
                      ['all', t.predictQ1All],
                      ['none', t.predictQ1None],
                    ] as [PredictQuadrant, string][]
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setPredQuadrant(v)}
                      className={`text-left text-xs px-2 py-1.5 border transition-colors ${
                        predQuadrant === v ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.predictQ2}</p>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ['ii-iv-neg', t.predictQ2Iiiv],
                      ['i-iii-neg', t.predictQ2Iiii],
                      ['all-neg', t.predictQ2All],
                      ['none-neg', t.predictQ2None],
                    ] as [PredictQuadrantNeg, string][]
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setPredQuadrantNeg(v)}
                      className={`text-left text-xs px-2 py-1.5 border transition-colors ${
                        predQuadrantNeg === v ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
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
                      setPinned((prev) => prev.filter((p) => p.k !== k));
                    } else {
                      setPinned((prev) => [...prev, { id: prev.length + 1, k }]);
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
                        y = {p.k}/x
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

              {/* 软引导：预测未完成时提示（不硬锁，仍可作答） */}
              {!predComplete && (
                <p className="text-xs text-[var(--muted)] serif-font italic border-l-2 border-[var(--border)] pl-2">
                  {t.concludeSkipHint}
                </p>
              )}
              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.concludeQ1}</p>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ['quad', t.concludeQ1Quad],
                      ['shape', t.concludeQ1Shape],
                      ['none', t.concludeQ1None],
                    ] as ['quad' | 'shape' | 'none', string][]
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

              {/* Q2: |k| */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.concludeQ2}</p>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ['near', t.concludeQ2Near],
                      ['far', t.concludeQ2Far],
                      ['none', t.concludeQ2None],
                    ] as ['near' | 'far' | 'none', string][]
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

              {/* Q3: 形状 */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.concludeQ3}</p>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ['same', t.concludeQ3Same],
                      ['diff', t.concludeQ3Diff],
                      ['none', t.concludeQ3None],
                    ] as ['same' | 'diff' | 'none', string][]
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

              {/* Q4: 与坐标轴 */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--fg)] mono-font">{t.concludeQ4}</p>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ['nocross', t.concludeQ4NoCross],
                      ['cross', t.concludeQ4Cross],
                      ['none', t.concludeQ4None],
                    ] as ['nocross' | 'cross' | 'none', string][]
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

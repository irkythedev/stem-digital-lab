/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 数学实验 · 圆的性质探究三幕式（人教版 九上第24章）
 *
 * 幕 1 预测：给定圆 + 弦，猜过圆心作垂线是否平分弦
 * 幕 2 探索：三个任务卡（垂径定理 / 圆周角定理 / 直径对直角）
 *   每卡切换 InteractiveCircle 模式，自由拖拽观察
 * 幕 3 结论：三题结论 + 正误反馈 + 考点速记
 *
 * 复用组件：InteractiveCircle（交互几何 SVG）、ExploreStage（任务卡+笔记）。
 */
import { useMemo, useState } from 'react';
import { useApp } from '../../lib/app-context';
import ExploreStage, { type Observation, type ExploreCard } from '../../components/lab/ExploreStage';
import InteractiveCircle, { type CircleMode } from '../../components/lab/InteractiveCircle';

type Stage = 'predict' | 'explore' | 'conclude';

/** 预测题 */
type PredictBisect = 'yes' | 'no' | 'unsure' | null;

const copy = {
  zh: {
    prompt: '先预测，再自由探索，最后自己下结论。每一步都可以来回调整。',
    reset: '重置',
    stagePredict: '预测',
    stageExplore: '探索',
    stageConclude: '结论',
    stageDone: '完成',
    nextStage: '下一步 →',
    redoLabel: '再次实验',
    // 幕1 预测
    predictTitle: '预测',
    predictQuestion: '在一个圆中画一条弦 AB，过圆心 O 作 AB 的垂线，垂足为 E。',
    predictQuestion2: '先别急着拖拽验证，猜一猜：',
    predictQ1: '垂足 E 与弦 AB 有什么关系？',
    predictYes: 'E 平分弦 AB（AE = EB）',
    predictNo: 'E 不平分弦 AB',
    predictUnsure: '不确定',
    predictDone: '已记录你的预测',
    predictHint: '猜完，就可以进入探索阶段拖拽验证',
    revealLabel: '进入探索 →',
    // 幕2 探索
    exploreTitle: '探索',
    exploreEmpty: '还没有观察记录。切换任务卡、拖拽圆上的点，看到有意思的状态时记一条。',
    notePlaceholder: '写一句话：你观察到了什么？',
    recordLabel: '记一条观察',
    clearLabel: '清空记录',
    tryLabel: '试试这个',
    modeChord: '垂径定理',
    modeInscribed: '圆周角定理',
    modeThales: '直径对直角',
    cards: [
      {
        title: '垂径定理',
        prompt: '拖拽弦 AB 的两个端点，观察垂足 E 是否始终平分弦 AB。AE 和 EB 的长度相等吗？',
      },
      {
        title: '圆周角定理',
        prompt: '拖拽 P 点（圆周上的动点），观察 ∠BPC 的变化。再对比 Q 点的 ∠BQC，它们相等吗？',
      },
      {
        title: '直径对直角',
        prompt: 'AB 是直径，拖拽 C 点（半圆上），观察 ∠ACB 是否始终等于 90°。',
      },
    ],
    // 幕3 结论
    concludeTitle: '结论',
    concludeQuestion: '综合你的探索，圆有哪些重要性质？',
    concludeSkipHint: '还没在预测幕猜过——建议先回预测幕完成预测，再做结论会更有意义。',
    concludeHint: '选完三题，看看结论和你的观察是否一致',
    feedbackText:
      '垂径定理：垂直于弦的直径平分弦（AE = EB）。' +
      '圆周角定理：同弧或等弧所对的圆周角相等（∠BPC = ∠BQC）。' +
      '直径对直角：直径所对的圆周角等于 90°（∠ACB = 90°）。',
    tipsTitle: '考点速记',
    tips: [
      '垂径定理：垂直于弦的直径平分弦，并且平分弦所对的两条弧。',
      '推论：平分弦（不是直径）的直径垂直于弦，并且平分弦所对的两条弧。',
      '圆周角 ∠BPC 与 ∠BQC 共同对着同一条弧 BC，因此两角相等。',
      '圆周角定理：同弧或等弧所对的圆周角相等。',
      '推论 1：半圆（或直径）所对的圆周角是直角。',
      '推论 2：90° 的圆周角所对的弦是直径。',
      '圆内接四边形对角互补。',
    ],
    concludeQ1: '垂直于弦的直径与弦的关系是？',
    concludeQ1Bisect: '平分弦',
    concludeQ1Perp: '垂直于弦（但不一定平分）',
    concludeQ1None: '没有特殊关系',
    concludeQ2: '同弧所对的圆周角？',
    concludeQ2Equal: '相等',
    concludeQ2Sum: '和为 180°',
    concludeQ2Diff: '不一定相等',
    concludeQ3: '直径所对的圆周角等于？',
    concludeQ3_90: '90°',
    concludeQ3_180: '180°',
    concludeQ3_45: '45°',
    // 证明推理引导（乱序步骤，学生按正确逻辑顺序点击）
    proofTitle: '证明推理：试试按正确逻辑顺序排列步骤',
    proofHint: '按逻辑顺序依次点击步骤（每步只能点一次）。排列完成后点「验证」。',
    proofVerify: '验证',
    proofReset: '重排',
    proofCorrect: '✓ 正确！推理步骤逻辑严密，你已经掌握了证明思路。',
    proofWrong: '推理顺序还有误，再想想：哪一步应该在前面？',
    proofChord: {
      title: '证明垂径定理：垂直于弦的直径平分弦',
      steps: [
        '连接 OA、OB（都是半径，OA = OB）',
        'OE ⊥ AB，所以 ∠OEA = ∠OEB = 90°',
        '在 Rt△OEA 和 Rt△OEB 中，OA = OB，OE 公共',
        '由 HL 得 △OEA ≌ △OEB',
        '对应边相等：AE = EB，即直径平分弦',
      ],
    },
    proofInscribed: {
      title: '证明圆周角定理：同弧所对的圆周角相等',
      steps: [
        '设 ∠BPC 与 ∠BQC 都对着弧 BC',
        '同弧 BC 所对的圆心角 ∠BOC 相等',
        '连接 OC：OP = OC（都是半径），所以 ∠OPC = ∠OCP',
        '∠BOC 是 △OPC 的外角，所以 ∠BOC = ∠OPC + ∠OCP = 2∠OPC，即 ∠BPC = ½∠BOC',
        '同理 ∠BQC = ½∠BOC，所以 ∠BPC = ∠BQC',
      ],
    },
    proofThales: {
      title: '证明直径对直角：直径所对的圆周角是 90°',
      steps: [
        'AB 是直径，∠AOB = 180°（平角）',
        'C 是半圆上一点，∠ACB 对着弧 AB（即半圆）',
        '圆周角等于同弧所对圆心角的一半',
        '∠ACB = ½∠AOB = ½ × 180° = 90°',
      ],
    },
  },
  en: {
    prompt: 'Predict first, explore freely, then draw your own conclusion. You can move back and forth at any time.',
    reset: 'Reset',
    stagePredict: 'Predict',
    stageExplore: 'Explore',
    stageConclude: 'Conclude',
    stageDone: 'Done',
    nextStage: 'Next →',
    redoLabel: 'Redo',
    predictTitle: 'Predict',
    predictQuestion: 'In a circle, draw chord AB. Draw a line through center O perpendicular to AB, meeting AB at E.',
    predictQuestion2: 'Before dragging to verify, guess:',
    predictQ1: 'What is the relationship between E and chord AB?',
    predictYes: 'E bisects AB (AE = EB)',
    predictNo: 'E does not bisect AB',
    predictUnsure: 'Not sure',
    predictDone: 'Your prediction is recorded',
    predictHint: 'Make your guess, then enter Explore to verify by dragging',
    revealLabel: 'Enter Explore →',
    exploreTitle: 'Explore',
    exploreEmpty: 'No observations yet. Switch task cards and drag points on the circle, then note what you see.',
    notePlaceholder: 'Write one sentence: what did you observe?',
    recordLabel: 'Note it',
    clearLabel: 'Clear notes',
    tryLabel: 'Try it',
    modeChord: 'Chord Theorem',
    modeInscribed: 'Inscribed Angle',
    modeThales: "Thales' Theorem",
    cards: [
      {
        title: 'Chord Theorem',
        prompt: 'Drag the endpoints of chord AB. Does E always bisect AB? Are AE and EB equal?',
      },
      {
        title: 'Inscribed Angle',
        prompt: 'Drag point P on the circle. How does ∠BPC change? Compare with ∠BQC at point Q — are they equal?',
      },
      {
        title: "Thales' Theorem",
        prompt: 'AB is a diameter. Drag point C on the semicircle. Is ∠ACB always 90°?',
      },
    ],
    concludeTitle: 'Conclude',
    concludeQuestion: 'Based on your exploration, what are the key properties of circles?',
    concludeSkipHint: "You haven't made predictions yet — consider going back to the Predict stage first.",
    concludeHint: 'Answer all three questions, then check if your conclusion matches your observations.',
    feedbackText:
      'Chord theorem: a diameter perpendicular to a chord bisects the chord (AE = EB). ' +
      'Inscribed angle theorem: inscribed angles subtending the same or equal arcs are equal (∠BPC = ∠BQC). ' +
      "Thales' theorem: an angle inscribed in a semicircle is a right angle (∠ACB = 90°).",
    tipsTitle: 'Key Points',
    tips: [
      'Chord theorem: a diameter perpendicular to a chord bisects the chord and its arcs.',
      'Corollary: a diameter that bisects a chord (not a diameter) is perpendicular to it.',
      'Angles ∠BPC and ∠BQC subtend the same arc BC, so they are equal.',
      'Inscribed angle theorem: inscribed angles subtending the same arc are equal.',
      'Corollary 1: an angle inscribed in a semicircle is a right angle.',
      'Corollary 2: a 90° inscribed angle subtends a diameter.',
      'Opposite angles of a cyclic quadrilateral sum to 180°.',
    ],
    concludeQ1: 'A diameter perpendicular to a chord:',
    concludeQ1Bisect: 'Bisects the chord',
    concludeQ1Perp: 'Is perpendicular (but not necessarily bisects)',
    concludeQ1None: 'Has no special relationship',
    concludeQ2: 'Inscribed angles subtending the same arc:',
    concludeQ2Equal: 'Are equal',
    concludeQ2Sum: 'Sum to 180°',
    concludeQ2Diff: 'Are not necessarily equal',
    concludeQ3: 'An angle inscribed in a semicircle equals:',
    concludeQ3_90: '90°',
    concludeQ3_180: '180°',
    concludeQ3_45: '45°',
    // Proof reasoning guide (scrambled steps; tap in logical order)
    proofTitle: 'Proof reasoning: order the steps logically',
    proofHint: 'Tap the steps in logical order (each once). Then tap Verify.',
    proofVerify: 'Verify',
    proofReset: 'Reset',
    proofCorrect: '✓ Correct! The steps follow rigorous logic — you understand the proof idea.',
    proofWrong: 'The order is still off. Think again: which step comes first?',
    proofChord: {
      title: 'Prove: a diameter perpendicular to a chord bisects the chord',
      steps: [
        'Connect OA, OB (both radii, so OA = OB)',
        'OE ⊥ AB, so ∠OEA = ∠OEB = 90°',
        'In Rt△OEA and Rt△OEB, OA = OB, OE is common',
        'By HL, △OEA ≅ △OEB',
        'Corresponding sides equal: AE = EB, so the diameter bisects the chord',
      ],
    },
    proofInscribed: {
      title: 'Prove: inscribed angles subtending the same arc are equal',
      steps: [
        '∠BPC and ∠BQC both subtend arc BC',
        'The central angle ∠BOC subtending arc BC is the same',
        'Connect OC: OP = OC (both radii), so ∠OPC = ∠OCP',
        '∠BOC is an exterior angle of △OPC, so ∠BOC = ∠OPC + ∠OCP = 2∠OPC, i.e. ∠BPC = ½∠BOC',
        'Similarly ∠BQC = ½∠BOC, therefore ∠BPC = ∠BQC',
      ],
    },
    proofThales: {
      title: 'Prove: an angle inscribed in a semicircle is 90°',
      steps: [
        'AB is a diameter, so ∠AOB = 180° (straight angle)',
        'C is on the semicircle, so ∠ACB subtends arc AB (the semicircle)',
        'An inscribed angle equals half the central angle of the same arc',
        '∠ACB = ½∠AOB = ½ × 180° = 90°',
      ],
    },
  },
};

type Lang = 'zh' | 'en';

/** 结论题正确选项 */
const CORRECT_KEYS: Record<string, string[]> = {
  q1: ['bisect'],
  q2: ['equal'],
  q3: ['90'],
};

export default function Circle() {
  const { lang } = useApp();
  const c = copy[lang as Lang] ?? copy.zh;

  const [stage, setStage] = useState<Stage>('predict');
  const [predict, setPredict] = useState<PredictBisect>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [obsId, setObsId] = useState(0);
  const [conclude1, setConclude1] = useState<string | null>(null);
  const [conclude2, setConclude2] = useState<string | null>(null);
  const [conclude3, setConclude3] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  // 证明推理：乱序步骤 + 用户点击顺序 + 验证状态
  const [proofOrder, setProofOrder] = useState<number[]>([]);
  const [proofChecked, setProofChecked] = useState<'correct' | 'wrong' | null>(null);

  // 探索模式
  const [circleMode, setCircleMode] = useState<CircleMode>('chord');
  const [activeCard, setActiveCard] = useState(0);

  const predComplete = predict !== null;
  const concludeComplete = conclude1 && conclude2 && conclude3;

  function redoAll() {
    setStage('predict');
    setPredict(null);
    setObservations([]);
    setObsId(0);
    setConclude1(null);
    setConclude2(null);
    setConclude3(null);
    setShowFeedback(false);
    setProofOrder([]);
    setProofChecked(null);
    setCircleMode('chord');
    setActiveCard(0);
  }

  function addObservation(note: string) {
    const modeLabel =
      circleMode === 'chord'
        ? c.modeChord
        : circleMode === 'inscribed'
          ? c.modeInscribed
          : c.modeThales;
    const snapshot = [{ label: '模式', value: modeLabel }];
    setObservations((prev) => [
      ...prev,
      { id: obsId, snapshot, note },
    ]);
    setObsId((p) => p + 1);
  }

  const cards: ExploreCard[] = useMemo(
    () =>
      c.cards.map((card, i) => ({
        key: card.title,
        title: card.title,
        prompt: card.prompt,
        tryLabel: c.tryLabel,
        tryIt: () => {
          setActiveCard(i);
          if (i === 0) setCircleMode('chord');
          else if (i === 1) setCircleMode('inscribed');
          else setCircleMode('thales');
        },
      })),
    [c],
  );

  /* ── 结论题渲染 ── */

  function renderConcludeQ(
    key: string,
    question: string,
    options: { value: string; label: string }[],
    selected: string | null,
    onSelect: (v: string) => void,
  ) {
    const correctKeys = CORRECT_KEYS[key];
    return (
      <div className="space-y-2">
        <p className="text-sm serif-font text-[var(--fg)]">{question}</p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {options.map((opt) => {
            const isSel = selected === opt.value;
            const isCorrect = correctKeys.includes(opt.value);
            let cls = 'text-left text-sm px-3 py-2 border transition-colors ';
            if (showFeedback) {
              if (isSel && isCorrect) cls += 'border-[var(--fg)] text-[var(--fg)]';
              else if (isSel && !isCorrect) cls += 'border-[var(--error)] text-[var(--error)]';
              else if (!isSel && isCorrect) cls += 'border-[var(--border)] text-[var(--muted)]';
              else cls += 'border-[var(--border)] text-[var(--muted)] opacity-50';
            } else {
              cls += isSel
                ? 'border-[var(--fg)] text-[var(--fg)]'
                : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]';
            }
            const prefix = showFeedback
              ? isCorrect
                ? '✓ '
                : isSel
                  ? '✗ '
                  : ''
              : '';
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onSelect(opt.value)}
                disabled={showFeedback}
                className={`${cls} ${showFeedback ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {prefix}{opt.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── 幕导航 ── */}
      <div className="flex items-center gap-3 text-[11px] mono-font tracking-widest">
        {(['predict', 'explore', 'conclude'] as Stage[]).map((s) => {
          const label =
            s === 'predict'
              ? c.stagePredict
              : s === 'explore'
                ? c.stageExplore
                : c.stageConclude;
          const isDone =
            s === 'predict'
              ? predComplete
              : s === 'explore'
                ? observations.length > 0
                : concludeComplete;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStage(s)}
              className={`px-3 py-1.5 border transition-colors ${
                stage === s
                  ? 'border-[var(--fg)] text-[var(--fg)]'
                  : isDone
                    ? 'border-[var(--border)] text-[var(--muted)]'
                    : 'border-[var(--border)] text-[var(--muted)] opacity-50'
              }`}
            >
              {isDone && stage !== s ? `✓ ${label}` : label}
            </button>
          );
        })}
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={redoAll}
            className="px-3 py-1.5 border border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] transition-colors"
          >
            {c.redoLabel}
          </button>
        </div>
      </div>

      {/* ── 交互圆 ── */}
      <div className="border border-[var(--border)] p-3">
        <InteractiveCircle
          mode={circleMode}
        />
      </div>

      {/* ── 幕内容 ── */}

      {stage === 'predict' && (
        <div className="border border-[var(--border)] p-4 space-y-4">
          <h3 className="text-[11px] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
            // {c.predictTitle}
          </h3>
          <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">
            {c.predictQuestion}
          </p>
          <p className="text-sm serif-font text-[var(--muted)]">
            {c.predictQuestion2}
          </p>

          <div className="space-y-2">
            <p className="text-sm serif-font text-[var(--fg)]">{c.predictQ1}</p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {[
                { value: 'yes', label: c.predictYes },
                { value: 'no', label: c.predictNo },
                { value: 'unsure', label: c.predictUnsure },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPredict(opt.value as PredictBisect)}
                  className={`text-left text-sm px-3 py-2 border transition-colors ${
                    predict === opt.value
                      ? 'border-[var(--fg)] text-[var(--fg)]'
                      : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {predComplete ? (
            <p className="text-sm text-[var(--muted)] serif-font">{c.predictDone}</p>
          ) : (
            <p className="text-sm text-[var(--muted)] serif-font">{c.predictHint}</p>
          )}

          {predComplete && (
            <button
              type="button"
              onClick={() => setStage('explore')}
              className="px-4 py-2 border border-[var(--fg)] text-[var(--fg)] text-sm hover:bg-[var(--fg)] hover:text-[var(--card-bg)] transition-colors"
            >
              {c.revealLabel}
            </button>
          )}
        </div>
      )}

      {stage === 'explore' && (
        <div className="space-y-4">
          {/* 模式切换 */}
          <div className="flex gap-2">
            {(['chord', 'inscribed', 'thales'] as CircleMode[]).map((mode) => {
              const label =
                mode === 'chord'
                  ? c.modeChord
                  : mode === 'inscribed'
                    ? c.modeInscribed
                    : c.modeThales;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setCircleMode(mode);
                    setActiveCard(mode === 'chord' ? 0 : mode === 'inscribed' ? 1 : 2);
                  }}
                  className={`px-3 py-1.5 text-[11px] border transition-colors ${
                    circleMode === mode
                      ? 'border-[var(--fg)] text-[var(--fg)]'
                      : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <ExploreStage
            cards={cards}
            observations={observations}
            onAddObservation={addObservation}
            onClearObservations={() => setObservations([])}
            notePlaceholder={c.notePlaceholder}
            recordLabel={c.recordLabel}
            clearLabel={c.clearLabel}
            emptyLabel={c.exploreEmpty}
            title={c.exploreTitle}
          />
        </div>
      )}

      {stage === 'conclude' && (
        <div className="border border-[var(--border)] p-4 space-y-4">
          <h3 className="text-[11px] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
            // {c.concludeTitle}
          </h3>
          <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">
            {c.concludeQuestion}
          </p>

          {!predComplete && (
            <p className="text-sm text-[var(--accent)] serif-font">{c.concludeSkipHint}</p>
          )}

          {renderConcludeQ(
            'q1',
            c.concludeQ1,
            [
              { value: 'bisect', label: c.concludeQ1Bisect },
              { value: 'perp', label: c.concludeQ1Perp },
              { value: 'none', label: c.concludeQ1None },
            ],
            conclude1,
            setConclude1,
          )}

          {renderConcludeQ(
            'q2',
            c.concludeQ2,
            [
              { value: 'equal', label: c.concludeQ2Equal },
              { value: 'sum', label: c.concludeQ2Sum },
              { value: 'diff', label: c.concludeQ2Diff },
            ],
            conclude2,
            setConclude2,
          )}

          {renderConcludeQ(
            'q3',
            c.concludeQ3,
            [
              { value: '90', label: c.concludeQ3_90 },
              { value: '180', label: c.concludeQ3_180 },
              { value: '45', label: c.concludeQ3_45 },
            ],
            conclude3,
            setConclude3,
          )}

          {!showFeedback && concludeComplete && (
            <button
              type="button"
              onClick={() => setShowFeedback(true)}
              className="px-4 py-2 border border-[var(--fg)] text-[var(--fg)] text-sm hover:bg-[var(--fg)] hover:text-[var(--card-bg)] transition-colors"
            >
              {lang === 'zh' ? '查看反馈' : 'Check answers'}
            </button>
          )}

          {!concludeComplete && (
            <p className="text-sm text-[var(--muted)] serif-font">{c.concludeHint}</p>
          )}

          {showFeedback && (
            <div className="space-y-3 pt-2 border-t border-[var(--border)]">
              <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">
                {c.feedbackText}
              </p>
              <div>
                <h4 className="text-[11px] font-bold tracking-widest text-[var(--muted)] mono-font uppercase mb-2">
                  // {c.tipsTitle}
                </h4>
                <ul className="space-y-1">
                  {c.tips.map((tip, i) => (
                    <li key={i} className="text-sm serif-font text-[var(--fg)] pl-3 border-l border-[var(--border)]">
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>

              {/* 证明推理引导：按正确逻辑顺序排列步骤 */}
              {circleMode && (
                <div className="border border-[var(--border)] p-3 space-y-2">
                  <h4 className="text-[11px] font-bold tracking-widest text-[var(--fg)] mono-font uppercase">
                    // {c.proofTitle}
                  </h4>
                  <p className="text-xs text-[var(--muted)] serif-font italic">{c.proofHint}</p>
                  <p className="text-sm font-semibold serif-font text-[var(--fg)]">
                    {circleMode === 'chord' ? c.proofChord.title : circleMode === 'inscribed' ? c.proofInscribed.title : c.proofThales.title}
                  </p>
                  <div className="space-y-1.5">
                    {(() => {
                      const steps = circleMode === 'chord' ? c.proofChord.steps : circleMode === 'inscribed' ? c.proofInscribed.steps : c.proofThales.steps;
                      // 未点击步骤（乱序展示）
                      const remaining = steps.map((_, i) => i).filter((i) => !proofOrder.includes(i));
                      // 打乱剩余步骤顺序
                      const shuffled = [...remaining].sort(() => Math.random() - 0.5);
                      return (
                        <div className="space-y-1.5">
                          {/* 已选步骤（按顺序显示） */}
                          {proofOrder.map((idx, pos) => (
                            <p key={pos} className="text-xs serif-font text-[var(--fg)] pl-2 border-l-2 border-[var(--fg)]">
                              {pos + 1}. {steps[idx]}
                            </p>
                          ))}
                          {/* 剩余乱序步骤 */}
                          {shuffled.map((idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setProofOrder((prev) => [...prev, idx])}
                              className="block w-full text-left text-xs serif-font px-2 py-1.5 border border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)] transition-colors"
                            >
                              {steps[idx]}
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                  {proofOrder.length === (circleMode === 'chord' ? c.proofChord.steps : circleMode === 'inscribed' ? c.proofInscribed.steps : c.proofThales.steps).length && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const steps = circleMode === 'chord' ? c.proofChord.steps : circleMode === 'inscribed' ? c.proofInscribed.steps : c.proofThales.steps;
                          const correct = steps.length && proofOrder.every((idx, pos) => idx === pos);
                          setProofChecked(correct ? 'correct' : 'wrong');
                        }}
                        className="text-xs mono-font px-3 py-1.5 border border-[var(--fg)] text-[var(--fg)] hover:bg-[var(--accent-light)] transition-colors"
                      >
                        {c.proofVerify}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setProofOrder([]); setProofChecked(null); }}
                        className="text-xs mono-font px-3 py-1.5 border border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)] transition-colors"
                      >
                        {c.proofReset}
                      </button>
                    </div>
                  )}
                  {proofChecked === 'correct' && <p className="text-xs text-[var(--fg)] serif-font">{c.proofCorrect}</p>}
                  {proofChecked === 'wrong' && <p className="text-xs text-[var(--error)] serif-font">{c.proofWrong}</p>}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

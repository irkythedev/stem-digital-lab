/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 物理实验 · 杠杆的平衡条件三幕式探究（苏科版 九上第11章）
 *
 * 幕 1 预测：猜杠杆平衡时 动力×动力臂 与 阻力×阻力臂 的关系
 * 幕 2 探索：可拖拽的钩码/移动支点，观察杠杆平衡
 * 幕 3 结论：F₁l₁ = F₂l₂，省力/费力/等臂杠杆
 *
 * 教材依据：ch11「学生实验 探究杠杆的平衡条件」+ 杠杆原理（阿基米德）
 */
import { useMemo, useState } from 'react';
import AskAiButton from '../../components/ai/AskAiButton';
import { useApp } from '../../lib/app-context';
import ParamSlider from '../../components/lab/ParamSlider';
import ExploreStage, { type Observation, type ExploreCard } from '../../components/lab/ExploreStage';
import Formula from '../../components/ui/Formula';

type Stage = 'predict' | 'explore' | 'conclude';

/** 预测题 */
type PredictQ1 = 'prop' | 'inv' | null;

const copy = {
  zh: {
    prompt: '先预测，再自由探索，最后自己下结论。每一步都可以来回调整。',
    params: '参数', readout: '读数', reset: '重置',
    stagePredict: '预测', stageExplore: '探索', stageConclude: '结论',
    nextStage: '下一步 →', redoLabel: '再次实验',
    predictTitle: '预测',
    predictQuestion: '杠杆平衡时，动力与阻力、动力臂与阻力臂有什么关系？',
    predictQ1: '杠杆平衡时，动力×动力臂 与 阻力×阻力臂 的关系是？',
    predictQ1Prop: '相等（F₁l₁ = F₂l₂）',
    predictQ1Inv: '不相等',
    predictDone: '已记录你的预测', predictHint: '猜完，就可以揭示实验',
    revealLabel: '揭示实验 →',
    exploreTitle: '探索',
    exploreEmpty: '还没有观察记录。拖动钩码或点任务卡，看到杠杆平衡时记一条。',
    notePlaceholder: '写一句话：你观察到了什么？', recordLabel: '记一条观察',
    clearLabel: '清空记录', tryLabel: '试试这个',
    cards: [
      { title: '动力臂大于阻力臂', prompt: '把钩码放远一点，杠杆是否省力？' },
      { title: '动力臂小于阻力臂', prompt: '把钩码放近一点，是否费力？' },
      { title: '等臂杠杆', prompt: '两边钩码位置对称，力相等吗？' },
      { title: '自由探索', prompt: '任意调钩码位置，找平衡条件。' },
    ],
    concludeTitle: '结论',
    concludeQuestion: '综合你的探索，杠杆平衡条件是什么？',
    concludeHint: '选完两题，看看结论和你的观察是否一致',
    feedbackText:
      '杠杆平衡条件：F₁l₁ = F₂l₂（杠杆原理）。当动力臂大于阻力臂时省力，' +
      '动力臂小于阻力臂时费力，动力臂等于阻力臂时为等臂杠杆。' +
      '阿基米德说："给我一个支点，我就能撬动地球"。',
    tipsTitle: '考点速记',
    tips: [
      '杠杆平衡条件：F₁l₁ = F₂l₂',
      '省力杠杆：动力臂 > 阻力臂（如开瓶器）',
      '费力杠杆：动力臂 < 阻力臂（如钓鱼竿）',
      '等臂杠杆：动力臂 = 阻力臂（如托盘天平）',
      '支点：杠杆绕之转动的固定点',
    ],
    concludeQ1: '动力臂大于阻力臂时，杠杆？',
    concludeQ1Save: '省力',
    concludeQ1Cost: '费力',
    concludeQ2: '省力杠杆的例子是？',
    concludeQ2Opener: '开瓶器（省力杠杆）',
    concludeQ2Rod: '钓鱼竿（费力杠杆）',
  },
  en: {
    prompt: 'Predict first, explore freely, then draw your own conclusion. You can move back and forth at any time.',
    params: 'Parameters', readout: 'Readings', reset: 'Reset',
    stagePredict: 'Predict', stageExplore: 'Explore', stageConclude: 'Conclude',
    nextStage: 'Next →', redoLabel: 'Redo',
    predictTitle: 'Predict',
    predictQuestion: 'When a lever balances, how do effort/load and their arms relate?',
    predictQ1: 'When balanced, effort×effort-arm vs load×load-arm?',
    predictQ1Prop: 'Equal (F₁l₁ = F₂l₂)',
    predictQ1Inv: 'Not equal',
    predictDone: 'Your predictions are recorded', predictHint: 'Answer to reveal the experiment',
    revealLabel: 'Reveal experiment →',
    exploreTitle: 'Explore',
    exploreEmpty: 'No observations yet. Drag the masses or try a card, and note when the lever balances.',
    notePlaceholder: 'Write one sentence: what did you observe?', recordLabel: 'Note it',
    clearLabel: 'Clear notes', tryLabel: 'Try it',
    cards: [
      { title: 'Effort arm > load arm', prompt: 'Move the mass farther — is the lever effort-saving?' },
      { title: 'Effort arm < load arm', prompt: 'Move the mass closer — is it effort-requiring?' },
      { title: 'Equal arms', prompt: 'Symmetric masses — are the forces equal?' },
      { title: 'Free exploration', prompt: 'Adjust the masses freely and look for the balance condition.' },
    ],
    concludeTitle: 'Conclude',
    concludeQuestion: 'Based on your exploration, what is the lever balance condition?',
    concludeHint: 'Answer both questions, then check your conclusion.',
    feedbackText:
      'Lever balance condition: F₁l₁ = F₂l₂ (lever principle). When the effort arm is longer, the lever saves effort; ' +
      'when shorter, it requires more effort; when equal, it is a balance lever. ' +
      'Archimedes: "Give me a lever long enough and a fulcrum on which to place it, and I shall move the world."',
    tipsTitle: 'Key Points',
    tips: [
      'Lever balance condition: F₁l₁ = F₂l₂',
      'Effort-saving lever: effort arm > load arm (e.g. bottle opener)',
      'Effort-requiring lever: effort arm < load arm (e.g. fishing rod)',
      'Balance lever: effort arm = load arm (e.g. balance scale)',
      'Fulcrum: the fixed point a lever rotates about',
    ],
    concludeQ1: 'Effort arm > load arm: the lever is?',
    concludeQ1Save: 'effort-saving',
    concludeQ1Cost: 'effort-requiring',
    concludeQ2: 'Example of an effort-saving lever?',
    concludeQ2Opener: 'Bottle opener (effort-saving)',
    concludeQ2Rod: 'Fishing rod (effort-requiring)',
  },
};

type Lang = 'zh' | 'en';

const CORRECT_KEYS: Record<string, string[]> = {
  q1: ['prop'],
  q2: ['save'],
  q3: ['opener'],
};

export default function Lever() {
  const { lang } = useApp();
  const c = copy[lang as Lang] ?? copy.zh;

  const [stage, setStage] = useState<Stage>('predict');
  // 杠杆参数：左侧钩码数 + 位置，右侧钩码数 + 位置（位置 = 距支点的刻度数）
  const [m1, setM1] = useState(2);
  const [d1, setD1] = useState(3);
  const [m2, setM2] = useState(3);
  const [d2, setD2] = useState(2);
  const [predict1, setPredict1] = useState<PredictQ1>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [obsId, setObsId] = useState(0);
  const [concl, setConcl] = useState<{ q1: string | null; q2: string | null; q3: string | null }>({ q1: null, q2: null, q3: null });
  const [showFeedback, setShowFeedback] = useState(false);

  const predComplete = predict1 !== null;
  const concludeComplete = concl.q1 && concl.q2 && concl.q3;

  // 力矩计算：每格钩码产生 F = m × 0.5N，力矩 = F × d
  const torque1 = m1 * 0.5 * d1;
  const torque2 = m2 * 0.5 * d2;
  const isBalanced = Math.abs(torque1 - torque2) < 0.05;

  function redoAll() {
    setStage('predict');
    setM1(2); setD1(3); setM2(3); setD2(2);
    setPredict1(null); setObservations([]); setObsId(0);
    setConcl({ q1: null, q2: null, q3: null }); setShowFeedback(false);
  }

  function addObservation(note: string) {
    setObservations((prev) => [
      ...prev,
      {
        id: obsId,
        balanced: isBalanced,
        snapshot: [
          { label: '左', value: `${m1}×${d1}` },
          { label: '右', value: `${m2}×${d2}` },
          { label: lang === 'zh' ? '状态' : 'State', value: isBalanced ? (lang === 'zh' ? '平衡' : 'balanced') : (lang === 'zh' ? '不平衡' : 'unbalanced') },
        ],
        note,
      },
    ]);
    setObsId((p) => p + 1);
  }

  const cards: ExploreCard[] = useMemo(
    () =>
      c.cards.map((card) => ({
        key: card.title,
        title: card.title,
        prompt: card.prompt,
        tryLabel: c.tryLabel,
        tryIt: () => {
          if (card.title.includes('大于') || card.title.includes('farther')) { setM1(1); setD1(4); setM2(2); setD2(2); }
          else if (card.title.includes('小于') || card.title.includes('closer')) { setM1(3); setD1(2); setM2(2); setD2(4); }
          else if (card.title.includes('等臂') || card.title.includes('Equal')) { setM1(2); setD1(3); setM2(2); setD2(3); }
          else { setM1(2); setD1(3); setM2(3); setD2(2); }
        },
      })),
    [c],
  );

  function renderConcludeQ(key: string, question: string, options: { value: string; label: string }[], selected: string | null, onSelect: (v: string) => void) {
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
              cls += isSel ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]';
            }
            const prefix = showFeedback ? (isCorrect ? '✓ ' : isSel ? '✗ ' : '') : '';
            return (
              <button key={opt.value} type="button" onClick={() => onSelect(opt.value)} disabled={showFeedback}
                className={`${cls} ${showFeedback ? 'opacity-60 cursor-not-allowed' : ''}`}>
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
          const label = s === 'predict' ? c.stagePredict : s === 'explore' ? c.stageExplore : c.stageConclude;
          const isDone = s === 'predict' ? predComplete : s === 'explore' ? observations.length > 0 : concludeComplete;
          return (
            <button key={s} type="button" onClick={() => setStage(s)}
              className={`px-3 py-1.5 border transition-colors ${stage === s ? 'border-[var(--fg)] text-[var(--fg)]' : isDone ? 'border-[var(--border)] text-[var(--muted)]' : 'border-[var(--border)] text-[var(--muted)] opacity-50'}`}>
              {isDone && stage !== s ? `✓ ${label}` : label}
            </button>
          );
        })}
        <div className="ml-auto">
          <button type="button" onClick={redoAll} className="px-3 py-1.5 border border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg
)] transition-colors">{c.redoLabel}</button>
        </div>
      </div>
      {/* 问 AI：讲解本实验的原理与操作要点 */}
      <AskAiButton className="mt-2" question={lang === 'zh' ? '请讲解杠杆平衡条件 F₁l₁=F₂l₂，以及省力、费力、等臂杠杆怎么区分' : 'Explain the lever balance F₁l₁=F₂l₂ and how to tell effort-saving, effort-costing and equal-arm levers'} />


      {/* ── 杠杆示意 ── */}
      <div className="border border-[var(--border)] p-3">
        <svg viewBox="0 0 520 260" className="w-full" aria-label="杠杆" strokeLinecap="round" strokeLinejoin="round">
          {/* 杠杆（倾斜角由力矩差决定） */}
          <line x1="120" y1="180" x2="400" y2="180" stroke="var(--fg)" strokeWidth="1.5" />
          {/* 支点 */}
          <polygon points="260,180 250,200 270,200" fill="var(--card-bg)" stroke="var(--fg)" strokeWidth="1.2" />
          {/* 左钩码 */}
          <g transform={`translate(${200 - d1 * 15}, 180)`}>
            <line x1="0" y1="0" x2="0" y2="30" stroke="var(--fg)" strokeWidth="1.5" />
            {Array.from({ length: m1 }).map((_, i) => <circle key={i} cx="0" cy={34 + i * 10} r="5" fill="var(--fg)" />)}
            <text x="0" y={34 + m1 * 10 + 12} textAnchor="middle" fontSize="10" fill="var(--muted)" fontFamily="var(--f-mono)">m1={m1}</text>
          </g>
          {/* 右钩码 */}
          <g transform={`translate(${320 + d2 * 15}, 180)`}>
            <line x1="0" y1="0" x2="0" y2="30" stroke="var(--fg)" strokeWidth="1.5" />
            {Array.from({ length: m2 }).map((_, i) => <circle key={i} cx="0" cy={34 + i * 10} r="5" fill="var(--fg)" />)}
            <text x="0" y={34 + m2 * 10 + 12} textAnchor="middle" fontSize="10" fill="var(--muted)" fontFamily="var(--f-mono)">m2={m2}</text>
          </g>
          {/* 力臂标注 */}
          <text x="160" y="150" textAnchor="middle" fontSize="11" fill="var(--muted)" fontFamily="var(--f-mono)">l₁={d1}</text>
          <text x="360" y="150" textAnchor="middle" fontSize="11" fill="var(--muted)" fontFamily="var(--f-mono)">l₂={d2}</text>
          {/* 平衡状态 */}
          <text x="260" y="60" textAnchor="middle" fontSize="12" fill={isBalanced ? 'var(--fg)' : 'var(--error)'} fontFamily="var(--f-mono)">
            {isBalanced ? (lang === 'zh' ? '✓ 平衡' : '✓ Balanced') : (lang === 'zh' ? '不平衡' : 'Unbalanced')}
          </text>
        </svg>
      </div>

      {/* ── 参数 ── */}
      <div className="border border-[var(--border)] p-4 space-y-3">
        <h3 className="text-[11px] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">// {c.params}</h3>
        <ParamSlider label="m₁" value={m1} min={1} max={4} step={1} onChange={setM1} format={(v) => `${v} 个`} />
        <ParamSlider label="d₁" value={d1} min={1} max={4} step={1} onChange={setD1} format={(v) => `${v}`} />
        <ParamSlider label="m₂" value={m2} min={1} max={4} step={1} onChange={setM2} format={(v) => `${v} 个`} />
        <ParamSlider label="d₂" value={d2} min={1} max={4} step={1} onChange={setD2} format={(v) => `${v}`} />
        <div className="text-sm mono-font text-[var(--fg)]">
          <span className="text-[var(--muted)]">F₁l₁ = </span>{torque1.toFixed(1)}
          <span className="text-[var(--muted)]"> · F₂l₂ = </span>{torque2.toFixed(1)}
        </div>
      </div>

      {/* ── 幕内容 ── */}
      {stage === 'predict' && (
        <div className="border border-[var(--border)] p-4 space-y-4">
          <h3 className="text-[11px] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">// {c.predictTitle}</h3>
          <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">{c.predictQuestion}</p>
          {renderConcludeQ('q1', c.predictQ1, [{ value: 'prop', label: c.predictQ1Prop }, { value: 'inv', label: c.predictQ1Inv }], predict1 as string, (v) => setPredict1(v as PredictQ1))}
          {predComplete ? (
            <button type="button" onClick={() => setStage('explore')} className="text-xs mono-font px-3 py-1.5 border border-[var(--fg)] text-[var(--fg)] hover:bg-[var(--accent-light)] transition-colors">✓ {c.predictDone} — {c.revealLabel}</button>
          ) : (
            <p className="text-xs text-[var(--muted)] serif-font italic">{c.predictHint}</p>
          )}
        </div>
      )}

      {stage === 'explore' && (
        <ExploreStage
          cards={cards}
          observations={observations}
          onAddObservation={addObservation}
          onClearObservations={() => { setObservations([]); setObsId(0); }}
          notePlaceholder={c.notePlaceholder}
          recordLabel={c.recordLabel}
          clearLabel={c.clearLabel}
          emptyLabel={c.exploreEmpty}
          title={c.exploreTitle}
        />
      )}

      {stage === 'conclude' && (
        <div className="border border-[var(--border)] p-4 space-y-4">
          <h3 className="text-[11px] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">// {c.concludeTitle}</h3>
          <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">{c.concludeQuestion}</p>
          {renderConcludeQ('q1', c.concludeQ1, [{ value: 'save', label: c.concludeQ1Save }, { value: 'cost', label: c.concludeQ1Cost }], concl.q1, (v) => setConcl((p) => ({ ...p, q1: v })))}
          {renderConcludeQ('q2', c.concludeQ2, [{ value: 'opener', label: c.concludeQ2Opener }, { value: 'rod', label: c.concludeQ2Rod }], concl.q2, (v) => setConcl((p) => ({ ...p, q2: v })))}
          {concludeComplete && !showFeedback && (
            <button type="button" onClick={() => setShowFeedback(true)} className="text-xs mono-font px-3 py-1.5 border border-[var(--fg)] text-[var(--fg)] hover:bg-[var(--accent-light)] transition-colors">{c.concludeHint}</button>
          )}
          {showFeedback && (
            <div className="border-l-2 border-[var(--fg)] pl-3 space-y-2">
              <p className="text-sm serif-font text-[var(--fg)] leading-relaxed">{c.feedbackText}</p>
              <h4 className="text-[11px] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">// {c.tipsTitle}</h4>
              <ul className="space-y-1">{c.tips.map((tip, i) => <li key={i} className="text-xs text-[var(--fg)] serif-font leading-relaxed flex gap-2"><span className="text-[var(--muted)] mono-font shrink-0">{i + 1}.</span>{tip}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

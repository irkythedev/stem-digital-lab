/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 物理实验 · 压强三幕式探究（苏科版 九上第9章）
 *
 * 幕 1 预测：猜压力的作用效果与什么有关
 * 幕 2 探索：压力/受力面积滑块，观察海绵凹陷程度变化，计算 p=F/S
 * 幕 3 结论：p = F/S，受力面积相同时压力越大效果越明显，压力相同时受力面积越小越明显
 *
 * 教材依据：ch09「活动 9.1 探究影响压力作用效果的因素」
 */
import { useMemo, useState } from 'react';
import AskAiButton from '../../components/ai/AskAiButton';
import { useApp } from '../../lib/app-context';
import ParamSlider from '../../components/lab/ParamSlider';
import ExploreStage, { type Observation, type ExploreCard } from '../../components/lab/ExploreStage';
import Formula from '../../components/ui/Formula';

type Stage = 'predict' | 'explore' | 'conclude';

type PredictQ1 = 'pres' | 'area' | 'mass' | null;

const copy = {
  zh: {
    prompt: '先预测，再自由探索，最后自己下结论。每一步都可以来回调整。',
    params: '参数', readout: '读数', reset: '重置',
    stagePredict: '预测', stageExplore: '探索', stageConclude: '结论',
    nextStage: '下一步 →', redoLabel: '再次实验',
    predictTitle: '预测',
    predictQuestion: '压力作用的效果可能与哪些因素有关？',
    predictQ1: '压力的作用效果主要与什么有关？',
    predictQ1Pres: '压力的大小',
    predictQ1Area: '受力面积的大小',
    predictQ1Mass: '物体的质量',
    predictDone: '已记录你的预测', predictHint: '猜完，就可以揭示实验',
    revealLabel: '揭示实验 →',
    exploreTitle: '探索',
    exploreEmpty: '还没有观察记录。拖动滑块或点任务卡，看到有意思的状态时记一条。',
    notePlaceholder: '写一句话：你观察到了什么？', recordLabel: '记一条观察',
    clearLabel: '清空记录', tryLabel: '试试这个',
    cards: [
      { title: '压力相同', prompt: '保持压力不变，减小受力面积：海绵凹陷更深还是更浅？' },
      { title: '受力面积相同', prompt: '保持受力面积不变，增大压力：海绵凹陷怎么变？' },
      { title: '增大/减小压强', prompt: '观察：增大压力或减小受力面积都会增大压强。' },
      { title: '自由探索', prompt: '任意调压力和受力面积，找压强变化规律。' },
    ],
    concludeTitle: '结论',
    concludeQuestion: '综合你的探索，压强与什么有关？',
    concludeHint: '选完三题，看看结论和你的观察是否一致',
    feedbackText:
      '压强 p = F/S。受力面积相同时，压力越大压强越大；压力相同时，受力面积越小压强越大。' +
      '增大压强：增大压力或减小受力面积；减小压强：减小压力或增大受力面积。',
    tipsTitle: '考点速记',
    tips: [
      '压强 p = F/S（F 压力，S 受力面积），单位 Pa',
      '1 Pa = 1 N/m²',
      '受力面积相同，压力越大压强越大',
      '压力相同，受力面积越小压强越大',
      '增大压强：增大压力/减小受力面积（如针尖、刀口）',
    ],
    concludeQ1: '受力面积相同时，压力越大，压强？',
    concludeQ1Big: '越大',
    concludeQ1Small: '越小',
    concludeQ2: '压力相同时，受力面积越小，压强？',
    concludeQ2Big: '越大',
    concludeQ2Small: '越小',
    concludeQ3: '下列哪个是增大压强的做法？',
    concludeQ3Needle: '针尖做得很尖（减小受力面积）',
    concludeQ3Board: '书包带做宽（增大受力面积）',
  },
  en: {
    prompt: 'Predict first, explore freely, then draw your own conclusion. You can move back and forth at any time.',
    params: 'Parameters', readout: 'Readings', reset: 'Reset',
    stagePredict: 'Predict', stageExplore: 'Explore', stageConclude: 'Conclude',
    nextStage: 'Next →', redoLabel: 'Redo',
    predictTitle: 'Predict',
    predictQuestion: 'What may the effect of pressure depend on?',
    predictQ1: 'The effect of pressure mainly depends on?',
    predictQ1Pres: 'the size of the force',
    predictQ1Area: 'the size of the contact area',
    predictQ1Mass: 'the mass of the object',
    predictDone: 'Your predictions are recorded', predictHint: 'Answer to reveal the experiment',
    revealLabel: 'Reveal experiment →',
    exploreTitle: 'Explore',
    exploreEmpty: 'No observations yet. Drag a slider or try a card, and note what you see.',
    notePlaceholder: 'Write one sentence: what did you observe?', recordLabel: 'Note it',
    clearLabel: 'Clear notes', tryLabel: 'Try it',
    cards: [
      { title: 'Same force', prompt: 'Keep force constant, reduce the contact area: does the sponge dent deeper or shallower?' },
      { title: 'Same area', prompt: 'Keep the area constant, increase the force: how does the dent change?' },
      { title: 'Increase/decrease pressure', prompt: 'Notice: more force or less area increases pressure.' },
      { title: 'Free exploration', prompt: 'Adjust force and area freely and look for the pressure pattern.' },
    ],
    concludeTitle: 'Conclude',
    concludeQuestion: 'Based on your exploration, what does pressure depend on?',
    concludeHint: 'Answer all three questions, then check your conclusion.',
    feedbackText:
      'Pressure p = F/S. For the same area, more force → more pressure; for the same force, smaller area → more pressure. ' +
      'Increase pressure: more force or smaller area; decrease pressure: less force or larger area.',
    tipsTitle: 'Key Points',
    tips: [
      'Pressure p = F/S (F force, S contact area), unit Pa',
      '1 Pa = 1 N/m²',
      'Same area, more force → more pressure',
      'Same force, smaller area → more pressure',
      'Increase pressure: more force / smaller area (e.g. needle tip, blade edge)',
    ],
    concludeQ1: 'Same area, more force → pressure?',
    concludeQ1Big: 'increases',
    concludeQ1Small: 'decreases',
    concludeQ2: 'Same force, smaller area → pressure?',
    concludeQ2Big: 'increases',
    concludeQ2Small: 'decreases',
    concludeQ3: 'Which increases pressure?',
    concludeQ3Needle: 'Sharp needle tip (smaller area)',
    concludeQ3Board: 'Wide backpack strap (larger area)',
  },
};

type Lang = 'zh' | 'en';

const CORRECT_KEYS: Record<string, string[]> = {
  q1: ['big'],
  q2: ['big'],
  q3: ['needle'],
};

export default function Pressure() {
  const { lang } = useApp();
  const c = copy[lang as Lang] ?? copy.zh;

  const [stage, setStage] = useState<Stage>('predict');
  const [F, setF] = useState(10); // 压力 N
  const [S, setS] = useState(5); // 受力面积 cm²
  const [predict1, setPredict1] = useState<PredictQ1>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [obsId, setObsId] = useState(0);
  const [concl, setConcl] = useState<{ q1: string | null; q2: string | null; q3: string | null }>({ q1: null, q2: null, q3: null });
  const [showFeedback, setShowFeedback] = useState(false);

  const predComplete = predict1 !== null;
  const concludeComplete = concl.q1 && concl.q2 && concl.q3;

  // 压强：p = F/S，S 从 cm² 转 m²（×10⁻⁴）
  const p = (F / (S * 1e-4)) / 1000; // kPa 显示
  const dent = Math.min(1, F / (S * 2)); // 凹陷程度 0-1

  function redoAll() {
    setStage('predict');
    setF(10); setS(5);
    setPredict1(null); setObservations([]); setObsId(0);
    setConcl({ q1: null, q2: null, q3: null }); setShowFeedback(false);
  }

  function addObservation(note: string) {
    setObservations((prev) => [
      ...prev,
      {
        id: obsId,
        snapshot: [
          { label: 'F', value: `${F.toFixed(0)}N` },
          { label: 'S', value: `${S.toFixed(0)}cm²` },
          { label: 'p', value: `${p.toFixed(1)}kPa` },
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
          if (card.title.includes('压力相同') || card.title.includes('Same force')) { setF(10); setS(2); }
          else if (card.title.includes('受力面积相同') || card.title.includes('Same area')) { setF(20); setS(5); }
          else if (card.title.includes('增大/减小') || card.title.includes('Increase/decrease')) { setF(25); setS(2); }
          else { setF(10); setS(5); }
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
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 text-xs 2xl:text-sm mono-font tracking-wider">
        {(['predict', 'explore', 'conclude'] as Stage[]).map((s) => {
          const label = s === 'predict' ? c.stagePredict : s === 'explore' ? c.stageExplore : c.stageConclude;
          const isDone = s === 'predict' ? predComplete : s === 'explore' ? observations.length > 0 : concludeComplete;
          return (
            <button key={s} type="button" onClick={() => setStage(s)}
              className={`min-h-[38px] px-3.5 py-1.5 border transition-all rounded-sm font-medium touch-manipulation active:scale-95 ${stage === s ? 'border-[var(--fg)] bg-[var(--accent-light)] text-[var(--fg)] shadow-xs' : isDone ? 'border-[var(--border)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] opacity-60'}`}>
              {isDone && stage !== s ? `✓ ${label}` : label}
            </button>
          );
        })}
        <div className="ml-auto">
          <button type="button" onClick={redoAll} className="min-h-[38px] px-3.5 py-1.5 border border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)] transition-all rounded-sm touch-manipulation active:scale-95">{c.redoLabel}</button>
        </div>
      </div>
      {/* 问 AI：讲解本实验的原理与操作要点 */}
      <AskAiButton className="mt-2" question={lang === 'zh' ? '请讲解压强 p=F/S 的物理意义，增大和减小压强的方法有哪些' : 'Explain pressure p=F/S and the ways to increase or decrease it'} />


      {/* ── 压强示意 ── */}
      <div className="border border-[var(--border)] p-3">
        <svg viewBox="0 0 520 300" className="w-full" aria-label="压强" strokeLinecap="round" strokeLinejoin="round">
          {/* 重物（压力） */}
          <rect x="230" y="40" width="60" height="50" fill="var(--card-bg)" stroke="var(--fg)" strokeWidth="1.5" />
          <text x="260" y="72" textAnchor="middle" fontSize="12" fill="var(--fg)" fontFamily="var(--f-mono)">F={F}N</text>
          {/* 受力面（小桌） */}
          <rect x="200" y="90" width="120" height="6" fill="var(--fg)" />
          {/* 桌腿（间距随受力面积） */}
          <rect x="200" y="96" width="6" height={90 - S * 8} fill="var(--fg)" />
          <rect x="314" y="96" width="6" height={90 - S * 8} fill="var(--fg)" />
          {/* 海绵（凹陷程度随压强） */}
          <path d={`M 180 ${250 - dent * 40} Q 260 ${260 - dent * 60} 340 ${250 - dent * 40} L 340 250 L 180 250 Z`} fill="var(--muted)" opacity="0.5" stroke="var(--fg)" strokeWidth="1" />
          {/* 压强读数 */}
          <text x="260" y="285" textAnchor="middle" fontSize="13" fill="var(--fg)" fontFamily="var(--f-mono)">p = {p.toFixed(1)} kPa</text>
        </svg>
      </div>

      {/* ── 参数 ── */}
      <div className="border border-[var(--border)] p-4 space-y-3">
        <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">// {c.params}</h3>
        <ParamSlider label="F (N)" value={F} min={5} max={40} step={1} onChange={setF} format={(v) => `${v.toFixed(0)}N`} />
        <ParamSlider label="S (cm²)" value={S} min={1} max={10} step={1} onChange={setS} format={(v) => `${v.toFixed(0)}cm²`} />
      </div>

      {/* ── 幕内容 ── */}
      {stage === 'predict' && (
        <div className="border border-[var(--border)] p-4 space-y-4">
          <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">// {c.predictTitle}</h3>
          <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">{c.predictQuestion}</p>
          {renderConcludeQ('q1', c.predictQ1, [{ value: 'pres', label: c.predictQ1Pres }, { value: 'area', label: c.predictQ1Area }, { value: 'mass', label: c.predictQ1Mass }], predict1 as string, (v) => setPredict1(v as PredictQ1))}
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
          <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">// {c.concludeTitle}</h3>
          <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">{c.concludeQuestion}</p>
          {renderConcludeQ('q1', c.concludeQ1, [{ value: 'big', label: c.concludeQ1Big }, { value: 'small', label: c.concludeQ1Small }], concl.q1, (v) => setConcl((p) => ({ ...p, q1: v })))}
          {renderConcludeQ('q2', c.concludeQ2, [{ value: 'big', label: c.concludeQ2Big }, { value: 'small', label: c.concludeQ2Small }], concl.q2, (v) => setConcl((p) => ({ ...p, q2: v })))}
          {renderConcludeQ('q3', c.concludeQ3, [{ value: 'needle', label: c.concludeQ3Needle }, { value: 'board', label: c.concludeQ3Board }], concl.q3, (v) => setConcl((p) => ({ ...p, q3: v })))}
          {concludeComplete && !showFeedback && (
            <button type="button" onClick={() => setShowFeedback(true)} className="text-xs mono-font px-3 py-1.5 border border-[var(--fg)] text-[var(--fg)] hover:bg-[var(--accent-light)] transition-colors">{c.concludeHint}</button>
          )}
          {showFeedback && (
            <div className="border-l-2 border-[var(--fg)] pl-3 space-y-2">
              <p className="text-sm serif-font text-[var(--fg)] leading-relaxed">{c.feedbackText}</p>
              <h4 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">// {c.tipsTitle}</h4>
              <ul className="space-y-1">{c.tips.map((tip, i) => <li key={i} className="text-xs text-[var(--fg)] serif-font leading-relaxed flex gap-2"><span className="text-[var(--muted)] mono-font shrink-0">{i + 1}.</span>{tip}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

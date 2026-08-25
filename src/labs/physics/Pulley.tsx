/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 物理实验 · 滑轮三幕式探究（苏科版 九上第11章）
 *
 * 幕 1 预测：猜定滑轮/动滑轮是否省力
 * 幕 2 探索：定滑轮/动滑轮切换，观察拉起重物所需力
 * 幕 3 结论：定滑轮不省力改变方向，动滑轮最多省一半力
 *
 * 教材依据：ch11「活动 11.2 探究定滑轮和动滑轮的特点」
 */
import { useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import AskAiButton from '../../components/ai/AskAiButton';
import { useApp } from '../../lib/app-context';
import ParamSlider from '../../components/lab/ParamSlider';
import ExploreStage, { type Observation, type ExploreCard } from '../../components/lab/ExploreStage';
import Formula from '../../components/ui/Formula';
import StageNav from '../../components/lab/StageNav';

type Stage = 'predict' | 'explore' | 'conclude';

type PredictQ1 = 'fixed' | 'moving' | null;

const copy = {
  zh: {
    prompt: '先预测，再自由探索，最后自己下结论。每一步都可以来回调整。',
    params: '参数', readout: '读数', reset: '重置',
    stagePredict: '预测', stageExplore: '探索', stageConclude: '结论',
    nextStage: '下一步 →', redoLabel: '再次实验',
    predictTitle: '预测',
    predictQuestion: '使用定滑轮和动滑轮，哪个更省力？',
    predictQ1: '动滑轮可以省多少力？',
    predictQ1Half: '最多省一半力',
    predictQ1None: '不省力',
    predictDone: '已记录你的预测', predictHint: '猜完，就可以揭示实验',
    revealLabel: '揭示实验 →',
    exploreTitle: '探索',
    exploreEmpty: '还没有观察记录。切换滑轮类型或拖动滑块，看到有意思的状态时记一条。',
    notePlaceholder: '写一句话：你观察到了什么？', recordLabel: '记一条观察',
    clearLabel: '清空记录', tryLabel: '试试这个',
    cards: [
      { title: '定滑轮', prompt: '用定滑轮拉起重物，需要多大的力？方向呢？' },
      { title: '动滑轮', prompt: '用动滑轮拉起同一重物，需要多大的力？' },
      { title: '方向', prompt: '定滑轮改变了施力方向，动滑轮呢？' },
      { title: '自由探索', prompt: '切换滑轮类型，改变重物重量，找找规律。' },
    ],
    concludeTitle: '结论',
    concludeQuestion: '综合你的探索，定滑轮和动滑轮各有什么特点？',
    concludeHint: '选完两题，看看结论和你的观察是否一致',
    feedbackText:
      '使用定滑轮不能省力，但可以改变施力的方向；使用动滑轮最多可以省一半力，但不改变施力的方向。' +
      '定滑轮实质是等臂杠杆，动滑轮实质是省力杠杆（动力臂是阻力臂的两倍）。',
    tipsTitle: '考点速记',
    tips: [
      '定滑轮：不省力，但改变施力方向（等臂杠杆）',
      '动滑轮：最多省一半力，不改变方向（省力杠杆）',
      '定滑轮实质是等臂杠杆',
      '动滑轮实质是动力臂为阻力臂两倍的杠杆',
      '滑轮组：既能省力又能改变方向',
    ],
    concludeQ1: '定滑轮的特点？',
    concludeQ1Dir: '不省力，但改变方向',
    concludeQ1Save: '省一半力',
    concludeQ2: '动滑轮的特点？',
    concludeQ2Half: '最多省一半力，不改变方向',
    concludeQ2None: '不省力，改变方向',
  },
  en: {
    prompt: 'Predict first, explore freely, then draw your own conclusion. You can move back and forth at any time.',
    params: 'Parameters', readout: 'Readings', reset: 'Reset',
    stagePredict: 'Predict', stageExplore: 'Explore', stageConclude: 'Conclude',
    nextStage: 'Next →', redoLabel: 'Redo',
    predictTitle: 'Predict',
    predictQuestion: 'Between a fixed pulley and a movable pulley, which saves effort?',
    predictQ1: 'How much effort does a movable pulley save?',
    predictQ1Half: 'At most half',
    predictQ1None: 'None',
    predictDone: 'Your predictions are recorded', predictHint: 'Answer to reveal the experiment',
    revealLabel: 'Reveal experiment →',
    exploreTitle: 'Explore',
    exploreEmpty: 'No observations yet. Switch the pulley type or drag the slider, and note what you see.',
    notePlaceholder: 'Write one sentence: what did you observe?', recordLabel: 'Note it',
    clearLabel: 'Clear notes', tryLabel: 'Try it',
    cards: [
      { title: 'Fixed pulley', prompt: 'Use a fixed pulley to lift the load — how much force is needed? What about direction?' },
      { title: 'Movable pulley', prompt: 'Use a movable pulley to lift the same load — how much force is needed?' },
      { title: 'Direction', prompt: 'A fixed pulley changes the pull direction; does a movable one?' },
      { title: 'Free exploration', prompt: 'Switch pulley type and change the load weight to find the pattern.' },
    ],
    concludeTitle: 'Conclude',
    concludeQuestion: 'Based on your exploration, what are the features of fixed and movable pulleys?',
    concludeHint: 'Answer both questions, then check your conclusion.',
    feedbackText:
      'A fixed pulley does not save effort but changes the pull direction; a movable pulley saves at most half the effort but does not change direction. ' +
      'A fixed pulley is essentially a balance lever; a movable pulley is an effort-saving lever (effort arm is twice the load arm).',
    tipsTitle: 'Key Points',
    tips: [
      'Fixed pulley: no effort saved, but changes direction (balance lever)',
      'Movable pulley: saves at most half effort, no direction change (effort-saving lever)',
      'Fixed pulley is a balance lever',
      'Movable pulley is a lever with effort arm twice the load arm',
      'Pulley system: both saves effort and changes direction',
    ],
    concludeQ1: 'Feature of a fixed pulley?',
    concludeQ1Dir: 'No effort saved, but changes direction',
    concludeQ1Save: 'Saves half effort',
    concludeQ2: 'Feature of a movable pulley?',
    concludeQ2Half: 'Saves at most half effort, no direction change',
    concludeQ2None: 'No effort saved, changes direction',
  },
};

type Lang = 'zh' | 'en';

const CORRECT_KEYS: Record<string, string[]> = {
  q1: ['dir'],
  q2: ['half'],
};

export default function Pulley() {
  const { lang } = useApp();
  const c = copy[lang as Lang] ?? copy.zh;

  const [stage, setStage] = useState<Stage>('predict');
  const [type, setType] = useState<'fixed' | 'moving'>('fixed');
  const [G, setG] = useState(10); // 重物重量 N
  const [predict1, setPredict1] = useState<PredictQ1>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [obsId, setObsId] = useState(0);
  const [concl, setConcl] = useState<{ q1: string | null; q2: string | null }>({ q1: null, q2: null });
  const [showFeedback, setShowFeedback] = useState(false);

  const predComplete = predict1 !== null;
  const concludeComplete = Boolean(concl.q1 && concl.q2);

  // 拉力：定滑轮 F=G，动滑轮 F=G/2（理想，不计滑轮重力）
  const F = type === 'fixed' ? G : G / 2;

  function redoAll() {
    setStage('predict');
    setType('fixed'); setG(10);
    setPredict1(null); setObservations([]); setObsId(0);
    setConcl({ q1: null, q2: null }); setShowFeedback(false);
  }

  function addObservation(note: string) {
    setObservations((prev) => [
      ...prev,
      {
        id: obsId,
        snapshot: [
          { label: lang === 'zh' ? '滑轮' : 'Pulley', value: type === 'fixed' ? (lang === 'zh' ? '定滑轮' : 'Fixed') : (lang === 'zh' ? '动滑轮' : 'Moving') },
          { label: 'G', value: `${G}N` },
          { label: 'F', value: `${F}N` },
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
          if (card.title.includes('定滑轮') || card.title.includes('Fixed')) setType('fixed');
          else if (card.title.includes('动滑轮') || card.title.includes('Movable')) setType('moving');
          else if (card.title.includes('方向') || card.title.includes('Direction')) setType('fixed');
          else { setType('fixed'); setG(10); }
        },
      })),
    [c],
  );

  function renderConcludeQ(key: string, question: string, options: { value: string; label: string }[], selected: string | null, onSelect: (v: string) => void) {
    const correctKeys = CORRECT_KEYS[key];
    return (
      <div className="space-y-2">
        <p className="text-sm serif-font text-[var(--fg)]">{question}</p>
        <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
          {options.map((opt) => {
            const isSel = selected === opt.value;
            const isCorrect = correctKeys.includes(opt.value);
            let cls = 'text-left text-xs sm:text-sm px-3 py-2.5 border rounded-lg transition-colors ';
            if (showFeedback) {
              if (isSel && isCorrect) cls += 'border-[var(--fg)] bg-[var(--accent-light)] text-[var(--fg)] font-semibold';
              else if (isSel && !isCorrect) cls += 'border-[var(--error)] text-[var(--error)]';
              else if (!isSel && isCorrect) cls += 'border-[var(--border)] text-[var(--muted)]';
              else cls += 'border-[var(--border)] text-[var(--muted)] opacity-50';
            } else {
              cls += isSel ? 'border-[var(--fg)] bg-[var(--accent-light)] text-[var(--fg)] font-semibold' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]';
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
      <StageNav
        stage={stage}
        setStage={setStage}
        labels={{
          predict: c.stagePredict,
          explore: c.stageExplore,
          conclude: c.stageConclude,
          next: c.nextStage,
          redo: c.redoLabel,
        }}
        onRedo={redoAll}
        isDone={{
          predict: predComplete,
          explore: observations.length > 0,
          conclude: concludeComplete,
        }}
      />
      {/* 问 AI：讲解本实验的原理与操作要点 */}
      <AskAiButton className="mt-2" question={lang === 'zh' ? '请讲解定滑轮与动滑轮各有什么特点，滑轮组怎么判断省力情况' : 'Explain fixed vs movable pulleys and how to determine the effort saved by a pulley system'} />


      {/* ── 滑轮示意 ── */}
      <div className="border border-[var(--border)] p-3">
        <svg viewBox="0 0 520 320" className="w-full" aria-label="滑轮" strokeLinecap="round" strokeLinejoin="round">
          {/* 定滑轮：轮轴固定在天花板上，绳绕轮顶，左切线挂重物，右切线向下拉（改变力的方向） */}
          {type === 'fixed' ? (
            <g transform="translate(60, 10)">
              {/* 天花板与固定支架 */}
              <line x1="120" y1="30" x2="280" y2="30" stroke="var(--fg)" strokeWidth="2" />
              {/* 支架斜纹装饰 */}
              {[140, 170, 200, 230, 260].map((x) => (
                <line key={x} x1={x} y1="30" x2={x + 10} y2="20" stroke="var(--muted)" strokeWidth="1" />
              ))}
              <line x1="200" y1="30" x2="200" y2="90" stroke="var(--fg)" strokeWidth="2" />

              {/* 定滑轮轮体 (中心 200, 90, 半径 30) */}
              <circle cx="200" cy="90" r="30" fill="var(--card-bg)" stroke="var(--fg)" strokeWidth="1.8" />
              <circle cx="200" cy="90" r="6" fill="var(--fg)" />

              {/* 绳索：左切线 x=170 从 y=90 到 y=200；顶部半圆弧 A 30 30 0 0 1 230 90；右切线 x=230 向下拉到 y=170 */}
              <path
                d="M 170 200 V 90 A 30 30 0 0 1 230 90 V 170"
                fill="none"
                stroke="var(--fg)"
                strokeWidth="2"
              />

              {/* 左侧悬挂重物 (x: 155~185, y: 200~240) */}
              <rect x="155" y="200" width="30" height="35" rx="3" fill="var(--card-bg)" stroke="var(--fg)" strokeWidth="1.5" />
              <text x="170" y="222" textAnchor="middle" fontSize="11" fontWeight="bold" fill="var(--fg)" fontFamily="var(--f-mono)">
                G={G}N
              </text>

              {/* 右侧手拉力向下箭头 (自 y=170 向下拉至 y=210) */}
              <line x1="230" y1="170" x2="230" y2="210" stroke="var(--accent)" strokeWidth="2" />
              <polygon points="225,210 235,210 230,220" fill="var(--accent)" />
              <text x="245" y="195" fontSize="12" fontWeight="bold" fill="var(--accent)" fontFamily="var(--f-mono)">
                F = {F} N
              </text>
              <text x="245" y="212" fontSize="10" fill="var(--muted)" fontFamily="var(--f-mono)">
                {lang === 'zh' ? '（向下用力，方向改变）' : '(Downward pull)'}
              </text>
            </g>
          ) : (
            /* 动滑轮：左侧绳固定在天花板 (x=170, y=40)，绕过轮底 (中心 200, 140, 半径 30)，右侧绳 (x=230) 向上拉 (F = G/2) */
            <g transform="translate(60, 10)">
              {/* 天花板横梁 */}
              <line x1="120" y1="40" x2="280" y2="40" stroke="var(--fg)" strokeWidth="2" />
              {[140, 170, 200, 230, 260].map((x) => (
                <line key={x} x1={x} y1="40" x2={x + 10} y2="30" stroke="var(--muted)" strokeWidth="1" />
              ))}

              {/* 左绳固定端锚点 */}
              <circle cx="170" cy="40" r="3" fill="var(--fg)" />

              {/* 绳索：从左天花板 x=170, y=40 下行至 y=140，沿轮底半圆弧绕至右侧 x=230, y=140，再向上引出至 y=60 */}
              <path
                d="M 170 40 V 140 A 30 30 0 0 0 230 140 V 60"
                fill="none"
                stroke="var(--fg)"
                strokeWidth="2"
              />

              {/* 动滑轮轮体 (中心 200, 140, 半径 30) */}
              <circle cx="200" cy="140" r="30" fill="var(--card-bg)" stroke="var(--fg)" strokeWidth="1.8" />
              <circle cx="200" cy="140" r="6" fill="var(--fg)" />

              {/* 滑轮轴下挂钩与重物 (中心 x=200) */}
              <line x1="200" y1="146" x2="200" y2="195" stroke="var(--fg)" strokeWidth="2" />
              <rect x="185" y="195" width="30" height="35" rx="3" fill="var(--card-bg)" stroke="var(--fg)" strokeWidth="1.5" />
              <text x="200" y="217" textAnchor="middle" fontSize="11" fontWeight="bold" fill="var(--fg)" fontFamily="var(--f-mono)">
                G={G}N
              </text>

              {/* 右绳端向上拉力箭头 (自 y=60 向上拉至 y=20，完全在视口内) */}
              <line x1="230" y1="60" x2="230" y2="20" stroke="var(--accent)" strokeWidth="2" />
              <polygon points="225,20 235,20 230,10" fill="var(--accent)" />
              <text x="245" y="30" fontSize="12" fontWeight="bold" fill="var(--accent)" fontFamily="var(--f-mono)">
                F = {F} N
              </text>
              <text x="245" y="46" fontSize="10" fill="var(--muted)" fontFamily="var(--f-mono)">
                {lang === 'zh' ? '（省一半力，两段绳承重）' : '(Saves 1/2 effort)'}
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* ── 参数 ── */}
      <div className="border border-[var(--border)] p-4 space-y-3">
        <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">// {c.params}</h3>
        <div className="flex items-center gap-2">
          <span className="text-[0.6875rem] mono-font uppercase tracking-widest text-[var(--muted)]">{lang === 'zh' ? '滑轮类型' : 'Pulley type'}</span>
          <button type="button" onClick={() => setType('fixed')} className={`text-xs mono-font px-2 py-1 border transition-colors ${type === 'fixed' ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'}`}>{lang === 'zh' ? '定滑轮' : 'Fixed'}</button>
          <button type="button" onClick={() => setType('moving')} className={`text-xs mono-font px-2 py-1 border transition-colors ${type === 'moving' ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'}`}>{lang === 'zh' ? '动滑轮' : 'Moving'}</button>
        </div>
        <ParamSlider label="G (N)" value={G} min={2} max={20} step={1} onChange={setG} format={(v) => `${v.toFixed(0)}N`} />
        <div className="text-sm mono-font text-[var(--fg)]">
          <span className="text-[var(--muted)]">G = </span>{G}N
          <span className="text-[var(--muted)]"> · F = </span>{F}N
          {type === 'moving' && <span className="text-[var(--muted)]">（省一半力）</span>}
        </div>
      </div>

      {/* ── 幕内容 ── */}
      {stage === 'predict' && (
        <div className="border border-[var(--border)] p-4 space-y-4">
          <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">// {c.predictTitle}</h3>
          <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">{c.predictQuestion}</p>
          {renderConcludeQ('q1', c.predictQ1, [{ value: 'half', label: c.predictQ1Half }, { value: 'none', label: c.predictQ1None }], predict1 as string, (v) => setPredict1(v as PredictQ1))}
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
          {renderConcludeQ('q1', c.concludeQ1, [{ value: 'dir', label: c.concludeQ1Dir }, { value: 'save', label: c.concludeQ1Save }], concl.q1, (v) => setConcl((p) => ({ ...p, q1: v })))}
          {renderConcludeQ('q2', c.concludeQ2, [{ value: 'half', label: c.concludeQ2Half }, { value: 'none', label: c.concludeQ2None }], concl.q2, (v) => setConcl((p) => ({ ...p, q2: v })))}
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

/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 化学实验 · 金属活动性顺序（人教版 九下第八单元 课题2）三幕式探究
 *
 * 幕 1 预测：猜 Al/Cu/Ag 的活动性顺序
 * 幕 2 探索：铝丝浸入 CuSO₄、铜丝浸入 AgNO₃，观察置换与析出
 * 幕 3 结论：Al > Cu > Ag（金属活动性顺序）
 *
 * 教材依据：ch08「金属活动性顺序——铝、铜、银」
 */
import { useMemo, useState } from 'react';
import { useApp } from '../../lib/app-context';
import ExploreStage, { type Observation, type ExploreCard } from '../../components/lab/ExploreStage';
import Formula from '../../components/ui/Formula';

type Stage = 'predict' | 'explore' | 'conclude';

/** 预测题 */
type PredictQ = 'alcUag' | 'cuAlag' | 'agCual' | null;

/** 反应卡 */
type ReactCard = 'al-cuso4' | 'cu-agno3';

/** 金属颜色 / 溶液颜色（简化示意） */
const METALS = {
  al: { zh: '铝丝 Al', en: 'Al wire', color: '#c8cdd4' },
  cu: { zh: '铜丝 Cu', en: 'Cu wire', color: '#e08a3c' },
  ag: { zh: '银 Ag', en: 'Ag', color: '#cfd6dc' },
};

const copy = {
  zh: {
    prompt: '先预测，再自由探索，最后自己下结论。每一步都可以来回调整。',
    params: '参数', readout: '实验现象', reset: '重置',
    stagePredict: '预测', stageExplore: '探索', stageConclude: '结论',
    nextStage: '下一步 →', redoLabel: '再次实验',
    predictTitle: '预测',
    predictQuestion: '比较铝、铜、银三种金属的化学活动性强弱。',
    predictQ1: '你认为三种金属的活动性顺序是？',
    predictQ1AlCuAg: 'Al > Cu > Ag',
    predictQ1CuAlAg: 'Cu > Al > Ag',
    predictQ1AgCuAl: 'Ag > Cu > Al',
    predictDone: '已记录你的预测', predictHint: '猜完就可以做实验验证',
    revealLabel: '做实验 →',
    exploreTitle: '探索',
    exploreEmpty: '还没有观察记录。做置换反应，看到现象时记一条。',
    notePlaceholder: '写一句话：你观察到了什么？', recordLabel: '记一条观察',
    clearLabel: '清空记录', tryLabel: '试试这个',
    cards: [
      { title: 'Al + CuSO₄', prompt: '把铝丝浸入硫酸铜溶液：铝丝表面析出什么？溶液颜色变怎样？' },
      { title: 'Cu + AgNO₃', prompt: '把铜丝浸入硝酸银溶液：铜丝表面析出什么？溶液颜色变怎样？' },
      { title: '自由探索', prompt: '对比两个置换反应，判断谁更活泼。' },
    ],
    concludeTitle: '结论',
    concludeQuestion: '综合你的探索，三种金属活动性如何排序？',
    concludeHint: '选完三题，看看结论和你的观察是否一致',
    feedbackText:
      '铝能从硫酸铜溶液中置换出铜（Al 表面析出红色 Cu，溶液蓝色变浅/变无色）；' +
      '铜能从硝酸银溶液中置换出银（Cu 表面析出银白色 Ag，溶液变蓝）。' +
      '活动性：Al > Cu > Ag。活泼的金属能把不活泼的金属从其盐溶液中置换出来。',
    tipsTitle: '考点速记',
    tips: [
      '金属活动性顺序（常见）：K Ca Na Mg Al Zn Fe Sn Pb (H) Cu Hg Ag Pt Au',
      'Al > Cu：铝置换铜，Al + 2CuSO₄ → Al₂(SO₄)₃ + ...（铜从溶液中析出）',
      'Cu > Ag：铜置换银，Cu + 2AgNO₃ → Cu(NO₃)₂ + 2Ag',
      '活泼金属 + 盐溶液 → 不活泼金属 + 新盐（置换反应）',
      '越靠前越活泼，越容易与酸/盐溶液反应',
    ],
    concludeQ1: '铝丝浸入 CuSO₄ 溶液，铝丝表面？',
    concludeQ1RedCu: '析出红色铜',
    concludeQ1Nothing: '无明显变化',
    concludeQ1Ag: '析出银',
    concludeQ2: '铜丝浸入 AgNO₃ 溶液，铜丝表面？',
    concludeQ2Ag: '析出银白色银',
    concludeQ2Nothing: '无明显变化',
    concludeQ2Cu: '析出铜',
    concludeQ3: '活动性顺序是？',
    concludeQ3AlCuAg: 'Al > Cu > Ag',
    concludeQ3CuAlAg: 'Cu > Al > Ag',
    concludeQ3AgCuAl: 'Ag > Cu > Al',
  },
  en: {
    prompt: 'Predict first, explore freely, then draw your own conclusion. You can move back and forth at any time.',
    params: 'Parameters', readout: 'Observations', reset: 'Reset',
    stagePredict: 'Predict', stageExplore: 'Explore', stageConclude: 'Conclude',
    nextStage: 'Next →', redoLabel: 'Redo',
    predictTitle: 'Predict',
    predictQuestion: 'Compare the chemical activity of aluminium, copper and silver.',
    predictQ1: 'What is the order of activity of these three metals?',
    predictQ1AlCuAg: 'Al > Cu > Ag',
    predictQ1CuAlAg: 'Cu > Al > Ag',
    predictQ1AgCuAl: 'Ag > Cu > Al',
    predictDone: 'Your predictions are recorded', predictHint: 'Predict then verify by experiment',
    revealLabel: 'Experiment →',
    exploreTitle: 'Explore',
    exploreEmpty: 'No observations yet. Do a displacement reaction and note what you see.',
    notePlaceholder: 'Write one sentence: what did you observe?', recordLabel: 'Note it',
    clearLabel: 'Clear notes', tryLabel: 'Try it',
    cards: [
      { title: 'Al + CuSO₄', prompt: 'Dip Al wire into copper sulfate: what forms on the Al? How does the solution color change?' },
      { title: 'Cu + AgNO₃', prompt: 'Dip Cu wire into silver nitrate: what forms on the Cu? How does the solution color change?' },
      { title: 'Free exploration', prompt: 'Compare the two displacement reactions to judge which metal is more active.' },
    ],
    concludeTitle: 'Conclude',
    concludeQuestion: 'Based on your exploration, how do the three metals rank by activity?',
    concludeHint: 'Answer all three questions, then check if your conclusion matches.',
    feedbackText:
      'Aluminium displaces copper from CuSO₄ (red Cu appears on Al; blue solution fades), ' +
      'and copper displaces silver from AgNO₃ (silvery Ag appears on Cu; solution turns blue). ' +
      'Activity: Al > Cu > Ag. A more active metal displaces a less active one from its salt solution.',
    tipsTitle: 'Key Points',
    tips: [
      'Common activity series: K Ca Na Mg Al Zn Fe Sn Pb (H) Cu Hg Ag Pt Au',
      'Al > Cu: aluminium displaces copper from its salt solution',
      'Cu > Ag: copper displaces silver, Cu + 2AgNO₃ → Cu(NO₃)₂ + 2Ag',
      'Active metal + salt solution → less active metal + new salt (displacement)',
      'Further left = more active, reacts more readily with acids/salt solutions',
    ],
    concludeQ1: 'Al wire in CuSO₄ solution shows?',
    concludeQ1RedCu: 'red copper deposits',
    concludeQ1Nothing: 'no visible change',
    concludeQ1Ag: 'silver deposits',
    concludeQ2: 'Cu wire in AgNO₃ solution shows?',
    concludeQ2Ag: 'silvery silver deposits',
    concludeQ2Nothing: 'no visible change',
    concludeQ2Cu: 'copper deposits',
    concludeQ3: 'The activity order is?',
    concludeQ3AlCuAg: 'Al > Cu > Ag',
    concludeQ3CuAlAg: 'Cu > Al > Ag',
    concludeQ3AgCuAl: 'Ag > Cu > Al',
  },
};

type Lang = 'zh' | 'en';

const CORRECT_KEYS: Record<string, string[]> = {
  q1: ['redcu'],
  q2: ['ag'],
  q3: ['alcuag'],
};

export default function MetalActivity() {
  const { lang } = useApp();
  const c = copy[lang as Lang] ?? copy.zh;

  const [stage, setStage] = useState<Stage>('predict');
  const [react, setReact] = useState<ReactCard>('al-cuso4');
  const [done, setDone] = useState(false); // 是否已完成反应
  const [predict1, setPredict1] = useState<PredictQ>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [obsId, setObsId] = useState(0);
  const [concl, setConcl] = useState<{ q1: string | null; q2: string | null; q3: string | null }>({ q1: null, q2: null, q3: null });
  const [showFeedback, setShowFeedback] = useState(false);

  const predComplete = predict1 !== null;
  const concludeComplete = concl.q1 && concl.q2 && concl.q3;

  // 当前反应的现象描述
  const isAlCu = react === 'al-cuso4';
  const metalLabel = isAlCu ? (lang === 'zh' ? '铝丝 Al' : 'Al wire') : (lang === 'zh' ? '铜丝 Cu' : 'Cu wire');
  const solutionLabel = isAlCu ? (lang === 'zh' ? '硫酸铜 CuSO₄' : 'CuSO₄') : (lang === 'zh' ? '硝酸银 AgNO₃' : 'AgNO₃');
  // 析出物
  const depositLabel = isAlCu ? (lang === 'zh' ? '红色 Cu' : 'red Cu') : (lang === 'zh' ? '银白色 Ag' : 'silvery Ag');
  const depositColor = isAlCu ? '#e08a3c' : '#cfd6dc';
  // 溶液颜色：Al+CuSO₄ 初始蓝色(CuSO₄) → 反应后无色(Cu²⁺消耗)；Cu+AgNO₃ 初始无色 → 反应后蓝色(Cu(NO₃)₂)
  const solColor = !done
    ? (isAlCu ? 'rgba(60,120,220,0.35)' : 'rgba(225,228,234,0.25)')
    : (isAlCu ? 'rgba(245,247,250,0.15)' : 'rgba(70,140,215,0.32)');
  const solChange = isAlCu
    ? (lang === 'zh' ? '溶液由蓝色变无色' : 'solution turns colorless')
    : (lang === 'zh' ? '溶液变为蓝色' : 'solution turns blue');

  function redoAll() {
    setStage('predict');
    setReact('al-cuso4'); setDone(false);
    setPredict1(null);
    setObservations([]); setObsId(0);
    setConcl({ q1: null, q2: null, q3: null });
    setShowFeedback(false);
  }

  function addObservation(note: string) {
    setObservations((prev) => [
      ...prev,
      {
        id: obsId,
        snapshot: [
          { label: '反应', value: isAlCu ? 'Al+CuSO₄' : 'Cu+AgNO₃' },
          { label: '析出', value: depositLabel },
          { label: '现象', value: solChange },
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
          if (card.title.includes('Al + CuSO₄')) { setReact('al-cuso4'); setDone(true); }
          else if (card.title.includes('Cu + AgNO₃')) { setReact('cu-agno3'); setDone(true); }
          else { setReact('al-cuso4'); setDone(true); }
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
          <button type="button" onClick={redoAll} className="px-3 py-1.5 border border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] transition-colors">{c.redoLabel}</button>
        </div>
      </div>

      {/* ── 反应卡切换 ── */}
      <div className="flex gap-2">
        <button type="button" onClick={() => { setReact('al-cuso4'); setDone(false); }}
          className={`px-3 py-1.5 text-[11px] border transition-colors ${react === 'al-cuso4' ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'}`}>
          Al + CuSO₄
        </button>
        <button type="button" onClick={() => { setReact('cu-agno3'); setDone(false); }}
          className={`px-3 py-1.5 text-[11px] border transition-colors ${react === 'cu-agno3' ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'}`}>
          Cu + AgNO₃
        </button>
      </div>

      {/* ── 实验示意 ── */}
      <div className="border border-[var(--border)] p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">// {c.readout}</h3>
          <button
            type="button"
            onClick={() => setDone((p) => !p)}
            className={`px-3 py-1.5 text-[11px] border transition-colors ${
              done ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
            }`}
          >
            {done ? (lang === 'zh' ? '重置反应' : 'Reset') : (lang === 'zh' ? '开始反应' : 'React')}
          </button>
        </div>
        <svg viewBox="0 0 300 220" className="w-full" aria-label="金属活动性实验">
          {/* 试管（圆底） */}
          <path d="M110 40 v95 a40 40 0 0 0 80 0 V40" fill="none" stroke="var(--fg)" strokeWidth="1.2" />
          <line x1="110" y1="42" x2="190" y2="42" stroke="var(--fg)" strokeWidth="1.2" />
          {/* 溶液（圆底） */}
          <path d="M112 70 V130 A38 38 0 0 0 188 130 V70 Z" fill={solColor} stroke="none" />
          {/* 液面 */}
          <line x1="112" y1="70" x2="188" y2="70" stroke="var(--fg)" strokeWidth="0.8" strokeDasharray="3 2" />
          {/* 金属丝（伸入溶液，下端圆头） */}
          <line x1="150" y1="42" x2="150" y2={done ? 148 : 100} stroke={isAlCu ? METALS.al.color : METALS.cu.color} strokeWidth="3" strokeLinecap="round" />
          {/* 析出金属（反应后，在金属丝表面） */}
          {done && (
            <>
              <circle cx="145" cy="112" r="2.6" fill={depositColor} />
              <circle cx="155" cy="120" r="2.4" fill={depositColor} />
              <circle cx="150" cy="130" r="2.8" fill={depositColor} />
              <circle cx="141" cy="126" r="2.2" fill={depositColor} />
              <circle cx="158" cy="133" r="2" fill={depositColor} />
            </>
          )}
          {/* 标签 */}
          <text x="150" y="30" textAnchor="middle" fontSize="11" fill="var(--fg)" fontFamily="var(--f-mono)">{metalLabel}</text>
          <text x="150" y="205" textAnchor="middle" fontSize="10" fill="var(--muted)" fontFamily="var(--f-mono)">{solutionLabel}</text>
        </svg>
        <p className="text-xs text-[var(--muted)] serif-font italic">
          {done
            ? `${lang === 'zh' ? '现象：' : 'Observe: '}${metalLabel} ${lang === 'zh' ? '表面析出' : 'deposits'} ${depositLabel}，${solChange}`
            : (lang === 'zh' ? '点击「开始反应」，观察金属丝表面的变化。' : 'Click "React" and watch the wire surface.')}
        </p>
      </div>

      {/* ── 幕内容 ── */}
      {stage === 'predict' && (
        <div className="border border-[var(--border)] p-4 space-y-4">
          <h3 className="text-[11px] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">// {c.predictTitle}</h3>
          <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">{c.predictQuestion}</p>
          {renderConcludeQ('q3', c.predictQ1, [{ value: 'alcuag', label: c.predictQ1AlCuAg }, { value: 'cualag', label: c.predictQ1CuAlAg }, { value: 'agcual', label: c.predictQ1AgCuAl }], predict1 as string, (v) => setPredict1(v as PredictQ))}
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
          {renderConcludeQ('q1', c.concludeQ1, [{ value: 'redcu', label: c.concludeQ1RedCu }, { value: 'nothing', label: c.concludeQ1Nothing }, { value: 'ag', label: c.concludeQ1Ag }], concl.q1, (v) => setConcl((p) => ({ ...p, q1: v })))}
          {renderConcludeQ('q2', c.concludeQ2, [{ value: 'ag', label: c.concludeQ2Ag }, { value: 'nothing', label: c.concludeQ2Nothing }, { value: 'cu', label: c.concludeQ2Cu }], concl.q2, (v) => setConcl((p) => ({ ...p, q2: v })))}
          {renderConcludeQ('q3', c.concludeQ3, [{ value: 'alcuag', label: c.concludeQ3AlCuAg }, { value: 'cualag', label: c.concludeQ3CuAlAg }, { value: 'agcual', label: c.concludeQ3AgCuAl }], concl.q3, (v) => setConcl((p) => ({ ...p, q3: v })))}
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

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
import { useEffect, useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import { setLabState, setPageQuestion } from '../../lib/ai-dynamic-questions';
import { useApp } from '../../lib/app-context';
import ExploreStage, { type Observation, type ExploreCard } from '../../components/lab/ExploreStage';
import StageNav from '../../components/lab/StageNav';
import Formula from '../../components/ui/Formula';

type Stage = 'predict' | 'explore' | 'conclude';

/** 预测题 */
type PredictQ = 'alcUag' | 'cuAlag' | 'agCual' | null;

/** 反应卡 */
type ReactCard = 'al-cuso4' | 'cu-agno3';

/** 金属丝颜色：color = 打磨后的金属本色，oxide = 未打磨时表面氧化膜的暗哑覆盖色
 *  铜统一为紫红系 #b8533a（中考答题词「紫红色固体」），全站不再使用亮橙 #e08a3c */
const METALS = {
  al: { zh: '铝丝 Al', en: 'Al wire', color: '#c8cdd4', oxide: '#8b9299' },
  cu: { zh: '铜丝 Cu', en: 'Cu wire', color: '#b8533a', oxide: '#7a4436' },
};

/** 置换反应的前提条件：金属丝必须先经砂纸打磨除去表面氧化膜 */
export function canReact(polished: boolean): boolean {
  return polished;
}

/** 当前金属丝的显色：未打磨 = 氧化膜（暗哑）→ 打磨后 = 金属本色（有光泽） */
export function wireColor(react: ReactCard, polished: boolean): string {
  const m = react === 'al-cuso4' ? METALS.al : METALS.cu;
  return polished ? m.color : m.oxide;
}

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
    polishLabel: '用砂纸打磨', polishedLabel: '已打磨', oxideLabel: '氧化膜',
    hintPolish: '先用砂纸打磨金属丝，除去表面的氧化膜，再开始反应。',
    oxideWarn: {
      al: '铝丝表面有一层致密的氧化铝薄膜，它把铝和硫酸铜溶液隔开了——几乎看不到反应。先用砂纸打磨除去氧化膜，再浸入溶液。',
      cu: '铜丝表面有一层氧化膜（表面发暗），阻碍铜与硝酸银溶液接触。先用砂纸打磨除去氧化膜，再浸入溶液。',
    },
    cards: [
      { title: 'Al + CuSO₄', prompt: '先用砂纸打磨铝丝除去氧化膜，再浸入硫酸铜溶液：铝丝表面析出什么？溶液颜色变怎样？' },
      { title: 'Cu + AgNO₃', prompt: '先用砂纸打磨铜丝除去氧化膜，再浸入硝酸银溶液：铜丝表面析出什么？溶液颜色变怎样？' },
      { title: '自由探索', prompt: '对比两个置换反应，判断谁更活泼。' },
    ],
    concludeTitle: '结论',
    concludeQuestion: '综合你的探索，三种金属活动性如何排序？',
    concludeHint: '选完三题，看看结论和你的观察是否一致',
    feedbackText:
      '铝能从硫酸铜溶液中置换出铜（Al 表面析出红色 Cu，溶液蓝色变浅，完全反应后近无色）；' +
      '铜能从硝酸银溶液中置换出银（Cu 表面析出银白色 Ag，溶液变蓝）。' +
      '活动性：Al > Cu > Ag。活泼的金属能把不活泼的金属从其盐溶液中置换出来。' +
      '实验前用砂纸打磨金属丝，是为了除去表面氧化膜，让金属与溶液充分接触。',
    tipsTitle: '考点速记',
    tips: [
      '金属活动性顺序（常见）：K Ca Na Mg Al Zn Fe Sn Pb (H) Cu Hg Ag Pt Au',
      '实验前必须用砂纸打磨金属丝：铝表面会形成致密的氧化铝薄膜，隔开铝与溶液，打磨后才容易观察到现象',
      'Al > Cu：铝置换铜，2Al + 3CuSO₄ → Al₂(SO₄)₃ + 3Cu（铜从溶液中析出）',
      'Cu > Ag：铜置换银，Cu + 2AgNO₃ → Cu(NO₃)₂ + 2Ag',
      '活泼金属 + 盐溶液 → 不活泼金属 + 新盐（置换反应）',
      '越靠前越活泼，越容易与酸/盐溶液反应',
    ],
    concludeQ1: '铝丝浸入 CuSO₄ 溶液，铝丝表面？',
    concludeQ1RedCu: '表面析出红色的铜',
    concludeQ1Nothing: '表面没有明显变化',
    concludeQ1Ag: '表面析出银白色的银',
    concludeQ2: '铜丝浸入 AgNO₃ 溶液，铜丝表面？',
    concludeQ2Ag: '表面析出银白色的银',
    concludeQ2Nothing: '表面没有明显变化',
    concludeQ2Cu: '表面析出红色的铜',
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
    polishLabel: 'Polish with Sandpaper', polishedLabel: 'Polished', oxideLabel: 'oxide film',
    hintPolish: 'Polish the wire with sandpaper to remove the oxide film, then start the reaction.',
    oxideWarn: {
      al: 'A dense aluminium oxide film covers the wire and keeps the aluminium away from the copper sulfate solution — almost no reaction is visible. Polish the film off with sandpaper first, then dip the wire in.',
      cu: 'An oxide film (the surface looks dull) on the copper wire hinders contact with the silver nitrate solution. Polish the film off with sandpaper first, then dip the wire in.',
    },
    cards: [
      { title: 'Al + CuSO₄', prompt: 'Polish the Al wire with sandpaper to remove the oxide film, then dip it into copper sulfate: what forms on the Al? How does the solution color change?' },
      { title: 'Cu + AgNO₃', prompt: 'Polish the Cu wire with sandpaper to remove the oxide film, then dip it into silver nitrate: what forms on the Cu? How does the solution color change?' },
      { title: 'Free exploration', prompt: 'Compare the two displacement reactions to judge which metal is more active.' },
    ],
    concludeTitle: 'Conclude',
    concludeQuestion: 'Based on your exploration, how do the three metals rank by activity?',
    concludeHint: 'Answer all three questions, then check if your conclusion matches.',
    feedbackText:
      'Aluminium displaces copper from CuSO₄ (red Cu appears on Al; blue solution fades), ' +
      'and copper displaces silver from AgNO₃ (silvery Ag appears on Cu; solution turns blue). ' +
      'Activity: Al > Cu > Ag. A more active metal displaces a less active one from its salt solution. ' +
      'Polishing the wire with sandpaper beforehand removes the oxide film so the metal can contact the solution.',
    tipsTitle: 'Key Points',
    tips: [
      'Common activity series: K Ca Na Mg Al Zn Fe Sn Pb (H) Cu Hg Ag Pt Au',
      'Polish the wire with sandpaper before the experiment: aluminium forms a dense oxide film that keeps it away from the solution',
      'Al > Cu: aluminium displaces copper from its salt solution',
      'Cu > Ag: copper displaces silver, Cu + 2AgNO₃ → Cu(NO₃)₂ + 2Ag',
      'Active metal + salt solution → less active metal + new salt (displacement)',
      'Further left = more active, reacts more readily with acids/salt solutions',
    ],
    concludeQ1: 'Al wire in CuSO₄ solution shows?',
    concludeQ1RedCu: 'red copper deposits on the wire',
    concludeQ1Nothing: 'no visible change on the wire',
    concludeQ1Ag: 'silvery-white silver on the wire',
    concludeQ2: 'Cu wire in AgNO₃ solution shows?',
    concludeQ2Ag: 'silvery-white silver on the wire',
    concludeQ2Nothing: 'no visible change on the wire',
    concludeQ2Cu: 'red copper deposits on the wire',
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

/** 判定标记图标：统一 Lucide 矢量图标与尺寸/对齐，禁用「对勾 / 叉号」文本字符充当图标（全站图标纪律） */
const MARK_CLS = 'inline-block w-3.5 h-3.5 align-middle mr-1';

/** 选项定义（value + 文案键），数组顺序即渲染顺序。
 *  顺序已打乱：正确项不再恒在首位，避免「总选第一项」蒙对。
 *  判题按 value 比对（QUIZ_CORRECT），与渲染顺序解耦，故重排不影响正误判定。 */
export const OPTIONS = {
  predictQ1: [['cualag', 'predictQ1CuAlAg'], ['alcuag', 'predictQ1AlCuAg'], ['agcual', 'predictQ1AgCuAl']],
  concludeQ1: [['nothing', 'concludeQ1Nothing'], ['ag', 'concludeQ1Ag'], ['redcu', 'concludeQ1RedCu']],
  concludeQ2: [['ag', 'concludeQ2Ag'], ['nothing', 'concludeQ2Nothing'], ['cu', 'concludeQ2Cu']],
  concludeQ3: [['alcuag', 'concludeQ3AlCuAg'], ['cualag', 'concludeQ3CuAlAg'], ['agcual', 'concludeQ3AgCuAl']],
} as const;

/** 题号 → 判题正确值：预测题为「活动性顺序」，结论题为各现象（与 CORRECT_KEYS 对齐） */
export const QUIZ_CORRECT: Record<string, string[]> = {
  predictQ1: CORRECT_KEYS.q3,
  concludeQ1: CORRECT_KEYS.q1,
  concludeQ2: CORRECT_KEYS.q2,
  concludeQ3: CORRECT_KEYS.q3,
};

export default function MetalActivity() {
  const { lang } = useApp();
  const c = copy[lang as Lang] ?? copy.zh;

  const [stage, setStage] = useState<Stage>('predict');
  const [react, setReact] = useState<ReactCard>('al-cuso4');
  const [done, setDone] = useState(false); // 是否已完成反应
  const [polished, setPolished] = useState(false); // 是否已用砂纸打磨（未打磨时表面有氧化膜，反应无法进行）
  const [nudge, setNudge] = useState(false); // 未打磨就点反应时的教学提示
  const [progress, setProgress] = useState(0); // 反应进度 0→1（渐进动画）
  const [predict1, setPredict1] = useState<PredictQ>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [obsId, setObsId] = useState(0);
  const [concl, setConcl] = useState<{ q1: string | null; q2: string | null; q3: string | null }>({ q1: null, q2: null, q3: null });
  const [showFeedback, setShowFeedback] = useState(false);

  const predComplete = predict1 !== null;
  const concludeComplete = Boolean(concl.q1 && concl.q2 && concl.q3);

  // 当前反应的现象描述
  const isAlCu = react === 'al-cuso4';
  const metalLabel = isAlCu ? (lang === 'zh' ? '铝丝 Al' : 'Al wire') : (lang === 'zh' ? '铜丝 Cu' : 'Cu wire');
  const solutionLabel = isAlCu ? (lang === 'zh' ? '硫酸铜 CuSO₄' : 'CuSO₄') : (lang === 'zh' ? '硝酸银 AgNO₃' : 'AgNO₃');
  // 析出物
  const depositLabel = isAlCu ? (lang === 'zh' ? '红色 Cu' : 'red Cu') : (lang === 'zh' ? '银白色 Ag' : 'silvery Ag');
  // 析出的铜为紫红色（对应中考答题词「红色 / 紫红色固体」），不得用亮橙色
  const depositColor = isAlCu ? '#b8533a' : '#cfd6dc';
  // 溶液颜色：Al+CuSO₄ 初始蓝色(CuSO₄) → 反应后无色(Cu²⁺消耗)；Cu+AgNO₃ 初始无色 → 反应后蓝色(Cu(NO₃)₂)
  // 用 progress 渐变过渡（反应逐渐进行）
  const fromColor = isAlCu ? [60, 120, 220] : [225, 228, 234];
  const toColor = isAlCu ? [245, 247, 250] : [70, 140, 215];
  const alpha = isAlCu ? Math.max(0.1, 0.35 - 0.25 * progress) : Math.min(0.4, 0.25 + 0.15 * progress);
  const mix = fromColor.map((c, i) => Math.round(c + (toColor[i] - c) * progress));
  const solColor = `rgba(${mix[0]}, ${mix[1]}, ${mix[2]}, ${alpha.toFixed(2)})`;
  const depositVisible = progress > 0.1; // 析出物随反应渐显
  const depositOpacity = Math.min(1, (progress - 0.1) / 0.5);
  // 中考规范表述：不得绝对化断言「变无色」——仅「蓝色变浅」，完全反应后才是近无色
  const solChange = isAlCu
    ? (lang === 'zh' ? '溶液蓝色变浅（完全反应后近无色）' : 'solution turns lighter blue (nearly colorless upon completion)')
    : (lang === 'zh' ? '溶液变为蓝色' : 'solution turns blue');

  // 反应进度动画：done 后 progress 0→1 渐显（模拟置换反应逐渐进行）
  useEffect(() => {
    if (!done) { setProgress(0); return; }
    setProgress(0);
    let p = 0;
    const timer = setInterval(() => {
      p += 0.12;
      if (p >= 1) { p = 1; clearInterval(timer); }
      setProgress(p);
    }, 100);
    return () => clearInterval(timer);
  }, [done, react]);

  /** 砂纸打磨：除去表面氧化膜，露出金属本色的光泽 */
  function polish() {
    setPolished(true);
    setNudge(false);
  }

  function redoAll() {
    setStage('predict');
    setReact('al-cuso4'); setDone(false);
    setPolished(false); setNudge(false);
    setProgress(0);
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
          // 探索卡演示的是「完整正确操作」：先打磨除去氧化膜，再浸入溶液反应
          const which: ReactCard = card.title.includes('Cu + AgNO₃') ? 'cu-agno3' : 'al-cuso4';
          setReact(which); setPolished(true); setNudge(false); setDone(true);
        },
      })),
    [c],
  );

  /** 按 OPTIONS 定义的顺序生成选项（文案键 → 当前语言文案） */
  const opts = (key: keyof typeof OPTIONS) =>
    OPTIONS[key].map(([value, labelKey]) => ({
      value: value as string,
      label: (c as unknown as Record<string, string>)[labelKey],
    }));

  function renderQ(question: string, options: { value: string; label: string }[], selected: string | null, onSelect: (v: string) => void, correctKeys: string[]) {
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
            return (
              <button key={opt.value} type="button" onClick={() => onSelect(opt.value)} disabled={showFeedback}
                className={`${cls} ${showFeedback ? 'opacity-60 cursor-not-allowed' : ''}`}>
                {showFeedback && (isCorrect
                  ? <Check className={MARK_CLS} aria-hidden />
                  : isSel
                    ? <X className={MARK_CLS} aria-hidden />
                    : null)}{opt.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // AI：实时状态登记（当前阶段 + 核心受控变量），供系统提示词与「问 AI」动态问句读取
  useEffect(() => {
    setLabState('metal-activity', { stage, react, done, polished });
  }, [stage, react, done, polished]);
  // 页面级「问 AI」问句：登记到页级注册表，点击标题旁入口时取用（动态实验含当前读数）
  useEffect(() => {
    setPageQuestion('metal-activity', lang === 'zh' ? '请讲解金属活动性顺序，以及为什么铝能置换铜、铜能置换银' : 'Explain the metal activity series and why Al displaces Cu and Cu displaces Ag');
  }, [lang]);

  return (
    <div className="space-y-6">
      {/* ── 幕导航：全站共享 StageNav，胶囊槽样式/高度/触控与四实验保持一致 ── */}
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

      {/* ── 反应卡切换（换一根金属丝 → 打磨状态归零） ── */}
      <div className="flex gap-2">
        <button type="button" onClick={() => { setReact('al-cuso4'); setDone(false); setPolished(false); setNudge(false); }}
          className={`px-3 py-1.5 text-[0.6875rem] border transition-colors ${react === 'al-cuso4' ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'}`}>
          Al + CuSO₄
        </button>
        <button type="button" onClick={() => { setReact('cu-agno3'); setDone(false); setPolished(false); setNudge(false); }}
          className={`px-3 py-1.5 text-[0.6875rem] border transition-colors ${react === 'cu-agno3' ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'}`}>
          Cu + AgNO₃
        </button>
      </div>

      {/* ── 实验示意 ── */}
      <div className="border border-[var(--border)] p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">// {c.readout}</h3>
          <div className="flex items-center gap-1.5">
            {/* 打磨按钮：实验前必须先用砂纸打磨，除去表面氧化膜 */}
            <button
              type="button"
              onClick={polish}
              disabled={polished}
              className={`px-3 py-1.5 text-[0.6875rem] border transition-colors ${
                polished
                  ? 'border-[var(--fg)] text-[var(--fg)] opacity-60'
                  : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)]'
              }`}
            >
              {polished ? c.polishedLabel : c.polishLabel}
            </button>
            <button
              type="button"
              onClick={() => {
                // 未打磨时表面氧化膜阻隔溶液接触：只给教学提示，不启动反应
                if (!canReact(polished)) { setNudge(true); return; }
                setNudge(false);
                setDone((p) => !p);
              }}
              className={`px-3 py-1.5 text-[0.6875rem] border transition-colors ${
                done ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
              }`}
            >
              {done ? (lang === 'zh' ? '重置反应' : 'Reset') : (lang === 'zh' ? '开始反应' : 'React')}
            </button>
          </div>
        </div>
        <svg viewBox="0 0 300 220" className="w-full" aria-label="金属活动性实验" strokeLinecap="round" strokeLinejoin="round">
          {/* 试管（圆底） */}
          <path d="M110 40 v95 a40 40 0 0 0 80 0 V40" fill="none" stroke="var(--fg)" strokeWidth="1.2" />
          <line x1="110" y1="42" x2="190" y2="42" stroke="var(--fg)" strokeWidth="1.2" />
          {/* 溶液（圆底） */}
          <path d="M112 70 V130 A38 38 0 0 0 188 130 V70 Z" fill={solColor} stroke="none" />
          {/* 液面 */}
          <line x1="112" y1="70" x2="188" y2="70" stroke="var(--fg)" strokeWidth="0.8" strokeDasharray="3 2" />
          {/* 金属丝（伸入溶液，下端圆头）。长度恒定：置换反应只改变表面覆盖物，
              绝不随反应进度改变 y2——旧实现 y2 由 100 拉伸到 148（+83%），属物理形变。
              未打磨时呈暗哑氧化膜并附虚线膜层示意；打磨后呈金属本色并加一道高光。 */}
          <line x1="150" y1="42" x2="150" y2="100" stroke={wireColor(react, polished)} strokeWidth="1.5" strokeLinecap="round" style={{ transition: 'stroke 0.28s ease-out' }} />
          {!polished && (
            <g style={{ transition: 'opacity 0.28s ease-out' }}>
              <line x1="150" y1="42" x2="150" y2="100" stroke="var(--muted)" strokeWidth="3.8" strokeDasharray="2 2.4" opacity="0.5" strokeLinecap="round" />
              <text x="196" y="60" fontSize="8.5" fill="var(--muted)" fontFamily="var(--f-mono)" textAnchor="start">{c.oxideLabel}</text>
            </g>
          )}
          {polished && (
            <line x1="149.55" y1="44" x2="149.55" y2="98" stroke="rgba(255, 255, 255, 0.55)" strokeWidth="0.6" strokeLinecap="round" />
          )}
          {/* 析出物层：覆盖在金属丝浸入段（液面 y=70 以下）表面，随进度渐显，不改动金属丝几何 */}
          {done && depositVisible && (
            <g style={{ opacity: depositOpacity, transition: 'opacity 0.15s' }}>
              <line x1="150" y1="72" x2="150" y2="100" stroke={depositColor} strokeWidth="3.6" strokeLinecap="round" />
              {[76, 82, 88, 94].map((cy, i) => (
                <circle key={cy} cx={i % 2 === 0 ? 148.6 : 151.4} cy={cy} r={1.5} fill={depositColor} opacity="0.85" />
              ))}
            </g>
          )}
          {/* 标签 */}
          <text x="150" y="30" textAnchor="middle" fontSize="11" fill="var(--fg)" fontFamily="var(--f-mono)">{metalLabel}</text>
          <text x="150" y="205" textAnchor="middle" fontSize="10" fill="var(--muted)" fontFamily="var(--f-mono)">{solutionLabel}</text>
        </svg>
        <p className="text-xs text-[var(--muted)] serif-font italic">
          {done
            ? `${lang === 'zh' ? '现象：' : 'Observe: '}${metalLabel} ${lang === 'zh' ? '表面析出' : 'deposits'} ${depositLabel}，${solChange}`
            : polished
              ? (lang === 'zh' ? '点击「开始反应」，观察金属丝表面的变化。' : 'Click "React" and watch the wire surface.')
              : c.hintPolish}
        </p>
        {/* 未打磨就点反应 → 教学提示（不触发反应） */}
        {nudge && !polished && (
          <p className="text-xs serif-font leading-relaxed border-l-2 border-[var(--fg)] pl-3 text-[var(--fg)]">
            {c.oxideWarn[isAlCu ? 'al' : 'cu']}
          </p>
        )}
      </div>

      {/* ── 幕内容 ── */}
      {stage === 'predict' && (
        <div className="border border-[var(--border)] p-4 space-y-4">
          <h3 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">// {c.predictTitle}</h3>
          <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">{c.predictQuestion}</p>
          {renderQ(c.predictQ1, opts('predictQ1'), predict1 as string, (v) => setPredict1(v as PredictQ), QUIZ_CORRECT.predictQ1)}
          {predComplete ? (
            <button type="button" onClick={() => setStage('explore')} className="inline-flex items-center gap-1.5 text-xs mono-font px-3 py-1.5 border border-[var(--fg)] text-[var(--fg)] hover:bg-[var(--accent-light)] transition-colors">
              <Check className="w-3.5 h-3.5" aria-hidden />
              <span>{c.predictDone} — {c.revealLabel}</span>
            </button>
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
          {renderQ(c.concludeQ1, opts('concludeQ1'), concl.q1, (v) => setConcl((p) => ({ ...p, q1: v })), QUIZ_CORRECT.concludeQ1)}
          {renderQ(c.concludeQ2, opts('concludeQ2'), concl.q2, (v) => setConcl((p) => ({ ...p, q2: v })), QUIZ_CORRECT.concludeQ2)}
          {renderQ(c.concludeQ3, opts('concludeQ3'), concl.q3, (v) => setConcl((p) => ({ ...p, q3: v })), QUIZ_CORRECT.concludeQ3)}
          {concludeComplete && !showFeedback && (
            <button type="button" onClick={() => setShowFeedback(true)} className="compact text-xs mono-font px-3 py-1.5 border border-[var(--fg)] text-[var(--fg)] hover:bg-[var(--accent-light)] transition-colors">{c.concludeHint}</button>
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

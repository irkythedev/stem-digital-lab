/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 化学工具页 · 化学式与化合价
 *
 * 单页四模式（2026-10-30 拍板）：
 *   - reference 速查：元素价态、7 个原子团、口诀与常见物质；
 *   - builder   生成：十字交叉 → 约简 → 加括号 → 检验，实时给出化学式；
 *   - solver    反推：由化学式与目标和求化合价，含 NH₄NO₃ / Fe₃O₄ 特例；
 *   - practice  练习：固定题库、精确错因、错题进入站点错题本。
 *
 * 所有计算走 src/lib/chemistry/formula-core.ts（纯 TS，无 WASM），
 * URL 查询串持久化模式与选择，支持周期表深链与刷新恢复。
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  FlaskConical,
  ChevronDown,
  RotateCcw,
  Search,
  Square,
  Volume2,
  X,
} from 'lucide-react';
import BackLink from '../components/layout/BackLink';
import BenchSelect from '../components/ui/BenchSelect';
import ShareInline from '../components/share/ShareInline';
import AskAiButton from '../components/ai/AskAiButton';
import ChemFormula, { FormulaText, ValenceBadge } from '../components/chemistry/ChemFormula';
import ElementDetailSheet, { useElementDetailState } from '../components/elements/ElementDetailSheet';
import { elementBySymbol } from '../lib/elements';
import { CAT_COLOR } from '../lib/element-categories';

/** 元素分类短标签（卡片右上角微标签；过长会挤压符号）。 */
const CATEGORY_SHORT: Record<'metal' | 'nonmetal' | 'noble' | 'metalloid', { zh: string; en: string }> = {
  metal: { zh: '金属', en: 'Metal' },
  nonmetal: { zh: '非金属', en: 'Non-metal' },
  noble: { zh: '稀有气体', en: 'Noble' },
  metalloid: { zh: '类金属', en: 'Metalloid' },
};
import { useApp } from '../lib/app-context';
import { useAiContext } from '../lib/ai-context';
import { usePageMeta, learningResourceLd } from '../lib/use-page-meta';
import { useSpeak } from '../lib/use-speak';
import { saveQuizHistory } from '../lib/quiz-history';
import {
  CHEM_MODES,
  PRACTICE_KIND_LABEL,
  PRACTICE_CATEGORY_LABEL,
  PRACTICE_CATEGORY_ORDER,
  PRACTICE_QUESTIONS,
  chemistryQuery,
  crossValence,
  isFormulaError,
  massFraction,
  molarMass,
  parseChemistryQuery,
  parseFormula,
  practiceQuestions,
  preselectFromSymbol,
  solveValence,
  atomCounts,
  formatMass,
  formatValence,
  normalizeFormulaCase,
  AMBIGUOUS_PAIRS,
  type ChemMode,
  type IonRef,
  type PracticeCategory,
  type PracticeQuestion,
} from '../lib/chemistry/formula-core';
import {
  ION_GROUPS,
  TEXTBOOK_MASSES,
  TYPICAL_COMPOUNDS,
  VALENCE_ELEMENTS,
  VALENCE_MNEMONIC,
  compoundKind,
  ionGroupByFormula,
  periodicElementOf,
  shellMechanism,
  valenceElementBySymbol,
  type Bi,
  type CompoundKind,
} from '../lib/chemistry/valency';
import { nameCompound } from '../lib/chemistry/formula-name';
import { intToChinese, valenceToSpeech, expressionToSpeech, sanitizeMrSpoken } from '../lib/chem-speech';

const MODE_LABEL: Record<ChemMode, Bi> = {
  reference: { zh: '速查', en: 'Reference' },
  builder: { zh: '生成', en: 'Builder' },
  solver: { zh: '反推', en: 'Solver' },
  practice: { zh: '练习', en: 'Practice' },
};

const pick = (b: Bi, lang: 'zh' | 'en') => b[lang];

const SearchIcon = Search;
const SpeakIcon = Volume2;

/**
 * 常见物质分类色：只染 1px 边框与 10% 淡底，文字仍用 --fg。
 * 色值全部取自既有 token（图表分类色 + --danger），明暗两套已各自校准过
 * ≥3:1 的非文本图形门槛；不在这里写 hex，避免暗色主题单独漂移。
 */
const COMPOUND_TAG_COLOR: Record<CompoundKind, string> = {
  oxide: 'var(--muted)',
  'metal-oxide': 'var(--chart-2)',
  'nonmetal-oxide': 'var(--chart-5)',
  'special-oxide': 'var(--chart-6)',
  salt: 'var(--chart-3)',
  'acid-salt': 'var(--chart-4)',
  base: 'var(--chart-1)',
  acid: 'var(--danger)',
};

/** 未登记的类别回退为纯文本：宁可少一个颜色，也不猜一个语义。 */
function CompoundTag({ category, lang }: { category: Bi; lang: 'zh' | 'en' }) {
  const kind = compoundKind(category);
  if (!kind) {
    return <span className="block text-[0.625rem] serif-font text-[var(--muted)]">{pick(category, lang)}</span>;
  }
  const color = COMPOUND_TAG_COLOR[kind];
  return (
    <span
      className="inline-flex w-fit items-center rounded-xs border px-1.5 py-0.5 text-[0.625rem] leading-none mono-font text-[var(--fg)]"
      style={{
        borderColor: color,
        backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`,
      }}
    >
      {pick(category, lang)}
    </span>
  );
}

export default function ChemistryFormulas() {
  const { t, lang } = useApp();
  const zh = lang === 'zh';

  const pageMeta = useMemo(
    () => ({
      title: `${zh ? '化学式与化合价' : 'Chemical Formulas and Valence'} - ${t.brandName}`,
      description: zh
        ? '初中化学式与化合价工具：元素价态速查、十字交叉生成化学式、由化学式反推化合价，附四大分类题库（18 道）与精确错因。'
        : 'Junior-high chemical formulas and valence: reference, cross-rule formula builder, valence solver, and a four-category practice bank (18 items) with precise diagnostics.',
      // 工具页只声明自己的交互工具身份；完整讲解的 FAQ/HowTo 在 /learn/chemistry-formulas
      jsonLd: learningResourceLd({
        name: zh ? '化学式与化合价' : 'Chemical Formulas and Valence',
        description: zh
          ? '初中化学式与化合价交互工具：价态速查、十字交叉生成、由式反推与六类练习。'
          : 'Junior-high chemical formulas and valence: reference, cross-rule builder, valence solver and a four-category practice bank.',
        url: 'https://stem.irky.dev/chemistry-formulas',
        resourceType: zh ? '交互工具' : 'Interactive Tool',
      }),
    }),
    [zh, lang, t.brandName],
  );
  usePageMeta(pageMeta);

  const [searchParams, setSearchParams] = useSearchParams();
  const initial = useMemo(() => parseChemistryQuery(searchParams), []); // 只读首屏参数
  const initialState = useMemo(() => {
    if (initial.cation || initial.anion) {
      return { cation: initial.cation, anion: initial.anion };
    }
    if (initial.symbol) return preselectFromSymbol(initial.symbol) ?? { cation: null, anion: null };
    return { cation: null, anion: null };
  }, [initial]);

  const [mode, setMode] = useState<ChemMode>(initial.mode);
  const [symbol, setSymbol] = useState<string | null>(initial.symbol);
  const [cation, setCation] = useState<IonRef | null>(initialState.cation);
  const [anion, setAnion] = useState<IonRef | null>(initialState.anion);
  const [query, setQuery] = useState('');
  const [solverFormula, setSolverFormula] = useState(initial.formula ?? 'Fe2O3');
  const [solverTarget, setSolverTarget] = useState('Fe');
  // 大小写歧义备选（如 co 默认 CO，可一键切换为金属钴 Co）。
  const [caseAlt, setCaseAlt] = useState<string | null>(null);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [practiceCategory, setPracticeCategory] = useState<PracticeCategory>('basic');
  const [variantQuestion, setVariantQuestion] = useState<PracticeQuestion | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  // 原地元素详情抽屉：点击化学式里的元素或速查卡片时设置，避免整页跳走丢失上下文。
  // 深链进入速查（?symbol=Fe）时直接弹出该元素详情。
  const [activeDetailElement, setActiveDetailElement] = useState<string | null>(
    initial.mode === 'reference' ? initial.symbol ?? null : null,
  );
  // 速查页原子团 Chip：点击就地展开「价态 + 经典化合物」，与元素卡片一致。
  const [activeIonFormula, setActiveIonFormula] = useState<string | null>(null);

  const { setAiCtx } = useAiContext();
  const { state: speakState, speak, stop: stopSpeak } = useSpeak();
  const speaking = speakState === 'synthesizing' || speakState === 'playing';

  // 原地元素详情抽屉：与周期表共用同一份详情组件 + 同一套状态接线（useElementDetailState）。
  const detailElement = activeDetailElement ? elementBySymbol.get(activeDetailElement) ?? null : null;
  const detailState = useElementDetailState(detailElement, lang);

  // 规范中文名（多价态金属按「亚」处理，如 FeCl₂ 氯化亚铁 / FeCl₃ 氯化铁）。
  const solverCompound = nameCompound(solverFormula);

  /**
   * 化学式大小写智能规范化：只在失焦 / 回车 / 解析时触发，不在 onChange 实时强转，
   * 避免打字时跳光标。歧义输入（co/no/cs/hf）额外给出可切换的元素备选。
   */
  const applyFormulaCaseNormalization = () => {
    const src = solverFormula.trim();
    if (!src) {
      setCaseAlt(null);
      return;
    }
    const norm = normalizeFormulaCase(src);
    if (norm && norm !== solverFormula) setSolverFormula(norm);
    const lower = src.toLowerCase();
    if (AMBIGUOUS_PAIRS.has(lower)) {
      const alt = normalizeFormulaCase(src, 'element');
      setCaseAlt(alt && alt !== norm ? alt : null);
    } else {
      setCaseAlt(null);
    }
  };

  // URL 同步：刷新恢复、可分享、可被周期表深链打开。
  useEffect(() => {
    setSearchParams(chemistryQuery({ mode, cation, anion, symbol }), { replace: true });
  }, [mode, cation, anion, symbol, setSearchParams]);

  const builderResult = useMemo(() => {
    if (!cation || !anion) return null;
    return crossValence(cation.formula, anion.formula, cation.charge, anion.charge);
  }, [cation, anion]);

  const builderName = useMemo(() => {
    if (!builderResult || isFormulaError(builderResult)) return null;
    return nameCompound(builderResult.formula);
  }, [builderResult]);

  const solverParsed = useMemo(() => parseFormula(solverFormula), [solverFormula]);
  const solverElements = useMemo(() => {
    if (isFormulaError(solverParsed)) return [];
    return [...atomCounts(solverParsed).keys()];
  }, [solverParsed]);
  const effectiveTarget =
    solverElements.includes(solverTarget) ? solverTarget : solverElements[0] ?? '';
  const solverResult = useMemo(
    () => (effectiveTarget ? solveValence(solverFormula, effectiveTarget) : null),
    [solverFormula, effectiveTarget],
  );

  // AI 上下文：把当前模式的关键信息注入助手。
  useEffect(() => {
    if (mode === 'builder' && builderResult && !isFormulaError(builderResult)) {
      setAiCtx({
        topic: `化学式生成：${builderResult.formula}`,
        knowledge: `十字交叉法：${builderResult.cation}（${formatValence(builderResult.cationCharge)}）+ ${builderResult.anion}（${formatValence(builderResult.anionCharge)}）→ ${builderResult.formula}，原子团个数大于 1 时加括号。`,
      });
    } else if (mode === 'solver' && solverResult && !isFormulaError(solverResult)) {
      setAiCtx({
        topic: `化合价反推：${solverFormula}`,
        knowledge: solverResult.answers.map((a) => `${pick(a.scope, 'zh')}：${formatValence(a.valence)}`).join('；') || pick(solverResult.note ?? { zh: '', en: '' }, 'zh'),
      });
    } else if (mode === 'reference' && symbol) {
      const el = valenceElementBySymbol.get(symbol);
      setAiCtx({
        topic: `化合价速查：${symbol}`,
        knowledge: el ? `${el.name.zh}（${el.symbol}）常见化合价：${el.valences.map(formatValence).join(' / ')}。` : `元素 ${symbol}。`,
      });
    } else {
      setAiCtx({
        topic: zh ? '化学式与化合价' : 'Chemical Formulas and Valence',
        knowledge: zh
          ? '化学式与化合价工具：速查元素与原子团价态；用十字交叉法生成化学式；由化学式反推化合价；四大分类题库（18 道）与精确错因。'
          : 'Chemical formulas and valence: look up element and polyatomic-ion valences, build formulas with the cross rule, solve valences from formulas, and practise a four-category bank (18 items) with precise diagnostics.',
      });
    }
    return () => setAiCtx({});
  }, [mode, symbol, solverFormula, solverResult, builderResult, zh, setAiCtx]);

  const filteredElements = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return VALENCE_ELEMENTS;
    return VALENCE_ELEMENTS.filter(
      (e) =>
        e.symbol.toLowerCase().includes(q) ||
        e.name.zh.includes(q) ||
        e.name.en.toLowerCase().includes(q),
    );
  }, [query]);

  const filteredIonGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ION_GROUPS;
    return ION_GROUPS.filter(
      (g) =>
        g.formula.toLowerCase().includes(q) ||
        g.name.zh.includes(q) ||
        g.name.en.toLowerCase().includes(q),
    );
  }, [query]);

  const filteredCompounds = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TYPICAL_COMPOUNDS;
    return TYPICAL_COMPOUNDS.filter(
      (c) =>
        c.formula.toLowerCase().includes(q) ||
        c.name.zh.includes(q) ||
        c.name.en.toLowerCase().includes(q),
    );
  }, [query]);

  const activeElement = symbol ? valenceElementBySymbol.get(symbol) : undefined;
  const questions = useMemo(() => practiceQuestions(PRACTICE_QUESTIONS.length), []);
  // 四大分类练习：分类内独立翻页；变式题临时覆盖当前题。
  const categoryQuestions = useMemo(
    () => questions.filter((q) => (q.category ?? 'basic') === practiceCategory),
    [questions, practiceCategory],
  );
  const baseQuestion = categoryQuestions[Math.min(practiceIndex, Math.max(0, categoryQuestions.length - 1))];
  const question = variantQuestion ?? baseQuestion;

  const speakText = (text: string) => {
    if (speaking) stopSpeak();
    else speak(sanitizeMrSpoken(text), undefined, lang);
  };

  const answerQuestion = (q: PracticeQuestion, idx: number) => {
    if (answers[q.id] !== undefined) return;
    setAnswers((prev) => ({ ...prev, [q.id]: idx }));
    const correct = idx === q.answer;
    // 错题自动入库：仅错误的练习题写入全局错题本（stem-quiz-history），
    // 与实验页共用同一存储，可在错题集回看并导出 A4 错题卷。
    if (!correct) {
      saveQuizHistory({
        path: '/chemistry-formulas',
        subject: zh ? '化学' : 'Chemistry',
        topic: zh ? '化学式与化合价' : 'Chemical formulas and valence',
        question: pick(q.prompt, 'zh'),
        options: q.options,
        answerIdx: q.answer,
        pickedIdx: idx,
        correct,
        type: 'choice',
        explanation: pick(q.explanation, 'zh'),
        model: 'local-core',
      });
    }
  };

  const chooseCategory = (c: PracticeCategory) => {
    setPracticeCategory(c);
    setPracticeIndex(0);
    setVariantQuestion(null);
  };

  /** 本地变式引擎：优先取同 kind（同考点）的另一道题，原地替换当前练习。 */
  const startVariant = () => {
    if (!question) return;
    const sameKind = questions.find(
      (q) => q.id !== question.id && q.kind === question.kind && (q.category ?? 'basic') === practiceCategory,
    );
    const sameCat = questions.find((q) => q.id !== question.id && (q.category ?? 'basic') === practiceCategory);
    const next = sameKind ?? sameCat;
    if (next) setVariantQuestion(next);
  };

  return (
    <main className="grow shrink-0 flex flex-col my-[var(--sp-block)] px-2 sm:px-6">
      <BackLink to="/subject/chemistry">{zh ? '返回化学' : 'Back to Chemistry'}</BackLink>

      <div className="mb-5">
        <h1 className="text-3xl sm:text-4xl font-medium tracking-tight serif-font text-[var(--fg)]">
          {zh ? '化学式与化合价' : 'Chemical Formulas and Valence'}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <ShareInline
            title={zh ? '化学式与化合价 · 数理化数字实验室' : 'Chemical Formulas and Valence · STEM Digital Lab'}
            text={
              zh
                ? '初中化学式与化合价：价态速查、十字交叉、由式求价、四大分类练习（18 道）与精确错因，免费使用！'
                : 'Junior-high chemical formulas and valence: reference, cross-rule builder, valence solver, and practice with precise diagnostics. Free to use!'
            }
          />
          <AskAiButton
            question={
              zh
                ? '请讲解初中化学式与化合价：十字交叉法怎么写化学式，原子团为什么要加括号'
                : 'Explain junior-high chemical formulas and valence: how the cross rule builds formulas and why polyatomic ions need brackets'
            }
          />
        </div>
        <p className="mt-2 text-xs serif-font italic text-[var(--muted)]">
          {zh
            ? '价态速查 → 十字交叉生成 → 由式反推 → 确定性练习。所有结果由纯 TS 内核计算，原子团与下标逐字可核。'
            : 'Reference → cross-rule builder → valence solver → deterministic practice. Everything is computed by a pure-TS kernel.'}
        </p>
      </div>

      {/* 模式切换：分段按钮，状态写入 URL */}
      <div
        role="tablist"
        aria-label={zh ? '功能模式' : 'Modes'}
        className="mb-4 grid grid-cols-2 gap-2 border-b border-[var(--border)] pb-3 min-[430px]:grid-cols-4 sm:flex sm:flex-wrap"
      >
        {CHEM_MODES.map((m) => {
          const active = mode === m;
          return (
            <button
              key={m}
              id={`chem-tab-${m}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`chem-panel-${m}`}
              tabIndex={active ? 0 : -1}
              onClick={() => setMode(m)}
              onKeyDown={(event) => {
                const step =
                  event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
                const current = CHEM_MODES.indexOf(m);
                const next =
                  step !== 0
                    ? CHEM_MODES[(current + step + CHEM_MODES.length) % CHEM_MODES.length]
                    : event.key === 'Home'
                      ? CHEM_MODES[0]
                      : event.key === 'End'
                        ? CHEM_MODES[CHEM_MODES.length - 1]
                        : null;
                if (!next) return;
                event.preventDefault();
                setMode(next);
                document.getElementById(`chem-tab-${next}`)?.focus();
              }}
              className={`compact tap32 leading-5 px-3 py-[0.1875rem] text-xs mono-font border transition-colors inline-flex w-full items-center justify-center sm:w-auto ${
                active
                  ? 'border-[var(--fg)] text-[var(--fg)]'
                  : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)]'
              }`}
            >
              {pick(MODE_LABEL[m], lang)}
            </button>
          );
        })}
      </div>

      {mode === 'reference' && (
        <section
          id={`chem-panel-reference`}
          role="tabpanel"
          aria-labelledby={`chem-tab-reference`}
          aria-label={zh ? '化合价速查' : 'Valence reference'}
          className="space-y-4"
        >
          <div className="border border-[var(--border)] bg-[var(--card-bg)] p-3 space-y-3">
            <div className="relative w-full sm:max-w-xs border border-[var(--border-strong)] rounded-lg focus-within:border-[var(--accent)]">
              <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted)] pointer-events-none" aria-hidden="true" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={zh ? '搜索 Fe / 硫酸 / 碳酸根' : 'Search Fe / sulfate / carbonate'}
                aria-label={zh ? '搜索元素或物质' : 'Search elements or compounds'}
                style={{ outline: 'none' }}
                className="min-h-10 w-full rounded-md border-none bg-transparent pl-8 pr-3 py-2 text-sm text-[var(--fg)] outline-none focus:outline-none focus:ring-0"
              />
            </div>

            {/* 20 个高频元素：桌面 5 列 × 4 行（消除 7 列末尾的孤立空白格） */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
              {filteredElements.map((el) => {
                const active = symbol === el.symbol;
                const info = elementBySymbol.get(el.symbol);
                return (
                  <div
                    key={el.symbol}
                    className={`relative min-h-[92px] border p-3 text-left transition-colors ${
                      active ? 'border-[var(--fg)] bg-[var(--accent-light)]' : 'border-[var(--border)] hover:border-[var(--fg)]'
                    }`}
                  >
                    {/* 右上角：极简序号 26↗（干净无虚线下划线；点击打开详情） */}
                    <button
                      type="button"
                      onClick={() => {
                        setSymbol(el.symbol);
                        setActiveDetailElement(el.symbol);
                      }}
                      aria-label={`${zh ? '查看' : 'View'} ${pick(el.name, lang)} ${zh ? '详情' : 'details'}`}
                      title={`${zh ? '查看' : 'View'} ${pick(el.name, lang)}`}
                      className="absolute right-1.5 top-1.5 inline-flex cursor-pointer items-center gap-0.5 border-none text-xs mono-font leading-none text-[var(--muted)] no-underline transition-colors hover:text-[var(--fg)]"
                    >
                      {el.atomicNumber}
                      <ArrowUpRight className="h-2.5 w-2.5 shrink-0 text-[10px] opacity-70" aria-hidden="true" />
                    </button>
                    <span className="block pr-8 text-2xl font-bold tracking-tight mono-font text-[var(--fg)]">{el.symbol}</span>
                    <span className="mt-0.5 block pr-1 text-sm font-medium serif-font text-[var(--fg)] truncate">{pick(el.name, lang)}</span>
                    <span className="mt-1 flex flex-wrap gap-0.5 pr-6">
                      {el.valences.map((v) => (
                        <span key={v} className="text-[0.625rem] mono-font text-[var(--muted)] bg-[var(--card-bg)] border border-[var(--border)] px-1 rounded-xs">
                          {formatValence(v)}
                        </span>
                      ))}
                    </span>
                    {/* 右下角：分类 tag 采用「元素详情页」同款彩色徽标（类型色边框/文字/浅底） */}
                    {info && (() => {
                      const c = CAT_COLOR[info.cat];
                      return (
                        <span
                          className="absolute bottom-1 right-1.5 inline-block rounded-xs border px-1 py-[1px] text-[0.5rem] leading-none"
                          style={{ borderColor: c.border, color: c.border, backgroundColor: c.bg }}
                        >
                          {CATEGORY_SHORT[info.cat][zh ? 'zh' : 'en']}
                        </span>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
            {filteredElements.length === 0 && (
              <p className="text-xs serif-font italic text-[var(--muted)]">
                {zh
                  ? '没有匹配的元素；原子团与常见物质在下方继续筛选。'
                  : 'No matching element; polyatomic ions and compounds are filtered below.'}
              </p>
            )}
          </div>


          {/* 常见原子团：轻量 Chip 紧凑网格；点击就地看价态与经典化合物（与元素卡片同逻辑） */}
          <div className="border border-[var(--border)] p-2.5 space-y-2">
            <h2 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
              // {zh ? '常见原子团' : 'Polyatomic ions'}
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {filteredIonGroups.map((ion) => {
                const active = activeIonFormula === ion.formula;
                return (
                  <button
                    key={ion.formula}
                    type="button"
                    data-ion-chip={ion.formula}
                    aria-pressed={active}
                    onClick={() => setActiveIonFormula(active ? null : ion.formula)}
                    aria-label={`${pick(ion.name, lang)} ${ion.charge > 0 ? '正' : '负'} ${Math.abs(ion.charge)} 价`}
                    className={`inline-flex items-center gap-1.5 border px-2 py-1 text-xs transition-colors ${
                      active
                        ? 'border-[var(--fg)] bg-[var(--accent-light)] text-[var(--fg)]'
                        : 'border-[var(--border)] text-[var(--fg)] hover:border-[var(--fg)]'
                    }`}
                  >
                    <ChemFormula formula={ion.formula} charge={ion.charge} size="sm" lang={lang} className="text-[var(--fg)]" />
                    <span className="serif-font text-[var(--muted)]">{pick(ion.name, lang)}</span>
                  </button>
                );
              })}
            </div>
            {/* 点击原子团后，详情固定出现在 Chip 网格「下方」，不再挤占上方首屏 */}
            {(() => {
              const ion = activeIonFormula ? ION_GROUPS.find((g) => g.formula === activeIonFormula) : undefined;
              const compounds = ion
                ? TYPICAL_COMPOUNDS.filter((c) => c.formula.includes(ion.formula)).slice(0, 3)
                : [];
              if (!ion) return null;
              return (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-l-2 border-[var(--accent)] pl-2 py-1 text-xs">
                  <span className="inline-flex items-baseline gap-1.5">
                    <ChemFormula formula={ion.formula} charge={ion.charge} size="sm" lang={lang} className="text-[var(--fg)]" />
                    <span className="serif-font text-[var(--fg)]">{pick(ion.name, lang)}</span>
                  </span>
                  <ValenceBadge valence={ion.charge} size="sm" />
                  {compounds.length > 0 && (
                    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-[var(--muted)]">
                      <span>{zh ? '经典化合物：' : 'Typical: '}</span>
                      {compounds.map((c) => (
                        <span key={c.formula} className="inline-flex items-baseline gap-1">
                          <ChemFormula formula={c.formula} size="sm" lang={lang} className="text-[var(--fg)]" />
                          <span className="serif-font">{pick(c.name, lang)}</span>
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              );
            })()}
          </div>

          {/* 化合价口诀：默认折叠为一行浅色提示栏，点击再展开全文，消除常驻留白 */}
          <details className="group border border-[var(--border)]">
            <summary className="flex cursor-pointer select-none items-center justify-between gap-2 bg-[var(--accent-light)]/30 px-3 py-1.5 text-[0.6875rem] font-bold uppercase tracking-widest text-[var(--muted)] mono-font">
              <span>// {zh ? '化合价口诀' : 'Valence mnemonic'}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="space-y-1 px-3 py-2">
              <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">{pick(VALENCE_MNEMONIC, lang)}</p>
              <p className="text-[0.6875rem] serif-font leading-relaxed text-[var(--muted)]">
                {zh
                  ? '口诀只是记忆线索，具体价态仍以化学式计算为准：正负化合价代数和为 0。'
                  : 'The mnemonic is a memory aid; always confirm with the zero-sum rule.'}
              </p>
            </div>
          </details>

          <div className="border border-[var(--border)] p-3 space-y-2">
            <h2 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
              // {zh ? '常见物质' : 'Common compounds'}
            </h2>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {filteredCompounds.map((c) => (
                <button
                  key={c.formula}
                  type="button"
                  onClick={() => {
                    setSolverFormula(c.formula);
                    setSolverTarget('');
                    setMode('solver');
                  }}
                  className="border border-[var(--border)] px-2 py-1.5 text-left hover:border-[var(--fg)] transition-colors"
                >
                  <span className="flex items-baseline justify-between gap-1.5">
                    <ChemFormula formula={c.formula} size="sm" lang={lang} className="text-[var(--fg)]" />
                    <span className="shrink-0 text-[0.625rem] mono-font text-[var(--muted)]">
                      <i>M</i><sub>r</sub> {formatMass(molarMass(c.formula) ?? 0)}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[0.6875rem] sm:text-xs serif-font leading-snug text-[var(--fg)]">
                    {pick(c.name, lang)}
                  </span>
                  <span className="mt-1 block">
                    <CompoundTag category={c.category} lang={lang} />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {mode === 'builder' && (
        <section
          id={`chem-panel-builder`}
          role="tabpanel"
          aria-labelledby={`chem-tab-builder`}
          aria-label={zh ? '化学式生成' : 'Formula builder'}
          className="space-y-4"
        >
          <div className="grid gap-3 lg:grid-cols-2">
            <SpeciesPicker
              title={zh ? '阳离子（正价）' : 'Cation (positive)'}
              hint={zh ? '金属、氢或铵根' : 'Metal, hydrogen, or ammonium'}
              lang={lang}
              selected={cation}
              options={[
                ...VALENCE_ELEMENTS.filter((e) => e.valences.some((v) => v > 0)).map((e) => ({
                  formula: e.symbol,
                  name: e.name,
                  valences: e.valences.filter((v) => v > 0),
                  dominant:
                    e.dominant > 0
                      ? e.dominant
                      : (e.valences.find((v) => v > 0) ?? 1),
                })),
                ...ION_GROUPS.filter((g) => g.charge > 0).map((g) => ({
                  formula: g.formula,
                  name: g.name,
                  valences: [g.charge],
                  dominant: g.charge,
                })),
              ]}
              onSelect={(formula, charge) => {
                setCation({ formula, charge });
                setSymbol(valenceElementBySymbol.has(formula) ? formula : null);
              }}
            />
            <SpeciesPicker
              title={zh ? '阴离子（负价）' : 'Anion (negative)'}
              hint={zh ? '非金属或酸根' : 'Non-metal or acid radical'}
              lang={lang}
              selected={anion}
              options={[
                ...VALENCE_ELEMENTS.filter((e) => e.valences.some((v) => v < 0)).map((e) => ({
                  formula: e.symbol,
                  name: e.name,
                  valences: e.valences.filter((v) => v < 0),
                  dominant:
                    e.dominant < 0
                      ? e.dominant
                      : (e.valences.find((v) => v < 0) ?? -1),
                })),
                ...ION_GROUPS.filter((g) => g.charge < 0).map((g) => ({
                  formula: g.formula,
                  name: g.name,
                  valences: [g.charge],
                  dominant: g.charge,
                })),
              ]}
              onSelect={(formula, charge) => {
                setAnion({ formula, charge });
                setSymbol(valenceElementBySymbol.has(formula) ? formula : null);
              }}
            />
          </div>

          {builderResult && !isFormulaError(builderResult) && (
            <div className="border border-[var(--border)] p-4 space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div className="flex items-baseline gap-3">
                  <ChemFormula formula={builderResult.formula} size="xl" ariaLabel={builderResult.formula} lang={lang} className="text-[var(--fg)]" />
                  {builderName && !('error' in builderName) && (
                    <span className="text-base serif-font text-[var(--fg)]">{pick(builderName, lang)}</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs mono-font text-[var(--muted)]">
                  <span>
                    {zh ? '相对分子质量 ' : ''}<i>M</i><sub>r</sub> = {formatMass(molarMass(builderResult.formula) ?? 0)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const name = builderName && !('error' in builderName) ? pick(builderName, lang) : '';
                      const mr = Math.round(molarMass(builderResult.formula) ?? 0);
                      speakText(`${name || builderResult.formula}，相对分子质量为${intToChinese(mr)}`);
                    }}
                    className="compact tap32 inline-flex items-center gap-1 rounded px-2 py-1 border border-[var(--border)] text-[var(--fg)] hover:border-[var(--fg)] transition-colors"
                  >
                    <SpeakIcon className="w-3.5 h-3.5" aria-hidden="true" />
                    {speaking ? (zh ? '停止' : 'Stop') : zh ? '朗读' : 'Speak'}
                  </button>
                </div>
              </div>

              <ol className="grid gap-2 sm:grid-cols-2">
                {builderResult.steps.map((step, i) => (
                  <li key={i} className={`border p-2.5 ${i < 2 ? 'border-[var(--border)]' : 'border-[var(--border)]'}`}>
                    <div className="text-[0.625rem] mono-font text-[var(--muted)] tracking-wider mb-1">
                      {pick(step.title, lang)}
                    </div>
                    <p className="text-xs serif-font leading-relaxed text-[var(--fg)]">
                      <FormulaText text={pick(step.detail, lang)} lang={lang} />
                    </p>
                  </li>
                ))}
              </ol>

              {builderName && !('error' in builderName) && (
                <p className="text-xs serif-font leading-relaxed text-[var(--muted)] border-l-2 border-[var(--border)] pl-3">
                  {pick(builderName.rule, lang)}
                  {builderName.note ? ` ${pick(builderName.note, lang)}` : ''}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <AskAiButton
                  question={
                    zh
                      ? `请讲解为什么 ${builderResult.cation}（${formatValence(builderResult.cationCharge)}）与 ${builderResult.anion}（${formatValence(builderResult.anionCharge)}）交叉后得到 ${builderResult.formula}`
                      : `Explain why ${builderResult.cation} (${formatValence(builderResult.cationCharge)}) and ${builderResult.anion} (${formatValence(builderResult.anionCharge)}) give ${builderResult.formula}`
                  }
                />
                      <button
                  type="button"
                  onClick={() => {
                    setSolverFormula(builderResult.formula);
                    setSolverTarget(builderResult.cation);
                    setMode('solver');
                  }}
                  className="inline-flex items-center gap-1 text-xs mono-font text-[var(--fg)] underline decoration-[var(--border)] underline-offset-4 hover:decoration-[var(--fg)]"
                >
                  {zh ? '用反推核验' : 'Verify in solver'}
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          {(!cation || !anion) && (
            <div className="border border-dashed border-[var(--border)] p-6 text-center">
              <FlaskConical className="w-6 h-6 mx-auto text-[var(--muted)] mb-2" aria-hidden="true" />
              <p className="text-sm serif-font text-[var(--muted)]">
                {zh ? '先各选一个阳离子和阴离子，立刻看到十字交叉的完整过程。' : 'Pick one cation and one anion to see the full cross-rule derivation.'}
              </p>
            </div>
          )}
        </section>
      )}

      {mode === 'solver' && (
        <section
          id={`chem-panel-solver`}
          role="tabpanel"
          aria-labelledby={`chem-tab-solver`}
          aria-label={zh ? '化合价反推' : 'Valence solver'}
          className="space-y-4"
        >
          <div className="border border-[var(--border)] bg-[var(--card-bg)] p-3 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
              <label className="flex-1">
                <span className="block text-[0.6875rem] mono-font text-[var(--muted)] mb-1">
                  {zh ? '化学式' : 'Formula'}
                </span>
                <div className="relative w-full">
                  {/* 底层排版层：与 input 逐像素对齐，展示规范下标化学式；不接收指针事件。 */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-nowrap px-3 text-sm mono-font text-[var(--fg)]"
                  >
                    {solverFormula ? (
                      <ChemFormula formula={solverFormula} size="sm" lang={lang} />
                    ) : (
                      <span className="text-[var(--muted)]">{zh ? '输入化学式，如 Fe2O3' : 'Enter a formula, e.g. Fe2O3'}</span>
                    )}
                  </div>
                  {/* 顶层真实输入框：文字透明、光标可见；value 始终是 ASCII，复制仍为标准字符串。 */}
                  <input
                    type="text"
                    value={solverFormula}
                    onChange={(e) => {
                      setSolverFormula(e.target.value);
                      setSolverTarget('');
                      setCaseAlt(null);
                    }}
                    onBlur={applyFormulaCaseNormalization}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        applyFormulaCaseNormalization();
                      }
                    }}
                    aria-label={zh ? '输入化学式' : 'Enter a formula'}
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    style={{ outline: 'none' }}
                    className="relative z-10 min-h-10 w-full rounded-lg border border-[var(--border-strong)] bg-transparent px-3 py-2 text-sm mono-font text-transparent caret-[var(--fg)] selection:bg-[var(--accent-light)] selection:text-transparent focus:border-[var(--accent)]"
                  />
                </div>
                {caseAlt && (
                  <button
                    type="button"
                    onClick={() => {
                      setSolverFormula(caseAlt);
                      setCaseAlt(null);
                    }}
                    className="mt-1 inline-flex items-center gap-1 rounded border border-[var(--border)] px-2 py-0.5 text-[0.6875rem] mono-font text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)] transition-colors"
                  >
                    {zh ? `切换为 ${caseAlt}` : `Switch to ${caseAlt}`}
                  </button>
                )}
              </label>
              <div className="sm:w-40">
                <span className="block text-[0.6875rem] mono-font text-[var(--muted)] mb-1">
                  {zh ? '目标元素' : 'Target element'}
                </span>
                <BenchSelect
                  size="field"
                  className="mono-font"
                  listClassName="mono-font"
                  ariaLabel={zh ? '选择目标元素' : 'Choose target element'}
                  value={effectiveTarget}
                  options={solverElements.map((s) => ({ value: s, label: s }))}
                  onChange={(v) => setSolverTarget(v)}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {['Fe2O3', 'KMnO4', 'NH4NO3', 'Fe3O4', 'H2O2', 'Ca(OH)2'].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => {
                    setSolverFormula(f);
                    setSolverTarget('');
                  }}
                  className="compact tap32 leading-5 px-3 py-[0.1875rem] text-xs border border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)] transition-colors"
                >
                  <ChemFormula formula={f} size="sm" lang={lang} />
                </button>
              ))}
            </div>
          </div>

          {isFormulaError(solverParsed) && (
            <p className="text-sm serif-font text-[var(--error)]">
              {lang === 'en' && solverParsed.errorEn ? solverParsed.errorEn : solverParsed.error}
            </p>
          )}

          {solverResult && !isFormulaError(solverResult) && (
            <div className="border border-[var(--border)] p-4 space-y-3">
              <div className="flex flex-wrap items-baseline gap-3">
                <ChemFormula
                  formula={solverFormula}
                  size="lg"
                  className="text-[var(--fg)]"
                  targetSymbol={effectiveTarget}
                  onElementClick={(sym) => setActiveDetailElement(sym)}
                  lang={lang}
                />
                {'error' in solverCompound ? null : (
                  <span className="text-base font-medium text-[var(--fg)]">{solverCompound.zh}</span>
                )}
                <span className="text-xs mono-font text-[var(--muted)]">
                  <i>M</i><sub>r</sub> = {formatMass(molarMass(solverFormula) ?? 0)}
                </span>
              </div>

              {/* 可展开的计算详情：Mr 逐项乘积式 + 目标元素质量分数（学术排版 Mᵣ / ω） */}
              {!isFormulaError(solverParsed) && (() => {
                const entries = [...atomCounts(solverParsed)];
                const total = molarMass(solverFormula) ?? 0;
                const mrTerms = entries.map(([s, n]) => `${TEXTBOOK_MASSES[s] ?? '—'} × ${n}`).join(' + ');
                const targetCount = atomCounts(solverParsed).get(effectiveTarget) ?? 0;
                const targetMass = (TEXTBOOK_MASSES[effectiveTarget] ?? 0) * targetCount;
                const omega = total > 0 && targetCount > 0 ? ((targetMass / total) * 100).toFixed(1) : null;
                return (
                  <details className="text-[0.6875rem] mono-font text-[var(--muted)]">
                    <summary className="cursor-pointer select-none">
                      {zh ? '计算详情' : 'Calculation details'}
                    </summary>
                    <div className="mt-1 space-y-0.5 pl-1">
                      <div className="flex flex-wrap items-center gap-1">
                        <span><i>M</i><sub>r</sub>(</span>
                        <ChemFormula formula={solverFormula} size="sm" lang={lang} />
                        <span>) = {mrTerms} = {formatMass(total)}</span>
                      </div>
                      {omega && (
                        <div className="flex flex-wrap items-center gap-1">
                          <span>ω({effectiveTarget}) =</span>
                          {/* 正规竖式分数（CSS 排版），不使用代码斜杠 */}
                          <span className="mx-0.5 inline-flex flex-col items-center leading-none align-middle">
                            <span className="border-b border-[var(--fg)] px-1 pb-0.5">
                              {TEXTBOOK_MASSES[effectiveTarget] ?? 0} × {targetCount}
                            </span>
                            <span className="px-1 pt-0.5">{formatMass(total)}</span>
                          </span>
                          <span>× 100% = {omega}%</span>
                        </div>
                      )}
                    </div>
                  </details>
                );
              })()}

              {!isFormulaError(solverParsed) && (
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[0.6875rem] mono-font text-[var(--muted)]">
                  {[...atomCounts(solverParsed)].map(([symbol]) => {
                    const fraction = massFraction(solverFormula, symbol);
                    return fraction === null ? null : (
                      <span key={symbol}>
                        {symbol} {(fraction * 100).toFixed(1)}%
                      </span>
                    );
                  })}
                </div>
              )}

              {solverResult.answers.length > 0 ? (
                <ul className="space-y-2">
                  {solverResult.answers.map((a, i) => (
                    <li key={i} className="border border-[var(--border)] p-2.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-xs serif-font text-[var(--fg)]">
                          <FormulaText text={pick(a.scope, lang)} targetSymbol={effectiveTarget} lang={lang} />
                        </span>
                        <ValenceBadge valence={a.valence} />
                      </div>
                      <p className="mt-1 text-xs serif-font leading-relaxed text-[var(--muted)]">
                        <FormulaText text={pick(a.derivation, lang)} targetSymbol={effectiveTarget} lang={lang} />
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">
                  {zh ? '此题没有单一整数解，属于教材特意说明的特例。' : 'No single integer answer — this is a textbook special case.'}
                </p>
              )}

              {solverResult.note && (
                <p className="text-xs serif-font leading-relaxed text-[var(--muted)] border-l-2 border-[var(--border)] pl-3">
                  {pick(solverResult.note, lang)}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const nameZh = 'error' in solverCompound ? solverFormula : solverCompound.zh;
                    const targetZh = elementBySymbol.get(effectiveTarget)?.zh ?? effectiveTarget;
                    const mr = Math.round(molarMass(solverFormula) ?? 0);
                    const parts = [`${nameZh}，相对分子质量为${intToChinese(mr)}`];
                    const first = solverResult.answers[0];
                    if (first) {
                      const eq = first.derivation.zh.split('，')[0]?.trim() ?? '';
                      if (/^[0-9]+x/i.test(eq)) parts.push(expressionToSpeech(eq));
                      const vals = solverResult.answers.map((a) => `${targetZh}的化合价为${valenceToSpeech(a.valence)}`);
                      parts.push(`故${vals.join('；')}`);
                    } else {
                      parts.push(pick(solverResult.note ?? { zh: '无单一化合价', en: 'No single valence' }, lang));
                    }
                    speakText(parts.join('，') + '。');
                  }}
                  className="compact tap32 inline-flex items-center gap-1 rounded px-2 py-1 text-xs mono-font border border-[var(--border)] text-[var(--fg)] hover:border-[var(--fg)] transition-colors"
                >
                  {speaking ? (
                    <Square className="w-3.5 h-3.5" aria-hidden="true" />
                  ) : (
                    <SpeakIcon className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  {speaking ? (zh ? '播放中 · 停止' : 'Playing · Stop') : zh ? '朗读' : 'Speak'}
                </button>
                <AskAiButton
                  question={
                    zh
                      ? `请讲解如何由 ${solverFormula} 反推 ${effectiveTarget} 的化合价`
                      : `Explain how to solve for the valence of ${effectiveTarget} in ${solverFormula}`
                  }
                />
                    </div>
            </div>
          )}
        </section>
      )}

      {mode === 'practice' && (
        <section
          id={`chem-panel-practice`}
          role="tabpanel"
          aria-labelledby={`chem-tab-practice`}
          aria-label={zh ? '化合价练习' : 'Valence practice'}
          className="space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs mono-font text-[var(--muted)]">
              {zh ? '第' : 'Q'} {practiceIndex + 1} / {categoryQuestions.length} · {pick(PRACTICE_CATEGORY_LABEL[practiceCategory], lang)} · {pick(PRACTICE_KIND_LABEL[question.kind], lang)}
            </div>
            <div className="flex items-center gap-3 text-xs mono-font text-[var(--muted)]">
              <span>
                {zh ? '已答' : 'Answered'} {Object.keys(answers).length} · {zh ? '答对' : 'Correct'}{' '}
                {questions.filter((q) => answers[q.id] === q.answer).length}
              </span>
              <button
                type="button"
                onClick={() => {
                  setAnswers({});
                  setPracticeIndex(0);
                  setVariantQuestion(null);
                }}
                className="compact tap32 inline-flex items-center gap-1 rounded px-2 py-1 border border-[var(--border)] text-[var(--fg)] hover:border-[var(--fg)] transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                {zh ? '重做' : 'Reset'}
              </button>
            </div>
          </div>

          {/* 四大中考分类：基础反推 / 易错避坑 / 十字交叉写化学式 / 价态排序 */}
          <div className="flex flex-wrap gap-1.5">
            {PRACTICE_CATEGORY_ORDER.map((c) => {
              const active = practiceCategory === c;
              const count = questions.filter((q) => (q.category ?? 'basic') === c).length;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => chooseCategory(c)}
                  aria-pressed={active}
                  className={`compact tap32 inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs mono-font transition-colors ${
                    active
                      ? 'border-[var(--fg)] bg-[var(--accent-light)] text-[var(--fg)]'
                      : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)]'
                  }`}
                >
                  {pick(PRACTICE_CATEGORY_LABEL[c], lang)}
                  <span className="text-[0.625rem] opacity-70">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="border border-[var(--border)] p-4 space-y-3">
            {variantQuestion && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-l-2 border-[var(--accent)] pl-2 text-[0.6875rem] mono-font text-[var(--muted)]">
                <span>{zh ? '变式训练 · 同考点换一题' : 'Variation · same skill, new item'}</span>
                <button
                  type="button"
                  onClick={() => setVariantQuestion(null)}
                  className="underline decoration-[var(--border)] underline-offset-2 hover:decoration-[var(--fg)]"
                >
                  {zh ? '返回原题' : 'Back to original'}
                </button>
              </div>
            )}
            <p className="text-base serif-font leading-relaxed text-[var(--fg)]">
              <FormulaText text={pick(question.prompt, lang)} lang={lang} />
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {question.options.map((option, idx) => {
                const picked = answers[question.id];
                const answered = picked !== undefined;
                const isPicked = picked === idx;
                const isCorrect = idx === question.answer;
                let tone = 'border-[var(--border)] text-[var(--fg)] hover:border-[var(--fg)]';
                if (answered && isCorrect) tone = 'border-[var(--success)] text-[var(--success)]';
                else if (answered && isPicked) tone = 'border-[var(--error)] text-[var(--error)]';
                else if (answered) tone = 'border-[var(--border)] text-[var(--muted)]';
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => answerQuestion(question, idx)}
                    disabled={answered}
                    aria-pressed={isPicked}
                    className={`border px-3 py-2.5 text-left text-sm serif-font transition-colors ${tone}`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <span className="mono-font text-xs text-[var(--muted)]">{String.fromCharCode(65 + idx)}</span>
                      {question.kind === 'formula' ? (
                        <ChemFormula formula={option} size="sm" lang={lang} />
                      ) : (
                        <FormulaText text={option} lang={lang} />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            {answers[question.id] !== undefined && (
              <div className="space-y-2">
                <div className="flex items-start gap-2 text-sm serif-font text-[var(--fg)]">
                  {answers[question.id] === question.answer ? (
                    <Check className="w-4 h-4 mt-0.5 text-[var(--success)] shrink-0" aria-hidden="true" />
                  ) : (
                    <X className="w-4 h-4 mt-0.5 text-[var(--error)] shrink-0" aria-hidden="true" />
                  )}
                  <span>
                    {answers[question.id] === question.answer
                      ? zh
                        ? '正确。'
                        : 'Correct.'
                      : zh
                        ? '再看一步：'
                        : 'One more step: '}
                    <FormulaText text={pick(question.explanation, lang)} lang={lang} />
                  </span>
                </div>
                {answers[question.id] !== question.answer && question.diagnosis[answers[question.id]] && (
                  <p className="text-xs serif-font leading-relaxed text-[var(--error)] border-l-2 border-[var(--error)] pl-3">
                    {zh ? '错因：' : 'Diagnosis: '}
                    <FormulaText text={pick(question.diagnosis[answers[question.id]], lang)} lang={lang} />
                  </p>
                )}
                {answers[question.id] !== question.answer && (
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <AskAiButton
                      label={zh ? 'AI 点拨思路' : 'AI hint'}
                      className="border border-[var(--border)] text-[var(--fg)]"
                      question={
                        zh
                          ? `我在这道化合价题上做错了，请不要直接告诉我答案，请一步一步点拨我如何推导这道题的思路。\n题干：${pick(question.prompt, 'zh')}\n我的选择：${question.options[answers[question.id]]}\n标准答案：${question.options[question.answer]}\n涉及知识点：${pick(PRACTICE_CATEGORY_LABEL[question.category ?? 'basic'], 'zh')} / ${pick(PRACTICE_KIND_LABEL[question.kind], 'zh')}`
                          : `I got this valence question wrong. Do not give me the answer directly; step by step, guide me on how to derive it.\nQuestion: ${pick(question.prompt, 'en')}\nMy choice: ${question.options[answers[question.id]]}\nCorrect answer: ${question.options[question.answer]}\nSkill: ${pick(PRACTICE_CATEGORY_LABEL[question.category ?? 'basic'], 'en')} / ${pick(PRACTICE_KIND_LABEL[question.kind], 'en')}`
                      }
                    />
                    <button
                      type="button"
                      onClick={startVariant}
                      className="compact tap32 inline-flex items-center gap-1 rounded border border-[var(--border)] px-2 py-1 text-xs mono-font text-[var(--fg)] transition-colors hover:border-[var(--fg)]"
                    >
                      {zh ? '变式训练' : 'Variation'}
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setVariantQuestion(null);
                  setPracticeIndex((i) => Math.max(0, i - 1));
                }}
                disabled={practiceIndex === 0}
                className="compact tap32 inline-flex items-center gap-1 rounded px-2 py-1 text-xs mono-font border border-[var(--border)] text-[var(--fg)] hover:border-[var(--fg)] disabled:opacity-40 transition-colors"
              >
                <ArrowRight className="w-3.5 h-3.5 rotate-180" aria-hidden="true" />
                {zh ? '上一题' : 'Previous'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setVariantQuestion(null);
                  setPracticeIndex((i) => Math.min(categoryQuestions.length - 1, i + 1));
                }}
                disabled={practiceIndex >= categoryQuestions.length - 1}
                className="compact tap32 inline-flex items-center gap-1 rounded px-2 py-1 text-xs mono-font border border-[var(--border)] text-[var(--fg)] hover:border-[var(--fg)] disabled:opacity-40 transition-colors"
              >
                {zh ? '下一题' : 'Next'}
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>

          <p className="text-[0.6875rem] serif-font leading-relaxed text-[var(--muted)]">
            {zh
              ? '答错的题目会自动进入本站错题本（与实验页共用同一存储），可在错题本里回看并继续追问 AI。'
              : 'Wrong answers are saved to the site-wide mistake notebook shared with the lab pages, where you can review them and ask the AI.'}
          </p>
        </section>
      )}

      {/* 结构化讲解独立成页：工具页底部只留一行入口，正文与数据表不在这里展开 */}
      <div className="mt-10 border-t border-[var(--border)] pt-6">
        <Link
          to="/learn/chemistry-formulas"
          className="inline-flex items-center gap-2 py-1.5 -my-1.5 text-sm serif-font text-[var(--fg)] underline decoration-[var(--border)] underline-offset-4 hover:decoration-[var(--fg)]"
        >
          {zh ? '结构化讲解与数据表' : 'Structured explanation and data table'}
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
        <p className="mt-2 text-xs serif-font italic text-[var(--muted)]">
          {zh
            ? '原理、核心事实、可复现数据表、常见误区与常见问题。'
            : 'Principles, key facts, a reproducible data table, common misconceptions and FAQs.'}
        </p>
      </div>

      {detailElement && (
        <ElementDetailSheet
          selected={detailElement}
          lang={lang}
          onClose={() => setActiveDetailElement(null)}
          onNavigate={(el) => setActiveDetailElement(el.symbol)}
          speak={(el) => speak(el.zh)}
          speakState={speakState === 'playing' ? 'playing' : speakState === 'synthesizing' ? 'loading' : 'idle'}
          {...detailState}
          actionSlot={
            <Link
              to={`/periodic-table?element=${detailElement.symbol}`}
              className="inline-flex items-center gap-1 text-xs mono-font text-[var(--fg)] underline decoration-[var(--border)] underline-offset-4 hover:decoration-[var(--fg)]"
            >
              {lang === 'zh' ? '在完整元素周期表中查看' : 'View in full periodic table'}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          }
        />
      )}
    </main>
  );
}

interface SpeciesOption {
  formula: string;
  name: Bi;
  valences: number[];
  dominant: number;
}

function SpeciesPicker({
  title,
  hint,
  lang,
  selected,
  options,
  onSelect,
}: {
  title: string;
  hint: string;
  lang: 'zh' | 'en';
  selected: IonRef | null;
  options: SpeciesOption[];
  onSelect: (formula: string, charge: number) => void;
}) {
  const current = options.find((o) => o.formula === selected?.formula);
  const valences = current?.valences ?? [];
  return (
    <div className="border border-[var(--border)] p-3 space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[0.6875rem] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
          {title}
        </h2>
        <span className="text-[0.625rem] serif-font text-[var(--muted)]">{hint}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = selected?.formula === o.formula;
          return (
            <button
              key={o.formula}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(o.formula, o.dominant)}
              className={`compact tap32 leading-5 px-3 py-[0.1875rem] text-xs border transition-colors ${
                active
                  ? 'border-[var(--fg)] text-[var(--fg)]'
                  : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)]'
              }`}
            >
              <ChemFormula formula={o.formula} size="sm" ariaLabel={o.name[lang]} lang={lang} />
            </button>
          );
        })}
      </div>
      {selected && valences.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[0.625rem] mono-font text-[var(--muted)]">
            {lang === 'zh' ? '选择价态' : 'Valence'}
          </span>
          {valences.map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={selected.charge === v}
              onClick={() => onSelect(selected.formula, v)}
              className={`compact tap32 leading-5 px-2 py-[0.1875rem] text-xs mono-font border transition-colors ${
                selected.charge === v
                  ? 'border-[var(--fg)] text-[var(--fg)]'
                  : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
              }`}
            >
              {formatValence(v)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

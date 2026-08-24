/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 物理工具页 · 物理常量速查
 *
 * 复刻元素周期表交互模型：分类筛选 + 检索 + 网格卡片墙 + 点开详情卡。
 * 数据来自 src/lib/constants.ts（依据 physics_kb 提炼，数值对照教材附录）。
 */
import { useLockBodyScroll } from '../lib/use-lock-body-scroll';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { House, Search    } from 'lucide-react';
import { useApp } from '../lib/app-context';
import { CONSTANTS, CONSTANT_CATEGORY_ZH, CONSTANT_CATEGORY_EN, type ConstantCategory, type PhysicalConstant } from '../lib/constants';
import { PHYSICS_FORMULAS } from '../lib/physics-formulas';
import { labMap } from '../lib/labs';
import { useAiContext } from '../lib/ai-context';
import AskAiButton from '../components/ai/AskAiButton';
import ShareInline from '../components/share/ShareInline';
import { usePageMeta, learningResourceLd } from '../lib/use-page-meta';

const CATEGORIES: ConstantCategory[] = ['mech', 'thermal', 'optics', 'sound', 'elec'];

export default function PhysicalConstants() {
  const { t, lang } = useApp();
  // 路由级 meta：标题/描述 + LearningResource 结构化数据（L3 GEO）
  const pageMeta = useMemo(() => ({
    title: `${lang === 'zh' ? '物理常量速查' : 'Physics Constants'} - ${t.brandName}`,
    description: lang === 'zh' ? '常用物理常量速查：光速、引力常数、阿伏伽德罗常数等，按力学/热学/光学/声学/电学分类。' : 'Common physics constants: speed of light, gravitational constant, Avogadro constant, grouped by mechanics/thermal/optics/sound/electricity.',
    jsonLd: learningResourceLd({
      name: lang === 'zh' ? '物理常量速查' : 'Physics Constants',
      description: lang === 'zh' ? '常用物理常量速查：光速、引力常数、阿伏伽德罗常数等，按力学/热学/光学/声学/电学分类。' : 'Common physics constants: speed of light, gravitational constant, Avogadro constant, grouped by mechanics/thermal/optics/sound/electricity.',
      url: 'https://stem.irky.dev/physics-constants',
      resourceType: lang === 'zh' ? '速查工具' : 'Reference Tool',
    }),
  }), [lang, t.brandName]);
  usePageMeta(pageMeta);
  const [params] = useSearchParams();
  const [selected, setSelected] = useState<PhysicalConstant | null>(null);
  useLockBodyScroll(!!selected);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<ConstantCategory | 'all'>('all');

  // 从公式页跳转聚焦：?focus=<常量符号>
  const focusSymbol = params.get('focus');
  useEffect(() => {
    if (focusSymbol) {
      const c = CONSTANTS.find((x) => x.symbol === focusSymbol);
      if (c) setSelected(c);
    }
  }, [focusSymbol]);

  /** 该常量被哪些公式使用（双向关联反查） */
  const formulasUsing = (sym: string) => PHYSICS_FORMULAS.filter((f) => f.relatedConstants?.includes(sym));
  const { setAiCtx } = useAiContext();
  // AI 上下文：选中常量时注入数值/意义/用途
  useEffect(() => {
    if (selected) {
      setAiCtx({
        topic: `物理常量：${selected.name.zh}`,
        knowledge: `${selected.symbol} = ${selected.value} ${selected.unit}（${selected.name.zh}）。物理意义：${selected.meaning.zh}。应用：${selected.usage.zh}。章节：${selected.chapter}。`,
      });
    } else {
      // 未选中任何项时注入页面级知识（工具涵盖范围 + 使用方法）
      setAiCtx({
        topic: lang === 'zh' ? '物理常量速查' : 'Physics Constants',
        knowledge: lang === 'zh' ? '物理常量速查工具：初中物理常用常量按力学、热学、光学、声学、电学分类，含数值、单位、物理意义与应用。使用方法：按分类筛选或搜索定位常量，点击查看详情。' : 'Physics constants reference: common junior-high constants grouped by mechanics, thermal, optics, sound, and electricity, with values, units, meaning, and usage. Filter by category or search, then tap for details.',
      });
    }
    return () => setAiCtx({});
  }, [selected, setAiCtx]);

  const queryLower = query.trim().toLowerCase();
  // 检索：符号精确匹配优先（如 "u"→仅 U 电压类）；否则符号前缀 / 中文包含 / 英文前缀 / 数值包含
  const exactSymbol = queryLower ? CONSTANTS.find((c) => c.symbol.toLowerCase() === queryLower) : undefined;
  const filtered = CONSTANTS.filter((c) => {
    if (cat !== 'all' && c.category !== cat) return false;
    if (!queryLower) return true;
    if (exactSymbol) return c.symbol.toLowerCase() === exactSymbol.symbol.toLowerCase();
    return (
      c.symbol.toLowerCase().startsWith(queryLower) ||
      c.name.zh.includes(queryLower) ||
      c.name.en.toLowerCase().startsWith(queryLower) ||
      c.value.includes(queryLower) ||
      c.unit.toLowerCase().startsWith(queryLower)
    );
  });

  return (
    <main className="flex-1 flex flex-col my-10 px-2 sm:px-6">
      {/* 面包屑导航：返回物理 + 首页 */}
      <nav className="flex items-center gap-3 text-xs mono-font">
        <Link to="/subject/physics" className="text-[var(--muted)] underline hover:text-[var(--fg)]">
          ← {lang === 'zh' ? '返回物理' : 'Back to Physics'}
        </Link>
        <Link
          to="/"
          aria-label={t.homeIcon}
          title={t.homeIcon}
          className="text-[var(--muted)] hover:text-[var(--fg)] transition-colors inline-flex items-center"
        >
          <House className="w-3.5 h-3.5" />
        </Link>
      </nav>

      <div className="mt-5 mb-6">
        <h1 className="text-3xl sm:text-4xl font-medium tracking-tight serif-font text-[var(--fg)]">
          {lang === 'zh' ? '物理常量速查' : 'Physics Constants'}
          <ShareInline
            title={lang === 'zh' ? '物理常量速查 · 数理化数字实验室' : 'Physics Constants · STEM Digital Lab'}
            text={
              lang === 'zh'
                ? '初中物理常用常量速查，按力学/热学/光学/声学/电学分类，附物理意义与应用场景，免费使用！'
                : 'Quick reference for middle-school physics constants by category, with meanings and usage. Free to use!'
            }
          />
        </h1>
        <p className="mt-2 text-xs serif-font italic text-[var(--muted)]">
          {lang === 'zh'
            ? '初中物理常用常量与典型数值（依据苏科版教材），按力学/热学/光学/声学/电学分类。做题卡壳时点开看看，附物理意义与应用场景。'
            : 'Common constants and typical values for middle-school physics (per the Su-Ke edition textbook), grouped by mechanics / thermal / optics / sound / electricity. Tap a card for meaning and usage.'}
        </p>
      </div>

      {/* 检索 + 分类筛选（灰色背景模块） */}
      <div className="mb-5 border border-[var(--border)] bg-[var(--card-bg)] p-3 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-[0.6875rem] mono-font text-[var(--muted)]">
            {lang === 'zh' ? '检索常量' : 'Search'}
          </div>
          <div className="relative w-full sm:max-w-xs">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={lang === 'zh' ? '输入符号或名称，如 g / 水 / 光速' : 'Type a symbol or name, e.g. g / water'}
              className="w-full border border-[var(--border)] bg-[var(--bg)] px-3 py-2 pr-8 text-sm text-[var(--fg)] outline-none focus:border-[var(--fg)]"
            />
            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted)] pointer-events-none" />
          </div>
        </div>
        {/* 分类筛选 */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCat('all')}
            className={`px-3 py-1 text-xs mono-font border transition-colors ${cat === 'all' ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)]'}`}
          >
            {lang === 'zh' ? '全部' : 'All'}
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(cat === c ? 'all' : c)}
              className={`px-3 py-1 text-xs mono-font border transition-colors ${cat === c ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)]'}`}
            >
              {lang === 'zh' ? CONSTANT_CATEGORY_ZH[c] : CONSTANT_CATEGORY_EN[c]}
            </button>
          ))}
        </div>
      </div>

      {/* 常量卡片墙 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {filtered.map((c) => (
          <button
            key={c.symbol + c.value}
            type="button"
            onClick={() => setSelected(c)}
            aria-label={`${c.symbol} ${c.value} ${c.unit} ${lang === 'zh' ? c.name.zh : c.name.en}`}
            className="border border-[var(--border)] bg-[var(--card-bg)] px-3 py-3 flex flex-col items-center gap-1 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:border-[var(--fg)]"
          >
            <span className="text-lg font-bold mono-font text-[var(--fg)] leading-none">{c.symbol}</span>
            <span className="text-xs mono-font text-[var(--muted)] leading-none">{c.value} {c.unit}</span>
            <span className="text-[0.625rem] serif-font text-[var(--muted)] leading-none truncate w-full text-center">
              {lang === 'zh' ? c.name.zh : c.name.en}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="mt-8 text-center text-xs serif-font italic text-[var(--muted)]">
          {lang === 'zh' ? '没有匹配的常量，换个关键词试试。' : 'No matching constant. Try another keyword.'}
        </p>
      )}

      {/* 详情卡 */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelected(null)}>
          <div
            className="relative w-full max-w-xs border border-[var(--border)] bg-[var(--bg)] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.15)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={`${selected.symbol} ${selected.value}`}
          >
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label={lang === 'zh' ? '关闭' : 'Close'}
              className="absolute top-2 right-3 w-7 h-7 flex items-center justify-center text-lg text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
            >
              ×
            </button>

            <div className="pr-8">
              <div className="text-[0.625rem] mono-font text-[var(--muted)]">
                {lang === 'zh' ? CONSTANT_CATEGORY_ZH[selected.category] : CONSTANT_CATEGORY_EN[selected.category]}
              </div>
              <div className="mt-1">
                <span className="text-3xl font-bold mono-font text-[var(--fg)]">{selected.symbol}</span>
                <span className="ml-2 text-sm mono-font text-[var(--muted)]">{selected.value} {selected.unit}</span>
              </div>
              <div className="text-sm serif-font text-[var(--fg)] mt-1">
                {lang === 'zh' ? selected.name.zh : selected.name.en}
              </div>
            </div>

            <div className="mt-3 space-y-2 text-sm serif-font text-[var(--fg)]">
              <div className="border border-[var(--border)] p-2.5">
                <div className="text-[0.625rem] mono-font text-[var(--muted)] tracking-widest mb-1">
                  // {lang === 'zh' ? '物理意义' : 'Meaning'}
                </div>
                <p className="leading-relaxed">{lang === 'zh' ? selected.meaning.zh : selected.meaning.en}</p>
              </div>
              <div className="border border-[var(--border)] p-2.5">
                <div className="text-[0.625rem] mono-font text-[var(--muted)] tracking-widest mb-1">
                  // {lang === 'zh' ? '应用场景' : 'Usage'}
                </div>
                <p className="leading-relaxed">{lang === 'zh' ? selected.usage.zh : selected.usage.en}</p>
              </div>
              <div className="flex items-center justify-between px-0.5 text-xs mono-font text-[var(--muted)]">
                <span>{lang === 'zh' ? '教材章节' : 'Chapter'}: {selected.chapter}</span>
                {selected.labId && labMap[selected.labId] && (
                  <Link
                    to={`/lab/${selected.labId}`}
                    className="underline hover:text-[var(--fg)]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {lang === 'zh' ? `关联实验：${labMap[selected.labId].name.zh}` : `Lab: ${labMap[selected.labId].name.en}`}
                  </Link>
                )}
              </div>

              {/* 问 AI：看完内容后可一键讲解当前常量 */}
              <div className="px-0.5 pt-2">
                <AskAiButton question={lang === 'zh' ? `请讲解常量「${selected.name.zh}」的物理意义与应用` : `Explain the constant "${selected.name.en}" — its physical meaning and usage`} />
              </div>
              {/* 用于公式（双向关联：点击跳公式页并聚焦） */}
              {formulasUsing(selected.symbol).length > 0 && (
                <div className="border border-[var(--border)] p-2.5">
                  <div className="text-[0.625rem] mono-font text-[var(--muted)] tracking-widest mb-1">
                    // {lang === 'zh' ? '用于公式' : 'Used in formulas'}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formulasUsing(selected.symbol).map((f) => (
                      <Link
                        key={f.id}
                        to={`/physics-formulas?focus=${f.id}`}
                        className="text-xs mono-font underline hover:text-[var(--fg)]"
                      >
                        {lang === 'zh' ? f.name.zh : f.name.en}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

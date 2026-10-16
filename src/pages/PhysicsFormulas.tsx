/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 物理工具页 · 物理公式速查
 *
 * 参考数学公式速查的交互方式：分类筛选 + 检索 + 卡片墙 + 点开详情卡。
 * 与物理常量速查双向关联：公式卡显示「相关常量」（带数值，点击跳常量页），
 * 常量卡显示「用于公式」（点击跳回本页）。数据来自 src/lib/physics-formulas.ts
 * （依据物理公式手册整理，按苏科版章节编排）。
 */
import { useLockBodyScroll } from '../lib/use-lock-body-scroll';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import BackLink from '../components/layout/BackLink';
import { Search, Image as ImageIcon, X } from 'lucide-react';
import { useApp } from '../lib/app-context';
import { useAiContext } from '../lib/ai-context';
import { PHYSICS_FORMULAS, PHYSICS_FORMULA_CATEGORY_ZH, PHYSICS_FORMULA_CATEGORY_EN, type PhysicsFormulaCategory, type PhysicsFormula } from '../lib/physics-formulas';
import { CONSTANTS } from '../lib/constants';
import { labMap } from '../lib/labs';
import ShareInline from '../components/share/ShareInline';
import { usePageMeta, learningResourceLd } from '../lib/use-page-meta';
import Formula from '../components/ui/Formula';
import AskAiButton from '../components/ai/AskAiButton';
import AskQuizButton from '../components/ai/AskQuizButton';
import PhysicsDiagram from '../components/ui/PhysicsDiagram';
import { useEscapeKey } from '../lib/use-escape-key';

const CATEGORIES: PhysicsFormulaCategory[] = ['mech', 'thermal', 'optics', 'sound', 'elec'];

export default function PhysicsFormulas() {
  const { t, lang } = useApp();
  // 路由级 meta：标题/描述 + LearningResource 结构化数据
  const pageMeta = useMemo(() => ({
    title: `${lang === 'zh' ? '物理公式速查' : 'Physics Formulas'} - ${t.brandName}`,
    description: lang === 'zh' ? '初中物理公式速查：电学、力学、光学公式整理，配套单位与使用说明。' : 'Junior-high physics formulas: electricity, mechanics, optics, with units and usage notes.',
    jsonLd: learningResourceLd({
      name: lang === 'zh' ? '物理公式速查' : 'Physics Formulas',
      description: lang === 'zh' ? '初中物理公式速查：电学、力学、光学公式整理，配套单位与使用说明。' : 'Junior-high physics formulas: electricity, mechanics, optics, with units and usage notes.',
      url: 'https://stem.irky.dev/physics-formulas',
      resourceType: lang === 'zh' ? '速查工具' : 'Reference Tool',
    }),
  }), [lang, t.brandName]);
  usePageMeta(pageMeta);
  const [params] = useSearchParams();
  const [selected, setSelected] = useState<PhysicsFormula | null>(null);
  useLockBodyScroll(!!selected);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<PhysicsFormulaCategory | 'all'>('all');
  // 配图放大预览（null=未打开）
  const [zoomDiagram, setZoomDiagram] = useState(false);

  // Esc：先关最上层（放大层 → 详情层），与点击遮罩一致
  useEscapeKey(() => setZoomDiagram(false), zoomDiagram);
  useEscapeKey(() => setSelected(null), !!selected && !zoomDiagram);
  const { setAiCtx } = useAiContext();
  // AI 上下文：选中公式时注入公式/说明/单位/适用条件/相关常量数值
  useEffect(() => {
    if (selected) {
      const consts = (selected.relatedConstants ?? [])
        .map((sym) => {
          const c = CONSTANTS.find((x) => x.symbol === sym);
          return c ? `${sym}=${c.value} ${c.unit}` : sym;
        })
        .join('，');
      setAiCtx({
        topic: `物理公式：${selected.name.zh}`,
        knowledge: `公式：${selected.formula}。说明：${selected.label.zh}。单位：${selected.unit}。适用条件：${selected.condition.zh}。章节：${selected.chapter}。${consts ? `相关常量：${consts}。` : ''}`,
      });
    } else {
      // 未选中任何项时注入页面级知识（工具涵盖范围 + 使用方法）
      setAiCtx({
        topic: lang === 'zh' ? '物理公式速查' : 'Physics Formulas',
        knowledge: lang === 'zh' ? '物理公式速查工具：按初中物理教材整理电学、力学、光学、声学、热学五类公式。使用方法：按分类筛选或搜索定位公式，点击公式卡片查看公式、单位、适用条件与相关常量。' : 'Physics formulas reference: junior-high physics formulas grouped by electricity, mechanics, optics, sound, and thermal. Use the category filter or search, then tap a card for the formula, units, conditions, and related constants.',
      });
    }
    return () => setAiCtx({});
  }, [selected, setAiCtx]);

  // 从常量页跳转聚焦：?focus=<公式 id>
  const focusId = params.get('focus');
  useEffect(() => {
    if (focusId) {
      const f = PHYSICS_FORMULAS.find((x) => x.id === focusId);
      if (f) setSelected(f);
    }
  }, [focusId]);

  const queryLower = query.trim().toLowerCase();
  // 检索：中文名包含 / 英文包含 / 公式符号去空格 / 单位 / 章节
  const symbolQuery = queryLower.replace(/\s+/g, '');
  /** 公式归一化：LaTeX → 书写形式（\frac{a}{b}→a/b、\rho→ρ、去掉命令花括号），使 "I=U/R""F浮" 等能搜到 */
  const normFormula = (tex: string) =>
    tex
      .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '$1/$2')
      .replace(/\\text\{([^}]*)\}/g, '$1')
      .replace(/\\rho/g, 'ρ')
      .replace(/\\Omega/g, 'Ω')
      .replace(/\\lambda/g, 'λ')
      .replace(/\\Delta/g, 'Δ')
      .replace(/\\eta/g, 'η')
      .replace(/\\mu/g, 'μ')
      .replace(/\\gamma/g, 'γ')
      .replace(/[\\{}_]/g, '')
      .replace(/\s+/g, '')
      .toLowerCase();
  const filtered = PHYSICS_FORMULAS.filter((f) => {
    if (cat !== 'all' && f.category !== cat) return false;
    if (!queryLower) return true;
    return (
      f.name.zh.includes(queryLower) ||
      f.name.en.toLowerCase().includes(queryLower) ||
      normFormula(f.formula).includes(symbolQuery) ||
      f.unit.toLowerCase().includes(queryLower) ||
      f.chapter.includes(queryLower)
    );
  });

  /** 常量符号 → 常量列表（同名多值如 U 220V/36V/1.5V 全部列出） */
  const constantsOf = (sym: string) => CONSTANTS.filter((c) => c.symbol === sym);

  return (
    <main className="grow shrink-0 flex flex-col my-[var(--sp-block)] px-2 sm:px-6">
      {/* 返回学科：Ghost Link（无下划线、无 ⌂ —— 回首页由顶栏 Logo 承担） */}
      <BackLink to="/subject/physics">{lang === 'zh' ? '返回物理' : 'Back to Physics'}</BackLink>

      <div className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-medium tracking-tight serif-font text-[var(--fg)]">
          {lang === 'zh' ? '物理公式速查' : 'Physics Formulas'}
          <ShareInline
            title={lang === 'zh' ? '物理公式速查 · 数理化数字实验室' : 'Physics Formulas · STEM Digital Lab'}
            text={
              lang === 'zh'
                ? '初中物理核心公式速查，按力学/热学/光学/声学/电学分类，附单位、适用条件与易错点，免费使用！'
                : 'Core middle-school physics formulas with units, conditions and pitfalls. Free to use!'
            }
          />
        </h1>
        <p className="mt-2 text-xs serif-font italic text-[var(--muted)]">
          {lang === 'zh'
            ? '初中物理核心公式（依据苏科版教材），按力学/热学/光学/声学/电学分类。点开看公式、单位、适用条件与易错点，相关常量一键跳转。'
            : 'Core middle-school physics formulas (per the Su-Ke edition textbook), grouped by mechanics / thermal / optics / sound / electricity. Tap a card for the formula, units, conditions and pitfalls; related constants link across.'}
        </p>
      </div>

      {/* 检索 + 分类筛选 */}
      <div className="mb-5 border border-[var(--border)] bg-[var(--card-bg)] p-3 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-[0.6875rem] mono-font text-[var(--muted)]">
            {lang === 'zh' ? '检索公式' : 'Search'}
          </div>
          <div className="relative mb-3 sm:mb-5 w-full sm:max-w-xs border border-[var(--border-strong)] rounded-lg transition-colors focus-within:border-[var(--accent)]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted)] pointer-events-none" aria-hidden="true" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={lang === 'zh' ? '输入公式名，如 欧姆 / 压强 / 浮力' : 'Type a formula name, e.g. Ohm / pressure'}
              aria-label={lang === 'zh' ? '检索公式' : 'Search formulas'}
              /* 内层 input 零边框零轮廓：边框与聚焦态交给外层容器，全局只有一层框。
                 index.css 的 :focus-visible 焦点环在 @layer 之外，只有内联 outline:none 挡得住。 */
              style={{ outline: 'none' }}
              className="min-h-10 w-full rounded-md border-none bg-transparent pl-8 pr-3 py-2 text-sm text-[var(--fg)] outline-none focus:outline-none focus:ring-0"
            />
          </div>
        </div>
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
              {lang === 'zh' ? PHYSICS_FORMULA_CATEGORY_ZH[c] : PHYSICS_FORMULA_CATEGORY_EN[c]}
            </button>
          ))}
        </div>
      </div>

      {/* 公式卡片墙 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {filtered.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setSelected(f)}
            aria-label={`${f.name.zh} ${f.name.en}`}
            className="relative border border-[var(--border)] bg-[var(--card-bg)] px-3 py-3 flex flex-col items-center gap-1.5 transition-all duration-[var(--dur-fast)] hover:-translate-y-0.5 hover:shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:border-[var(--fg)]"
          >
            {/* 含配图的公式：右上角提示 */}
            {f.diagram && (
              <ImageIcon
                className="absolute top-2 right-2 w-3.5 h-3.5 text-[var(--muted)] pointer-events-none"
                aria-label={lang === 'zh' ? '含示意图' : 'Has diagram'}
              />
            )}
            <span className="text-sm font-semibold serif-font text-[var(--fg)] leading-tight text-center">
              {lang === 'zh' ? f.name.zh : f.name.en}
            </span>
            <div className="w-full flex items-center justify-center overflow-x-auto min-h-0">
              <Formula tex={f.formula} className="text-sm text-[var(--fg)]" />
            </div>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="mt-8 text-center text-xs serif-font italic text-[var(--muted)]">
          {lang === 'zh' ? '没有匹配的公式，换个关键词试试。' : 'No matching formula. Try another keyword.'}
        </p>
      )}

      {/* 详情卡 */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-2 sm:p-4 backdrop-blur-[1px]" onClick={() => setSelected(null)}>
          <div
            className="relative w-full max-w-md max-h-[90dvh] flex flex-col border border-[var(--border)] bg-[var(--bg)] shadow-[0_16px_40px_rgba(0,0,0,0.18)] rounded-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={`${selected.name.zh} ${selected.name.en}`}
          >
            {/* 固定顶部条：无论横屏还是竖屏，关闭按钮和标题始终可见 */}
            <div className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5 sm:py-3.5 border-b border-[var(--border)] bg-[var(--bg)] shrink-0">
              <div className="min-w-0">
                <div className="text-[0.625rem] mono-font text-[var(--muted)]">
                  {lang === 'zh' ? PHYSICS_FORMULA_CATEGORY_ZH[selected.category] : PHYSICS_FORMULA_CATEGORY_EN[selected.category]}
                </div>
                <div className="mt-0.5 text-base sm:text-lg font-semibold serif-font text-[var(--fg)] truncate">
                  {lang === 'zh' ? selected.name.zh : selected.name.en}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label={lang === 'zh' ? '关闭' : 'Close'}
                className="h-7 w-7 rounded-md inline-flex items-center justify-center shrink-0 text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--accent-light)] active:bg-[var(--accent)] active:text-[var(--bg)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 独立内部滚动区：移动端流畅上下滑动 */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-3">
              {/* 公式（KaTeX；超长公式可横向滚动兜底） */}
              <div className="border border-[var(--border)] p-3 flex items-center justify-center bg-[var(--card-bg)] overflow-x-auto rounded-lg">
                <Formula tex={selected.formula} block className="text-base text-[var(--fg)]" />
              </div>
              <div className="text-xs serif-font italic text-[var(--muted)]">
                {lang === 'zh' ? selected.label.zh : selected.label.en}
              </div>
              <div className="text-[0.6875rem] mono-font text-[var(--muted)]">
                {lang === 'zh' ? '单位' : 'Unit'}: {selected.unit}
              </div>

              {/* 配图（教科书示意图，点击可放大查看） */}
              {selected.diagram && (
                <div className="border border-[var(--border)] p-2 bg-[var(--card-bg)] flex items-center justify-center cursor-zoom-in rounded-lg" onClick={() => setZoomDiagram(true)} role="button" aria-label={lang === 'zh' ? '放大示意图' : 'Zoom diagram'}>
                  <PhysicsDiagram type={selected.diagram.kind as never} className="w-full max-w-[320px] max-h-[160px]" />
                </div>
              )}

              <div className="space-y-2 text-sm serif-font text-[var(--fg)]">
                <div className="border border-[var(--border)] p-2.5 rounded-lg">
                  <div className="text-[0.625rem] mono-font text-[var(--muted)] tracking-widest mb-1">
                    // {lang === 'zh' ? '适用条件' : 'Conditions'}
                  </div>
                  <p className="leading-relaxed text-xs">{lang === 'zh' ? selected.condition.zh : selected.condition.en}</p>
                </div>
                <div className="border border-[var(--border)] p-2.5 rounded-lg">
                  <div className="text-[0.625rem] mono-font text-[var(--muted)] tracking-widest mb-1">
                    // {lang === 'zh' ? '常考易错' : 'Pitfalls'}
                  </div>
                  <p className="leading-relaxed text-xs">{lang === 'zh' ? selected.pitfall.zh : selected.pitfall.en}</p>
                </div>
                <div className="border border-[var(--border)] p-2.5 rounded-lg">
                  <div className="text-[0.625rem] mono-font text-[var(--muted)] tracking-widest mb-1">
                    // {lang === 'zh' ? '应用场景' : 'Usage'}
                  </div>
                  <p className="leading-relaxed text-xs">{lang === 'zh' ? selected.usage.zh : selected.usage.en}</p>
                </div>

                {/* 相关常量（双向关联：点击跳常量页并聚焦） */}
                {selected.relatedConstants && selected.relatedConstants.length > 0 && (
                  <div className="border border-[var(--border)] p-2.5 rounded-lg">
                    <div className="text-[0.625rem] mono-font text-[var(--muted)] tracking-widest mb-1">
                      // {lang === 'zh' ? '相关常量' : 'Related constants'}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selected.relatedConstants.map((sym) => {
                        const cs = constantsOf(sym);
                        return (
                          <Link
                            key={sym}
                            to={`/physics-constants?focus=${encodeURIComponent(sym)}`}
                            className="text-xs mono-font underline hover:text-[var(--fg)]"
                          >
                            {sym}
                            {cs.length > 0 && <span className="text-[var(--muted)]"> = {cs[0].value} {cs[0].unit}</span>}
                            {cs.length > 1 && <span className="text-[var(--muted)]"> ×{cs.length}</span>}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between px-0.5 text-xs mono-font text-[var(--muted)]">
                  <span>{lang === 'zh' ? '教材章节' : 'Chapter'}: {selected.chapter}</span>
                </div>

                {/* 关联实验 */}
                {selected.labId && labMap[selected.labId] && (
                  <div className="px-0.5 text-xs">
                    <Link
                      to={`/lab/${selected.labId}`}
                      className="underline hover:text-[var(--fg)]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {lang === 'zh' ? `关联实验：${labMap[selected.labId].name.zh}` : `Lab: ${labMap[selected.labId].name.en}`}
                    </Link>
                  </div>
                )}
                {/* 问 AI：看完内容后可一键讲解当前公式 */}
                <div className="px-0.5 pt-1 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <AskAiButton question={lang === 'zh' ? `请讲解公式「${selected.name.zh}」的原理、适用条件与易错点` : `Explain the formula "${selected.name.en}" — principle, conditions and common pitfalls`} />
                  <AskQuizButton />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 配图放大层（点击遮罩只关放大层，不关详情卡） */}
      {zoomDiagram && selected?.diagram && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-xs" onClick={() => setZoomDiagram(false)} role="dialog" aria-modal="true" aria-label={lang === 'zh' ? '示意图放大' : 'Zoomed diagram'}>
          <div className="relative max-w-xl w-full max-h-[90dvh] flex flex-col border border-[var(--border)] bg-[var(--bg)] p-3 sm:p-4 shadow-2xl rounded-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="border border-[var(--border)] bg-white p-3 sm:p-4 flex items-center justify-center flex-1 overflow-hidden rounded-lg">
              <PhysicsDiagram type={selected.diagram.kind as never} className="w-full max-w-[460px] max-h-[60dvh] object-contain" />
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 shrink-0">
              <span className="text-xs mono-font text-[var(--fg)] font-medium truncate">
                {lang === 'zh' ? selected.name.zh : selected.name.en}
              </span>
              <button
                type="button"
                onClick={() => setZoomDiagram(false)}
                className="text-xs mono-font px-3 py-1.5 border border-[var(--border)] text-[var(--fg)] hover:bg-[var(--card-bg)] rounded-lg transition-colors touch-manipulation active:scale-95 shrink-0"
              >
                {lang === 'zh' ? '关闭' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

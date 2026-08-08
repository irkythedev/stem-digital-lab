/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 数学工具页 · 数学公式速查
 *
 * 复刻物理常量页交互模型：分类筛选 + 检索 + 卡片墙 + 点开详情卡。
 * 数据来自 src/lib/formulas.ts（依据 math_kb 提炼），公式用 KaTeX 渲染。
 */
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { House, Image as ImageIcon, Search } from 'lucide-react';
import { useApp } from '../lib/app-context';
import { FORMULAS, FORMULA_CATEGORY_ZH, FORMULA_CATEGORY_EN, type FormulaCategory, type MathFormula } from '../lib/formulas';
import { labMap } from '../lib/labs';
import ShareInline from '../components/share/ShareInline';
import Formula from '../components/ui/Formula';
import FormulaDiagram from '../components/ui/FormulaDiagram';
import FunctionDiagram from '../components/ui/FunctionDiagram';

const CATEGORIES: FormulaCategory[] = ['algebra', 'geometry', 'function', 'stats'];

/** 渲染富文本：`$...$` 片段用 KaTeX 内联渲染，其余为普通文本（数学符号严谨显示） */
function renderRich(text: string): ReactNode[] {
  const parts = text.split(/\$(.+?)\$/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <Formula key={i} tex={part} className="text-[13px] text-[var(--fg)]" />
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export default function MathFormulas() {
  const { t, lang } = useApp();
  const [selected, setSelected] = useState<MathFormula | null>(null);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<FormulaCategory | 'all'>('all');
  // 配图放大预览（null=未打开）
  const [zoomDiagram, setZoomDiagram] = useState(false);

  const queryLower = query.trim().toLowerCase();
  // 章节缩写展开（八下→八年级下册 等），便于用常用简称检索
  const chapterQuery = queryLower
    .replace(/七上/g, '七年级上册').replace(/七下/g, '七年级下册')
    .replace(/八上/g, '八年级上册').replace(/八下/g, '八年级下册')
    .replace(/九上/g, '九年级上册').replace(/九下/g, '九年级下册');
  // 公式符号检索：去空格后匹配公式源码与中文表述（搜 "kx"/"l="/"π" 也能定位）
  const symbolQuery = queryLower.replace(/\s+/g, '');
  // 检索：公式名（中文包含/英文包含）、章节（含缩写）、公式符号、中文说明
  const filtered = FORMULAS.filter((f) => {
    if (cat !== 'all' && f.category !== cat) return false;
    if (!queryLower) return true;
    return (
      f.name.zh.includes(queryLower) ||
      f.name.en.toLowerCase().includes(queryLower) ||
      f.chapter.includes(chapterQuery) ||
      f.label.zh.includes(queryLower) ||
      f.formula.toLowerCase().replace(/\s+/g, '').includes(symbolQuery)
    );
  });

  return (
    <main className="flex-1 flex flex-col my-10 px-2 sm:px-6">
      {/* 面包屑导航：返回数学 + 首页 */}
      <nav className="flex items-center gap-3 text-xs mono-font">
        <Link to="/subject/math" className="text-[var(--muted)] underline hover:text-[var(--fg)]">
          ← {lang === 'zh' ? '返回数学' : 'Back to Math'}
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
          {lang === 'zh' ? '数学公式速查' : 'Math Formulas'}
          <ShareInline />
        </h1>
        <p className="mt-2 text-xs serif-font italic text-[var(--muted)]">
          {lang === 'zh'
            ? '初中数学核心公式（依据人教版教材），按代数/几何/函数/统计概率分类。考前扫一遍，点开看记忆口诀、易错点与应用。'
            : 'Core middle-school math formulas (per the People\'s Education edition), grouped by algebra / geometry / functions / statistics & probability. Scan before exams; tap a card for mnemonics, pitfalls, and usage.'}
        </p>
      </div>

      {/* 检索 + 分类筛选（灰色背景模块） */}
      <div className="mb-5 border border-[var(--border)] bg-[var(--card-bg)] p-3 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-[11px] mono-font text-[var(--muted)]">
            {lang === 'zh' ? '检索公式' : 'Search'}
          </div>
          <div className="relative w-full sm:max-w-xs">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={lang === 'zh' ? '输入公式名，如 勾股 / 顶点 / 概率' : 'Type a formula name, e.g. vertex / probability'}
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
              {lang === 'zh' ? FORMULA_CATEGORY_ZH[c] : FORMULA_CATEGORY_EN[c]}
            </button>
          ))}
        </div>
      </div>

      {/* 公式卡片墙 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {filtered.map((f) => (
          <button
            key={f.name.zh}
            type="button"
            onClick={() => setSelected(f)}
            aria-label={`${f.name.zh} ${f.name.en}`}
            className="relative border border-[var(--border)] bg-[var(--card-bg)] px-3 py-3 flex flex-col items-center gap-1.5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:border-[var(--fg)]"
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
            <Formula tex={f.formula} className="text-[13px] text-[var(--fg)]" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelected(null)}>
          <div
            className="relative w-full max-w-md border border-[var(--border)] bg-[var(--bg)] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.15)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={`${selected.name.zh} ${selected.name.en}`}
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
              <div className="text-[10px] mono-font text-[var(--muted)]">
                {lang === 'zh' ? FORMULA_CATEGORY_ZH[selected.category] : FORMULA_CATEGORY_EN[selected.category]}
              </div>
              <div className="mt-1 text-lg font-semibold serif-font text-[var(--fg)]">
                {lang === 'zh' ? selected.name.zh : selected.name.en}
              </div>
              {/* 公式（KaTeX 独立成行；超长公式可横向滚动兜底） */}
              <div className="mt-3 border border-[var(--border)] p-3 flex items-center justify-center bg-[var(--card-bg)] overflow-x-auto">
                <Formula tex={selected.formula} block className="text-base text-[var(--fg)]" />
              </div>
              <div className="text-xs serif-font italic text-[var(--muted)] mt-1.5">
                {lang === 'zh' ? selected.label.zh : selected.label.en}
              </div>

              {/* 配图（几何/函数示意图，点击可放大查看） */}
              {selected.diagram && (
                <div className="mt-2 border border-[var(--border)] p-2 bg-[var(--card-bg)] flex items-center justify-center cursor-zoom-in" onClick={() => setZoomDiagram(true)} role="button" aria-label={lang === 'zh' ? '放大示意图' : 'Zoom diagram'}>
                  {selected.diagram.kind === 'pythagorean' || selected.diagram.kind === 'chord' || selected.diagram.kind === 'inscribed' || selected.diagram.kind === 'sector' ? (
                    <FormulaDiagram type={selected.diagram.kind} className="w-full max-w-[300px]" />
                  ) : (
                    <FunctionDiagram type={selected.diagram.kind} className="w-full max-w-[320px]" />
                  )}
                </div>
              )}
            </div>

            <div className="mt-3 space-y-2 text-sm serif-font text-[var(--fg)]">
              <div className="border border-[var(--border)] p-2.5">
                <div className="text-[10px] mono-font text-[var(--muted)] tracking-widest mb-1">
                  // {lang === 'zh' ? '记忆要点' : 'Tip'}
                </div>
                <p className="leading-relaxed">{renderRich(lang === 'zh' ? selected.tip.zh : selected.tip.en)}</p>
              </div>
              <div className="border border-[var(--border)] p-2.5">
                <div className="text-[10px] mono-font text-[var(--muted)] tracking-widest mb-1">
                  // {lang === 'zh' ? '易错点' : 'Pitfall'}
                </div>
                <p className="leading-relaxed">{renderRich(lang === 'zh' ? selected.pitfall.zh : selected.pitfall.en)}</p>
              </div>
              <div className="border border-[var(--border)] p-2.5">
                <div className="text-[10px] mono-font text-[var(--muted)] tracking-widest mb-1">
                  // {lang === 'zh' ? '典型应用' : 'Usage'}
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
                    {lang === 'zh' ? `关联探究：${labMap[selected.labId].name.zh}` : `Related: ${labMap[selected.labId].name.en}`}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 配图放大预览（全屏） */}
      {zoomDiagram && selected?.diagram && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setZoomDiagram(false)}
          role="dialog"
          aria-label={`${selected.name.zh} ${selected.name.en}`}
        >
          <div className="relative max-w-xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="border border-[var(--border)] bg-white p-4 flex items-center justify-center">
              {selected.diagram.kind === 'pythagorean' || selected.diagram.kind === 'chord' || selected.diagram.kind === 'inscribed' || selected.diagram.kind === 'sector' ? (
                <FormulaDiagram type={selected.diagram.kind} className="w-full max-w-[440px]" />
              ) : (
                <FunctionDiagram type={selected.diagram.kind} className="w-full max-w-[460px]" />
              )}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs mono-font text-white/80">
                {lang === 'zh' ? selected.name.zh : selected.name.en}
              </span>
              <button
                type="button"
                onClick={() => setZoomDiagram(false)}
                className="text-xs mono-font text-white/80 hover:text-white underline"
              >
                {lang === 'zh' ? '关闭' : 'Close'} ×
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

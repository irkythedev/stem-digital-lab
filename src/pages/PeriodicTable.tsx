/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 化学工具页 · 元素周期表
 *
 * 18 列标准周期表（7 周期 + 镧系/锕系独立两行），三色区分
 * 金属 / 非金属 / 稀有气体（类金属单独色系）。
 * 点击元素弹出详情卡：原子序数、符号、中英文名、相对原子质量、周期/族，
 * 并可用浏览器语音（Web Speech API）朗读中文名——免费、免登录、离线可用。
 *
 * 教材依据：ch03「元素周期表简介」——7 个横行 18 个纵列，金属/非金属/稀有气体
 * 用不同颜色区分，标出相对原子质量；元素周期表是学习和研究化学的重要工具。
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Volume2 } from 'lucide-react';
import { useApp } from '../lib/app-context';
import { ELEMENTS, type ElementInfo } from '../lib/elements';

/** 类别 → 配色（教科书三色区分；类金属用中间色）——浅色背景填充 + 同色系边框 */
const CAT_COLOR: Record<ElementInfo['cat'], { border: string; text: string; bg: string }> = {
  metal: { border: '#C71D23', text: 'var(--fg)', bg: 'rgba(199,29,35,0.08)' },        // 金属：红
  nonmetal: { border: '#2f7d4f', text: 'var(--fg)', bg: 'rgba(47,125,79,0.09)' },     // 非金属：绿
  noble: { border: '#3d6bb3', text: 'var(--fg)', bg: 'rgba(61,107,179,0.10)' },       // 稀有气体：蓝
  metalloid: { border: '#8a6d1f', text: 'var(--fg)', bg: 'rgba(138,109,31,0.10)' },   // 类金属：黄褐
};

/** 类别中文名 */
const CAT_ZH: Record<ElementInfo['cat'], string> = {
  metal: '金属元素',
  nonmetal: '非金属元素',
  noble: '稀有气体',
  metalloid: '类金属',
};

export default function PeriodicTable() {
  const { t, lang } = useApp();
  const [selected, setSelected] = useState<ElementInfo | null>(null);
  const [query, setQuery] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [tab, setTab] = useState<'props' | 'story'>('props');

  const isZh = lang === 'zh';

  // 检索：符号精确优先 / 否则符号前缀、中文包含、英文前缀（避免短查询过度匹配）
  const queryLower = query.trim().toLowerCase();
  const exactSymbol = queryLower ? ELEMENTS.find((e) => e.symbol.toLowerCase() === queryLower) : undefined;
  const matchN = (e: ElementInfo) => {
    if (!queryLower) return false;
    // 查询恰好等于某符号 → 只精确高亮该元素（如 "fe"→仅 Fe、"cu"→仅 Cu）
    if (exactSymbol) return e.n === exactSymbol.n;
    const sym = e.symbol.toLowerCase();
    return (
      sym.startsWith(queryLower) ||
      e.zh.includes(queryLower) ||
      e.en.toLowerCase().startsWith(queryLower)
    );
  };

  /** 朗读中文名（Web Speech API，免费免登录离线） */
  const speak = (e: ElementInfo) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(e.zh);
    u.lang = 'zh-CN';
    u.rate = 0.85;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  };

  /** 主表 7 周期 + 镧系(6) + 锕系(7) */
  const mainRows = ELEMENTS.filter((e) => e.y <= 7);
  const lanthanides = ELEMENTS.filter((e) => e.period === 6 && e.y === 9);
  const actinides = ELEMENTS.filter((e) => e.period === 7 && e.y === 10);

  /** 元素格子（教材样式：左上角核电荷数 + 符号 + 中文名 + 底部相对原子质量） */
  const renderCell = (el: ElementInfo) => {
    const color = CAT_COLOR[el.cat];
    const matched = queryLower ? matchN(el) : false;
    return (
      <button
        key={el.n}
        type="button"
        onClick={() => { setSelected(el); setTab('props'); }}
        title={`${el.zh} ${el.symbol}`}
        aria-label={`${el.zh} ${el.symbol}`}
        className={`relative flex-1 h-[58px] flex flex-col border transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:border-[var(--fg)] ${
          matched ? 'ring-2 ring-[var(--fg)]' : ''
        }`}
        style={{ borderColor: color.border, backgroundColor: color.bg }}
      >
        {/* 核电荷数（左上角） */}
        <span className="absolute top-0.5 left-1 text-[9px] mono-font text-[var(--muted)] leading-none">
          {el.n}
        </span>
        {/* 符号（居中，醒目） */}
        <span className="flex-1 flex items-center justify-center text-[16px] font-bold mono-font leading-none" style={{ color: color.text }}>
          {el.symbol}
        </span>
        {/* 中文名 */}
        <span className="text-center text-[10px] serif-font leading-none mb-0.5">{el.zh}</span>
        {/* 相对原子质量（底部，调大调浅） */}
        <span className="text-center text-[9px] mono-font text-[var(--muted)] leading-none mb-0.5 opacity-80">
          {el.mass ?? ''}
        </span>
      </button>
    );
  };

  return (
    <main className="flex-1 flex flex-col my-10 px-2 sm:px-6">
      <Link to="/subject/chemistry" className="text-xs mono-font text-[var(--muted)] underline hover:text-[var(--fg)]">
        ← {lang === 'zh' ? '返回化学' : 'Back to Chemistry'}
      </Link>

      <div className="mt-5 mb-6">
        <h1 className="text-3xl sm:text-4xl font-medium tracking-tight serif-font text-[var(--fg)]">
          {lang === 'zh' ? '元素周期表' : 'Periodic Table'}
        </h1>
        <p className="mt-2 text-xs serif-font italic text-[var(--muted)]">
          {lang === 'zh'
            ? '元素周期表是学习和研究化学的重要工具。由俄国化学家门捷列夫于 1869 年提出，现行版本由国际纯粹与应用化学联合会（IUPAC）维护，随新元素发现持续更新（最近于 2016 年补全 113–118 号）。点击元素查看信息，点小喇叭听读音。'
            : 'The periodic table is an essential tool for chemistry. Proposed by Dmitri Mendeleev in 1869, the current version is maintained by IUPAC and keeps updating as new elements are discovered (most recently completing 113–118 in 2016). Tap an element for details, tap the speaker to hear its name.'}
        </p>
      </div>

      {/* 检索 + 图例（灰色背景模块，与表格区视觉分离） */}
      <div className="mb-5 border border-[var(--border)] bg-[var(--card-bg)] p-3 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-[11px] mono-font text-[var(--muted)]">
            {lang === 'zh' ? '检索元素' : 'Search'}
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={lang === 'zh' ? '输入元素符号或中文名，如 H / 氢' : 'Type a symbol or name, e.g. H / Hydrogen'}
            className="w-full sm:max-w-xs border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg)] outline-none focus:border-[var(--fg)]"
          />
        </div>
        {/* 图例 */}
        <div className="flex flex-wrap gap-4 text-[10px] mono-font text-[var(--muted)]">
          {(Object.keys(CAT_COLOR) as ElementInfo['cat'][]).map((c) => (
            <span key={c} className="flex items-center gap-1.5">
              <span className="w-3 h-3 border" style={{ borderColor: CAT_COLOR[c].border, backgroundColor: CAT_COLOR[c].bg }} />
              {isZh ? CAT_ZH[c] : c}
            </span>
          ))}
        </div>
      </div>

      {/* 主表 */}
      <div className="mb-1 text-[10px] mono-font text-[var(--muted)] sm:hidden">
        {lang === 'zh' ? '← 左右滑动查看完整周期表 →' : '← Swipe to see the full table →'}
      </div>
      {/* pt-3 给第一行（氢/氦）hover 上浮留出空间，避免被上方模块遮挡 */}
      <div className="overflow-x-auto pt-3 -mt-1">
        <div className="min-w-[720px] xl:min-w-[880px]">
          {/* 周期行 */}
          {[1, 2, 3, 4, 5, 6, 7].map((period) => (
            <div key={period} className="flex gap-1 mb-1">
              {/* 周期号 */}
              <span className="w-6 shrink-0 flex items-center justify-center text-[9px] mono-font text-[var(--muted)]">
                {period}
              </span>
              {Array.from({ length: 18 }, (_, i) => {
                const col = i + 1;
                const el = mainRows.find((e) => e.x === col && e.y === period);
                if (el) return renderCell(el);
                // 镧系/锕系占位格（主表第 6/7 周期 IIIB 族位置，对应下方独立两行）
                if (col === 3 && period === 6) {
                  return (
                    <div key={col} className="flex-1 h-[58px] flex flex-col items-center justify-center border border-[var(--border)] text-center leading-tight px-0.5">
                      <span className="text-[10px] serif-font text-[var(--fg)]">{lang === 'zh' ? '镧系' : 'La'}</span>
                      <span className="text-[9px] mono-font text-[var(--muted)]">{lang === 'zh' ? '57–71' : '57–71'}</span>
                    </div>
                  );
                }
                if (col === 3 && period === 7) {
                  return (
                    <div key={col} className="flex-1 h-[58px] flex flex-col items-center justify-center border border-[var(--border)] text-center leading-tight px-0.5">
                      <span className="text-[10px] serif-font text-[var(--fg)]">{lang === 'zh' ? '锕系' : 'Ac'}</span>
                      <span className="text-[9px] mono-font text-[var(--muted)]">{lang === 'zh' ? '89–103' : '89–103'}</span>
                    </div>
                  );
                }
                return <div key={col} className="flex-1 h-[58px]" />;
              })}
            </div>
          ))}

          {/* 空行（分隔） */}
          <div className="h-4" />

          {/* 镧系 */}
          <div className="flex gap-1 mb-1">
            <span className="w-6 shrink-0 flex items-center justify-center text-[9px] mono-font text-[var(--muted)]">
              {lang === 'zh' ? '镧系' : 'La'}
            </span>
            {lanthanides.map((el) => renderCell(el))}
          </div>
          {/* 锕系 */}
          <div className="flex gap-1 mb-1">
            <span className="w-6 shrink-0 flex items-center justify-center text-[9px] mono-font text-[var(--muted)]">
              {lang === 'zh' ? '锕系' : 'Ac'}
            </span>
            {actinides.map((el) => renderCell(el))}
          </div>
        </div>
      </div>

      {/* 底部说明 */}
      <p className="mt-5 text-[11px] serif-font text-[var(--muted)] leading-relaxed">
        {lang === 'zh'
          ? '注：周期表按原子序数（核电荷数）递增排列；第 8、9、10 三个纵列共同组成一个族。相对原子质量为近似值。'
          : 'Note: ordered by atomic number (nuclear charge); columns 8-10 together form one group. Atomic masses are approximate.'}
      </p>

      {/* 元素详情卡 */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelected(null)}>
          <div
            className="relative w-full max-w-xs border border-[var(--border)] bg-[var(--bg)] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.15)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={`${selected.zh} ${selected.symbol}`}
          >
            {/* 关闭按钮：独立右上角（无边框，仅 ×） */}
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label={lang === 'zh' ? '关闭' : 'Close'}
              className="absolute top-2 right-3 w-7 h-7 flex items-center justify-center text-lg text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
            >
              ×
            </button>

            <div className="flex items-start justify-between pr-8">
              <div>
                <div className="text-[10px] mono-font text-[var(--muted)]">#{selected.n}</div>
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-bold serif-font text-[var(--fg)]">{selected.zh}</span>
                  {/* 读音按钮：放在中文名旁边 */}
                  <button
                    type="button"
                    onClick={() => speak(selected)}
                    title={lang === 'zh' ? '朗读' : 'Listen'}
                    aria-label={lang === 'zh' ? '朗读' : 'Listen'}
                    className="flex items-center justify-center w-8 h-8 border border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)] transition-colors"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-sm mono-font text-[var(--muted)]">{selected.symbol}</div>
              </div>
            </div>

            <div className="mt-3 text-sm serif-font text-[var(--fg)]">
              {/* Tab 切换：基础属性 / 百科故事 */}
              <div className="flex border border-[var(--border)] mb-3 text-[11px] mono-font">
                <button
                  type="button"
                  onClick={() => setTab('props')}
                  className={`flex-1 py-1.5 transition-colors ${tab === 'props' ? 'bg-[var(--fg)] text-[var(--bg)]' : 'text-[var(--muted)] hover:text-[var(--fg)]'}`}
                >
                  {lang === 'zh' ? '基础属性' : 'Properties'}
                </button>
                <button
                  type="button"
                  onClick={() => setTab('story')}
                  className={`flex-1 py-1.5 transition-colors ${tab === 'story' ? 'bg-[var(--fg)] text-[var(--bg)]' : 'text-[var(--muted)] hover:text-[var(--fg)]'}`}
                >
                  {lang === 'zh' ? '百科故事' : 'Story'}
                </button>
              </div>

              {/* 基础属性面板 */}
              {tab === 'props' && (
                <>
              {/* 原子结构示意图（教材简绘：核 + 实线轨道 + 电子点） */}
              <div className="border border-[var(--border)] p-2 mb-3">
                <div className="text-[10px] mono-font text-[var(--muted)] tracking-widest mb-1">
                  // {lang === 'zh' ? '原子结构示意图' : 'Bohr model'}
                </div>
                <svg viewBox="0 0 180 150" className="w-full max-h-[170px]" aria-label={`${selected.zh} 原子结构`}>
                  {/* 动态轨道半径：按层数分配，任何元素（1~7 层）都清晰不溢出 */}
                  {(() => {
                    const layers = selected.shells.length;
                    const cx = 90, cy = 75;
                    // 核半径随位数自适应：1-2 位 +111 三位数时核加大、字号缩小，避免文字出格
                    const digits = String(selected.n).length;
                    const coreR = digits >= 3 ? 16 : 13;
                    const coreFont = digits >= 3 ? 10 : 13;
                    // 最大可用半径：略放大（允许最外层轻微裁切，核居中即可），多层元素仍清晰
                    const maxR = Math.min(64, coreR + 51);
                    const step = layers > 1 ? (maxR - coreR) / (layers - 1) : 0;
                    const rOf = (i: number) => coreR + (layers > 1 ? i * step : 14);
                    return (
                      <>
                        {/* 电子层轨道：实线浅灰圆环 */}
                        {selected.shells.map((_, i) => (
                          <circle key={i} cx={cx} cy={cy} r={rOf(i)} fill="none" stroke="var(--muted)" strokeWidth="0.9" opacity="0.45" />
                        ))}
                        {/* 原子核（核电荷数） */}
                        <circle cx={cx} cy={cy} r={coreR} fill="var(--card-bg)" stroke="var(--fg)" strokeWidth="1.2" />
                        <text x={cx} y={cy + (coreFont >= 13 ? 4 : 3.5)} textAnchor="middle" fontSize={coreFont} fill="var(--fg)" fontFamily="var(--f-mono)" fontWeight="bold">
                          +{selected.n}
                        </text>
                        {/* 各层电子：绕核旋转（内快外慢、交替反向）；每层最多 8 个示意点 */}
                        {selected.shells.map((count, i) => {
                          const r = rOf(i);
                          const dots: { x: number; y: number }[] = [];
                          const show = Math.min(count, 8);
                          for (let k = 0; k < show; k++) {
                            const a = (k / show) * 2 * Math.PI - Math.PI / 2;
                            dots.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
                          }
                          // 内层快(3s)、外层慢(9s)；相邻层反向
                          const dur = (3 + i * 2).toFixed(1);
                          const reverse = i % 2 === 1;
                          return (
                            <g
                              key={i}
                              className="electron-layer"
                              style={{ animationDuration: `${dur}s`, animationDirection: reverse ? 'reverse' : 'normal' }}
                            >
                              {dots.map((d, k) => (
                                <circle key={k} cx={d.x} cy={d.y} r="2.3" fill="var(--fg)" />
                              ))}
                            </g>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>
              </div>

              {/* 属性列表：斑马线行距 */}
              <dl className="divide-y divide-[var(--border)]">
                {[
                  { k: lang === 'zh' ? '英文名' : 'English', v: selected.en },
                  { k: lang === 'zh' ? '核电荷数（原子序数）' : 'Nuclear charge (atomic number)', v: String(selected.n) },
                  { k: lang === 'zh' ? '电子层排布' : 'Electron shells', v: selected.shells.join(', ') },
                  { k: lang === 'zh' ? '相对原子质量' : 'Atomic mass', v: selected.mass != null ? String(selected.mass) : '—' },
                  { k: lang === 'zh' ? '位置' : 'Position', v: lang === 'zh' ? `第 ${selected.period} 周期，第 ${selected.group ?? '?'} 族` : `Period ${selected.period}, Group ${selected.group ?? '?'}` },
                  { k: lang === 'zh' ? '类别' : 'Category', v: isZh ? CAT_ZH[selected.cat as ElementInfo['cat']] : selected.cat },
                ].map((row, i) => (
                  <div key={row.k} className={`flex items-baseline justify-between gap-3 py-2 px-2 text-sm ${i % 2 === 1 ? 'bg-[var(--card-bg)]' : ''}`}>
                    <dt className="text-[var(--muted)] serif-font shrink-0">{row.k}</dt>
                    <dd className="text-right serif-font text-[var(--fg)]">{row.v}</dd>
                  </div>
                ))}
              </dl>
                </>
              )}

              {/* 百科故事面板 */}
              {tab === 'story' && (
                <div className="border border-[var(--border)] p-3 space-y-3">
                  <div>
                    <div className="text-[10px] mono-font text-[var(--muted)] tracking-widest mb-1">
                      // {lang === 'zh' ? '发现史' : 'Discovery'}
                    </div>
                    <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">
                      {lang === 'zh' ? selected.discovery.zh : selected.discovery.en}
                    </p>
                  </div>
                  <div>
                    <div className="text-[10px] mono-font text-[var(--muted)] tracking-widest mb-1">
                      // {lang === 'zh' ? '生活与常见用途' : 'Where you find it'}
                    </div>
                    <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">
                      {lang === 'zh' ? selected.usage.zh : selected.usage.en}
                    </p>
                  </div>
                  <p className="text-[10px] serif-font italic text-[var(--muted)] leading-relaxed">
                    {lang === 'zh'
                      ? '发现史与用途为简要科普，具体年代与细节以权威化学史资料为准。'
                      : 'Discovery and uses are brief; exact dates and details defer to authoritative chemistry history sources.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

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
import { useApp } from '../lib/app-context';
import { ELEMENTS, type ElementInfo } from '../lib/elements';

/** 类别 → 配色（教科书三色区分；类金属用中间色） */
const CAT_COLOR: Record<ElementInfo['cat'], { border: string; text: string }> = {
  metal: { border: '#C71D23', text: 'var(--fg)' },        // 金属：红
  nonmetal: { border: '#2f7d4f', text: 'var(--fg)' },     // 非金属：绿
  noble: { border: '#3d6bb3', text: 'var(--fg)' },        // 稀有气体：蓝
  metalloid: { border: '#8a6d1f', text: 'var(--fg)' },    // 类金属：黄褐
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

  const isZh = lang === 'zh';

  // 检索：符号或中文名匹配
  const queryLower = query.trim().toLowerCase();
  const matchN = (e: ElementInfo) =>
    queryLower && (e.symbol.toLowerCase().includes(queryLower) || e.zh.includes(queryLower) || e.en.toLowerCase().includes(queryLower));

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

  /** 元素格子 */
  const renderCell = (el: ElementInfo) => {
    const color = CAT_COLOR[el.cat];
    const matched = queryLower ? matchN(el) : false;
    return (
      <button
        key={el.n}
        type="button"
        onClick={() => setSelected(el)}
        title={`${el.zh} ${el.symbol}`}
        aria-label={`${el.zh} ${el.symbol}`}
        className={`flex-1 h-[52px] flex flex-col items-center justify-center border transition-colors hover:bg-[var(--accent-light)] ${
          matched ? 'ring-2 ring-[var(--fg)]' : ''
        }`}
        style={{ borderColor: color.border }}
      >
        <span className="text-[8px] mono-font text-[var(--muted)] leading-none">{el.n}</span>
        <span className="text-[13px] font-bold mono-font leading-tight" style={{ color: color.text }}>
          {el.symbol}
        </span>
        <span className="text-[9px] serif-font leading-none">{el.zh}</span>
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
            ? '元素周期表是学习和研究化学的重要工具。点击元素查看信息，点小喇叭听读音。'
            : 'The periodic table is an essential tool for chemistry. Tap an element for details, tap the speaker to hear its name.'}
        </p>
      </div>

      {/* 检索 */}
      <div className="mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={lang === 'zh' ? '输入元素符号或中文名，如 H / 氢' : 'Type a symbol or name, e.g. H / Hydrogen'}
          className="w-full max-w-xs border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg)] outline-none focus:border-[var(--fg)]"
        />
      </div>

      {/* 图例 */}
      <div className="mb-4 flex flex-wrap gap-4 text-[10px] mono-font text-[var(--muted)]">
        {(Object.keys(CAT_COLOR) as ElementInfo['cat'][]).map((c) => (
          <span key={c} className="flex items-center gap-1.5">
            <span className="w-3 h-3 border-2" style={{ borderColor: CAT_COLOR[c].border }} />
            {isZh ? CAT_ZH[c] : c}
          </span>
        ))}
      </div>

      {/* 主表 */}
      <div className="overflow-x-auto">
        <div className="min-w-[680px]">
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
                if (!el) return <div key={col} className="flex-1 h-[52px]" />;
                return renderCell(el);
              })}
            </div>
          ))}

          {/* 空行（分隔） */}
          <div className="h-4" />

          {/* 镧系 */}
          <div className="flex gap-1 mb-1">
            <span className="w-6 shrink-0 flex items-center justify-center text-[9px] mono-font text-[var(--muted)]">*</span>
            {lanthanides.map((el) => renderCell(el))}
          </div>
          {/* 锕系 */}
          <div className="flex gap-1 mb-1">
            <span className="w-6 shrink-0 flex items-center justify-center text-[9px] mono-font text-[var(--muted)]">**</span>
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
            className="w-full max-w-xs border border-[var(--border)] bg-[var(--bg)] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.15)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={`${selected.zh} ${selected.symbol}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] mono-font text-[var(--muted)]">#{selected.n}</div>
                <div className="text-3xl font-bold serif-font text-[var(--fg)]">{selected.zh}</div>
                <div className="text-sm mono-font text-[var(--muted)]">{selected.symbol}</div>
              </div>
              {/* 读音按钮 */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => speak(selected)}
                  title={lang === 'zh' ? '朗读' : 'Listen'}
                  aria-label={lang === 'zh' ? '朗读' : 'Listen'}
                  className="flex items-center justify-center w-9 h-9 border border-[var(--fg)] text-[var(--fg)] hover:bg-[var(--accent-light)] transition-colors"
                >
                  {speaking ? '…' : '🔊'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="text-xs mono-font text-[var(--muted)] hover:text-[var(--fg)]"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="mt-3 space-y-1.5 text-sm serif-font text-[var(--fg)]">
              <p><span className="text-[var(--muted)]">{lang === 'zh' ? '英文名' : 'English'}:</span> {selected.en}</p>
              <p>
                <span className="text-[var(--muted)]">{lang === 'zh' ? '相对原子质量' : 'Atomic mass'}:</span>{' '}
                {selected.mass ?? '—'}
              </p>
              <p>
                <span className="text-[var(--muted)]">{lang === 'zh' ? '位置' : 'Position'}:</span>{' '}
                {lang === 'zh' ? `第 ${selected.period} 周期，第 ${selected.group ?? '?'} 族` : `Period ${selected.period}, Group ${selected.group ?? '?'}`}
              </p>
              <p className="text-[var(--muted)]">
                {isZh ? CAT_ZH[selected.cat as ElementInfo['cat']] : selected.cat}
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

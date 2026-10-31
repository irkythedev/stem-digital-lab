/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 元素详情抽屉（跨页面公共组件，唯一实现）。
 *
 * 由 PeriodicTable 的元素详情面板抽离而来，PeriodicTable 与 ChemistryFormulas 共用：
 *   - 完整的玻尔模型（2D 课本规范 + 可选 3D）、电子层胶囊、微粒看板、族/周期/原子量、
 *     外层得失倾向、实物照片、发现史/用途、读音——全部沿用原有成熟排版；
 *   - `actionSlot`：调用方可选传入底部次要动作（化学式页传「在完整元素周期表中查看」深链，
 *     周期表自身不传，避免跳回自身的冗余链接）。
 *
 * 依赖：数据与配色统一来自 lib/elements、lib/element-categories、lib/atom-shells；
 * 纯函数邻居/微粒/倾向等来自 pages/PeriodicTable（保持单一实现，不重复抄写）。
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, LoaderCircle, Volume2, X, Box } from 'lucide-react';
import Atom3D from '../lab/Atom3D';
import { ValenceBadge } from '../chemistry/ChemFormula';
import AskAiButton from '../ai/AskAiButton';
import AskQuizButton from '../ai/AskQuizButton';
import { ELEMENTS, type ElementInfo } from '../../lib/elements';
import { ATOM_VIEW, coreRadiusFor, shellLayout } from '../../lib/atom-shells';
import { CAT_COLOR, CAT_ZH, CAT_EN } from '../../lib/element-categories';
import { valenceElementBySymbol, TEXTBOOK_MASSES } from '../../lib/chemistry/valency';
import { useLockBodyScroll } from '../../lib/use-lock-body-scroll';
import {
  LEGEND_DOT, SHELL_NAMES, VALENCE_LABEL, groupDisplay, neighborOf, particleCount,
  valenceTendency, valenceNote,
} from '../../pages/PeriodicTable';

/** 详情面板的状态/派生数据钩子（PeriodicTable 与 ChemistryFormulas 共用，零重复接线）。 */
export function useElementDetailState(element: ElementInfo | null, lang: 'zh' | 'en') {
  const [tab, setTab] = useState<'props' | 'story'>('props');
  const [atomMode, setAtomMode] = useState<'2d' | '3d'>('2d');
  const [hoveredLayer, setHoveredLayer] = useState<number | null>(null);
  const [pinnedLayer, setPinnedLayer] = useState<number | null>(null);
  const [photoZoom, setPhotoZoom] = useState(false);
  const isZh = lang === 'zh';
  // 换元素即复位：Tab 回基础属性、模型回 2D、层高亮与照片放大清空。
  useEffect(() => {
    setTab('props');
    setAtomMode('2d');
    setHoveredLayer(null);
    setPinnedLayer(null);
    setPhotoZoom(false);
  }, [element?.n]);
  const layerHighlight = (e: ElementInfo) => hoveredLayer ?? pinnedLayer ?? e.shells.length - 1;
  const selValence = element ? valenceTendency(element) : null;
  return {
    tab, setTab,
    atomMode, setAtomMode,
    hoveredLayer, setHoveredLayer,
    pinnedLayer, setPinnedLayer,
    photoZoom, setPhotoZoom,
    isZh,
    layerHighlight,
    selGroup: element ? groupDisplay(element, isZh) : null,
    selValence,
    selValenceNote: element && selValence ? valenceNote(element, selValence, isZh) : null,
    valenceInfo: element ? valenceElementBySymbol.get(element.symbol) : undefined,
  };
}

export interface ElementDetailSheetProps {
  selected: ElementInfo;
  onClose: () => void;
  onNavigate: (el: ElementInfo) => void;
  lang: 'zh' | 'en';
  isZh: boolean;
  tab: 'props' | 'story';
  setTab: (t: 'props' | 'story') => void;
  atomMode: '2d' | '3d';
  setAtomMode: (m: '2d' | '3d') => void;
  hoveredLayer: number | null;
  setHoveredLayer: (n: number | null) => void;
  pinnedLayer: number | null;
  setPinnedLayer: (n: number | null) => void;
  photoZoom: boolean;
  setPhotoZoom: (b: boolean) => void;
  layerHighlight: (e: ElementInfo) => number;
  speak: (e: ElementInfo) => void;
  speakState: 'idle' | 'loading' | 'playing';
  selGroup: ReturnType<typeof groupDisplay> | null;
  selValence: ReturnType<typeof import('../../pages/PeriodicTable').valenceTendency> | null;
  selValenceNote: string | null;
  valenceInfo: import('../../lib/chemistry/valency').ValenceElement | undefined;
  actionSlot?: ReactNode;
}

export default function ElementDetailSheet(props: ElementDetailSheetProps) {
  const {
    selected, onClose, onNavigate, lang, isZh, tab, setTab, atomMode, setAtomMode,
    hoveredLayer, setHoveredLayer, pinnedLayer, setPinnedLayer, photoZoom, setPhotoZoom,
    layerHighlight, speak, speakState, selGroup, selValence, selValenceNote, valenceInfo, actionSlot,
  } = props;
  const setSelected = (_v: ElementInfo | null) => onClose();
  const goTo = (el: ElementInfo) => onNavigate(el);
  void selValence;

  // 抽屉打开时锁 body 滚动；Esc 关闭（化学式页没有页面级键盘处理，需组件自带）。
  useLockBodyScroll(true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <>
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 p-2 sm:p-4 backdrop-blur-[1px]"
          onClick={() => setSelected(null)}
        >
          <div
            /* 顶部锚定（Top-anchored）：外框顶边由 overlay 的 padding 固定（8 / 16px），
               高度随内容向下生长——两个 Tab 高度不一致时，弹窗头部与 Tab 控制栏**绝对静止**，
               绝不再因「垂直居中重算」整体上下跳（改前实测：1280×1100 下切 Tab 面板 top
               66 → 172 → 66，跳幅 106px = 高度差 212px 的一半）。max-h 与 padding 对齐，
               保证底边仍留出同样边距；overlay 自身 overflow-y-auto 兜底极矮视口。 */
            className="relative w-full max-w-sm sm:max-w-md max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] flex flex-col border border-[var(--border)] bg-[var(--bg)] shadow-[var(--elev-lg)] rounded-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={`${selected.zh} ${selected.symbol}`}
          >
            {/* 顶部固定标题与导航区 */}
            <div className="relative px-4 py-3 sm:px-5 sm:py-3.5 border-b border-[var(--border)] bg-[var(--bg)] shrink-0">
              {/* 相邻元素无缝切换：连续探索流。首末位（#1 H / #118 Og）自动禁用；
                  ← / → 方向键同效，便于同周期、同族比对。 */}
              {(() => {
                const { prev, next } = neighborOf(selected.n);
                const navCls = (on: boolean) =>
                  `inline-flex items-center gap-1 px-2 py-0.5 text-[0.6875rem] mono-font border rounded-md transition-colors touch-manipulation ${
                    on
                      ? 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)]'
                      : 'border-[var(--border)] text-[var(--muted)] opacity-35 cursor-not-allowed'
                  }`;
                return (
                  <div className="flex items-center justify-end gap-1.5 pr-9">
                    <button
                      type="button"
                      onClick={() => prev && goTo(prev)}
                      disabled={!prev}
                      aria-label={prev ? `${isZh ? '上一个元素' : 'Previous element'} #${prev.n} ${prev.zh} ${prev.symbol}` : (isZh ? '已是第一个元素' : 'First element')}
                      title={prev ? `#${prev.n} ${prev.zh} ${prev.symbol}` : (isZh ? '已是第一个元素' : 'First element')}
                      className={navCls(Boolean(prev))}
                    >
                      <ArrowLeft className="w-3 h-3 shrink-0" aria-hidden />
                      <span className="truncate max-w-[4.5rem]">{prev ? `#${prev.n} ${prev.symbol}` : '—'}</span>
                    </button>
                    <span className="shrink-0 px-0.5 text-[0.6875rem] mono-font text-[var(--muted)] tabular-nums">
                      <span className="text-[var(--fg)] font-medium">{selected.n}</span>
                      <span className="mx-0.5">/</span>
                      {ELEMENTS.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => next && goTo(next)}
                      disabled={!next}
                      aria-label={next ? `${isZh ? '下一个元素' : 'Next element'} #${next.n} ${next.zh} ${next.symbol}` : (isZh ? '已是最后一个元素' : 'Last element')}
                      title={next ? `#${next.n} ${next.zh} ${next.symbol}` : (isZh ? '已是最后一个元素' : 'Last element')}
                      className={navCls(Boolean(next))}
                    >
                      <span className="truncate max-w-[4.5rem]">{next ? `#${next.n} ${next.symbol}` : '—'}</span>
                      <ArrowRight className="w-3 h-3 shrink-0" aria-hidden />
                    </button>
                  </div>
                );
              })()}

              {/* 关闭按钮：独立右上角 */}
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label={lang === 'zh' ? '关闭' : 'Close'}
                className="absolute top-2.5 right-3 w-8 h-8 flex items-center justify-center text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--card-bg)] rounded-lg transition-colors touch-manipulation active:scale-95"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-start justify-between pr-8">
                <div>
                  <div className="text-[0.6875rem] mono-font text-[var(--muted)] font-medium">#{selected.n}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl sm:text-3xl font-bold serif-font text-[var(--fg)] leading-tight">{selected.zh}</span>
                    {/* 读音按钮：三态反馈（空闲/加载中/播放中） */}
                    <button
                      type="button"
                      onClick={() => speak(selected)}
                      disabled={speakState === 'loading'}
                      title={
                        lang === 'zh'
                          ? speakState === 'loading' ? '加载中…' : speakState === 'playing' ? '播放中' : '朗读'
                          : speakState === 'loading' ? 'Loading…' : speakState === 'playing' ? 'Playing' : 'Listen'
                      }
                      aria-label={
                        lang === 'zh'
                          ? speakState === 'loading' ? '加载中' : speakState === 'playing' ? '播放中' : '朗读'
                          : speakState === 'loading' ? 'Loading' : speakState === 'playing' ? 'Playing' : 'Listen'
                      }
                      className={`flex items-center justify-center w-8 h-8 rounded-sm hover:bg-[var(--card-bg)] transition-colors ${
                        speakState === 'playing'
                          ? 'text-[var(--fg)]'
                          : 'text-[var(--muted)] hover:text-[var(--fg)] disabled:opacity-60'
                      }`}
                    >
                      {speakState === 'loading' ? (
                        <LoaderCircle className="w-4 h-4 animate-spin" />
                      ) : (
                        <Volume2 className={`w-4 h-4 ${speakState === 'playing' ? 'animate-pulse' : ''}`} />
                      )}
                    </button>
                    {speakState === 'loading' && (
                      <span className="text-[0.6875rem] mono-font text-[var(--muted)]">{lang === 'zh' ? '加载中…' : 'Loading…'}</span>
                    )}
                    {speakState === 'playing' && (
                      <span className="inline-flex items-center gap-1 text-[0.6875rem] mono-font text-[var(--fg)]">
                        {lang === 'zh' ? '播放中' : 'Playing'}
                      </span>
                    )}
                  </div>
                  <div className="text-xs sm:text-sm mono-font text-[var(--muted)] mt-0.5">{selected.symbol}</div>
                </div>
              </div>

              {/* Tab 切换：基础属性 / 百科故事 */}
              <div className="dialog-tabs flex border border-[var(--border)] mt-2.5 text-xs mono-font rounded-xs overflow-hidden">
                <button
                  type="button"
                  onClick={() => setTab('props')}
                  className={`flex-1 py-1.5 transition-colors font-medium ${tab === 'props' ? 'bg-[var(--fg)] text-[var(--bg)]' : 'text-[var(--muted)] hover:text-[var(--fg)] bg-[var(--bg)]'}`}
                >
                  {lang === 'zh' ? '基础属性' : 'Properties'}
                </button>
                <button
                  type="button"
                  onClick={() => setTab('story')}
                  className={`flex-1 py-1.5 transition-colors font-medium ${tab === 'story' ? 'bg-[var(--fg)] text-[var(--bg)]' : 'text-[var(--muted)] hover:text-[var(--fg)] bg-[var(--bg)]'}`}
                >
                  {lang === 'zh' ? '百科故事' : 'Story'}
                </button>
              </div>
            </div>

            {/* 可滚动内容主体 */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 pt-3 overscroll-contain scrollbar-thin space-y-3 text-sm serif-font text-[var(--fg)]">
              {/* 基础属性面板 */}
              {tab === 'props' && (
                <>
                  {/* 原子结构示意图（教材简绘：核 + 实线轨道 + 电子点；悬停/点击电子层显示该层电子数）
                      视图切换：**默认 2D 课本规范**（「+Z」核圈 + 同心圆，中考必考画法）；3D 仅为可选的空间补充 */}
                  <div className="relative border border-[var(--border)] px-2 py-1 mb-1.5 bg-[var(--card-bg)]/30 rounded-xs">
                    {/* 左上：单行小标题（原先与双段控件同行且控件更高，控件收敛到右上角后释放该行高度） */}
                    <div className="text-[0.625rem] mono-font text-[var(--muted)] tracking-widest">
                      // {isZh ? '原子结构示意图' : 'Bohr model'}
                    </div>
                    {/* 图区右上角幽灵按钮（Ghost Button）：不占布局行，悬浮在外框内部右上角。
                        图标只描述「点下去会发生什么」，不再用「2D + 状态词」这类既像状态标识又像按钮的措辞：
                        2D 态 → 立方体（点击进入 3D 探索）；3D 态 → 同心圆（点击切回课本规范图）。
                        两态共用同一套幽灵样式（无描边、无底色），状态差异完全交给图标本身；
                        16px 下「立方体 / 双层同心圆」轮廓互不相似，浅色暗色均实测可辨。 */}
                    <button
                      type="button"
                      data-atom-mode={atomMode}
                      aria-pressed={atomMode === '3d'}
                      aria-label={isZh ? '原子模型视图' : 'Atom model view'}
                      title={atomMode === '3d'
                        ? (isZh ? '切回课本平面规范图' : 'Back to the flat textbook diagram')
                        : (isZh ? '查看 3D 立体模型' : 'Open the 3D model')}
                      onClick={() => setAtomMode(atomMode === '2d' ? '3d' : '2d')}
                      /* 轻盈徽章：按 .dialog-tabs 先例豁免全局 main button 的 40px 底线；p-1 + 16px 图标＝24px 命中区 */
                      style={{ minHeight: 0 }}
                      className="absolute top-1 right-1 z-10 inline-flex items-center justify-center p-1 rounded-xs border border-transparent text-[var(--muted)] hover:border-[var(--border)] hover:text-[var(--fg)] transition-colors touch-manipulation"
                    >
                      {atomMode === '3d' ? (
                        /* 同心圆＝课本平面规范图（核 + 电子层），即点下去会回到的那张图。
                           lucide 没有「核 + 两层」的三层同心圆，按 SVG 纪律内联绘制。 */
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <circle cx="12" cy="12" r="9.5" />
                          <circle cx="12" cy="12" r="5" />
                          <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
                        </svg>
                      ) : (
                        <Box size={16} strokeWidth={2} aria-hidden="true" />
                      )}
                    </button>
                    {atomMode === '2d' ? (
                    <svg viewBox="0 0 180 150" className="w-full max-h-[160px]" aria-label={`${selected.zh} 原子结构`}>
                      {/* 轨道半径与电子点位由 lib/atom-shells 统一给出（纯函数，smoke 测试共用同一实现） */}
                      {(() => {
                        const { cx, cy } = ATOM_VIEW;
                        // 核半径随位数自适应：1-2 位为 13；三位数时核加大、字号缩小，避免文字出格
                        const digits = String(selected.n).length;
                        const coreR = coreRadiusFor(selected.n);
                        const coreFont = digits >= 3 ? 10 : 13;
                        const shells = shellLayout(selected.shells, coreR);
                        return (
                          <>
                            {/* 电子层轨道 + 隐形感应区：悬停/点击整层都可触发，避免细线难点 */}
                            {shells.map((s, i) => {
                              const r = s.r;
                              const active = layerHighlight(selected) === i;
                              return (
                                <g
                                  key={i}
                                  className="cursor-pointer"
                                  onClick={() => setPinnedLayer(pinnedLayer === i ? null : i)}
                                  onMouseEnter={() => setHoveredLayer(i)}
                                  onMouseLeave={() => setHoveredLayer(null)}
                                >
                                  {/* 隐形感应区：透明粗描边，方便手指/鼠标命中整层 */}
                                  <circle cx={cx} cy={cy} r={r} fill="none" stroke="transparent" strokeWidth="16" />
                                  {/* 可见轨道：悬停/选中时加粗高亮 */}
                                  <circle
                                    cx={cx} cy={cy} r={r} fill="none"
                                    stroke={active ? 'var(--fg)' : 'var(--muted)'}
                                    strokeWidth={active ? 2 : 0.9}
                                    opacity={active ? 0.9 : 0.45}
                                    style={{ transition: 'stroke 0.2s ease, stroke-width 0.2s ease, opacity 0.2s ease' }}
                                  />
                                </g>
                              );
                            })}
                            {/* 原子核（核电荷数）：不拦截鼠标，穿透到第一层感应区便于触发 */}
                            <circle cx={cx} cy={cy} r={coreR} fill="var(--card-bg)" stroke="var(--fg)" strokeWidth="1.2" style={{ pointerEvents: 'none' }} />
                            <text x={cx} y={cy + (coreFont >= 13 ? 4 : 3.5)} textAnchor="middle" fontSize={coreFont} fill="var(--fg)" fontFamily="var(--f-mono)" fontWeight="bold" style={{ pointerEvents: 'none' }}>
                              +{selected.n}
                            </text>
                            {/* 各层电子：绕核旋转（内快外慢、交替反向）；
                                点数 = 该层真实电子数（不截断）——教材画法，且与属性栏「电子层排布」一致 */}
                            {shells.map((s, i) => {
                              // 内层快(3s)、外层慢(9s)；相邻层反向
                              const dur = (3 + i * 2).toFixed(1);
                              const reverse = i % 2 === 1;
                              const lit = layerHighlight(selected) === i;
                              return (
                                <g
                                  key={i}
                                  className="electron-layer"
                                  style={{ animationDuration: `${dur}s`, animationDirection: reverse ? 'reverse' : 'normal' }}
                                >
                                  {s.dots.map((d, k) => (
                                    <circle
                                      key={k}
                                      cx={d.x}
                                      cy={d.y}
                                      r={lit ? s.dotR + 0.55 : s.dotR}
                                      fill="var(--fg)"
                                      opacity={lit ? 1 : 0.42}
                                      style={{ transition: 'r 0.2s ease, opacity 0.2s ease' }}
                                    />
                                  ))}
                                </g>
                              );
                            })}
                          </>
                        );
                      })()}
                    </svg>
                    ) : (
                      /* 3D 立体模型：纯原生 Canvas 2D 自算投影（零 3D 库）；拖拽旋转，与下方胶囊联动高亮 */
                      <Atom3D
                        z={selected.n}
                        n={particleCount(selected).neutrons}
                        shells={selected.shells}
                        highlight={layerHighlight(selected)}
                        label={isZh ? `${selected.zh} 三维空间原子模型` : `${selected.en} 3D atom model`}
                      />
                    )}
                    {/* 高亮层电子数提示条（默认即最外层；绝对定位不占布局，避免卡片高度变化引起晃动） */}
                    {(() => {
                      const li = layerHighlight(selected);
                      const cnt = selected.shells[li];
                      if (cnt == null) return null;
                      return (
                        <div className="absolute bottom-1 left-2 text-[0.6875rem] mono-font text-[var(--fg)] pointer-events-none">
                          {/* 层名字母固定走 --f-serif。理由（2026-10 重测，旧注释的归因是错的）：
                              等宽字体天生所有字形同宽，「O 与 0 同宽」是定义不是证据。真实原因是字号——
                              本区块 text-[0.6875rem] = 11px，此尺寸下斜杠零与内部点都只剩 1–4 个像素，
                              第 5 层「O 层」紧挨着计数时仍会被读成「0 层」。serif 同尺寸下 O/0 墨量比 1.58×，
                              一眼可辨；计数仍留 mono 保持等宽对齐。自托管斜杠零在 ≥14px 才真分得开，
                              所以这里的 serif 不是临时补丁，是 11px 下的必要选择。 */}
                          <span className="serif-font">{SHELL_NAMES[li]}</span>
                          {lang === 'zh'
                            ? ` 层（第 ${li + 1} 层）：${cnt} 个电子`
                            : ` shell (#${li + 1}): ${cnt} electron${cnt > 1 ? 's' : ''}`}
                        </div>
                      );
                    })()}
                  </div>

                  {/* 电子层胶囊栏：把「2, 8, 13, 1」这类平铺文本变成可点条目；
                      点击胶囊或图上轨道圆环都锁定该层，默认高亮最外层（初中核心考点）。 */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[0.625rem] mono-font text-[var(--muted)] tracking-widest">
                      // {lang === 'zh' ? '电子层' : 'Shells'}
                    </span>
                    {selected.shells.map((cnt, i) => {
                      const lit = layerHighlight(selected) === i;
                      const isOuter = i === selected.shells.length - 1;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setPinnedLayer(pinnedLayer === i ? null : i)}
                          aria-pressed={lit}
                          aria-label={`${SHELL_NAMES[i]} ${cnt}${isOuter ? (lang === 'zh' ? '（最外层）' : ' (outermost)') : ''}`}
                          title={isOuter ? (lang === 'zh' ? '最外层电子数 · 初中核心考点' : 'Outermost shell electrons') : undefined}
                          /* 紧凑徽章行：按 .dialog-tabs 的既有先例豁免全局 main button 的 40px 底线
                             （同一状态在左侧结构图上另有 16px 宽的整环感应区，触控另有入口） */
                          style={{ minHeight: 0 }}
                          className={`inline-flex items-baseline gap-1 px-2 py-0.5 text-xs mono-font rounded border transition-colors touch-manipulation ${
                            lit
                              ? 'border-[var(--fg)] bg-[var(--accent-light)] text-[var(--fg)] font-semibold'
                              : 'border-transparent bg-[var(--accent-light)] text-[var(--muted)] hover:text-[var(--fg)]'
                          }`}
                        >
                          {/* 层名字母走 --f-serif（与图区提示条同源）：11px 下等宽的 O/0 只差几个像素，
                              会被误读成数字（理由详见图区提示条那段注释） */}
                          <span className="serif-font">{SHELL_NAMES[i]}</span>
                          <span className="tabular-nums">({cnt})</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* 学段分层：21 号起电子填入次外层与更内层轨道，排布不再符合初中「2,8,8,…」经验。
                      以紧凑通知徽章条呈现（正体、无左侧长竖线），替代原先的整行斜体小字。 */}
                  {selected.n >= 21 && (
                    <div className="flex items-start gap-1.5 text-[0.625rem] serif-font text-[var(--muted)] leading-relaxed">
                      <span className="mt-[1px] shrink-0 px-1 rounded-xs border border-[var(--border)] mono-font tracking-wide">
                        {lang === 'zh' ? '高中拓展' : 'Extension'}
                      </span>
                      <span>
                        {lang === 'zh'
                          ? '21 号起电子填入次外层与更内层轨道，第 3 层最多容纳 18 个电子，排布不再是「2, 8, 8, …」。初中重点掌握 1~20 号元素。'
                          : 'From Z = 21 electrons fill deeper subshells, so shell 3 holds up to 18 and the layout is no longer “2, 8, 8, …”. Junior high focuses on Z = 1–20.'}
                      </span>
                    </div>
                  )}

                  {/* 微观粒子计数看板：质子 / 中子 / 核外电子（初中铁律 A ≈ Z + N） */}
                  {(() => {
                    const pc = particleCount(selected);
                    const cells: Array<{ id: 'proton' | 'neutron' | 'electron'; k: string; sym: string; v: number }> = [
                      /* 三格与 LEGEND_DOT 的三套绘制配方一一对应（质子深色微球 / 中子浅米色微球 / 电子环点） */
                      { id: 'proton', k: lang === 'zh' ? '质子' : 'Protons', sym: 'Z', v: pc.protons },
                      { id: 'neutron', k: lang === 'zh' ? '中子' : 'Neutrons', sym: lang === 'zh' ? 'N（估算）' : 'N (est.)', v: pc.neutrons },
                      { id: 'electron', k: lang === 'zh' ? '核外电子' : 'Electrons', sym: 'Z', v: pc.electrons },
                    ];
                    return (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          {cells.map((cell) => (
                            <div key={cell.k} className="border border-[var(--border)] rounded-xs px-1.5 py-2 text-center bg-[var(--card-bg)]/40">
                              <div className="flex items-center justify-center gap-1.5 text-[0.625rem] mono-font text-[var(--muted)] tracking-wide">
                                {/* 微粒图例：核内两格是带高光的 3D 微球、核外电子是环点，形态本身即语义 */}
                                <span
                                  data-particle-dot={cell.id}
                                  data-dot-shape={cell.id === 'electron' ? 'ringed-dot' : 'sphere'}
                                  className="w-2 h-2 shrink-0 rounded-full"
                                  style={LEGEND_DOT[cell.id]}
                                  aria-hidden="true"
                                />
                                {cell.k}
                              </div>
                              <div className="text-xl sm:text-2xl font-bold mono-font text-[var(--fg)] leading-tight tabular-nums">{cell.v}</div>
                              <div className="text-[0.625rem] mono-font text-[var(--muted)]">{cell.sym}</div>
                            </div>
                          ))}
                        </div>
                        <p className="px-1 text-[0.625rem] serif-font text-[var(--muted)] leading-relaxed">
                          {lang === 'zh'
                            ? '核电荷数 = 质子数 = 核外电子数；相对原子质量 ≈ 质子数 + 中子数。中子数为估算值：质量按同位素丰度加权平均后取整（氯取 ³⁵Cl），放射性元素取最长寿命核素。'
                            : 'Nuclear charge = protons = electrons; relative atomic mass ≈ protons + neutrons. Neutrons are an estimate: mass is an abundance-weighted average rounded to a common stable isotope (³⁵Cl for chlorine); radioactive elements use their longest-lived nuclide.'}
                        </p>
                      </>
                    );
                  })()}

                  {/* 主指标卡：相对原子质量 / 周期 / 族（3 列看板，取代原先单列流水账） */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="border border-[var(--border)] rounded-xs px-2 py-2 bg-[var(--card-bg)]/40">
                      <div className="text-[0.625rem] mono-font text-[var(--muted)] tracking-wide">
                        {lang === 'zh' ? '相对原子质量 ' : 'Atomic mass '}
                        <i>A</i><sub>r</sub>
                      </div>
                      <div className="text-lg sm:text-xl font-bold mono-font text-[var(--fg)] leading-tight tabular-nums">
                        {selected.radioactive
                          ? String(selected.mass)
                          : (selected.massExact != null ? String(selected.massExact) : String(selected.mass ?? '—'))}
                      </div>
                      <div className="text-[0.625rem] mono-font text-[var(--muted)] leading-tight">
                        {selected.radioactive
                          ? (lang === 'zh' ? '质量数 · 无稳定同位素' : 'mass no. · no stable isotope')
                          : `${lang === 'zh' ? '标准' : 'standard'}${selected.massUnc ? ` ±${selected.massUnc}` : ''}`}
                      </div>
                      <div className="text-[0.625rem] mono-font text-[var(--muted)] leading-tight">
                        {lang === 'zh' ? '教材取整 ' : 'textbook '}
                        {TEXTBOOK_MASSES[selected.symbol] ?? '—'}
                      </div>
                    </div>
                    <div className="border border-[var(--border)] rounded-xs px-2 py-2 text-center bg-[var(--card-bg)]/40">
                      <div className="text-[0.625rem] mono-font text-[var(--muted)] tracking-wide">
                        {lang === 'zh' ? '周期' : 'Period'}
                      </div>
                      <div className="text-lg sm:text-xl font-bold mono-font text-[var(--fg)] leading-tight tabular-nums">{selected.period}</div>
                      <div className="text-[0.625rem] mono-font text-[var(--muted)] leading-tight">
                        {lang === 'zh' ? '第几横行' : 'row'}
                      </div>
                    </div>
                    <div className="border border-[var(--border)] rounded-xs px-2 py-2 text-center bg-[var(--card-bg)]/40">
                      <div className="text-[0.625rem] mono-font text-[var(--muted)] tracking-wide">
                        {lang === 'zh' ? '族' : 'Group'}
                      </div>
                      {/* 族标签走 --f-serif：罗马数字 Ⅰ~Ⅷ（U+2160–U+2167 预组合字符）不在等宽子集的字符集内，
                          会回退到某个含该字形的备用字体（与相邻 mono 数字不同源、观感割裂）；serif 栈
                          （Noto Serif CJK SC / Georgia）含该字形，才是「人教版标准罗马数字」的等效排印。
                          这一条与上面的 O/0 无关，换字体也换不掉。 */}
                      <div className="text-lg sm:text-xl font-bold serif-font text-[var(--fg)] leading-tight">{selGroup?.main ?? '—'}</div>
                      <div className="text-[0.625rem] mono-font text-[var(--muted)] leading-tight">
                        {selGroup?.sub ?? ''}
                      </div>
                      {selGroup?.series && (
                        <div className="mt-0.5 inline-block px-1 py-0.5 text-[0.625rem] mono-font rounded-xs bg-[var(--accent-light)] text-[var(--fg)]">
                          {selGroup.series}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 次级常规属性：紧凑排版行（英文名 / 类别徽章 / 核电荷数） */}
                  <dl className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                    {[
                      { k: lang === 'zh' ? '英文名' : 'English', v: selected.en },
                      { k: lang === 'zh' ? '类别' : 'Category', v: isZh ? CAT_ZH[selected.cat as ElementInfo['cat']] : CAT_EN[selected.cat as ElementInfo['cat']] },
                      { k: lang === 'zh' ? '核电荷数（原子序数）' : 'Nuclear charge (Z)', v: String(selected.n) },
                    ].map((row, i) => {
                      const isCat = row.k === (lang === 'zh' ? '类别' : 'Category');
                      return (
                        <div key={row.k} className={`flex items-baseline justify-between gap-3 py-2 px-2 text-sm ${i % 2 === 1 ? 'bg-[var(--card-bg)]/40' : ''}`}>
                          <dt className="text-[var(--muted)] serif-font shrink-0">{row.k}</dt>
                          <dd className="text-right serif-font text-[var(--fg)]">
                            {isCat ? (
                              // 类别：彩色标签（配色与检索图例一致：金属红/非金属绿/稀有气体蓝/类金属黄褐）
                              <span
                                className="inline-block px-2 py-0.5 border text-xs mono-font rounded-xs font-medium"
                                style={{
                                  borderColor: CAT_COLOR[selected.cat as ElementInfo['cat']].border,
                                  color: CAT_COLOR[selected.cat as ElementInfo['cat']].border,
                                  backgroundColor: CAT_COLOR[selected.cat as ElementInfo['cat']].bg,
                                }}
                              >
                                {row.v}
                              </span>
                            ) : (
                              row.v
                            )}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>

                  {/* 次级指标卡：可由数据直接推出的结构要点。
                      物性常数（熔点/沸点/密度）不在本仓数据模型中，此处不臆造数值；
                      将来补入授权数据后可在此插槽并行呈现。
                      「外层倾向」按分区给出：主族用初中得失规律，副族/f 区只说明可变化合价。 */}
                  {selValence && (
                    <div className="space-y-1.5">
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { k: lang === 'zh' ? '电子层数' : 'Shells', v: String(selected.shells.length) },
                          { k: lang === 'zh' ? '最外层电子数' : 'Outermost e⁻', v: String(selValence.outer) },
                          {
                            k: lang === 'zh' ? '外层倾向' : 'Tendency',
                            v: VALENCE_LABEL[selValence.kind][lang === 'zh' ? 'zh' : 'en']
                              + (selValence.kind === 'lose' || selValence.kind === 'gain' ? ` ${selValence.count}` : ''),
                          },
                        ].map((cell) => (
                          <div key={cell.k} className="border border-[var(--border)] rounded-xs px-1.5 py-2 text-center bg-[var(--card-bg)]/40">
                            <div className="text-[0.625rem] mono-font text-[var(--muted)] tracking-wide">{cell.k}</div>
                            <div className="text-sm sm:text-base font-bold mono-font text-[var(--fg)] leading-tight">{cell.v}</div>
                          </div>
                        ))}
                      </div>
                      {selValenceNote && (
                        <p className="px-1 text-[0.625rem] serif-font text-[var(--muted)] leading-relaxed border-l-2 border-[var(--border)] pl-2">
                          {selValenceNote}
                        </p>
                      )}
                    </div>
                  )}
                  {/* 初中化合价库交叉链接：价态徽章 + 一键生成 / 速查 */}
                  {valenceInfo && (
                    <div className="space-y-1.5 px-1 border-t border-[var(--border)] pt-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[0.625rem] mono-font text-[var(--muted)] tracking-wide">
                          {lang === 'zh' ? '初中常见化合价' : 'Common valences (junior high)'}
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {valenceInfo.valences.map((v) => (
                            <span key={v}>
                              <ValenceBadge valence={v} size="sm" />
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        <Link
                          to={`/chemistry-formulas?mode=builder&symbol=${selected.symbol}`}
                          className="inline-flex items-center gap-1 text-[0.6875rem] mono-font text-[var(--fg)] underline decoration-[var(--border)] underline-offset-4 hover:decoration-[var(--fg)]"
                        >
                          {lang === 'zh' ? '组化学式' : 'Build formula'}
                          <ArrowRight className="w-3 h-3" aria-hidden="true" />
                        </Link>
                        <Link
                          to={`/chemistry-formulas?mode=reference&symbol=${selected.symbol}`}
                          className="inline-flex items-center gap-1 text-[0.6875rem] mono-font text-[var(--fg)] underline decoration-[var(--border)] underline-offset-4 hover:decoration-[var(--fg)]"
                        >
                          {lang === 'zh' ? '查化合价详情' : 'Valence details'}
                          <ArrowRight className="w-3 h-3" aria-hidden="true" />
                        </Link>
                      </div>
                    </div>
                  )}
                  <p className="px-1 text-[0.625rem] serif-font text-[var(--muted)] leading-relaxed">
                    {lang === 'zh'
                      ? '相对原子质量为 IUPAC 标准原子量（2021 年修订）。'
                      : 'Atomic masses are IUPAC standard atomic weights (2021).'}
                  </p>
                </>
              )}

              {/* 百科故事面板 */}
              {tab === 'story' && (
                <div className="border border-[var(--border)] px-3 py-2.5 space-y-3 rounded-xs bg-[var(--card-bg)]/20">
                  {/* 元素实物照片（images-of-elements，CC BY 3.0）：点击放大；无图显示占位 */}
                  <div>
                    <div
                      className={`relative aspect-[4/3] w-full border border-[var(--border)] overflow-hidden rounded-xs ${selected.n <= 104 ? 'cursor-zoom-in' : ''}`}
                      onClick={() => selected.n <= 104 && setPhotoZoom(true)}
                      role={selected.n <= 104 ? 'button' : undefined}
                      aria-label={selected.n <= 104 ? (lang === 'zh' ? '放大实物照片' : 'Zoom element photo') : undefined}
                    >
                      <img
                        src={`/element-images/${selected.n}.jpg`}
                        alt={`${selected.zh} ${selected.symbol}`}
                        loading="lazy"
                        className="w-full h-full object-contain"
                        draggable={false}
                        onError={(e) => {
                          // 加载失败（超铀无图/离线）：隐藏图片，显示占位
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                          const fallback = e.currentTarget.parentElement?.querySelector('[data-photo-fallback]') as HTMLElement | null;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                      {/* 加载失败占位（超铀元素无实物照片） */}
                      <div
                        className="absolute inset-0 flex flex-col items-center justify-center gap-1 pointer-events-none bg-[var(--card-bg)]"
                        style={{ display: 'none' }}
                        data-photo-fallback
                      >
                        <span className="text-5xl font-bold mono-font text-[var(--muted)] opacity-30">{selected.symbol}</span>
                        <span className="text-[0.625rem] serif-font text-[var(--muted)]">
                          {lang === 'zh' ? '人工合成元素，暂无实物照片' : 'Synthetic element, no photo available'}
                        </span>
                      </div>
                    </div>
                    <p className="mt-1 text-[0.625rem] serif-font text-[var(--muted)]">
                      {selected.n >= 105
                        ? lang === 'zh'
                          ? '人工合成元素，暂无实物照片'
                          : 'Synthetic element, no photo available'
                        : selected.n >= 97
                          ? lang === 'zh'
                            ? '示意图（超铀元素无实物照片）· © images-of-elements（CC BY 3.0）'
                            : 'Illustration (superheavy element, no photo) · © images-of-elements (CC BY 3.0)'
                          : lang === 'zh'
                            ? '实物照片 © images-of-elements（CC BY 3.0）'
                            : 'Photo © images-of-elements (CC BY 3.0)'}
                    </p>
                  </div>
                  <div>
                    <div className="text-[0.6875rem] mono-font text-[var(--muted)] tracking-wider mb-1 font-medium">
                      // {lang === 'zh' ? '发现史' : 'Discovery'}
                    </div>
                    <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">
                      {lang === 'zh' ? selected.discovery.zh : selected.discovery.en}
                    </p>
                  </div>
                  <div>
                    <div className="text-[0.6875rem] mono-font text-[var(--muted)] tracking-wider mb-1 font-medium">
                      // {lang === 'zh' ? '生活与常见用途' : 'Where you find it'}
                    </div>
                    <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">
                      {lang === 'zh' ? selected.usage.zh : selected.usage.en}
                    </p>
                  </div>
                  <p className="text-[0.625rem] serif-font text-[var(--muted)] leading-relaxed">
                    {lang === 'zh'
                      ? '发现史与用途为简要科普，具体年代与细节以权威化学史资料为准。'
                      : 'Discovery and uses are brief; exact dates and details defer to authoritative chemistry history sources.'}
                  </p>
                </div>
              )}

              {/* 问 AI：看完元素详情后可一键提问 */}
              <div className="pt-2 pb-1 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <AskAiButton question={lang === 'zh' ? `请讲解元素「${selected.zh}」的性质与用途` : `Explain the element "${selected.en}" — its properties and uses`} />
                <AskQuizButton />
              </div>
            </div>
            {actionSlot ? (
              <div className="shrink-0 border-t border-[var(--border)] px-4 py-3">{actionSlot}</div>
            ) : null}
          </div>
        </div>
      )}

      {/* 实物照片放大预览（全屏） */}
      {photoZoom && selected && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-xs"
          onClick={() => setPhotoZoom(false)}
          role="dialog"
          aria-label={`${selected.zh} ${selected.symbol}`}
        >
          <div className="relative max-w-lg max-h-[92dvh] w-full flex flex-col" onClick={(e) => e.stopPropagation()}>
            <img
              src={`/element-images/${selected.n}.jpg`}
              alt={`${selected.zh} ${selected.symbol}`}
              className="w-full max-h-[78dvh] object-contain border border-[var(--border)] bg-white rounded-xs"
              draggable={false}
            />
            <div className="mt-2 flex items-center justify-between px-1 shrink-0">
              <span className="text-xs mono-font text-white/80">
                {selected.zh} {selected.symbol} · {selected.en}
              </span>
              <button
                type="button"
                onClick={() => setPhotoZoom(false)}
                className="text-xs mono-font text-white/80 hover:text-white hover:bg-white/10 active:bg-white/25 active:text-white rounded transition-colors min-h-[36px] px-2 flex items-center touch-manipulation"
              >
                {lang === 'zh' ? '关闭' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}

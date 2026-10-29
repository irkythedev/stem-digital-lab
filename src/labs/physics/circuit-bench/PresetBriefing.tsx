/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学工作台 · 实验导读浮卡（画布内可自由拖拽）
 *
 * 沿革：最早它挂在画布左上角（与元件坞同角同层叠 → 被压住）→ 改成视口右侧抽屉
 * （遮罩把整页盖住、右侧固定 320px，窄屏上正文被挤成一行两三个字）→ 现在是被动浮卡：
 *
 *  - 位置：打开时停在画布右上角（`right-6 top-14`），**四边都可拖**，仅受 12px 视口留边约束，
 *    老师可以把它停在任意角落，永远不挡正在搭的那段电路；
 *  - 无遮罩：它不是模态框，画布始终可用（连图、拖元件都不必先关它）；
 *  - 一次只有一个实例：portal 挂到工作台根节点（`mount`）而不是 `document.body`——
 *    全屏时工作台根节点就是 `:fullscreen` 宿主，挂到 body 的浮层在全屏下会被浏览器藏掉。
 *
 * 视觉上是「探究中枢」而不是 FAQ 面板，四层信息自上而下：
 *  标题栏（拖拽手柄 + 徽标 + 双行标题 + 圆形关闭）
 *  → 探究目标 → 核心物理规律与公式（公式收进一张浅色内嵌底卡）→ 启发追问（动作卡）
 *  → 色彩与符号图例（双轨：一块说画布上的颜色是什么意思，一块说导线与电流方向怎么认）。
 *
 * 拖拽走 PointerEvent 而非 HTML5 原生拖放：希沃红外/电容大屏与 iPad 不触发原生 dragstart，
 * 且工作台全目录禁用原生拖放属性（见 circuit-bench.test.ts 的整仓静态扫描）。
 * 拖动期间 `stopPropagation()`，画布的平移/缩放收不到这一串事件。
 *
 * 主题：站点由 `html.dark`（手动切换）+ `:root:not(.light)` 驱动，Tailwind 的 `dark:` 前缀变体
 * 只认 `prefers-color-scheme`，手动切主题时会与站点脱节（见 smoke.test.ts 的明暗约束），
 * 所以这里一律走 var 令牌；徽标的深色档用 `[html.dark_&]` 任意变体锚到同一套开关上。
 *
 * 内容由 `circuit-bench-prompts.ts` 的预设矩阵驱动（四阶段分组 + 该预设的核心公式），
 * 点一条追问即带着预设上下文与苏格拉底人设交给 AI 助手。
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GripVertical, Palette, Sigma, Sparkles, Target, X, Zap } from 'lucide-react';

import Formula from '../../../components/ui/Formula';
import { TOUCH_GUARD } from './circuit-bench-touch';
import { useNarrow, useTabletSheet } from './use-bench-media';
import type { CircuitPreset } from './circuit-bench-presets';
import {
  hasPromptText,
  inquiryQuestion,
  presetInquiry,
  principleIsRedundant,
  promptText,
  stageHint,
  type InquiryPrompt,
  type InquiryStage,
} from './circuit-bench-prompts';

/** 与 `duration-200` 对齐：关闭时先播动画，播完再真正卸载。 */
const TRANSITION_MS = 200;
/** 卡片宽度：360~400px 之间的定值（窄屏由 max-w 再收一道）。 */
const CARD_W = 380;
/** 拖拽时与视口四边的最小留边。 */
const EDGE_PAD = 12;
/** 初始位置：贴画布右上角（`top-14 right-6`）。 */
const DEFAULT_TOP = 56;
const DEFAULT_RIGHT = 24;
/** 上下留白：`max-h` 从这里扣，保证矮视口/全屏下卡片上下都留出画布呼吸位，不被底边裁掉。 */
const VIEWPORT_INSET = 140;

interface Point {
  x: number;
  y: number;
}

/**
 * 四阶段徽标配色：浅色底 + 同色描边 + 同色文字。
 * 深色档用 `[html.dark_&]`（= `html.dark &`）而不是 `dark:`——站点的手动主题开关挂的是
 * `html.dark` 类，而 `dark:` 只认系统偏好，手动切换时徽标会停在浅色档。
 * 四阶段各一色，学生扫一眼颜色就知道这条追问属于探究的哪一步。
 *
 * 浅色档一律取 700 级：600 级压在同色 10% 底上只有 3.3~4.1（蓝 3.62 / 翠 3.32 /
 * 琥珀 3.61 / 紫 3.94），四档全部不到 4.5:1，而这是 10px 正文级文字。
 * 折到 700 级后实测 4.9~6.4，四档齐过 AA；深色档不动（400 级在 #1e1e1a 上
 * 已经是 6.8~10.6，再深反而掉回门槛下）。与隔壁 CircuitMonitor 的 TONE 同一套写法。
 */
const STAGE_BADGE: Record<InquiryStage, string> = {
  hypothesis: 'border-blue-500/20 bg-blue-500/10 text-blue-700 [html.dark_&]:text-blue-400',
  variables: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 [html.dark_&]:text-emerald-400',
  diagnosis: 'border-amber-500/20 bg-amber-500/10 text-amber-700 [html.dark_&]:text-amber-400',
  model: 'border-purple-500/20 bg-purple-500/10 text-purple-700 [html.dark_&]:text-purple-400',
};

/**
 * 状态色图例的四枚色块。取 Tailwind 固定色阶而不是 var 令牌：这里要展示的是
 * **色相**本身（与 CircuitMonitor 的 TONE 徽章同一套语义），中间档一眼最能分辨。
 * 语义分工与画布严格一致：琥珀=正在工作（发光/加热）、翠绿=通路正常（闭合/导通）、
 * 警示红=真故障（熔断/烧毁/过载）、中性灰=静息（断开/熄灭/未接入）。
 * 颜色本身就是工程信息——图例写不清，学生就会把「黑灯」读成「一切正常」。
 */
const STATUS_LEGEND: { dot: string; zh: string; en: string }[] = [
  { dot: 'bg-amber-500', zh: '发光 / 加热 · 正在工作', en: 'Lit / heating · working' },
  { dot: 'bg-emerald-600', zh: '正常导通 · 通路闭合', en: 'Conducting · circuit closed' },
  { dot: 'bg-red-600', zh: '熔断 / 烧毁 / 过载', en: 'Blown / burnt / overloaded' },
  { dot: 'bg-zinc-400', zh: '断开 / 熄灭 · 静息', en: 'Open / dark · idle' },
];

/** 导线绝缘套色：与 render/wires.ts 的 WIRE_PALETTE 同源（--chart-1..6 循环）。 */
const WIRE_LEGEND_SLOTS = [1, 2, 3, 4, 5, 6];

/** 极细滚动条：Firefox 走 scrollbar-width/color，WebKit 走 ::-webkit-scrollbar 三条。 */
const THIN_SCROLLBAR =
  '[scrollbar-width:thin] [scrollbar-color:var(--border)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[var(--border)] hover:[&::-webkit-scrollbar-thumb]:bg-[var(--muted)]';

/** 四边碰撞限制：卡片必须完整留在视口内（留 EDGE_PAD 边距）。 */
function clampToViewport(x: number, y: number, w: number, h: number): Point {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return {
    x: Math.min(Math.max(EDGE_PAD, x), Math.max(EDGE_PAD, vw - w - EDGE_PAD)),
    y: Math.min(Math.max(EDGE_PAD, y), Math.max(EDGE_PAD, vh - h - EDGE_PAD)),
  };
}

export interface PresetBriefingProps {
  preset: CircuitPreset;
  open: boolean;
  onClose: () => void;
  zh: boolean;
  /** 点击追问胶囊：把整理好的提问交给工作台，由它注入教学人设并打开 AI 助手。 */
  onAsk: (question: string) => void;
  /**
   * 落位时额外下移的像素（全屏档用）。
   *
   * 常态下 `top: 56` 落在页头下方的留白里，画布卡的工具栏还在更下面；
   * 一进全屏，工作台根节点接管整个视口，工具栏被顶到 `y≈59–103`，
   * 而卡片仍从 56 起——右上角正好盖住工具栏末尾的「退出全屏」按钮
   * （审计 V3 ⑩：`elementFromPoint` 命中卡片的「实验导读」标签）。
   * 全屏不是模态框，卡片不该吃掉工作台自己的控件，所以由工作台把这一档高度传进来。
   */
  topInset?: number;
  /** portal 宿主：工作台根节点（全屏宿主）。缺省回退到 body。 */
  mount?: HTMLElement | null;
}

export default function PresetBriefing({
  preset,
  open,
  onClose,
  zh,
  onAsk,
  mount,
  topInset = 0,
}: PresetBriefingProps) {
  // 「挂载」与「淡入」分两拍：open 变 true 时先以透明+缩小挂上，下一帧才切到终态，
  // 否则首帧就是终点状态，transition 不会发生（这一条在抽屉版上实测踩过）。
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const [pos, setPos] = useState<Point | null>(null);
  const [dragging, setDragging] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<{ pointerId: number; dx: number; dy: number; w: number; h: number } | null>(
    null,
  );

  const inquiry = presetInquiry(preset.id);
  /**
   * 窄屏形态：底部抽屉。桌面这张卡是「可停在任意角落的浮卡」，窄屏没有角落可停——
   * 380px 宽压进 375px 视口后，卡片本身就把画布盖住了，拖动更没意义。
   * 所以窄屏换成贴底的整宽抽屉，并且不再吃 `pos`（内联 left/top 会压过
   * `max-sm:inset-x-0`，必须整条 style 都不给）。
   *
   * 竖屏平板（768 级触屏）同理：画布只有 670 宽，380 的浮卡照样盖掉一半
   * （审计 V4 ④ 可点 44.3%）。样式那半在 `index.css` 的同名媒体查询里，
   * 这里只负责「不吃内联坐标、不许拖」这两件 JS 才能决定的事。
   */
  const narrow = useNarrow();
  const tabletSheet = useTabletSheet();
  const sheet = narrow || tabletSheet;
  const title = zh ? preset.title.zh : preset.title.en;
  const prompts = inquiry.prompts.filter(hasPromptText);
  // principle 只是把公式串再念一遍的预设（如串并联：I = I₁ = I₂…）不再重复渲染那一行，
  // 公式块已经逐条给出；其余预设的 principle 附带公式之外的物理结论或操作要领，保留。
  const showPrinciple = !principleIsRedundant(preset.id);

  useEffect(() => {
    if (open) {
      setMounted(true);
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setShown(true));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }
    setShown(false);
    const timer = setTimeout(() => setMounted(false), TRANSITION_MS);
    return () => clearTimeout(timer);
  }, [open]);

  // 每次打开都回到初始位置（`right-6 top-14`）：上一节课停在哪一角不该影响下一节课。
  // 用 layout effect：在浏览器绘制前算好，卡片不会先在屏幕左上角闪一下。
  // `topInset` 也在依赖里：开着卡片直接按全屏（或退出全屏）时视口语义整个变了，
  // 落位要跟着重新算，否则卡片停在旧坐标系里、正好压住刚被顶上去的工具栏。
  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const w = cardRef.current?.offsetWidth ?? CARD_W;
    setPos(clampToViewport(window.innerWidth - w - DEFAULT_RIGHT, DEFAULT_TOP + topInset, w, 0));
  }, [open, topInset]);

  // 视口变化时把已在屏幕外的卡片拉回来（旋转平板、伸缩窗口、软键盘）。
  useEffect(() => {
    if (!open) return;
    const onResize = () => {
      const el = cardRef.current;
      if (!el) return;
      setPos((prev) => clampToViewport(prev?.x ?? EDGE_PAD, prev?.y ?? DEFAULT_TOP, el.offsetWidth, el.offsetHeight));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  /* ── 拖拽：只在标题栏按下才生效 ── */
  const onDragDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // 贴底抽屉：位置由样式（`max-sm:` / `index.css` 的平板档）决定，拖也拖不动。
    if (sheet) return;
    // 标题栏里的按钮（关闭 ✕）不参与拖动，否则按住它就变成拖着卡片走。
    if ((e.target as HTMLElement).closest('button')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const el = cardRef.current;
    if (!el || !pos) return;
    e.preventDefault();
    // 别让这一串指针事件冒到画布：拖动浮卡不应该顺带平移/缩放底下的电路。
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      dx: e.clientX - pos.x,
      dy: e.clientY - pos.y,
      w: el.offsetWidth,
      h: el.offsetHeight,
    };
    setDragging(true);
  };

  const onDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    e.stopPropagation();
    setPos(clampToViewport(e.clientX - d.dx, e.clientY - d.dy, d.w, d.h));
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    e.stopPropagation();
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    dragRef.current = null;
    setDragging(false);
  };

  const ask = useCallback((prompt: InquiryPrompt) => onAsk(inquiryQuestion(prompt, title, zh)), [onAsk, title, zh]);

  if (!mounted) return null;

  const host = mount ?? document.body;

  return createPortal(
    <div
      ref={cardRef}
      role="dialog"
      aria-label={zh ? `实验导读 · ${title}` : `Lab guide · ${title}`}
      data-guide-card=""
      data-guide-sheet={sheet ? '' : undefined}
      className={`fixed z-50 flex w-[380px] max-w-[calc(100vw-1.5rem)] max-h-[calc(100vh-140px)] flex-col rounded-2xl border border-[var(--border)] bg-[var(--card-bg)]/95 shadow-2xl backdrop-blur-md transition-[opacity,transform] duration-200 motion-reduce:transition-none max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:max-h-[55dvh] max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:rounded-t-2xl ${
        shown ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
      }`}
      style={sheet ? undefined : pos ? { left: pos.x, top: pos.y } : { right: DEFAULT_RIGHT, top: DEFAULT_TOP + topInset }}
    >
      {/* 标题栏 = 拖拽把手：左侧六点手柄是给眼睛看的、`cursor-grab` 是给鼠标看的，
          大屏上直接按着任意空白处拖。 */}
      <div
        onPointerDown={onDragDown}
        onPointerMove={onDragMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={`flex shrink-0 items-center gap-2.5 rounded-t-2xl border-b border-[var(--border)]/70 px-3 py-2.5 ${TOUCH_GUARD} max-sm:cursor-default ${
          dragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        title={zh ? '按住这里拖动卡片' : 'Drag here to move the card'}
      >
        <GripVertical
          className={`h-4 w-4 shrink-0 transition-colors max-sm:hidden ${sheet ? 'hidden' : ''} ${dragging ? 'text-[var(--accent)]' : 'text-[var(--muted)]/50'}`}
          aria-hidden
        />
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--accent)]">
          <Zap className="h-4 w-4 shrink-0" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="mono-font text-[10px] uppercase leading-none tracking-wider text-[var(--muted)]">
            {zh ? '实验导读' : 'Experiment guide'}
          </div>
          <h2 className="mt-1 truncate text-sm font-semibold leading-tight text-[var(--fg)]">{title}</h2>
        </div>
        {/* 轻量圆形关闭：`.tap-area` 会把元素本身撑到 40×40，所以圆只能画在内层 span 上
            ——直接给按钮 rounded-full 会得到一个 26×40 的椭圆。热区仍是 40×40。 */}
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label={zh ? '收起导读' : 'Close guide'}
          className="tap-area group/close shrink-0 rounded-full text-[var(--muted)] transition-colors"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full transition-colors group-hover/close:bg-[var(--accent-light)] group-hover/close:text-[var(--fg)] group-focus-visible/close:bg-[var(--accent-light)] group-focus-visible/close:text-[var(--fg)]">
            <X className="h-3.5 w-3.5 shrink-0" />
          </span>
        </button>
      </div>

      {/* 正文：三块支架（目标 / 规律与公式 / 启发追问）。长了就在卡片内部滚，
          标题栏与 ✕ 永远留在原位；滚动条做成极细一条，不跟内容抢视线。 */}
      <div className={`min-h-0 flex-1 overflow-y-auto px-3.5 py-3 ${THIN_SCROLLBAR}`}>
        {/* ① 探究目标 */}
        <section>
          <h3 className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-[var(--fg)]">
            <Target className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
            {zh ? '探究目标' : 'Inquiry goal'}
          </h3>
          <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--fg)]">
            {zh ? preset.objective.zh : preset.objective.en}
          </p>
          {preset.steps.length > 0 && (
            <ol className="mt-1.5 space-y-0.5 text-[10px] leading-snug text-[var(--muted)]">
              {preset.steps.map((s, i) => (
                <li key={i} className="flex gap-1.5">
                  <span className="mono-font text-[var(--accent)]">{i + 1}.</span>
                  <span>{zh ? s.zh : s.en}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* ② 核心物理规律与公式：公式收进一张浅色内嵌底卡，形成「板书」质感 */}
        <section className="mt-3 border-t border-[var(--border)]/70 pt-2.5">
          <h3 className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-[var(--fg)]">
            <Sigma className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
            {zh ? '核心物理规律与公式' : 'Key physics & formulas'}
          </h3>
          {showPrinciple && (
            <p className="mt-1.5 border-l-2 border-[var(--accent)] pl-2 text-[10px] leading-relaxed text-[var(--muted)]">
              {zh ? preset.principle.zh : preset.principle.en}
            </p>
          )}
          {inquiry.formulas.length > 0 && (
            <div className="my-2 rounded-xl border border-[var(--border)]/60 bg-[var(--bg)]/70 p-3">
              {inquiry.formulas.map((tex) => (
                <Formula key={tex} tex={tex} block className="text-[11px]" />
              ))}
            </div>
          )}
        </section>

        {/* ③ 启发追问：点一条即带着预设上下文去问 AI（苏格拉底人设由工作台注入） */}
        <section className="mt-3 border-t border-[var(--border)]/70 pt-2.5">
          <div className="flex items-center gap-2">
            <h3 className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-[var(--fg)]">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
              {zh ? '启发追问 · 探究 AI' : 'Guided probes · inquiry AI'}
            </h3>
            <span className="ml-auto shrink-0 rounded-full bg-gradient-to-r from-[var(--accent)]/15 to-[var(--accent)]/5 px-2 py-0.5 text-[9px] font-medium leading-none tracking-wide text-[var(--accent)]">
              Socratic Coaching
            </span>
          </div>
          <p className="mt-1.5 text-[10px] leading-snug text-[var(--muted)]">
            {zh
              ? '先自己想一想，再点开让 AI 陪你把思路走完——它只给线索，不下结论。'
              : 'Think it through first, then let the AI walk the reasoning with you — clues only, no conclusions.'}
          </p>
          <div className="mt-2 space-y-1.5">
            {prompts.map((prompt) => (
              <button
                key={promptText(prompt, true)}
                type="button"
                onClick={() => ask(prompt)}
                title={stageHint(prompt, zh)}
                className="relative group w-full flex flex-col gap-1.5 p-3 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] hover:bg-[var(--bg)] hover:border-[var(--accent)]/50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer text-left motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <span
                  className={`w-fit shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-semibold leading-none ${STAGE_BADGE[prompt.stage]}`}
                >
                  {zh ? prompt.tag.zh : prompt.tag.en}
                </span>
                <span className="text-xs leading-relaxed text-[var(--fg)]">{promptText(prompt, zh)}</span>
                {/* 动作暗示：鼠标悬停 / 键盘聚焦时才滑入，静止时不留一行噪声 */}
                <span className="text-[11px] font-medium text-[var(--accent)] opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity flex items-center gap-0.5 self-end mt-1">
                  {zh ? '提问 AI →' : 'Ask AI →'}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/*
          ④ 色彩与符号图例：把「颜色 = 信息」这条工程认知固定下来。
          与探究内容并列而不是塞进某个折叠角，是因为它回答的是「画布上我看到的东西
          是什么意思」——学生在接第一条线之前就得先认识端子极性，在读完读数之后
          还得能分辨「灯黑着」到底是断了还是烧了。

          双轨：上面一轨说**画布上已有的颜色**对应什么物理含义（端子极性 + 元件状态），
          下面一轨说**导线与电流**怎么认（绝缘套色 ①..⑥ + 流动虚线＝电流方向）。

          色块一律走 var 令牌或与渲染层同一个字面值，主题一换图例跟着换，
          不会出现「图例上印着朱红、画布上其实是珊瑚红」这种对不上的事。
        */}
        <section className="mt-3 border-t border-[var(--border)]/70 pt-2.5">
          <h3 className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-[var(--fg)]">
            <Palette className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
            {zh ? '色彩与符号图例' : 'Colour & symbol legend'}
          </h3>

          {/* 端子极性：仿真图接线柱的固定配色。红柱固定是 a 端（电流由「+」流入）。 */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] leading-snug">
            <span className="flex items-center gap-1.5">
              <span
                className="h-3 w-3 shrink-0 rounded-full border border-[var(--border)]"
                style={{ background: 'var(--danger)' }}
              />
              <span className="text-[var(--fg)]">
                {zh ? '红端子 = 正极 +' : 'Red post = +'}
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              {/* 黑芯不带边框会在深色底上消失，所以固定描一圈 --muted 金属套，
                  与画布上「靠外圈金属套找黑柱」的读法完全一致。 */}
              <span
                className="h-3 w-3 shrink-0 rounded-full border border-[var(--muted)]"
                style={{ background: '#18181b' }}
              />
              <span className="text-[var(--fg)]">
                {zh ? '黑端子 = 负极 −' : 'Black post = −'}
              </span>
            </span>
          </div>

          {/* 元件状态：四色四义，顺序即严重程度的阶梯。 */}
          <ul className="mt-2 space-y-1 text-[10px] leading-snug text-[var(--muted)]">
            {STATUS_LEGEND.map((s) => (
              <li key={s.dot} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${s.dot}`} />
                <span>{zh ? s.zh : s.en}</span>
              </li>
            ))}
          </ul>

          {/* 导线与电流方向 */}
          <div className="mt-2">
            <div className="text-[9px] leading-none text-[var(--muted)]">
              {zh ? '导线绝缘套色 · ⑥ 之后循环' : 'Wire sheath colours · repeat past ⑥'}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
              {WIRE_LEGEND_SLOTS.map((n) => (
                <span key={n} className="flex items-center gap-1">
                  <span
                    className="h-2.5 w-5 shrink-0 rounded-sm border border-[var(--border)]/60"
                    style={{ background: `var(--chart-${n})` }}
                  />
                  <span className="mono-font text-[9px] leading-none text-[var(--fg)]">{n}</span>
                </span>
              ))}
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 text-[10px] leading-snug">
              <svg width={24} height={8} viewBox="0 0 24 8" aria-hidden className="shrink-0">
                <line
                  x1={1}
                  y1={4}
                  x2={23}
                  y2={4}
                  stroke="var(--cb-flow)"
                  strokeWidth={1.8}
                  strokeDasharray="4 3"
                  strokeLinecap="round"
                />
              </svg>
              <span className="text-[var(--fg)]">
                {zh ? '流动虚线 = 电流方向' : 'Moving dashes = current direction'}
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>,
    host,
  );
}

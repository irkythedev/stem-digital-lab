/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学工作台 · 画布卡工具栏
 *
 * 工作台融入全站页面流后不再有独立的页面级顶栏：运行、撤销重做、清空、适配、
 * 读数与视图切换都收进画布卡自己的标题栏（40–44px，border-b 分隔）。
 * 按钮尺寸对齐全站 Design Tokens：h-7 px-2.5 text-xs rounded-md，图标 w-3.5。
 * 纯图标按钮（撤销/重做）用 w-7 p-0 收成正方形，图标 16px 且 shrink-0——
 * 内边距与图标尺寸都不能再靠「多写一个类去覆盖基类」来调。
 */
import {
  Cable,
  Eraser,
  Expand,
  Eye,
  EyeOff,
  MousePointer2,
  Pause,
  Play,
  Redo2,
  Shrink,
  Undo2,
  Wrench,
} from 'lucide-react';

import ActualSizeIcon from '../../../components/ui/ActualSizeIcon';
import { VIEW_MODES, viewModeLabel, type CircuitViewMode } from './circuit-bench-view';
import type { CanvasTool } from './CircuitCanvas';

export interface BenchToolbarProps {
  tool: CanvasTool;
  onTool: (next: CanvasTool) => void;
  viewMode: CircuitViewMode;
  onViewMode: (next: CircuitViewMode) => void;
  running: boolean;
  onToggleRun: () => void;
  onUndo: () => void;
  onRedo: () => void;
  undoable: boolean;
  redoable: boolean;
  onClear: () => void;
  onFit: () => void;
  onFullscreen: () => void;
  fullscreen: boolean;
  showValues: boolean;
  onToggleValues: () => void;
  /** 元件/导线统计，宽屏显示，窄屏让位给按钮 */
  counts?: string;
  /**
   * 已熔毁（灯泡烧毁 / 保险丝熔断）的元件数。
   *
   * >0 时工具条上出现告警色的「一键修复」——学生不必先找到那只坏元件，
   * 顶栏就告诉他「有东西坏了、点这里换新」，与状态看板顶部那颗按钮同一个动作。
   */
  faults?: number;
  /** 一键修复：把所有熔毁元件的物理态复位为完好（含阻值复原），并触发新一轮求解。 */
  onRepair?: () => void;
  zh: boolean;
}

// compact 解除 main button 的 40px 触屏地板：这是 L2 工具条，28px 才是全站密度。
// 基类刻意不含左右内边距：图标按钮要把它收成正方形，若基类自带 px-2.5，
// 两个内边距类会同时落盘、由生成顺序而非书写顺序决定胜负（见 ICON_BTN）。
const BTN_BASE =
  'compact tap32 inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-md border border-[var(--border)] text-xs text-[var(--fg)] transition-colors hover:border-[var(--accent)] disabled:opacity-40 disabled:hover:border-[var(--border)]';

/** 图标 + 文字按钮：h-7 / px-2.5 / text-xs，与全站小工具栏同尺寸。 */
const BTN = `${BTN_BASE} px-2.5`;

/**
 * 纯图标按钮：w-7 h-7 p-0 收成正方形，图标自己带 shrink-0 不被压扁。
 *
 * 改前实测（1440×900，headless）：`${BTN} w-7 px-0` 里 px-0 与基类的 px-2.5
 * 同时生效时是 px-2.5 赢——Tailwind 按生成顺序落盘，px-0 排在 px-2.5 前面，
 * 与类名书写顺序无关。结果 28px 宽的按钮只剩 8px 内容宽，14×14 的图标被
 * flex 压成 6×14 的麻点（撤销/重做/全屏三个按钮同病）。
 * 只在这一个类串里写内边距，才不会两边打架。
 */
const ICON_BTN = `${BTN_BASE} tap-area w-7 p-0`;

// 基类已带 text-[var(--fg)]，激活态必须用 ! 覆盖，否则亮色主题下文字与底色同为深色。
const ON = 'border-[var(--fg)] bg-[var(--fg)] text-[var(--bg)]!';

// 所有工具栏图标一律 shrink-0：这是一排 28px 的小控件，宁可让文字换行也不许压扁图标。
const ICON = 'h-3.5 w-3.5 shrink-0';
/** 纯图标按钮的图标略大一号（16px），撤销/重做在小尺寸下也要一眼可辨。 */
const ICON_MD = 'h-4 w-4 shrink-0';

/**
 * 告警按钮（一键修复）：自己写全配色，不复用 BTN_BASE。
 *
 * BTN_BASE 带着 `border-[var(--border)]` 与 `text-[var(--fg)]`，再叠一层同型任意值类
 * （border-[var(--danger)]）谁生效只由 CSS 生成顺序决定，与类名书写顺序无关——
 * 这正是 ICON_BTN 注释里记着的那口老坑。危险态要的是确定的红色，所以单独一条类串。
 */
const DANGER_BTN =
  'compact tap32 inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-md border border-[var(--danger)] px-2.5 text-xs font-medium text-[var(--danger)] transition-colors hover:bg-[var(--danger)] hover:text-[var(--bg)]';

export default function BenchToolbar({
  tool,
  onTool,
  viewMode,
  onViewMode,
  running,
  onToggleRun,
  onUndo,
  onRedo,
  undoable,
  redoable,
  onClear,
  onFit,
  onFullscreen,
  fullscreen,
  showValues,
  onToggleValues,
  counts,
  faults = 0,
  onRepair,
  zh,
}: BenchToolbarProps) {
  return (
    // 窄屏保持单行横向滚动（隐藏滚动条），高度锁在 44px：flex-wrap 在 375 下会把
    // 「全屏」挤到第三行，工具栏吃掉 121px，画布可见高度只剩 208px。
    // 桌面仍是 44px 单行横向工具条，一字不改。
    <div data-bench-toolbar="" data-drop-blocked="" className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-[var(--border)] px-2.5 py-1.5 max-sm:relative max-sm:z-[60] max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:[scrollbar-width:none] max-sm:[&::-webkit-scrollbar]:hidden sm:h-11 sm:flex-nowrap sm:overflow-x-auto sm:py-0">
      {/* 操作模式 */}
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => onTool('select')}
          aria-pressed={tool === 'select'}
          title={zh ? '选择 / 拖动元件' : 'Select / drag parts'}
          className={`${BTN} ${tool === 'select' ? ON : ''}`}
        >
          <MousePointer2 className={ICON} />
          <span>{zh ? '选择' : 'Select'}</span>
        </button>
        <button
          type="button"
          onClick={() => onTool('wire')}
          aria-pressed={tool === 'wire'}
          title={zh ? '接线：依次点两个接线柱' : 'Wire: tap two terminals'}
          className={`${BTN} ${tool === 'wire' ? ON : ''}`}
        >
          <Cable className={ICON} />
          <span>{zh ? '接线' : 'Wire'}</span>
        </button>
      </div>

      <span aria-hidden className="mx-0.5 h-4 w-px shrink-0 bg-[var(--border)]" />

      {/* 视图：电路图 / 仿真图。文案只从 viewModeLabel 取一处，杜绝两处硬编码跑偏。 */}
      <div className="flex shrink-0 items-center gap-1" role="group" aria-label={zh ? '视图模式' : 'View mode'}>
        {VIEW_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onViewMode(mode)}
            aria-pressed={viewMode === mode}
            aria-label={zh ? `切换到${viewModeLabel(mode, true)}` : `Switch to ${viewModeLabel(mode, false)}`}
            className={`${BTN} ${viewMode === mode ? ON : ''}`}
          >
            {viewModeLabel(mode, zh)}
          </button>
        ))}
      </div>

      <span aria-hidden className="mx-0.5 h-4 w-px shrink-0 bg-[var(--border)]" />

      {/* 仿真与编辑 */}
      <button
        type="button"
        onClick={onToggleRun}
        aria-pressed={running}
        title={running ? (zh ? '暂停仿真' : 'Pause') : zh ? '继续仿真' : 'Resume'}
        className={`${BTN} ${running ? '' : ON}`}
      >
        {running ? <Pause className={ICON} /> : <Play className={ICON} />}
        <span>{running ? (zh ? '暂停' : 'Pause') : zh ? '运行' : 'Run'}</span>
      </button>

      {/* 熔毁告警：只在真有坏元件时出现，位置紧挨运行/暂停——学生开始找「为什么没读数」时
          第一眼扫的就是这里。宽屏写明完整动作，窄屏收成「一键修复」。
          扳手而非闪电：同一个动作在右键菜单里叫「更换修复」，全站只画一个符号。 */}
      {faults > 0 && (
        <button
          type="button"
          onClick={onRepair}
          title={
            zh
              ? `一键修复损坏元件（${faults} 只烧毁/熔断）：换新并恢复额定阻值`
              : `Repair damaged parts (${faults}): replace and restore rated resistance`
          }
          className={DANGER_BTN}
        >
          <Wrench className={ICON} />
          <span className="hidden lg:inline">{zh ? '一键修复损坏元件' : 'Repair parts'}</span>
          <span className="lg:hidden">{zh ? '一键修复' : 'Repair'}</span>
          <span className="mono-font tabular-nums">{faults}</span>
        </button>
      )}

      <button
        type="button"
        onClick={onUndo}
        disabled={!undoable}
        title={zh ? '撤销（⌘Z）' : 'Undo (⌘Z)'}
        aria-label={zh ? '撤销' : 'Undo'}
        className={ICON_BTN}
      >
        <Undo2 className={ICON_MD} />
      </button>
      <button
        type="button"
        onClick={onRedo}
        disabled={!redoable}
        title={zh ? '重做（⇧⌘Z）' : 'Redo (⇧⌘Z)'}
        aria-label={zh ? '重做' : 'Redo'}
        className={ICON_BTN}
      >
        <Redo2 className={ICON_MD} />
      </button>

      <button type="button" onClick={onClear} title={zh ? '清空工作台' : 'Clear bench'} className={BTN}>
        <Eraser className={ICON} />
        <span className="hidden sm:inline bench-opt-label">{zh ? '清空' : 'Clear'}</span>
      </button>

      {/* 适配画布：方框 + 对齐线的「实际尺寸」字形，不用 Maximize2——四角外扩的箭头
          与隔壁全屏按钮的 Expand 画的是同一件事，学生分不出这两个动作。
          右键菜单的「适配画布」用的是同一枚（MenuItemIcon），两处必须长一样。 */}
      <button type="button" onClick={onFit} title={zh ? '适配画布' : 'Fit to canvas'} className={BTN}>
        <ActualSizeIcon className={ICON} />
        <span className="hidden sm:inline bench-opt-label">{zh ? '适配' : 'Fit'}</span>
      </button>

      <span aria-hidden className="mx-0.5 h-4 w-px shrink-0 bg-[var(--border)]" />

      <button
        type="button"
        onClick={onToggleValues}
        aria-pressed={showValues}
        title={zh ? '显示 / 隐藏读数' : 'Show / hide readouts'}
        className={`${BTN} ${showValues ? '' : 'text-[var(--muted)]'}`}
      >
        {showValues ? <Eye className={ICON} /> : <EyeOff className={ICON} />}
        <span className="hidden lg:inline">{zh ? '读数' : 'Readouts'}</span>
      </button>

      {/* 全屏也是「图标 + 文字」：纯图标按钮在一排文字按钮里认不出来，
          出去的时候更需要写明「退出全屏」，否则学生只会去找浏览器的 Esc。 */}
      <button
        type="button"
        onClick={onFullscreen}
        aria-pressed={fullscreen}
        title={zh ? (fullscreen ? '退出全屏（Esc）' : '全屏沉浸式实验') : fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
        className={`${BTN} ${fullscreen ? ON : ''}`}
      >
        {fullscreen ? <Shrink className={ICON} /> : <Expand className={ICON} />}
        <span>{fullscreen ? (zh ? '退出全屏' : 'Exit') : zh ? '全屏' : 'Full'}</span>
      </button>

      {counts && (
        <span className="ml-auto hidden shrink-0 whitespace-nowrap pl-2 mono-font text-[10px] text-[var(--muted)] xl:inline">
          {counts}
        </span>
      )}
    </div>
  );
}

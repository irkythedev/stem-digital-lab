/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * token 用量「按模型分色堆叠柱」总览 —— 纯手写原生 SVG，零第三方图表依赖。
 *
 * 设计要点（见《Token 用量明细改造设计报告》）：
 * - 横轴用 viewBox 单位（0–100）表达百分比，纵轴固定 → 容器宽度变化零 JS 自适应；
 *   `preserveAspectRatio="none"` 让方块铺满，配 `vector-effect="non-scaling-stroke"`
 *   把发丝描边锁在 1px（否则会被非等比缩放拉粗）。
 * - **整列命中区**：单个透明 <rect> 覆盖整块绘图区，按 clientX 算列序号取最近柱
 *   （360px 下 14 根柱节距仅 ~21px，按「每柱 40px」根本做不到，只能整列命中）。
 * - **断档日**画空心发丝短柱：与「真实的小用量」在语义上区分开（无记录 ≠ 用量为 0）。
 * - 分段色：多模型用 --chart-1..5；**只有单一模型时沿用 --accent**（与旧的单色
 *   迷你条语言连续，老用户看到的仍是黑条/白条）。
 */
import type { UsageBar } from '../../lib/token-usage';

/** 绘图区高度（px）。宽度由容器决定，故用百分比横轴 + 固定高度。 */
export const CHART_PLOT_H = 120;

/** 柱间距占节距的比例（节距 = 100 / 柱数） */
const GAP_RATIO = 0.22;
/** 柱的最小宽度（viewBox 横轴单位）：防止柱数多时细到消失 */
const MIN_BAR_UNITS = 0.6;
/** 分段的最小高度（viewBox 纵轴单位）：防止极小占比段看不见（按真实值堆叠，仅视觉抬到下限） */
const MIN_SEG_UNITS = 0.5;

/**
 * 分段取色：多模型走 --chart-N（1..5），单一模型沿用 --accent。
 * @param modelIndex 模型在分色名单中的序号
 * @param drawn 实际参与绘制的分段种类数（含「其他」）
 */
export function segmentColor(modelIndex: number, drawn: number): string {
  if (drawn <= 1) return 'var(--accent)';
  return `var(--chart-${Math.min(modelIndex + 1, 5)})`;
}

/** 「其他模型」合并段的颜色（中性灰，不占用分类色） */
export const OTHER_COLOR = 'var(--border-strong)';

interface TokenUsageChartProps {
  bars: UsageBar[];
  /** 分色名单顺序（与 segmentColor 的序号一致） */
  models: string[];
  /** 是否存在「其他模型」合并段 */
  hasOther: boolean;
  /** 当前高亮的日期（由读数条状态驱动） */
  activeDay: string | null;
  onHover: (day: string | null) => void;
  onSelect: (day: string) => void;
  ariaLabel: string;
}

export default function TokenUsageChart({
  bars,
  models,
  hasOther,
  activeDay,
  onHover,
  onSelect,
  ariaLabel,
}: TokenUsageChartProps) {
  const n = Math.max(1, bars.length);
  const pitch = 100 / n;
  const barW = Math.max(MIN_BAR_UNITS, pitch * (1 - GAP_RATIO));
  const drawn = models.length + (hasOther ? 1 : 0);
  const activeIndex = activeDay ? bars.findIndex((b) => b.day === activeDay) : -1;

  /** 整列命中：按 clientX 落在第几列 */
  const pickIndex = (clientX: number, rect: DOMRect) => {
    const ratio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
    return Math.min(n - 1, Math.max(0, Math.floor(ratio * n)));
  };

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      width="100%"
      height={CHART_PLOT_H}
      role="img"
      aria-label={ariaLabel}
      className="block select-none"
    >
      {/* 选中列高亮带（画在柱体之下） */}
      {activeIndex >= 0 && (
        <rect
          x={activeIndex * pitch}
          y={0}
          width={pitch}
          height={100}
          fill="var(--accent-light)"
          opacity={0.6}
          aria-hidden="true"
        />
      )}

      {/* 基线 */}
      <line
        x1={0}
        y1={100}
        x2={100}
        y2={100}
        stroke="var(--border)"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
        aria-hidden="true"
      />

      <g aria-hidden="true" style={{ pointerEvents: 'none' }}>
        {bars.map((bar, i) => {
          const x = i * pitch + (pitch - barW) / 2;
          if (!bar.hasRecord) {
            // 断档日：不再画空心方框（整排方框造成「密集栅栏」视觉噪音），
            // 改为极淡的 1.5px 圆头短横条 —— 只表示「这一天没有记录」，不表达用量。
            return (
              <line
                key={bar.day}
                x1={x}
                y1={99.2}
                x2={x + barW}
                y2={99.2}
                stroke="var(--border)"
                strokeWidth={1.5}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                opacity={0.25}
                data-usage-day={bar.day}
                data-usage-empty="1"
              />
            );
          }
          let acc = 0;
          return (
            <g key={bar.day}>
              {bar.segments.map((seg) => {
                const h = Math.max(MIN_SEG_UNITS, seg.hPct);
                const y = 100 - acc - h;
                acc += seg.hPct;
                const fill = seg.isOther ? OTHER_COLOR : segmentColor(models.indexOf(seg.model), drawn);
                return (
                  <rect
                    key={seg.model}
                    x={x}
                    y={Math.max(0, y)}
                    width={barW}
                    height={h}
                    fill={fill}
                    data-usage-day={bar.day}
                    data-usage-model={seg.isOther ? '__other__' : seg.model}
                  />
                );
              })}
            </g>
          );
        })}
      </g>

      {/* 整列透明命中区（唯一交互元素，DOM 恒定） */}
      <rect
        x={0}
        y={0}
        width={100}
        height={100}
        fill="transparent"
        className="cursor-pointer"
        onMouseMove={(e) => {
          const i = pickIndex(e.clientX, e.currentTarget.getBoundingClientRect());
          onHover(bars[i]?.day ?? null);
        }}
        onMouseLeave={() => onHover(null)}
        onClick={(e) => {
          const i = pickIndex(e.clientX, e.currentTarget.getBoundingClientRect());
          const bar = bars[i];
          if (bar) onSelect(bar.day);
        }}
        data-usage-hit="1"
      />
    </svg>
  );
}

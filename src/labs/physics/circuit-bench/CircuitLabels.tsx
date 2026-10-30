/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学实验台 · 标签覆盖层
 *
 * HTML 覆盖层让字号固定在 CSS 像素，不随 viewBox/缩放变成 3px 小字；
 * 同时天然位于 SVG 之上，读数不会被后画的元件盖住。
 */
import { useMemo, useRef, type CSSProperties } from 'react';

import type { BenchState, ElementReading } from './circuit-bench-core';
import { layoutCircuitLabels, type ScreenRect } from './circuit-bench-labels';
import type { WireRoute } from './circuit-bench-render';
import { WORLD_H, WORLD_W, type ViewTransform } from './circuit-bench-geometry';

export interface CircuitLabelsProps {
  state: BenchState;
  readings?: Record<string, ElementReading> | null;
  view: ViewTransform;
  size: { w: number; h: number };
  showValues: boolean;
  showNames: boolean;
  selectedId: string | null;
  /** 画布同一帧里已经算好的导线路径：标签避让要拿它判「压线」，直接复用（P1-8）。 */
  routes?: WireRoute[] | null;
  /** 界面语言：预设里带中文名的元件（电源/试样…）在英文界面取 `labelEn`。 */
  lang?: 'zh' | 'en';
  /**
   * 布局失效标记：电路图/仿真图切换、预设切换时变化。
   *
   * 变化时清空上一帧位置缓存——两种视图的元件本体尺寸和端子跨度都不一样，
   * 沿用旧位置会把标签的迟滞倾向拖到远环，出现一条拉得很长的引线。
   */
  resetKey?: string;
  /**
   * 熔毁徽章被点击：直接换一只新的这只元件（就地复位的入口）。
   *
   * 不传时徽章退化成普通只读胶囊——单测与只读展示场景不需要回写状态。
   */
  onRepairElement?: (id: string) => void;
}

export default function CircuitLabels({
  state,
  readings,
  view,
  size,
  showValues,
  showNames,
  selectedId,
  routes,
  lang = 'zh',
  resetKey = '',
  onRepairElement,
}: CircuitLabelsProps) {
  const previous = useRef<Record<string, ScreenRect>>({});
  const lastResetKey = useRef(resetKey);
  const labels = useMemo(() => {
    if (size.w <= 0) return [];
    if (lastResetKey.current !== resetKey) {
      lastResetKey.current = resetKey;
      previous.current = {};
    }
    const next = layoutCircuitLabels({
      state,
      readings,
      view,
      size: { w: size.w, h: size.h || (size.w * WORLD_H) / WORLD_W },
      showValues,
      showNames,
      selectedId,
      routes,
      lang,
      previous: previous.current,
    });
    previous.current = Object.fromEntries(
      next.map((l) => [l.id, { x: l.x, y: l.y, w: l.w, h: l.h }]),
    );
    return next;
  }, [state, readings, view, size, showValues, showNames, selectedId, routes, lang, resetKey]);

  if (size.w <= 0) return null;

  const height = size.h || (size.w * WORLD_H) / WORLD_W;
  // 熔毁徽章是可点的，必须活在无障碍树里；装饰性的标签层仍整体 aria-hidden，
  // 否则读屏会把「元件旁的文字」和 SVG 里的本体读成两遍。
  const faults = onRepairElement ? labels.filter((l) => l.fault) : [];
  const plain = labels.filter((l) => !l.fault);

  /** 标签底样式：读数胶囊实底、名称标签半透明；告警徽章在下面单独覆盖配色。 */
  const boxStyle = (l: (typeof labels)[number]): CSSProperties => {
    const value = l.variant === 'value';
    // 告警配色按严重程度取一档：超量程（危险，红）> 表笔接反（警示，琥珀）。
    // 两者同时成立时学生最该先处理的是「表已经打到底了」，所以红色优先。
    const accent = l.over ? 'var(--danger)' : l.reversed ? 'var(--warn)' : null;
    return {
      position: 'absolute',
      left: l.x,
      top: l.y,
      width: l.w,
      height: l.h,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxSizing: 'border-box',
      borderRadius: 999,
      padding: value ? '0 7px' : '0 5px',
      background: 'color-mix(in srgb, var(--card-bg) 94%, transparent)',
      border: `1px solid ${accent ?? (l.selected ? 'var(--fg)' : 'var(--border)')}`,
      boxShadow: value ? '0 1px 2px rgba(0,0,0,.14)' : 'none',
      color: accent ?? (l.selected ? 'var(--fg)' : value ? 'var(--fg)' : 'var(--muted)'),
      fontSize: value ? 11 : 10.5,
      lineHeight: 1,
      fontFamily: value ? 'var(--f-mono)' : 'inherit',
      fontWeight: value ? 550 : 500,
      fontVariantNumeric: 'tabular-nums',
      whiteSpace: 'nowrap',
      opacity: value ? 1 : 0.92,
    };
  };

  return (
    <>
      <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden>
        <svg width={size.w} height={height} className="absolute inset-0">
          {plain.map((l) =>
            l.leader ? (
              <line
                key={`${l.id}:leader`}
                x1={l.leader.x1}
                y1={l.leader.y1}
                x2={l.leader.x2}
                y2={l.leader.y2}
                stroke="var(--muted)"
                strokeWidth={0.9}
                opacity={0.55}
              />
            ) : null,
          )}
        </svg>
        {plain.map((l) => (
          <div key={l.id} style={boxStyle(l)}>
            {l.text}
          </div>
        ))}
      </div>
      {faults.length > 0 && (
        <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
          {faults.map((l) => (
            <button
              key={l.id}
              type="button"
              title={lang === 'zh' ? '点击更换新元件' : 'Click to replace this component'}
              onClick={(e) => {
                e.stopPropagation();
                onRepairElement?.(l.componentId);
              }}
              // 画布容器监听指针事件做拖动/框选，不拦下来的话点徽章会顺带拖动元件。
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                ...boxStyle(l),
                pointerEvents: 'auto',
                cursor: 'pointer',
                background: 'color-mix(in srgb, var(--danger) 16%, var(--card-bg))',
                border: '1px solid var(--danger)',
                color: 'var(--danger)',
                fontWeight: 600,
                padding: '0 7px',
              }}
            >
              {l.text}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

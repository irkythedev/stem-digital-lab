/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学实验台 · SVG 元件符号
 *
 * 本文件只负责「摆放与交互」：外层定位、旋转、选中环、接线柱命中区。
 * 本体长什么样交给 render/ 策略（schematic / physical），两者共用同一套端子坐标，
 * 所以切换视图不会让接线柱漂移，也不会改变网表。
 *
 * 有极性元件（电池、A/V/G 表）的 a 端固定是「+ / 红柱」；端子由 terminalOffsets
 * 随 rotation 旋转，颜色因此跟着元件一起转，不存在 90°/180°/270° 极性颠倒。
 */
import type { PointerEvent as ReactPointerEvent } from 'react';

import {
  TERMINAL_HALF_SPAN,
  terminalPolarity,
  type CircuitComponent,
  type ElementKind,
  type ElementReading,
} from './circuit-bench-core';
import { bodyHitPadFor, componentBodySize, componentInkBox, terminalHitRadiusFor, terminalNormal, terminalPoint } from './circuit-bench-geometry';
import type { CircuitViewMode } from './circuit-bench-view';
import { strategyFor } from './render';

export interface CircuitSymbolProps {
  el: CircuitComponent;
  reading?: ElementReading;
  selected?: boolean;
  hovered?: boolean;
  /**
   * 「数据记录正在看这一只」的外部高亮：比指针悬停更强的一圈微光。
   *
   * 与 `hovered` 分开是因为两者的语义完全不同——`hovered` 是「指针正好压在它身上」，
   * 而这里是「下拉菜单里高亮的那一项就是它」，指针在面板上、离画布很远。
   * 多表同屏时这是唯一能把 `电压表 V₁` 与画布上那一只对起来的线索。
   */
  glow?: boolean;
  pendingTerminal?: 'a' | 'b' | null;
  terminalHitRadius?: number;
  /** 电路图 / 仿真图；只换本体画法，端子坐标与导线端点不变。 */
  viewMode?: CircuitViewMode;
  /** 端子命中区是否吃指针：从任意模式按住接线柱往外拖都能拉出导线。 */
  terminalsInteractive?: boolean;
  /** 每个端子的接线根数（`id:a` → n）：≥2 根时画叠插插头。 */
  wireCounts?: Record<string, number>;
  /** 每个端子接入导线的绝缘皮颜色，按接线顺序排列：叠插插头就用这两根线的颜色。 */
  wireColors?: Record<string, string[]>;
  onPointerDown?: (event: ReactPointerEvent<SVGGElement>, id: string) => void;
  onTerminalDown?: (event: ReactPointerEvent<SVGCircleElement>, ref: string) => void;
  /**
   * 当前「1 世界单位 = 多少 CSS 像素」。窄屏/粗指针下用来把元件本体命中矩形
   * 外扩到手指点得中的尺寸（见 `bodyHitPadFor`）。桌面不传即不外扩。
   */
  pxPerWorld?: number;
  /** 是否允许外扩本体命中矩形（窄屏或触屏）。 */
  expandBodyHit?: boolean;
}

function bodyStroke(selected: boolean): string {
  return selected ? 'var(--accent)' : 'var(--fg)';
}

export function CircuitSymbol({
  el,
  reading,
  selected = false,
  hovered = false,
  glow = false,
  pendingTerminal = null,
  terminalHitRadius = 9,
  viewMode = 'schematic',
  terminalsInteractive = true,
  wireCounts,
  wireColors,
  onPointerDown,
  onTerminalDown,
  pxPerWorld = 0,
  expandBodyHit = false,
}: CircuitSymbolProps) {
  const half = TERMINAL_HALF_SPAN[el.kind] ?? 22;
  const stroke = bodyStroke(selected || hovered);
  // 命中底用对称的 componentBodySize（热区本来就该对称），
  // 选中环用**墨迹**包络 componentInkBox：灯泡的环得把玻璃泡与光晕一起罩进去，
  // 电热丝的环不该往上虚撑到 33 单位的接线柱高度。
  const bodySize = componentBodySize(el.kind);
  const bodyBox = componentInkBox(el.kind);
  // 窄屏/触屏：本体命中矩形按当前缩放外扩（桌面 expandBodyHit=false，数值分毫不动）。
  const hitPad = expandBodyHit ? bodyHitPadFor(el.kind, bodySize.w, bodySize.h, pxPerWorld) : 0;
  const burnt = el.kind === 'bulb' && el.state.burnt;
  const strategy = strategyFor(viewMode);
  const Body = strategy.Body;
  const terminalStyle = strategy.terminal;

  return (
    <g data-component-id={el.id} data-kind={el.kind} data-view-mode={viewMode} data-probe-glow={glow ? '' : undefined}>
      <g
        transform={`translate(${el.x} ${el.y}) rotate(${el.rotation})`}
        style={{ cursor: 'grab' }}
        onPointerDown={(e) => onPointerDown?.(e, el.id)}
      >
        {glow && (
          /* 「数据记录正在看这一只」的微光：两圈同心柔光（外宽内窄、外淡内浓）
             而不是一层高斯模糊——模糊滤镜在希沃大屏的旧内核上会掉帧，
             而叠两圈描边的观感几乎一样，还省一次滤镜合成。 */
          <g data-probe-glow-ring="" pointerEvents="none">
            <rect
              x={bodyBox.x0 - 10}
              y={bodyBox.y0 - 10}
              width={bodyBox.x1 - bodyBox.x0 + 20}
              height={bodyBox.y1 - bodyBox.y0 + 20}
              rx={13}
              fill="none"
              stroke="var(--accent)"
              strokeOpacity={0.14}
              strokeWidth={7}
            />
            <rect
              x={bodyBox.x0 - 7}
              y={bodyBox.y0 - 7}
              width={bodyBox.x1 - bodyBox.x0 + 14}
              height={bodyBox.y1 - bodyBox.y0 + 14}
              rx={10}
              fill="var(--accent-light)"
              fillOpacity={0.3}
              stroke="var(--accent)"
              strokeOpacity={0.42}
              strokeWidth={2.2}
            />
          </g>
        )}
        {(selected || hovered) && (
          /* 选中态用「柔和浅色圆角外环」而不是紧贴本体的深色描边方框：
             环与本体之间留 6 个世界单位的呼吸间距，浅色填充只做低透明度晕染，
             这样压在旁边的「电源 / 5.92 V」胶囊标签不会被一条黑色粗边切掉。 */
          <rect
            x={bodyBox.x0 - 6}
            y={bodyBox.y0 - 6}
            width={bodyBox.x1 - bodyBox.x0 + 12}
            height={bodyBox.y1 - bodyBox.y0 + 12}
            rx={8}
            fill="var(--accent-light)"
            fillOpacity={selected ? 0.55 : 0}
            stroke="var(--accent)"
            strokeOpacity={selected ? 0.28 : 0.16}
            strokeWidth={selected ? 1.2 : 1}
            pointerEvents="none"
          />
        )}
        <Body el={el} half={half} stroke={stroke} reading={reading} />
        {/* 本体命中底：符号本体里到处是镂空（开关的闸刀口、电阻的锯齿缝、
            灯泡玻璃泡之外的空档），手指点进缝里会直接穿到画布上变成「取消选中」，
            于是「同一元件上两次 <24px 的连点」在大屏上根本连不起来。
            垫一张与本体等大的透明矩形（透明填充照样吃指针，和接线柱热区同一招），
            让「点元件本体」处处都命中。接线柱画在它后面、且自己 stopPropagation，
            所以柱子热区不会被这层抢走。 */}
        <rect
          data-body-hit={el.kind}
          x={-bodySize.w / 2 - hitPad}
          y={-bodySize.h / 2 - hitPad}
          width={bodySize.w + hitPad * 2}
          height={bodySize.h + hitPad * 2}
          fill="transparent"
        />
        {/* 导线元件的屏幕空间命中带。
            本体只有 52×10 世界单位、线身 2 单位粗，fit 缩放下可视线宽约 1.3px，
            世界单位的命中底跟着缩成 33×6.5px（实测纵向容差 ±3.2px，再挪 1px 就点空）；
            触屏侧 `BODY_HIT_PAD_CAP.wire` 是 0，外扩也救不回来。这里叠一条
            `non-scaling-stroke` 的透明描边，和路线导线的 14px 命中带同一口径：
            无论画布缩到多小，横向一整条都有 14px 的手指余量。 */}
        {el.kind === 'wire' && (
          <line
            x1={-bodySize.w / 2}
            y1={0}
            x2={bodySize.w / 2}
            y2={0}
            stroke="transparent"
            strokeWidth={14}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {/* 烧毁标记：电路图的灯泡符号中心就是玻璃泡，画在原点即可；
            仿真图的玻璃泡竖直长在灯座上方（泡心 y≈−23），由本体自己画在泡上，
            所以这里不能重复打叉。 */}
        {burnt && viewMode !== 'physical' && (
          <g stroke="var(--danger)" strokeWidth={1.6} strokeLinecap="round">
            <line x1={-9} y1={-9} x2={9} y2={9} />
            <line x1={9} y1={-9} x2={-9} y2={9} />
          </g>
        )}
      </g>

      {(['a', 'b'] as const).map((t) => {
        const p = terminalPoint(el, t);
        const armed = pendingTerminal === t;
        const polarity = terminalPolarity(el.kind, t);
        const postFill =
          polarity === '+'
            ? terminalStyle.positive
            : polarity === '-'
              ? terminalStyle.negative
              : 'var(--card-bg)';
        // 多线同柱：实物模式下画并插的香蕉插头，插头颜色就是各自导线的绝缘皮色，
        // 别让两根线在柱边生硬熔接，也别让它们变成一坨看不出走向的灰块。
        // 护套数量跟着「这一柱接了几根线」走：早先写死两枚，同柱接三根时
        // 第三根线的皮色根本不画，看上去像没插上。上限 4 只是画布上的保险。
        const load = wireCounts?.[`${el.id}:${t}`] ?? 0;
        const plugFill =
          polarity === '+' ? terminalStyle.positive : polarity === '-' ? terminalStyle.negative : 'var(--muted)';
        const socketColors = wireColors?.[`${el.id}:${t}`] ?? [];
        const sleeveCount = Math.min(Math.max(socketColors.length, load), 4);
        // 叠插插头是**实物教具**的特征（香蕉插头串在同一根柱子上），
        // 电路图里没有这东西：在国标简图上给每个端子挂一串彩色插头，
        // 既不是任何标准里的画法，也会把「同一柱接了几根线」误读成
        // 「这个端子有几个引脚」。所以只在仿真图里画。
        const normal = strategy.mode === 'physical' && load >= 2 ? terminalNormal(el, t) : null;
        const plugAngle = normal ? (Math.atan2(normal.y, normal.x) * 180) / Math.PI : 0;
        return (
          <g key={t} data-terminal={t} data-polarity={polarity ?? 'none'}>
            <circle
              cx={p.x}
              cy={p.y}
              r={terminalHitRadiusFor(half, terminalHitRadius)}
              fill="transparent"
              pointerEvents={terminalsInteractive ? 'auto' : 'none'}
              style={{ cursor: terminalsInteractive ? 'crosshair' : 'default' }}
              onPointerDown={(e) => {
                if (!terminalsInteractive) return;
                e.stopPropagation();
                onTerminalDown?.(e, `${el.id}:${t}`);
              }}
            />
            {normal && (
              // 叠插插头：香蕉插头串在同一根柱子上（后一枚插进前一枚的尾孔），
              // 沿接线柱外法线排成一列，正好压在两根导线共用的 18 单位短桩上。
              // 每枚插头的护套用自己那根导线的皮色，前端露一小截金属舌片。
              <g transform={`translate(${p.x} ${p.y}) rotate(${plugAngle})`} pointerEvents="none">
                <rect x={4} y={-2.2} width={sleeveCount * 6 + 0.4} height={4.4} rx={1.2} fill="var(--muted)" opacity={0.9} />
                {Array.from({ length: sleeveCount }, (_, i) => (
                  <rect
                    key={i}
                    x={5 + i * 6}
                    y={-4.6}
                    width={5.4}
                    height={9.2}
                    rx={2.2}
                    fill={socketColors[i] ?? plugFill}
                    stroke="var(--card-bg)"
                    strokeWidth={0.8}
                  />
                ))}
                <rect x={sleeveCount * 6 + 4.4} y={-1.8} width={2.6} height={3.6} rx={1.2} fill="var(--muted)" />
              </g>
            )}
            {/* 负极柱最外一圈「黑芯防丢」环：黑芯压在暗色画布上几乎没有亮度差
                （#18181b 对 #1e1e1a 只有 1.05），所以负极端子不能只靠自己发亮被
                找到。真正把它勾出来的是紧贴内圈那圈金属套（--muted，暗底 5.5:1），
                这一圈 --border 只是再加一道更外的插座底座轮廓，让「黑」读成
                「一个黑芯插座」而不是「一个洞」。 */}
            {polarity === '-' && terminalStyle.ring && (
              <circle
                cx={p.x}
                cy={p.y}
                r={terminalStyle.radius + 2.6}
                fill="none"
                stroke="var(--border)"
                strokeWidth={1.1}
                pointerEvents="none"
              />
            )}
            {terminalStyle.ring && (
              // 实物接线柱的金属外套圈：外圈做金属卡座，内圈才是红/黑极性芯。
              // 只描边不填满，否则会变成靶心；留一圈深色缝，读成香蕉插座。
              <circle
                cx={p.x}
                cy={p.y}
                r={terminalStyle.radius + 1.3}
                fill="var(--muted)"
                fillOpacity={0.35}
                stroke="var(--muted)"
                strokeWidth={1.1}
                pointerEvents="none"
              />
            )}
            <circle
              cx={p.x}
              cy={p.y}
              r={terminalStyle.radius}
              fill={postFill}
              stroke={polarity ? 'var(--card-bg)' : armed ? 'var(--accent)' : 'var(--fg)'}
              strokeWidth={polarity ? 1.3 : 1.2}
              pointerEvents="none"
            />
            {terminalStyle.ring && (
              // 高光点：一小块浅色，让柱子有一点金属弧度而不是纯色圆点
              <circle
                cx={p.x - terminalStyle.radius * 0.32}
                cy={p.y - terminalStyle.radius * 0.32}
                r={terminalStyle.radius * 0.3}
                fill="var(--card-bg)"
                fillOpacity={0.55}
                pointerEvents="none"
              />
            )}
            {armed && (
              <circle
                cx={p.x}
                cy={p.y}
                r={terminalStyle.radius + 3.6}
                fill="none"
                stroke="var(--accent)"
                strokeWidth={1.2}
                opacity={0.7}
                pointerEvents="none"
              />
            )}
          </g>
        );
      })}
    </g>
  );
}

export function kindHasPolarity(kind: ElementKind): boolean {
  return kind === 'battery' || kind === 'ammeter' || kind === 'voltmeter' || kind === 'galvanometer';
}

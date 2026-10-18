/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电流小点「沿折线按弧长匀速」驱动。
 *
 * 为什么不用 <animateMotion>：实测（Chrome，2026-10）在动画运行中修改 animateMotion 的
 * path / dur 属性，会让粒子在**单帧内**瞬移 89~193 用户单位（正常约 1px/帧，帧间隔 17ms 无掉帧）。
 * 拖滑动变阻器滑片时路径每帧都在变，于是小点反复跳变，与「接入长度连续变化」的教学意图相反。
 *
 * 本模块把路径建成折线，用 requestAnimationFrame 按**弧长进度**取点：
 * 进度只由时间与电流决定，路径形状（含滑片位置）逐帧变化时进度不变 → 小点连续、不跳变、无原点漂移。
 */

import { useEffect, useRef } from 'react';

export type FlowPolyline = ReadonlyArray<readonly [number, number]>;

export interface FlowTrack {
  /** 折线顶点（用户坐标），首尾应闭合以形成回路 */
  points: FlowPolyline;
  /** 该路径的电流（A），决定小点速度 */
  current: number;
}

/** 折线总长 */
function totalLength(pts: FlowPolyline): number {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
}

/** 取弧长 s 处的点（s 会被截到 [0, L]） */
export function pointAtLength(pts: FlowPolyline, s: number): readonly [number, number] {
  if (pts.length === 0) return [0, 0];
  if (pts.length === 1) return pts[0];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dy = pts[i][1] - pts[i - 1][1];
    const d = Math.hypot(dx, dy);
    if (d > 0 && acc + d >= s) {
      const k = (s - acc) / d;
      return [pts[i - 1][0] + dx * k, pts[i - 1][1] + dy * k];
    }
    acc += d;
  }
  return pts[pts.length - 1];
}

/**
 * 解析 M/H/V 绝对坐标路径（本仓电路小点路径只用这三种命令）为折线。
 * 例：`M40,60 H203 V44 H207 H230 V60 H270 V140 H40 V60`
 */
export function parsePolyline(d: string): FlowPolyline {
  const pts: [number, number][] = [];
  let x = 0;
  let y = 0;
  const tokens = d.match(/[MHVmhv][^MHVmhv]*/g) ?? [];
  for (const t of tokens) {
    const cmd = t[0];
    const nums = (t.slice(1).match(/-?\d*\.?\d+/g) ?? []).map(Number);
    if (cmd === 'M' || cmd === 'm') {
      for (let i = 0; i + 1 < nums.length; i += 2) {
        x = cmd === 'M' ? nums[i] : x + nums[i];
        y = cmd === 'M' ? nums[i + 1] : y + nums[i + 1];
        pts.push([x, y]);
      }
    } else if (cmd === 'H' || cmd === 'h') {
      for (const n of nums) {
        x = cmd === 'H' ? n : x + n;
        pts.push([x, y]);
      }
    } else if (cmd === 'V' || cmd === 'v') {
      for (const n of nums) {
        y = cmd === 'V' ? n : y + n;
        pts.push([x, y]);
      }
    }
  }
  return pts;
}

/** 每段动画的基准时长口径：与既有 SMIL 实现一致（速度随电流增大而变快） */
export const flowDurationS = (current: number) => Math.max(0.45, 2.2 / Math.max(current, 1e-6));

/**
 * 驱动若干条回路上的电流小点，直接写 SVG 属性（不走 React 状态 → 不触发重渲染）。
 *
 * @param tracks 每条回路的折线 + 电流；形状可逐帧变化，弧长进度不受影响
 * @param running 是否流动（开关断开 / 电流过小时传 false，立刻停）
 * @param offsetsS 同一条回路上多个小点的起始时间差（秒），默认两点相隔 1.1s
 * @returns setDotRef(trackIndex, dotIndex) → 稳定的 ref 回调
 */
export function useFlowDots(tracks: FlowTrack[], running: boolean, offsetsS: number[] = [0, 1.1]) {
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const refsRef = useRef<(SVGCircleElement | null)[][]>([]);
  const cbCache = useRef(new Map<string, (el: SVGCircleElement | null) => void>());
  const offsetsRef = useRef(offsetsS);
  offsetsRef.current = offsetsS;

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    /** 每个小点各自的弧长进度（px）。必须**逐帧增量**推进：
        若用「绝对时间 / dur」直接求进度，dur 会随电流变化，等于用新分母重标定已有进度 → 拖动时小点跳变。
        增量积分下，dur 变化只影响之后的步长，已有进度不受影响。 */
    const progress: number[] = [];
    let lastT = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastT) / 1000); // 掉帧时不要一次冲太远
      lastT = now;
      const list = tracksRef.current;
      const offs = offsetsRef.current;
      for (let ti = 0; ti < list.length; ti++) {
        const nodes = refsRef.current[ti];
        if (!nodes) continue;
        const pts = list[ti].points;
        const L = totalLength(pts);
        if (L <= 0) continue;
        const speed = L / flowDurationS(list[ti].current); // px/s：电流越大越快（沿用原口径）
        for (let di = 0; di < nodes.length; di++) {
          const pk = ti * 10 + di;
          // 初始错开：第 i 个点落后 offs[i] 秒对应的弧长
          if (progress[pk] === undefined) progress[pk] = -(offs[di] ?? 0) * speed;
          progress[pk] = (progress[pk] + speed * dt + L) % L;
          const n = nodes[di];
          if (!n || !n.isConnected) continue;
          const [x, y] = pointAtLength(pts, progress[pk]);
          n.setAttribute('cx', x.toFixed(2));
          n.setAttribute('cy', y.toFixed(2));
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  /** 稳定的 ref 回调（避免每次渲染重建 → React 反复 null/赋值的抖动） */
  const setDotRef = (ti: number, di: number) => {
    const key = `${ti}:${di}`;
    let cb = cbCache.current.get(key);
    if (!cb) {
      cb = (el: SVGCircleElement | null) => {
        const arr = (refsRef.current[ti] ||= []);
        arr[di] = el;
      };
      cbCache.current.set(key, cb);
    }
    return cb;
  };

  return setDotRef;
}

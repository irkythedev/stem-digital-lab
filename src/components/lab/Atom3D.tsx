/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 元素详情 · 可选「3D 空间原子模型」组件——纯原生 Canvas 2D，零第三方依赖。
 *
 * 分工：2D 课本规范图（`lib/atom-shells`）**才是默认且中考必考**的视图；
 * 本组件只是按需切换的空间补充（核内质子/中子离散球簇 + 三维倾斜轨道 + 绕行电子）。
 * 几何与投影全部在 `lib/atom-3d` 里以纯函数给出，本文件只负责绘制、rAF 与拖拽。
 *
 * ⚠️ 绝不引入 Three.js 等 3D 库：旋转矩阵、透视除法、深度排序都自己算。
 */
import { useEffect, useRef } from 'react';
import {
  MAX_LAYERS, ORBIT_SAMPLES, NEUTRON_COLOR, nucleusPoints, nucleusRadiusWorld, nucleonAlpha,
  nucleonScreenSizes, orbitPoint, orbitRadius, project3, sortByDepth, visualCount,
} from '../../lib/atom-3d';

export interface Atom3DProps {
  /** 质子数 Z */
  z: number;
  /** 估算中子数 N（与卡片看板同源，走 particleCount） */
  n: number;
  /** 电子层排布（自内向外，逐层真实电子数） */
  shells: readonly number[];
  /** 当前高亮层索引（与下方电子层胶囊联动；非该层淡化到 20%） */
  highlight: number;
  /** 无障碍标签 */
  label: string;
}

interface Item {
  depth: number;
  kind: 'orbit' | 'proton' | 'neutron' | 'electron';
  lit: boolean;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  r?: number;
  /** 核内景深透明度（近 1.0 / 远 0.66）；轨道与电子不用 */
  alpha?: number;
}

export default function Atom3D({ z, n, shells, highlight, label }: Atom3DProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  /** 旋转角与电子相位放 ref：每帧变动不该触发 React 重渲染 */
  const view = useRef({ rotX: -0.34, rotY: 0.52, phase: 0 });
  const drag = useRef({ active: false, x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const a = Math.max(1, z + n);
    // 核内粒子：方向取斐波那契球面、半径取低差异序列 cbrt → 铺满球体（不是全浮在表面）；
    // 质子/中子按**等距取样**分配。注意此处传入单位半径，绘制时再乘核球半径，故缩放窗口不必重建点阵。
    const unitNucleons = nucleusPoints(a, z, 1);
    const layers = shells.length;
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let frames = 0;
    let colors = { fg: '#111', muted: '#888', accent: '#C71D23', warm: NEUTRON_COLOR };

    const readColors = () => {
      const cs = getComputedStyle(canvas);
      const pick = (v: string, fb: string) => cs.getPropertyValue(v).trim() || fb;
      colors = {
        fg: pick('--fg', '#111'), muted: pick('--muted', '#888'),
        accent: pick('--accent', '#C71D23'), warm: NEUTRON_COLOR,   // 中子：淡暖灰白，保持「暖」的语义不随主题跳
      };
    };

    const render = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (frames++ % 30 === 0) readColors();   // 主题切换 0.5s 内跟随，免去每帧读计算样式

      // 0.38 与 CAMERA_D=5 配套：最外层轨道近端放大 k≈1.25 后仍留在画布内（0.38×1.25=0.475 < 半高 0.5）
      const cx = w / 2, cy = h / 2, scale = Math.min(w, h) * 0.38;
      const { rotX, rotY, phase } = view.current;
      const items: Item[] = [];

      // 核球簇屏幕尺寸：核球 ≤ 最内层轨道 × 0.4，单球 2.2~3.5px（详见 lib/atom-3d）
      const size = nucleonScreenSizes(visualCount(a), nucleusRadiusWorld(layers) * scale);
      const nucleusR = size.nucleusR / scale;   // 回到世界单位，绘制时随透视 k 放大 → 近大远小

      // ① 轨道逐段入排序：远半圈自然落到核后、近半圈落到核前
      for (let i = 0; i < layers && i < MAX_LAYERS; i++) {
        const r = orbitRadius(i, layers), lit = i === highlight;
        for (let k = 0; k < ORBIT_SAMPLES; k++) {
          const p0 = orbitPoint(i, (k / ORBIT_SAMPLES) * Math.PI * 2, r, rotX, rotY);
          const p1 = orbitPoint(i, ((k + 1) / ORBIT_SAMPLES) * Math.PI * 2, r, rotX, rotY);
          const q0 = project3(p0, cx, cy, scale), q1 = project3(p1, cx, cy, scale);
          items.push({ depth: (p0.z + p1.z) / 2, kind: 'orbit', lit, x: q0.x, y: q0.y, x2: q1.x, y2: q1.y });
        }
      }
      // ② 核内质子 / 中子离散球簇：逐球独立投影 + 景深透明度
      unitNucleons.forEach((p) => {
        const rp = { x: p.x * nucleusR, y: p.y * nucleusR, z: p.z * nucleusR };
        const rot = project3(rp, cx, cy, scale);
        items.push({
          depth: rot.depth, kind: p.proton ? 'proton' : 'neutron', lit: true,
          x: rot.x, y: rot.y, r: size.nucleonR * rot.k,
          alpha: nucleonAlpha(rp.z, nucleusR),
        });
      });
      // ③ 绕行电子：每层铺满该层真实电子数；相邻层反向、内层略快
      for (let i = 0; i < layers && i < MAX_LAYERS; i++) {
        const r = orbitRadius(i, layers), lit = i === highlight, count = shells[i];
        for (let k = 0; k < count; k++) {
          const ang = (i % 2 === 1 ? -1 : 1) * phase * (1 - i * 0.07) + (k / count) * Math.PI * 2;
          const q = project3(orbitPoint(i, ang, r, rotX, rotY), cx, cy, scale);
          items.push({ depth: q.depth, kind: 'electron', lit, x: q.x, y: q.y, r: 0.026 * q.k * scale * (lit ? 1.3 : 1) });
        }
      }
      // ④ 画家算法：远 → 近（轨道线段 / 核子 / 电子各自按自身深度就位）
      sortByDepth(items).forEach((it) => {
        if (it.kind === 'orbit') {
          ctx.strokeStyle = it.lit ? colors.fg : colors.muted;
          ctx.globalAlpha = it.lit ? 0.85 : 0.2;
          ctx.lineWidth = it.lit ? 1.6 : 1;
          ctx.beginPath();
          ctx.moveTo(it.x, it.y);
          ctx.lineTo(it.x2 as number, it.y2 as number);
          ctx.stroke();
          return;
        }
        if (it.kind === 'electron') {
          ctx.fillStyle = colors.fg;
          ctx.globalAlpha = it.lit ? 1 : 0.2;
        } else {
          // 核子：**严禁大块实心**——每颗小球各画一条自己的径向渐变：
          // 高光点微偏向左上光源 → 本体色 → 外缘压暗，使其读作独立圆润球体而非拼贴色块。
          const r = Math.max(0.7, it.r as number);
          const base = it.kind === 'proton' ? colors.accent : colors.warm;
          const g = ctx.createRadialGradient(it.x - r * 0.34, it.y - r * 0.36, r * 0.06, it.x, it.y, r);
          g.addColorStop(0, '#ffffff');
          g.addColorStop(0.44, base);
          g.addColorStop(1, 'rgba(8,6,4,0.62)');
          ctx.fillStyle = g;
          ctx.globalAlpha = it.alpha ?? 1;
        }
        ctx.beginPath();
        ctx.arc(it.x, it.y, Math.max(0.7, it.r as number), 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    };

    const loop = () => { view.current.phase += 0.006; render(); raf = requestAnimationFrame(loop); };

    // 拖拽旋转：pointerdown 在画布，move/up 挂 window（拖出画布也跟手）
    const onDown = (e: PointerEvent) => {
      drag.current = { active: true, x: e.clientX, y: e.clientY };
      canvas.setPointerCapture?.(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!drag.current.active) return;
      view.current.rotY += (e.clientX - drag.current.x) * 0.01;
      view.current.rotX = Math.max(-1.2, Math.min(1.2, view.current.rotX + (e.clientY - drag.current.y) * 0.01));
      drag.current.x = e.clientX;
      drag.current.y = e.clientY;
      if (reduce) render();   // 减动效时不跑循环，拖拽手动重绘
    };
    const onUp = () => { drag.current.active = false; };
    const ro = new ResizeObserver(() => { if (reduce) render(); });

    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    ro.observe(canvas);
    readColors();
    if (reduce) render(); else raf = requestAnimationFrame(loop);

    // 防泄漏：切回 2D 或关闭弹窗（组件卸载）时必须取消动画帧并摘掉全部监听
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [z, n, shells, highlight]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={label}
      data-atom-3d=""
      className="w-full max-h-[200px] h-[200px] cursor-grab active:cursor-grabbing"
      style={{ touchAction: 'none' }}
    />
  );
}

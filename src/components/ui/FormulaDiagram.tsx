/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 数学公式配图：按 diagram 类型渲染严谨的示意图。
 * - pythagorean  勾股定理（直角三角形 + 三边正方形面积）
 * - chord        垂径定理（圆 + 垂直弦 + 中点）
 * - inscribed    圆周角定理（圆心角/圆周角）
 * - sector       弧长/扇形（圆 + 扇形阴影）
 * 全部用 var() 主题色，标注对照教材；aria-label 说明图形内容。
 */
import { useApp } from '../../lib/app-context';

export type FormulaDiagramType = 'pythagorean' | 'chord' | 'inscribed' | 'sector';

interface FormulaDiagramProps {
  type: FormulaDiagramType;
  className?: string;
}

export default function FormulaDiagram({ type, className = '' }: FormulaDiagramProps) {
  const { lang } = useApp();
  const FG = 'var(--fg)';
  const MUT = 'var(--muted)';
  const ACC = 'var(--accent)';
  const BG = 'var(--card-bg)';

  const labels = {
    pythagorean: lang === 'zh' ? '勾股定理：直角三角形两直角边 a、b，斜边 c' : 'Pythagorean theorem: right triangle with legs a, b and hypotenuse c',
    chord: lang === 'zh' ? '垂径定理：直径 CD 垂直于弦 AB，平分弦及所对弧' : 'Perpendicular diameter: CD ⟂ AB bisects the chord and its arcs',
    inscribed: lang === 'zh' ? '圆周角定理：∠BPC 是弧 BC 所对的圆周角，等于圆心角 ∠BOC 的一半' : 'Inscribed angle: ∠BPC equals half the central angle ∠BOC',
    sector: lang === 'zh' ? '扇形：圆心角 n°，半径 r，弧长 l' : 'Sector: central angle n°, radius r, arc length l',
  } as const;

  if (type === 'pythagorean') {
    // 勾股定理（3-4-5 精确比例）：a=3, b=4, c=5，三边正方形面积 a²+b²=c²
    // 课本常见画法：竖直边为短边 a=60，水平边为长边 b=80，斜边 c=100
    // 单位 u=20px；直角点 (70,105)，整体居中于 300×190 视口
    const u = 20;
    const a = 3 * u, b = 4 * u, c = 5 * u; // 60, 80, 100
    const right = { x: 70, y: 105 };
    const hEnd = { x: right.x + b, y: right.y };   // b 边末端 (150,105)
    const vEnd = { x: right.x, y: right.y - a };   // a 边末端 (70,45)
    return (
      <svg viewBox="0 0 300 190" className={className} role="img" aria-label={labels.pythagorean}>
        {/* 直角三角形（直角点 right，水平边 b，竖直边 a，斜边连接两端） */}
        <path d={`M${right.x} ${right.y} L${hEnd.x} ${hEnd.y} L${vEnd.x} ${vEnd.y} Z`} fill={BG} stroke={FG} strokeWidth="1.4" />
        {/* 直角标记 */}
        <path d={`M${right.x + 14} ${right.y} L${right.x + 14} ${right.y - 14} L${right.x} ${right.y - 14}`} fill="none" stroke={FG} strokeWidth="1" />
        {/* 正方形 a²（竖直边外侧，边长 60，与竖直边同高） */}
        <rect x={right.x - a} y={right.y - a} width={a} height={a} fill="none" stroke={MUT} strokeWidth="1" strokeDasharray="4 3" />
        {/* 正方形 b²（水平边下方，边长 80） */}
        <rect x={right.x} y={right.y} width={b} height={b} fill="none" stroke={MUT} strokeWidth="1" strokeDasharray="4 3" />
        {/* 正方形 c²（斜边外侧，旋转使边贴合斜边）：斜边向量 (b,-a)，角度 atan2(-a,b) */}
        <g transform={`translate(${hEnd.x} ${hEnd.y}) rotate(${(Math.atan2(-a, b) * 180) / Math.PI})`}>
          <rect x="0" y="0" width={c} height={c} fill="none" stroke={FG} strokeWidth="1.2" />
          <text x={c / 2} y={c / 2 + 4} fontSize="12" fill={FG} textAnchor="middle" fontFamily="var(--f-serif)" fontStyle="italic">c²</text>
        </g>
        {/* 面积标注（正方形中心附近） */}
        <text x={right.x - a + 12} y={right.y - a / 2 + 2} fontSize="12" fill={MUT} fontFamily="var(--f-serif)" fontStyle="italic">a²</text>
        <text x={right.x + b / 2 - 7} y={right.y + b / 2 + 3} fontSize="12" fill={MUT} fontFamily="var(--f-serif)" fontStyle="italic">b²</text>
        {/* 边长标注（紧贴各自边中点：a 竖直边右侧 / b 水平边上方 / c 斜边中点旁） */}
        <text x={right.x + 7} y={right.y - a / 2 + 2} fontSize="10" fill={FG} fontFamily="var(--f-serif)" fontStyle="italic">a</text>
        <text x={right.x + b / 2 - 4} y={right.y - 6} fontSize="10" fill={FG} fontFamily="var(--f-serif)" fontStyle="italic">b</text>
        <text x={right.x + b / 2 - 22} y={right.y - a / 2 + 10} fontSize="10" fill={FG} fontFamily="var(--f-serif)" fontStyle="italic">c</text>
      </svg>
    );
  }

  if (type === 'chord') {
    // 垂径定理：满足 r²=半弦²+弦距² 的整数组合
    // r=65, 半弦=56, 弦距=33（56²+33²=3136+1089=4225=65² ✓）
    const cx = 150, cy = 100, r = 65;
    const half = 56, dist = 33; // 弦距 33，弦 y = cy - dist = 67
    const chordY = cy - dist;
    return (
      <svg viewBox="0 0 300 190" className={className} role="img" aria-label={labels.chord}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={FG} strokeWidth="1.2" />
        {/* 直径 CD（竖直） */}
        <line x1={cx} y1={cy - r} x2={cx} y2={cy + r} stroke={ACC} strokeWidth="1.4" />
        {/* 弦 AB（水平，被 CD 垂直平分） */}
        <line x1={cx - half} y1={chordY} x2={cx + half} y2={chordY} stroke={FG} strokeWidth="1.4" />
        {/* 中点 M 与直角标记 */}
        <circle cx={cx} cy={chordY} r="2" fill={FG} />
        <path d={`M${cx} ${chordY - 9} h9 v9`} fill="none" stroke={FG} strokeWidth="0.8" />
        {/* 弧标注（AC 与 CB 等弧，虚线） */}
        <path d={`M${cx - half} ${chordY} A65 65 0 0 1 ${cx} ${cy - r}`} fill="none" stroke={MUT} strokeWidth="0.8" strokeDasharray="3 3" />
        <path d={`M${cx + half} ${chordY} A65 65 0 0 0 ${cx} ${cy - r}`} fill="none" stroke={MUT} strokeWidth="0.8" strokeDasharray="3 3" />
        {/* 顶点标注 */}
        <text x={cx - half - 8} y={chordY - 4} fontSize="11" fill={FG} fontFamily="var(--f-serif)" fontStyle="italic">A</text>
        <text x={cx + half + 2} y={chordY - 4} fontSize="11" fill={FG} fontFamily="var(--f-serif)" fontStyle="italic">B</text>
        <text x={cx + 4} y={cy - r - 6} fontSize="11" fill={FG} fontFamily="var(--f-serif)" fontStyle="italic">C</text>
        <text x={cx + 4} y={cy + r + 14} fontSize="11" fill={FG} fontFamily="var(--f-serif)" fontStyle="italic">D</text>
        <text x={cx + 5} y={chordY - 12} fontSize="10" fill={MUT} fontFamily="var(--f-serif)" fontStyle="italic">M</text>
        <text x={cx + r + 6} y={cy + 4} fontSize="11" fill={MUT} fontFamily="var(--f-serif)" fontStyle="italic">O</text>
      </svg>
    );
  }

  if (type === 'inscribed') {
    // 圆周角定理：圆 O，弧 BC，圆心角 ∠BOC，圆周角 ∠BPC
    const cx = 150, cy = 95, r = 70;
    // B 在右上 (cx+r·cos40°, cy-r·sin40°)，C 在右下，P 在左侧
    const b = { x: cx + r * Math.cos(Math.PI / 5), y: cy - r * Math.sin(Math.PI / 5) };      // 36°
    const c = { x: cx + r * Math.cos(Math.PI / 5), y: cy + r * Math.sin(Math.PI / 5) };      // -36°
    const p = { x: cx - r, y: cy };
    const bC = b.x.toFixed(1), bY = b.y.toFixed(1), cX = c.x.toFixed(1), cY = c.y.toFixed(1);
    return (
      <svg viewBox="0 0 300 190" className={className} role="img" aria-label={labels.inscribed}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={FG} strokeWidth="1.2" />
        {/* 弧 BC（所对弧，描粗） */}
        <path d={`M${bC} ${bY} A70 70 0 0 1 ${cX} ${cY}`} fill="none" stroke={ACC} strokeWidth="1.6" />
        {/* 圆心角 ∠BOC（半径 OB、OC） */}
        <line x1={cx} y1={cy} x2={bC} y2={bY} stroke={MUT} strokeWidth="1" />
        <line x1={cx} y1={cy} x2={cX} y2={cY} stroke={MUT} strokeWidth="1" />
        {/* 圆周角 ∠BPC（弦 PB、PC） */}
        <line x1={p.x} y1={p.y} x2={bC} y2={bY} stroke={FG} strokeWidth="1.4" />
        <line x1={p.x} y1={p.y} x2={cX} y2={cY} stroke={FG} strokeWidth="1.4" />
        {/* 顶点标注 */}
        <text x={b.x - 8} y={b.y - 6} fontSize="11" fill={FG} fontFamily="var(--f-serif)" fontStyle="italic">B</text>
        <text x={c.x - 8} y={c.y + 14} fontSize="11" fill={FG} fontFamily="var(--f-serif)" fontStyle="italic">C</text>
        <text x={p.x - 14} y={p.y + 4} fontSize="11" fill={FG} fontFamily="var(--f-serif)" fontStyle="italic">P</text>
        <text x={cx + r + 6} y={cy + 4} fontSize="11" fill={MUT} fontFamily="var(--f-serif)" fontStyle="italic">O</text>
        {/* 角度小弧标注：∠BOC 72°（从 C(-36°) 扫到 B(+36°)，两端落半径 OB、OC 上）；∠BPC 36° 用弧线（非直线） */}
        <path d={`M${cx + 10 * Math.cos(Math.PI / 5)} ${cy + 10 * Math.sin(Math.PI / 5)} A10 10 0 0 0 ${cx + 10 * Math.cos(Math.PI / 5)} ${cy - 10 * Math.sin(Math.PI / 5)}`} fill="none" stroke={MUT} strokeWidth="0.7" />
        <path d={`M${p.x + 10 * Math.cos(-Math.PI / 10)} ${p.y + 10 * Math.sin(-Math.PI / 10)} A10 10 0 0 1 ${p.x + 10 * Math.cos(Math.PI / 10)} ${p.y + 10 * Math.sin(Math.PI / 10)}`} fill="none" stroke={MUT} strokeWidth="0.7" />
      </svg>
    );
  }

  // sector: 扇形（圆心角 n°，半径 r，弧长 l）
  const cx = 150, cy = 100, r = 75;
  const a1 = -Math.PI / 2;           // 起始：正上方
  const a2 = a1 + (60 * Math.PI) / 180; // 60° 扇形
  const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
  const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
  // 弧长 l 标注：沿弧外侧的虚线弧段（示意弧长沿圆周走，而非直弦）
  const lm = a1 + (30 * Math.PI) / 180;   // 弧中点角 -60°
  const lr = r + 8;                       // 弧段半径（圆外 8px，紧贴圆周）
  const la1 = lm - (18 * Math.PI) / 180, la2 = lm + (18 * Math.PI) / 180;
  const lx1 = cx + lr * Math.cos(la1), ly1 = cy + lr * Math.sin(la1);
  const lx2 = cx + lr * Math.cos(la2), ly2 = cy + lr * Math.sin(la2);
  const lmx = cx + (lr + 9) * Math.cos(lm), lmy = cy + (lr + 9) * Math.sin(lm);
  return (
    <svg viewBox="0 0 300 190" className={className} role="img" aria-label={labels.sector}>
      {/* 完整圆（虚线弱化） */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={MUT} strokeWidth="0.8" strokeDasharray="4 3" />
      {/* 扇形填充 + 两半径 + 弧（Z 闭合回圆心，非弦） */}
      <path d={`M${cx} ${cy} L${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`} fill={BG} stroke={FG} strokeWidth="1.2" />
      {/* 弧长 l 虚线弧段（沿圆周） */}
      <path d={`M${lx1.toFixed(1)} ${ly1.toFixed(1)} A${lr} ${lr} 0 0 1 ${lx2.toFixed(1)} ${ly2.toFixed(1)}`} fill="none" stroke={MUT} strokeWidth="0.9" strokeDasharray="3 3" />
      {/* 圆心角 n° 小弧（数学度数画法：角内弧线两端落两半径上） */}
      <path d={`M${cx + 16 * Math.cos(a1)} ${cy + 16 * Math.sin(a1)} A16 16 0 0 1 ${cx + 16 * Math.cos(a2)} ${cy + 16 * Math.sin(a2)}`} fill="none" stroke={MUT} strokeWidth="0.7" />
      {/* 半径标注（圆心 → 圆边，完整半径） */}
      <line x1={cx} y1={cy} x2={cx + r} y2={cy} stroke={MUT} strokeWidth="0.8" />
      {/* 标注 */}
      <text x={cx + 28} y={cy + 16} fontSize="11" fill={MUT} fontFamily="var(--f-serif)" fontStyle="italic">r</text>
      <text x={lmx - 3} y={lmy + 4} fontSize="11" fill={FG} fontFamily="var(--f-serif)" fontStyle="italic">l</text>
      <text x={cx + 27 * Math.cos((a1 + a2) / 2) - 8} y={cy + 27 * Math.sin((a1 + a2) / 2) + 4} fontSize="10" fill={MUT} fontFamily="var(--f-serif)">n°</text>
      <text x={cx + r + 8} y={cy + 4} fontSize="11" fill={MUT} fontFamily="var(--f-serif)" fontStyle="italic">O</text>
    </svg>
  );
}

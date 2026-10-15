/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 科目图标：数学 / 物理 / 化学三科统一为 24 栅格、固定线宽的矢量图标
 * （数学＝几何曲线 π，物理＝Atom 原子轨道，化学＝FlaskConical 锥形瓶），
 * 统一由本渲染器输出，保证三科图标在首页 / 科目页 / 实验页全站一致。
 *
 * 数学为何不再用字体字形 π：衬线体的 π 横细竖粗、笔画末端带弯钩，字宽与字重
 * 还会随 font-family（--f-serif 子集 / 系统宋体 / 各端回退）与 font-weight 漂移，
 * 与另外两个固定线宽的矢量图标永远凑不齐——此前靠 `text-2xl font-bold leading-none`
 * 去硬贴 20px 图标的墨迹高度，属补偿式对齐。改用矢量后三科同栅格、同线宽。
 *
 * 亦不用 lucide 的 Pi：它的横梁与左竖之间是衬线式弯钩
 * （lucide 0.546 的 d="M4 7c0-1.7 1.3-3 3-3h13"），正是本次要去掉的形态。
 *
 * 笔画形态：三笔皆为曲线 —— 顶横线是两端略低、中间微隆的浅弧，左腿圆角过渡后
 * 微向左倾并以左下撇脚收笔，右腿顺滑下探后以 C 形弯钩向右下舒展。无生硬直角与纯直线。
 *
 * 线宽：默认 stroke-width 2（24 栅格标准线宽）。调用方传 `stroke-[1.0]` 等类名时
 * 由 CSS 覆盖（CSS 声明优先于表现属性，与 lucide 图标同一机制）→ 大尺寸下三科同步变细。
 */
import { Atom, FlaskConical } from 'lucide-react';
import type { SubjectId } from '../../lib/subjects';

const LUCIDE_ICONS = {
  physics: Atom,
  chemistry: FlaskConical,
} as const;

/**
 * 几何 π（派下稿 1:1 落笔，24 栅格）：
 *   · 顶横线：左端微垂过渡 → 中段舒展平直 → 右端轻轻上扬收笔；
 *   · 左腿：上半段基本垂直、仅微斜，末段自然向左微撇；
 *   · 右腿：直落到底后圆润勾起（标准 J 型反勾），圆头端点。
 * 三笔皆曲线，无生硬直角与纯直线；2px 固定线宽、圆头端点。
 *
 * 体量实测（同条件光栅化，20px 框 / stroke 2）：本几何 ink 2397.6、bbox 15.3×12.7，
 * 而同框的 Atom 5349.1、FlaskConical 3632.2 —— 即 1:1 落笔会比另两科轻约三成。
 * 若需回到已验收体量，把三条 path 绕中心 (12,12) 等比放大 1.23（ink 2935.1、bbox 18.5×15.2，
 * 见 docs/changelog-internal.md 的对照表）；注意墨迹随几何线性增长（描边宽度不随几何缩放），
 * 拉到与 Flask 同重需 ×1.52，几何将顶出 24 栅格、2px 描边会被裁，不可取。
 */
function GeometricPi({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M2.04 6.47C3.27 4.62 5.11 4.62 7.57 4.62h11.69c1.23 0 2.21-.25 2.71-.74" />
      <path d="M8.19 4.62c-.25 5.54-.98 10.46-2.71 13.53-.49.86-1.11 1.48-1.85 1.85" />
      <path d="M14.7 4.62v11.69c0 2.46 1.23 3.69 2.95 3.69 1.23 0 2.09-.62 2.58-1.6" />
    </svg>
  );
}

interface SubjectIconProps {
  subjectId: SubjectId;
  /** 尺寸与线宽类（三科统一由此控制；线宽可被 stroke-[n] 覆盖） */
  className?: string;
}

export default function SubjectIcon({ subjectId, className = '' }: SubjectIconProps) {
  if (subjectId === 'math') return <GeometricPi className={className} />;
  const Icon = LUCIDE_ICONS[subjectId as keyof typeof LUCIDE_ICONS];
  return <Icon className={className} />;
}

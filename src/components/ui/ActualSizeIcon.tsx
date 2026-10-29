/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 「按实际尺寸适配」图标：一个方框 + 内容两侧的对齐线 + 中心两点，
 * 说的是「把内容按实际大小摆进这块框里」，不是「放大 / 全屏」。
 *
 * 来源：QingIcon（`qingicon-mcp` 1.0.2，Apache-2.0，Copyright 2026 Asorn）的
 * `square-actual-size`（分类 Media）。只取这一条 `<path d>` 内联——不引整个包、
 * 不走 CDN（内网/断网会挂），与 `ProviderIcon.tsx` 抽品牌标的做法同一套。
 *
 * 为什么单拎一枚而不是继续用 lucide：
 * 全站唯一需要「适应尺寸」语义的地方是电学工作台的「适配画布」（工具条按钮 +
 * 右键菜单同一动作），而 lucide 0.546 里没有这个字形，此前用的 `Maximize2`
 * （四角向外箭头）与隔壁全屏按钮的 `Expand` 撞读——两个按钮画的是同一件事。
 * QingIcon 的这一枚与 lucide 构造完全一致（24 栅格 / 2px 描边 / currentColor /
 * 圆头圆角），并排落下不会因为换族而改变视觉重量，只改变形状语言。
 *
 * 构造对齐 `SubjectIcon` / lucide：24 栅格、strokeWidth 2、currentColor、圆头圆角。
 */
export interface ActualSizeIconProps {
  className?: string;
}

export default function ActualSizeIcon({ className = '' }: ActualSizeIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M8 15V9M16 15V9M12 10H12.01M12 14H12.01M4 4H20V20H4V4Z" />
    </svg>
  );
}

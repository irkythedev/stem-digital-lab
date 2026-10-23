/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 全站统一返回链接（Ghost Link）：ArrowLeft 图标 + 文字，**无下划线**。
 * 站内返回入口只保留这一种形态：顶栏 Logo 已承担回首页，故不再单独挂 ⌂ 小房子。
 *
 * 间距分档：移动端 mt-2 / mb-1，桌面 mt-3 / mb-6。
 * 手机首屏要留给实验画布——返回链接自身 40px 高（.tap-area 命中区），
 * 其下再压 24px 外边距纯属留白；桌面节奏一字未改。
 *
 * 移动端必须 `self-start`：`.tap-area` 带 `justify-content: center`（未分层 CSS，压过工具类），
 * 而本链接是 flex 列的子项、默认 `align-self: stretch` → 盒被拉满 342px 后内容居中，
 * 箭头落在 x=160，与下方左对齐的图标/标题撕裂。改成 self-start 后盒宽=内容宽，箭头回到 x=24。
 * 该属性不动对齐方式，只改盒宽，故只加在移动端（`max-sm:`），桌面盒宽与命中区不变。
 *
 * 左缘取 x=24（正文列左边界）：main 的 px-2 之后，段落文字、标题图标盒（w-12）、
 * 返回链接三者同一起点。标题图标的**墨迹**会因各实验图形自带留白而落在 31.3–42.3
 * 之间浮动（实测 15 个实验），单一 padding 无法对齐全部，故不再做逐图标的墨迹补偿——
 * 那需要按图标逐个给偏移，属另一件事。
 */
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

interface BackLinkProps {
  /** 目标：学科页（如 /subject/math）或首页 / */
  to: string;
  children: ReactNode;
  /** 追加类名（仅用于个别页面的额外定位，不用于覆盖间距令牌） */
  className?: string;
}

export default function BackLink({ to, children, className = '' }: BackLinkProps) {
  return (
    <Link
      to={to}
      className={`mt-2 mb-1 inline-flex items-center gap-1.5 text-xs mono-font text-[var(--muted)] hover:text-[var(--fg)] transition-colors tap-area max-sm:self-start sm:mt-3 sm:mb-6 ${className}`}
    >
      <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
      {children}
    </Link>
  );
}

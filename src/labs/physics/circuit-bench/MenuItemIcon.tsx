/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学工作台 · 菜单动作图标映射
 *
 * 菜单模型（`circuit-bench-menu.ts`）只产出图标名，图标本体在这里映射，
 * 元件 / 导线 / 空白三套菜单共用同一套，免得同一个「旋转」在不同菜单里长得不一样。
 *
 * 表里混着两种来源：多数是 lucide 图标，`fit` 是内联的 `ActualSizeIcon`（lucide 没有
 * 「适应尺寸」字形，见该文件）。所以这里的类型是「只吃 className 的组件」，
 * 而不是 lucide 的 `LucideIcon`——表只往组件传 className，别的一律不该依赖。
 */
import type { ComponentType } from 'react';
import {
  ArrowLeftRight,
  Copy,
  Eraser,
  Eye,
  Power,
  RotateCcw,
  RotateCw,
  SlidersHorizontal,
  Trash2,
  Wrench,
} from 'lucide-react';

import ActualSizeIcon from '../../../components/ui/ActualSizeIcon';
import type { MenuIcon } from './circuit-bench-menu';

const ICONS: Record<MenuIcon, ComponentType<{ className?: string }>> = {
  'rotate-cw': RotateCw,
  'rotate-ccw': RotateCcw,
  swap: ArrowLeftRight,
  copy: Copy,
  sliders: SlidersHorizontal,
  trash: Trash2,
  power: Power,
  wrench: Wrench,
  fit: ActualSizeIcon,
  eye: Eye,
  eraser: Eraser,
};

export default function MenuItemIcon({ name, className }: { name: MenuIcon; className?: string }) {
  const Icon = ICONS[name] ?? SlidersHorizontal;
  return <Icon className={className ?? 'h-3.5 w-3.5 shrink-0'} />;
}

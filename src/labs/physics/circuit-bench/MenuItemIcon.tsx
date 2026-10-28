/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学工作台 · 菜单动作图标映射
 *
 * 菜单模型（`circuit-bench-menu.ts`）只产出图标名，图标本体在这里映射，
 * 元件 / 导线 / 空白三套菜单共用同一套，免得同一个「旋转」在不同菜单里长得不一样。
 */
import {
  ArrowLeftRight,
  Copy,
  Eraser,
  Eye,
  Maximize2,
  Power,
  RotateCcw,
  RotateCw,
  SlidersHorizontal,
  Trash2,
  Wrench,
} from 'lucide-react';

import type { MenuIcon } from './circuit-bench-menu';

const ICONS: Record<MenuIcon, typeof RotateCw> = {
  'rotate-cw': RotateCw,
  'rotate-ccw': RotateCcw,
  swap: ArrowLeftRight,
  copy: Copy,
  sliders: SlidersHorizontal,
  trash: Trash2,
  power: Power,
  wrench: Wrench,
  maximize: Maximize2,
  eye: Eye,
  eraser: Eraser,
};

export default function MenuItemIcon({ name, className }: { name: MenuIcon; className?: string }) {
  const Icon = ICONS[name] ?? SlidersHorizontal;
  return <Icon className={className ?? 'h-3.5 w-3.5 shrink-0'} />;
}

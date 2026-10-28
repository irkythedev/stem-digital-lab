/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学工作台 · 画布右键 / 长按菜单
 *
 * 桌面端右键、希沃大屏手指长按 450ms，弹出的都是这一个菜单：
 * 动作清单由 `circuit-bench-menu.ts` 产出（元件 / 导线 / 空白三套），
 * 这里只负责量自己的尺寸、按 `menuPosition` 夹进视口、把选中的 id 派发出去。
 *
 * 关闭时机：点菜单以外的任何地方，或按 Esc。用捕获阶段的 pointerdown 监听，
 * 保证「点外面」先于画布的指针逻辑生效——先关菜单，再让这次点击照常选中/落笔。
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { menuPosition, type MenuAction, type MenuItem } from './circuit-bench-menu';
import MenuItemIcon from './MenuItemIcon';
import { TOUCH_GUARD } from './circuit-bench-touch';

export interface CanvasContextMenuProps {
  /** 触发点（client 坐标）。 */
  x: number;
  y: number;
  items: MenuItem[];
  zh: boolean;
  onPick: (id: MenuAction) => void;
  onClose: () => void;
}

export default function CanvasContextMenu({ x, y, items, zh, onPick, onClose }: CanvasContextMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  // 先按触发点渲染，量到真实尺寸后再夹进视口：菜单项多少不定，
  // 高度没法预先算准，只能量完再摆。
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos(
      menuPosition({ x, y }, { w: r.width, h: r.height }, {
        w: window.innerWidth,
        h: window.innerHeight,
      }),
    );
  }, [x, y, items.length, zh]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={zh ? '元件操作菜单' : 'Part actions'}
      className={`fixed z-[80] min-w-[150px] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card-bg)]/97 py-1 shadow-xl backdrop-blur-md ${TOUCH_GUARD}`}
      style={{ left: pos?.x ?? x, top: pos?.y ?? y, visibility: pos ? 'visible' : 'hidden' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          role="menuitem"
          onClick={() => onPick(it.id)}
          className={`${TOUCH_GUARD} flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] leading-none transition-colors ${
            it.danger
              ? 'text-[var(--danger)] hover:bg-[var(--danger)]/12'
              : 'text-[var(--fg)] hover:bg-[var(--accent-light)]'
          }`}
        >
          <MenuItemIcon name={it.icon} className="h-3.5 w-3.5 shrink-0 opacity-80" />
          <span className="min-w-0 flex-1 truncate">{zh ? it.zh : it.en}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学工作台 · 更换元件前的「先断电」确认
 *
 * 学生点下「更换灯泡 / 更换保险丝 / 一键修复」的那一刻，如果换上去的新件会立刻带电，
 * 这里先拦一道：**实验操作规范要求先断开开关，再更换元件**。这不是物理后果的警告
 * （那是看板红条里 `repairCaution` 的活），而是操作纪律——灯泡并联在另一条支路上、
 * 换了也不会坏，可那条支路还通着电，手就不该伸过去。
 *
 * 形态上刻意做成「两步式（帮你断电）」而不是「拦住不让点」：
 *   - 按钮照常可点，点下去弹这一层，正文点名那只开关（判据见 `deenergizePlan`）；
 *   - 主按钮一键完成「断开该开关 + 换新」，是一个撤销点，学生按一次 Ctrl+Z 就回到原样；
 *   - 取消则什么都不做，画布上的电路连一根线都不会动。
 *
 * 只做确认，不懂物理、不改状态：`plan` 由 `circuit-bench-monitor` 的纯函数算好，
 * 两个动作（断电、换件）由上层在一次 `commit` 里完成（见 CircuitBench 的 `applyRepair`）。
 *
 * 层叠：`fixed inset-0 z-50` 盖在画布之上，但它只挡指针、不锁页面滚动——
 * 全屏时工作台根节点就是 `:fullscreen` 宿主，浮层挂在它里面才跟着一起全屏。
 */
import { useEffect, useRef } from 'react';
import { AlertTriangle, PowerOff, X } from 'lucide-react';

import type { DeenergizePlan } from './circuit-bench-monitor';

export interface RepairConfirmProps {
  plan: DeenergizePlan;
  zh: boolean;
  /** 断开开关并换新（上层一次 commit 完成，单撤销点）。 */
  onConfirm: () => void;
  /** 取消：什么都不动。 */
  onCancel: () => void;
}

export default function RepairConfirm({ plan, zh, onConfirm, onCancel }: RepairConfirmProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  /**
   * Esc = 取消，打开时把焦点交给主按钮。
   *
   * 主按钮是全屏唯一有副作用的动作（断一次电、换一次件），学生常常是手一抖把
   * 检查器上的「更换灯泡」当「收起」点了；键盘用户也必须能中途退出来。
   *
   * 监听器必须挂在**捕获阶段**、且只注册一次（依赖数组为空，最新回调走 ref）：
   * 工作台上另有一个全局 `keydown` 管「Esc 收起检查器」，它排在冒泡阶段。冒泡时
   * 一次同步重渲染会先把本层的监听器摘掉（依赖里带着 `onCancel` 这种每次渲染都换
   * 身份的回调，就会每次渲染都重挂一遍），于是第一下 Esc 被吞掉——实测症状是
   * 「弹窗刚出现，按 Esc 没反应，按第二下才关」。同一个坑下拉菜单已经踩过一回
   * （见 BenchSelect 的键盘监听注释），这里照同一套写法：捕获 + ref。
   *
   * 模态框期间 Esc 归它所有：`stopPropagation` 不让事件继续下沉，免得同一下按键
   * 顺手把背后的检查器也收起来——学生按 Esc 的意图是「退出这一层」。
   */
  const cancelRef = useRef(onCancel);
  useEffect(() => {
    cancelRef.current = onCancel;
  }, [onCancel]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      e.preventDefault();
      cancelRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    confirmRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={plan.title}
    >
      {/* 遮罩：点空白处 = 取消。它自己也是一颗按钮，「点了没反应」永远不会发生。 */}
      <button
        type="button"
        onClick={onCancel}
        title={plan.cancelText}
        aria-label={plan.cancelText}
        className="absolute inset-0 cursor-default bg-black/35 backdrop-blur-[1px]"
      />

      <div className="relative w-full max-w-[340px] rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] p-3 shadow-xl">
        <div className="flex items-start gap-1.5">
          {/* 琥珀而非红：带电操作是「流程没走对」，不是元件已经坏了，别用故障色吓人。 */}
          <AlertTriangle className="mt-px h-4 w-4 shrink-0 text-amber-700 [html.dark_&]:text-amber-400" />
          <span className="min-w-0 text-xs leading-[15px] font-semibold text-[var(--fg)]">{plan.title}</span>
        </div>

        <p className="mt-1.5 text-[11px] leading-[16px] text-[var(--fg)]">{plan.text}</p>

        {/* 「合闸即再坏」的隐患：弹窗盖住了看板红条，这句话只能由这张卡自己说。 */}
        {plan.hint && (
          <p className="mt-1.5 rounded-lg border border-red-500/25 bg-red-500/10 px-1.5 py-1 text-[10px] leading-[15px] text-red-700 [html.dark_&]:text-red-400">
            {plan.hint}
          </p>
        )}

        <div className="mt-2.5 flex items-center gap-1.5">
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className="compact flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-[var(--danger)] px-2 text-xs leading-none font-medium text-white transition-opacity hover:opacity-90"
          >
            <PowerOff className="h-3.5 w-3.5 shrink-0" />
            <span className="whitespace-nowrap">{plan.confirmText}</span>
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="compact flex h-8 shrink-0 items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 text-xs leading-none text-[var(--fg)] transition-colors hover:bg-[var(--accent-light)]"
          >
            <X className="h-3.5 w-3.5 shrink-0" />
            <span className="whitespace-nowrap">{plan.cancelText}</span>
          </button>
        </div>

        <p className="mt-1.5 text-[10px] leading-[14px] text-[var(--muted)]">
          {zh
            ? '按规范操作不会损坏元件；若电路确实还需要通电，换好后重新合上开关即可。'
            : 'Following the procedure keeps the parts safe — close the switch again when you are done.'}
        </p>
      </div>
    </div>
  );
}

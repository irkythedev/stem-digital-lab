/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * AI 面板外置子面板的共享件（P0 拆分产物）。
 * 只放「被两个以上面板同时需要」的东西，避免面板之间互相 import 或反向依赖 AiAssistant。
 */
import { Check, X } from 'lucide-react';
import { useMemo, useRef } from 'react';

/**
 * 行内对错标记：面板统一用 Lucide 图标，不再用对勾 / 叉号的文本符号。
 * 正确沿用所在段落的常规色（或 accent），错误固定用 --error；对齐用 align-[-2px] 压到基线。
 * （从 AiAssistant.tsx 原样搬移，行为与 className 一字未改）
 */
export function Mark({ ok, className = '' }: { ok: boolean; className?: string }) {
  const Icon = ok ? Check : X;
  return (
    <Icon
      className={`inline-block h-3.5 w-3.5 align-[-2px] ${ok ? '' : 'text-[var(--error)]'} ${className}`}
      aria-hidden="true"
    />
  );
}

/**
 * 稳定化「动作域对象」：对象身份恒定，属性每次访问都取最新一次渲染的函数。
 *
 * 为什么需要：本文件的处理器都是每次渲染新建的闭包。若把它们直接塞进 props 对象再交给 React.memo，
 * 父组件任何一次无关 setState 都会让对象身份变化 → memo 被击穿，面板白拆。
 * 若改用 useMemo 空依赖缓存，则会捕获旧闭包 → 读到过期 state（保存旧配置、提交旧答案）。
 *
 * 两者都要的解法就是「最新值 ref + 固定身份代理」：
 *   - 身份恒定 → memo 生效，面板只在它真正读到的 state 变化时重渲；
 *   - 访问即取最新 → 语义与拆分前完全一致，不存在过期闭包。
 * 读多写少（点击回调、渲染期取值）场景开销可忽略。
 */
export function useStable<T extends object>(factory: () => T): T {
  const latest = useRef<T | null>(null);
  latest.current = factory();
  return useMemo(
    () =>
      new Proxy({} as T, {
        get: (_t, key) => (latest.current as T)[key as keyof T],
        has: (_t, key) => key in (latest.current as object),
        ownKeys: () => Reflect.ownKeys(latest.current as object),
        getOwnPropertyDescriptor: (_t, key) => ({
          configurable: true,
          enumerable: true,
          value: (latest.current as T)[key as keyof T],
        }),
      }),
    [],
  );
}

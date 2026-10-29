/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 顶层错误边界：懒加载页面 chunk 缺失、渲染异常时不再留下整页空白。
 * 只负责把错误换成可读提示与「重新加载」按钮；是否自动刷新由
 * `installPreloadRecovery()` 根据在线状态与冷却时间决定。
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useApp } from '../lib/app-context';

interface Props {
  children: ReactNode;
  /** 变化时清除错误状态：某一页加载失败后，导航到其他页面不应被锁死在提示页。 */
  resetKey?: string;
}

interface State {
  error: Error | null;
}

function AppErrorFallback() {
  const { t, isOffline } = useApp();
  return (
    <div
      role="alert"
      className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center"
    >
      <h1 className="t-h2 serif-font font-medium text-[var(--fg)]">{t.appShell.errorTitle}</h1>
      <p className="max-w-md text-sm leading-relaxed text-[var(--muted)]">
        {isOffline ? t.appShell.errorOffline : t.appShell.errorBody}
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-1 rounded-md border border-[var(--border)] bg-[var(--card-bg)] px-4 py-2 text-sm font-medium text-[var(--fg)] transition-colors hover:border-[var(--fg)]"
      >
        {t.appShell.reload}
      </button>
    </div>
  );
}

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // 生产环境没有错误上报服务，至少把上下文留在控制台便于排查。
    console.error('[app] 页面渲染失败', error, info.componentStack);
  }

  componentDidUpdate(prevProps: Props): void {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render(): ReactNode {
    return this.state.error ? <AppErrorFallback /> : this.props.children;
  }
}

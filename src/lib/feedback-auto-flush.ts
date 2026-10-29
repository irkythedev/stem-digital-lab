/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 反馈队列的自动补传触发：断网时提交的反馈先落在 localStorage，网络恢复
 * 或用户回到页面时再补发。此前只有「重新打开页面」会补传，移动端把页面
 * 挂在后台再切回来时队列会一直卡着，用户以为反馈丢了。
 *
 * 触发条件刻意收窄：
 *   - `online`：设备重新联网，页面是否可见都补传；
 *   - `visibilitychange`：仅当页面变为可见且在线时补传，避免后台白白唤醒。
 *
 * 去重仍由 `flushFeedbackQueue()` 内部的 `flushing` 保证；这里只负责接线。
 */
import { flushFeedbackQueue } from './feedback';

export interface FeedbackAutoFlushTarget {
  addEventListener: (type: string, listener: EventListener) => void;
  removeEventListener: (type: string, listener: EventListener) => void;
}

export interface FeedbackAutoFlushOptions {
  /** 默认读 navigator.onLine；测试可注入。 */
  isOnline?: () => boolean;
  /** 默认读 document.visibilityState；测试可注入。 */
  visibilityState?: () => string;
  /** 默认使用真实的 flushFeedbackQueue；测试可注入。 */
  flush?: () => void | Promise<void>;
}

/**
 * 安装自动补传监听，返回卸载函数（组件卸载时必须调用，避免重复监听）。
 */
export function installFeedbackAutoFlush(
  target: FeedbackAutoFlushTarget,
  options: FeedbackAutoFlushOptions = {},
): () => void {
  const isOnline = options.isOnline
    ?? (() => typeof navigator === 'undefined' || navigator.onLine !== false);
  const visibilityState = options.visibilityState
    ?? (() => (typeof document === 'undefined' ? 'visible' : document.visibilityState));
  const flush = options.flush ?? flushFeedbackQueue;

  const run = () => {
    try {
      const result = flush();
      // 补传失败会由队列自己的重试上限兜底；这里只防止未处理的 rejection。
      void Promise.resolve(result).catch(() => {});
    } catch {
      // 网络/存储异常不应打断页面交互。
    }
  };

  const onOnline: EventListener = () => {
    if (isOnline()) run();
  };
  const onVisibilityChange: EventListener = () => {
    if (isOnline() && visibilityState() === 'visible') run();
  };

  target.addEventListener('online', onOnline);
  target.addEventListener('visibilitychange', onVisibilityChange);
  return () => {
    target.removeEventListener('online', onOnline);
    target.removeEventListener('visibilitychange', onVisibilityChange);
  };
}

/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 假 `window.localStorage` 夹具。
 *
 * 为什么需要它：AI 问答历史、考考你历史、反馈队列、存储用量四个套件各抄了一份
 * `installMockWindow()` / `restoreWindow()`，且都不支持「写入抛错」——
 * 于是三处 quota 重试分支（`saveHistory` / `saveQuizHistory` / `saveFeedback`）
 * 从未被执行过。本夹具把三种真实故障都变成一行参数：
 *
 *   - 正常读写：`installStorage()`
 *   - 脏数据：  `installStorage({ 'stem-ai-history': '{"broken":' })`
 *   - 配额耗尽：`installStorage({}, { failOnWrite: [1] })` → 第 1 次 setItem 抛 QuotaExceededError
 *
 * 使用后**必须** `restore()`（建议 `try/finally`），否则假 window 会泄漏到后续用例。
 */
export interface FakeStorage {
  /** 底层键值表，便于直接检查落盘内容。 */
  readonly mem: Map<string, string>;
  /** 已发生的 `setItem` 次数（含失败的那次），用于验证重试路径。 */
  readonly writeCount: number;
  /** 还原 `globalThis.window`（恢复到安装前的状态）。 */
  restore(): void;
}

export interface StorageOptions {
  /** 第 n 次（从 1 开始）`setItem` 抛 QuotaExceededError，用于验证「丢最旧再试」。 */
  failOnWrite?: readonly number[];
}

/** 安装假 localStorage，返回句柄与还原函数。 */
export function installStorage(
  seed: Record<string, string> = {},
  options: StorageOptions = {},
): FakeStorage {
  const mem = new Map(Object.entries(seed));
  const failing = new Set(options.failOnWrite ?? []);
  const scope = globalThis as { window?: unknown };
  const hadWindow = 'window' in scope;
  const previousWindow = scope.window;
  let writes = 0;

  scope.window = {
    localStorage: {
      get length(): number {
        return mem.size;
      },
      key: (index: number): string | null => [...mem.keys()][index] ?? null,
      getItem: (key: string): string | null => (mem.has(key) ? (mem.get(key) as string) : null),
      setItem: (key: string, value: string): void => {
        writes += 1;
        if (failing.has(writes)) {
          const err = new Error(`quota exceeded（第 ${writes} 次写入）`);
          err.name = 'QuotaExceededError';
          throw err;
        }
        mem.set(key, value);
      },
      removeItem: (key: string): void => {
        mem.delete(key);
      },
    },
  };

  return {
    mem,
    get writeCount(): number {
      return writes;
    },
    restore(): void {
      if (hadWindow) scope.window = previousWindow;
      else delete scope.window;
    },
  };
}

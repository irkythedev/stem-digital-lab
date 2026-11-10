/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 测试入口样板（测试基础设施，**不含任何用例**）。
 *
 * 为什么需要它：44 个 `*.entry.test.ts` 的尾部逐字相同（登记 → runAll → 传递退出码），
 * 每个入口还要重复一遍「本进程只导入一次 harness、只调用一次 runAll」的散文注释。
 * 收敛成一次 `await runEntry({ suite, register })` 后，入口只剩 3~4 行，
 * 且「套件名不能为空」这类约束有了唯一执行点。
 *
 * 约定（与 harness 的注册期契约一致）：
 *   - 本模块只在入口顶层被调用一次；`runAll()` 只能调用一次，重复调用由 harness 报错；
 *   - 用例与断言全部留在注册模块（未来的 `*.suite.ts`），入口不写业务逻辑；
 *   - 套件名在**同一进程内**唯一：两个入口被同时 import 时会被拒绝。
 *     跨进程的唯一性（不同 entry 各自起进程）无法在运行期检测，需由后续的
 *     汇总守卫脚本负责——本文件不做假装有效的检查。
 */
import { pathToFileURL } from 'node:url';

import { describe, runAll, test, type TestFn } from './harness';

export interface EntrySpec {
  /** 套件名，格式 `<域> · <主题>` 或 `<Domain> — <Subject>`，不得为空。 */
  suite: string;
  /** 注册函数，来自对应的注册模块；需要 `skip` 的套件用箭头包一层即可。 */
  register: (test: TestFn) => void;
}

/** 同一进程内已使用的套件名，用于拒绝重复登记。 */
const usedSuites = new Set<string>();

/**
 * 入口唯一职责：登记 → 执行 → 传递退出码。
 *
 * 退出码非 0 时直接 `process.exit`，与既有入口的行为完全一致；
 * 正常结束则返回，由调用方的顶层 await 自然收尾。
 */
export async function runEntry({ suite, register }: EntrySpec): Promise<void> {
  const name = suite.trim();
  if (!name) throw new Error('runEntry: suite 不得为空');

  if (usedSuites.has(name)) {
    throw new Error(
      `runEntry: 套件名「${name}」在本进程内重复登记。` +
        '同一入口只应登记一个套件；拆分套件时请为每部分取唯一名称。',
    );
  }
  usedSuites.add(name);

  describe(name, () => register(test));

  const summary = await runAll();
  if (summary.exitCode !== 0) process.exit(summary.exitCode);
}

/**
 * 注册模块被直接 `tsx` 调用时显式失败。
 *
 * 注册模块只导出 `registerXxxTests()`，直接运行只会求值模块：零用例、退出码 0，
 * 看起来「通过」，实际什么都没跑。这里把这种假绿变成明确失败。
 *
 * @param metaUrl 调用方的 `import.meta.url`
 * @param fileName 调用方文件名，用于错误提示
 */
export function assertRegistrationModule(metaUrl: string, fileName: string): void {
  const invoked = process.argv[1];
  if (!invoked) return;
  if (pathToFileURL(invoked).href !== metaUrl) return;

  console.error(
    `${fileName} 是注册模块，不是测试入口：它只导出 registerXxxTests()。\n` +
      '请运行对应的 *.test.ts 入口（或 `npm test`）。',
  );
  process.exit(1);
}

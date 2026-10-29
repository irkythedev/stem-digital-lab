/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 数学模块源码守卫（注册模块，不含执行入口）。
 *
 * 迁移来源：`src/smoke.test.ts` 的 `数学模块数值稳定性与题库守卫` 套件。
 * 断言、错误消息、扫描文件集合、执行顺序与迁移前**逐字相同**；唯一差别是
 * 读文件的路径基准——原来由 `process.cwd()` 决定，现在由 `repoPath()` 从
 * 本文件位置推导仓库根（见 `./repo-paths.ts`）。
 *
 * 为什么注册模块放在 `src/testing/` 而不是 `src/labs/math/`（**已实测**）：
 * smoke 里的「全站界面零 ✓/✗ 判分字形」守卫会递归扫描 `src/{pages,components,labs,lib}`
 * 下所有 `.ts/.tsx/.css`，命中即失败。本模块为了保留原有正则与消息，必须原样带着
 * `✓`/`✗` 两个字符；放进 `src/labs/` 会被那条守卫判红（实测：临时投放一个含 `✓`
 * 的探针文件到 `src/labs/math/`，该守卫立刻报 `以下文件仍含 ✓/✗ 字形：…`）。
 * `src/testing/` 不在扫描目录内，因此可以逐字保留原代码。
 *
 * 本模块不导入 smoke.test.ts，也不导入 harness 的具体实现，只接收注入的 `test`。
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import type { TestFn } from './harness';
import { repoPath } from './repo-paths';

export function registerMathSourceGuardsTests(test: TestFn): void {
  // 与原 smoke 中的 `read` 同签名：参数仍是仓库相对路径，错误消息里也仍是相对路径，
  // 只有真正落盘读取时才换成绝对路径。
  const read = (path: string) => readFileSync(repoPath(path), 'utf8');

  test('数学模块零 ✓/✗ 判分字形（统一 Lucide Check / X）', () => {
    for (const f of ['src/labs/math/Circle.tsx', 'src/labs/math/Inverse.tsx', 'src/labs/math/Linear.tsx',
      'src/labs/math/Quadratic.tsx', 'src/components/lab/InteractiveCircle.tsx']) {
      const src = read(f);
      assert.doesNotMatch(src, /[✓✗]/, `${f} 仍有 ✓/✗ 字形`);
    }
    // 四个判分实验都使用 Lucide 图标常量
    for (const f of ['Circle', 'Inverse', 'Linear', 'Quadratic']) {
      const src = read(`src/labs/math/${f}.tsx`);
      assert.match(src, /from 'lucide-react'/, `${f} 未引入 Lucide`);
    }
  });
}

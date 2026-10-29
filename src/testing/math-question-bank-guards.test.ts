/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 数学题库注册表守卫（注册模块，不含执行入口）。
 *
 * 迁移来源：`src/smoke.test.ts` 的 `数学模块数值稳定性与题库守卫` 套件。
 * 用例名、断言、正则、错误消息、文件列表、循环边界与迁移前**逐字相同**；
 * 唯一差别是读文件的路径基准——原来由 `process.cwd()` 决定，现在由
 * `repoPath()` 从本文件位置推导仓库根（见 `./repo-paths.ts`）。
 *
 * 这里保留的题库约束（迁移时一条未改）：
 *   - 四个判分实验都导出 OPTIONS 与 QUIZ_CORRECT，且题键集合一致；
 *   - 每题至少 2 个选项，选项值与文案键都非空，选项值不重复；
 *   - 每个正解都必须落在该题的选项值域内（否则永远判不对）；
 *   - 组件内必须引用注册表，不得另存一份判分表；
 *   - 判分题总数恰为 15；
 *   - 正解位置不得扎堆：任一位置占比 ≤ 45%，且三个位置都被用到。
 *
 * 本模块不导入 smoke.test.ts，也不导入 harness 的具体实现，只接收注入的 `test`。
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import type { TestFn } from './harness';
import { repoPath } from './repo-paths';

export function registerMathQuestionBankGuardsTests(test: TestFn): void {
  // 与原 smoke 中的 `read` 同签名：参数仍是仓库相对路径，错误消息里也仍是相对路径，
  // 只有真正落盘读取时才换成绝对路径。
  const read = (path: string) => readFileSync(repoPath(path), 'utf8');

  test('题库注册表：值与文案键成对、正解在值域内、渲染顺序与注册表一致', () => {
    const files = ['Circle', 'Inverse', 'Linear', 'Quadratic'];
    const all: { file: string; key: string; vals: string[]; correct: string[] }[] = [];
    for (const f of files) {
      const src = read(`src/labs/math/${f}.tsx`);
      const optsBlock = src.match(/export const OPTIONS = \{\n([\s\S]*?)\n\} as const;/);
      const corrBlock = src.match(/export const QUIZ_CORRECT: Record<string, string\[\]> = \{\n([\s\S]*?)\n\};/);
      assert.ok(optsBlock && corrBlock, `${f} 缺 OPTIONS / QUIZ_CORRECT 导出`);
      const opts = Object.fromEntries(
        Array.from(optsBlock![1].matchAll(/(\w+): \[((?:\[[^\]]*\],?\s*)+)\]/g)).map((m) => [
          m[1],
          Array.from(m[2].matchAll(/\['([^']+)', '([^']+)'\]/g)).map((x) => [x[1], x[2]]),
        ]),
      );
      const corr = Object.fromEntries(
        Array.from(corrBlock![1].matchAll(/(\w+): \[([^\]]*)\]/g)).map((m) => [m[1], Array.from(m[2].matchAll(/'([^']+)'/g)).map((x) => x[1])]),
      );
      assert.deepStrictEqual(Object.keys(opts).sort(), Object.keys(corr).sort(), `${f} 题键不一致`);
      for (const [k, pairs] of Object.entries(opts)) {
        assert.ok(pairs.length >= 2, `${f}.${k} 选项不足`);
        for (const [v, label] of pairs) {
          assert.ok(v.length > 0 && label.length > 0, `${f}.${k} 存在空值/空文案键`);
        }
        assert.strictEqual(new Set(pairs.map((p) => p[0])).size, pairs.length, `${f}.${k} 选项值重复`);
        for (const c of corr[k]) {
          assert.ok(pairs.some((p) => p[0] === c), `${f}.${k} 正确值 ${c} 不在选项值域内（永远判不对）`);
        }
        all.push({ file: f, key: k, vals: pairs.map((p) => p[0]), correct: corr[k] });
      }
      // 判分表必须只此一处（组件内引用注册表）
      assert.match(src, /const correctKeys = QUIZ_CORRECT;|QUIZ_CORRECT\[key\]/, `${f} 组件未引用注册表`);
    }
    // 位置均衡：正解不得扎堆在同一项
    const hist: Record<number, number> = {};
    for (const q of all) hist[q.vals.indexOf(q.correct[0])] = (hist[q.vals.indexOf(q.correct[0])] || 0) + 1;
    const total = all.length;
    assert.strictEqual(total, 15, `判分题总数应为 15，实为 ${total}`);
    for (const [pos, n] of Object.entries(hist)) {
      assert.ok(n / total <= 0.45, `位置 ${pos} 正解占比 ${(100 * n / total).toFixed(1)}% 超过 45%（位置偏见）`);
    }
    assert.strictEqual(Object.keys(hist).length, 3, '三个位置都应被用到');
  });
}

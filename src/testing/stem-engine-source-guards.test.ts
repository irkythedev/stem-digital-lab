/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学门面（`stem-engine.ts`）的源码守卫（注册模块，不含执行入口）。
 *
 * 迁移来源：`src/smoke.test.ts` 的 `Physics 电学门面（应用真实调用点）：边界兜底与采样口径` 套件。
 * 用例名、断言、正则、错误消息、读取文件与迁移前**逐字相同**；唯一差别是读文件的
 * 路径基准——原来由 `process.cwd()` 决定，现在由 `repoPath()` 从本文件位置推导仓库根
 * （见 `./repo-paths.ts`）。
 *
 * 为什么只迁这一个用例、而不是整个套件：同套件另外 3 个用例（`sampleOhm` / `currentOf` /
 * `imageV` 门面）依赖 `stem-engine.ts` 的**模块级可变状态**——`engineKind` 与 `impl*`
 * 函数指针在 `loadOhmEngine()` 成功后整体切到 WASM，而 smoke 里有 `setup()` 会先加载引擎。
 * 独立进程里没有那次加载，走的实现与 smoke 中不同，属于语义改变，故不迁。
 * 本用例只读源码文本，与引擎状态无关。
 *
 * 守卫的内容（迁移时一条未改）：
 *   - `currentOf` 必须有 NaN→0 兜底；
 *   - `imageV` 必须把非有限值归一为 null；
 *   - 门面采样不得用浮点累加（先剥注释再判断）；
 *   - 门面采样须用索引乘法循环；
 *   - 头注释必须警示「只改 TS core 对应用无效」这个坑。
 *
 * 本模块不导入 smoke.test.ts，也不导入 harness 的具体实现，只接收注入的 `test`。
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import type { TestFn } from './harness';
import { repoPath } from './repo-paths';

export function registerStemEngineSourceGuardsTests(test: TestFn): void {
  // 与原 smoke 中的写法同签名：参数仍是仓库相对路径，错误消息里的文件标识也不变。
  const read = (path: string) => readFileSync(repoPath(path), 'utf8');

  test('门面源码守卫：NaN 兜底 + 非有限归一 + 索引乘法循环 + 头注释警示', () => {
    const fe = read('src/labs/physics/stem-engine.ts');
    assert.match(fe, /return Number\.isNaN\(v\) \? 0 : v;/, 'currentOf 缺少 NaN→0 兜底');
    assert.match(fe, /Number\.isFinite\(v\) \? v : null/, 'imageV 缺少非有限→null 归一');
    assert.ok(!/u \+= 0\.1/.test(fe.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')), '门面采样又用累加');
    assert.match(fe, /for \(let k = 0; k \* 0\.1 <= 12\.0001; k\+\+\)/, '门面采样须用索引乘法');
    assert.ok(fe.includes('只改 TS core 对应用无效'), '头注释须警示「改了 core 但应用仍 NaN」这个坑');
  });
}

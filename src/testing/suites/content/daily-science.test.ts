/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 「每日科学」数据契约与编排逻辑守卫的独立入口：只做「登记 → 执行 → 传递退出码」。
 * 用例与断言全部在 `./daily-science.suite.ts`（注册模块）。
 * 不导入 smoke.test.ts，不做引擎初始化，也不依赖任何其他测试先执行。
 *
 * 路径基准：注册模块从自身位置导入数据与纯函数，不依赖 `process.cwd()`，
 * 因此本入口从仓库根与 `/tmp` 启动结果一致。
 *
 * 运行：npx tsx src/testing/suites/content/daily-science.test.ts
 */
import { runEntry } from '../../run-entry';
import { registerDailyScienceTests } from './daily-science.suite';

await runEntry({
  suite: '每日科学 · 数据契约与洗牌编排',
  register: registerDailyScienceTests,
});

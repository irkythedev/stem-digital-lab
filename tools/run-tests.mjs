#!/usr/bin/env node
/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 测试链运行器 + 统计聚合器。
 *
 * 为什么要这一层：`npm test` 原本是 39 条命令的 `&&` 链，人工能看懂，但**没有任何地方
 * 汇总"到底通过多少用例"**。README 因此只能靠手写数字，改一次用例就得手改四处，
 * 漏一处就是"三处一起错"（实测发生过：README 写 627，真实 604）。
 *
 * 本脚本做的事很窄：
 *   1. 从 `package.json` 的 `scripts["test:chain"]` 读链条（仍是原来的 `&&` 串，可读可审）；
 *   2. 按原顺序逐条执行，**任一条非零退出立刻停止并原样传递退出码**（保持 `&&` 语义）；
 *   3. 把每段 harness 已经打印的 `Results: N passed, M failed, K skipped` 汇总，
 *      写入 `node_modules/.cache/test-stats.json`（构建产物，不入库）；
 *   4. 结尾打印一行汇总，供 `tools/check-readme-stats.mjs` 与人工核对。
 *
 * 不引入任何第三方依赖，也不改写既有测试的输入输出——只是把 `&&` 换成"能记账的 `&&`"。
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STATS_DIR = join(ROOT, 'node_modules', '.cache');
const STATS_FILE = join(STATS_DIR, 'test-stats.json');

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const raw = pkg.scripts?.['test:chain'];
if (!raw) {
  console.error('✗ package.json 缺少 scripts["test:chain"]（测试链定义）');
  process.exit(2);
}

const chain = raw
  .split(' && ')
  .map((s) => s.trim())
  .filter(Boolean);
if (chain.length === 0) {
  console.error('✗ scripts["test:chain"] 为空');
  process.exit(2);
}

/** 解析一段输出里最后的 `Results:` 行（每个脚本只应有一条）。 */
const RESULTS = /^Results: (\d+) passed, (\d+) failed(?:, (\d+) skipped)?/gm;

const records = [];
let passed = 0;
let failed = 0;
let skipped = 0;
let withResults = 0;

const writeStats = (extra = {}) => {
  mkdirSync(STATS_DIR, { recursive: true });
  const stats = {
    generatedAt: new Date().toISOString(),
    node: process.version,
    commands: chain.length,
    commandsWithResults: withResults,
    passed,
    failed,
    skipped,
    records,
    ...extra,
  };
  writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2) + '\n', 'utf8');
  return stats;
};

console.log(`测试链：${chain.length} 条命令（来自 package.json scripts["test:chain"]）`);

for (const [i, cmd] of chain.entries()) {
  const target = /([^\s]+\.ts)\s*$/.exec(cmd)?.[1] ?? cmd;
  console.log(`\n[${i + 1}/${chain.length}] ${cmd}`);

  const r = spawnSync(cmd, { cwd: ROOT, shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);

  const code = r.status ?? 1;
  const matches = [...(r.stdout ?? '').matchAll(RESULTS)];
  const last = matches.at(-1);
  const rec = { command: cmd, target, exitCode: code };
  if (last) {
    withResults += 1;
    rec.passed = Number(last[1]);
    rec.failed = Number(last[2]);
    rec.skipped = Number(last[3] ?? 0);
    passed += rec.passed;
    failed += rec.failed;
    skipped += rec.skipped;
  }
  records.push(rec);

  if (code !== 0) {
    writeStats({ abortedAt: i + 1 });
    console.error(`\n✗ 第 ${i + 1} 条命令失败（退出码 ${code}），链已停止：${cmd}`);
    process.exit(code);
  }
}

writeStats();
console.log(
  `\n=== 汇总：${chain.length} 条命令 / ${withResults} 条产出 Results ｜ ` +
    `通过 ${passed} ｜ 失败 ${failed} ｜ 跳过 ${skipped} ===`,
);
console.log(`统计已写入 ${STATS_FILE}`);
console.log('README 数字与实测的比对由 tools/check-readme-stats.mjs 完成。');

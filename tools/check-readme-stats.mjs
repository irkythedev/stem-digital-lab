#!/usr/bin/env node
/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * README 测试数 ↔ 实测统计的比对器（`npm test` 的最后一步）。
 *
 * 背景：README 里的测试数原本只能靠"三处彼此一致"来保护，于是三处一起写错也无从发现
 * （实测发生过：写 627、真实 604）。`src/smoke.test.ts` 里的同名守卫仍负责"五处互相一致"
 * ——它必须能在单文件内快速失败；而"与实测一致"只能在整条链跑完之后判断，
 * 所以放在这里，读 `tools/run-tests.mjs` 落盘的 `test-stats.json`。
 *
 * 三个概念分开校验，互不冒充：
 *   - **测试命令数**：39 条（`scripts["test:chain"]` 的长度）
 *   - **通过用例数**：604 条（各段 `Results:` 的 passed 之和）
 *   - **golden 快照数**：436 条（109 输入 × 4 配置，独立脚本、不计入通过用例数）
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STATS_FILE = join(ROOT, 'node_modules', '.cache', 'test-stats.json');

let stats;
try {
  stats = JSON.parse(readFileSync(STATS_FILE, 'utf8'));
} catch {
  console.error(`✗ 读不到测试统计：${STATS_FILE}`);
  console.error('  请先跑 tools/run-tests.mjs（npm test 的第一段），它会落盘统计。');
  process.exit(2);
}

const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');

/** 每个数字都必须能取到：缺了就说明文案改了形状，守卫不能装作通过。 */
const SLOTS = [
  ['首屏徽章', /Tests-(\d+)%20passed/, (m) => m[1]],
  ['三栏表', /(\d+) 项单测门禁/, (m) => m[1]],
  ['口径注释', /(\d+) passed\s+←\s+npm test 实测/, (m) => m[1]],
  ['中文正文', /\*\*(\d+) 项全绿\*\*/, (m) => m[1]],
  ['English body', /\*\*(\d+) assertions, all green\*\*|\*\*(\d+) cases, all green\*\*/, (m) => m[1] ?? m[2]],
];

const problems = [];
const seen = new Map();

for (const [label, re, pick] of SLOTS) {
  const m = re.exec(readme);
  if (!m) {
    problems.push(`${label}：取不到测试数（正则 ${re} 未命中）`);
    continue;
  }
  const n = Number(pick(m));
  seen.set(label, n);
  if (n !== stats.passed) {
    problems.push(`${label}：README 写 ${n}，实测通过 ${stats.passed}`);
  }
}

// 命令数：README 若声明了"39 条测试命令"，必须与链条长度一致
const cmdClaim = /(\d+) 条测试命令/.exec(readme);
if (cmdClaim) {
  const n = Number(cmdClaim[1]);
  if (n !== stats.commands) problems.push(`命令数：README 写 ${n} 条，实际链条 ${stats.commands} 条`);
} else {
  problems.push('命令数：README 未声明"N 条测试命令"（口径必须显式写清，否则三者易混）');
}

// golden 快照：声明了就必须与实际输出一致（436 = 109 × 4）
const snapClaim = /(\d+) 条逐字快照/.exec(readme);
if (snapClaim) {
  const n = Number(snapClaim[1]);
  if (n !== 436) problems.push(`golden 快照：README 写 ${n} 条，实际 436 条（109 输入 × 4 配置）`);
}

if (stats.failed !== 0) problems.push(`本段统计里已有 ${stats.failed} 条失败用例，README 数字无意义`);

const distinct = new Set(seen.values());
if (distinct.size > 1) {
  problems.push(`README 内部不一致：${[...seen.entries()].map(([k, v]) => `${k}=${v}`).join(' / ')}`);
}

if (problems.length) {
  console.error('\n✗ README 测试数与实测不一致：');
  for (const p of problems) console.error(`  - ${p}`);
  console.error(`\n实测：${stats.commands} 条命令 / ${stats.commandsWithResults} 条产出 Results / 通过 ${stats.passed} / 失败 ${stats.failed} / 跳过 ${stats.skipped}`);
  console.error('改 README 的 5 处数字后重跑 npm test。');
  process.exit(1);
}

console.log(
  `✓ README 测试数与实测一致：${stats.passed} 条通过用例 / ${stats.commands} 条命令 / ` +
    `golden ${snapClaim ? snapClaim[1] : '436'} 条快照（5 处数字均已核对）`,
);

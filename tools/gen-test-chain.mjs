#!/usr/bin/env node
/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * test:chain 生成器。
 *
 * 为什么要有这层：`test:chain` 原先靠手写 `&&` 串维护，新增一个入口就要在超长单行里
 * 找位置、补命令；漏一条不会报错，只会让那个套件静默地不参与 `npm test`。这里把
 * 「哪些文件可独立运行」变成一条可执行的约定，生成结果只写回 package.json 的
 * `scripts["test:chain"]`，其余字段一律不重排（避免整份 JSON 被重格式化）。
 *
 * 可运行入口的约定（按输出顺序）：
 *   1. 固定入口（顺序固定，不受排序影响）：
 *        - src/testing/harness.test.ts     测试框架自身的契约
 *        - src/testing/repo-paths.test.ts  路径基准
 *        - src/smoke.test.ts               主冒烟
 *        - src/stem-core-ext.test.ts       求解核扩展
 *        - src/latex-speech.golden.test.ts 逐字快照
 *   2. 独立入口：`src/**\/*.entry.test.ts`，按仓库相对路径升序；
 *   3. 套件入口：`src/testing/suites/**\/*.test.ts`，按仓库相对路径升序。
 *
 * 明确排除：`src/testing/review-process.entry.test.ts` 属内网评审流程，公网树没有
 * 该文件，进链会让公网 `npm test` 当场断链；它单独走 `npm run test:review`。
 *
 * 每个被归类为 entry/suite 的文件必须已改用 `runEntry(`（第 4 步收敛后的统一入口），
 * 否则生成器直接报错，避免把「只导出 register 的注册模块」误当成可运行入口。
 *
 * 用法：
 *   node tools/gen-test-chain.mjs          写回 package.json
 *   node tools/gen-test-chain.mjs --check  只校验，不写入（有差异时退出码 1）
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const PKG_PATH = join(ROOT, 'package.json');

/** 固定入口：顺序即执行顺序，不参与字母排序。 */
const FIXED_ENTRIES = [
  'src/testing/harness.test.ts',
  'src/testing/repo-paths.test.ts',
  'src/smoke.test.ts',
  'src/stem-core-ext.test.ts',
  'src/latex-speech.golden.test.ts',
];

/** 内网专用入口：不进 test:chain（公网树缺文件会断链）。 */
const EXCLUDED_ENTRIES = new Map([
  [
    'src/testing/review-process.entry.test.ts',
    '内网评审流程专用，走 npm run test:review',
  ],
]);

const toPosix = (abs) => relative(ROOT, abs).split(sep).join('/');

/** 稳定排序：按字节序比较路径，不用 localeCompare（后者受运行环境影响）。 */
const byPath = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const abs = join(dir, entry.name);
    return entry.isDirectory() ? walk(abs) : [toPosix(abs)];
  });
}

function collect() {
  const testFiles = walk(SRC)
    .filter((file) => file.endsWith('.test.ts'))
    .sort(byPath);

  const suites = testFiles.filter((file) => file.startsWith('src/testing/suites/'));
  const entries = testFiles.filter(
    (file) =>
      file.endsWith('.entry.test.ts') &&
      !file.startsWith('src/testing/suites/') &&
      !EXCLUDED_ENTRIES.has(file),
  );

  for (const file of FIXED_ENTRIES) {
    if (!existsSync(join(ROOT, file))) {
      throw new Error(`固定入口不存在：${file}`);
    }
  }

  for (const file of [...entries, ...suites]) {
    const source = readFileSync(join(ROOT, file), 'utf8');
    if (!source.includes('runEntry(')) {
      throw new Error(
        `${file} 被识别为可运行入口，但没有调用 runEntry()。` +
          '若它只是注册模块，请改为 *.test.ts 之外的命名，或从扫描规则中排除。',
      );
    }
  }

  const ordered = [...FIXED_ENTRIES, ...entries, ...suites];
  const seen = new Set();
  for (const file of ordered) {
    if (seen.has(file)) throw new Error(`同一条命令被重复收集：${file}`);
    seen.add(file);
  }

  return { ordered, entries, suites };
}

function buildChain(ordered) {
  return ordered.map((file) => `npx tsx ${file}`).join(' && ');
}

function writeChain(chain) {
  const raw = readFileSync(PKG_PATH, 'utf8');
  const pkg = JSON.parse(raw);
  const previous = pkg.scripts?.['test:chain'];

  // 只替换 test:chain 这一个字符串字面量，保留 package.json 其余排版（含行内对象）。
  if (typeof previous !== 'string') {
    throw new Error('package.json 缺少 scripts["test:chain"]，无法确定插入位置');
  }
  const from = JSON.stringify(previous);
  const to = JSON.stringify(chain);
  if (raw.split(from).length !== 2) {
    throw new Error('package.json 中 test:chain 的字面量不唯一，拒绝写入');
  }
  const next = raw.replace(from, to);
  JSON.parse(next); // 写前自检：替换后仍是合法 JSON
  writeFileSync(PKG_PATH, next);
}

function main() {
  const check = process.argv.includes('--check');
  const { ordered, entries, suites } = collect();
  const chain = buildChain(ordered);

  if (check) {
    const current = JSON.parse(readFileSync(PKG_PATH, 'utf8')).scripts?.['test:chain'];
    if (current !== chain) {
      console.error('✗ test:chain 与生成结果不一致，请运行：npm run gen:chain');
      console.error(`  当前 ${String(current ?? '').split(' && ').length} 条，应为 ${ordered.length} 条`);
      process.exitCode = 1;
      return;
    }
    console.log(`✓ test:chain 已是最新：${ordered.length} 条命令`);
    return;
  }

  writeChain(chain);
  console.log(
    `✓ test:chain 已生成：${ordered.length} 条命令` +
      `（固定入口 ${FIXED_ENTRIES.length} + entry ${entries.length} + suites ${suites.length}）`,
  );
  for (const [file, reason] of EXCLUDED_ENTRIES) {
    console.log(`  ⊘ ${file}：${reason}`);
  }
}

main();

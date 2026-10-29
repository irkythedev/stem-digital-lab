/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * `src/testing/repo-paths.ts` 的契约测试（batch-5 为「越界拒绝」这条最小加固补的针对性测试）。
 *
 * 为什么单独一个文件、且是独立脚本而不是注册模块：
 * 它是**测试基础设施**的契约，与 `harness.test.ts` 同类，不属于任何业务套件；
 * 用 harness 注册反而会让它混进业务用例集合，模糊「迁移前后集合守恒」的对照。
 *
 * 锁定的契约：
 *   1. `REPO_ROOT` 由模块位置推导，且确实含 package.json；
 *   2. 仓库内相对路径 → 存在的绝对路径；
 *   3. `../` 与多级 `../` 越界 → 抛错（batch-5 之前会静默解析到仓库外）；
 *   4. 指向仓库外的绝对路径 → 抛错；
 *   5. 指向仓库内的绝对路径 → 放行；
 *   6. 目标不存在 → 抛错，且消息同时含相对路径与解析后的绝对路径；
 *   7. 以 `..` 开头但**未逃逸**的仓库内路径（如 `..fixtures/example.ts`）→ 放行
 *      （repo-paths-boundary-fix：旧写法 `startsWith('..')` 会误拒，已实测复现）；
 *   8. 仓库根目录自身 → 沿用 batch-5 既有约定拒绝（不是越界，是「只读具体文件」）。
 *
 * 夹具说明：第 7 条需要一个真实存在、且在仓库内、相对路径结果以 `..` 开头的目标。
 * 本文件在仓库根创建保留目录 `..fixtures`（名字即夹具，不要挪作他用），
 * 用完在 finally 里 `rmSync` 清理；若上次异常中断留下残留，本文件会先自行清掉再重建。
 *
 * 运行：npx tsx src/testing/repo-paths.test.ts（已作为 `npm test` 的第二条命令）
 */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { REPO_ROOT, repoPath, repoTarget } from './repo-paths';

let passed = 0;
const failures: string[] = [];

function check(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    failures.push(name);
    console.log(`  ✗ ${name}: ${msg}`);
  }
}

/** 断言 fn 抛错，且消息包含 needle。 */
function throwsWith(fn: () => unknown, needle: string): void {
  let threw = false;
  try {
    fn();
  } catch (e) {
    threw = true;
    const msg = e instanceof Error ? e.message : String(e);
    assert.ok(msg.includes(needle), `错误消息里缺少「${needle}」：${msg}`);
  }
  assert.ok(threw, '本应抛错却成功返回了');
}

console.log('\nrepo-paths 契约');

check('REPO_ROOT 含 package.json，且为绝对路径', () => {
  assert.ok(isAbsolute(REPO_ROOT), `REPO_ROOT 应为绝对路径：${REPO_ROOT}`);
  assert.ok(existsSync(join(REPO_ROOT, 'package.json')), `${REPO_ROOT} 下没有 package.json`);
});

check('仓库内相对路径解析为存在的绝对路径', () => {
  const abs = repoPath('src/labs/math/Circle.tsx');
  assert.ok(isAbsolute(abs), `应为绝对路径：${abs}`);
  assert.equal(relative(REPO_ROOT, abs), 'src/labs/math/Circle.tsx');
  assert.ok(readFileSync(abs, 'utf8').length > 0, '目标文件应可读');
});

check('../ 越界被拒绝', () => {
  throwsWith(() => repoPath('../outside.txt'), '越界');
});

check('深层 ../ 越界被拒绝', () => {
  throwsWith(() => repoPath('src/../../outside.txt'), '越界');
});

check('多级 ../ 越界被拒绝', () => {
  throwsWith(() => repoPath('../../other/file.ts'), '越界');
  throwsWith(() => repoPath('../'), '越界');
});

check('指向仓库外的绝对路径被拒绝', () => {
  throwsWith(() => repoPath('/etc/hostname'), '越界');
});

check('指向仓库内的绝对路径放行', () => {
  const abs = repoPath(join(REPO_ROOT, 'src/labs/math/Circle.tsx'));
  assert.equal(relative(REPO_ROOT, abs), 'src/labs/math/Circle.tsx');
});

check('目标不存在时抛错，且消息含相对路径与绝对路径', () => {
  const rel = 'src/labs/math/__definitely_missing__.tsx';
  throwsWith(() => repoPath(rel), rel);
  throwsWith(() => repoPath(rel), resolve(REPO_ROOT, rel));
});

// ── 边界精确性（repo-paths-boundary-fix）─────────────────────────────────────
// 需要一个真实存在、在仓库内、相对路径结果以 `..` 开头的目标。用保留目录 `..fixtures`。
const DOTDOT_DIR = join(REPO_ROOT, '..fixtures');
const DOTDOT_FILE = join(DOTDOT_DIR, 'example.ts');

check('以 .. 开头但未逃逸的仓库内路径放行（..fixtures/example.ts）', () => {
  // 上次异常中断可能留下残留：先清掉，保证本次一定是「本文件建的」夹具
  if (existsSync(DOTDOT_DIR)) rmSync(DOTDOT_DIR, { recursive: true, force: true });
  mkdirSync(DOTDOT_DIR, { recursive: true });
  writeFileSync(DOTDOT_FILE, 'export const example = 1;\n', 'utf8');
  try {
    // 前提自检：夹具确实在仓库内，且 relative 结果确实以 '..' 开头
    assert.ok(DOTDOT_FILE.startsWith(REPO_ROOT + '/'), `夹具应在仓库内：${DOTDOT_FILE}`);
    const rel = relative(REPO_ROOT, DOTDOT_FILE);
    assert.equal(rel, '..fixtures/example.ts');
    assert.ok(rel.startsWith('..'), `夹具的相对路径应以 '..' 开头：${rel}`);

    const abs = repoPath('..fixtures/example.ts');
    assert.equal(abs, DOTDOT_FILE, '放行时应返回解析后的绝对路径');
    assert.equal(readFileSync(abs, 'utf8'), 'export const example = 1;\n');
  } finally {
    rmSync(DOTDOT_DIR, { recursive: true, force: true });
  }
  assert.ok(!existsSync(DOTDOT_DIR), '夹具目录必须被清理干净');
});

check('仓库根目录自身沿用既有约定：拒绝（非越界，本次不改语义）', () => {
  // batch-5 起 repoPath 就拒绝仓库根本身（inside === ''）。本补丁只改 `..` 前缀判定，
  // 这条行为原样保留；钉成测试是为了让任何后续改动都必须显式面对它。
  throwsWith(() => repoPath('.'), '越界');
  throwsWith(() => repoPath(REPO_ROOT), '越界');
});

// ── repoTarget：不校验存在性的解析入口（batch-8 为反向断言补的）─────────────────
check('repoTarget 对不存在的仓库内路径照样返回绝对路径（反向断言专用）', () => {
  const rel = 'src/labs/math/__definitely_missing__.tsx';
  const abs = repoTarget(rel);
  assert.ok(isAbsolute(abs), `应为绝对路径：${abs}`);
  assert.equal(relative(REPO_ROOT, abs), rel);
  // 与 repoPath 的差别就在这里：repoPath 会抛，repoTarget 不会
  throwsWith(() => repoPath(rel), '目标不存在');
  assert.equal(existsSync(abs), false, '该路径本就不应存在');
});

check('repoTarget 对存在的仓库内路径与 repoPath 完全一致', () => {
  const rel = 'src/labs/math/Circle.tsx';
  assert.equal(repoTarget(rel), repoPath(rel), '两个解析入口对存在的目标必须同解');
});

check('repoTarget 仍然拒绝越界（只放松存在性，不放松边界）', () => {
  throwsWith(() => repoTarget('../outside.txt'), '越界');
  throwsWith(() => repoTarget('/etc/hostname'), '越界');
  throwsWith(() => repoTarget('.'), '越界');
});

console.log(`\nResults: ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.log(`✗ 失败项：${failures.join('、')}`);
  process.exitCode = 1;
}

/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 运行器（src/testing/harness.ts）的契约测试。
 *
 * 独立于 smoke.test.ts：这里不测业务，只测「运行器有没有按契约记账」。每个场景由
 * harness.scenarios.ts 在**独立子进程**里跑一遍——harness 的用例表是模块级状态，
 * 同进程跑多场景会互相污染。
 *
 * 已修复并锁死的契约（回归即失败）：
 *   - describe 注册期抛错 → 保留已登记用例，显式记一条「该套件剩余用例未注册」的失败；
 *   - describe 回调返回 Promise → 立即报错，不留未处理 rejection；
 *   - runAll 只能调用一次；重复调用不重跑，返回退出码 2；
 *   - runAll 之后登记被拒绝；执行期间登记被拒绝并计为该用例失败；
 *   - 计数校验对照 runAll 开始时冻结的预期数，不再「自己数自己」。
 *
 * 仍存在的**已知缺口**（钉成断言而非假装不存在）：
 *   - setup 失败后，依赖它的用例照跑，可能「通过」（scenario: setup-fail-misleading）。
 * 一旦有人修好它，对应断言会失败并提醒更新本文件——这是刻意的。
 *
 * 运行：npx tsx src/testing/harness.test.ts（已作为 `npm test` 的第一条命令）
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const SCENARIOS = path.join(ROOT, 'src/testing/harness.scenarios.ts');

interface Summary {
  registered: number;
  passed: number;
  failed: number;
  skipped: number;
  setups: number;
  exitCode: number;
}

interface Run {
  status: number;
  stdout: string;
  stderr: string;
  summary: Summary;
}

function runScenario(name: string, env: Record<string, string> = {}): Run {
  const res = spawnSync(process.execPath, ['--import', 'tsx', SCENARIOS, name], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  const stdout = res.stdout || '';
  const stderr = res.stderr || '';
  const line = stdout.split('\n').filter((l) => l.startsWith('SUMMARY ')).pop();
  assert.ok(line, `[${name}] 场景没有输出 SUMMARY；stderr:\n${res.stderr}\nstdout:\n${stdout}`);
  return {
    status: res.status ?? -1,
    stdout,
    stderr,
    summary: JSON.parse(line!.slice(8)) as Summary,
  };
}

/** 从 ORDER 行里取执行顺序。 */
function orderOf(run: Run): string[] {
  const line = run.stdout.split('\n').find((l) => l.startsWith('ORDER '));
  assert.ok(line, '场景没有输出 ORDER');
  return JSON.parse(line!.slice(6)) as string[];
}

let passed = 0;
let failed = 0;

function check(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

console.log('\nharness 契约 · 执行与计数');

check('同步用例全部通过 → passed 计数准确、退出码 0', () => {
  const r = runScenario('pass');
  assert.equal(r.summary.registered, 3);
  assert.equal(r.summary.passed, 3);
  assert.equal(r.summary.failed, 0);
  assert.equal(r.summary.skipped, 0);
  assert.equal(r.summary.setups, 0);
  assert.equal(r.summary.exitCode, 0);
  assert.equal(r.status, 0);
});

check('同步抛错 → 计为失败，且后续用例继续执行', () => {
  const r = runScenario('sync-throw');
  assert.deepEqual(orderOf(r), ['boom', 'after'], '失败用例之后的用例没有执行');
  assert.equal(r.summary.passed, 1);
  assert.equal(r.summary.failed, 1);
  assert.equal(r.summary.exitCode, 1);
  assert.equal(r.status, 1, '失败必须以非 0 退出码结束');
});

check('Promise rejection → 计为失败（不是未处理拒绝、不是通过）', () => {
  const r = runScenario('async-reject');
  assert.deepEqual(orderOf(r), ['rejects', 'after']);
  assert.equal(r.summary.passed, 1);
  assert.equal(r.summary.failed, 1);
  assert.equal(r.summary.exitCode, 1);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /✗ rejects: async-boom/);
});

check('异步用例确实被 await（副作用对下一个用例可见）', () => {
  const r = runScenario('async-awaited');
  assert.equal(r.summary.failed, 0, '异步用例未被 await：后置断言读不到副作用');
  assert.equal(r.summary.passed, 2);
});

check('计数恒等式 registered === passed + failed + skipped + setups', () => {
  const r = runScenario('counting');
  const s = r.summary;
  assert.equal(s.registered, 5);
  assert.equal(s.passed, 2);
  assert.equal(s.failed, 1);
  assert.equal(s.skipped, 1);
  assert.equal(s.setups, 1);
  assert.equal(s.registered, s.passed + s.failed + s.skipped + s.setups);
  assert.equal(s.exitCode, 1);
});

console.log('\nharness 契约 · setup');

check('setup 成功：按注册位置执行、不计入用例数', () => {
  const r = runScenario('setup-pass');
  assert.deepEqual(orderOf(r), ['test-before', 'setup', 'test-after']);
  assert.equal(r.summary.setups, 1);
  assert.equal(r.summary.passed, 2);
  assert.equal(r.summary.registered, 3, 'setup 也计入 registered');
});

check('setup 失败：计为失败，setup 步骤数不增加', () => {
  const r = runScenario('setup-fail');
  assert.equal(r.summary.failed, 1, 'setup 失败计 1 条失败');
  assert.equal(r.summary.setups, 0, '失败的 setup 不计入 setups');
  assert.equal(r.summary.registered, 2);
  assert.equal(r.summary.passed, 1, '依赖用例照常执行并计入 passed');
  assert.match(r.stdout, /✗ \[setup\] 准备前置: setup-boom/);
});

check('[已知缺口] setup 失败后，依赖它的用例照常执行，可能「通过」', () => {
  const r = runScenario('setup-fail-misleading');
  // 依赖用例读到的仍是旧状态，断言通过；运行器不知道它依赖那个失败的 setup。
  assert.equal(r.summary.passed, 1);
  assert.equal(r.summary.failed, 1);
  assert.match(r.stdout, /✓ 本应依赖新状态，实际读到旧状态/);
});

console.log('\nharness 契约 · skip 与严格模式');

check('skip 计入 skipped、打印原因、不进入 passed', () => {
  const r = runScenario('skip');
  assert.equal(r.summary.skipped, 1);
  assert.equal(r.summary.passed, 1);
  assert.equal(r.summary.failed, 0);
  assert.equal(r.summary.exitCode, 0, '非严格模式下跳过不算失败');
  assert.match(r.stdout, /⊘ not-run/);
  assert.match(r.stdout, /跳过原因：环境不具备（模拟）/);
});

check('SMOKE_STRICT_SKIP=1 → 存在跳过即退出码 3', () => {
  const r = runScenario('skip', { SMOKE_STRICT_SKIP: '1' });
  assert.equal(r.summary.exitCode, 3);
  assert.equal(r.status, 3);
  assert.match(r.stdout, /严格模式/);
});

console.log('\nharness 契约 · 重复执行与迟到注册');

check('runAll 调用两次：第二次不重新执行，且返回非零退出码', () => {
  const r = runScenario('double-run');
  assert.match(r.stdout, /HITS_AFTER_FIRST 1/);
  assert.match(r.stdout, /HITS_AFTER_SECOND 1/, '第二次 runAll 重新执行了用例');
  assert.match(r.stdout, /runAll\(\) 只能调用一次/);
  assert.equal(r.summary.exitCode, 2, '重复调用必须以非零退出码失败');
  assert.equal(r.status, 2, '调用方必须能从进程退出码观察到该失败');
  assert.equal(r.summary.passed, 0, '重复调用不得返回假成功');
});

check('runAll 之后注册：显式拒绝（不静默丢弃、不补跑）', () => {
  const r = runScenario('late-registration');
  assert.match(r.stdout, /LATE_REJECTED "注册期已结束/);
  assert.match(r.stdout, /不能再登记用例「registered-too-late」/);
  assert.equal(r.summary.registered, 1);
  assert.equal(r.summary.exitCode, 0, '拒绝迟到注册本身不算本轮失败');
});

check('用例体内再注册：被拒绝并计为该用例失败，本轮非全绿', () => {
  const r = runScenario('register-during-run');
  assert.deepEqual(orderOf(r), ['outer'], '运行时注册的用例不应被执行');
  assert.match(r.stdout, /✗ outer: 注册期已结束（runAll 已开始执行）/);
  assert.equal(r.summary.registered, 1, 'registered 用的是冻结后的预期数');
  assert.equal(r.summary.failed, 1);
  assert.equal(r.summary.exitCode, 1);
  assert.equal(r.status, 1);
});

console.log('\nharness 契约 · 注册期异常');

check('describe 注册期抛错 → 保留已登记用例，并显式报告「剩余用例未注册」', () => {
  const r = runScenario('describe-throw');
  assert.equal(r.summary.failed, 1);
  assert.match(r.stdout, /✗ \[注册期异常\] suite-A（该套件剩余用例未注册）: 注册期断言失败（模拟）/);
  assert.equal(r.summary.registered, 3, 'A1 + [注册期异常] + B1；A2 确实未注册');
  assert.doesNotMatch(r.stdout, /A2-永远注册不上/, 'A2 本就不该出现——出现说明行为已变化');
  assert.equal(r.summary.passed, 2, '已登记用例 A1 与后续套件 B1 仍应执行');
  assert.equal(r.summary.skipped, 0, '注册期异常不得被转成 skip');
});

check('describe 回调是 async → 立即显式报错，迟到用例不被静默执行', () => {
  const r = runScenario('describe-async-cb');
  assert.match(r.stdout, /✗ \[注册期异常\] async-suite（异步回调不受支持）/);
  assert.match(r.stdout, /describe 回调返回了 Promise/);
  assert.match(r.stdout, /LATE_RAN false/, '迟到注册的用例没有被执行');
  assert.equal(r.summary.registered, 2, '失败项 + 同步登记的那条');
  assert.equal(r.summary.failed, 1);
  assert.equal(r.summary.exitCode, 1, '异步 describe 必须让本轮失败');
  assert.doesNotMatch(r.stderr, /UnhandledPromiseRejection|unhandledRejection/);
});

check('describe 的 async 回调在 await 后抛错 → 记失败，不产生未处理 rejection', () => {
  const r = runScenario('describe-async-throw');
  assert.equal(r.summary.failed, 1);
  assert.equal(r.summary.exitCode, 1);
  assert.match(r.stdout, /SETTLED true/);
  assert.match(r.stdout, /describe「async-throw」的异步回调在注册期结束后才报错：async-register-boom/);
  assert.doesNotMatch(r.stderr, /UnhandledPromiseRejection|unhandledRejection/);
});

console.log('\nharness 契约 · 边界');

check('同名用例不告警（运行器不做去重）', () => {
  const r = runScenario('duplicate-name');
  assert.equal(r.summary.passed, 2);
  assert.equal(r.summary.failed, 0);
});

console.log(`\n${'─'.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

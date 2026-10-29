/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 运行器契约的场景库：**每个场景在独立子进程里跑一次**。
 *
 * 为什么必须是子进程：harness 的 `cases` 是模块级状态，同一进程里跑多个场景会互相
 * 污染（这正是「runAll 不可重入」这一缺口的根源）。由 harness.test.ts 逐个 spawn，
 * 每个场景读到的都是全新的模块实例。
 *
 * 用法：`tsx src/testing/harness.scenarios.ts <场景名>`，最后一行输出
 * `SUMMARY {"registered":…,"passed":…,…}` 供父进程断言。
 */
import assert from 'node:assert';
import { describe, test, setup, skip, runAll } from './harness';

const name = process.argv[2];

/** 需要在 runAll 之后才能打印的观察值（执行顺序、副作用等）。 */
let report: () => void | Promise<void> = () => {};

switch (name) {
  /* ── 1. 同步 + 异步成功 ── */
  case 'pass': {
    test('sync-1', () => assert.ok(true));
    test('sync-2', () => assert.equal(1 + 1, 2));
    test('async-1', async () => {
      await Promise.resolve();
      assert.ok(true);
    });
    break;
  }

  /* ── 2. 同步抛错后，后续用例继续执行 ── */
  case 'sync-throw': {
    const order: string[] = [];
    test('boom', () => {
      order.push('boom');
      throw new Error('sync-boom');
    });
    test('after', () => {
      order.push('after');
    });
    report = () => console.log('ORDER ' + JSON.stringify(order));
    break;
  }

  /* ── 3. Promise rejection 计为失败，后续用例继续 ── */
  case 'async-reject': {
    const order: string[] = [];
    test('rejects', async () => {
      order.push('rejects');
      throw new Error('async-boom');
    });
    test('after', () => {
      order.push('after');
    });
    report = () => console.log('ORDER ' + JSON.stringify(order));
    break;
  }

  /* ── 4. 异步用例确实被 await（下一个用例看得到它的副作用） ── */
  case 'async-awaited': {
    let flag = false;
    test('async-writes-flag', async () => {
      await new Promise((r) => setTimeout(r, 5));
      flag = true;
    });
    test('sees-flag', () => {
      assert.ok(flag, '前一个 async 用例没有被 await：副作用尚未生效');
    });
    break;
  }

  /* ── 5. describe 注册期抛错：本套件剩余用例是否漏注册 ── */
  case 'describe-throw': {
    describe('suite-A', () => {
      test('A1', () => {});
      assert.ok(false, '注册期断言失败（模拟）');
      test('A2-永远注册不上', () => {});
    });
    describe('suite-B', () => {
      test('B1', () => {});
    });
    break;
  }

  /* ── 6. setup 失败：统计口径 + 依赖用例是否仍执行 ── */
  case 'setup-fail': {
    let ready = false;
    setup('准备前置', () => {
      ready = true;
      throw new Error('setup-boom');
    });
    test('依赖前置的用例', () => {
      assert.ok(ready, 'setup 本体执行过（但失败）');
    });
    break;
  }

  /* ── 7. setup 失败后，依赖用例「看起来通过」的误导路径 ── */
  case 'setup-fail-misleading': {
    const state = '初始值';
    setup('准备前置', () => {
      throw new Error('setup-boom');
    });
    test('本应依赖新状态，实际读到旧状态', () => {
      assert.equal(state, '初始值');
    });
    break;
  }

  /* ── 8. setup 成功：按注册顺序执行，且不计入用例数 ── */
  case 'setup-pass': {
    const order: string[] = [];
    test('before', () => {
      order.push('test-before');
    });
    setup('setup-mid', () => {
      order.push('setup');
    });
    test('after', () => {
      order.push('test-after');
    });
    report = () => console.log('ORDER ' + JSON.stringify(order));
    break;
  }

  /* ── 9. skip 计数（默认不进入 passed） ── */
  case 'skip': {
    test('ok', () => {});
    skip('not-run', '环境不具备（模拟）');
    break;
  }

  /* ── 10. runAll 被调用两次：是否重复执行 / 第二次是否明确失败 ── */
  case 'double-run': {
    let hits = 0;
    test('once', () => {
      hits++;
    });
    const first = await runAll();
    console.log('HITS_AFTER_FIRST ' + hits);
    const second = await runAll();
    console.log('HITS_AFTER_SECOND ' + hits);
    console.log('FIRST ' + JSON.stringify(first));
    console.log('SUMMARY ' + JSON.stringify(second));
    process.exit(second.exitCode);
  }

  /* ── 11. runAll 之后注册：应被拒绝（而不是静默丢弃或补跑） ── */
  case 'late-registration': {
    test('registered-in-time', () => {});
    const summary = await runAll();
    let rejected = '';
    try {
      test('registered-too-late', () => {});
    } catch (e) {
      rejected = e instanceof Error ? e.message : String(e);
    }
    console.log('LATE_REJECTED ' + JSON.stringify(rejected));
    console.log('SUMMARY ' + JSON.stringify(summary));
    process.exit(summary.exitCode);
  }

  /* ── 12. describe 回调是 async：注册时机与套件归属 ── */
  case 'describe-async-cb': {
    let lateRan = false;
    describe('async-suite', async () => {
      await Promise.resolve();
      test('late-registered', () => {
        lateRan = true;
      });
    });
    test('registered-synchronously', () => {});
    report = () => console.log('LATE_RAN ' + lateRan);
    break;
  }

  /* ── 12b. describe 回调是 async 且在 await 之后抛错：不得留下未处理 rejection ── */
  case 'describe-async-throw': {
    describe('async-throw', async () => {
      await Promise.resolve();
      throw new Error('async-register-boom');
    });
    report = async () => {
      // 等异步回调的 rejection 处理器跑完，确认它被捕获而不是成为未处理拒绝。
      await new Promise((r) => setTimeout(r, 10));
      console.log('SETTLED true');
    };
    break;
  }

  /* ── 13. 混合计数一致性 ── */
  case 'counting': {
    test('p1', () => {});
    test('p2', () => {});
    test('f1', () => {
      throw new Error('fail-on-purpose');
    });
    skip('s1', '跳过原因');
    setup('st1', () => {});
    break;
  }

  /* ── 14. 用例体内再注册：是否会被同一轮执行 ── */
  case 'register-during-run': {
    const ran: string[] = [];
    test('outer', () => {
      ran.push('outer');
      test('inner-registered-at-runtime', () => {
        ran.push('inner');
      });
    });
    report = () => console.log('ORDER ' + JSON.stringify(ran));
    break;
  }

  /* ── 15. 用例名重复：是否告警 ── */
  case 'duplicate-name': {
    test('同名用例', () => {});
    test('同名用例', () => {});
    break;
  }

  default:
    console.error(`未知场景：${name}`);
    process.exit(64);
}

const summary = await runAll();
await report();
console.log('SUMMARY ' + JSON.stringify(summary));
if (summary.exitCode !== 0) process.exit(summary.exitCode);

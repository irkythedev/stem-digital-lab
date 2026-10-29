/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 极简测试运行器：**先注册，后执行**。
 *
 * 为什么需要它：旧的 harness 在 `test()` 被调用时立即执行用例，异步用例则塞进
 * 数组、由文件中部（smoke.test.ts:3986）的 `runAsyncTests()` 统一跑。这带来三个
 * 可靠性问题：
 *   ① 执行入口不在文件末尾——它之后的注册仍会被 `for...of` 的实时迭代读到，纯属
 *      依赖 ESM 顶层同步求值的巧合；一旦有人加顶层 `await`，后面的异步用例会静默丢失；
 *   ② `test()` 只 `try { fn() }`，传给它的 `async` 函数不会被 await，注册瞬间即计
 *      ✓，断言失败只会变成未处理的 rejection；
 *   ③ 没有 skip 概念，环境不满足时只能 `return`，于是「没跑」被记成「通过」。
 *
 * 现在的契约：
 *   - `test` / `testAsync` / `skip` / `setup` / `describe` 只登记，不执行；
 *   - 注册期在第一次 `runAll()` 调用时**冻结**：此后再登记会抛错，而不是被静默丢弃；
 *   - `runAll()` 只能调用一次，且在开始执行前冻结预期用例数；重复调用直接返回
 *     非零退出码的失败结果，既不重新执行，也不返回假成功；
 *   - `runAll()` 按注册顺序串行执行，**每个已登记项恰好执行一次**；
 *   - 任何返回 thenable 的用例都会被 await（`test` 与 `testAsync` 因此等价，
 *     但保留两个名字以表达意图）；
 *   - 结果显式分为 passed / failed / skipped，并在末尾用**独立的预期数**校验
 *     `预期数 === 通过 + 失败 + 跳过 + setup`，对不上即视为运行器自身故障（退出码 2）；
 *   - 跳过必须给出原因，且默认不进入 passed。`SMOKE_STRICT_SKIP=1` 时跳过也算失败，
 *     供 CI 或「必须全跑」的场景使用；
 *   - `describe` 只支持同步注册。回调抛错时，已登记的用例保留，并追加一条
 *     `[注册期异常] …` 失败项；回调返回 Promise 时立即报错，绝不静默吞掉
 *     `await` 之后才登记的用例，也不会留下未处理的 rejection。
 */

export type TestFn = (name: string, fn: () => unknown) => void;
export type SkipFn = (name: string, reason: string) => void;

type CaseKind = 'test' | 'skip' | 'setup';

interface Case {
  kind: CaseKind;
  suite: string;
  name: string;
  fn?: () => unknown;
  reason?: string;
}

const cases: Case[] = [];
let currentSuite = '(未命名套件)';

/**
 * 运行状态。`idle` 期间可自由登记；`runAll()` 一进入即冻结（`running`），
 * 结束后为 `done`。冻结后任何登记尝试都会抛错——迟到的用例不会被悄悄丢掉，
 * 也不会被同一轮循环顺手捡起来执行。
 */
let runState: 'idle' | 'running' | 'done' = 'idle';
/** 首次 `runAll()` 开始执行前冻结的预期用例数，用于独立校验计数。 */
let expectedCount = 0;

function assertRegistrationOpen(what: string): void {
  if (runState === 'idle') return;
  throw new Error(
    `注册期已结束（runAll 已${runState === 'running' ? '开始执行' : '执行完毕'}）：` +
      `不能再登记${what}。所有 test / skip / setup / describe 必须在 runAll() 之前完成。`,
  );
}

/**
 * 套件分组。注册期代码（读源码、算夹具）照常在此执行；其中的断言若抛错，
 * 会被记成一条失败用例，而不是让整个模块求值中断、连汇总都打不出来。
 *
 * 只支持**同步**注册：回调返回 Promise/thenable 时立即报错并记一条失败项。
 * 异步注册（`await` 之后才调用 `test()`）的用例归属和执行时机都不可靠，
 * 这里选择显式拒绝而不是假装支持。
 */
export function describe(name: string, fn: () => void): void {
  assertRegistrationOpen(`套件「${name}」`);

  const prev = currentSuite;
  currentSuite = name;
  try {
    const ret = fn() as unknown;
    if (ret && typeof (ret as { then?: unknown }).then === 'function') {
      // 不 await：describe 是同步 API。挂一个 rejection 处理器，避免未处理拒绝；
      // 失败本身已经作为用例登记，运行结果必然非成功。
      (ret as Promise<unknown>).catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e);
        console.log(`  ✗ describe「${name}」的异步回调在注册期结束后才报错：${message}`);
      });
      const message = 'describe 回调返回了 Promise：只支持同步注册，await 之后的用例不会被登记';
      cases.push({
        kind: 'test',
        suite: name,
        name: `[注册期异常] ${name}（异步回调不受支持）`,
        fn: () => {
          throw new Error(message);
        },
      });
      console.log(`  ✗ describe「${name}」注册期异常：${message}`);
    }
  } catch (e) {
    // 保留此前已登记的用例；把注册失败本身记成一条明确可识别的失败项。
    // 剩余用例确实没有注册，名称里写明这一点，避免读者误以为它们「通过」。
    const message = e instanceof Error ? e.message : String(e);
    cases.push({
      kind: 'test',
      suite: name,
      name: `[注册期异常] ${name}（该套件剩余用例未注册）`,
      fn: () => {
        throw new Error(message);
      },
    });
    console.log(`  ✗ describe「${name}」注册期异常：${message}`);
  } finally {
    currentSuite = prev;
  }
}

/** 登记一个用例。fn 返回 Promise 时会被 await——不要再用 `test()` 塞 async 函数。 */
export function test(name: string, fn: () => unknown): void {
  assertRegistrationOpen(`用例「${name}」`);
  cases.push({ kind: 'test', suite: currentSuite, name, fn });
}

/** 语义别名：登记一个异步用例（与 test 行为一致，仅表达意图）。 */
export const testAsync: TestFn = test;

/** 登记一个跳过项。reason 会打印出来，且计入 skipped，绝不进入 passed。 */
export function skip(name: string, reason: string): void {
  assertRegistrationOpen(`跳过项「${name}」`);
  cases.push({ kind: 'skip', suite: currentSuite, name, reason });
}

/**
 * 登记一个执行步骤（不计入用例数）。用于显式建立前置状态，例如加载计算引擎：
 * 它按注册位置执行，因此「未加载」用例天然排在其前、「已加载」用例排在其后，
 * 不再依赖模块顶层语句的先后。
 */
export function setup(name: string, fn: () => unknown): void {
  assertRegistrationOpen(`执行步骤「${name}」`);
  cases.push({ kind: 'setup', suite: currentSuite, name, fn });
}

export interface RunSummary {
  registered: number;
  passed: number;
  failed: number;
  skipped: number;
  setups: number;
  exitCode: number;
  /** 运行器自身发现的故障（重复调用、执行期注册、计数不一致等）。 */
  errors: string[];
}

/** 按注册顺序执行全部用例，打印结果并返回退出码。每个模块实例只允许调用一次。 */
export async function runAll(): Promise<RunSummary> {
  if (runState !== 'idle') {
    const message =
      `runAll() 只能调用一次（当前状态：${runState}，预期用例数：${expectedCount}）。` +
      '本次调用不会重新执行用例，也不会返回成功。';
    console.log(`\n✗ ${message}`);
    return {
      registered: expectedCount,
      passed: 0,
      failed: 0,
      skipped: 0,
      setups: 0,
      exitCode: 2,
      errors: [message],
    };
  }

  runState = 'running';
  // 冻结预期值：之后的所有校验都对照这个数，而不是对照仍在变化的 cases.length。
  expectedCount = cases.length;

  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let setups = 0;
  let suite = '';
  const executed = new Set<number>();
  const errors: string[] = [];

  for (let i = 0; i < expectedCount; i++) {
    const c = cases[i];
    executed.add(i);
    if (c.suite !== suite) {
      console.log(`\n${c.suite}`);
      suite = c.suite;
    }

    if (c.kind === 'skip') {
      skipped++;
      console.log(`  ⊘ ${c.name}`);
      console.log(`      跳过原因：${c.reason}`);
      continue;
    }

    try {
      const result = c.fn!();
      if (result && typeof (result as { then?: unknown }).then === 'function') {
        await result;
      }
      if (c.kind === 'setup') {
        setups++;
        console.log(`  · ${c.name}`);
      } else {
        passed++;
        console.log(`  ✓ ${c.name}`);
      }
    } catch (e) {
      failed++;
      const message = e instanceof Error ? e.message : String(e);
      const label = c.kind === 'setup' ? `[setup] ${c.name}` : c.name;
      console.log(`  ✗ ${label}: ${message}`);
    }
  }

  runState = 'done';

  // 独立校验：三处都对照冻结的 expectedCount。cases.length 若在执行期间变大，
  // 说明有人在用例体里登记了新用例（正常路径会被 assertRegistrationOpen 拒绝，
  // 这里是兜底），绝不能因为「自己数自己」而放行。
  const accounted = passed + failed + skipped + setups;
  if (cases.length !== expectedCount) {
    const extra = cases
      .slice(expectedCount)
      .map((c) => `${c.suite} / ${c.name}`)
      .join('、');
    errors.push(
      `执行期间新增了 ${cases.length - expectedCount} 个用例（${extra}）：注册期已冻结，` +
        '新增项未执行，本轮结果不可信',
    );
  }
  if (accounted !== expectedCount) {
    errors.push(`计数不一致：expected=${expectedCount}, accounted=${accounted}`);
  }
  if (executed.size !== expectedCount) {
    errors.push(`执行数不一致：expected=${expectedCount}, executed=${executed.size}`);
  }

  console.log(`\n${'─'.repeat(40)}`);
  console.log(
    `Results: ${passed} passed, ${failed} failed, ${skipped} skipped` +
      ` (${expectedCount} registered, ${setups} setup steps)`,
  );

  let exitCode = 0;
  if (failed > 0) exitCode = 1;
  if (errors.length > 0) {
    for (const err of errors) console.log(`✗ 运行器故障：${err}`);
    exitCode = 2;
  }
  if (skipped > 0 && process.env.SMOKE_STRICT_SKIP === '1') {
    console.log(`✗ 严格模式（SMOKE_STRICT_SKIP=1）：存在 ${skipped} 个跳过用例`);
    if (exitCode === 0) exitCode = 3;
  }

  return { registered: expectedCount, passed, failed, skipped, setups, exitCode, errors };
}

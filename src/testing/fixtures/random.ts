/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 属性测试（property-based）的确定性随机源。
 *
 * 为什么不用 `Math.random()`：属性测试失败时必须能复现。`Math.random()` 既不可
 * 重放、也无法把「哪一组输入炸了」写进失败信息，最后只能靠人肉猜。这里用线性同余
 * 发生器（LCG），种子写死在用例里，失败信息带 `seed + round + input`，照抄即可重跑。
 *
 * 零依赖，与自研 harness 一致；`circuit-bench.test.ts` 里已有的 `lcg(seed)` 是同一实现，
 * 后续可迁到本模块（本轮不迁移任何现有测试）。
 *
 * 用法：
 *   forAll(20261103, 200, (rand) => ({ r: 0.5 + rand() * 40 }), (input, round) => {
 *     // 断言不变量；失败信息会自动带上 seed/round/input
 *   });
 */
/** 线性同余发生器：确定性、可复现，返回 [0, 1) 上的浮点数。 */
export function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** 闭区间随机整数 `[lo, hi]`，用于生成「元件个数」「题号」这类离散输入。 */
export function randInt(rand: () => number, lo: number, hi: number): number {
  return lo + Math.floor(rand() * (hi - lo + 1));
}

/** 安全地把输入序列化进失败信息：循环引用/大对象都不该让报错本身再抛一次。 */
function preview(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

/**
 * 跑 `rounds` 轮属性检查。
 *
 * @param seed   固定种子（CI 必须可复现；探索期可换）
 * @param rounds 迭代次数；保持几十~几百，避免撑破测试链的时间预算
 * @param gen    用同一个 `rand` 生成输入
 * @param prop   断言不变量；抛错即视为属性失败
 */
export function forAll<T>(
  seed: number,
  rounds: number,
  gen: (rand: () => number) => T,
  prop: (input: T, round: number) => void,
): void {
  const rand = lcg(seed);
  for (let round = 0; round < rounds; round++) {
    const input = gen(rand);
    try {
      prop(input, round);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `属性失败 seed=${seed} round=${round} input=${preview(input)}\n${message}`,
      );
    }
  }
}

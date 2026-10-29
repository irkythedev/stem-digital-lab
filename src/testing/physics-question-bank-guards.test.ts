/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 物理题库守卫（注册模块，不含执行入口）。
 *
 * 迁移来源：`src/smoke.test.ts` 的同名 describe，**整组 7 个用例一次迁出**。
 * 用例名、断言、正则、错误消息、循环边界与执行顺序与迁移前逐字相同；
 * 唯一差别是 2 处 `readFileSync('src/…')` 改走 `readSrc()` → `repoPath()`。
 *
 * 依赖特征：零 DOM、零 async、零全局改造；只对五份物理题库与 `circuitStyles` 的选项做
 * 值域 / 长度收敛 / 正解位置分布 / 字形纪律的数值与集合断言。
 *
 * 本模块不导入 smoke.test.ts，也不导入 harness 的具体实现，只接收注入的 `test`。
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import type { TestFn } from './harness';
import { repoPath } from './repo-paths';
import { CIRCUIT_STYLES } from '../labs/physics/circuitStyles';
import { OPTIONS as Q_B, QUIZ_CORRECT as C_B } from '../labs/physics/Buoyancy';
import { OPTIONS as Q_L, QUIZ_CORRECT as C_L } from '../labs/physics/Lever';
import { OPTIONS as Q_S, QUIZ_CORRECT as C_S } from '../labs/physics/Lens';
import { OPTIONS as Q_P, QUIZ_CORRECT as C_P } from '../labs/physics/Pressure';
import { OPTIONS as Q_U, QUIZ_CORRECT as C_U } from '../labs/physics/Pulley';
import { OPTIONS as Q_O, QUIZ_CORRECT as C_O } from '../labs/physics/Ohm';

export function registerPhysicsQuestionBankTests(test: TestFn): void {
  /** 读仓库内源码：参数保持仓库相对路径，错误消息里的文件标识也不变。 */
  const readSrc = (p: string, enc: BufferEncoding = 'utf8') => readFileSync(repoPath(p), enc);
  const PHYS: [string, Record<string, readonly (readonly [string, string])[]>, Record<string, string[]>][] = [
    ['Buoyancy.tsx', Q_B as never, C_B],
    ['Lever.tsx', Q_L as never, C_L],
    ['Lens.tsx', Q_S as never, C_S],
    ['Pressure.tsx', Q_P as never, C_P],
    ['Pulley.tsx', Q_U as never, C_U],
    ['Ohm.tsx', Q_O as never, C_O],
  ];

  test('每题的正解必须落在选项值域内（此前 4 道预测题的正确值根本不在值域 → 永不判对）', () => {
    let n = 0;
    for (const [file, OPT, COR] of PHYS) {
      for (const [qid, pairs] of Object.entries(OPT)) {
        const vals = (pairs as readonly (readonly [string, string])[]).map((p) => p[0]);
        const cor = COR[qid];
        assert.ok(cor && cor.length, `${file} ${qid}: 缺少判题键`);
        for (const c of cor) {
          assert.ok(vals.includes(c), `${file} ${qid}: 正确值 ${c} 不在值域 ${vals.join(',')}`);
        }
        n++;
      }
    }
    assert.ok(n >= 23, `物理题库题目总数应 ≥23，实测 ${n}`);
  });

  test('题号键必须与 predict/conclude 真实题号一致（杜绝「按 q 序号」串味）', () => {
    for (const [file, OPT, COR] of PHYS) {
      const optKeys = Object.keys(OPT).sort();
      const corKeys = Object.keys(COR).sort();
      assert.deepEqual(corKeys, optKeys, `${file}: OPTIONS 与 QUIZ_CORRECT 题号不一致`);
      for (const k of optKeys) {
        assert.match(k, /^(predict|conclude)Q\d+$/, `${file}: 题号 ${k} 不是 predictQn/concludeQn`);
      }
    }
  });

  test('选项长度收敛：任一题任一语种 max/min ≤ 1.15（破「最长项即答案」）', () => {
    // 文案在各实验自己的 copy 对象里（不在全局 i18n）→ 逐实验解析其 zh 块，并断言解析覆盖率
    const zhOf = (file: string): Record<string, string> => {
      const src = readSrc(`src/labs/physics/${file}`, 'utf8');
      const i = src.indexOf('zh: {'), j = src.indexOf('en: {', i);
      const blk = src.slice(i, j);
      const out: Record<string, string> = {};
      for (const m of blk.matchAll(/(\w+):\s*'((?:[^'\\]|\\.)*)'/g)) out[m[1]] = m[2];
      return out;
    };
    let checked = 0, fails: string[] = [];
    let missing = 0, total = 0;
    for (const [file, OPT] of PHYS) {
      const zh = zhOf(file);
      for (const [qid, pairs] of Object.entries(OPT)) {
        const lens = (pairs as readonly (readonly [string, string])[])
          .map(([, key]) => { total++; const v = zh[key]; if (!v) missing++; return (v ?? '').length; })
          .filter((l) => l > 0);
        if (lens.length < 2) continue;
        const ratio = Math.max(...lens) / Math.min(...lens);
        checked++;
        // 中文选项最短常见 2 字（如「越大 / 越小」），过短会导致比值天然偏大 → 门槛按「长度差 ≤4 字」双判
        const diff = Math.max(...lens) - Math.min(...lens);
        if (ratio > 1.15 && diff > 4) {
          fails.push(`${file} ${qid}: 长度比 ${ratio.toFixed(2)}（差 ${diff} 字）${lens.join('/')}`);
        }
      }
    }
    // 覆盖率护栏：文案键解析不到就必须红，否则长度检查会静默空转（本轮踩过）
    assert.equal(missing, 0, `${missing}/${total} 个选项文案键未在该实验 zh 块中解析到`);
    assert.ok(checked >= 20, `实测题数应 ≥20，实测 ${checked}`);
    assert.equal(fails.length, 0, `选项长度失衡：\n  ${fails.join('\n  ')}`);
  });

  test('正解位置分布不偏：受选项个数上限约束，可达域内必须均衡', () => {
    // 实测：23 题中 13 题只有 2 个选项 → 正解只可能在 A/B，位置均衡存在理论上限。
    // 因此按「选项数分档」断言可达域内的均衡，而不是对全体套一个 [25%,40%]。
    const byCount: Record<number, number[]> = {};
    for (const [, OPT, COR] of PHYS) {
      for (const [qid, pairs] of Object.entries(OPT)) {
        const vals = (pairs as readonly (readonly [string, string])[]).map((p) => p[0]);
        const idx = vals.findIndex((v) => COR[qid].includes(v));
        (byCount[vals.length] ??= []).push(idx);
      }
    }
    const two = byCount[2] ?? [];
    assert.ok(two.length >= 8, `两选项题应 ≥8，实测 ${two.length}`);
    const aShare = two.filter((i) => i === 0).length / two.length;
    assert.ok(aShare >= 0.4 && aShare <= 0.6, `两选项题的正解 A 占比 ${(aShare * 100).toFixed(1)}% 偏离均衡带 [40%,60%]`);
    // 3+ 选项题：C/D 必须被用到（不得全部堆在 A）
    const multi = Object.entries(byCount).filter(([k]) => +k >= 3).flatMap(([, v]) => v);
    if (multi.length >= 4) {
      const cd = multi.filter((i) => i >= 2).length / multi.length;
      assert.ok(cd >= 0.2, `3+ 选项题里 C/D 占比仅 ${(cd * 100).toFixed(1)}%，位置偏见未消除`);
    }
  });

  test('题库文案严禁对勾/叉字形', () => {
    for (const f of ['Ohm.tsx', 'Circuits.tsx', 'Buoyancy.tsx', 'Lever.tsx', 'Lens.tsx', 'Pressure.tsx', 'Pulley.tsx']) {
      const src = readSrc(`src/labs/physics/${f}`, 'utf8');
      assert.ok(!/[\u2713\u2717\u2714\u2718]/.test(src), `${f} 题库/界面含对勾叉字形`);
    }
  });

  test('Ohm concludeQ4：标为「等价变形」的 U = I×R 必须同为正确（原先选了反而判错）', () => {
    assert.ok(C_O.concludeQ4.includes('iur'), 'I = U / R 须为正确');
    assert.ok(C_O.concludeQ4.includes('uir'), 'U = I × R 标为等价变形，必须同为正确');
  });

  test('串并联题库（circuitStyles）：correctIndex 合法、选项长度收敛、C/D 被用到', () => {
    let n = 0;
    const idxs: number[] = [];
    const fails: string[] = [];
    for (const st of CIRCUIT_STYLES) {
      for (const q of st.copy.conclude ?? []) {
        n++;
        const opts = q.options;
        assert.ok(Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < opts.length,
          `${st.id}: correctIndex ${q.correctIndex} 越界（选项 ${opts.length} 个）`);
        idxs.push(q.correctIndex);
        const lens = opts.map((o) => o.zh.length);
        const ratio = Math.max(...lens) / Math.min(...lens);
        if (ratio > 1.15 && Math.max(...lens) - Math.min(...lens) > 4) {
          fails.push(`${st.id}: 长度比 ${ratio.toFixed(2)} ${lens.join('/')}`);
        }
      }
    }
    assert.ok(n >= 8, `串并联题库应 ≥8 题，实测 ${n}`);
    assert.equal(fails.length, 0, `串并联选项长度失衡：\n  ${fails.join('\n  ')}`);
  });
}

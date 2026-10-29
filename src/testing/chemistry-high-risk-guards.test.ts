/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 化学模块高危边界加固回归守卫（注册模块，不含执行入口）。
 *
 * 迁移来源：`src/smoke.test.ts` 的同名 describe，**整组 6 个用例一次迁出**。
 * 用例名、断言、正则、错误消息、循环边界与执行顺序与迁移前逐字相同；
 * 唯一差别是 5 处 `readFileSync('src/…')` 改走 `readSrc()` → `repoPath()`。
 *
 * 依赖特征：零 DOM、零 async、零全局改造；调用 `BalanceScale` 的阻尼函数做全时域量程扫描，
 * 并读化学实验源码文本核对减动效分支与题库分布。
 *
 * 本模块不导入 smoke.test.ts，也不导入 harness 的具体实现，只接收注入的 `test`。
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import type { TestFn } from './harness';
import { repoPath } from './repo-paths';
import { OVERSHOOT, dampedAngleAt } from '../components/lab/BalanceScale';
import { OPTIONS as EL_OPTIONS, QUIZ_CORRECT as EL_CORRECT } from '../labs/chemistry/Electrolysis';
import { OPTIONS as MASS_OPTIONS, QUIZ_CORRECT as MASS_CORRECT } from '../labs/chemistry/MassConservation';
import { OPTIONS as METAL_OPTIONS, QUIZ_CORRECT as METAL_CORRECT } from '../labs/chemistry/MetalActivity';
import { OPTIONS as NEUT_OPTIONS, QUIZ_CORRECT as NEUT_CORRECT } from '../labs/chemistry/Neutralization';

export function registerChemistryHighRiskTests(test: TestFn): void {
  /** 读仓库内源码：参数保持仓库相对路径，错误消息里的文件标识也不变。 */
  const readSrc = (p: string, enc: BufferEncoding = 'utf8') => readFileSync(repoPath(p), enc);
  // 先剥注释再断言：注释里的示例文本曾两次把守卫误伤
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');

  test('P1-1 动画插值起点取「当前渲染值」，不得再存「上一个目标」', () => {
    const pairs = [
      ['BalanceScale.tsx', strip(readSrc('src/components/lab/BalanceScale.tsx', 'utf8'))],
      ['Neutralization.tsx', strip(readSrc('src/labs/chemistry/Neutralization.tsx', 'utf8'))],
    ] as const;
    for (const [name, src] of pairs) {
      assert.match(src, /currentRef/, `${name}: 插值须用 currentRef 记录当前实际渲染值`);
      assert.match(
        src, /currentRef\.current\s*=\s*next/,
        `${name}: 每一帧都要把实际输出写回 currentRef，否则目标在途反转时仍会帧级瞬移`,
      );
      assert.doesNotMatch(
        src, /fromRef\.current\s*=\s*to\b/,
        `${name}: 不得把「上一个目标值」当作动画起点（实测单帧硬跳 4.85° / 19px 的根因）`,
      );
    }
  });

  test('P1-2 阻尼输出量程钳位：全时域扫描绝不越出 ±10°（且钳位是承重的）', () => {
    const MAX = 10;
    let rawWorst = 0;   // 全域最坏（±10 往返回转）的未钳位峰值
    let rawUnit = 0;    // 0 → MAX 单程的未钳位峰值，用于核对 OVERSHOOT 系数
    for (const from of [-MAX, -8, 0, 8, MAX]) {
      for (const to of [-MAX, -8, 0, 8, MAX]) {
        for (let i = 0; i <= 400; i++) {
          const t = i / 400;
          const out = dampedAngleAt(from, to, t);
          assert.ok(Number.isFinite(out), `from=${from} to=${to} t=${t}: 输出非有限值`);
          assert.ok(
            Math.abs(out) <= MAX + 1e-9,
            `from=${from} to=${to} t=${t}: 输出 ${out.toFixed(3)}° 越出量程 ±${MAX}°（指针会冲出分度盘）`,
          );
          const env = Math.exp(-4.2 * t);
          const g = 1 - env * Math.cos(6.4 * Math.PI * t);
          rawWorst = Math.max(rawWorst, Math.abs(from + (to - from) * g));
          if (from === 0 && to === MAX) rawUnit = Math.max(rawUnit, (to - from) * g);
        }
      }
    }
    // 钳位必须「真在起作用」：未钳位的原始曲线本就超调（全域最坏可达 20.6°），否则本断言毫无意义
    assert.ok(
      rawWorst > MAX,
      `原始阻尼曲线应有超调（实测最坏 ${rawWorst.toFixed(3)}°），否则钳位断言失去意义`,
    );
    // OVERSHOOT 是「单程 0→MAX 的峰值倍数」，不是「全域最坏倍数」——两者相差 (1+OVERSHOOT) 倍
    assert.ok(
      Math.abs(OVERSHOOT * MAX - rawUnit) < 0.05,
      `OVERSHOOT=${OVERSHOOT} 与实测单程峰值 ${rawUnit.toFixed(4)}° 不符（应 ≈ ${(OVERSHOOT * MAX).toFixed(2)}°）`,
    );
  });

  test('P2-3 分度盘刻度落在指针真实可达域内', () => {
    const balance = readSrc('src/components/lab/BalanceScale.tsx', 'utf8');
    const ticks = balance.match(/\[\s*(-?\d+(?:\.\d+)?(?:\s*,\s*-?\d+(?:\.\d+)?)+)\s*\]\.map/);
    assert.ok(ticks, '未找到分度盘刻度数组');
    const abs = ticks[1].split(',').map((x) => Math.abs(Number(x.trim())));
    const ptr = balance.match(/x2=\{CX\}\s+y2=\{CY \+ (\d+(?:\.\d+)?)\}/);
    assert.ok(ptr, '未找到指针长度（y2={CY + n}）');
    const reach = Number(ptr[1]) * Math.sin((10 * Math.PI) / 180);
    assert.ok(
      Math.max(...abs) <= reach + 0.5,
      `最外刻度 ±${Math.max(...abs)}px 超出指针可达 ${reach.toFixed(2)}px —— 外侧刻度会变成「一生读不到」的装饰`,
    );
  });

  test('P2-1 减动效：凡用 rAF 逐帧改坐标的实验室文件必须自查 prefers-reduced-motion', () => {
    // 全局 @media(prefers-reduced-motion) 的 * 级兜底只压 CSS 动画/过渡，覆盖不到 rAF
    const files = [
      'src/labs/chemistry/Electrolysis.tsx',
      'src/labs/chemistry/Neutralization.tsx',
      'src/components/lab/BalanceScale.tsx',
      'src/components/lab/MicroAnimation.tsx',
    ];
    for (const f of files) {
      const src = strip(readSrc(f, 'utf8'));
      assert.match(src, /requestAnimationFrame/, `${f} 已不再使用 rAF —— 请同步更新本守卫清单`);
      assert.match(
        src, /prefers-reduced-motion/,
        `${f} 用 rAF 驱动动画却未判断 prefers-reduced-motion`,
      );
    }
  });

  /* ── 题库认知平衡：长度收敛 + 位置均摊 ── */
  const braceBlock = (src: string, marker: string): string => {
    const i = src.indexOf('{', src.indexOf(marker));
    assert.ok(i >= 0, `未找到 ${marker}`);
    let d = 0;
    for (let j = i; j < src.length; j++) {
      if (src[j] === '{') d++;
      else if (src[j] === '}') {
        d--;
        if (d === 0) return src.slice(i, j + 1);
      }
    }
    throw new Error(`括号不平衡：${marker}`);
  };
  // 单引号与双引号都要覆盖 —— 只匹配单引号会把双引号写的文案误报为「缺失」
  const kvMap = (b: string): Record<string, string> => {
    const out: Record<string, string> = {};
    const re = /(\w+):\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(b))) out[m[1]] = m[2] !== undefined ? m[2] : m[3];
    return out;
  };
  type OptionsMap = Record<string, ReadonlyArray<readonly [string, string]>>;
  const LABS_QUIZ = [
    { file: 'Electrolysis.tsx', options: EL_OPTIONS as unknown as OptionsMap, correct: EL_CORRECT },
    { file: 'MassConservation.tsx', options: MASS_OPTIONS as unknown as OptionsMap, correct: MASS_CORRECT },
    { file: 'MetalActivity.tsx', options: METAL_OPTIONS as unknown as OptionsMap, correct: METAL_CORRECT },
    { file: 'Neutralization.tsx', options: NEUT_OPTIONS as unknown as OptionsMap, correct: NEUT_CORRECT },
  ];

  test('题库① 选项长度收敛：任一题任一语种 max/min ≤ 1.15（破「最长项即正解」）', () => {
    let checked = 0;
    for (const lab of LABS_QUIZ) {
      const src = readSrc(`src/labs/chemistry/${lab.file}`, 'utf8');
      const cb = braceBlock(src, 'const copy = {');
      const maps = { zh: kvMap(braceBlock(cb, 'zh: {')), en: kvMap(braceBlock(cb, 'en: {')) };
      for (const [q, pairs] of Object.entries(lab.options)) {
        assert.ok(pairs.length >= 2, `${lab.file} ${q}: 选项数异常`);
        for (const lang of ['zh', 'en'] as const) {
          const texts = pairs.map(([, lk]) => {
            const t = maps[lang][lk];
            assert.ok(t != null, `${lab.file} ${q}: 文案键 ${lk} 在 copy.${lang} 缺失（解析失效或数据损坏）`);
            return t;
          });
          const L = texts.map((t) => [...t].length);
          const ratio = Math.max(...L) / Math.min(...L);
          assert.ok(
            ratio <= 1.15,
            `${lab.file} ${q} [${lang}] 选项长度比 ${ratio.toFixed(3)} > 1.15（${L.join('/')}）——「谁最长谁是答案」的破绽会回归`,
          );
          assert.ok(
            new Set(texts).size === texts.length,
            `${lab.file} ${q} [${lang}] 同一题内出现重复选项文案`,
          );
          checked++;
        }
      }
    }
    assert.ok(checked >= 38, `应覆盖 19 题 × 2 语种 = 38 组，实测仅 ${checked} 组（解析可能漏题）`);
  });

  test('题库② 正解位置均摊：A/B/C 各约 1/3，「一律选同一项」不得高于随机基线', () => {
    const positions: number[] = [];
    for (const lab of LABS_QUIZ) {
      for (const [q, pairs] of Object.entries(lab.options)) {
        const corr = lab.correct[q];
        assert.ok(corr, `${lab.file} ${q}: 缺少判题键`);
        const vals = pairs.map(([v]) => v);
        const idx = vals.findIndex((v) => corr.includes(v));
        assert.ok(idx >= 0, `${lab.file} ${q}: 正确值 ${corr.join(',')} 不在选项值域 ${vals.join(',')} 内`);
        positions.push(idx);
      }
    }
    const n = positions.length;
    assert.ok(n === 19, `四实验题目总数应为 19，实测 ${n}`);
    const counts = [0, 1, 2].map((i) => positions.filter((p) => p === i).length);
    for (let i = 0; i < 3; i++) {
      const share = counts[i] / n;
      assert.ok(
        share >= 0.25 && share <= 0.40,
        `正解落在第 ${i + 1} 位的占比 ${(share * 100).toFixed(1)}%（${counts[i]}/${n}）越界——目标约 33%，实测分布 ${counts.join('/')}`,
      );
    }
    // 随机基线 = 各题 1/选项数 的均值（本题库实测 36.0%）；「无脑同选」不得高过它
    const dumbest = Math.max(...counts) / n;
    assert.ok(
      dumbest <= 0.40,
      `「一律选同一项」最高可得 ${(dumbest * 100).toFixed(1)}%，仍显著高于随机基线 36.0%`,
    );
  });
}

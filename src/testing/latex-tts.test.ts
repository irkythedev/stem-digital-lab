/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * LaTeX → TTS 朗读转换的 smoke 断言（注册模块，不含执行入口）。
 *
 * 迁移来源：`src/smoke.test.ts` 的 `LaTeX → TTS speech conversion` 套件，**整组 30 个用例一次迁出**。
 * 用例名、断言、期望文本与迁移前逐字相同，且不读任何文件——只调用
 * `latexToSpeech` / `cleanTextForTTS` / `detectChem` 三个纯函数。
 *
 * 与 `src/latex-speech.golden.test.ts` 的分工：golden 套件钉住 109 输入 × 4 配置的
 * 逐字快照（防重构漂移）；本模块是一组面向具体语义的断言（符号读法、化学上下文、
 * 英文侧读法）。两者并存，互不替代。
 *
 * 本模块不导入 smoke.test.ts，也不导入 harness 的具体实现，只接收注入的 `test`。
 */
import assert from 'node:assert';
import type { TestFn } from './harness';
import { detectChem } from '../lib/chem-speech';
import { latexToSpeech } from '../lib/latex-speech';
import { cleanTextForTTS } from '../lib/use-speak';

export function registerLatexTtsTests(test: TestFn): void {
  test('inline \\(...\\) formula read as speech (not raw chars)', () => {
    const out = cleanTextForTTS('二次函数的一般式是 \\(y=ax^2+bx+c\\)，其中 a 不为 0。');
    assert.ok(out.includes('x 平方'), `expected x 平方 in: ${out}`);
    assert.ok(out.includes('等于'), `expected 等于 in: ${out}`);
    assert.ok(!out.includes('\\('), 'should not contain raw latex \\(');
    assert.ok(!out.includes('公式省略'), 'should not contain 公式省略');
  });

  test('display \\[...\\] formula read as speech', () => {
    const out = cleanTextForTTS('速度公式：\\[v=\\frac{s}{t}\\]');
    assert.ok(out.includes('t 分之 s'), `expected t 分之 s in: ${out}`);
  });

  test('$...$ inline formula read as speech (model disobedient case)', () => {
    const out = cleanTextForTTS('根据 $E=mc^2$，能量等于质量乘光速平方。');
    assert.ok(out.includes('c 平方'), `expected c 平方 in: ${out}`);
    assert.ok(!out.includes('公式省略'), 'should not contain 公式省略');
  });

  test('$$...$$ display formula read as speech', () => {
    const out = cleanTextForTTS('$$\nE = mc^2\n$$');
    assert.ok(out.includes('c 平方'), `expected c 平方 in: ${out}`);
  });

  test('frac nested with superscript', () => {
    const out = latexToSpeech('\\frac{a}{b^2}');
    assert.equal(out, 'b 平方 分之 a');
  });

  test('sqrt with content', () => {
    const out = latexToSpeech('\\sqrt{a^2+b^2}');
    assert.ok(out.includes('根号'), `expected 根号 in: ${out}`);
    assert.ok(out.includes('a 平方'), `expected a 平方 in: ${out}`);
  });

  test('chemistry subscript H_2O reads as 水 (compound name)', () => {
    const out = latexToSpeech('H_2O');
    assert.equal(out, '水');
  });

  test('chemistry compound name lookup: NaCl and CO_2', () => {
    assert.equal(latexToSpeech('NaCl'), '氯化钠');
    assert.equal(latexToSpeech('CO_2'), '二氧化碳');
  });

  // ── 化学朗读（提示词标准写法 \mathrm{}）：审计发现 60 条化合物表因缺解包分支而全程不可达 ──
  //    提示词（ai-config.ts:304/344）强制化学式写 \mathrm{}，而旧实现只认裸写法，
  //    于是 \mathrm{H_2O} 原样吐出 `H_2O` 进 TTS，且 \uparrow / \xrightarrow 也被当普通命令念出。
  test('chemistry: \mathrm{} 解包后命中化合物表', () => {
    assert.equal(latexToSpeech('\\mathrm{H_2O}'), '水');
    assert.equal(latexToSpeech('\\mathrm{CuSO_4}'), '硫酸铜');
    assert.equal(latexToSpeech('\\mathrm{Fe_3O_4}'), '四氧化三铁');
    assert.equal(latexToSpeech('\\mathrm{Ca(OH)_2}'), '氢氧化钙', '括号原子团须整体查表');
  });

  test('chemistry: 单质元素符号读中文名，不念字母', () => {
    assert.equal(latexToSpeech('\\mathrm{Na}'), '钠');
    assert.equal(latexToSpeech('\\mathrm{Fe}'), '铁');
    assert.equal(latexToSpeech('\\mathrm{Cl_2}'), '氯气');
  });

  test('chemistry: 离子读中文名（含上标电荷）', () => {
    assert.equal(latexToSpeech('\\mathrm{H^+}'), '氢离子');
    assert.equal(latexToSpeech('\\mathrm{OH^-}'), '氢氧根离子');
    assert.equal(latexToSpeech('\\mathrm{Fe^{3+}}'), '铁离子');
    assert.equal(latexToSpeech('\\mathrm{Fe^{2+}}'), '亚铁离子');
    assert.equal(latexToSpeech('\\mathrm{SO_4^{2-}}'), '硫酸根离子');
    assert.equal(latexToSpeech('\\mathrm{CO_3^{2-}}'), '碳酸根离子');
  });

  test('chemistry: 计量数读「两个水分子」而不是逐字符', () => {
    assert.equal(latexToSpeech('2\\mathrm{H_2O}'), '两个水分子');
    assert.equal(latexToSpeech('2\\mathrm{Cu}'), '两个铜原子');
    assert.equal(latexToSpeech('3\\mathrm{H_2O}'), '三个水分子');
  });

  test('chemistry: 方程式读条件、生成号与气体箭头', () => {
    const el = latexToSpeech('2\\mathrm{H_2O} \\xrightarrow{\\ \\text{通电}\\ } 2\\mathrm{H_2\\uparrow} + \\mathrm{O_2\\uparrow}');
    assert.ok(el.includes('两个水分子'), `缺计量数读法: ${el}`);
    assert.ok(el.includes('在通电条件下生成'), `缺条件读法: ${el}`);
    assert.ok(el.includes('两个氢分子'), `缺气体计量数: ${el}`);
    assert.ok(el.includes('氧气'), `缺氧气: ${el}`);
    assert.ok(!/uparrow|xrightarrow/.test(el), `不得残留 LaTeX 命令: ${el}`);
    const neut = latexToSpeech('\\mathrm{HCl} + \\mathrm{NaOH} = \\mathrm{NaCl} + \\mathrm{H_2O}');
    assert.ok(neut.includes('反应生成'), `= 须读「反应生成」: ${neut}`);
    assert.ok(neut.includes('和') && !neut.includes('加'), `反应物连接须读「和」: ${neut}`);
    const ion = latexToSpeech('\\mathrm{H^+} + \\mathrm{OH^-} \\rightarrow \\mathrm{H_2O}');
    assert.ok(ion.includes('氢离子') && ion.includes('氢氧根离子'), `离子未读出: ${ion}`);
    assert.ok(ion.includes('生成') && !ion.includes('趋向'), `→ 在化学上下文须读「生成」: ${ion}`);
  });

  test('chemistry: AI 回答里的公式（\(...\) 包裹）端到端读通', () => {
    const out = cleanTextForTTS(
      '电解水的化学方程式是 \\(2\\mathrm{H_2O} \\xrightarrow{\\ \\text{通电}\\ } 2\\mathrm{H_2\\uparrow} + \\mathrm{O_2\\uparrow}\\)，正极产生氧气、负极产生氢气。',
      'zh',
    );
    assert.ok(out.includes('在通电条件下生成'), `缺条件: ${out}`);
    assert.ok(out.includes('两个水分子') && out.includes('两个氢分子'), `缺计量数: ${out}`);
    assert.ok(!/[\\$]/.test(out.replace(/[。，、]/g, '')), `不得残留 LaTeX 定界符: ${out}`);
    const sub = cleanTextForTTS('铁与硫酸铜溶液反应：\\(\\mathrm{Fe} + \\mathrm{CuSO_4} = \\mathrm{FeSO_4} + \\mathrm{Cu}\\)。', 'zh');
    assert.ok(sub.includes('铁') && sub.includes('硫酸铜') && sub.includes('反应生成'), `置换反应读法: ${sub}`);
  });

  test('chemistry: 超长 \mathrm{} 不判为化学（嵌套量词回溯防线）', () => {
    // 长度闸门：放行超长 inner 会让判据里的嵌套量词正则出现 O(n²) 回溯
    // （实测 4000 字符 141ms、8000 字符 559ms）。真实化学式最长 ≈12 字符。
    assert.equal(detectChem('\\mathrm{H_2O}'), true, '正常化学式仍须判定为化学');
    assert.equal(detectChem('\\mathrm{' + 'A'.repeat(200) + '}'), false, '超长 inner 须直接排除');
    const t0 = Date.now();
    latexToSpeech('\\mathrm{' + 'A'.repeat(4000) + '}', 'zh');
    assert.ok(Date.now() - t0 < 100, `超长 inner 不得拖慢主线程（实测 ${Date.now() - t0}ms）`);
  });

  test('chemistry: 物理模式下化学方程式只按化学口径读（不插「乘以」）', () => {
    // 化学上下文必须优先于物理口径：否则预处理产出的中文会被物理因子逻辑当成乘积链，
    // 读成「两个水分子 乘以 生成 乘以 两个氢分子 乘以 和 乘以 氧气」。
    const out = latexToSpeech('2H_2O \\rightarrow 2H_2 \\uparrow + O_2 \\uparrow', 'zh', 'physics');
    assert.ok(!out.includes('乘以'), `化学读法不得插「乘以」: ${out}`);
    assert.ok(out.includes('两个水分子') && out.includes('生成'), `化学口径未生效: ${out}`);
    // 反向：纯物理公式在 physics 模式下行为不变
    assert.equal(latexToSpeech('\\rho=\\frac{m}{V}', 'zh', 'physics'), '密度等于质量 与 体积 之比');
  });

  test('chemistry: 判定保守——数学/物理公式一字不改', () => {
    // 元素符号形状的字母在物理里到处都是（I=U/R 的 U、I；P=UI），误判会直接把物理公式念错。
    // 这组是回归哨兵：化学预处理的守门条件一旦放松，这里会立刻红。
    assert.equal(latexToSpeech('I=\\frac{U}{R}'), 'I等于R 分之 U');
    assert.equal(latexToSpeech('P=UI'), 'P等于U I');
    assert.equal(latexToSpeech('E=mc^2'), 'E等于m c 平方');
    assert.equal(latexToSpeech('F=ma'), 'F等于m a');
    assert.equal(latexToSpeech('6\\,\\mathrm{V}'), '6 V', '单位 \\mathrm{V} 不得被当化学式');
    assert.equal(latexToSpeech('\\mathrm{kg} \\cdot m'), 'kg 乘以 m');
    assert.ok(latexToSpeech('x_1') === 'x 一' && latexToSpeech('a_{12}') === 'a 一二', '数学下标不受影响');
  });

  test('non-compound formula falls back to symbol reading (x_1)', () => {
    const out = latexToSpeech('x_1');
    assert.equal(out, 'x 一');
  });

  test('unknown latex command degrades safely (no crash)', () => {
    const out = latexToSpeech('\\mathrm{kg} \\cdot m');
    assert.ok(out.includes('kg'), `expected kg in: ${out}`);
    assert.ok(out.includes('乘以'), `expected 乘以 in: ${out}`);
  });

  test('english mode reads formulas in english', () => {
    const out = cleanTextForTTS('The formula is \\(y=ax^2+bx+c\\).', 'en');
    assert.ok(out.includes('x squared'), `expected x squared in: ${out}`);
    assert.ok(!out.includes('\\('), 'should not contain raw latex');
  });

  test('greek letters spoken', () => {
    const out = latexToSpeech('\\rho = \\frac{m}{V}');
    assert.ok(out.includes('柔'), `expected 柔(rho) in: ${out}`);
    assert.ok(out.includes('V 分之 m'), `expected V 分之 m in: ${out}`);
  });

  test('plain text without formulas unaffected', () => {
    const out = cleanTextForTTS('这是一个普通的句子，没有公式。');
    assert.equal(out, '这是一个普通的句子，没有公式。');
  });

  test('minus sign distinguishes negative vs subtract (zh)', () => {
    assert.equal(latexToSpeech('-b'), '负b');
    assert.equal(latexToSpeech('a-b'), 'a减b');
    assert.equal(latexToSpeech('a=-b'), 'a等于负b');
    assert.equal(latexToSpeech('2a-b'), '2 a减b');
    assert.equal(latexToSpeech('\\frac{1}{2}-b'), '2 分之 1减b');
  });

  test('quadratic root formula reads -b as negative b', () => {
    const out = latexToSpeech('x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}');
    assert.equal(out, 'x等于2 a 分之 负b正负根号 b 平方减4 a c');
  });

  test('parentheses read closing bracket only (zh)', () => {
    assert.equal(latexToSpeech('(a+b)'), 'a加b括号');
    assert.equal(latexToSpeech('\\left(a+b\\right)'), 'a加b括号');
    assert.equal(latexToSpeech('\\left[ x \\right]'), 'x 右中括号');
  });

  test('minus and parentheses behave correctly (en)', () => {
    assert.equal(latexToSpeech('a-b', 'en'), 'a minus b');
    assert.equal(latexToSpeech('a=-b', 'en'), 'a equals negative b');
    assert.equal(latexToSpeech('\\left(a+b\\right)', 'en'), 'a plus b close parenthesis');
  });

  test('absolute value reads as 绝对值 (zh)', () => {
    assert.equal(latexToSpeech('|k|'), 'k 的绝对值');
    assert.equal(latexToSpeech('∣k∣'), 'k 的绝对值');
    assert.equal(latexToSpeech('|-3|'), '负3 的绝对值');
    assert.equal(latexToSpeech('|x-2|<3'), 'x减2 的绝对值小于3');
    assert.equal(latexToSpeech('\\left| k \\right|'), 'k 的绝对值');
    assert.equal(latexToSpeech('\\lvert k \\rvert'), 'k 的绝对值');
    assert.equal(latexToSpeech('\\vert k \\vert'), 'k 的绝对值');
    assert.equal(latexToSpeech('\\left| \\frac{1}{2} \\right|'), '2 分之 1 的绝对值');
  });

  test('absolute value reads as absolute value of (en)', () => {
    assert.equal(latexToSpeech('|k|', 'en'), 'absolute value of k');
    assert.equal(latexToSpeech('\\left| k \\right|', 'en'), 'absolute value of k');
    assert.equal(latexToSpeech('\\lvert k \\rvert', 'en'), 'absolute value of k');
  });

  test('bare unicode math symbols read as words (zh)', () => {
    assert.equal(latexToSpeech('x<3'), 'x小于3');
    assert.equal(latexToSpeech('x>3'), 'x大于3');
    assert.equal(latexToSpeech('a≤b'), 'a小于等于b');
    assert.equal(latexToSpeech('a≥b'), 'a大于等于b');
    assert.equal(latexToSpeech('a≠b'), 'a不等于b');
    assert.equal(latexToSpeech('2×3'), '2乘以3');
    assert.equal(latexToSpeech('6÷2'), '6除以2');
    assert.equal(latexToSpeech('π'), '派');
  });

  test('bare unicode math symbols read as words (en)', () => {
    assert.equal(latexToSpeech('x<3', 'en'), 'x less than 3');
    assert.equal(latexToSpeech('x>3', 'en'), 'x greater than 3');
    assert.equal(latexToSpeech('a≠b', 'en'), 'a not equal to b');
    assert.equal(latexToSpeech('2×3', 'en'), '2 times 3');
    assert.equal(latexToSpeech('π', 'en'), 'pi');
  });
}

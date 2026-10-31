/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * KaTeX 零信任渲染契约的安全断言（注册模块，不含执行入口）。
 *
 * 目的：把 `src/components/ui/Formula.tsx` 里的两条安全边界钉成可回归的单测：
 *   ① 传入 `\href{javascript:...}{click}` / `\url{javascript:...}` 时，
 *      `katexToHtml` 不得生成任何可执行的 `<a>` 或带 `javascript:` 的 `href`；
 *   ② 传入坏公式（括号不闭合）时，必须平稳降级为纯文本（`.katex-error`），
 *      严禁抛错中断 React 渲染树；非字符串输入同样不抛错、返回空串。
 *
 * 依赖特征：零 DOM、零 async、零网络。仅 import 组件导出的纯函数。
 * 若未来有人把 `trust` 放开或删掉 try/catch，本组用例会立即变红。
 */
import assert from 'node:assert';
import type { TestFn } from './harness';
import { katexToHtml } from '../components/ui/Formula';

export function registerKatexSecurityTests(test: TestFn): void {
  test('零信任：\\href{javascript:...}{click} 不得生成可执行 <a> 标签', () => {
    const html = katexToHtml('\\href{javascript:alert(1)}{click}');
    assert.ok(typeof html === 'string' && html.length > 0, '应返回非空字符串');
    assert.ok(!/<a[\s>]/i.test(html), `不得出现 <a> 标签，实际：${html.slice(0, 160)}`);
    assert.ok(!/href\s*=/i.test(html), `不得出现任何 href 属性，实际：${html.slice(0, 160)}`);
    assert.ok(!/<a[^>]*javascript:/i.test(html), '不得出现携带 javascript: 的锚点');
  });

  test('零信任：\\url{javascript:...} 不得生成可执行链接', () => {
    const html = katexToHtml('\\url{javascript:alert(1)}');
    assert.ok(!/<a[\s>]/i.test(html), `不得出现 <a> 标签，实际：${html.slice(0, 160)}`);
    assert.ok(!/href\s*=/i.test(html), `不得出现任何 href 属性，实际：${html.slice(0, 160)}`);
  });

  test('零信任：\\htmlClass 等 HTML 扩展被禁用（trust:false 固化）', () => {
    // trust:false 时 \htmlClass 会被当作未知/禁用命令降级，不应透出任意 class 注入。
    const html = katexToHtml('\\htmlClass{x}{y}');
    assert.ok(!/class="x"/.test(html), '不得让 \\htmlClass 注入任意 class');
  });

  test('坏公式降级为纯文本而非抛错中断渲染', () => {
    let html = '';
    assert.doesNotThrow(() => {
      html = katexToHtml('\\frac{1}{');
    }, '坏公式不得抛出异常');
    assert.equal(typeof html, 'string');
    assert.ok(html.length > 0, '坏公式应仍返回可渲染内容');
    assert.ok(/katex-error/.test(html), `坏公式应降级为 katex-error 纯文本，实际：${html.slice(0, 160)}`);
  });

  test('非字符串输入：不抛错并返回空串（渲染树安全兜底）', () => {
    let html = 'x';
    assert.doesNotThrow(() => {
      html = katexToHtml(null as unknown as string);
    }, '非字符串输入不得抛错');
    assert.equal(html, '', '非字符串输入应兜底为空串');
  });

  test('block 模式：displayMode 生效且仍禁 trust', () => {
    const block = katexToHtml('x^2', true);
    const inline = katexToHtml('x^2', false);
    assert.ok(/katex-display/.test(block), 'block 模式应带 katex-display');
    assert.ok(!/katex-display/.test(inline), '行内模式不应带 katex-display');
    // block 模式下同样受零信任约束
    const evilBlock = katexToHtml('\\href{javascript:alert(1)}{click}', true);
    assert.ok(!/<a[\s>]/i.test(evilBlock) && !/href\s*=/i.test(evilBlock), 'block 模式同样不得生成 <a>/href');
  });
}

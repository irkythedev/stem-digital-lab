/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 思考参数下发与留痕同源守卫（注册模块，不含执行入口）。
 *
 * 迁移来源：`src/smoke.test.ts` 的同名 describe，**整组 5 个用例一次迁出**。
 * 用例名、断言、正则、错误消息与执行顺序与迁移前逐字相同；1 处 `readFileSync('src/…')`
 * 改走 `readSrc()`，`readAiPanel()` 换成 `./ai-panel-source` 的同义实现。
 *
 * 依赖特征：零 DOM、零 async、零全局改造。
 *
 * 本模块不导入 smoke.test.ts，也不导入 harness 的具体实现，只接收注入的测试注册函数。
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import type { TestFn } from './harness';
import { readAiPanel } from './ai-panel-source';
import { repoPath } from './repo-paths';
import {
  describeThinkingParams, resolveThinkingDispatch, type ThinkingEffort,
} from '../lib/ai-config';

export function registerAiThinkingDispatchTests(test: TestFn): void {
  /** 读仓库内源码：参数保持仓库相对路径，错误消息里的文件标识也不变。 */
  const readSrc = (p: string, enc: BufferEncoding = 'utf8') => readFileSync(repoPath(p), enc);
  const D = (providerId: string, model: string, thinkingEffort?: ThinkingEffort, extraParamsText?: string) =>
    resolveThinkingDispatch({ providerId, model, thinkingEffort, extraParamsText });

  test('P1-1 自定义端点填了透传：params 与留痕都如实反映真实键值', () => {
    const d = D('custom', 'local-llama3', 'standard', '{"reasoning_effort":"max"}');
    assert.deepEqual(d.params, { reasoning_effort: 'max' });
    assert.equal(d.summaryText, 'reasoning_effort=max', '留痕必须显示透传，严禁谎报「不下发任何参数」');
    assert.equal(d.effort, null, '自定义端点不预设档位，一律由透传决定');
  });

  test('P1-1 多键与嵌套值同样如实呈现；未填透传时才为空', () => {
    assert.equal(
      D('custom', 'm', 'deep', '{"reasoning_effort":"max","top_p":0.9}').summaryText,
      'reasoning_effort=max, top_p=0.9',
    );
    assert.equal(D('custom', 'm', 'deep', '{"thinking":{"type":"enabled"}}').summaryText, 'thinking.type=enabled');
    const empty = D('custom', 'm', 'deep');
    assert.deepEqual(empty.params, {});
    assert.equal(empty.summaryText, '', '空透传时留痕为空，界面才显示「不下发任何思考参数」');
    // 非法 JSON 透传：不阻断，也不谎报
    assert.deepEqual(D('custom', 'm', 'deep', '{"a":}').params, {});
  });

  test('P1-2 存储档位为 off / 非法：回落标准档，请求体与留痕同为一个事实', () => {
    const g = D('zhipu', 'glm-5.3', 'off');
    assert.equal(g.effort, 'standard', 'GLM-5.3 关不掉 → 回落标准');
    assert.deepEqual(g.params, { reasoning_effort: 'low' });
    assert.equal(g.summaryText, 'reasoning_effort=low', '留痕必须与实发一致，不得再说「不下发任何参数」');
    // 合法 off 仍照发（DeepSeek 可关闭）
    const d = D('deepseek', 'deepseek-chat', 'off');
    assert.deepEqual(d.params, { thinking: { type: 'disabled' } });
    assert.equal(d.summaryText, 'thinking.type=disabled');
    // 未收录模型无档位：什么都不发，留痕为空
    const u = D('deepseek', 'some-unknown-model', 'deep');
    assert.equal(u.effort, null);
    assert.deepEqual(u.params, {});
    assert.equal(u.summaryText, '');
    // 空模型名（刚切服务商的瞬间）不得乱发参数
    assert.deepEqual(D('deepseek', '', 'deep').params, {});
  });

  test('留痕文本恒等于实发字段的描述（同源、不可漂移）', () => {
    const cases: [string, string, ThinkingEffort, string | undefined][] = [
      ['deepseek', 'deepseek-chat', 'standard', undefined],
      ['deepseek', 'deepseek-chat', 'off', undefined],
      ['dashscope', 'qwen-plus', 'standard', undefined],
      ['zhipu', 'glm-5.3', 'off', undefined],
      ['moonshot', 'kimi-k2.7-code', 'deep', undefined],
      ['custom', 'local', 'deep', '{"a":1,"b":{"c":2}}'],
      ['custom', 'local', 'deep', undefined],
    ];
    for (const [pid, m, e, x] of cases) {
      const d = D(pid, m, e, x);
      assert.equal(d.summaryText, describeThinkingParams(d.params), `${pid}/${m}/${e} 留痕必须由实发字段生成`);
    }
  });

  test('代码级防漂移：streamChat 与面板留痕必须共用同一出口', () => {
    const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
    const lib = strip(readSrc('src/lib/ai-config.ts', 'utf8'));
    const body = lib.slice(lib.indexOf('export async function streamChat'));
    assert.match(body, /resolveThinkingDispatch\(cfg(?:, \w+)?\)\.params/, 'streamChat 必须用 resolveThinkingDispatch 组装');
    assert.ok(!body.includes('buildThinkingParams(cfg.providerId'), 'streamChat 不得再自己拼一半');
    assert.ok(!body.includes('parseExtraParams(cfg.extraParamsText)'), '透传不得在 streamChat 里另拼一次');
    const panel = strip(readAiPanel());
    assert.ok(
      panel.includes('resolveThinkingDispatch({ providerId, model, thinkingEffort, extraParamsText })'),
      '面板留痕必须走同一出口',
    );
    assert.ok(panel.includes('sentDesc = dispatch.summaryText'), '留痕文本只能取自 dispatch');
  });
}

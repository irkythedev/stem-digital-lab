/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * AI 思考强度档位守卫（注册模块，不含执行入口）。
 *
 * 迁移来源：`src/smoke.test.ts` 的同名 describe，**整组 10 个用例一次迁出**（含 1 个 async）。
 * 用例名、断言、正则、错误消息与执行顺序与迁移前逐字相同；本套件零文件读取，
 * 因此除「入口多注入一个 `testAsync`」外无任何改写。
 *
 * 依赖特征：零 DOM；最后一个用例替换 `globalThis.fetch` 验证三家请求体，属进程内自包含替身。
 *
 * 本模块不导入 smoke.test.ts，也不导入 harness 的具体实现，只接收注入的测试注册函数。
 */
import assert from 'node:assert';
import type { TestFn } from './harness';
import {
  buildThinkingParams, effectiveThinkingEffort, isTierLocked, parseExtraParams, streamChat, thinkingPlanFor,
  type ThinkingEffort,
} from '../lib/ai-config';

export function registerAiThinkingTiersTests(test: TestFn, testAsync: TestFn): void {
  const P = (pid: string, model: string, e: ThinkingEffort) => buildThinkingParams(pid, model, e);

  test('DeepSeek：三档互不相同，不再出现「标准 = 深度」的空操作', () => {
    assert.deepEqual(P('deepseek', 'deepseek-chat', 'off'), { thinking: { type: 'disabled' } });
    assert.deepEqual(P('deepseek', 'deepseek-chat', 'standard'), { reasoning_effort: 'low' });
    assert.deepEqual(P('deepseek', 'deepseek-chat', 'deep'), { reasoning_effort: 'high' });
    assert.notDeepEqual(
      P('deepseek', 'deepseek-chat', 'standard'),
      P('deepseek', 'deepseek-chat', 'deep'),
      '标准与深度不得等价（DeepSeek 默认即 high，标准档必须显式下调）',
    );
    assert.equal(thinkingPlanFor('deepseek', 'deepseek-reasoner').note, undefined);
  });

  test('通义千问：删除被误当「力度」的 2048 上限；标准取平台默认上限、深度放开', () => {
    assert.deepEqual(P('dashscope', 'qwen-plus', 'off'), { enable_thinking: false });
    assert.deepEqual(P('dashscope', 'qwen-plus', 'standard'), { enable_thinking: true, thinking_budget: 4000 });
    assert.deepEqual(P('dashscope', 'qwen-plus', 'deep'), { enable_thinking: true });
    assert.equal(
      (P('dashscope', 'qwen-plus', 'deep') as { thinking_budget?: number }).thinking_budget,
      undefined,
      '深度档不得再设上限（thinking_budget 是上限而非力度，设小了等于反向下调）',
    );
    assert.ok(
      !JSON.stringify(P('dashscope', 'qwen-plus', 'deep')).includes('2048'),
      '深度档必须彻底移除 2048',
    );
    assert.notDeepEqual(P('dashscope', 'qwen-plus', 'standard'), P('dashscope', 'qwen-plus', 'deep'));
  });

  test('智谱 GLM-5.3：纯推理模型不提供关闭档（传 disabled 会被拒），力度 low/max', () => {
    assert.deepEqual(thinkingPlanFor('zhipu', 'glm-5.3').available, ['standard', 'deep']);
    assert.equal(thinkingPlanFor('zhipu', 'glm-5.3').note, 'cannotDisable');
    assert.equal(
      (P('zhipu', 'glm-5.3', 'off') as { thinking?: unknown }).thinking,
      undefined,
      'GLM-5.3 关不得：绝不能下发 thinking.type=disabled',
    );
    assert.deepEqual(P('zhipu', 'glm-5.3', 'standard'), { reasoning_effort: 'low' });
    assert.deepEqual(P('zhipu', 'glm-5.3', 'deep'), { reasoning_effort: 'max' });
    assert.deepEqual(thinkingPlanFor('zhipu', 'glm-5.3-flash').available, ['standard', 'deep']);
  });

  test('智谱 GLM-4.5 可关闭但无力度档；glm-4-flash 不在支持范围，不发任何参数', () => {
    assert.deepEqual(thinkingPlanFor('zhipu', 'glm-4.5').available, ['off', 'standard']);
    assert.equal(thinkingPlanFor('zhipu', 'glm-4.5').note, 'noEffortTier');
    assert.deepEqual(P('zhipu', 'glm-4.5', 'off'), { thinking: { type: 'disabled' } });
    assert.deepEqual(P('zhipu', 'glm-4.5', 'deep'), {}, '没有力度档就不许下发力度字段');
    assert.deepEqual(thinkingPlanFor('zhipu', 'glm-4-flash').available, []);
    assert.equal(thinkingPlanFor('zhipu', 'glm-4-flash').note, 'noThinkingSupport');
    assert.deepEqual(P('zhipu', 'glm-4-flash', 'deep'), {});
  });

  test('Kimi 逐模型：k3 可调力度不可关、k2.6 可关无力度、k2.7-code 什么都不可调', () => {
    assert.deepEqual(thinkingPlanFor('moonshot', 'kimi-k3').available, ['standard', 'deep']);
    assert.deepEqual(P('moonshot', 'kimi-k3', 'standard'), { reasoning_effort: 'low' });
    assert.deepEqual(P('moonshot', 'kimi-k3', 'deep'), { reasoning_effort: 'max' });
    assert.equal((P('moonshot', 'kimi-k3', 'off') as { thinking?: unknown }).thinking, undefined);
    assert.deepEqual(thinkingPlanFor('moonshot', 'kimi-k2.6').available, ['off', 'standard']);
    assert.deepEqual(P('moonshot', 'kimi-k2.6', 'off'), { thinking: { type: 'disabled' } });
    assert.equal((P('moonshot', 'kimi-k2.6', 'deep') as { reasoning_effort?: unknown }).reasoning_effort, undefined, 'k2.6 不支持 reasoning_effort');
    assert.deepEqual(thinkingPlanFor('moonshot', 'kimi-k2.7-code').available, []);
    assert.equal(thinkingPlanFor('moonshot', 'kimi-k2.7-code').note, 'alwaysThinksNoKnob');
    assert.deepEqual(P('moonshot', 'kimi-k2.7-code', 'deep'), {});
  });

  test('自定义端点与未收录模型一律不下发思考字段（不猜参数名，防 400）', () => {
    assert.deepEqual(thinkingPlanFor('custom', 'anything').available, []);
    assert.equal(thinkingPlanFor('custom', 'anything').note, 'passthroughOnly');
    assert.deepEqual(P('custom', 'deepseek-chat', 'deep'), {}, '自定义端点是透传，不套用能力表');
    assert.deepEqual(P('deepseek', 'some-unknown-model', 'deep'), {});
    assert.equal(thinkingPlanFor('deepseek', 'some-unknown-model').note, 'unverified');
    assert.deepEqual(thinkingPlanFor('deepseek', '').available, []);
  });

  test('生效档位回落：不可用档位回到标准档，完全不可调时返回 null', () => {
    assert.equal(effectiveThinkingEffort('deepseek', 'deepseek-chat', 'deep'), 'deep');
    assert.equal(effectiveThinkingEffort('zhipu', 'glm-5.3', 'off'), 'standard', '关闭不可用应回落标准');
    assert.equal(effectiveThinkingEffort('moonshot', 'kimi-k2.7-code', 'deep'), null);
    assert.equal(effectiveThinkingEffort('deepseek', 'deepseek-chat', undefined), 'standard');
    assert.equal(effectiveThinkingEffort('custom', 'x', 'deep'), null);
  });

  test('置灰判据：只有「模型有档位集合但缺这一档」才置灰，无可调参数时三档都不得置灰', () => {
    const glm53 = thinkingPlanFor('zhipu', 'glm-5.3');
    assert.equal(isTierLocked(glm53, 'off'), true, 'GLM-5.3 的关闭档应置灰');
    assert.equal(isTierLocked(glm53, 'standard'), false);
    assert.equal(isTierLocked(glm53, 'deep'), false);
    // 回归防护：没有可调参数的模型若把三档全置灰，点击将毫无反馈（用户报告过的缺陷）
    for (const [pid, m] of [
      ['custom', 'anything'],
      ['deepseek', 'some-unknown-model'],
      ['moonshot', 'kimi-k2.7-code'],
      ['zhipu', 'glm-4-flash'],
    ] as const) {
      const plan = thinkingPlanFor(pid, m);
      assert.deepEqual(plan.available, [], `${pid}/${m} 应无可选档位`);
      for (const t of ['off', 'standard', 'deep'] as ThinkingEffort[]) {
        assert.equal(isTierLocked(plan, t), false, `${pid}/${m} 的 ${t} 不得置灰（否则点击无反馈）`);
      }
    }
  });

  test('自定义端点附加参数：合法 JSON 对象才合并，其余一律忽略（宽松透传不阻断）', () => {
    assert.deepEqual(parseExtraParams('{"reasoning_effort":"high"}'), { reasoning_effort: 'high' });
    assert.deepEqual(parseExtraParams('  {"a":1,"b":{"c":2}}  '), { a: 1, b: { c: 2 } });
    assert.deepEqual(parseExtraParams(''), {});
    assert.deepEqual(parseExtraParams('   '), {});
    assert.deepEqual(parseExtraParams(undefined), {});
    assert.deepEqual(parseExtraParams('[1,2]'), {}, '数组不是普通对象，应忽略');
    assert.deepEqual(parseExtraParams('"just a string"'), {}, '标量应忽略');
    assert.deepEqual(parseExtraParams('{"a":}'), {}, '非法 JSON 应忽略');
  });

  testAsync('streamChat：三家请求体各自正确，且不含多余或会被拒的字段', async () => {
    const originalFetch = (globalThis as any).fetch;
    const enc = new TextEncoder();
    let sent: Record<string, unknown> = {};
    (globalThis as any).fetch = async (_url: string, init: any) => {
      sent = JSON.parse(init.body);
      const stream = new ReadableStream({
        start(c) {
          c.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: 'ok' } }] })}\n\n`));
          c.enqueue(enc.encode('data: [DONE]\n\n'));
          c.close();
        },
      });
      return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    };
    const ask = (cfg: Record<string, unknown>) =>
      streamChat({ apiKey: 'k', agreed: true, ...cfg } as never, [{ role: 'user', content: 'hi' }], () => {});

    try {
      // ① DeepSeek 关闭：thinking.type=disabled，且不得同时带 reasoning_effort
      await ask({ providerId: 'deepseek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', thinkingEffort: 'off' });
      assert.deepEqual(sent.thinking, { type: 'disabled' });
      assert.equal(sent.reasoning_effort, undefined);

      // ② DeepSeek 标准 / 深度：显式低强度与高强度，两者不同
      await ask({ providerId: 'deepseek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', thinkingEffort: 'standard' });
      assert.equal(sent.reasoning_effort, 'low');
      await ask({ providerId: 'deepseek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', thinkingEffort: 'deep' });
      assert.equal(sent.reasoning_effort, 'high');

      // ③ 通义千问标准：平台默认上限 4000；深度：放开上限（无 thinking_budget）
      await ask({ providerId: 'dashscope', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', thinkingEffort: 'standard' });
      assert.equal(sent.enable_thinking, true);
      assert.equal(sent.thinking_budget, 4000);
      await ask({ providerId: 'dashscope', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', thinkingEffort: 'deep' });
      assert.equal(sent.enable_thinking, true);
      assert.equal(sent.thinking_budget, undefined, '深度档必须放开上限');

      // ④ GLM-5.3 关闭（纯推理模型关不掉）：安全回落为标准档——绝不下发 disabled（会被拒），
      //    回落后按标准档下发较低力度，与界面留痕完全一致
      await ask({ providerId: 'zhipu', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-5.3', thinkingEffort: 'off' });
      assert.equal(sent.thinking, undefined, 'GLM-5.3 传 disabled 会报错');
      assert.equal(sent.reasoning_effort, 'low', '关不掉的模型必须回落标准档，而非静默不下发');
      await ask({ providerId: 'zhipu', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-5.3', thinkingEffort: 'deep' });
      assert.equal(sent.reasoning_effort, 'max');

      // ⑤ 自定义端点：能力表不介入，只合并用户透传
      await ask({ providerId: 'custom', baseUrl: 'https://x.example.com/v1', model: 'm', thinkingEffort: 'deep', extraParamsText: '{"reasoning_effort":"max","top_p":0.9}' });
      assert.equal(sent.reasoning_effort, 'max');
      assert.equal(sent.top_p, 0.9);
      assert.equal(sent.thinking, undefined);
      assert.equal(sent.model, 'm');
      assert.equal(sent.stream, true);

      // ⑥ 非自定义端点不得外泄透传参数
      await ask({ providerId: 'deepseek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', thinkingEffort: 'standard', extraParamsText: '{"top_p":0.9}' });
      assert.equal(sent.top_p, undefined);
    } finally {
      (globalThis as any).fetch = originalFetch;
    }
  });
}

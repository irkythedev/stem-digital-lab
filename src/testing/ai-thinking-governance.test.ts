/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * AI 思考治理守卫（注册模块，不含执行入口）：
 *   1. 任务分级思考派发：judge 极简（能关则关 / 回落最低档），quick 上限 standard，chat 尊重 deep；
 *   2. 上下文清洗门禁 stripThinkingFromHistory：抹掉 <think>/<thinking>/<reasoning> 全部草稿；
 *   3. Prompt 防冗余契约：系统提示与判分提示内联「直奔推导关键」的克制法则。
 *
 * 零 DOM、零 async、纯函数断言。
 */
import assert from 'node:assert';
import type { TestFn } from './harness';
import {
  CHAIN_MAX_TOKENS, buildFillJudgePrompt, buildSystemPrompt, resolveThinkingDispatch, streamChat, stripThinkingFromHistory,
  type AiConfig,
} from '../lib/ai-config';

function cfg(partial: Partial<AiConfig>): AiConfig {
  return { providerId: 'deepseek', apiKey: 'k', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', agreed: true, ...partial };
}

/**
 * 拦截一次 streamChat 的实际 HTTP POST 请求体（真实 payload 断言，防 judge 被打回无限制思考）。
 * 返回捕获到的 requestInit.body 解析对象。
 */
async function captureRequest(initCfg: AiConfig, task: 'judge'): Promise<Record<string, any>> {
  const originalFetch = (globalThis as unknown as { fetch: typeof fetch }).fetch;
  let captured: Record<string, any> | null = null;
  const enc = new TextEncoder();
  const sse = (obj: unknown) => `data: ${JSON.stringify(obj)}\n\n`;
  (globalThis as any).fetch = async (_url: any, init: any) => {
    captured = JSON.parse(init.body);
    const stream = new ReadableStream({
      start(c) {
        c.enqueue(enc.encode(sse({ choices: [{ delta: { content: 'Y' } }] })));
        c.enqueue(enc.encode('data: [DONE]\n\n'));
        c.close();
      },
    });
    return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
  };
  try {
    await streamChat(initCfg, [{ role: 'user', content: 'hi' }], () => {}, undefined, CHAIN_MAX_TOKENS.judge, undefined, task);
  } finally {
    (globalThis as any).fetch = originalFetch;
  }
  assert.ok(captured, '未能拦截到 fetch 请求体');
  return captured as Record<string, any>;
}

export function registerAiThinkingGovernanceTests(test: TestFn, testAsync: TestFn): void {
  // ── 上下文清洗门禁 ─────────────────────────────────────
  test('stripThinkingFromHistory：成对 <think>/<thinking>/<reasoning>（含跨行）全部抹除', () => {
    const src = '前言<think>需要先想一步\n再想一步</think>正文A<thinking>内部</thinking>正文B';
    assert.equal(stripThinkingFromHistory(src), '前言正文A正文B');
    const multi = '答案<reasoning>\n一\n二\n三</reasoning>结束';
    assert.equal(stripThinkingFromHistory(multi), '答案结束');
  });

  test('stripThinkingFromHistory：大小写不敏感 + 未闭合开标签删到结尾 + 孤立闭标签清理', () => {
    assert.equal(stripThinkingFromHistory('A<THINK>草稿</THINK>B'), 'AB');
    assert.equal(stripThinkingFromHistory('结论<think>未闭合的草稿一直在'), '结论');
    assert.equal(stripThinkingFromHistory('正常正文</thinking>残留'), '正常正文残留');
    assert.equal(stripThinkingFromHistory('干净的一句话'), '干净的一句话');
    assert.equal(stripThinkingFromHistory(''), '');
  });

  // ── 任务分级思考派发 ───────────────────────────────────
  test('judge：deepseek 深度档下也强制关闭思考（thinking.type=disabled）', () => {
    const d = resolveThinkingDispatch(cfg({ thinkingEffort: 'deep' }), 'judge');
    assert.equal(d.effort, 'off');
    assert.deepEqual(d.params, { thinking: { type: 'disabled' } });
    assert.match(d.summaryText, /thinking\.type=disabled/);
  });

  test('judge：不可关闭的纯推理模型（kimi-k3）回落到最低力度 low', () => {
    const d = resolveThinkingDispatch(cfg({ providerId: 'moonshot', model: 'kimi-k3', thinkingEffort: 'deep' }), 'judge');
    assert.equal(d.effort, 'standard');
    assert.deepEqual(d.params, { reasoning_effort: 'low' });
  });

  test('quick：deep 降为 standard（reasoning_effort=low），chat 保留 deep（high）', () => {
    const q = resolveThinkingDispatch(cfg({ thinkingEffort: 'deep' }), 'quick');
    assert.equal(q.effort, 'standard');
    assert.deepEqual(q.params, { reasoning_effort: 'low' });
    const c = resolveThinkingDispatch(cfg({ thinkingEffort: 'deep' }), 'chat');
    assert.equal(c.effort, 'deep');
    assert.deepEqual(c.params, { reasoning_effort: 'high' });
  });

  test('chat：未设置档位按 standard 处理（不受任务分级影响）', () => {
    const d = resolveThinkingDispatch(cfg({}), 'chat');
    assert.equal(d.effort, 'standard');
    assert.deepEqual(d.params, { reasoning_effort: 'low' });
  });

  // ── Prompt 防冗余契约 ─────────────────────────────────
  test('系统提示（中/英）注入「直奔推导关键 / go straight to the key derivation」克制法则', () => {
    const zh = buildSystemPrompt('zh');
    assert.match(zh, /思考需直奔推导关键/, '中文系统提示缺少克制法则');
    assert.match(zh, /以最快速度进入正文输出/, '中文系统提示缺少「最快进入正文」约束');
    const en = buildSystemPrompt('en');
    assert.match(en, /go straight to the key derivation/, 'English system prompt missing restraint rule');
    assert.match(en, /reach the body as fast as possible/, 'English system prompt missing "reach the body" rule');
  });

  test('判分提示（中/英）注入「不要展开推演，直接 Y/N」约束', () => {
    const zh = buildFillJudgePrompt('zh', '题', '答', ['标准']).system;
    assert.match(zh, /不要展开推演或解释，直接给出 Y\/N/, '中文判分提示缺少精简约束');
    const en = buildFillJudgePrompt('en', 'q', 'a', ['std']).system;
    assert.match(en, /do not reason it out at length; answer Y\/N directly/, 'English judge prompt missing brevity rule');
  });

  // ── 端到端 Payload 断言：拦截真实请求体，锁死 judge 不无限制思考 ────────────
  testAsync('E2E payload：DeepSeek judge 请求体 thinking.type 必须为 disabled', async () => {
    const body = await captureRequest(cfg({ providerId: 'deepseek', model: 'deepseek-chat', thinkingEffort: 'deep' }), 'judge');
    assert.equal(body.model, 'deepseek-chat');
    assert.deepEqual(body.thinking, { type: 'disabled' }, 'DeepSeek judge 必须发送 thinking.type=disabled');
    assert.ok(!('reasoning_effort' in body), 'DeepSeek 关闭思考时不得再带 reasoning_effort');
    assert.equal(body.stream, true);
    assert.ok(Array.isArray(body.messages) && body.messages.length > 0, 'messages 结构不变');
  });

  testAsync('E2E payload：Qwen judge 请求体 enable_thinking 必须为 false', async () => {
    const body = await captureRequest(cfg({ providerId: 'dashscope', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', thinkingEffort: 'deep' }), 'judge');
    assert.equal(body.enable_thinking, false, 'Qwen judge 必须发送 enable_thinking=false');
    assert.ok(!('thinking_budget' in body), 'Qwen 关闭思考时不得再带 thinking_budget');
    assert.ok(!('thinking' in body));
  });
}

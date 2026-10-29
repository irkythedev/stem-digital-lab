/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * AI 思考流分离守卫（注册模块，不含执行入口）。
 *
 * 迁移来源：`src/smoke.test.ts` 的 `AI thinking stream (display only)` 套件，
 * **整组 6 个用例一次迁出**（含 2 个 `testAsync`）。用例名、断言、错误消息与执行顺序
 * 与迁移前逐字相同；本套件零文件读取。
 *
 * 随块搬迁的两个文件级常量（原 smoke 顶层、仅本套件使用，块外零引用，逐字照搬）：
 * `T_OPEN` / `T_CLOSE` —— 内联思考标签的字面量。
 *
 * 依赖特征：零 DOM；两个 async 用例替换 `globalThis.fetch` 并在 `finally` 还原。
 *
 * 本模块不导入 smoke.test.ts，也不导入 harness 的具体实现，只接收注入的测试注册函数。
 */
import assert from 'node:assert';
import type { TestFn } from './harness';
import {
  EmptyAnswerError, classifyChatFailure, createInlineThinkSplitter, extractStreamDelta, isLengthTruncated, streamChat,
} from '../lib/ai-config';

export function registerAiThinkingStreamTests(test: TestFn, testAsync: TestFn): void {
  /** 内联思考标签字面量（原 smoke 文件级常量，仅本套件使用）。 */
  const T_OPEN = '<`think>';
  const T_CLOSE = '</`think>';
  test('流式 delta：思考字段名各家不同，正文永不被污染', () => {
    assert.deepEqual(extractStreamDelta({ choices: [{ delta: { content: '正文' } }] }), { content: '正文', reasoning: '' });
    assert.deepEqual(extractStreamDelta({ choices: [{ delta: { reasoning_content: '想' } }] }), { content: '', reasoning: '想' });
    assert.deepEqual(extractStreamDelta({ choices: [{ delta: { reasoning: '想' } }] }), { content: '', reasoning: '想' },
      'vLLM 系用 reasoning 字段');
    assert.deepEqual(extractStreamDelta({ choices: [{ delta: { reasoning_content: 'A', reasoning: 'B', content: 'C' } }] }),
      { content: 'C', reasoning: 'A' }, '两个思考字段同时出现时优先 reasoning_content');
    assert.deepEqual(extractStreamDelta({}), { content: '', reasoning: '' });
    assert.deepEqual(extractStreamDelta(null), { content: '', reasoning: '' });
  });

  test('内联思考标签：正文/思考各归各位，闭标签之后一律正文', () => {
    const got: string[] = [];
    const s = createInlineThinkSplitter((ch, t) => got.push(`${ch}:${t}`));
    s.push(`前文${T_OPEN}思考中${T_CLOSE}后文`);
    s.flush();
    assert.deepEqual(got, ['content:前文', 'reasoning:思考中', 'content:后文']);
  });

  test('内联标签跨 chunk：标签被切开也不能漏进正文', () => {
    const got: string[] = [];
    const s = createInlineThinkSplitter((ch, t) => got.push(`${ch}:${t}`));
    s.push(`A${T_OPEN.slice(0, 5)}`);      // 半个开标签（还缺 nk>）
    s.push(`nk>B${T_CLOSE.slice(0, 5)}`);  // 补齐开标签 + 半个闭标签（还缺 ing>）
    s.push('ink>C');
    s.flush();
    assert.equal(got.join('|'), 'content:A|reasoning:B|content:C', `实际 ${got.join('|')}`);
  });

  test('未闭合的思考标签：余下内容进思考通道，不污染正文', () => {
    const got: string[] = [];
    const s = createInlineThinkSplitter((ch, t) => got.push(`${ch}:${t}`));
    s.push(`A${T_OPEN}B`);
    s.flush();
    assert.equal(got.join('|'), 'content:A|reasoning:B');
  });

  testAsync('streamChat 端到端：思考走 reasoning 通道，返回值只有正文', async () => {
    const originalFetch = (globalThis as any).fetch;
    const enc = new TextEncoder();
    const sse = (obj: unknown) => `data: ${JSON.stringify(obj)}\n\n`;
    (globalThis as any).fetch = async () => {
      const stream = new ReadableStream({
        start(c) {
          c.enqueue(enc.encode(sse({ choices: [{ delta: { reasoning_content: '先想一下。' } }] })));
          c.enqueue(enc.encode(sse({ choices: [{ delta: { content: '结论' } }] })));
          c.enqueue(enc.encode(sse({ choices: [{ delta: { content: '在此' } }] })));
          c.enqueue(enc.encode('data: [DONE]\n\n'));
          c.close();
        },
      });
      return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    };
    try {
      const reasons: string[] = [];
      const contents: string[] = [];
      const res = await streamChat(
        { providerId: 'custom', apiKey: 'k', baseUrl: 'https://example.com/v1', model: 'm', agreed: true },
        [{ role: 'user', content: 'hi' }],
        (d) => contents.push(d),
        undefined,
        100,
        (r) => reasons.push(r),
      );
      assert.equal(res.text, '结论在此', '返回值只能是正文');
      assert.deepEqual(reasons, ['先想一下。'], '思考必须走 reasoning 通道');
      assert.deepEqual(contents, ['结论', '在此']);
      assert.equal(res.finishReason, null, '端点没给 finish_reason 时必须是 null，不能编一个 stop');
      assert.equal(res.usage, null, '端点没给 usage 时必须是 null');
      assert.equal(res.complete, true, '收到 [DONE] 即算正常收完');
    } finally {
      (globalThis as any).fetch = originalFetch;
    }
  });

  testAsync('streamChat：记录 finish_reason/usage，思考吃满预算时正文为空但不报错（交调用方判定）', async () => {
    const originalFetch = (globalThis as any).fetch;
    const enc = new TextEncoder();
    const sse = (obj: unknown) => `data: ${JSON.stringify(obj)}\n\n`;
    (globalThis as any).fetch = async () => {
      const stream = new ReadableStream({
        start(c) {
          c.enqueue(enc.encode(sse({ choices: [{ delta: { reasoning_content: '想很久很久' } }] })));
          c.enqueue(
            enc.encode(
              sse({
                choices: [{ delta: {}, finish_reason: 'length' }],
                usage: { prompt_tokens: 12, completion_tokens: 100, total_tokens: 112 },
              }),
            ),
          );
          c.enqueue(enc.encode('data: [DONE]\n\n'));
          c.close();
        },
      });
      return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    };
    try {
      const res = await streamChat(
        { providerId: 'custom', apiKey: 'k', baseUrl: 'https://example.com/v1', model: 'm', agreed: true },
        [{ role: 'user', content: 'hi' }],
        () => {},
      );
      assert.equal(res.text, '', '思考不算正文');
      assert.equal(res.finishReason, 'length', '「思考吃满预算」必须能被调用方看见');
      assert.ok(isLengthTruncated(res), '截断判定必须为真');
      assert.equal(res.complete, true, '端点给了 finish_reason 就算收完（length 也是收完）');
      assert.deepEqual(res.usage, { promptTokens: 12, completionTokens: 100, totalTokens: 112 }, 'usage 必须归一成数字');
      // 空正文 + length 交给分类器 → 学生看到「没输出正文，请重试」并拿到重试按钮，而不是空白框
      const empty = classifyChatFailure(new EmptyAnswerError(res.finishReason));
      assert.equal(empty.kind, 'empty');
      assert.equal(empty.retryable, true, '空正文必须可重试（重采样通常就有正文）');
      assert.equal(empty.raw, '', 'raw 不得给学生看 finish_reason=length 这类术语');
      assert.equal(classifyChatFailure(new EmptyAnswerError('stop')).kind, 'empty', '空正文与结束原因无关，一律按空正文处理');
    } finally {
      (globalThis as any).fetch = originalFetch;
    }
  });
}

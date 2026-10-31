/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 输出上限与空正文防御守卫（注册模块，不含执行入口）。
 *
 * 迁移来源：`src/smoke.test.ts` 的同名 describe，**整组 10 个用例一次迁出**（含 3 个 async）。
 * 用例名、断言、正则、错误消息与执行顺序与迁移前逐字相同；2 处 `readFileSync('src/…')`
 * 改走 `readSrc()`，`readAiPanel()` 换成 `./ai-panel-source` 的同义实现。
 *
 * 依赖特征：零 DOM；三个 async 用例用 `ReadableStream` 制造切断 / 首包超时，自包含。
 *
 * 本模块不导入 smoke.test.ts，也不导入 harness 的具体实现，只接收注入的测试注册函数。
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import type { TestFn } from './harness';
import { AI_PANEL_FILES as PANEL_FILES, readAiPanel } from './ai-panel-source';
import { repoPath } from './repo-paths';
import { isStoppedAnswer, markStopped, markTruncated, stripStoppedMark } from '../lib/ai-history';
import {
  CHAIN_MAX_TOKENS, EmptyAnswerError, classifyChatFailure, classifyStreamOutcome, resolveMaxTokens, streamChat,
} from '../lib/ai-config';

export function registerAiOutputLimitsTests(test: TestFn, testAsync: TestFn): void {
  /** 读仓库内源码：参数保持仓库相对路径，错误消息里的文件标识也不变。 */
  const readSrc = (p: string, enc: BufferEncoding = 'utf8') => readFileSync(repoPath(p), enc);
  /** 面板文件清单（与 smoke 中的同名常量同源，此处只做存在性提示，避免未使用告警）。 */
  void PANEL_FILES;
  test('resolveMaxTokens：用户显式上限优先，未设置才用链路默认，都没有就不下发', () => {
    assert.equal(resolveMaxTokens({ maxOutputTokens: 3000 }, 2000), 3000, '用户设置优先于链路默认');
    assert.equal(resolveMaxTokens({ maxOutputTokens: 3000 }, undefined), 3000);
    assert.equal(resolveMaxTokens({}, 2048), 2048, '未设置时用链路默认');
    assert.equal(resolveMaxTokens({}, undefined), undefined, '两者都没有 → 不下发 max_tokens');
    assert.equal(resolveMaxTokens(null, undefined), undefined);
    assert.equal(resolveMaxTokens({ maxOutputTokens: 0 }, undefined), undefined, '0 = 不限');
    assert.equal(resolveMaxTokens({ maxOutputTokens: -5 }, undefined), undefined, '负数 = 不限');
    assert.equal(resolveMaxTokens({ maxOutputTokens: Number.NaN }, 2048), 2048, '非法值回落链路默认');
    assert.equal(resolveMaxTokens({ maxOutputTokens: 3000.7 }, undefined), 3000, '上限必须是整数');
  });

  test('链路默认：对话/出题/归纳不下发上限，判分留足思考余量', () => {
    assert.equal(CHAIN_MAX_TOKENS.chat, undefined, '对话封顶正是「有思考、无正文」的成因');
    assert.equal(CHAIN_MAX_TOKENS.quiz, undefined, '出题完整性交给 ===END=== 校验 + 一次修复');
    assert.equal(CHAIN_MAX_TOKENS.summary, undefined, '归纳同样不封顶，避免思考吃满上限导致正文为空');
    assert.ok((CHAIN_MAX_TOKENS.judge ?? 0) >= 1024, '判分上限不得低于 1024（旧的 20 连思考的零头都不够）');
  });

  test('代码级防漂移：面板不得再给对话/出题/判分写死小上限', () => {
    const ai = readAiPanel();
    assert.match(ai, /CHAIN_MAX_TOKENS\.chat/, '对话链路必须走链路默认');
    assert.match(ai, /CHAIN_MAX_TOKENS\.quiz/, '出题链路必须走链路默认');
    assert.match(ai, /CHAIN_MAX_TOKENS\.judge/, '判分链路必须走链路默认');
    assert.match(ai, /CHAIN_MAX_TOKENS\.summary/, '归纳链路必须走链路默认');
    assert.doesNotMatch(ai, /2000, \/\/ 对话输出上限/, '对话固定 2000 上限必须废除');
    assert.doesNotMatch(ai, /4000, \/\/ 出题输出上限/, '出题固定 4000 上限必须废除');
    assert.doesNotMatch(ai, /signal\.signal, 20\)/, '判分固定 20 上限必须废除');
  });

  test('空正文入失败态：不落盘、不入历史、给重试', () => {
    const ai = readAiPanel();
    assert.match(ai, /if \(outcome === 'empty'\) throw new EmptyAnswerError\(res\.finishReason\)/, '对话空正文必须抛 EmptyAnswerError');
    assert.match(ai, /markTruncated\(rawBody, lang, outcome === 'cut' \? 'cut' : 'limit'\)/, '没写完的正文必须按成因标注');
    assert.match(ai, /const body = stripThinkingFromHistory\(/, '正文落盘/入历史前必须经思考清洗门禁');
    const i18n = readSrc('src/lib/i18n.ts', 'utf8');
    assert.match(i18n, /empty: '模型这次没有输出正文/, '中文文案必须说明「没输出正文」');
    assert.match(i18n, /empty: 'The model produced no answer this time/, '英文文案必须同步');
  });

  test('收尾判定：空正文 / 上限截断 / 连接切断 / 正常，四态互不混淆', () => {
    const R = (text: string, finishReason: string | null, complete: boolean) => ({ text, finishReason, complete });
    assert.equal(classifyStreamOutcome(R('', 'length', true)), 'empty', '一个字都没有 → empty（当失败重试）');
    assert.equal(classifyStreamOutcome(R('   ', 'stop', true)), 'empty', '纯空白同样算空正文');
    assert.equal(classifyStreamOutcome(R('半句', 'length', true)), 'limit', '端点说被上限掐断 → limit');
    assert.equal(classifyStreamOutcome(R('半句', null, false)), 'cut', '没有收尾信号 → cut（连接被中途切断）');
    assert.equal(classifyStreamOutcome(R('完整回答', 'stop', true)), 'ok');
    assert.equal(classifyStreamOutcome(R('完整回答', null, true)), 'ok', '端点不给 finish_reason 但有 [DONE] 也算正常收完');
    assert.equal(classifyStreamOutcome(null), 'empty');
  });

  test('截断标记：可续写、可剥离，且与「已停止」互不混淆', () => {
    assert.equal(markTruncated('', 'zh'), '', '空回答不得只留标记');
    const zh = markTruncated('电流与电压成正比', 'zh');
    assert.ok(zh.endsWith('[输出已达上限]'), '中文用 [输出已达上限]');
    assert.equal(markTruncated(zh, 'zh'), zh, '重复标记必须幂等');
    assert.ok(markTruncated('current is proportional', 'en').endsWith('[output limit reached]'), '英文用 [output limit reached]');
    assert.equal(isStoppedAnswer(zh), true, '被截断的正文同样要给「继续生成」入口');
    assert.equal(stripStoppedMark(zh), '电流与电压成正比', '发给模型的正文必须剥掉标记');
    assert.equal(stripStoppedMark(markStopped('残句', 'zh')), '残句');
    // 连接被中途切断：用词与「上限截断」不同（对学生信息不同），但同样可续写、可剥离
    const cut = markTruncated('连接到一半的内容', 'zh', 'cut');
    assert.ok(cut.endsWith('[连接被中断，内容可能未写完]'), '切断用 [连接被中断，内容可能未写完]');
    assert.notEqual(cut, markTruncated('连接到一半的内容', 'zh', 'limit'), '两种成因不得共用同一标记');
    assert.equal(isStoppedAnswer(cut), true, '被切断的正文也要给「继续生成」入口');
    assert.equal(stripStoppedMark(cut), '连接到一半的内容', '切断标记同样必须剥离');
    assert.ok(markTruncated('cut off', 'en', 'cut').endsWith('[connection cut off — content may be incomplete]'), '英文切断标记同步');
  });

  testAsync('半途切断且有正文：不抛错，返回残句并标 complete=false（网关 60s 切断会走到这里）', async () => {
    const originalFetch = (globalThis as any).fetch;
    const enc = new TextEncoder();
    const sse = (obj: unknown) => `data: ${JSON.stringify(obj)}\n\n`;
    (globalThis as any).fetch = async () => {
      const stream = new ReadableStream({
        start(c) {
          c.enqueue(enc.encode(sse({ choices: [{ delta: { content: '前半句' } }] })));
          c.enqueue(enc.encode(sse({ choices: [{ delta: { content: '后半句' } }] })));
          // 连接被切断：没有 finish_reason，也没有 [DONE]。
          // 异步 error：同步调用会让 Node 把流错误抛成未捕获异常
          setTimeout(() => c.error(new Error('terminated')), 0);
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
      assert.equal(res.text, '前半句后半句', '已经收到的正文不得丢弃');
      assert.equal(res.complete, false, '没收到收尾信号必须标 complete=false');
      assert.equal(classifyStreamOutcome(res), 'cut');
    } finally {
      (globalThis as any).fetch = originalFetch;
    }
  });

  testAsync('半途切断且一个字都没有：按空正文上抛（可重试），不假装成功也不含糊报网络错', async () => {
    const originalFetch = (globalThis as any).fetch;
    const enc = new TextEncoder();
    (globalThis as any).fetch = async () => {
      // 流已经开始（先来一个空 delta），随后被切断：正是网关 60s 掐断、模型还在思考的样子
      const stream = new ReadableStream({
        start(c) {
          c.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { role: 'assistant', content: '' } }] })}\n\n`));
          setTimeout(() => c.error(new Error('terminated')), 0);
        },
      });
      return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    };
    try {
      let caught: unknown = null;
      try {
        await streamChat(
          { providerId: 'custom', apiKey: 'k', baseUrl: 'https://example.com/v1', model: 'm', agreed: true },
          [{ role: 'user', content: 'hi' }],
          () => {},
        );
      } catch (e) {
        caught = e;
      }
      assert.ok(caught instanceof EmptyAnswerError, '必须是空正文错误，而不是含糊的网络错误');
      const c = classifyChatFailure(caught);
      assert.equal(c.kind, 'empty');
      assert.equal(c.retryable, true, '一个字都没收到时重发一次通常就有正文，必须给重试');
    } finally {
      (globalThis as any).fetch = originalFetch;
    }
  });

  testAsync('响应都没开始（首包超时）：仍是 timeout，不能伪装成空正文', async () => {
    const originalFetch = (globalThis as any).fetch;
    (globalThis as any).fetch = async () => {
      const stream = new ReadableStream({ start(c) { setTimeout(() => c.error(new Error('terminated')), 0); } });
      return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    };
    try {
      let caught: unknown = null;
      try {
        await streamChat(
          { providerId: 'custom', apiKey: 'k', baseUrl: 'https://example.com/v1', model: 'm', agreed: true },
          [{ role: 'user', content: 'hi' }],
          () => {},
        );
      } catch (e) {
        caught = e;
      }
      assert.ok(caught && !(caught instanceof EmptyAnswerError), '一个事件都没收到时不得报成空正文');
    } finally {
      (globalThis as any).fetch = originalFetch;
    }
  });

  test('学生点停止（外层 abort）不当作「切断」：走「已停止」语义', () => {
    const ai = readSrc('src/lib/ai-config.ts', 'utf8');
    assert.match(ai, /const userAborted = !!signal\?\.aborted;/, '切断返回残句前必须排除学生主动停止');
    assert.match(ai, /if \(!userAborted && full\.trim\(\)\) return \{ text: full, finishReason, usage, complete: false \}/, '只有非学生停止且已有正文才返回残句');
  });
}

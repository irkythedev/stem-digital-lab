/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * TtsPlayer 全局单例：token 失效、排他切换、文本清洗与 Utterance 持有。
 * 纯 Node 测试：通过注入 fake SpeechSynthesis 宿主，不依赖真实浏览器。
 */
import assert from 'node:assert';
import type { TestFn } from '../../harness';
import { DEFAULT_TTS_CONFIG } from '../../../lib/tts-config';
import { prepareSpeechText, TtsPlayer } from '../../../lib/tts-player';

/** 最小 fake speechSynthesis + SpeechSynthesisUtterance；记录调用顺序。 */
function makeHost() {
  const calls: string[] = [];
  const speaks: string[] = [];
  class FakeUtterance {
    lang = '';
    rate = 1;
    voice: unknown;
    onstart: (() => void) | null = null;
    onend: (() => void) | null = null;
    onerror: ((e?: unknown) => void) | null = null;
    onpause: (() => void) | null = null;
    onresume: (() => void) | null = null;
    constructor(public text: string) {}
  }
  const host = {
    speechSynthesis: {
      cancel: () => calls.push('cancel'),
      speak: (u: unknown) => {
        const utter = u as FakeUtterance;
        calls.push(`speak:${utter.text}`);
        speaks.push(utter.text);
        utter.onstart?.();
      },
      getVoices: () => [],
    },
    SpeechSynthesisUtterance: FakeUtterance,
  };
  return { host, calls, speaks };
}

const localConfig = () => ({
  ...DEFAULT_TTS_CONFIG,
  engine: 'cloud' as const,
  endpoint: '',
  apiKey: '',
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function registerTtsPlayerTests(test: TestFn): void {
  test('快速连续 play：旧 token 不发声，只有最后一次 speak，且 cancel 在 speak 前', async () => {
    const { host, calls, speaks } = makeHost();
    const player = new TtsPlayer({ host, loadConfig: localConfig, waitMs: 1 });
    await Promise.all([
      player.play({ id: 'a', text: '第一条', lang: 'zh' }),
      player.play({ id: 'b', text: '第二条', lang: 'zh' }),
    ]);
    await sleep(10);
    assert.equal(player.getSnapshot().activeId, 'b');
    assert.deepEqual(speaks, ['第二条'], '只有第二次播放可以进入 speechSynthesis');
    assert.ok(calls.filter((c) => c === 'cancel').length >= 2, '每次 play 都要 cancel');
    assert.ok(calls.indexOf('cancel') < calls.indexOf('speak:第二条'), 'cancel 必须在最终 speak 前');
  });

  test('不同 ID 排他切换：前一条停止，activeId 切换到新 ID', async () => {
    const { host, speaks } = makeHost();
    const player = new TtsPlayer({ host, loadConfig: localConfig, waitMs: 1 });
    await player.play({ id: 'first', text: '旧条目', lang: 'zh' });
    await sleep(10);
    assert.equal(player.getSnapshot().activeId, 'first');
    player.toggle({ id: 'second', text: '新条目', lang: 'zh' });
    await sleep(20);
    assert.equal(player.getSnapshot().activeId, 'second');
    assert.deepEqual(speaks, ['旧条目', '新条目']);
  });

  test('文本清洗：剔除「可以继续了解」和追问，保留 LaTeX 公式口语', async () => {
    const raw = '函数 \\(y=-2x^2+3\\) 的顶点是 (0,3)。\n可以继续了解：\n1. 二次函数的对称轴怎么求？\n2. 顶点式怎么配方？';
    const prepared = prepareSpeechText(raw, 'zh');
    assert.ok(!prepared.includes('可以继续了解'), '不得保留追问标记');
    assert.ok(!prepared.includes('对称轴怎么求'), '不得朗读追问列表');
    assert.ok(prepared.includes('y等于负2 x 平方加3'), 'LaTeX 公式须走口语化');
  });

  test('Utterance 单例持有，onend 后释放并进入 finished', async () => {
    const { host } = makeHost();
    const player = new TtsPlayer({ host, loadConfig: localConfig, waitMs: 1 });
    await player.play({ id: 'held', text: '朗读正文', lang: 'zh' });
    await sleep(10);
    const u = player.getUtterance();
    assert.ok(u, '播放期间必须持有 utterance，避免 GC');
    u?.onend?.();
    assert.equal(player.getUtterance(), null, 'onend 后应释放引用');
    assert.equal(player.getSnapshot().state, 'finished');
    assert.equal(player.getSnapshot().finishedText, '朗读正文');
  });
}

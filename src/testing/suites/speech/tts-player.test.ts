/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * TtsPlayer 全局单例测试独立入口。
 */
import { runEntry } from '../../run-entry';
import { registerTtsPlayerTests } from './tts-player.suite';

await runEntry({
  suite: 'TTS 单例播放器 · Token 失效与排他',
  register: registerTtsPlayerTests,
});

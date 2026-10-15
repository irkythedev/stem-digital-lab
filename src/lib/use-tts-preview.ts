/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 语音「试听」hook（设置面板原位试听专用）。
 *
 * 与朗读主链路（use-speak）刻意分离：
 * - 主链路要分段、缓存、接下一段；试听只播一句样例，独立状态、互不干扰；
 * - 云端试听失败**不回落**：试听的目的正是验证用户填的端点/Key/音色能否连通，
 *   静默换声等于骗人，所以云端失败必须如实报错（文案不含状态码）。
 * 引擎与配置读取与主链路同源（loadTtsConfig / speakLocally / fetchCloudSpeech）。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { isCloudTtsReady, loadTtsConfig, normalizeSpeechEndpoint, preferredLocalVoice, type TtsConfig } from './tts-config';
import { fetchCloudSpeech, localVoiceLang, pickLocalVoice, resolveLocalVoice, speakLocally, type LocalSpeechHost } from './use-speak';
import { fetchScfSpeech } from './use-speak';
import { getTtsVoice } from './tts-config';
import { setTtsStatus } from './tts-status';

export type PreviewState = 'idle' | 'speaking';

/** 试听目标语言（状态与按钮一一对应：只有正在播的那个按钮显示「播放中…」） */
export type PreviewKey = 'zh' | 'en';

/** 试听样例（中英各一句，贴合本站身份） */
export const TTS_SAMPLE: Record<'zh' | 'en', string> = {
  zh: '欢迎使用数理化数字实验室。',
  en: 'Welcome to STEM Digital Lab.',
};

export function useTtsPreview() {
  const [state, setState] = useState<PreviewState>('idle');
  /** 当前正在试听的语言（null = 无）；与 state 同步变更 */
  const [activeKey, setActiveKey] = useState<PreviewKey | null>(null);
  const [error, setError] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tokenRef = useRef(0); // 递增令牌：旧请求/旧回调不得再改状态
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    tokenRef.current += 1;
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* 无 speechSynthesis 的环境忽略 */
    }
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.src = '';
    }
    audioRef.current = null;
    setState('idle');
    setActiveKey(null);
  }, []);

  /** 试听一句样例：默认走端侧语音；配置了可用云端则走用户端点。再次调用即中断。 */
  const preview = useCallback(
    async (lang: PreviewKey, cfg?: TtsConfig) => {
      // 再点同一个按钮 = 中断；点另一个按钮 = 切换试听目标（先停旧的）
      if (state === 'speaking') {
        stop();
        if (activeKey === lang) return;
      }
      setError('');
      const config = cfg ?? loadTtsConfig();
      const text = TTS_SAMPLE[lang];
      const token = tokenRef.current + 1;
      tokenRef.current = token;
      const alive = () => tokenRef.current === token;

      // 端侧路径（默认引擎，或云端配置不完整时也用它做明确提示前的最后尝试）
      const tryLocal = (): boolean =>
        speakLocally(text, lang, window as unknown as LocalSpeechHost, {
          preferredVoice: preferredLocalVoice(config, lang),
          onStart: () => {
            if (!alive()) return;
            setState('speaking');
            setActiveKey(lang);
            setError('');
          },
          onDone: () => {
            if (!alive()) return;
            if (watchdogRef.current) clearTimeout(watchdogRef.current);
            setState('idle');
            setActiveKey(null);
          },
        });

      // 内置云函数（默认引擎）：试听即验证「免配置高质量语音」这条链路
      if (config.engine === 'scf') {
        setState('speaking');
        setActiveKey(lang);
        setTtsStatus('probing');
        try {
          const bytes = await fetchScfSpeech(text, getTtsVoice(lang));
          if (!alive()) return;
          setTtsStatus('ready');
          const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.onended = () => {
            URL.revokeObjectURL(url);
            if (!alive()) return;
            audioRef.current = null;
            setState('idle');
            setActiveKey(null);
          };
          try {
            await audio.play();
          } catch (playErr) {
            // 已拿到音频、只是浏览器不放行：不是合成失败
            if (alive()) {
              setState('idle');
              setActiveKey(null);
              const name = playErr instanceof Error ? playErr.name : '';
              setError(
                name === 'NotAllowedError'
                  ? '语音已合成；浏览器拦截了自动播放，请点击页面空白处后再点「试听」'
                  : '语音已合成，但播放失败：请检查设备音量',
              );
            }
          }
        } catch {
          if (alive()) {
            setState('idle');
            setActiveKey(null);
            setError('内置语音试听失败：请检查网络，或改用系统语音 / 自定义云端');
            setTtsStatus('fallback', '内置云端通道不可用，已改用系统语音');
          }
        }
        return;
      }

      if (isCloudTtsReady(config)) {
        setState('speaking');
        setActiveKey(lang);
        setTtsStatus('probing');
        try {
          const bytes = await fetchCloudSpeech(text, config, '');
          if (!alive()) return;
          setTtsStatus('ready');
          const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.onended = () => {
            URL.revokeObjectURL(url);
            if (!alive()) return;
            audioRef.current = null;
            setState('idle');
          };
          await audio.play();
        } catch {
          // 试听不静默换声：如实报错（文案无状态码、无异常原文）
          if (alive()) {
            setState('idle');
            setActiveKey(null);
            setError('云端试听失败：请检查端点地址、API Key 与音色名');
            setTtsStatus('error', '自定义云端鉴权或端点异常');
          }
        }
        return;
      }

      if (config.engine === 'cloud' && !isCloudTtsReady(config)) {
        setTtsStatus('error', '端点或 Key 未填写完整，已改用系统语音');
      }

      if (tryLocal()) {
        // 端侧 utterance 已入队：先置「播放中」，onStart 会再确认；无语音包时看门狗兜底复位
        setState('speaking');
        setActiveKey(lang);
        if (watchdogRef.current) clearTimeout(watchdogRef.current);
        watchdogRef.current = setTimeout(() => {
          if (alive()) {
            setState('idle');
            setActiveKey(null);
          }
        }, 10000);
        return;
      }

      // 端侧也不可用（设备无语音包）：给出可操作的说明
      const want = localVoiceLang(lang);
      const hit = pickLocalVoice((window.speechSynthesis?.getVoices?.() ?? []) as never[], want);
      const pref = preferredLocalVoice(config, lang);
      if (pref && !hit) {
        const known = resolveLocalVoice((window.speechSynthesis?.getVoices?.() ?? []) as never[], '', lang);
        if (known) setError('所选发音人不在当前设备语音列表里，已改按语言自动选择后仍不可用');
        else setError('所选发音人不在当前设备语音列表里：请改回「自动」或另选发音人');
      } else {
        setError('当前设备未提供语音朗读能力：请在系统里安装中文/英文语音包，或改用自定义云端');
      }
    },
    [state, activeKey, stop],
  );

  useEffect(
    () => () => {
      tokenRef.current += 1;
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* 忽略 */
      }
      const a = audioRef.current;
      if (a) {
        a.pause();
        a.src = '';
      }
      audioRef.current = null;
    },
    [],
  );

  /**
   * 轻量连通性探测：只发一次极短合成、不播放、不动播放状态，仅把结果上报给状态指示器。
   * 用于「打开语音页即给出真实状态」——未核验就展示就绪等于虚报，故初始态是「未检测」，
   * 靠这次实测把它变成就绪 / 降级 / 异常。
   */
  const probe = useCallback(async (cfg?: TtsConfig) => {
    const config = cfg ?? loadTtsConfig();
    setTtsStatus('probing');
    try {
      if (config.engine === 'scf') {
        await fetchScfSpeech('好', getTtsVoice('zh'));
        setTtsStatus('ready');
      } else if (isCloudTtsReady(config)) {
        await fetchCloudSpeech('好', config, '');
        setTtsStatus('ready');
      } else {
        setTtsStatus('error', '端点或 Key 未填写完整');
      }
    } catch {
      if (config.engine === 'scf') setTtsStatus('fallback', '内置云端通道不可用，已改用系统语音');
      else setTtsStatus('error', '自定义云端鉴权或端点异常');
    }
  }, []);

  return { state, activeKey, error, preview, stop, probe };
}

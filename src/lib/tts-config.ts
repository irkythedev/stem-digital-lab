/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * TTS 服务配置：开发环境自动连本地 3100，生产环境需替换为腾讯云 SCF 地址。
 * 部署 SCF 后，将 PRODUCTION_URL 改为你的 API 网关地址。
 */
import { scfUrlWithToken } from './scf-token';

export const TTS_CONFIG = {
  /** 生产环境云函数 URL（部署腾讯云 SCF 后替换；当前临时指向本地 3100 便于预览测试） */
  PRODUCTION_URL: 'https://1307683613-fg2n0ky3me.ap-shanghai.tencentscf.com',
  /** 默认语音 */
  DEFAULT_VOICE: 'zh-CN-XiaoxiaoNeural',
  /** 单次合成文本上限 */
  MAX_TEXT: 1000,
};

/** 根据环境获取 TTS 服务 URL（dev 自动连本地 3100，生产用配置值；带 SCF token） */
export function getTtsUrl(): string {
  if (import.meta.env.DEV) {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    return `http://${host}:3100/tts`;
  }
  return scfUrlWithToken(TTS_CONFIG.PRODUCTION_URL);
}

/** 按界面语言选择朗读语音：中文用晓晓，英文用美音 Aria（朗读 AI 回答时贴合内容语言） */
export function getTtsVoice(lang: 'zh' | 'en'): string {
  return lang === 'en' ? 'en-US-AriaNeural' : TTS_CONFIG.DEFAULT_VOICE;
}
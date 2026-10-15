/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * TTS 通道状态源（设置面板「语音朗读」页状态指示器的数据来源）。
 *
 * 只记「本次会话内实测过一次」的结果，刻意**不落盘、不跨会话沿用**：
 * 未经核验就点亮绿灯等于虚报状态，所以初始态是 unknown（界面显示「未检测」），
 * 由一次真实合成（试听 / 朗读 / 打开语音页时的轻量探测）把它变成 ready / fallback / error。
 *
 * 状态说明一律不含 HTTP 状态码与异常原文，与全站错误文案纪律一致。
 */
import { useSyncExternalStore } from 'react';

export type TtsStatus = 'unknown' | 'probing' | 'ready' | 'fallback' | 'error';

let status: TtsStatus = 'unknown';
let detail = '';
const listeners = new Set<() => void>();

export function getTtsStatus(): TtsStatus {
  return status;
}

export function getTtsDetail(): string {
  return detail;
}

/** 上报状态：同值同说明时空转，避免无谓渲染 */
export function setTtsStatus(next: TtsStatus, nextDetail = ''): void {
  if (status === next && detail === nextDetail) return;
  status = next;
  detail = nextDetail;
  for (const listener of listeners) listener();
}

export function resetTtsStatus(): void {
  setTtsStatus('unknown');
}

export function subscribeTtsStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 组件内读取：状态与说明分开订阅，两者都是字符串快照，稳定无重渲染环 */
export function useTtsStatus(): { status: TtsStatus; detail: string } {
  const s = useSyncExternalStore(subscribeTtsStatus, getTtsStatus, getTtsStatus);
  const d = useSyncExternalStore(subscribeTtsStatus, getTtsDetail, getTtsDetail);
  return { status: s, detail: d };
}

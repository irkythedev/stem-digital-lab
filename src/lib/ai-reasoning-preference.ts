/**
 * AI 思考推理明细显示偏好（仅本机 localStorage，默认关闭）。
 * 与模型配置分离存储，避免切换服务商/清除配置时误影响用户阅读偏好。
 */
export const AI_SHOW_REASONING_KEY = 'stemlab:ai-show-reasoning';

export function loadAiShowReasoning(): boolean {
  if (typeof window === 'undefined') return false;
  try { return window.localStorage.getItem(AI_SHOW_REASONING_KEY) === '1'; } catch { return false; }
}

export function saveAiShowReasoning(next: boolean): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(AI_SHOW_REASONING_KEY, next ? '1' : '0'); } catch { /* 静默 */ }
}

/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * AI 上下文：全局 AI 助手状态（面板开关）+ 页面知识注入。
 * - open/setOpen：Header 的 AI 按钮控制助手面板开关
 * - setAiCtx：各页面向系统提示词注入当前页面实际知识（避免 AI 自由发挥）
 */
import { createContext, useContext, useState, type ReactNode } from 'react';

export interface AiPageContext {
  /** 当前主题（如「欧姆定律实验」「浮力公式」） */
  topic?: string;
  /** 页面知识摘要（注入系统提示词，供 AI 参考） */
  knowledge?: string;
}

interface AiContextValue {
  /** 助手面板是否打开 */
  open: boolean;
  setOpen: (v: boolean) => void;
  /** 是否已配置（决定入口红点提示）；由保存/清除时更新 */
  configured: boolean;
  setConfigured: (v: boolean) => void;
  aiCtx: AiPageContext;
  setAiCtx: (ctx: AiPageContext) => void;
}

const AiContext = createContext<AiContextValue>({
  open: false,
  setOpen: () => undefined,
  configured: false,
  setConfigured: () => undefined,
  aiCtx: {},
  setAiCtx: () => undefined,
});

export function AiProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [configured, setConfigured] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const raw = window.localStorage.getItem('stem-ai-config');
      if (!raw) return false;
      const c = JSON.parse(raw) as { apiKey?: string; baseUrl?: string; agreed?: boolean };
      return !!(c.apiKey && c.baseUrl && c.agreed);
    } catch {
      return false;
    }
  });
  const [aiCtx, setAiCtx] = useState<AiPageContext>({});
  return (
    <AiContext.Provider value={{ open, setOpen, configured, setConfigured, aiCtx, setAiCtx }}>
      {children}
    </AiContext.Provider>
  );
}

export function useAiContext(): AiContextValue {
  return useContext(AiContext);
}

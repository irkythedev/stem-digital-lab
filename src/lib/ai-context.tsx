/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * AI 上下文：全局 AI 助手状态 + 页面知识注入 + 一键问 AI 触发。
 * - open/setOpen：Header 的 AI 按钮控制助手面板开关
 * - setAiCtx：各页面向系统提示词注入当前页面实际知识（避免 AI 自由发挥）
 * - ask/askAi：页面「问 AI」按钮一键触发——携带预填问题，自动打开面板
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
  /** 一键问 AI：页面按钮携带的预填问题（消费后清空） */
  ask: string | null;
  askAi: (question: string) => void;
  setAsk: (q: string | null) => void;
  /** 出题练习：页面按钮触发打开面板并切到 quiz 视图（自增信号） */
  quizSignal: number;
  openQuiz: () => void;
}

const AiContext = createContext<AiContextValue>({
  open: false,
  setOpen: () => undefined,
  configured: false,
  setConfigured: () => undefined,
  aiCtx: {},
  setAiCtx: () => undefined,
  ask: null,
  askAi: () => undefined,
  setAsk: () => undefined,
  quizSignal: 0,
  openQuiz: () => undefined,
});

export function AiProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [configured, setConfigured] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const raw = window.localStorage.getItem('stem-ai-config');
      if (!raw) return false;
      const c = JSON.parse(raw) as { apiKey?: string; baseUrl?: string; model?: string; agreed?: boolean };
      return !!(c.apiKey && c.baseUrl && c.model && c.agreed);
    } catch {
      return false;
    }
  });
  const [aiCtx, setAiCtx] = useState<AiPageContext>({});
  const [ask, setAsk] = useState<string | null>(null);
  const [quizSignal, setQuizSignal] = useState(0);

  const askAi = (question: string) => {
    setAsk(question);
    setOpen(true);
  };

  const openQuiz = () => {
    setQuizSignal((s) => s + 1);
    setOpen(true);
  };

  return (
    <AiContext.Provider value={{ open, setOpen, configured, setConfigured, aiCtx, setAiCtx, ask, askAi, setAsk, quizSignal, openQuiz }}>
      {children}
    </AiContext.Provider>
  );
}

export function useAiContext(): AiContextValue {
  return useContext(AiContext);
}

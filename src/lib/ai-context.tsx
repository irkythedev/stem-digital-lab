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
import { loadAiConfig } from './ai-config';
import { refreshAiStatus } from './ai-status';

export interface AiPageContext {
  /** 当前主题（如「欧姆定律实验」「浮力公式」） */
  topic?: string;
  /** 页面知识摘要（注入系统提示词，供 AI 参考） */
  knowledge?: string;
  /**
   * 当前实验的实时状态摘要（如「预设：欧姆定律 · 阶段：探索 · I=0.42 A」）。
   * 与 ai-dynamic-questions 的易失读数注册表互补：live 变化不频繁，
   * 适合随系统提示词一起发送；逐帧读数仍走 getLabState。
   */
  live?: string;
  /**
   * 本页专属教学人设（如电学工作台的苏格拉底探究导师，见 socraticPersona）。
   * 与 topic 同级显示，但**不随 topic 变更清空会话**：它换的是「讲法」而不是「在讲哪一课」。
   * 页面离开时由设置方自己清掉（`persona: undefined`），否则会渗到别的页。
   */
  persona?: string;
}

interface AiContextValue {
  /** 助手面板是否打开 */
  open: boolean;
  setOpen: (v: boolean) => void;
  /** 是否已配置（决定入口红点提示）；由保存/清除时更新 */
  configured: boolean;
  setConfigured: (v: boolean) => void;
  aiCtx: AiPageContext;
  /** 支持函数式更新：子组件只改 live，不覆盖页面注入的 topic/knowledge。 */
  setAiCtx: (ctx: AiPageContext | ((prev: AiPageContext) => AiPageContext)) => void;
  /** 一键问 AI：页面按钮携带的预填问题（消费后清空） */
  ask: string | null;
  askAi: (question: string) => void;
  setAsk: (q: string | null) => void;
  /** 出题练习：页面按钮触发打开面板并切到 quiz 视图（自增信号） */
  quizSignal: number;
  openQuiz: () => void;
  /** 打开面板并直接切到设置视图（顶栏健康卡片「去设置」用；自增信号） */
  settingsSignal: number;
  openSettings: () => void;
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
  settingsSignal: 0,
  openSettings: () => undefined,
});

export function AiProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [configured, setConfigured] = useState(() => {
    // 复用 loadAiConfig 的完整校验（含端点协议白名单），不再各写一份解析。
    // 同时在此刻把顶栏四态算好：本初始化在首帧渲染前执行，图标不会先闪一下未配置。
    const saved = loadAiConfig();
    refreshAiStatus(saved);
    return !!saved;
  });
  const [aiCtx, setAiCtx] = useState<AiPageContext>({});
  const [ask, setAsk] = useState<string | null>(null);
  const [quizSignal, setQuizSignal] = useState(0);
  const [settingsSignal, setSettingsSignal] = useState(0);

  const askAi = (question: string) => {
    setAsk(question);
    setOpen(true);
  };

  const openQuiz = () => {
    setQuizSignal((s) => s + 1);
    setOpen(true);
  };

  const openSettings = () => {
    setSettingsSignal((s) => s + 1);
    setOpen(true);
  };

  return (
    <AiContext.Provider value={{ open, setOpen, configured, setConfigured, aiCtx, setAiCtx, ask, askAi, setAsk, quizSignal, openQuiz, settingsSignal, openSettings }}>
      {children}
    </AiContext.Provider>
  );
}

export function useAiContext(): AiContextValue {
  return useContext(AiContext);
}

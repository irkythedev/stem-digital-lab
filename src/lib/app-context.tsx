/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 全局应用上下文：语言(zh/en) + 主题(system/light/dark)。
 * 主题逻辑（含 prefers-color-scheme 监听）从原 App.tsx 抽出，集中于此。
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { translations, type Language, type Translation } from './i18n';

export type ThemeMode = 'system' | 'light' | 'dark';

interface AppContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: Translation;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  // 语言默认值：用户手动切换偏好优先（stem-lang）；无偏好时跟随系统语言（英文系统→英文，其余→中文）
  const [lang, setLangState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('stem-lang');
      if (saved === 'en' || saved === 'zh') return saved;
    } catch {
      /* 隐私模式等场景下 localStorage 不可用时静默回退 */
    }
    if (typeof navigator !== 'undefined' && /^en/i.test(navigator.language || '')) return 'en';
    return 'zh';
  });

  // 切换语言时持久化用户偏好，之后不再跟随系统语言
  const setLang = (l: Language) => {
    setLangState(l);
    try {
      localStorage.setItem('stem-lang', l);
    } catch {
      /* 忽略写入失败 */
    }
  };
  const [themeMode, setThemeMode] = useState<ThemeMode>('light');

  // 应用主题类到 <html>，并监听系统主题变化
  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      root.classList.remove('light', 'dark');
      if (themeMode === 'system') {
        root.classList.add(mediaQuery.matches ? 'dark' : 'light');
      } else {
        root.classList.add(themeMode);
      }
    };

    applyTheme();
    mediaQuery.addEventListener('change', applyTheme);
    return () => mediaQuery.removeEventListener('change', applyTheme);
  }, [themeMode]);

  const value = useMemo<AppContextValue>(
    () => ({
      lang,
      setLang,
      // 断言：en 字典允许缺少模板类键（分享文案模板单一来源在 zh 区块，见 i18n.ts）
      t: translations[lang] as Translation,
      themeMode,
      setThemeMode,
    }),
    [lang, themeMode],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return ctx;
}

/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * AI 面板源码全集读取器（测试基础设施）。
 *
 * 为什么单独一个模块：设计纪律守卫与链路守卫原本整片扫 `AiAssistant.tsx`；面板 JSX 外置到
 * `components/ai/panels/*`、业务状态抽到 `components/ai/hooks/*` 之后，若只扫主文件守卫会
 * 静默失效（P0 时实测 14 项变红、P1 时 3 项变红）。约定：这些守卫一律读「主文件 + 全部
 * 外置面板 + 共享件 + 全部 Hook」的拼接。
 *
 * 与 `src/smoke.test.ts` 里的同名助手同义、同文件清单，差别只在读文件走 `repoPath()`：
 * 基准从模块位置推导，不依赖 `process.cwd()`。
 */
import { readFileSync } from 'node:fs';
import { repoPath } from './repo-paths';

export const AI_PANEL_FILES = [
  'src/components/ai/AiAssistant.tsx',
  'src/components/ai/panels/panel-shared.tsx',
  'src/components/ai/panels/TermsPanel.tsx',
  'src/components/ai/panels/SettingsPanel.tsx',
  'src/components/ai/panels/HistoryPanel.tsx',
  'src/components/ai/panels/QuizPanel.tsx',
  'src/components/ai/hooks/useAiSettings.ts',
  'src/components/ai/hooks/useQuizSession.ts',
  'src/components/ai/page-subject.ts',
];

export function readAiPanel(): string {
  return AI_PANEL_FILES.map((f) => readFileSync(repoPath(f), 'utf8')).join('\n');
}

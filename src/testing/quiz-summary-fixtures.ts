/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 错题集「学情概览」聚合层测试的共享样本构造器。
 *
 * 为什么要单独一个模块：`Quiz summary` 的三个套件（错误类型归类 / 科目与薄弱知识点 /
 * 趋势与 AI 输入）都用 `qh()` 造 `QuizHistoryEntry` 样本。三组一起迁走后，若各自抄一份
 * 或只在某一组里定义，另外两组就得反向依赖那组的私有实现；收敛成一个模块才是唯一
 * 不重复维护的形态。
 *
 * 函数体与 `src/smoke.test.ts` 迁移前**逐字相同**（含字段顺序与默认值）：
 * 默认值参与断言（如 `subject: '数学'` 被「按科目聚合」用例依赖），不许「顺手整理」。
 */
import type { QuizHistoryEntry } from '../lib/quiz-history';

/** 构造一条 QuizHistoryEntry 测试样本 */
export function qh(partial: Partial<QuizHistoryEntry>): QuizHistoryEntry {
  return {
    id: Math.random().toString(36).slice(2),
    ts: Date.now(),
    path: '/lab/x',
    subject: '数学',
    topic: '一次函数',
    question: 'q?',
    options: ['A', 'B', 'C', 'D'],
    answerIdx: 1,
    pickedIdx: 1,
    correct: true,
    model: 'test',
    ...partial,
  };
}

/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 本地历史保留上限与用量统计守卫（注册模块，不含执行入口）。
 *
 * 覆盖：可配置上限（默认 100，非法兜底）、saveHistory/saveQuizHistory 按新上限 FIFO 裁剪、
 * trimToLimit 只裁最旧（保留最新 N 条，严禁清空）、getStorageUsageStats 的条数与 UTF-8 字节估算。
 * 依赖：用例内装一个带假 localStorage 的 globalThis.window，finally 还原并清空内存表。
 */
import assert from 'node:assert';
import type { TestFn } from '../../harness';
import { DEFAULT_STORAGE_LIMIT, STORAGE_LIMIT_OPTIONS, loadStorageLimit, saveStorageLimit } from '../../../lib/ai-storage-limit';
import { HISTORY_STORAGE_KEY, listHistory, saveHistory, trimHistoryToLimit } from '../../../lib/ai-history';
import { QUIZ_HISTORY_STORAGE_KEY, groupQuizByQuestion, listQuizHistory, saveQuizHistory, trimQuizHistoryToLimit } from '../../../lib/quiz-history';
import { compactChemicalSpacing } from '../../../lib/chem-text';
import { formatAiAnswerForClipboard } from '../../../lib/ai-clipboard';
import { ONBOARDING_STORAGE_KEY, readOnboardingDone, markOnboardingDone, clampOnboardingStep, nextOnboardingStep } from '../../../lib/use-onboarding-tour';
import { getStorageUsageStats } from '../../../lib/storage-usage';

export function registerAiStorageUsageTests(test: TestFn): void {
  const mem = new Map<string, string>();
  function installMockWindow() {
    (globalThis as any).window = {
      localStorage: {
        getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
        setItem: (k: string, v: string) => { mem.set(k, v); },
        removeItem: (k: string) => { mem.delete(k); },
      },
    };
  }
  function restoreWindow() {
    delete (globalThis as any).window;
  }
  const hist = (i: number) => ({ path: '/', subject: '数学', topic: '一次函数', question: `问题${i}`, answer: `答案${i}`, model: 'm' });
  const quiz = (i: number) => ({ path: '/', subject: '物理', topic: '欧姆定律', question: `题目${i}`, options: ['A', 'B'], answerIdx: 0, pickedIdx: 1, correct: false, model: 'm' });
  const utf8 = (s: string) => new TextEncoder().encode(s).length;

  test('存储上限：默认 100，合法档位可持久化，非法值回退默认', () => {
    installMockWindow();
    try {
      assert.equal(DEFAULT_STORAGE_LIMIT, 100);
      assert.deepEqual([...STORAGE_LIMIT_OPTIONS], [30, 100, 300, 500]);
      assert.equal(loadStorageLimit(), 100, '未设置 -> 默认 100');
      saveStorageLimit(300);
      assert.equal(loadStorageLimit(), 300, '合法档位应写入并读回');
      saveStorageLimit(999 as any);
      assert.equal(loadStorageLimit(), 300, '非法档位不得覆盖旧值');
      mem.set('stem-storage-limit', '12345');
      assert.equal(loadStorageLimit(), 100, '存储里是非法值 -> 回退默认');
    } finally { mem.clear(); restoreWindow(); }
  });

  test('FIFO：写入时严格按当前档位（30）裁剪，保留最新、丢弃最旧', () => {
    installMockWindow();
    try {
      saveStorageLimit(30);
      for (let i = 0; i < 45; i++) saveHistory(hist(i));
      const list = listHistory();
      assert.equal(list.length, 30, '超过 30 条必须裁到 30');
      assert.ok(list.some((h) => h.question === '问题44'), '最新一条必须保留');
      assert.ok(!list.some((h) => h.question === '问题0'), '最旧一条必须被丢弃');
      // 错题同样按 30 裁剪
      for (let i = 0; i < 40; i++) saveQuizHistory(quiz(i));
      assert.equal(listQuizHistory().length, 30);
    } finally { mem.clear(); restoreWindow(); }
  });

  test('getStorageUsageStats：条数 / 上限 / UTF-8 字节估算准确', () => {
    installMockWindow();
    try {
      saveStorageLimit(300);
      for (let i = 0; i < 5; i++) saveHistory(hist(i));
      for (let i = 0; i < 3; i++) saveQuizHistory(quiz(i));
      const s = getStorageUsageStats();
      assert.equal(s.historyCount, 5);
      assert.equal(s.quizCount, 3);
      assert.equal(s.limit, 300);
      assert.equal(s.historyBytes, utf8(mem.get(HISTORY_STORAGE_KEY) ?? ''), '问答历史字节估算须等于原文 UTF-8 长度');
      assert.equal(s.quizBytes, utf8(mem.get(QUIZ_HISTORY_STORAGE_KEY) ?? ''), '错题字节估算须等于原文 UTF-8 长度');
      assert.equal(s.totalBytes, s.historyBytes + s.quizBytes);
      assert.match(s.totalText, /^\d+(\.\d+)? (B|KB)$/, `可读文本格式应为 X.X KB（实测 ${s.totalText}）`);
      assert.ok(s.historyRatio > 0 && s.quizRatio > 0);
    } finally { mem.clear(); restoreWindow(); }
  });

  test('trimToLimit：调低上限只裁最旧，保留最新 N 条，严禁清空', () => {
    installMockWindow();
    try {
      saveStorageLimit(500);
      for (let i = 0; i < 65; i++) saveHistory(hist(i));
      const r = trimHistoryToLimit(30);
      assert.equal(r.kept, 30);
      assert.equal(r.removed, 35);
      const list = listHistory();
      assert.equal(list.length, 30, '仅保留最新 30 条');
      assert.equal(list[0].question, '问题64', '最新记录必须保留');
      assert.ok(!list.some((h) => h.question === '问题0'), '最旧必须删除');
      // 已低于上限时不动
      const r2 = trimHistoryToLimit(100);
      assert.deepEqual(r2, { kept: 30, removed: 0 });
      // 错题同理
      for (let i = 0; i < 50; i++) saveQuizHistory(quiz(i));
      const q = trimQuizHistoryToLimit(30);
      assert.equal(q.kept, 30);
      assert.equal(q.removed, 20);
    } finally { mem.clear(); restoreWindow(); }
  });

  test('formatAiAnswerForClipboard：净版 Unicode 化学式/数学/物理式并移除尾部追问', () => {
    const raw = '结论：氯化钙 \\(\\mathrm{Ca(OH)_2}\\)，硫酸根离子 \\(\\mathrm{SO_4^{2-}}\\)。\n'
      + '数学：y = -2x^2 + 3；分数 \\(\\frac{4}{x}\\)，\\(\\frac{b}{2a}\\)。\n'
      + '物理：\\(F_{\\text{浮}} = \\rho_{\\text{液}} g V_{\\text{排}}\\)。\n\n'
      + '可以继续了解：\n1. H₂O₂ 为什么不约分？\n2. 已知化学式反推未知元素化合价？\n3. 易混概念对比？';
    const clean = formatAiAnswerForClipboard(raw);
    assert.ok(clean.includes('Ca(OH)₂'), '必须把 \\mathrm 化学式转为 Unicode 下标');
    assert.ok(clean.includes('SO₄²⁻'), '必须把离子上下标转为 Unicode');
    assert.ok(clean.includes('y = -2x² + 3'), '数学幂次必须转 Unicode 上标');
    assert.ok(clean.includes('4/x'), '单字符分式应紧凑');
    assert.ok(clean.includes('(b)/(2a)'), '复杂分式应加括号');
    assert.ok(clean.includes('F浮'), '中文物理下标应可读');
    assert.ok(!clean.includes('\\mathrm') && !clean.includes('\\('), '不得残留 LaTeX 外壳');
    assert.ok(!clean.includes('可以继续了解') && !clean.includes('H₂O₂ 为什么不约分'), '不得复制尾部追问');
  });

  test('onboarding tour：存储完成标记、步骤边界与前后切换', () => {
    installMockWindow();
    try {
      assert.equal(readOnboardingDone(), false, '初始未完成');
      markOnboardingDone();
      assert.equal(readOnboardingDone(), true, '完成标记必须持久化');
      assert.equal(mem.get(ONBOARDING_STORAGE_KEY), '1');
      mem.delete(ONBOARDING_STORAGE_KEY);
      assert.equal(clampOnboardingStep(-2), 0, '步骤不得小于 0');
      assert.equal(clampOnboardingStep(99), 3, '步骤不得越界');
      assert.equal(nextOnboardingStep(0, 1), 1, '下一步递增');
      assert.equal(nextOnboardingStep(2, -1), 1, '上一步递减');
      assert.equal(nextOnboardingStep(0, -1), 0, '第一步再上一步仍为 0');
    } finally { mem.clear(); restoreWindow(); }
  });

  test('compactChemicalSpacing：压紧下标数字与元素符号间的多余空白，普通文本不动', () => {
    assert.equal(compactChemicalSpacing('Fe₂ O₃ 中铁元素的化合价是？'), 'Fe₂O₃ 中铁元素的化合价是？');
    assert.equal(compactChemicalSpacing('Fe ₂O₃'), 'Fe₂O₃');
    assert.equal(compactChemicalSpacing('KMnO₄ 中锰'), 'KMnO₄ 中锰');
    assert.equal(compactChemicalSpacing('5 mL 与 a < b'), '5 mL 与 a < b', '普通数字/字母/小于号不受影响');
  });

  test('groupQuizByQuestion：同题干聚合为 1 张卡，repeatCount 累计且保留最新一条', () => {
    const mk = (id: string, ts: number, question: string, extra: Record<string, unknown> = {}) => ({ id, ts, question, ...extra } as any);
    const grouped = groupQuizByQuestion([
      mk('a', 5, 'Fe₂O₃ 中铁元素的化合价是？', { subject: '化学', topic: '化合价' }),
      mk('b', 4, 'Fe₂O₃ 中铁元素的化合价是？', { subject: '化学', topic: '化合价' }),
      mk('c', 3, 'KMnO₄ 中锰元素的化合价是？', { subject: '化学', topic: '化合价' }),
      mk('d', 2, 'Fe₂O₃  中铁元素的化合价是？', { subject: '化学', topic: '化合价' }), // 多空格去空白后同题
      mk('m1', 1, '下列说法正确的是？', { subject: '数学', topic: '函数' }),
      mk('p1', 0, '下列说法正确的是？', { subject: '物理', topic: '电路' }), // 同题干但不同学科，不得合并
    ]);
    assert.equal(grouped.length, 4, '同题合并、跨学科不合并：Fe 1 + KMnO₄ 1 + 数学 1 + 物理 1');
    const fe = grouped.find((g) => g.question.includes('Fe₂O₃'))!;
    assert.equal(fe.repeatCount, 3, '同一题错 3 次');
    assert.equal(fe.id, 'a', '保留最新（首条）记录');
    const km = grouped.find((g) => g.question.includes('KMnO₄'))!;
    assert.equal(km.repeatCount, 1);
    // 跨学科同名题干必须各留一张卡（评审 Important 回归）
    assert.ok(grouped.some((g) => g.id === 'm1' && g.repeatCount === 1), '数学同名题不得被物理题吞并');
    assert.ok(grouped.some((g) => g.id === 'p1' && g.repeatCount === 1), '物理同名题不得被数学题吞并');
  });
}

/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * Smoke tests: verify core infrastructure loads without crashing.
 * Uses Node built-in assert — no test framework dependency.
 *
 * Run: npx tsx src/smoke.test.ts
 */
import { strict as assert } from 'node:assert';
import { labs, labMap, labsForSubject } from './lib/labs';
import { subjects, subjectList } from './lib/subjects';
import { cleanTextForTTS } from './lib/use-speak';
import { latexToSpeech } from './lib/latex-speech';
import { clearHistory, listHistory, saveHistory, relativeTime, HISTORY_LIMIT } from './lib/ai-history';
import { loadFeedback, saveFeedback, removeFeedback, FEEDBACK_LIMIT, type FeedbackRecord } from './lib/feedback';
import { clearQuizHistory, listQuizHistory, saveQuizHistory, wrongQuizHistory, QUIZ_HISTORY_LIMIT, type QuizHistoryEntry } from './lib/quiz-history';
import { parseQuizBatch } from './lib/ai-quiz';
import {
  computeQuizOverview,
  computeErrorKinds,
  buildQuizRecordsForSummary,
  classifyErrorKind,
} from './lib/quiz-summary';
import { addTokenUsage, clearTokenUsage, loadTokenUsage, tokenUsageTotal } from './lib/token-usage';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: any) {
    failed++;
    console.log(`  ✗ ${name}: ${e.message}`);
  }
}

function describe(_name: string, fn: () => void) {
  console.log(`\n${_name}`);
  fn();
}

/* ── Lab registration ── */

describe('Lab registration', () => {
  test('has 15 registered labs', () => {
    assert.equal(labs.length, 15);
  });

  test('every lab has required fields', () => {
    for (const lab of labs) {
      assert.ok(lab.id);
      assert.ok(lab.subjectId.match(/^(math|physics|chemistry)$/));
      assert.ok(lab.name.zh);
      assert.ok(lab.name.en);
      assert.ok(lab.description.zh);
      assert.ok(lab.description.en);
      assert.ok(lab.icon);
      assert.ok(lab.component);
    }
  });

  test('labMap contains all labs', () => {
    for (const lab of labs) {
      assert.ok(labMap[lab.id]);
      assert.equal(labMap[lab.id].id, lab.id);
    }
  });

  test('labsForSubject returns correct counts', () => {
    assert.equal(labsForSubject('math').length, 4);
    assert.equal(labsForSubject('physics').length, 7);
    assert.equal(labsForSubject('chemistry').length, 4);
  });

  test('no duplicate lab ids', () => {
    const ids = labs.map((l) => l.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});

/* ── Subject metadata ── */

describe('Subject metadata', () => {
  test('has 3 subjects', () => {
    assert.equal(subjectList.length, 3);
  });

  test('every subject has required fields', () => {
    for (const subject of subjectList) {
      assert.ok(subject.id.match(/^(math|physics|chemistry)$/));
      assert.ok(subject.path.match(/^\/subject\//));
      assert.ok(subject.gradeZh);
      assert.ok(subject.gradeEn);
    }
  });

  test('subjects map is complete', () => {
    assert.ok(subjects.math);
    assert.ok(subjects.physics);
    assert.ok(subjects.chemistry);
  });
});

/* ── Physics: lens formula ── */

describe('Physics model: lens formula', () => {
  function imageV(u: number, f: number): number | null {
    const diff = u - f;
    if (Math.abs(diff) < 0.01) return null;
    return (u * f) / diff;
  }

  test('u > 2f produces real reduced image (f < v < 2f)', () => {
    const f = 10, u = 25;
    const v = imageV(u, f)!;
    assert.ok(v > f);
    assert.ok(v < 2 * f);
  });

  test('u = 2f produces v = 2f', () => {
    const f = 10, u = 20;
    assert.ok(Math.abs(imageV(u, f)! - 2 * f) < 0.01);
  });

  test('f < u < 2f produces v > 2f (magnified)', () => {
    const f = 10, u = 15;
    assert.ok(imageV(u, f)! > 2 * f);
  });

  test('u = f produces no image (null)', () => {
    assert.equal(imageV(10, 10), null);
  });

  test('u < f produces virtual image (v < 0)', () => {
    const f = 10, u = 5;
    assert.ok(imageV(u, f)! < 0);
  });
});

/* ── Physics: Ohm's law ── */

describe("Physics model: Ohm's law", () => {
  function currentOf(u: number, r: number): number {
    return u / r;
  }

  test('I = U/R for resistor', () => {
    assert.ok(Math.abs(currentOf(6, 10) - 0.6) < 0.01);
    assert.ok(Math.abs(currentOf(12, 10) - 1.2) < 0.01);
    assert.ok(Math.abs(currentOf(6, 20) - 0.3) < 0.01);
  });
});

/* ── Chemistry: titration pH ── */

describe('Chemistry model: titration pH', () => {
  function phAt(acidM: number, v: number): number {
    const v0 = 20;
    const baseM = 0.1;
    const acidMol = acidM * v0;
    const baseMol = baseM * v;
    const total = v0 + v;
    if (baseMol < acidMol) {
      const h = (acidMol - baseMol) / total;
      return Math.max(0, -Math.log10(h));
    }
    if (Math.abs(baseMol - acidMol) < 1e-9) return 7;
    const oh = (baseMol - acidMol) / total;
    return Math.min(14, 14 + Math.log10(oh));
  }

  test('starts acidic (pH ~1)', () => {
    assert.ok(Math.abs(phAt(0.1, 0) - 1) < 0.5);
  });

  test('reaches pH 7 at equivalence point', () => {
    const eqV = (0.1 * 20) / 0.1;
    assert.ok(Math.abs(phAt(0.1, eqV) - 7) < 0.5);
  });

  test('becomes basic after equivalence', () => {
    assert.ok(phAt(0.1, 25) > 7);
  });
});

/* ── LaTeX → TTS 口语转换 ── */

describe('LaTeX → TTS speech conversion', () => {
  test('inline \\(...\\) formula read as speech (not raw chars)', () => {
    const out = cleanTextForTTS('二次函数的一般式是 \\(y=ax^2+bx+c\\)，其中 a 不为 0。');
    assert.ok(out.includes('x 平方'), `expected x 平方 in: ${out}`);
    assert.ok(out.includes('等于'), `expected 等于 in: ${out}`);
    assert.ok(!out.includes('\\('), 'should not contain raw latex \\(');
    assert.ok(!out.includes('公式省略'), 'should not contain 公式省略');
  });

  test('display \\[...\\] formula read as speech', () => {
    const out = cleanTextForTTS('速度公式：\\[v=\\frac{s}{t}\\]');
    assert.ok(out.includes('t 分之 s'), `expected t 分之 s in: ${out}`);
  });

  test('$...$ inline formula read as speech (model disobedient case)', () => {
    const out = cleanTextForTTS('根据 $E=mc^2$，能量等于质量乘光速平方。');
    assert.ok(out.includes('c 平方'), `expected c 平方 in: ${out}`);
    assert.ok(!out.includes('公式省略'), 'should not contain 公式省略');
  });

  test('$$...$$ display formula read as speech', () => {
    const out = cleanTextForTTS('$$\nE = mc^2\n$$');
    assert.ok(out.includes('c 平方'), `expected c 平方 in: ${out}`);
  });

  test('frac nested with superscript', () => {
    const out = latexToSpeech('\\frac{a}{b^2}');
    assert.equal(out, 'b 平方 分之 a');
  });

  test('sqrt with content', () => {
    const out = latexToSpeech('\\sqrt{a^2+b^2}');
    assert.ok(out.includes('根号'), `expected 根号 in: ${out}`);
    assert.ok(out.includes('a 平方'), `expected a 平方 in: ${out}`);
  });

  test('chemistry subscript H_2O reads as 水 (compound name)', () => {
    const out = latexToSpeech('H_2O');
    assert.equal(out, '水');
  });

  test('chemistry compound name lookup: NaCl and CO_2', () => {
    assert.equal(latexToSpeech('NaCl'), '氯化钠');
    assert.equal(latexToSpeech('CO_2'), '二氧化碳');
  });

  test('non-compound formula falls back to symbol reading (x_1)', () => {
    const out = latexToSpeech('x_1');
    assert.equal(out, 'x 一');
  });

  test('unknown latex command degrades safely (no crash)', () => {
    const out = latexToSpeech('\\mathrm{kg} \\cdot m');
    assert.ok(out.includes('kg'), `expected kg in: ${out}`);
    assert.ok(out.includes('乘以'), `expected 乘以 in: ${out}`);
  });

  test('english mode reads formulas in english', () => {
    const out = cleanTextForTTS('The formula is \\(y=ax^2+bx+c\\).', 'en');
    assert.ok(out.includes('x squared'), `expected x squared in: ${out}`);
    assert.ok(!out.includes('\\('), 'should not contain raw latex');
  });

  test('greek letters spoken', () => {
    const out = latexToSpeech('\\rho = \\frac{m}{V}');
    assert.ok(out.includes('柔'), `expected 柔(rho) in: ${out}`);
    assert.ok(out.includes('V 分之 m'), `expected V 分之 m in: ${out}`);
  });

  test('plain text without formulas unaffected', () => {
    const out = cleanTextForTTS('这是一个普通的句子，没有公式。');
    assert.equal(out, '这是一个普通的句子，没有公式。');
  });

  test('minus sign distinguishes negative vs subtract (zh)', () => {
    assert.equal(latexToSpeech('-b'), '负b');
    assert.equal(latexToSpeech('a-b'), 'a减b');
    assert.equal(latexToSpeech('a=-b'), 'a等于负b');
    assert.equal(latexToSpeech('2a-b'), '2 a减b');
    assert.equal(latexToSpeech('\\frac{1}{2}-b'), '2 分之 1减b');
  });

  test('quadratic root formula reads -b as negative b', () => {
    const out = latexToSpeech('x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}');
    assert.equal(out, 'x等于2 a 分之 负b正负根号 b 平方减4 a c');
  });

  test('parentheses read closing bracket only (zh)', () => {
    assert.equal(latexToSpeech('(a+b)'), 'a加b括号');
    assert.equal(latexToSpeech('\\left(a+b\\right)'), 'a加b括号');
    assert.equal(latexToSpeech('\\left[ x \\right]'), 'x 右中括号');
  });

  test('minus and parentheses behave correctly (en)', () => {
    assert.equal(latexToSpeech('a-b', 'en'), 'a minus b');
    assert.equal(latexToSpeech('a=-b', 'en'), 'a equals negative b');
    assert.equal(latexToSpeech('\\left(a+b\\right)', 'en'), 'a plus b close parenthesis');
  });

  test('absolute value reads as 绝对值 (zh)', () => {
    assert.equal(latexToSpeech('|k|'), 'k 的绝对值');
    assert.equal(latexToSpeech('∣k∣'), 'k 的绝对值');
    assert.equal(latexToSpeech('|-3|'), '负3 的绝对值');
    assert.equal(latexToSpeech('|x-2|<3'), 'x减2 的绝对值小于3');
    assert.equal(latexToSpeech('\\left| k \\right|'), 'k 的绝对值');
    assert.equal(latexToSpeech('\\lvert k \\rvert'), 'k 的绝对值');
    assert.equal(latexToSpeech('\\vert k \\vert'), 'k 的绝对值');
    assert.equal(latexToSpeech('\\left| \\frac{1}{2} \\right|'), '2 分之 1 的绝对值');
  });

  test('absolute value reads as absolute value of (en)', () => {
    assert.equal(latexToSpeech('|k|', 'en'), 'absolute value of k');
    assert.equal(latexToSpeech('\\left| k \\right|', 'en'), 'absolute value of k');
    assert.equal(latexToSpeech('\\lvert k \\rvert', 'en'), 'absolute value of k');
  });

  test('bare unicode math symbols read as words (zh)', () => {
    assert.equal(latexToSpeech('x<3'), 'x小于3');
    assert.equal(latexToSpeech('x>3'), 'x大于3');
    assert.equal(latexToSpeech('a≤b'), 'a小于等于b');
    assert.equal(latexToSpeech('a≥b'), 'a大于等于b');
    assert.equal(latexToSpeech('a≠b'), 'a不等于b');
    assert.equal(latexToSpeech('2×3'), '2乘以3');
    assert.equal(latexToSpeech('6÷2'), '6除以2');
    assert.equal(latexToSpeech('π'), '派');
  });

  test('bare unicode math symbols read as words (en)', () => {
    assert.equal(latexToSpeech('x<3', 'en'), 'x less than 3');
    assert.equal(latexToSpeech('x>3', 'en'), 'x greater than 3');
    assert.equal(latexToSpeech('a≠b', 'en'), 'a not equal to b');
    assert.equal(latexToSpeech('2×3', 'en'), '2 times 3');
    assert.equal(latexToSpeech('π', 'en'), 'pi');
  });
});

/* ── AI Q&A history (localStorage persistence) ── */

describe('AI Q&A history (localStorage persistence)', () => {
  // 内存版 localStorage mock（Node 环境注入 window）
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

  test('save then list returns the entry', () => {
    installMockWindow();
    try {
      saveHistory({ path: '/lab/ohm', subject: '物理', topic: '欧姆定律', question: '什么是电阻？', answer: '电阻是……', model: 'gpt-4o-mini' });
      const list = listHistory();
      assert.equal(list.length, 1);
      assert.equal(list[0].question, '什么是电阻？');
      assert.ok(list[0].id.length > 0);
      assert.ok(list[0].ts > 0);
    } finally {
      mem.clear();
      restoreWindow();
    }
  });

  test('keeps newest 100, drops oldest beyond limit', () => {
    installMockWindow();
    try {
      for (let i = 0; i < 105; i++) {
        saveHistory({ path: '/', subject: '数学', topic: '一次函数', question: `问题${i}`, answer: `答案${i}`, model: 'm' });
      }
      const list = listHistory();
      assert.equal(list.length, HISTORY_LIMIT);
      // 最新一条保留，最旧的 0 被丢弃
      assert.ok(list.some((h) => h.question === '问题104'));
      assert.ok(!list.some((h) => h.question === '问题0'));
      // 时间倒序
      for (let i = 1; i < list.length; i++) assert.ok(list[i - 1].ts >= list[i].ts);
    } finally {
      mem.clear();
      restoreWindow();
    }
  });

  test('clear empties the store', () => {
    installMockWindow();
    try {
      saveHistory({ path: '/', subject: '数学', topic: '一次函数', question: 'q', answer: 'a', model: 'm' });
      clearHistory();
      assert.equal(listHistory().length, 0);
    } finally {
      mem.clear();
      restoreWindow();
    }
  });

  test('corrupted data falls back to empty list', () => {
    installMockWindow();
    try {
      mem.set('stem-ai-history', '{{{ not json');
      assert.equal(listHistory().length, 0);
      mem.set('stem-ai-history', JSON.stringify({ wrong: 'shape' }));
      assert.equal(listHistory().length, 0);
    } finally {
      mem.clear();
      restoreWindow();
    }
  });

  test('relativeTime formats zh and en', () => {
    const now = Date.now();
    assert.match(relativeTime(now - 30 * 1000, 'zh'), /刚刚/);
    assert.match(relativeTime(now - 30 * 1000, 'en'), /just now/);
    assert.match(relativeTime(now - 2 * 3600 * 1000, 'zh'), /2 小时前/);
    assert.match(relativeTime(now - 26 * 3600 * 1000, 'zh'), /昨天/);
  });
});

/* ── Feedback queue (localStorage cap + remove) ── */

describe('Feedback queue (localStorage persistence)', () => {
  const mem = new Map<string, string>();
  // 保留原 fetch 以便恢复；mock 成 500 响应，防止测试触发真实 Server酱推送
  const originalFetch = (globalThis as any).fetch;
  function installMockWindow() {
    (globalThis as any).fetch = async () => new Response('', { status: 500 });
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
    (globalThis as any).fetch = originalFetch;
  }
  const record = (i: number): FeedbackRecord => ({
    id: `fb-${i}`,
    type: 'project',
    categories: [],
    message: `反馈${i}`,
    language: 'zh',
    createdAt: new Date().toISOString(),
  });

  test('save then load returns the entry', () => {
    installMockWindow();
    try {
      saveFeedback(record(1));
      const list = loadFeedback();
      assert.equal(list.length, 1);
      assert.equal(list[0].message, '反馈1');
    } finally {
      mem.clear();
      restoreWindow();
    }
  });

  test('keeps newest 100, drops oldest beyond limit', () => {
    installMockWindow();
    try {
      for (let i = 0; i < FEEDBACK_LIMIT + 5; i++) saveFeedback(record(i));
      const list = loadFeedback();
      assert.equal(list.length, FEEDBACK_LIMIT);
      // 最新一条保留，最旧的 0~4 被丢弃
      assert.ok(list.some((r) => r.message === `反馈${FEEDBACK_LIMIT + 4}`));
      assert.ok(!list.some((r) => r.message === '反馈0'));
    } finally {
      mem.clear();
      restoreWindow();
    }
  });

  test('removeFeedback drops only the target record', () => {
    installMockWindow();
    try {
      saveFeedback(record(1));
      saveFeedback(record(2));
      saveFeedback(record(3));
      removeFeedback('fb-2');
      const list = loadFeedback();
      assert.equal(list.length, 2);
      assert.ok(list.some((r) => r.id === 'fb-1'));
      assert.ok(!list.some((r) => r.id === 'fb-2'));
      assert.ok(list.some((r) => r.id === 'fb-3'));
    } finally {
      mem.clear();
      restoreWindow();
    }
  });
});

/* ── Quiz history (localStorage cap + wrong filter) ── */

describe('Quiz history (localStorage persistence)', () => {
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
  const entry = (i: number, correct: boolean): Omit<QuizHistoryEntry, 'id' | 'ts'> => ({
    path: '/lab/quadratic',
    subject: '数学',
    topic: '二次函数',
    question: `题目${i}`,
    options: ['a', 'b', 'c', 'd'],
    answerIdx: 0,
    pickedIdx: correct ? 0 : 2,
    correct,
    model: 'm',
  });

  test('save then load returns entries', () => {
    installMockWindow();
    try {
      saveQuizHistory(entry(1, true));
      const list = listQuizHistory();
      assert.equal(list.length, 1);
      assert.equal(list[0].question, '题目1');
      assert.equal(list[0].correct, true);
    } finally {
      mem.clear();
      restoreWindow();
    }
  });

  test('explanation round-trips and is optional (legacy data)', () => {
    installMockWindow();
    try {
      saveQuizHistory({ ...entry(1, false), explanation: 'u>2f 时成倒立缩小实像，照相机原理。' });
      const withExpl = listQuizHistory()[0];
      assert.equal(withExpl.explanation, 'u>2f 时成倒立缩小实像，照相机原理。');
      // 旧数据无 explanation：读取不报错、字段为 undefined
      saveQuizHistory(entry(2, true));
      const legacy = listQuizHistory().find((e) => e.question === '题目2')!;
      assert.equal(legacy.explanation, undefined);
    } finally {
      mem.clear();
      restoreWindow();
    }
  });

  test('wrongQuizHistory returns only wrong entries', () => {
    installMockWindow();
    try {
      saveQuizHistory(entry(1, true));
      saveQuizHistory(entry(2, false));
      saveQuizHistory(entry(3, false));
      const wrong = wrongQuizHistory();
      assert.equal(wrong.length, 2);
      assert.ok(wrong.every((e) => !e.correct));
    } finally {
      mem.clear();
      restoreWindow();
    }
  });

  test('keeps newest 100, drops oldest beyond limit', () => {
    installMockWindow();
    try {
      for (let i = 0; i < QUIZ_HISTORY_LIMIT + 5; i++) saveQuizHistory(entry(i, i % 2 === 0));
      const list = listQuizHistory();
      assert.equal(list.length, QUIZ_HISTORY_LIMIT);
      assert.ok(list.some((e) => e.question === `题目${QUIZ_HISTORY_LIMIT + 4}`));
      assert.ok(!list.some((e) => e.question === '题目0'));
    } finally {
      mem.clear();
      restoreWindow();
    }
  });

  test('clear empties the store', () => {
    installMockWindow();
    try {
      saveQuizHistory(entry(1, true));
      clearQuizHistory();
      assert.equal(listQuizHistory().length, 0);
    } finally {
      mem.clear();
      restoreWindow();
    }
  });
});

/* ── Quiz batch parser (parseQuizBatch) ── */

describe('Quiz batch parser', () => {
  test('parses multiple marked questions', () => {
    const raw = [
      '【第1题】',
      '【题目】二次函数 \\\\(y=x^2\\\\) 的对称轴是？',
      'A. x=0',
      'B. x=1',
      'C. x=2',
      'D. x=3',
      '【答案】A',
      '【解析】对称轴是 y 轴。',
      '',
      '【第2题】',
      '【题目】抛物线 \\\\(y=x^2+1\\\\) 的顶点是？',
      'A. (0,0)',
      'B. (0,1)',
      'C. (1,0)',
      'D. (1,1)',
      '【答案】B',
      '【解析】顶点在 (0,1)。',
    ].join('\n');
    const parsed = parseQuizBatch(raw, 2);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].answerIdx, 0);
    assert.equal(parsed[1].answerIdx, 1);
  });

  test('falls back to blank-line grouping without markers', () => {
    const raw = [
      '【题目】一次函数 \\\\(y=2x+1\\\\) 的斜率是？',
      'A. 1',
      'B. 2',
      'C. 3',
      'D. 4',
      '【答案】B',
      '【解析】斜率为 2。',
      '',
      '【题目】反比例函数 \\\\(y=\\\\frac{2}{x}\\\\) 的图像是？',
      'A. 直线',
      'B. 双曲线',
      'C. 抛物线',
      'D. 圆',
      '【答案】B',
      '【解析】反比例函数图像为双曲线。',
    ].join('\n');
    const parsed = parseQuizBatch(raw, 2);
    assert.equal(parsed.length, 2);
  });

  test('returns empty array for unparseable input', () => {
    assert.equal(parseQuizBatch('没有任何题目结构').length, 0);
    assert.equal(parseQuizBatch('').length, 0);
  });
});

/* ── 错题集「学情概览」聚合层 ── */

/** 构造一条 QuizHistoryEntry 测试样本 */
function qh(partial: Partial<QuizHistoryEntry>): QuizHistoryEntry {
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

describe('Quiz summary — 错误类型归类', () => {
  test('超时未答归为 timeout', () => {
    const kinds = computeErrorKinds([qh({ correct: false, pickedIdx: -1, timedOut: true })]);
    assert.equal(kinds.timeout, 1);
    assert.equal(kinds.plain, 0);
  });

  test('同科同知识点反复选同一干扰项归为 confuse', () => {
    const kinds = computeErrorKinds([
      qh({ correct: false, answerIdx: 1, pickedIdx: 0, elapsedMs: 5000 }),
      qh({ correct: false, answerIdx: 1, pickedIdx: 0, elapsedMs: 5500 }),
    ]);
    assert.equal(kinds.confuse, 2);
    assert.equal(kinds.plain, 0);
  });

  test('慢（≥中位数×2）归 slow，快（≤中位数×0.5）归 fast', () => {
    const kinds = computeErrorKinds([
      qh({ correct: false, answerIdx: 1, pickedIdx: 0, elapsedMs: 10000, topic: 'A' }),
      qh({ correct: false, answerIdx: 1, pickedIdx: 2, elapsedMs: 1000, topic: 'B' }),
      qh({ correct: false, answerIdx: 1, pickedIdx: 2, elapsedMs: 5000, topic: 'C' }),
    ]);
    assert.equal(kinds.slow, 1);
    assert.equal(kinds.fast, 1);
    assert.equal(kinds.plain, 1);
  });

  test('正确题不进入错误归类', () => {
    const kinds = computeErrorKinds([qh({ correct: true })]);
    assert.equal(kinds.timeout + kinds.confuse + kinds.slow + kinds.fast + kinds.plain, 0);
  });
});

describe('Quiz summary — 科目与薄弱知识点', () => {
  test('科目正确率按科目聚合', () => {
    const ov = computeQuizOverview([
      qh({ subject: '数学', correct: true }),
      qh({ subject: '数学', correct: false }),
      qh({ subject: '物理', correct: true }),
    ]);
    assert.equal(ov.total, 3);
    assert.equal(ov.correct, 2);
    assert.equal(ov.wrong, 1);
    assert.equal(ov.rate, 67);
    const math = ov.subjects.find((s) => s.subject === '数学')!;
    assert.equal(math.total, 2);
    assert.equal(math.rate, 50);
  });

  test('薄弱知识点 TOP 按错误数降序、截断 limit', () => {
    const ov = computeQuizOverview([
      qh({ topic: '一次函数', correct: false }),
      qh({ topic: '一次函数', correct: false }),
      qh({ topic: '二次函数', correct: false }),
      qh({ topic: '凸透镜', correct: true }),
    ], 1);
    assert.equal(ov.weakTopics.length, 1);
    assert.equal(ov.weakTopics[0].topic, '一次函数');
    assert.equal(ov.weakTopics[0].wrong, 2);
  });

  test('无错题时 weakTopics 为空', () => {
    const ov = computeQuizOverview([qh({ correct: true })]);
    assert.equal(ov.weakTopics.length, 0);
  });
});

describe('Quiz summary — 趋势与 AI 输入', () => {
  test('有记录且窗口够时给最近 vs 整体', () => {
    const ov = computeQuizOverview(
      [qh({ correct: true }), qh({ correct: false }), qh({ correct: true }), qh({ correct: true })],
      3,
      2,
    );
    assert.ok(ov.trend);
    assert.equal(ov.trend.recentCount, 2);
  });

  test('空记录时 trend 为 null', () => {
    const ov = computeQuizOverview([]);
    assert.equal(ov.trend, null);
  });

  test('overallRateOverride：筛选视图下 overall 取全量率（不与 recent 同批）', () => {
    // 模拟「仅错题」视图：entries 全是错（recent 0%），但全量正确率 40%
    const ov = computeQuizOverview(
      [qh({ correct: false, topic: 'X' }), qh({ correct: false, topic: 'Y' })],
      3,
      2,
      40,
    );
    assert.ok(ov.trend);
    assert.equal(ov.trend.recentRate, 0);
    assert.equal(ov.trend.overallRate, 40); // 来自全量，而非 entries 的 0%
  });

  test('AI 输入截断到 limit 条', () => {
    const entries = Array.from({ length: 40 }, (_, i) => qh({ correct: i % 2 === 0 }));
    const txt = buildQuizRecordsForSummary(entries, 30);
    assert.equal(txt.split('【第').length, 31);
    assert.ok(!txt.includes('【第31题】'));
  });

  test('AI 输入标记超时与选项拼接', () => {
    const txt = buildQuizRecordsForSummary([
      qh({ correct: false, timedOut: true, pickedIdx: -1, question: '超时题', options: ['x', 'y'] }),
    ]);
    assert.ok(txt.includes('（超时未答）'));
    assert.ok(txt.includes('选项：x｜y'));
    assert.ok(txt.includes('你的选择：无'));
  });

  test('AI 输入含解析讲解（有则拼接，无则不出现）', () => {
    const withExpl = buildQuizRecordsForSummary([
      qh({ correct: false, explanation: '斜率等于 k，因为 y=kx+b 中 k 是斜率。' }),
    ]);
    assert.ok(withExpl.includes('解析：斜率等于 k'));
    const noExpl = buildQuizRecordsForSummary([qh({ correct: false })]);
    assert.ok(!noExpl.includes('解析：'));
  });

  test('AI 输入空记录返回空串', () => {
    assert.equal(buildQuizRecordsForSummary([]), '');
  });

  test('AI 输入选项下标越界/非法值 clamp 回退（防 fromCharCode 怪字符/NUL）', () => {
    const txt = buildQuizRecordsForSummary([
      qh({ correct: false, pickedIdx: 999, answerIdx: -1, question: '越界', options: ['a', 'b'] }),
      qh({ correct: false, pickedIdx: NaN, answerIdx: Infinity, question: '非法', options: ['a'] }),
    ]);
    assert.ok(txt.includes('你的选择：无'));
    assert.ok(txt.includes('正确答案：未知'));
    // 不出现西里尔字母/控制字符
    assert.ok(!/[\u0400-\u04FF]/.test(txt));
    assert.ok(!txt.includes('\u0000'));
  });

  test('正确题 classifyErrorKind 返回 plain（防御）', () => {
    assert.equal(classifyErrorKind(qh({ correct: true })), 'plain');
  });
});

/* ── token 用量累计统计（localStorage，按模型 × 日期分桶） ── */

describe('Token usage (localStorage persistence)', () => {
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

  test('addTokenUsage accumulates per model per day and total sums all', () => {
    installMockWindow();
    try {
      addTokenUsage('deepseek-chat', 12400);
      addTokenUsage('deepseek-chat', 600);
      addTokenUsage('qwen-plus', 3600);
      const usage = loadTokenUsage();
      // 两级结构：模型 → 当天日期 → 数值
      const deepseekDays = usage['deepseek-chat'];
      const dayTotal = deepseekDays ? Object.values(deepseekDays).reduce((s, n) => s + n, 0) : 0;
      assert.equal(dayTotal, 13000);
      const qwenDays = usage['qwen-plus'];
      const qwenTotal = qwenDays ? Object.values(qwenDays).reduce((s, n) => s + n, 0) : 0;
      assert.equal(qwenTotal, 3600);
      assert.equal(tokenUsageTotal(usage), 16600);
    } finally {
      mem.clear();
      restoreWindow();
    }
  });

  test('legacy flat format migrates into before bucket', () => {
    installMockWindow();
    try {
      // 旧格式 { model: total } 直接写入 → load 应迁移为 before 桶
      mem.set('stem-ai-token-usage', JSON.stringify({ 'deepseek-chat': 5000 }));
      const usage = loadTokenUsage();
      assert.equal(usage['deepseek-chat']?.['before'], 5000);
      assert.equal(tokenUsageTotal(usage), 5000);
    } finally {
      mem.clear();
      restoreWindow();
    }
  });

  test('clearTokenUsage empties the store', () => {
    installMockWindow();
    try {
      addTokenUsage('deepseek-chat', 100);
      clearTokenUsage();
      assert.equal(tokenUsageTotal(loadTokenUsage()), 0);
    } finally {
      mem.clear();
      restoreWindow();
    }
  });
});

/* ── Summary ── */

console.log(`\n${'─'.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

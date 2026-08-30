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

/* ── Summary ── */

console.log(`\n${'─'.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

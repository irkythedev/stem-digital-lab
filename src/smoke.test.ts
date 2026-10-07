/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * Smoke tests: 156 assertions covering the parts that must not silently break.
 * Uses Node built-in assert — no test framework dependency.
 *
 * What is covered, in the order the assertions appear below:
 *   1. core infrastructure loads without crashing (labs registry, subjects, i18n);
 *   2. the numeric cores agree with each other: the C++/WASM build is compared
 *      point by point against the JS sources (ohm-core.ts, lens-core.ts,
 *      quadratic-core.ts), so a drift on either side fails the run;
 *   3. textbook numbers stay put: bulb resistance R = R0 + 0.4U (12.4 ohm at 6V),
 *      the sample point whose current is about 0.6A must sit at about 6V across
 *      the element (found by value, not by array index, so changing the sampling
 *      range cannot make the test pass by accident);
 *   4. boundary semantics: lens |u-f| < 0.01 returns null instead of drawing a
 *      phantom real image, and a short circuit returns inf rather than 0;
 *   5. TTS text cleaning and the feedback queue behave as documented;
 *   6. the Bohr model draws every electron: for all 118 elements the dot count per
 *      shell equals shells[i], with no overlapping dots and no canvas overflow;
 *   7. the AI thinking-effort tier follows a per-model capability table: each tier
 *      sends a different parameter value (never a no-op tier), unavailable tiers send
 *      nothing, and the custom-endpoint JSON passthrough merges exactly what the user
 *      typed;
 *   8. the API key is scoped per provider, so switching providers never leaves another
 *      vendor's key in the field (a legacy single-key config is filed under its own
 *      provider and does not leak);
 *   9. the AI panel's user-facing copy makes no false security claim: no "encryption"
 *      wording (the key is plain text in localStorage) and the token figure is labelled
 *      a local estimate rather than the provider's billing figure;
 *  10. the version is consistent in all three places a release touches: package.json,
 *      APP_VERSION, and the newest changelog entry (which must stay bilingual and
 *      carry no duplicate version).
 *
 * Add an assertion whenever a new number or boundary becomes part of the
 * teaching content.
 *
 * Run: npx tsx src/smoke.test.ts
 */
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { labs, labMap, labsForSubject } from './lib/labs';
import { translations } from './lib/i18n';
import { planTasks, formatSize, type PackManifest } from './lib/offline-pack';
import {
  AUDIO_CACHE, AUDIO_URL_PATTERN, DIAGRAM_CACHE, DIAGRAM_URL_PATTERN,
  PHOTO_CACHE, PHOTO_URL_PATTERN,
} from './lib/offline-media';
import { subjects, subjectList } from './lib/subjects';
import { cleanTextForTTS } from './lib/use-speak';
import { latexToSpeech } from './lib/latex-speech';
import { clearHistory, listHistory, markStopped, saveHistory, relativeTime, HISTORY_LIMIT } from './lib/ai-history';
import { isNearBottom, STICK_THRESHOLD } from './lib/ai-scroll';
import { loadFeedback, saveFeedback, removeFeedback, submitFeedback, flushFeedbackQueue, FEEDBACK_LIMIT, FEEDBACK_MAX_ATTEMPTS, type FeedbackRecord } from './lib/feedback';
import { clearQuizHistory, listQuizHistory, saveQuizHistory, wrongQuizHistory, QUIZ_HISTORY_LIMIT, type QuizHistoryEntry } from './lib/quiz-history';
import {
  parseQuizBatch, judgeFillAnswer, parseQuizBatchChecked, dedupeQuizQuestions, shuffleOptions,
  parseJudgeVerdict, type QuizQuestion, parseQuizQuestion, stripModelDecorations} from './lib/ai-quiz';
import {
  buildSystemPrompt, buildQuizPrompt, buildFillJudgePrompt, QUIZ_SENTINEL, PROMPT_VERSION,
  extractStreamDelta, createInlineThinkSplitter, streamChat,
  buildThinkingParams, thinkingPlanFor, effectiveThinkingEffort, parseExtraParams, keysByProviderOf, isTierLocked,
  resolveThinkingDispatch, describeThinkingParams,
  type ThinkingEffort, estimateTokens, countCjk} from './lib/ai-config';
import { shellLayout, coreRadiusFor, dotRadiusFor, ATOM_VIEW } from './lib/atom-shells';
import { ELEMENTS } from './lib/elements';
import { APP_VERSION, CHANGELOG } from './lib/changelog';
import {
  buildQuizPaper, normalizeTopic, optionLabel, correctTextOf, wrongTextOf,
  estimateSeconds, BLANK_MM, canUseTwoColumnOptions, type PaperBlankLevel,
} from './lib/quiz-paper';
import {
  getDynamicQuestions, setLabState, getLabState, clearLabState, labIdFromPath, stageLabel,
} from './lib/ai-dynamic-questions';
import {
  computeQuizOverview,
  computeErrorKinds,
  buildQuizRecordsForSummary,
  classifyErrorKind,
} from './lib/quiz-summary';
import { addTokenUsage, clearTokenUsage, loadTokenUsage, tokenUsageTotal } from './lib/token-usage';
import {
  currentOf as coreCurrentOf,
  elementResistance as coreElementResistance,
  sampleOhm as coreSampleOhm,
} from './labs/physics/ohm-core';
import { currentOf, elementResistance, getEngineKind, loadOhmEngine, sampleOhm } from './labs/physics/ohm-engine';
import { imageV } from './labs/physics/lens-core';
import { quadraticY, sampleQuadratic } from './labs/math/quadratic-core';
import {
  imageV as stemImageV,
  quadraticY as stemQuadraticY,
  sampleQuadratic as stemSampleQuadratic,
} from './labs/physics/stem-engine';

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

/**
 * 异步用例：按注册顺序串行执行（避免并发用例互相干扰 mock window / fetch），
 * 在文件末尾的 runAsyncTests() 中统一 await 后计入结果。
 */
const asyncCases: Array<[string, () => Promise<void>]> = [];
function testAsync(name: string, fn: () => Promise<void>) {
  asyncCases.push([name, fn]);
}

async function runAsyncTests() {
  for (const [name, fn] of asyncCases) {
    try {
      await fn();
      passed++;
      console.log(`  ✓ ${name}`);
    } catch (e: any) {
      failed++;
      console.log(`  ✗ ${name}: ${e.message}`);
    }
  }
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

  test('near u = f (within 0.01) produces no image (null)', () => {
    assert.equal(imageV(10.005, 10), null);
    assert.equal(imageV(9.995, 10), null);
  });

  test('u = 2f yields exact v = 20 (f = 10)', () => {
    assert.ok(Math.abs(imageV(20, 10)! - 20) < 1e-9);
  });

  test('u < f produces virtual image (v < 0)', () => {
    const f = 10, u = 5;
    assert.ok(imageV(u, f)! < 0);
  });
});

/* ── Math: quadratic sampling ── */

describe('Math model: quadratic sampling', () => {
  test('quadraticY evaluates y = ax² + bx + c at x = 0 and x = 1', () => {
    assert.equal(quadraticY(-2, 0, 3, 0), 3);
    assert.equal(quadraticY(-2, 0, 3, 1), 1);
  });

  test('sampleQuadratic(1, 0, 0) spans x ∈ [-4, 4] with step 0.05', () => {
    const pts = sampleQuadratic(1, 0, 0);
    assert.ok(pts.length >= 160 && pts.length <= 162, `points = ${pts.length}`);
    assert.ok(Math.abs(pts[0][0] - -4) < 1e-9, `first x = ${pts[0][0]}`);
    const last = pts[pts.length - 1][0];
    assert.ok(Math.abs(last - 4) < 0.001, `last x = ${last}`);
    // 对称性：y = x² 在 x = ±2 处等值
    const at2 = pts.find((p) => Math.abs(p[0] - 2) < 1e-9);
    const atMinus2 = pts.find((p) => Math.abs(p[0] - -2) < 1e-9);
    assert.ok(at2 && atMinus2 && Math.abs(at2[1] - atMinus2[1]) < 1e-9);
  });

  test('sampleQuadratic(-2, 0, 3) has y ≈ 3 at x ≈ 0', () => {
    const pts = sampleQuadratic(-2, 0, 3);
    const near0 = pts.find((p) => Math.abs(p[0]) < 0.0001);
    assert.ok(near0, 'point at x ≈ 0 exists');
    assert.ok(Math.abs(near0[1] - 3) < 1e-9, `y at x≈0 = ${near0[1]}`);
  });
});

/* ── Physics: Ohm's law ── */

describe("Physics model: Ohm's law", () => {
  test('I = U/R for resistor', () => {
    assert.ok(Math.abs(coreCurrentOf(6, 10, 'resistor') - 0.6) < 0.01);
    assert.ok(Math.abs(coreCurrentOf(12, 10, 'resistor') - 1.2) < 0.01);
    assert.ok(Math.abs(coreCurrentOf(6, 20, 'resistor') - 0.3) < 0.01);
  });

  test('I = U/(R + γU) for bulb (nonlinear)', () => {
    assert.ok(Math.abs(coreCurrentOf(6, 10, 'bulb') - 6 / (10 + 0.4 * 6)) < 1e-9);
  });

  test('sampleOhm returns [] when resistor R = 0 (short circuit)', () => {
    assert.equal(coreSampleOhm(0, 'resistor').length, 0);
  });

  test('sampleOhm point at U = 6 is [I·R, I] = [6, 0.6]', () => {
    const pts = coreSampleOhm(10, 'resistor');
    // 按纵轴 I ≈ 0.6 找最近采样点，不依赖数组下标
    const nearest = pts.reduce((best, p) =>
      Math.abs(p[1] - 0.6) < Math.abs(best[1] - 0.6) ? p : best,
    );
    assert.ok(Math.abs(nearest[1] - 0.6) < 0.01, `I should be ≈0.6, got ${nearest[1]}`);
    assert.ok(Math.abs(nearest[0] - 6) < 0.01, `U_elem should be ≈6, got ${nearest[0]}`);
  });

  test('elementResistance is R for resistor, R + γU for bulb (真源)', () => {
    assert.equal(coreElementResistance(10, 'resistor', 6), 10);
    assert.equal(coreElementResistance(10, 'bulb', 6), 10 + 0.4 * 6);
  });
});

/* ── Ohm engine facade（门面默认 JS 真源；loadOhmEngine 可选 WASM，失败静默回退）── */

/** 与 ohm-core（JS 真源）对拍的同一组输入：电阻/灯泡 × 无/有分压 × 常规/边界 */
const ohmCases: { u: number; r: number; element: 'resistor' | 'bulb'; rp: number }[] = [
  { u: 6, r: 10, element: 'resistor', rp: 0 },
  { u: 12, r: 10, element: 'resistor', rp: 0 },
  { u: 6, r: 20, element: 'resistor', rp: 0 },
  { u: 6, r: 10, element: 'bulb', rp: 0 },
  { u: 6, r: 10, element: 'bulb', rp: 4 },
  { u: 9, r: 5, element: 'resistor', rp: 7 },
];

describe('Ohm engine facade（未 load：默认 JS 实现）', () => {
  test('getEngineKind() === "js"', () => {
    assert.equal(getEngineKind(), 'js');
  });

  test('门面与 ohm-core 数值对拍（currentOf / elementResistance / sampleOhm）', () => {
    for (const c of ohmCases) {
      assert.ok(Math.abs(currentOf(c.u, c.r, c.element, c.rp) - coreCurrentOf(c.u, c.r, c.element, c.rp)) < 1e-9);
      assert.ok(Math.abs(elementResistance(c.r, c.element, c.u) - coreElementResistance(c.r, c.element, c.u)) < 1e-9);
    }
    for (const [r, element, rp] of [
      [10, 'resistor', 0],
      [10, 'bulb', 0],
      [5, 'resistor', 7],
    ] as const) {
      const a = sampleOhm(r, element, rp);
      const b = coreSampleOhm(r, element, rp);
      assert.equal(a.length, b.length);
      for (let k = 0; k < a.length; k++) {
        assert.ok(
          Math.abs(a[k][0] - b[k][0]) < 1e-9 && Math.abs(a[k][1] - b[k][1]) < 1e-9,
          `point ${k} mismatch: [${a[k]}] vs [${b[k]}]`,
        );
      }
    }
  });
});

/* ── Stem engine（多学科门面）未 load：默认 JS 实现 ── */

describe('Stem engine facade（未 load：lens / quadratic 默认 JS 指针）', () => {
  test('imageV 与 lens-core 真源一致（含严格 null，不是 NaN）', () => {
    assert.equal(stemImageV(20, 10), 20);
    assert.equal(stemImageV(10, 10), null); // 严格 === null；NaN 会在此失败
    assert.equal(stemImageV(10.005, 10), null);
    assert.ok(stemImageV(5, 10)! < 0); // u < f：虚像（v < 0）
  });

  test('quadraticY / sampleQuadratic 与 quadratic-core 真源逐点一致', () => {
    assert.equal(stemQuadraticY(-2, 0, 3, 1), quadraticY(-2, 0, 3, 1));
    const a = stemSampleQuadratic(-2, 0, 3);
    const b = sampleQuadratic(-2, 0, 3);
    assert.equal(a.length, b.length);
    for (let k = 0; k < a.length; k++) {
      assert.ok(Math.abs(a[k][0] - b[k][0]) < 1e-9 && Math.abs(a[k][1] - b[k][1]) < 1e-9);
    }
  });
});

// loadOhmEngine 永不 reject：无产物 / 缺函数 / 实例化失败一律回退 js
const loadedOhmKind = await loadOhmEngine();

describe('Ohm engine facade（loadOhmEngine 后）', () => {
  test('加载不抛错，kind ∈ {js, wasm}；本机无 stemCore.js 时应为 js', () => {
    assert.ok(loadedOhmKind === 'js' || loadedOhmKind === 'wasm');
    assert.equal(getEngineKind(), loadedOhmKind);
  });

  test(`引擎种类：${loadedOhmKind}（存在 stemCore.js → wasm；否则 JS 回退）`, () => {
    assert.ok(loadedOhmKind === 'js' || loadedOhmKind === 'wasm');
  });

  test('load 后数值与 ohm-core 真源仍一致（< 1e-9）', () => {
    for (const c of ohmCases) {
      assert.ok(Math.abs(currentOf(c.u, c.r, c.element, c.rp) - coreCurrentOf(c.u, c.r, c.element, c.rp)) < 1e-9);
      assert.ok(Math.abs(elementResistance(c.r, c.element, c.u) - coreElementResistance(c.r, c.element, c.u)) < 1e-9);
    }
  });
});

/* ── Stem engine（loadOhmEngine 后）：lens / quadratic 走当前指针 ── */

describe('Stem engine（loadOhmEngine 后）lens / quadratic 数值', () => {
  const hasWasm = existsSync(new URL('./wasm/stemCore.js', import.meta.url));

  test(`产物探测：${hasWasm ? '存在 stemCore.js → 应走 wasm' : '无产物 → js 回退'}；kind = ${loadedOhmKind}`, () => {
    if (hasWasm) {
      assert.equal(loadedOhmKind, 'wasm'); // 本机有产物且导出齐全 → 必须 wasm
    } else {
      assert.equal(loadedOhmKind, 'js');
    }
  });

  test('imageV：wasm（若有）/ js 指针与 lens-core 真源一致，u≈f 严格 null', () => {
    assert.equal(stemImageV(20, 10), 20);
    assert.equal(stemImageV(10, 10), null); // 必须 === null，NaN 会在此失败
    assert.ok(Math.abs(stemImageV(25, 10)! - imageV(25, 10)!) < 1e-9);
    assert.ok(Math.abs(stemImageV(5, 10)! - imageV(5, 10)!) < 1e-9);
  });

  test('quadraticY / sampleQuadratic：与 quadratic-core 真源误差 < 1e-9', () => {
    assert.ok(Math.abs(stemQuadraticY(-2, 0, 3, 1) - quadraticY(-2, 0, 3, 1)) < 1e-9);
    const a = stemSampleQuadratic(1, 0, 0);
    const b = sampleQuadratic(1, 0, 0);
    assert.equal(a.length, b.length);
    for (let k = 0; k < a.length; k++) {
      assert.ok(Math.abs(a[k][1] - b[k][1]) < 1e-9);
    }
  });

  test('currentOf(6,10,resistor) === 0.6（误差 < 1e-9）', () => {
    assert.ok(Math.abs(currentOf(6, 10, 'resistor', 0) - 0.6) < 1e-9);
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

/* ── 填空题解析与判分（judgeFillAnswer） ── */

describe('Fill-in question parsing & grading', () => {
  test('parses fill question with 【类型】填空 marker', () => {
    const raw = '【第1题】\n【类型】填空\n【题目】凸透镜的焦距为 ____cm\n【答案】10\n【解析】标准焦距为 10cm。\n\n';
    const parsed = parseQuizBatch(raw, 1);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].type, 'fill');
    assert.ok(parsed[0].fillAnswers.includes('10'));
  });

  test('parses fill question without 【类型】 (fallback by answer text)', () => {
    const raw = '【第1题】\n【题目】电压为 ____V\n【答案】0.5A 或 500mA\n【解析】根据欧姆定律计算。\n\n';
    const parsed = parseQuizBatch(raw, 1);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].type, 'fill');
    assert.ok(parsed[0].fillAnswers.includes('0.5A'));
    assert.ok(parsed[0].fillAnswers.includes('500mA'));
  });

  test('judgeFillAnswer: 数值容差 0.5 ≈ 1/2', () => {
    assert.ok(judgeFillAnswer('0.5', ['1/2']));
    assert.ok(judgeFillAnswer('0.50', ['0.5']));
    assert.ok(judgeFillAnswer('1/2', ['0.5']));
  });

  test('judgeFillAnswer: 单位归一 0.5A = 0.5 安', () => {
    assert.ok(judgeFillAnswer('0.5A', ['0.5A', '500mA']));
    assert.ok(judgeFillAnswer('0.5安', ['0.5A']));
    assert.ok(judgeFillAnswer('0.5 安培', ['0.5A']));
  });

  test('judgeFillAnswer: LaTeX 去格式等价', () => {
    assert.ok(judgeFillAnswer('H2O', ['H_2O']));
    assert.ok(judgeFillAnswer('h2o', ['H_2O']));
  });

  test('judgeFillAnswer: frac 归一化 i=u/r 匹配 I=\\frac{U}{R}', () => {
    assert.ok(judgeFillAnswer('i=u/r', ['\\(I=\\frac{U}{R}\\)']));
    assert.ok(judgeFillAnswer('I=U/R', ['\\(I=\\frac{U}{R}\\)']));
    assert.ok(judgeFillAnswer('v=s/t', ['\\(v=\\frac{s}{t}\\)（即 v 等于 s 除以 t）']));
  });

  test('judgeFillAnswer: 拒绝错误答案', () => {
    assert.ok(!judgeFillAnswer('3', ['0.5']));
    assert.ok(!judgeFillAnswer('0.5', ['10']));
  });

  test('judgeFillAnswer: 空输入返回 false', () => {
    assert.ok(!judgeFillAnswer('', ['0.5']));
    assert.ok(!judgeFillAnswer('  ', ['0.5']));
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

/* ── Feedback push path（异步：一次提交只推一条 / 不丢记录 / 重试上限） ── */

describe('Feedback push path (one push per submission)', () => {
  const mem = new Map<string, string>();
  const originalFetch = (globalThis as any).fetch;
  let pushCalls: string[] = [];

  const okRes = () => new Response(JSON.stringify({ code: 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  const failRes = () => new Response('', { status: 500 });
  /** 默认失败；用例内可改成成功/延迟，模拟真实链路 */
  let responder: () => Promise<Response> = async () => failRes();
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  function install() {
    pushCalls = [];
    responder = async () => failRes();
    (globalThis as any).fetch = async (_url: unknown, init: any) => {
      pushCalls.push(String(init?.body ?? ''));
      return responder();
    };
    (globalThis as any).window = {
      localStorage: {
        getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
        setItem: (k: string, v: string) => { mem.set(k, v); },
        removeItem: (k: string) => { mem.delete(k); },
      },
    };
  }
  function restore() {
    delete (globalThis as any).window;
    (globalThis as any).fetch = originalFetch;
  }
  const rec = (i: number): FeedbackRecord => ({
    id: `fb-${i}`,
    type: 'project',
    categories: [],
    message: `补传${i}`,
    language: 'zh',
    createdAt: '2026-09-10T03:20:00.000Z',
  });

  testAsync('saveFeedback 只入队不推送（补传时才发，杜绝一次提交两条）', async () => {
    install();
    try {
      responder = async () => okRes();
      saveFeedback(rec(1));
      assert.equal(pushCalls.length, 0, 'saveFeedback 不应触发推送');
      assert.equal(loadFeedback().length, 1);
      await flushFeedbackQueue();
      assert.equal(pushCalls.length, 1, '补传只应推一条');
      assert.equal(loadFeedback().length, 0);
    } finally {
      mem.clear();
      restore();
    }
  });

  testAsync('submitFeedback 一次提交恒定只推一条，成功后出队', async () => {
    install();
    try {
      responder = async () => okRes();
      const sent = await submitFeedback(rec(1));
      assert.equal(sent, true);
      assert.equal(pushCalls.length, 1, `一次提交应只推 1 条，实际 ${pushCalls.length}`);
      assert.equal(loadFeedback().length, 0);
    } finally {
      mem.clear();
      restore();
    }
  });

  testAsync('推送失败时保留记录并计数（不丢反馈）', async () => {
    install();
    try {
      const sent = await submitFeedback(rec(1));
      assert.equal(sent, false);
      assert.equal(pushCalls.length, 1);
      const list = loadFeedback();
      assert.equal(list.length, 1);
      assert.equal(list[0].attempts, 1);
    } finally {
      mem.clear();
      restore();
    }
  });

  testAsync('连续两次提交各推一条，队列不残留', async () => {
    install();
    try {
      responder = async () => { await sleep(15); return okRes(); };
      const [a, b] = await Promise.all([submitFeedback(rec(1)), submitFeedback(rec(2))]);
      assert.equal(a, true);
      assert.equal(b, true);
      assert.equal(pushCalls.length, 2);
      assert.equal(loadFeedback().length, 0);
    } finally {
      mem.clear();
      restore();
    }
  });

  testAsync('并发补传同一条只推一次（在途去重）', async () => {
    install();
    try {
      responder = async () => { await sleep(15); return okRes(); };
      saveFeedback(rec(1));
      await Promise.all([flushFeedbackQueue(), flushFeedbackQueue()]);
      assert.equal(pushCalls.length, 1);
      assert.equal(loadFeedback().length, 0);
    } finally {
      mem.clear();
      restore();
    }
  });

  testAsync('补传期间新提交失败的记录不会被覆盖丢失', async () => {
    install();
    try {
      saveFeedback(rec(0)); // 模拟上次离线残留
      let release: () => void = () => {};
      const gate = new Promise<void>((res) => { release = res; });
      let calls = 0;
      responder = async () => {
        calls++;
        if (calls === 1) { await gate; return okRes(); } // 第一条慢成功
        return failRes(); // 补传期间新提交的这条失败
      };
      const running = flushFeedbackQueue();
      await sleep(10); // 等补传进入第一条的 await
      const sent = await submitFeedback(rec(1));
      assert.equal(sent, false);
      release();
      await running;
      const list = loadFeedback();
      assert.equal(list.length, 1, '新记录应保留待重试，不能被快照覆盖');
      assert.equal(list[0].id, 'fb-1');
      assert.equal(list[0].attempts, 1);
    } finally {
      mem.clear();
      restore();
    }
  });

  testAsync('失败达到上限后丢弃该条（防止永久重复推送）', async () => {
    install();
    try {
      saveFeedback(rec(1));
      for (let i = 0; i < FEEDBACK_MAX_ATTEMPTS - 1; i++) await flushFeedbackQueue();
      assert.equal(loadFeedback().length, 1, '未达上限应保留');
      assert.equal(loadFeedback()[0].attempts, FEEDBACK_MAX_ATTEMPTS - 1);
      await flushFeedbackQueue(); // 第 MAX 次失败
      assert.equal(loadFeedback().length, 0, '达上限应丢弃');
    } finally {
      mem.clear();
      restore();
    }
  });
});


/* ── AI 提示词契约与出题容错（PROMPT_VERSION 随提示词改动递增） ── */

const Q = (over: Partial<QuizQuestion> = {}): QuizQuestion => ({
  question: '题干', options: [], answerIdx: -1, explanation: '', type: 'choice', fillAnswers: [], ...over,
});

const RAW_OK = `【第1题】
【类型】单选
【题目】题干一
A. 甲
B. 乙
C. 丙
D. 丁
【答案】B
【解析】略

【第2题】
【类型】单选
【题目】题干二
A. 甲
B. 乙
C. 丙
D. 丁
【答案】C
【解析】略

===END===`;

describe('AI prompt contracts', () => {
  test('提示词版本号是显式常量（解析异常日志会带上它）', () => {
    assert.equal(typeof PROMPT_VERSION, 'string');
    assert.ok(PROMPT_VERSION.length > 0);
    assert.equal(QUIZ_SENTINEL, '===END===');
  });

  test('答疑提示词：带阶段、禁反问、禁承诺、追问契约在系统侧、资料进标签槽', () => {
    const zh = buildSystemPrompt('zh', '欧姆定律实验', '页面资料', '预测', true);
    assert.ok(zh.includes('当前阶段：预测'), '应带上实验阶段');
    assert.ok(zh.includes('严禁向学生提问或反问'), '必须禁止反问');
    assert.ok(zh.includes('严禁承诺后续交互'), '必须禁止承诺后续');
    assert.ok(zh.includes('可以继续了解：'), '追问标记必须原样出现在契约里');
    assert.ok(zh.includes('不给最终结论'), '探究型问题不给结论');
    assert.ok(zh.includes('<页面资料>'), '页面资料进标签槽');
  });

  test('物理分支判定：显式判定优先，主题串含「物理」作为回退（实验页显示名不含「物理」）', () => {
    // 实验页：显示名是「欧姆定律实验」，必须靠显式判定走物理分支
    assert.ok(buildSystemPrompt('zh', '欧姆定律实验', '', '', true).includes('公式的中文口语读法由朗读功能处理'));
    // 非实验的物理工具页：没有 lab 记录，靠主题串回退
    assert.ok(buildSystemPrompt('zh', '物理公式速查').includes('公式的中文口语读法由朗读功能处理'));
    // 数学实验页：两条都不满足 → 要求补读法
    assert.ok(buildSystemPrompt('zh', '圆的性质实验', '', '', false).includes('补中文口语读法'));
  });

  test('答疑提示词：非物理中文要求补口语读法；无资料时不出现资料块', () => {
    const zh = buildSystemPrompt('zh', '化学元素周期表实验');
    assert.ok(zh.includes('公式首次出现时紧跟一个括号补中文口语读法'));
    assert.ok(!zh.includes('<页面资料>'), '没有资料就不应出现资料块');
  });

  test('英文答疑提示词：禁反问、追问标记、问题进 student_question 标签', () => {
    const en = buildSystemPrompt('en', 'Ohm lab', 'page material', 'predict');
    assert.ok(en.includes('Never ask the student a question'));
    assert.ok(en.includes('You can also explore:'));
    assert.ok(en.includes('<student_question>'));
    assert.ok(en.includes('stage: predict'));
  });

  test('出题提示词：中英都要求输出结束哨兵（解析端据此判截断）', () => {
    const zh = buildQuizPrompt('zh', '欧姆定律实验', '资料', 5, 'basic', 0, 'choice');
    const en = buildQuizPrompt('en', 'Ohm lab', 'material', 5, 'basic', 0, 'choice');
    assert.ok(zh.includes(QUIZ_SENTINEL), '中文出题提示词必须含哨兵');
    assert.ok(en.includes(QUIZ_SENTINEL), '英文出题提示词必须含哨兵');
  });

  test('判分提示词：学生答案进标签槽，输出契约是单个大写字母', () => {
    const zh = buildFillJudgePrompt('zh', '电流是多少', '500 mA', ['0.5A']);
    assert.ok(zh.user.includes('<学生答案>500 mA</学生答案>'));
    assert.ok(zh.system.includes('只输出一个大写字母'));
    assert.ok(zh.system.includes('无法判断时输出 N'));
    const en = buildFillJudgePrompt('en', 'current?', '500 mA', ['0.5A']);
    assert.ok(en.user.includes('<student_answer>500 mA</student_answer>'));
    assert.ok(en.system.includes('Output exactly one capital letter'));
  });

  test('判分结论解析：取第一个 Y/N，不被 Markdown 或标点带偏', () => {
    assert.equal(parseJudgeVerdict('Y'), true);
    assert.equal(parseJudgeVerdict('**Y**'), true, '粗体 Y 必须判对');
    assert.equal(parseJudgeVerdict('"Y"'), true, '带引号的 Y 必须判对');
    assert.equal(parseJudgeVerdict('Y。'), true);
    assert.equal(parseJudgeVerdict(' y '), true);
    assert.equal(parseJudgeVerdict('N'), false);
    assert.equal(parseJudgeVerdict('**N**'), false);
    assert.equal(parseJudgeVerdict(''), false);
    assert.equal(parseJudgeVerdict('抱歉，我无法判断'), false);
  });

  test('出题批量解析：带哨兵的完整输出 = 无需修复', () => {
    const r = parseQuizBatchChecked(RAW_OK, 2);
    assert.equal(r.items.length, 2);
    assert.equal(r.complete, true);
    assert.equal(r.short, false);
    assert.equal(r.reason, '');
  });

  test('出题批量解析：缺哨兵 = 提示末题可能被截断', () => {
    const r = parseQuizBatchChecked(RAW_OK.split(QUIZ_SENTINEL).join(''), 2);
    assert.equal(r.items.length, 2);
    assert.equal(r.complete, false);
    assert.ok(r.reason.includes('结束标记'));
  });

  test('出题批量解析：题数不足 = 提示补齐', () => {
    const one = RAW_OK.split('【第2题】')[0] + '\n' + QUIZ_SENTINEL;
    const r = parseQuizBatchChecked(one, 2);
    assert.equal(r.items.length, 1);
    assert.equal(r.short, true);
    assert.ok(r.reason.includes('2 道'));
  });

  test('出题批量解析：完全解析不出 = 空结果且给出原因', () => {
    const r = parseQuizBatchChecked('模型今天不想出题', 5);
    assert.equal(r.items.length, 0);
    assert.equal(r.reason, '没有解析出任何一道题');
  });

  test('题干去重：同一道题只留一条（修复重试最容易产出重复题）', () => {
    const items = [Q({ question: '同一道题' }), Q({ question: '同一道题' }), Q({ question: '另一道题' })];
    const out = dedupeQuizQuestions(items);
    assert.equal(out.length, 2);
    assert.equal(out[0].question, '同一道题');
    assert.equal(out[1].question, '另一道题');
  });

  test('选项洗牌：选项是原集合的排列，且答案仍指向同一个选项内容', () => {
    const base = Q({ options: ['甲', '乙', '丙', '丁'], answerIdx: 2, explanation: 'x' });
    const seq = [0.9, 0.1, 0.5];
    let k = 0;
    const shuffled = shuffleOptions(base, () => seq[k++ % seq.length]);
    assert.deepEqual([...shuffled.options].sort(), [...base.options].sort(), '洗牌不应增删选项');
    assert.equal(shuffled.options[shuffled.answerIdx], '丙', '答案必须跟着选项一起搬家');
  });

  test('选项洗牌：填空题与非选择题原样返回', () => {
    const fill = Q({ type: 'fill', options: [], answerIdx: -1 });
    assert.equal(shuffleOptions(fill).options.length, 0);
    const broken = Q({ options: ['甲', '乙'], answerIdx: -1 });
    assert.equal(shuffleOptions(broken).answerIdx, -1, '无标准答案不洗牌');
  });

  test('动态问题：欧姆定律用当前读数出题，缺读数则回退静态文案', () => {
    const withReading = getDynamicQuestions('ohm', { u: 6, i: 0.48, element: 'bulb' }, 'zh', '静态问题');
    assert.equal(withReading.length, 2);
    assert.ok(withReading[0].includes('6.00V') && withReading[0].includes('0.48A'), '应插进当前读数');
    assert.ok(withReading[0].includes('灯泡'));
    assert.equal(withReading[1], '静态问题', '静态文案留在末位兜底');
    const missing = getDynamicQuestions('ohm', { u: 6 }, 'zh', '静态问题');
    assert.deepEqual(missing, ['静态问题'], '读数不全时不得输出半句话');
  });

  test('动态问题：凸透镜 u≈f（像距为空）与未注册实验都回退静态文案', () => {
    assert.deepEqual(getDynamicQuestions('lens', { u: 10, f: 10, v: null }, 'zh', '静态'), ['静态']);
    const ok = getDynamicQuestions('lens', { u: 25, f: 10, v: 16.67 }, 'zh', '静态');
    assert.ok(ok[0].includes('25.00cm') && ok[0].includes('16.67cm'));
    assert.deepEqual(getDynamicQuestions('circle', { u: 1 }, 'zh', '静态'), ['静态']);
  });

  test('动态问题：杠杆带平衡状态；英文模板同样成句', () => {
    const bal = getDynamicQuestions('lever', { m1: 2, d1: 3, m2: 3, d2: 2, balanced: true }, 'zh', '静态');
    assert.ok(bal[0].includes('2×3') && bal[0].includes('刚好平衡'));
    const en = getDynamicQuestions('lever', { m1: 2, d1: 3, m2: 3, d2: 2, balanced: false }, 'en', 'static');
    assert.ok(en[0].includes('tilts to the heavier side'));
  });

  test('动态问题：三个试点的输出都不含 undefined / NaN', () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ['ohm', { u: 6, i: 0.6, element: 'resistor' }],
      ['lens', { u: 25, f: 10, v: 16.67 }],
      ['lever', { m1: 2, d1: 3, m2: 3, d2: 2, balanced: false }],
    ];
    for (const [lab, state] of cases) {
      const out = getDynamicQuestions(lab, state, 'zh', '静态')[0];
      assert.ok(!/undefined|NaN/.test(out), lab + ' 输出不应含 undefined/NaN');
    }
  });

  test('实验状态注册表与阶段标签：写入即读、可清除、可从路径取实验 id', () => {
    setLabState('ohm', { stage: 'explore' });
    assert.equal(getLabState('ohm')?.stage, 'explore');
    clearLabState('ohm');
    assert.equal(getLabState('ohm'), undefined);
    assert.equal(labIdFromPath('/lab/ohm?x=1'), 'ohm');
    assert.equal(labIdFromPath('/periodic-table'), '');
    assert.equal(stageLabel('predict', 'zh'), '预测');
    assert.equal(stageLabel('conclude', 'en'), 'conclude');
    assert.equal(stageLabel(undefined, 'zh'), '');
  });
});


/* ── AI 思考过程只显示（Phase 1：不配置、不改请求参数）── */

const T_OPEN = '<`think>';
const T_CLOSE = '</`think>';

describe('AI thinking stream (display only)', () => {
  test('流式 delta：思考字段名各家不同，正文永不被污染', () => {
    assert.deepEqual(extractStreamDelta({ choices: [{ delta: { content: '正文' } }] }), { content: '正文', reasoning: '' });
    assert.deepEqual(extractStreamDelta({ choices: [{ delta: { reasoning_content: '想' } }] }), { content: '', reasoning: '想' });
    assert.deepEqual(extractStreamDelta({ choices: [{ delta: { reasoning: '想' } }] }), { content: '', reasoning: '想' },
      'vLLM 系用 reasoning 字段');
    assert.deepEqual(extractStreamDelta({ choices: [{ delta: { reasoning_content: 'A', reasoning: 'B', content: 'C' } }] }),
      { content: 'C', reasoning: 'A' }, '两个思考字段同时出现时优先 reasoning_content');
    assert.deepEqual(extractStreamDelta({}), { content: '', reasoning: '' });
    assert.deepEqual(extractStreamDelta(null), { content: '', reasoning: '' });
  });

  test('内联思考标签：正文/思考各归各位，闭标签之后一律正文', () => {
    const got: string[] = [];
    const s = createInlineThinkSplitter((ch, t) => got.push(`${ch}:${t}`));
    s.push(`前文${T_OPEN}思考中${T_CLOSE}后文`);
    s.flush();
    assert.deepEqual(got, ['content:前文', 'reasoning:思考中', 'content:后文']);
  });

  test('内联标签跨 chunk：标签被切开也不能漏进正文', () => {
    const got: string[] = [];
    const s = createInlineThinkSplitter((ch, t) => got.push(`${ch}:${t}`));
    s.push(`A${T_OPEN.slice(0, 5)}`);      // 半个开标签（还缺 nk>）
    s.push(`nk>B${T_CLOSE.slice(0, 5)}`);  // 补齐开标签 + 半个闭标签（还缺 ing>）
    s.push('ink>C');
    s.flush();
    assert.equal(got.join('|'), 'content:A|reasoning:B|content:C', `实际 ${got.join('|')}`);
  });

  test('未闭合的思考标签：余下内容进思考通道，不污染正文', () => {
    const got: string[] = [];
    const s = createInlineThinkSplitter((ch, t) => got.push(`${ch}:${t}`));
    s.push(`A${T_OPEN}B`);
    s.flush();
    assert.equal(got.join('|'), 'content:A|reasoning:B');
  });

  testAsync('streamChat 端到端：思考走 reasoning 通道，返回值只有正文', async () => {
    const originalFetch = (globalThis as any).fetch;
    const enc = new TextEncoder();
    const sse = (obj: unknown) => `data: ${JSON.stringify(obj)}\n\n`;
    (globalThis as any).fetch = async () => {
      const stream = new ReadableStream({
        start(c) {
          c.enqueue(enc.encode(sse({ choices: [{ delta: { reasoning_content: '先想一下。' } }] })));
          c.enqueue(enc.encode(sse({ choices: [{ delta: { content: '结论' } }] })));
          c.enqueue(enc.encode(sse({ choices: [{ delta: { content: '在此' } }] })));
          c.enqueue(enc.encode('data: [DONE]\n\n'));
          c.close();
        },
      });
      return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    };
    try {
      const reasons: string[] = [];
      const contents: string[] = [];
      const full = await streamChat(
        { providerId: 'custom', apiKey: 'k', baseUrl: 'https://example.com/v1', model: 'm', agreed: true },
        [{ role: 'user', content: 'hi' }],
        (d) => contents.push(d),
        undefined,
        100,
        (r) => reasons.push(r),
      );
      assert.equal(full, '结论在此', '返回值只能是正文');
      assert.deepEqual(reasons, ['先想一下。'], '思考必须走 reasoning 通道');
      assert.deepEqual(contents, ['结论', '在此']);
    } finally {
      (globalThis as any).fetch = originalFetch;
    }
  });
});

/* ── 原子结构示意图：电子层点数不得截断（科学事实优先于观感） ── */

describe('原子结构示意图 · 电子层点数（真实电子数，不截断）', () => {
  test('Fe（[2,8,14,2]）每层点数与真实电子数严格相等', () => {
    const fe = shellLayout([2, 8, 14, 2], coreRadiusFor(26));
    assert.deepEqual(fe.map((s) => s.count), [2, 8, 14, 2]);
    assert.deepEqual(fe.map((s) => s.dots.length), [2, 8, 14, 2], '第 3 层必须是 14 点，不能是 8');
  });

  test('Au（[2,8,18,32,18,1]）第 3/4/5 层分别为 18/32/18 点（旧的 8 点上限已废除）', () => {
    const au = shellLayout([2, 8, 18, 32, 18, 1], coreRadiusFor(79));
    assert.deepEqual(au.map((s) => s.dots.length), [2, 8, 18, 32, 18, 1]);
    assert.equal(Math.max(...au.map((s) => s.dots.length)), 32);
  });

  test('全部 118 个元素：点数 == 真实电子数，相邻点不重叠，且不溢出画布', () => {
    assert.equal(ELEMENTS.length, 118, '元素表应为 118 个');
    for (const el of ELEMENTS) {
      const layout = shellLayout(el.shells, coreRadiusFor(el.n));
      assert.deepEqual(
        layout.map((s) => s.dots.length),
        el.shells,
        `${el.zh}（Z=${el.n}）点数与真实电子数不一致`,
      );
      layout.forEach((s, i) => {
        if (s.count > 1) {
          // 整圈均匀分布：相邻点最小间距为弦长 2r·sin(π/n)，必须大于点直径
          const chord = 2 * s.r * Math.sin(Math.PI / s.count);
          assert.ok(
            chord > 2 * s.dotR,
            `${el.zh} 第 ${i + 1} 层点重叠：弦长 ${chord.toFixed(2)} ≤ 直径 ${(2 * s.dotR).toFixed(2)}`,
          );
        }
        assert.ok(
          s.r + s.dotR <= ATOM_VIEW.h / 2,
          `${el.zh} 第 ${i + 1} 层溢出画布：外沿 ${(s.r + s.dotR).toFixed(2)} > ${ATOM_VIEW.h / 2}`,
        );
      });
    }
  });

  test('点半径按密度自适应：≤8 保持 2.6，>18 收细但仍 ≥1.8', () => {
    assert.equal(dotRadiusFor(2), 2.6);
    assert.equal(dotRadiusFor(8), 2.6);
    assert.ok(dotRadiusFor(18) < 2.6, '9~18 应略收细');
    assert.ok(dotRadiusFor(32) < dotRadiusFor(18), '32 点层应比 18 点层更细');
    assert.ok(dotRadiusFor(32) >= 1.8 && dotRadiusFor(32) <= 2.0, '32 点层半径应落在 1.8~2.0');
  });

  test('图上点数与属性栏「电子层排布」文本同源同值（同一视图不得自相矛盾）', () => {
    for (const z of [26, 47, 79, 92]) {
      const el = ELEMENTS.find((e) => e.n === z);
      assert.ok(el, `元素表缺少 Z=${z}`);
      const drawn = shellLayout(el.shells, coreRadiusFor(el.n)).map((s) => s.dots.length).join(', ');
      assert.equal(drawn, el.shells.join(', '), `Z=${z} 图上点数与属性栏文本不一致`);
    }
  });
});

/* ── AI 思考强度档位：逐模型能力表，档位必须真正互不相同 ── */

describe('AI 思考强度档位（逐模型能力表；教学伦理：只调思考深度，不改提示词约束）', () => {
  const P = (pid: string, model: string, e: ThinkingEffort) => buildThinkingParams(pid, model, e);

  test('DeepSeek：三档互不相同，不再出现「标准 = 深度」的空操作', () => {
    assert.deepEqual(P('deepseek', 'deepseek-chat', 'off'), { thinking: { type: 'disabled' } });
    assert.deepEqual(P('deepseek', 'deepseek-chat', 'standard'), { reasoning_effort: 'low' });
    assert.deepEqual(P('deepseek', 'deepseek-chat', 'deep'), { reasoning_effort: 'high' });
    assert.notDeepEqual(
      P('deepseek', 'deepseek-chat', 'standard'),
      P('deepseek', 'deepseek-chat', 'deep'),
      '标准与深度不得等价（DeepSeek 默认即 high，标准档必须显式下调）',
    );
    assert.equal(thinkingPlanFor('deepseek', 'deepseek-reasoner').note, undefined);
  });

  test('通义千问：删除被误当「力度」的 2048 上限；标准取平台默认上限、深度放开', () => {
    assert.deepEqual(P('dashscope', 'qwen-plus', 'off'), { enable_thinking: false });
    assert.deepEqual(P('dashscope', 'qwen-plus', 'standard'), { enable_thinking: true, thinking_budget: 4000 });
    assert.deepEqual(P('dashscope', 'qwen-plus', 'deep'), { enable_thinking: true });
    assert.equal(
      (P('dashscope', 'qwen-plus', 'deep') as { thinking_budget?: number }).thinking_budget,
      undefined,
      '深度档不得再设上限（thinking_budget 是上限而非力度，设小了等于反向下调）',
    );
    assert.ok(
      !JSON.stringify(P('dashscope', 'qwen-plus', 'deep')).includes('2048'),
      '深度档必须彻底移除 2048',
    );
    assert.notDeepEqual(P('dashscope', 'qwen-plus', 'standard'), P('dashscope', 'qwen-plus', 'deep'));
  });

  test('智谱 GLM-5.3：纯推理模型不提供关闭档（传 disabled 会被拒），力度 low/max', () => {
    assert.deepEqual(thinkingPlanFor('zhipu', 'glm-5.3').available, ['standard', 'deep']);
    assert.equal(thinkingPlanFor('zhipu', 'glm-5.3').note, 'cannotDisable');
    assert.equal(
      (P('zhipu', 'glm-5.3', 'off') as { thinking?: unknown }).thinking,
      undefined,
      'GLM-5.3 关不得：绝不能下发 thinking.type=disabled',
    );
    assert.deepEqual(P('zhipu', 'glm-5.3', 'standard'), { reasoning_effort: 'low' });
    assert.deepEqual(P('zhipu', 'glm-5.3', 'deep'), { reasoning_effort: 'max' });
    assert.deepEqual(thinkingPlanFor('zhipu', 'glm-5.3-flash').available, ['standard', 'deep']);
  });

  test('智谱 GLM-4.5 可关闭但无力度档；glm-4-flash 不在支持范围，不发任何参数', () => {
    assert.deepEqual(thinkingPlanFor('zhipu', 'glm-4.5').available, ['off', 'standard']);
    assert.equal(thinkingPlanFor('zhipu', 'glm-4.5').note, 'noEffortTier');
    assert.deepEqual(P('zhipu', 'glm-4.5', 'off'), { thinking: { type: 'disabled' } });
    assert.deepEqual(P('zhipu', 'glm-4.5', 'deep'), {}, '没有力度档就不许下发力度字段');
    assert.deepEqual(thinkingPlanFor('zhipu', 'glm-4-flash').available, []);
    assert.equal(thinkingPlanFor('zhipu', 'glm-4-flash').note, 'noThinkingSupport');
    assert.deepEqual(P('zhipu', 'glm-4-flash', 'deep'), {});
  });

  test('Kimi 逐模型：k3 可调力度不可关、k2.6 可关无力度、k2.7-code 什么都不可调', () => {
    assert.deepEqual(thinkingPlanFor('moonshot', 'kimi-k3').available, ['standard', 'deep']);
    assert.deepEqual(P('moonshot', 'kimi-k3', 'standard'), { reasoning_effort: 'low' });
    assert.deepEqual(P('moonshot', 'kimi-k3', 'deep'), { reasoning_effort: 'max' });
    assert.equal((P('moonshot', 'kimi-k3', 'off') as { thinking?: unknown }).thinking, undefined);
    assert.deepEqual(thinkingPlanFor('moonshot', 'kimi-k2.6').available, ['off', 'standard']);
    assert.deepEqual(P('moonshot', 'kimi-k2.6', 'off'), { thinking: { type: 'disabled' } });
    assert.equal((P('moonshot', 'kimi-k2.6', 'deep') as { reasoning_effort?: unknown }).reasoning_effort, undefined, 'k2.6 不支持 reasoning_effort');
    assert.deepEqual(thinkingPlanFor('moonshot', 'kimi-k2.7-code').available, []);
    assert.equal(thinkingPlanFor('moonshot', 'kimi-k2.7-code').note, 'alwaysThinksNoKnob');
    assert.deepEqual(P('moonshot', 'kimi-k2.7-code', 'deep'), {});
  });

  test('自定义端点与未收录模型一律不下发思考字段（不猜参数名，防 400）', () => {
    assert.deepEqual(thinkingPlanFor('custom', 'anything').available, []);
    assert.equal(thinkingPlanFor('custom', 'anything').note, 'passthroughOnly');
    assert.deepEqual(P('custom', 'deepseek-chat', 'deep'), {}, '自定义端点是透传，不套用能力表');
    assert.deepEqual(P('deepseek', 'some-unknown-model', 'deep'), {});
    assert.equal(thinkingPlanFor('deepseek', 'some-unknown-model').note, 'unverified');
    assert.deepEqual(thinkingPlanFor('deepseek', '').available, []);
  });

  test('生效档位回落：不可用档位回到标准档，完全不可调时返回 null', () => {
    assert.equal(effectiveThinkingEffort('deepseek', 'deepseek-chat', 'deep'), 'deep');
    assert.equal(effectiveThinkingEffort('zhipu', 'glm-5.3', 'off'), 'standard', '关闭不可用应回落标准');
    assert.equal(effectiveThinkingEffort('moonshot', 'kimi-k2.7-code', 'deep'), null);
    assert.equal(effectiveThinkingEffort('deepseek', 'deepseek-chat', undefined), 'standard');
    assert.equal(effectiveThinkingEffort('custom', 'x', 'deep'), null);
  });

  test('置灰判据：只有「模型有档位集合但缺这一档」才置灰，无可调参数时三档都不得置灰', () => {
    const glm53 = thinkingPlanFor('zhipu', 'glm-5.3');
    assert.equal(isTierLocked(glm53, 'off'), true, 'GLM-5.3 的关闭档应置灰');
    assert.equal(isTierLocked(glm53, 'standard'), false);
    assert.equal(isTierLocked(glm53, 'deep'), false);
    // 回归防护：没有可调参数的模型若把三档全置灰，点击将毫无反馈（用户报告过的缺陷）
    for (const [pid, m] of [
      ['custom', 'anything'],
      ['deepseek', 'some-unknown-model'],
      ['moonshot', 'kimi-k2.7-code'],
      ['zhipu', 'glm-4-flash'],
    ] as const) {
      const plan = thinkingPlanFor(pid, m);
      assert.deepEqual(plan.available, [], `${pid}/${m} 应无可选档位`);
      for (const t of ['off', 'standard', 'deep'] as ThinkingEffort[]) {
        assert.equal(isTierLocked(plan, t), false, `${pid}/${m} 的 ${t} 不得置灰（否则点击无反馈）`);
      }
    }
  });

  test('自定义端点附加参数：合法 JSON 对象才合并，其余一律忽略（宽松透传不阻断）', () => {
    assert.deepEqual(parseExtraParams('{"reasoning_effort":"high"}'), { reasoning_effort: 'high' });
    assert.deepEqual(parseExtraParams('  {"a":1,"b":{"c":2}}  '), { a: 1, b: { c: 2 } });
    assert.deepEqual(parseExtraParams(''), {});
    assert.deepEqual(parseExtraParams('   '), {});
    assert.deepEqual(parseExtraParams(undefined), {});
    assert.deepEqual(parseExtraParams('[1,2]'), {}, '数组不是普通对象，应忽略');
    assert.deepEqual(parseExtraParams('"just a string"'), {}, '标量应忽略');
    assert.deepEqual(parseExtraParams('{"a":}'), {}, '非法 JSON 应忽略');
  });

  testAsync('streamChat：三家请求体各自正确，且不含多余或会被拒的字段', async () => {
    const originalFetch = (globalThis as any).fetch;
    const enc = new TextEncoder();
    let sent: Record<string, unknown> = {};
    (globalThis as any).fetch = async (_url: string, init: any) => {
      sent = JSON.parse(init.body);
      const stream = new ReadableStream({
        start(c) {
          c.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: 'ok' } }] })}\n\n`));
          c.enqueue(enc.encode('data: [DONE]\n\n'));
          c.close();
        },
      });
      return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    };
    const ask = (cfg: Record<string, unknown>) =>
      streamChat({ apiKey: 'k', agreed: true, ...cfg } as never, [{ role: 'user', content: 'hi' }], () => {});

    try {
      // ① DeepSeek 关闭：thinking.type=disabled，且不得同时带 reasoning_effort
      await ask({ providerId: 'deepseek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', thinkingEffort: 'off' });
      assert.deepEqual(sent.thinking, { type: 'disabled' });
      assert.equal(sent.reasoning_effort, undefined);

      // ② DeepSeek 标准 / 深度：显式低强度与高强度，两者不同
      await ask({ providerId: 'deepseek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', thinkingEffort: 'standard' });
      assert.equal(sent.reasoning_effort, 'low');
      await ask({ providerId: 'deepseek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', thinkingEffort: 'deep' });
      assert.equal(sent.reasoning_effort, 'high');

      // ③ 通义千问标准：平台默认上限 4000；深度：放开上限（无 thinking_budget）
      await ask({ providerId: 'dashscope', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', thinkingEffort: 'standard' });
      assert.equal(sent.enable_thinking, true);
      assert.equal(sent.thinking_budget, 4000);
      await ask({ providerId: 'dashscope', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', thinkingEffort: 'deep' });
      assert.equal(sent.enable_thinking, true);
      assert.equal(sent.thinking_budget, undefined, '深度档必须放开上限');

      // ④ GLM-5.3 关闭（纯推理模型关不掉）：安全回落为标准档——绝不下发 disabled（会被拒），
      //    回落后按标准档下发较低力度，与界面留痕完全一致
      await ask({ providerId: 'zhipu', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-5.3', thinkingEffort: 'off' });
      assert.equal(sent.thinking, undefined, 'GLM-5.3 传 disabled 会报错');
      assert.equal(sent.reasoning_effort, 'low', '关不掉的模型必须回落标准档，而非静默不下发');
      await ask({ providerId: 'zhipu', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-5.3', thinkingEffort: 'deep' });
      assert.equal(sent.reasoning_effort, 'max');

      // ⑤ 自定义端点：能力表不介入，只合并用户透传
      await ask({ providerId: 'custom', baseUrl: 'https://x.example.com/v1', model: 'm', thinkingEffort: 'deep', extraParamsText: '{"reasoning_effort":"max","top_p":0.9}' });
      assert.equal(sent.reasoning_effort, 'max');
      assert.equal(sent.top_p, 0.9);
      assert.equal(sent.thinking, undefined);
      assert.equal(sent.model, 'm');
      assert.equal(sent.stream, true);

      // ⑥ 非自定义端点不得外泄透传参数
      await ask({ providerId: 'deepseek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', thinkingEffort: 'standard', extraParamsText: '{"top_p":0.9}' });
      assert.equal(sent.top_p, undefined);
    } finally {
      (globalThis as any).fetch = originalFetch;
    }
  });
});


/* ── 思考参数下发：请求体与界面留痕共用唯一出口 resolveThinkingDispatch ── */

describe('思考参数下发 · 留痕与实发同源（resolveThinkingDispatch）', () => {
  const D = (providerId: string, model: string, thinkingEffort?: ThinkingEffort, extraParamsText?: string) =>
    resolveThinkingDispatch({ providerId, model, thinkingEffort, extraParamsText });

  test('P1-1 自定义端点填了透传：params 与留痕都如实反映真实键值', () => {
    const d = D('custom', 'local-llama3', 'standard', '{"reasoning_effort":"max"}');
    assert.deepEqual(d.params, { reasoning_effort: 'max' });
    assert.equal(d.summaryText, 'reasoning_effort=max', '留痕必须显示透传，严禁谎报「不下发任何参数」');
    assert.equal(d.effort, null, '自定义端点不预设档位，一律由透传决定');
  });

  test('P1-1 多键与嵌套值同样如实呈现；未填透传时才为空', () => {
    assert.equal(
      D('custom', 'm', 'deep', '{"reasoning_effort":"max","top_p":0.9}').summaryText,
      'reasoning_effort=max, top_p=0.9',
    );
    assert.equal(D('custom', 'm', 'deep', '{"thinking":{"type":"enabled"}}').summaryText, 'thinking.type=enabled');
    const empty = D('custom', 'm', 'deep');
    assert.deepEqual(empty.params, {});
    assert.equal(empty.summaryText, '', '空透传时留痕为空，界面才显示「不下发任何思考参数」');
    // 非法 JSON 透传：不阻断，也不谎报
    assert.deepEqual(D('custom', 'm', 'deep', '{"a":}').params, {});
  });

  test('P1-2 存储档位为 off / 非法：回落标准档，请求体与留痕同为一个事实', () => {
    const g = D('zhipu', 'glm-5.3', 'off');
    assert.equal(g.effort, 'standard', 'GLM-5.3 关不掉 → 回落标准');
    assert.deepEqual(g.params, { reasoning_effort: 'low' });
    assert.equal(g.summaryText, 'reasoning_effort=low', '留痕必须与实发一致，不得再说「不下发任何参数」');
    // 合法 off 仍照发（DeepSeek 可关闭）
    const d = D('deepseek', 'deepseek-chat', 'off');
    assert.deepEqual(d.params, { thinking: { type: 'disabled' } });
    assert.equal(d.summaryText, 'thinking.type=disabled');
    // 未收录模型无档位：什么都不发，留痕为空
    const u = D('deepseek', 'some-unknown-model', 'deep');
    assert.equal(u.effort, null);
    assert.deepEqual(u.params, {});
    assert.equal(u.summaryText, '');
    // 空模型名（刚切服务商的瞬间）不得乱发参数
    assert.deepEqual(D('deepseek', '', 'deep').params, {});
  });

  test('留痕文本恒等于实发字段的描述（同源、不可漂移）', () => {
    const cases: [string, string, ThinkingEffort, string | undefined][] = [
      ['deepseek', 'deepseek-chat', 'standard', undefined],
      ['deepseek', 'deepseek-chat', 'off', undefined],
      ['dashscope', 'qwen-plus', 'standard', undefined],
      ['zhipu', 'glm-5.3', 'off', undefined],
      ['moonshot', 'kimi-k2.7-code', 'deep', undefined],
      ['custom', 'local', 'deep', '{"a":1,"b":{"c":2}}'],
      ['custom', 'local', 'deep', undefined],
    ];
    for (const [pid, m, e, x] of cases) {
      const d = D(pid, m, e, x);
      assert.equal(d.summaryText, describeThinkingParams(d.params), `${pid}/${m}/${e} 留痕必须由实发字段生成`);
    }
  });

  test('代码级防漂移：streamChat 与面板留痕必须共用同一出口', () => {
    const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
    const lib = strip(readFileSync('src/lib/ai-config.ts', 'utf8'));
    const body = lib.slice(lib.indexOf('export async function streamChat'));
    assert.ok(body.includes('resolveThinkingDispatch(cfg).params'), 'streamChat 必须用 resolveThinkingDispatch 组装');
    assert.ok(!body.includes('buildThinkingParams(cfg.providerId'), 'streamChat 不得再自己拼一半');
    assert.ok(!body.includes('parseExtraParams(cfg.extraParamsText)'), '透传不得在 streamChat 里另拼一次');
    const panel = strip(readFileSync('src/components/ai/AiAssistant.tsx', 'utf8'));
    assert.ok(
      panel.includes('resolveThinkingDispatch({ providerId, model, thinkingEffort, extraParamsText })'),
      '面板留痕必须走同一出口',
    );
    assert.ok(panel.includes('sentDesc = dispatch.summaryText'), '留痕文本只能取自 dispatch');
  });
});


/* ── AI 配置：Key 按服务商隔离（换服务商不得沿用上一家的 Key） ── */

describe('AI 配置 · Key 按服务商隔离', () => {
  test('历史配置（无 keyByProvider）把 Key 归到它自己的服务商，不外泄给其他家', () => {
    const legacy = {
      providerId: 'deepseek', apiKey: 'sk-deepseek-only', baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-chat', agreed: true,
    };
    const map = keysByProviderOf(legacy);
    assert.equal(map.deepseek, 'sk-deepseek-only');
    assert.equal(map.dashscope, undefined, '不得把 DeepSeek 的 Key 带到通义千问');
    assert.equal(map.moonshot, undefined);
    assert.equal(map.custom, undefined);
    // 切到未配置的服务商，输入框应拿到空串
    assert.equal(map.dashscope ?? '', '');
  });

  test('多家各自保存，互不覆盖（切回原服务商能取回自己的 Key）', () => {
    const cfg = {
      providerId: 'dashscope', apiKey: 'sk-qwen', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: 'qwen-plus', agreed: true,
      keyByProvider: { deepseek: 'sk-ds', dashscope: 'sk-qwen' },
    };
    const map = keysByProviderOf(cfg);
    assert.deepEqual(Object.keys(map).sort(), ['dashscope', 'deepseek']);
    assert.equal(map.deepseek, 'sk-ds');
    assert.equal(map.dashscope, 'sk-qwen');
    assert.equal(map.zhipu ?? '', '', '没配置过的服务商必须为空');
  });

  test('keyByProvider 缺失或配置为空时返回空映射，不抛错', () => {
    assert.deepEqual(keysByProviderOf(null), {});
    const bare = { providerId: 'zhipu', apiKey: '', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4.5', agreed: true };
    assert.deepEqual(keysByProviderOf(bare), {}, '空 Key 不应写入映射');
  });
});


/* ── AI 面板文案合规：不得出现不实安全声明 ── */

describe('AI 面板文案合规（安全声明与用量口径）', () => {
  const panelSrc = readFileSync('src/components/ai/AiAssistant.tsx', 'utf8');
  // 只检查用户可见文案：先剥掉注释（注释里出现「加密」二字不算声明，但会误伤断言）
  const panelCopy = panelSrc
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/[^\n]*/g, '$1');

  test('安全声明不得出现「加密」：密钥是明文存于本机 localStorage', () => {
    assert.ok(
      !panelCopy.includes('加密'),
      '禁止声称「加密」——saveAiConfig 直接 JSON.stringify 写入 localStorage，并无加密',
    );
    assert.ok(
      panelSrc.includes('密钥仅保存在本机浏览器的本地存储'),
      '安全声明须使用已核定的规范文案（只陈述事实）',
    );
    assert.ok(panelSrc.includes('不上报任何开发者服务器'), '安全声明须写明不上报开发者服务器');
  });

  test('用量口径须标明为本地估算，不得冒充服务商账单', () => {
    assert.ok(panelSrc.includes('本地估算值，非服务商账单口径'), '用量文案须写明是本地估算值');
    assert.ok(
      !panelSrc.includes('按模型返回统计'),
      '尚未解析服务商回传的 usage（无 stream_options），不得声称按返回统计',
    );
  });
});


/* ── 浮层高度边界：低矮视口下弹窗/面板不得把自己的操作栏挤出可见范围 ── */

describe('浮层高度边界（操作栏不得被内容挤出视口）', () => {
  const panelSrc = readFileSync('src/components/ai/AiAssistant.tsx', 'utf8');
  const cssSrc = readFileSync('src/index.css', 'utf8');

  test('错题卷导出弹窗：安全最大高度 + 内容区可滚 + 页脚不参与收缩', () => {
    const card = panelSrc.match(/className="relative z-10 flex flex-col w-full max-w-sm max-h-\[85dvh\][^"]*"/);
    assert.ok(card, '弹窗卡片必须显式声明 flex flex-col 与 max-h-[85dvh]——否则矮视口下顶底同时被裁且遮罩不可滚');
    assert.ok(
      panelSrc.includes('flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3 space-y-3'),
      '弹窗内容区必须是 flex-1 min-h-0 且可滚动，操作项才不会被推出去',
    );
    assert.ok(
      /className="shrink-0 flex items-center gap-2 px-4 py-3 border-t border-\[var\(--border\)\]"/.test(panelSrc),
      '弹窗页脚必须 shrink-0（不参与收缩），保证「开始打印」常驻',
    );
  });

  test('设置面板操作栏吸底常驻（sticky bottom-0 且带不透明底色）', () => {
    const bar = panelSrc.match(/className="sticky bottom-0[^"]*"/);
    assert.ok(bar, '设置面板的「保存/清除」操作栏必须吸底，否则长表单下保存按钮滚出可见区');
    assert.ok(bar[0].includes('bg-[var(--bg)]'), '吸底操作栏需要不透明底色，否则滚动内容会从中透出');
    assert.ok(bar[0].includes('border-t'), '吸底操作栏需要上边框与内容区分隔');
  });

  test('预览工具栏与卷面预览容器留出底部安全区（env(safe-area-inset-bottom)）', () => {
    assert.ok(
      /\.exam-preview-bar\s*\{[\s\S]*?env\(safe-area-inset-bottom/.test(cssSrc),
      '固定吸底的预览工具栏必须做底部安全区兜底，否则被 Home Indicator 压住',
    );
    assert.ok(
      /data-preview='on'\]\s*\{[\s\S]*?padding: 26px 16px calc\(96px \+ env\(safe-area-inset-bottom/.test(cssSrc),
      '预览容器底部内边距须随安全区增长，卷面尾页才不会被工具栏盖住',
    );
  });

  test('软键盘适配：视觉视口变量被维护且被移动端抽屉使用', () => {
    const mainSrc = readFileSync('src/main.tsx', 'utf8');
    assert.ok(
      /visualViewport\?\.addEventListener\('(resize|scroll)'/.test(mainSrc),
      'main.tsx 必须监听 visualViewport 的 resize —— 软键盘不触发 window.resize，dvh 也不随键盘收缩',
    );
    assert.ok(mainSrc.includes("setProperty('--kb'"), 'main.tsx 必须维护 --kb（键盘占高）');
    assert.ok(mainSrc.includes("setProperty('--vvh'"), 'main.tsx 必须维护 --vvh（视觉视口高）');
    assert.ok(/raw < 120 \? 0/.test(mainSrc), 'iOS 地址栏收展造成的几十像素差不得被当成键盘（阈值兜底）');
    assert.ok(
      panelSrc.includes('bottom-[var(--kb,0px)]') &&
        panelSrc.includes('max-h-[min(85dvh,var(--vvh,100dvh))]'),
      '移动端抽屉必须以 --kb 抬高、以 --vvh 限高，否则键盘弹起会盖住吸底操作栏与输入框',
    );
  });

  test('卷面不含写死超过 A4 内容高的固定像素高度（唯一固定高为演算留白 mm）', () => {
    const paperSrc = readFileSync('src/components/ai/QuizPaperPrint.tsx', 'utf8');
    const pxHeights = [...paperSrc.matchAll(/height:\s*[^,}\n]*?px/g)].map((m) => m[0].trim());
    assert.equal(pxHeights.length, 0, `卷面不得写死像素高度（实际：${pxHeights.join(' | ')}）`);
    assert.ok(
      /height:\s*`\$\{[^`]*\}mm`/.test(paperSrc),
      '演算留白应以毫米声明（height: `${blankMm}mm`），随题目自适应而非写死',
    );
    const paperCss = cssSrc.match(/#quiz-paper-root[\s\S]*?(?=@media screen|$)/)?.[0] ?? '';
    assert.ok(
      !/min-height:\s*\d+px|(^|\s)height:\s*\d+px/m.test(paperCss),
      '卷面本体不得使用固定像素高度，分页交给浏览器流式排版',
    );
  });
});


/* ── 触屏命中区：主操作保底 44px、微型图标热区外扩（视觉尺寸一律不变） ── */

describe('触屏命中区（hover:none + pointer:coarse）', () => {
  const cssSrc = readFileSync('src/index.css', 'utf8');
  const panelSrc = readFileSync('src/components/ai/AiAssistant.tsx', 'utf8');
  const touchBlock = cssSrc.match(/@media \(hover: none\) and \(pointer: coarse\) \{[\s\S]*?\n\}/)?.[0] ?? '';

  test('命中区规则限定在粗指针媒体查询内（不得误伤桌面）', () => {
    assert.ok(touchBlock, '缺少 (hover: none) and (pointer: coarse) 媒体查询：命中区规则会污染桌面版');
    assert.ok(/\.tap-primary,[\s\S]*?min-height: 44px/.test(touchBlock), '主操作按钮在触屏下必须保底 44px');
    assert.ok(touchBlock.includes('.exam-preview-bar button'), '打印预览工具条同样属于底部主操作，需一并保底');
  });

  test('筛选 chip 的 40px 触控基线不可依赖 Tailwind 工具类（会被未分层 button 规则压过）', () => {
    assert.ok(/button\.chip-tap \{[^}]*min-height: 2\.5rem/.test(touchBlock),
      'chip-tap 必须写在未分层的触屏块里：实测 min-h-10 在 button 上计算值为 0');
    const table = readFileSync('src/pages/PeriodicTable.tsx', 'utf8');
    const marked = (table.match(/className=(?:\{)?[`"]chip-tap/g) || []).length;
    assert.ok(marked >= 5, `周期表搜索/发音/筛选 chip 需标满 chip-tap（实际 ${marked}）`);
  });

  test('微型图标靠透明伪元素扩热区，图标本身不放大', () => {
    assert.ok(/\.tap-icon::after \{[\s\S]*?inset: -8px/.test(touchBlock), '图标热区必须外扩（视觉 14px → 热区 30px）');
    assert.ok(touchBlock.includes("content: ''"), '伪元素需要 content 才会生成，否则热区不存在');
  });

  test('标记类覆盖到位：漏标即静默失效', () => {
    const primary = (panelSrc.match(/className="tap-primary/g) || []).length;
    const icon = (panelSrc.match(/className="tap-icon/g) || []).length;
    assert.ok(primary >= 8, `tap-primary 应覆盖底部主操作（实际 ${primary}）`);
    assert.equal(icon, 2, `tap-icon 只应标记密钥眼睛与模型下拉箭头这两个孤立图标（实际 ${icon}）——顶部并排图标外扩会互相抢点击`);
  });
});


/* ── 版本一致性：避免发布时三方（构建产物 / 常量 / 变更记录）不同步 ── */

describe('版本一致性（package.json ↔ APP_VERSION ↔ 变更记录首条）', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

  test('APP_VERSION 与 package.json 的 version 完全一致', () => {
    assert.equal(
      APP_VERSION,
      pkg.version,
      'APP_VERSION 与 package.json 不一致：构建产物里的版本号来自 package.json，界面显示的来自 APP_VERSION',
    );
  });

  test('变更记录首条即当前版本，且版本号不重复', () => {
    assert.equal(CHANGELOG[0].version, APP_VERSION, '新版本记录在前：首条必须是当前版本');
    const seen = new Set<string>();
    for (const e of CHANGELOG) {
      assert.ok(!seen.has(e.version), `变更记录出现重复版本号：${e.version}`);
      seen.add(e.version);
    }
  });

  test('每条变更记录中英条目数一致且非空（中英双语必须同步维护）', () => {
    for (const e of CHANGELOG) {
      assert.ok(/^\d+\.\d+\.\d+$/.test(e.version), `版本号格式应为 x.y.z：${e.version}`);
      assert.ok(e.date && e.date.length > 0, `${e.version} 缺少日期`);
      assert.ok(e.zh.length > 0 && e.en.length > 0, `${e.version} 的中英条目都不能为空`);
      assert.equal(e.zh.length, e.en.length, `${e.version} 中英条目数不一致（zh ${e.zh.length} / en ${e.en.length}）`);
    }
  });
});


/* ── 错题卷组卷（纯函数）：分节 / 连续编号 / 答案形态 / 留白 ── */

describe('错题卷组卷（buildQuizPaper）', () => {
  const E = (over: Partial<QuizHistoryEntry>): QuizHistoryEntry => ({
    id: 'x', ts: 1000, path: '/lab/ohm', subject: '物理', topic: '欧姆定律',
    question: '题干', options: ['甲', '乙', '丙', '丁'], answerIdx: 1, pickedIdx: 2,
    correct: false, model: 'm', ...over,
  });

  test('选项排布：含公式一律单列，短文本选项才两列', () => {
    assert.equal(canUseTwoColumnOptions('choice', ['甲', '乙', '丙']), true, '短文本选择题可两列省纸');
    assert.equal(canUseTwoColumnOptions('choice', ['甲', '乙']), false, '不足 3 项不分组');
    assert.equal(canUseTwoColumnOptions('fill', ['甲', '乙', '丙']), false, '非选择题不分组');
    assert.equal(
      canUseTwoColumnOptions('choice', ['$y=ax^{2}+bx+c$', '乙', '丙']),
      false,
      '含 LaTeX 一律单列：公式宽度由 KaTeX 渲染后决定，两列会横向挤压甚至越界',
    );
    assert.equal(
      canUseTwoColumnOptions('choice', ['甲', '乙', '丙', '这是一段明显偏长的选项文本']),
      false,
      '偏长选项退回单列',
    );
  });

  test('选择题：正确答案为选项字母、错答为学生所选字母', () => {
    const paper = buildQuizPaper([E({ answerIdx: 1, pickedIdx: 3 })]);
    assert.equal(paper.sections[0].items[0].correctText, 'B');
    assert.equal(paper.sections[0].items[0].wrongText, 'D');
  });

  test('填空题：多家答案顺序连接，错答为原文；超时不展示错答', () => {
    assert.equal(correctTextOf(E({ type: 'fill', fillAnswers: ['0.6A', '0.60A'] })), '0.6A / 0.60A');
    assert.equal(wrongTextOf(E({ type: 'fill', userAnswer: '0.5A' })), '0.5A');
    assert.equal(wrongTextOf(E({ type: 'fill', userAnswer: '0.5A', timedOut: true })), '', '超时未答不得展示错答');
    assert.equal(wrongTextOf(E({ type: 'fill', userAnswer: '' })), '');
  });

  test('无标准答案（answerIdx=-1 或缺失）不产出正确答案文本', () => {
    assert.equal(correctTextOf(E({ answerIdx: -1 })), '');
    assert.equal(correctTextOf(E({ answerIdx: undefined as unknown as number })), '');
    assert.equal(optionLabel(4), 'E', '标签表覆盖 A–F，下标 4 是合法项');
    assert.equal(optionLabel(6), '', '下标 6 已越出标签表，不得产出标签');
    assert.equal(optionLabel(-1), '');
  });

  test('按知识点分组：同组归并，组间按错题数降序（薄弱点优先）', () => {
    const paper = buildQuizPaper([
      E({ topic: '欧姆定律' }), E({ topic: '欧姆定律' }), E({ topic: '欧姆定律' }),
      E({ topic: '凸透镜成像' }), E({ topic: '凸透镜成像' }),
      E({ topic: '质量守恒' }),
    ]);
    assert.deepEqual(paper.sections.map((s) => s.topic), ['欧姆定律', '凸透镜成像', '质量守恒']);
    assert.deepEqual(paper.sections.map((s) => s.items.length), [3, 2, 1]);
  });

  test('题号跨分节连续，且与分节展平顺序一致', () => {
    const paper = buildQuizPaper([E({ topic: 'B' }), E({ topic: 'A' }), E({ topic: 'A' })]);
    const flat = paper.sections.flatMap((s) => s.items);
    assert.deepEqual(flat.map((i) => i.no), [1, 2, 3]);
    assert.equal(paper.total, 3);
    assert.equal(flat.length, paper.total);
  });

  test('time 模式：只有单节且不设小节标题', () => {
    const paper = buildQuizPaper([E({ topic: 'A' }), E({ topic: 'B' })], { sortMode: 'time' });
    assert.equal(paper.sections.length, 1);
    assert.equal(paper.sections[0].topic, '');
    assert.deepEqual(paper.sections[0].items.map((i) => i.no), [1, 2]);
  });

  test('演算留白档位：compact 0 / standard 20 / roomy 35（每道题都带）', () => {
    for (const [lv, mm] of Object.entries(BLANK_MM)) {
      const paper = buildQuizPaper([E({}), E({})], { blankLevel: lv as PaperBlankLevel });
      assert.equal(paper.blankMm, mm, `${lv} 应为 ${mm}mm`);
      assert.ok(paper.sections[0].items.every((i) => i.blankMm === mm));
    }
    assert.equal(buildQuizPaper([E({})]).blankMm, 20, '默认应为标准 20mm');
  });

  test('答案开关：关闭时答案集为空，开启时与正文同序同数', () => {
    const off = buildQuizPaper([E({}), E({ topic: '另一个' })]);
    assert.deepEqual(off.answers, [], '默认不出答案');
    assert.equal(off.includeAnswers, false);
    const on = buildQuizPaper([E({}), E({ topic: '另一个' })], { includeAnswers: true });
    assert.equal(on.answers.length, on.total);
    assert.deepEqual(on.answers.map((i) => i.no), on.sections.flatMap((s) => s.items).map((i) => i.no));
  });

  test('空记录与空题干：不抛错且 total 为 0', () => {
    for (const input of [[], [E({ question: '' })], [E({ question: '   ' })]]) {
      const paper = buildQuizPaper(input);
      assert.equal(paper.total, 0);
      assert.deepEqual(paper.sections, []);
      assert.equal(paper.estimatedMinutes, 0);
    }
  });

  test('建议限时：优先真实限时，否则按题型默认，向上取整到 5 分钟', () => {
    assert.equal(estimateSeconds(E({})), 60, '选择题默认 60s');
    assert.equal(estimateSeconds(E({ type: 'fill' })), 90, '填空默认 90s');
    assert.equal(estimateSeconds(E({ timeLimit: 150 })), 150, '有真实限时则优先');
    // 3 题各 60s = 180s = 3min → 向上取整到 5
    assert.equal(buildQuizPaper([E({}), E({}), E({})]).estimatedMinutes, 5);
    // 5 题各 60s = 300s = 5min → 恰好 5
    assert.equal(buildQuizPaper([E({}), E({}), E({}), E({}), E({})]).estimatedMinutes, 5);
  });

  test('知识点归一化：剥除括号提示，空值兜底「综合」', () => {
    assert.equal(normalizeTopic('欧姆定律（8-9 年级）'), '欧姆定律');
    assert.equal(normalizeTopic('凸透镜成像(实验)'), '凸透镜成像');
    assert.equal(normalizeTopic(''), '综合');
    assert.equal(normalizeTopic('   '), '综合');
    // 分节也走同一归一化，避免同一知识点被拆成两节
    const paper = buildQuizPaper([E({ topic: '欧姆定律' }), E({ topic: '欧姆定律（8-9 年级）' })]);
    assert.equal(paper.sections.length, 1);
    assert.equal(paper.sections[0].items.length, 2);
  });

  test('溯源：sourceOf 解析器为每题补上实验名', () => {
    const paper = buildQuizPaper(
      [E({ path: '/lab/ohm' }), E({ path: '/lab/unknown' })],
      {},
      (path) => (path === '/lab/ohm' ? '欧姆定律实验' : ''),
    );
    const flat = paper.sections.flatMap((s) => s.items);
    assert.equal(flat[0].source, '欧姆定律实验');
    assert.equal(flat[1].source, '');
  });
});

/* ── Summary ── */

void runAsyncTests().then(() => {
  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
});

describe('触屏热区 · 反向对抗守护（v0.35.0）', () => {
  const css = readFileSync('src/index.css', 'utf8');
  const touchBlock = css.slice(css.indexOf('@media (hover: none) and (pointer: coarse)'));

  test('tap-icon 必须有自身定位上下文：::after 是 absolute，锚点若为 static 会逃逸到视口劫持全页点击', () => {
    assert.match(touchBlock, /\.tap-icon:not\(\[class\*='absolute'\]\)\s*\{\s*position:\s*relative/);
    assert.match(touchBlock, /\.tap-icon::after\s*\{[^}]*position:\s*absolute/);
  });

  test('tap-area 必须居中内容：min-height 撑高的盒子多出的空间全加在下方，<a> 没有 UA 居中会被顶到上方', () => {
    assert.match(touchBlock, /\.tap-area\s*\{[^}]*display:\s*inline-flex/);
    assert.match(touchBlock, /\.tap-area\s*\{[^}]*align-items:\s*center/);
    assert.match(touchBlock, /\.tap-area\s*\{[^}]*min-height:\s*2\.5rem/);
  });

  test('页脚独立图标：允许 tap-icon 扩区，但间距与视觉尺寸必须同时守住', () => {
    const footer = readFileSync('src/components/layout/Footer.tsx', 'utf8');
    if (!footer.includes('tap-icon')) return; // 未扩区时无需约束
    // 历史事故：页脚图标彼此仅隔几像素，+8px 外扩后热区互压，出现「点邮箱触发作品集」。
    // 现在改为「先把间距拉开、再扩区」：间距被改小时本测试立刻失败。
    assert.ok(/flex items-center gap-5/.test(footer), '作者行图标需保留 gap-5：26px 盒 + 20px 间隙 = 中心距 46px ≥ 44px');
    assert.ok(/gap-x-5/.test(footer) && /gap-y-4/.test(footer), '底部图标行需保留 gap-x-5 / gap-y-4：横向中心距容得下两侧各 8px 扩区，换行后纵向也不撞');
    const p15 = (footer.match(/p-1\.5(?! -m)/g) || []).length;
    assert.ok(p15 >= 4, `扩区图标需用 p-1.5 把 14px 视觉盒撑到 26px 命中盒，实际 ${p15} 处`);
    assert.ok(!footer.includes('-m-1\.5'), '扩区图标不得再用 -m-1.5：负外边距会吃掉 flex 间距 12px，中心距掉到 34px 后 42px 扩区必然互压');
    assert.ok(/<Share2 className="w-3\.5 h-3\.5"/.test(footer) && /<Network className="w-3\.5 h-3\.5"/.test(footer),
      '扩区只能靠伪元素：图标本身不得放大（视觉仍 14px）');
  });

  test('顶栏安全区不得清零上内边距：须为 calc 叠加（页脚同款写法）', () => {
    const header = readFileSync('src/components/layout/Header.tsx', 'utf8');
    assert.ok(!/pt-\[env\(safe-area-inset-top/.test(header), 'pt-[env(...)] 会覆盖 py 的上内边距，造成上下不对称');
    assert.match(header, /pt-\[calc\([^)]*env\(safe-area-inset-top/);
  });

  test('顶栏「使用说明」媒体图标：须与文字同属一个链接，且右组只有一个 /guide 入口', () => {
    const header = readFileSync('src/components/layout/Header.tsx', 'utf8');
    assert.match(header, /import \{[^}]*\bCirclePlay\b[^}]*\} from 'lucide-react'/, '须从 lucide-react 引入 CirclePlay');
    const entries = (header.match(/to="\/guide"/g) || []).length;
    assert.equal(entries, 1, `顶栏只能有一个 /guide 入口（实际 ${entries}）——相邻双目标既新增可聚焦元素，也会在 360px 上把右组挤爆`);
    const link = header.match(/<Link\s+to="\/guide"[\s\S]*?<\/Link>/)?.[0] ?? '';
    assert.ok(link.includes('title={t.guideHint}'), '须给出桌面悬停提示，说明此处含演示视频');
    assert.ok(link.includes('<CirclePlay'), '图标必须放在同一个 <Link> 内：独立按钮会破坏 44px 中心距并抢点击');
    assert.ok(link.includes('aria-hidden="true"'), '图标是装饰，文字已表意，须 aria-hidden 以免读屏重复播报');
    assert.match(link, /w-3\.5 h-3\.5/, '图标视觉尺寸须 14px，与同组 AI / 主题图标同级');
    assert.match(link, /motion-safe:group-hover\/guide:scale-\[1\.06\]/, '微缩放须包在 motion-safe 内，尊重 prefers-reduced-motion');
    assert.match(link, /gap-1\.5/, '图标与文字间距须显式给出：右组小屏 gap 只有 6px，靠容器间距会粘在一起');
    const i18n = readFileSync('src/lib/i18n.ts', 'utf8');
    assert.equal((i18n.match(/guideHint:/g) || []).length, 2, 'guideHint 必须中英各一条，否则切到英文会露出 undefined');
  });
});

// ---------- 离线教学包：清单映射 / 断点续下 / 文案分支 / 与 SW 路由一致性 ----------
{
  test('离线包按组写进 SW 既有缓存桶，已在本机的条目不再重复下载（断点续下）', () => {
    const manifest: PackManifest = {
      builtAt: 1,
      groups: [
        { id: 'photos', files: [{ url: '/element-images/1.jpg', bytes: 100 }, { url: '/element-images/2.jpg', bytes: 200 }] },
        { id: 'audio', files: [{ url: '/audio/1.mp3', bytes: 50 }] },
        { id: 'diagrams', files: [{ url: '/architecture-diagram-cn.jpg', bytes: 900 }] },
      ],
    };
    const cached = new Map<string, Set<string>>([
      [PHOTO_CACHE, new Set(['/element-images/1.jpg'])],
      [AUDIO_CACHE, new Set()],
      [DIAGRAM_CACHE, new Set()],
    ]);
    const tasks = planTasks(manifest, cached);
    assert.equal(tasks.length, 4);
    assert.deepEqual(tasks.map((t) => t.cache), [PHOTO_CACHE, PHOTO_CACHE, AUDIO_CACHE, DIAGRAM_CACHE]);
    assert.deepEqual(tasks.map((t) => t.cached), [true, false, false, false], '已在本机的照片必须标记为已缓存，否则每次都会重下');
    assert.equal(formatSize(1048576), '1.0 MB');
    assert.equal(formatSize(0), '0 MB');
  });

  test('离线包桶名与 vite.config.ts 的运行时路由同源，且限额放得下全量包', () => {
    const cfg = readFileSync('vite.config.ts', 'utf8');
    assert.ok(cfg.includes('cacheName: PHOTO_CACHE') && cfg.includes('cacheName: AUDIO_CACHE') && cfg.includes('cacheName: DIAGRAM_CACHE'), '桶名必须来自 offline-cache-names.ts 单一来源');
    assert.match(cfg, /maxEntries:\s*120/, '照片上限须 ≥ 全量照片数，否则 LRU 会把离线包自己淘汰');
    assert.match(cfg, /maxEntries:\s*500/, '音频上限须 ≥ 全量音频数（118 元素 × 4 种读音）');
    assert.equal(PHOTO_CACHE, 'element-photos');
    assert.equal(AUDIO_CACHE, 'element-audio');
    assert.equal(DIAGRAM_CACHE, 'architecture-assets');
  });

  test('离线包清单构建期扫盘生成并进预缓存，数量与体积不写死', () => {
    const cfg = readFileSync('vite.config.ts', 'utf8');
    assert.match(cfg, /writeOfflineManifest/, '清单须由构建期插件生成');
    assert.ok(cfg.includes("'offline-manifest.json'"), '清单须进预缓存，否则断网读不到状态');
    assert.ok(!/element-images\/105|472\s*个/.test(cfg), '数量不得硬编码');
  });

  test('离线媒体规则必须覆盖 public/ 下的每一个真实文件（下好了却打不开就是规则漏了）', () => {
    const audio = readdirSync('public/audio');
    const photos = readdirSync('public/element-images');
    const diagrams = readdirSync('public').filter((f) => f.startsWith('architecture-diagram-'));
    const missAudio = audio.filter((f) => !AUDIO_URL_PATTERN.test('/audio/' + f));
    const missPhoto = photos.filter((f) => !PHOTO_URL_PATTERN.test('/element-images/' + f));
    const missDiagram = diagrams.filter((f) => !DIAGRAM_URL_PATTERN.test('/' + f));
    assert.deepEqual(missAudio, [], '有音频文件没被 SW 路由接住：断网时下过也打不开（曾漏掉 -em 变体）');
    assert.deepEqual(missPhoto, [], '有照片文件没被 SW 路由接住');
    assert.deepEqual(missDiagram, [], '有架构图没被 SW 路由接住');
    assert.equal(audio.length, 118 * 4, '读音应为 118 元素 × 4 种变体');
    assert.ok(photos.length >= 100, '元素照片数量异常');
  });

  test('非安全上下文必须按真实原因说明，不是笼统一句「浏览器不支持」', () => {
    const lib = readFileSync('src/lib/offline-pack.ts', 'utf8');
    assert.match(lib, /window\.isSecureContext === false/, '须用 isSecureContext 区分「不是 https」与「浏览器真没有」');
    assert.ok(lib.includes("return insecure ? 'insecure' : 'unsupported'"), '须分流为 insecure / unsupported');
    const panel = readFileSync('src/components/feedback/OfflinePackPanel.tsx', 'utf8');
    assert.match(panel, /status\.reason === 'insecure' \? c\.insecure : c\.unsupported/, '面板须按原因选择文案');
    const zh = translations.zh.offlinePack as unknown as Record<string, string>;
    const en = (translations.en as unknown as typeof translations.zh).offlinePack as unknown as Record<string, string>;
    assert.ok(zh.insecure.includes('HTTPS') && en.insecure.includes('HTTPS'), '文案须点明 HTTPS 这个原因');
    assert.match(readFileSync('src/pages/PeriodicTable.tsx', 'utf8'), /packStatus\.supported \?/, '未支持时入口不得显示 0/总数');
  });

  test('离线教学包与断网提示文案：中英对称、大白话、三态齐全', () => {
    const zhPack = translations.zh.offlinePack as unknown as Record<string, string>;
    const enPack = (translations.en as unknown as typeof translations.zh).offlinePack as unknown as Record<string, string>;
    const zhAi = translations.zh.offlineAi as unknown as Record<string, string>;
    const enAi = (translations.en as unknown as typeof translations.zh).offlineAi as unknown as Record<string, string>;
    assert.equal(zhPack.entry, '离线教学包');
    assert.equal(zhPack.start, '存到本机');
    assert.ok(zhPack.readyTitle.includes('无网也能照常上课'));
    for (const key of ['entry', 'entryHint', 'title', 'sizeLabel', 'lead', 'excluded', 'start', 'cancel', 'progress', 'stop', 'resume', 'readyTitle', 'readyLead', 'clear', 'clearConfirm', 'cleared', 'unsupported', 'insecure', 'partial', 'outdated']) {
      assert.ok(zhPack[key], `zh.offlinePack.${key} 缺失`);
      assert.ok(enPack[key], `en.offlinePack.${key} 缺失`);
    }
    for (const key of ['badge', 'publicApi', 'localApi', 'sendBlocked', 'failed', 'hint']) {
      assert.ok(zhAi[key] && enAi[key], `offlineAi.${key} 中英缺一`);
    }
    // 断网两种口吻必须分开：公网版讲「本地功能照常」，局域网版讲「仍可一试」
    assert.ok(zhAi.publicApi.includes('照常可用'));
    assert.ok(zhAi.localApi.includes('仍然可以继续对话'));
    assert.ok(!zhPack.entryHint.includes('缓存'), '入口说明用大白话，不写「缓存」这类工程词');
    assert.match(readFileSync('src/components/ai/AskAiButton.tsx', 'utf8'), /disabled=\{isOffline\}/, '断网时「问 AI」须温和阻断');
    assert.match(readFileSync('src/components/ai/AiAssistant.tsx', 'utf8'), /offlineAi\.localApi/, 'AI 面板须按端点类型区分断网文案');
  });
}

// ---------- AI 出题解析：宽松选项识别与围栏清洗（依实测的恶劣输出形态建立） ----------
{
  const quizOne = (ans: string) =>
    parseQuizQuestion(`【第1题】\n【类型】单选\n【题目】下列关于电阻的说法正确的是（　）\nA. 甲\nB. 乙\nC. 丙\nD. 丁\n【答案】${ans}\n【解析】略`);

  test('选项字母识别：容忍加粗/反引号/引号/句读/括号注释与「答案：」前缀', () => {
    const forms = ['B', 'b', 'B.', '**B**', '`B`', '"B"', 'B。', 'B（正确答案）', '答案：B', 'B（解析见教材）'];
    for (const f of forms) {
      const r = quizOne(f);
      assert.equal(r.type, 'choice', `"${f}" 应识别为选择题`);
      assert.equal(r.answerIdx, 1, `"${f}" 应解析为 B（下标 1）`);
    }
    // 反例：非字母答案不得被误认成选项
    const numeric = parseQuizQuestion('【题目】通过它的电流是 ____ A\n【答案】20 欧姆\n【解析】略');
    assert.equal(numeric.type, 'fill', '数值答案不应被认成选项字母');
    assert.equal(numeric.answerIdx, -1);
  });

  test('围栏清洗：整段被 ``` / ~~~ 包裹时单选仍能正确解析（此前会被误判成填空）', () => {
    const fenced = '```\n【第1题】\n【类型】单选\n【题目】题干\nA. 甲\nB. 乙\nC. 丙\nD. 丁\n【答案】C\n【解析】略\n```';
    assert.equal(stripModelDecorations(fenced).includes('```'), false, '清洗后不应残留围栏');
    const one = parseQuizQuestion(fenced);
    assert.equal(one.type, 'choice');
    assert.equal(one.answerIdx, 2);
    const batch = parseQuizBatch('~~~json\n【第1题】\n【类型】单选\n【题目】题干\nA. 甲\nB. 乙\nC. 丙\nD. 丁\n【答案】D\n【解析】略\n~~~', 1);
    assert.equal(batch.length, 1);
    assert.equal(batch[0].answerIdx, 3);
  });

  test('动态问题：读数独立成槽（<当前读数> / <current_reading>）', () => {
    const zh = getDynamicQuestions('ohm', { u: 6, i: 0.48, element: 'bulb' }, 'zh', '静态')[0];
    assert.ok(zh.includes('<当前读数>') && zh.includes('</当前读数>'), '读数应独立于提问成槽');
    assert.ok(zh.includes('6.00V') && zh.includes('0.48A'), '读数本身仍要保留');
    const en = getDynamicQuestions('lens', { u: 25, f: 10, v: 16.67 }, 'en', 'static')[0];
    assert.ok(en.includes('<current_reading>') && en.includes('</current_reading>'));
  });

  test('提示词红线：超纲方法与配置回显两条约束中英齐备，且说明读数槽位语义', () => {
    const zh = buildSystemPrompt('zh', '欧姆定律实验', '', '', true);
    const en = buildSystemPrompt('en', 'Ohm lab', '');
    assert.ok(zh.includes('方法不超纲'), '中文须禁止超纲方法');
    assert.ok(zh.includes('不回显配置'), '中文须禁止回显配置');
    assert.ok(en.includes('No out-of-syllabus methods') && en.includes('Never echo configuration'), '英文须逐条对齐');
    assert.ok(zh.includes('<当前读数>') && en.includes('<current_reading>'), '须说明读数槽位语义');
  });

  test('出题模板：序号不重复、含完整示范、物理页读法豁免', () => {
    const zh = buildQuizPrompt('zh', '欧姆定律实验', '', 3, 'basic', 0, 'choice');
    const nums = [...zh.matchAll(/^(\d+)\. /gm)].map((m) => m[1]);
    assert.equal(new Set(nums).size, nums.length, '模板序号不得重复：' + nums.join(','));
    assert.ok(zh.includes('【答案】C') && zh.includes('【解析】'), '须给出完整示范');
    assert.ok(zh.includes('若当前主题属于物理学科，则省略读法'), '物理页须豁免口语读法');
    const en = buildQuizPrompt('en', 'Ohm lab', '', 3, 'basic', 0, 'fill');
    assert.ok(en.includes('national symbol standard'), '英文须含符号规范条');
    assert.ok(en.includes('On physics topics, omit the reading'));
  });

  test('Token 估算：CJK 与西文分别计价（原 len/1.8 中文低估、英文高估）', () => {
    assert.equal(estimateTokens('汉字'), 2);
    assert.equal(estimateTokens('abcd'), 1);
    assert.equal(estimateTokens('汉字abcd'), 3);
  });

  test('考考你入口：凡挂载「问 AI」的实验与工具页必须成对挂载「考考你」', () => {
    const roots = ['src/labs', 'src/pages'];
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const q = dir + '/' + e.name;
        if (e.isDirectory()) walk(q);
        else if (/\.tsx$/.test(e.name)) files.push(q);
      }
    };
    roots.forEach(walk);
    const paired = files.filter((f) => readFileSync(f, 'utf8').includes('<AskAiButton'));
    assert.ok(paired.length >= 19, '须覆盖全部实验与工具页，当前 ' + paired.length + ' 个文件');
    for (const f of paired) {
      const src = readFileSync(f, 'utf8');
      assert.ok(/import AskQuizButton from/.test(src), f + ' 须引入 AskQuizButton');
      assert.ok(src.includes('<AskQuizButton'), f + ' 须挂载 AskQuizButton');
      const ai = (src.match(/<AskAiButton/g) || []).length;
      const quiz = (src.match(/<AskQuizButton/g) || []).length;
      assert.ok(quiz >= ai, f + ' 考考你与问 AI 须成对：' + ai + ' vs ' + quiz);
    }
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      if (/import AskAiButton from/.test(src)) assert.ok(src.includes('<AskAiButton'), f + ' 存在未使用的 AskAiButton 死导入');
      if (/import AskQuizButton from/.test(src)) assert.ok(src.includes('<AskQuizButton'), f + ' 存在未使用的 AskQuizButton 死导入');
    }
  });
}

// ---------- AI 流式交互：吸底判据 / 中断保全 / 增量计数 / 首包超时 ----------
{
  test('吸底判据：阈值边界与「内容不足一屏」都要判为贴底', () => {
    const CH = 300;
    assert.equal(isNearBottom(0, CH, CH), true, '内容不足一屏（无需滚动）必须算贴底');
    assert.equal(isNearBottom(CH * 3 - CH - STICK_THRESHOLD, CH, CH * 3), true, '距底恰好等于阈值仍算贴底');
    assert.equal(isNearBottom(CH * 3 - CH - STICK_THRESHOLD - 1, CH, CH * 3), false, '超出阈值 1px 即算离底');
    assert.equal(isNearBottom(0, CH, CH * 3), false, '滚到顶部当然不是贴底');
    assert.equal(isNearBottom(0, CH, CH * 3, 10 ** 6), true, '阈值可覆盖');
  });

  test('中断保全：空白不生成记录，非空加标记且幂等', () => {
    assert.equal(markStopped('', 'zh'), '', '空回答不该被当成一轮问答存进历史');
    assert.equal(markStopped('   \n  ', 'zh'), '', '只有空白也不该入历史');
    const zh = markStopped('串联电路电流相等', 'zh');
    assert.ok(zh.startsWith('串联电路电流相等') && zh.endsWith('[已停止]'), '中文须带 [已停止] 标记');
    assert.equal(markStopped(zh, 'zh'), zh, '重复标记必须幂等，否则重试路径会叠出两个 [已停止]');
    assert.ok(markStopped('current is equal', 'en').endsWith('[stopped]'), '英文用 [stopped]');
  });

  test('增量 token 计数与 estimateTokens(全文) 等价（去掉 O(n²) 后口径不变）', () => {
    const chunks = ['串联电路中', ' I=U/R ', '由 $I=U/R$ 得', '出电流约为', ' 0.2A。', '\n- 注意 $R_{总}$'];
    let len = 0;
    let cjk = 0;
    for (const c of chunks) { len += c.length; cjk += countCjk(c); }
    assert.equal(Math.round(cjk + (len - cjk) / 4), estimateTokens(chunks.join('')), '增量累计必须与整段估算逐值一致');
    assert.equal(countCjk('abc中文123'), 2, 'CJK 计数只数汉字与全角符号');
  });

  test('流式滚动：只用 auto 跟随、仅贴底时跟随，并提供离底解锁与恢复入口', () => {
    const ai = readFileSync('src/components/ai/AiAssistant.tsx', 'utf8');
    assert.ok(!/behavior:\s*'smooth'/.test(ai), "流式滚动不得再用 smooth：每 delta 重启平滑动画会抖，也会吃掉用户手势");
    assert.match(ai, /if \(!el \|\| !stickRef\.current\) return;/, '仅吸底状态才跟随滚动');
    assert.match(ai, /onScroll=\{/, '滚动容器须带 onScroll 才能判定用户是否离底');
    assert.match(ai, /isNearBottom\(/, '离底判定须复用 ai-scroll 的纯函数（阈值单一口径）');
    assert.match(ai, /addEventListener\('wheel'/, '需监听滚轮主动上滑并解锁吸底');
    assert.match(ai, /addEventListener\('touchmove'/, '需监听触屏上滑并解锁吸底');
    assert.match(ai, /'回到最新内容'/, '离底后须给出回到底部的入口');
  });

  test('中断保全与首包超时：停止后成果入历史与上下文，20s 首包闸，reader 收口', () => {
    const ai = readFileSync('src/components/ai/AiAssistant.tsx', 'utf8');
    assert.match(ai, /const kept = markStopped\(accText, lang\)/, '中断时须用已收正文生成可保留内容');
    assert.match(ai, /lastExchange\.current = \{ user: q, assistant: kept \}/, '中断的那一轮也要写进追问上下文，否则「继续问」接不上');
    assert.match(ai, /answer: kept,/, '中断的内容须落盘到本地历史');
    const cfg = readFileSync('src/lib/ai-config.ts', 'utf8');
    assert.match(cfg, /FIRST_PACKET_TIMEOUT_MS = 20000/, '首包超时阈值须显式为 20s');
    assert.match(cfg, /firstPacketTimedOut = true/, '超时必须真的中断请求');
    assert.match(cfg, /markFirstPacket\(\);/, '收到事件流后必须撤掉首包闸，否则长回答会被自己掐断');
    assert.match(cfg, /await reader\.cancel\(\)/, '退出路径须显式释放读取器');
    assert.match(cfg, /reader\.releaseLock\(\)/, '并释放锁，避免连接与锁悬着');
  });
}

// ---------- Guide 页视频容器与封面：防抖动 + 离线封面 ----------
/** 读 WebP 头拿真实宽高（零依赖）：RIFF/WEBP + VP8(有损) / VP8L(无损) / VP8X(扩展) */
function webpSize(buf: Buffer): { w: number; h: number } | null {
  if (buf.length < 30) return null;
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
  const fmt = buf.toString('ascii', 12, 16);
  if (fmt === 'VP8 ') return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
  if (fmt === 'VP8L') {
    const bits = buf.readUInt32LE(21);
    return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (fmt === 'VP8X') return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
  return null;
}

{
  test('Guide 视频：容器锁 16:9 + WebP 封面，彻底消除未加载时的比例回跳', () => {
    const page = readFileSync('src/pages/GuidePage.tsx', 'utf8');
    const wrap = page.match(/<div className="([^"]*aspect-video[^"]*)"/)?.[1] ?? '';
    assert.ok(wrap.includes('aspect-video'),
      '容器必须锁 16:9：否则未加载时浏览器按 UA 默认 300×150（2:1）排布，元数据到位后回跳（实测桌面 41px / 移动端 19px）');
    assert.ok(wrap.includes('overflow-hidden') && wrap.includes('rounded-lg'), '圆角需配 overflow-hidden 才能裁切封面与首帧');
    assert.ok(wrap.includes('max-w-2xl'), '保持既有版心宽度');

    const video = page.match(/<video[\s\S]*?>/)?.[0] ?? '';
    assert.ok(/poster="\/videos\/[^"]+\.webp(\?v=\d+)?"/.test(video),
      'video 必须挂 WebP 封面：没有封面时未点播的播放器是一块黑方块');
    assert.ok(/className="[^"]*h-full w-full object-cover/.test(video), '视频须铺满容器（比例由容器决定）');
    assert.ok(video.includes('controls') && video.includes('playsInline'), '保持原生控件与 iOS 内联播放，零自定义遮挡');
    assert.ok(video.includes('preload="none"'), '首屏不得预载 17.6MB 片源');

    const posterPath = video.match(/poster="(\/videos\/[^"?]+)/)?.[1] ?? '';
    assert.ok(posterPath, '未能从 poster 属性解析出封面路径');
    const file = 'public' + posterPath;
    assert.ok(existsSync(file), `封面文件不存在：${file}`);
    const size = webpSize(readFileSync(file));
    assert.ok(size, `封面须是可解析的 WebP：${file}`);
    assert.ok(Math.abs(size!.w / size!.h - 16 / 9) < 0.01, `封面须为 16:9（否则容器内会留边或裁切），实际 ${size!.w}×${size!.h}`);
    assert.ok(size!.w >= 1440, `封面宽度须 ≥1440：桌面 DPR2（2K/4K）容器需 1344 设备像素，1280 只有 95.2% 覆盖，实际 ${size!.w}`);
    assert.ok(readFileSync(file).length < 60 * 1024, '封面须 <60KB（轻量静态资源，可进预缓存）');

    const cfg = readFileSync('vite.config.ts', 'utf8');
    assert.ok(/globPatterns:[^\]]*webp/.test(cfg), 'globPatterns 须含 webp：否则封面不进预缓存，离线打开 /guide 会掉回黑块');
  });
}

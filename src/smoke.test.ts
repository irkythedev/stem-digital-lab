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
 *      carry no duplicate version);
 *  11. the chemistry labs keep their academic hard faults fixed: the titration curve
 *      may only rise, every equation is rendered by <Formula> with its condition, the
 *      balance beam tilts (damped) instead of staying level, the observations are
 *      bilingual, and the gas bubbles cycle below the liquid surface.
 *  12. the titration model stays physical (every sampled pH lies in [0,14] — a missing
 *      upper clamp once let the equivalence point diverge to 16.9 — and the jump lands
 *      exactly on the equivalence volume, inside the axis with margin), and the
 *      metal-activity experiment refuses to react until the wire has been polished,
 *      because the oxide film blocks the solution; copper keeps one semantic colour
 *      (#b8533a) in every lab that draws it.
 *  13. the four electrolysis exploration cards each drive a different action (power /
 *      volume ratio / gas tests / microscopic view) instead of all merely switching the
 *      power on, and the gas tests draw a pale blue flame plus a glowing splint; the
 *      copper-powder token is a 紫红 value whose composited contrast stays ≥3:1, and no
 *      unused metal entry survives in the activity lab.
 *  14. every chemistry lab and the balance scale render correctness marks as Lucide
 *      vector icons (no glyph characters), all four labs share one StageNav so the stage
 *      strip has one height and one look, and the quiz banks spread the correct option
 *      across positions A/B/C instead of always putting it first (a student who always
 *      picked the first option used to score full marks).
 *  15. the user-facing changelog stays presentation-grade: no emoji at all, a capped
 *      number of items for the current release, and no implementation units or technical
 *      nouns leaking into reader-facing text (those belong in docs/changelog-internal.md).
 *  16. the element detail card keeps a continuous exploration flow and a textbook-exact
 *      micro view: previous/next element navigation (disabled at #1 and #118, mirrored by
 *      the arrow keys), K/L/M/N shell badges driven by the shells array (outermost shell
 *      highlighted by default), a protons / neutrons / electrons board whose neutron count
 *      is Math.round(A) − Z, and the nuclear-charge (+Z) circle with concentric orbits —
 *      never replaced by glossy graded spheres.
 *  17. the element models keep their scope boundaries: the outer-shell loss/gain rule is
 *      emitted for main-group elements only (transition and f-block report variable
 *      valence), the electron count can never go negative (palladium's 18-electron outer
 *      shell is handled as a saturated exception), a metal never "gains" electrons, and
 *      the neutron figure is labelled an estimate; the table's right edge is never masked
 *      away and the central hero preview keeps the same column geometry as the real cells.
 *  18. the hardening batch holds: both rAF interpolators (the balance beam and the titration
 *      liquid level) start from the value actually on screen instead of the previous target,
 *      so reversing a target mid-flight cannot teleport a frame; the damped beam angle is
 *      clamped to the dial range across the whole time domain; the dial ticks sit inside the
 *      pointer's real reach; every rAF-driven lab file checks prefers-reduced-motion itself;
 *      and the chemistry question bank is cognitively balanced — option text lengths converge
 *      within 15% inside every question, and correct answers rotate evenly across A/B/C.
 *  19. the 3D nucleus is a discrete particle cluster, never a solid two-tone patch: particles
 *      fill the nucleus volume uniformly (a golden-ratio low-discrepancy sequence through cbrt,
 *      so the layout is reproducible and testable rather than random), and protons/neutrons are
 *      assigned by equal sampling across the whole index range — the Fibonacci sphere's latitude
 *      is monotonic in the index, so a naive "first Z are protons" splits the nucleus into two
 *      solid hemispheres (measured mean latitude +0.538 / -0.462 for chromium);
 *  20. the element detail card's figure area stays compact and unambiguous: the 2D/3D toggle is
 *      a single ghost button pinned to the figure's top-right corner instead of a full-width
 *      segmented control, its label always states the action ("3D model" / "Flat view") rather
 *      than a state-like word, the particle readout carries three visually distinct legend marks
 *      (dark sphere / pale sphere / ringed dot drawn from the same source as the 3D ball colours,
 *      because the theme's accent and foreground differ by only ~7% luminance), the fifth electron
 *      shell is the letter O (the mono face renders O and 0 pixel-identically — width, height and
 *      ink all match — so shell letters render in the serif face), group labels use only
 *      precomposed Roman numerals (U+2160–U+2167), and explanatory notes inside the dialog are
 *      upright, never italic;
 *  21. the detail dialog is top-anchored rather than vertically centred, so switching between the
 *      properties and story tabs cannot move the header or the tab bar (a centred box re-solves
 *      its position whenever the content height changes: measured 106 px of travel, exactly half
 *      of the 212 px height delta), with the panel's max-height tied to the overlay's own padding
 *      so the bottom edge keeps the same inset.
 *  22. the periodic table's search bar is a bare input with a leading search icon: no card wrapper,
 *      no static label (its accessible name lives on aria-label), flush with the page content edge,
 *      and exactly one category legend is visible per breakpoint (the table-area dashboard above
 *      sm, the small-screen fallback below it).
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
import { detectChem } from './lib/chem-speech';
import { clearHistory, isStoppedAnswer, listHistory, markStopped, markTruncated, saveHistory, stripStoppedMark, relativeTime, HISTORY_LIMIT } from './lib/ai-history';
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
  resolveMaxTokens, CHAIN_MAX_TOKENS, EmptyAnswerError, isLengthTruncated, classifyStreamOutcome, STALL_TIMEOUT_MS,
  type ThinkingEffort, estimateTokens, countCjk, classifyChatFailure, type AiFailureKind,
  AI_PROVIDERS, providerLabel, type AiProvider } from './lib/ai-config';
import { PROVIDER_ICON_KEY } from './components/ui/ProviderIcon';
import { shellLayout, coreRadiusFor, dotRadiusFor, ATOM_VIEW } from './lib/atom-shells';
import { ELEMENTS, type ElementInfo } from './lib/elements';
import {
  AI_POLL_BROKEN_MS, AI_POLL_HEALTHY_MS, AI_POLL_MAX_BREAK_MS, AI_STATUS_DETAIL, AI_STATUS_DOT, AI_STATUS_HOLLOW, AI_STATUS_LABEL, AI_STATUS_TTL_MS,
  aiCheckedAtLabel, aiConfigFingerprint, getAiStatus, isHollowStatus, isStatusFresh,
  nextPollDelayMs, pollAiStatus, refreshAiStatus, resetPollBackoff, verifyAiStatus,
} from './lib/ai-status';
import { APP_VERSION, CHANGELOG } from './lib/changelog';
import {
  buildQuizPaper, normalizeTopic, optionLabel, correctTextOf, wrongTextOf,
  estimateSeconds, BLANK_MM, canUseTwoColumnOptions, type PaperBlankLevel,
} from './lib/quiz-paper';
import {
  getDynamicQuestions, setLabState, getLabState, clearLabState, labIdFromPath, stageLabel, formatLabState,
} from './lib/ai-dynamic-questions';
import {
  computeQuizOverview,
  computeErrorKinds,
  buildQuizRecordsForSummary,
  classifyErrorKind,
} from './lib/quiz-summary';
import { addTokenUsage, buildDailyBars, clearTokenUsage, loadTokenUsage, pruneTokenUsage, tokenUsageTotal, CHART_MODEL_LIMIT, RETENTION_DAYS, type TokenUsageData } from './lib/token-usage';
import { OTHER_COLOR, segmentColor } from './components/ui/TokenUsageChart';
import { ATOM_RADII, radiusOf, layoutInMolecule } from './components/lab/MicroAnimation';
import { dampedAngleAt, OVERSHOOT } from './components/lab/BalanceScale';
import {
  fibonacciSphere, orbitRadius, project3, sortByDepth,
  nucleusPoints, protonFlags, visualCount, nucleonScreenSizes, nucleonAlpha,
  SHELL_TILTS, MAX_LAYERS, CAMERA_D, NUCLEON_FILL, NUCLEON_MIN_PX, NUCLEON_MAX_PX,
  NUCLEUS_MIN_PX, NUCLEUS_MAX_PX, VISUAL_COUNT_CAP, MIN_CLUSTER_FILL, NEUTRON_COLOR,
} from './lib/atom-3d';
import { phAt, sampleTitration, eqVolume, AXIS_MAX, OPTIONS as NEUT_OPTIONS, QUIZ_CORRECT as NEUT_CORRECT } from './labs/chemistry/Neutralization';
import { canReact, wireColor, OPTIONS as METAL_OPTIONS, QUIZ_CORRECT as METAL_CORRECT } from './labs/chemistry/MetalActivity';
import { CARD_FOCUS, TICK_YS, MOUTH_Y, GAS_COL_MAX, gasColumn, OPTIONS as EL_OPTIONS, QUIZ_CORRECT as EL_CORRECT } from './labs/chemistry/Electrolysis';
import { OPTIONS as MASS_OPTIONS, QUIZ_CORRECT as MASS_CORRECT } from './labs/chemistry/MassConservation';
import { splitSentences } from './pages/GuidePage';
import { neighborOf, particleCount, valenceTendency, valenceNote, groupLabel, groupDisplay, elementScope, fSeriesOf, VALENCE_LABEL, SCROLL_FADE_MASK, SHELL_NAMES, LEGEND_DOT } from './pages/PeriodicTable';
import {
  currentOf as coreCurrentOf,
  elementResistance as coreElementResistance,
  sampleOhm as coreSampleOhm,
} from './labs/physics/ohm-core';
import { currentOf, elementResistance, getEngineKind, loadOhmEngine, sampleOhm } from './labs/physics/ohm-engine';
import { imageV } from './labs/physics/lens-core';
import { OPTIONS as Q_B, QUIZ_CORRECT as C_B } from './labs/physics/Buoyancy';
import { OPTIONS as Q_L, QUIZ_CORRECT as C_L } from './labs/physics/Lever';
import { OPTIONS as Q_S, QUIZ_CORRECT as C_S } from './labs/physics/Lens';
import { OPTIONS as Q_P, QUIZ_CORRECT as C_P } from './labs/physics/Pressure';
import { OPTIONS as Q_U, QUIZ_CORRECT as C_U } from './labs/physics/Pulley';
import { OPTIONS as Q_O, QUIZ_CORRECT as C_O } from './labs/physics/Ohm';
import { CIRCUIT_STYLES } from './labs/physics/circuitStyles';
import {
  G as MECH_G,
  HOOK_WEIGHT,
  LEVER_MAX_TILT,
  STONE_WEIGHT,
  STONE_VOLUME,
  buoyantForce,
  dentAmount,
  displacedVolume,
  isLeverBalanced,
  leverTilt,
  solidPressure,
  springReading,
  torque,
} from './labs/physics/mechanics-core';
import {
  elementPower,
  elementVoltages,
  mainCurrent,
  parallelBranchCurrents,
  parallelResistance,
  seriesCurrent,
} from './labs/physics/circuits-core';
import * as MC from './labs/physics/mechanics-core';
import * as QC from './labs/math/quadratic-core';
import { CONSTANTS as PC } from './lib/constants';
import * as IC from './components/lab/InteractiveCircle';
import * as CP2 from './components/lab/CoordPlane';
import * as BENCH from './components/lab/LensBench';
import * as CP from './components/lab/circuit/CircuitParts';
import { RHEO_ROD_DY as TOPO_RHEO_ROD_DY, genTopology as TOPO_GEN, RIGHT_X as TOPO_RIGHT_X } from './labs/physics/circuitStyles';
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

/* ── Chemistry labs: 学科硬伤防退化 ── */

describe('Chemistry labs: academic hard-fault regressions', () => {
  // 先剥注释再断言：本项目已有两次被注释内示例文本误伤的经历
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
  const lab = (f: string) => strip(readFileSync(`src/labs/chemistry/${f}`, 'utf8'));
  const neutralization = lab('Neutralization.tsx');
  const electrolysis = lab('Electrolysis.tsx');
  const mass = lab('MassConservation.tsx');
  const balance = strip(readFileSync('src/components/lab/BalanceScale.tsx', 'utf8'));
  const metal = strip(readFileSync('src/labs/chemistry/MetalActivity.tsx', 'utf8'));
  const stageNav = strip(readFileSync('src/components/lab/StageNav.tsx', 'utf8'));
  // 文件里 LaTeX 的反斜杠在字符串字面量中是双写；断言前归一为单写，避免数不清反斜杠
  const tex = (s: string) => s.replace(/\\\\/g, '\\');

  test('滴定曲线方向：pH 单调上升，只允许「陡升」，禁止「陡降」', () => {
    assert.doesNotMatch(
      neutralization, /陡降|平缓下降|sharp drop/,
      '向酸中滴加碱时 pH 单调上升；出现「陡降/平缓下降」即为学科方向性错误',
    );
    assert.match(neutralization, /陡升/, '中文须写明陡升段');
    assert.match(neutralization, /平缓上升/, '反馈文案须写明「中和前平缓上升」');
    assert.match(neutralization, /sharp rise/, '英文须为 sharp rise');
  });

  test('电解水方程式：必须带「通电」条件且由 Formula（KaTeX）渲染', () => {
    const t = tex(electrolysis);
    assert.match(t, /<Formula tex=\{c\.eqWater\}/, '方程式须由 Formula 渲染，不得手写箭头');
    assert.match(t, /\\text\{通电\}/, '中文方程式必须含通电条件');
    assert.match(t, /\\text\{electric current\}/, '英文方程式必须含电流条件');
    assert.doesNotMatch(t, /→\(通电\)/, '不得再用手写箭头加括号条件');
  });

  test('质量守恒方案一方程式：须配平、含参与反应的 O₂ 与加热条件', () => {
    const t = tex(mass);
    assert.match(t, /<Formula tex=\{c\.eqCuO\}/, '方案一方程式须由 Formula 渲染');
    assert.match(t, /2\\mathrm\{Cu\}/, '须以 2Cu 起始（配平）');
    assert.match(t, /\\mathrm\{O_2\}/, '必须写出参与反应的 O₂');
    assert.match(t, /xrightarrow/, '反应条件须写在箭头上方');
    assert.doesNotMatch(t, /Cu → CuO/, '不得再有漏 O₂ / 未配平的 Cu → CuO');
  });

  test('结论幕微观动画：必须对应当前实验（铜氧化），且两侧原子守恒', () => {
    assert.doesNotMatch(mass, /label: 'H₂'/, '不得再沿用氢气燃烧的反应物');
    assert.doesNotMatch(mass, /label: 'H₂O'/, '不得再沿用氢气燃烧的生成物');
    assert.match(mass, /label: 'CuO'/, '生成物须为 CuO');
    const idx = mass.indexOf('<MicroAnimation');
    assert.ok(idx >= 0, '结论幕须有微观动画');
    const micro = mass.slice(idx, idx + 1600);
    const ids = (block: string) => (block.match(/id: '\w+'/g) ?? []).map((s) => s.slice(5, -1));
    const [reactPart, prodPart] = micro.split('products=');
    assert.ok(prodPart, '微观动画须声明生成物');
    assert.deepEqual(
      [...ids(prodPart)].sort(), [...ids(reactPart)].sort(),
      '微观动画两侧原子 id 必须一一对应（质量守恒的微观本质）',
    );
  });

  test('天平横梁不得恒为水平：倾角由质量差驱动，且带阻尼过渡与分度盘', () => {
    assert.doesNotMatch(balance, /beamAngle\s*=\s*0/, '不得再有「简化：水平」的常量横梁');
    assert.match(balance, /rotate\(\$\{angle\}/, '横梁与指针须按角度旋转');
    assert.match(balance, /useDampedAngle/, '须有阻尼振荡过渡（非瞬时硬切）');
    assert.match(balance, /tiltDeg\(/, '倾角须由质量差函数求得');
    // 分度盘刻度：5 条，且最外刻度必须落在指针真实可达域内（±7px ↔ 38×sin10° ≈ 6.6px）
    const dial = balance.match(/\[(-?\d+(?:\.\d+)?(?:\s*,\s*-?\d+(?:\.\d+)?)+)\]\.map/);
    assert.ok(dial, '指针下方须有分度盘刻度线');
    assert.ok(dial[1].split(',').length === 5, `分度盘刻度须为 5 条：实测 [${dial[1]}]`);
    assert.match(balance, /prefers-reduced-motion/, 'rAF 须自行处理减动效偏好（全局 CSS 兜底管不到）');
  });

  test('反应现象文案：中英各一套，英文侧不得泄漏中文', () => {
    assert.doesNotMatch(mass, /REACTED_DESCS/, 'REACTED_DESCS 硬编码中文已移除');
    assert.match(mass, /\{c\.reactionLines\[activeScheme\]\[0\]\}/, '渲染须取自 copy 字典');
    const zhBlock = mass.slice(mass.indexOf('  zh: {'), mass.indexOf('  en: {'));
    const enBlock = mass.slice(mass.indexOf('  en: {'));
    const pick = (b: string) => {
      const i = b.indexOf('reactionLines');
      return i < 0 ? '' : b.slice(i, i + 420);
    };
    assert.match(pick(zhBlock), /[\u4e00-\u9fff]/, '中文 reactionLines 须为中文');
    assert.ok(pick(enBlock), '英文 copy 须有 reactionLines');
    assert.doesNotMatch(pick(enBlock), /[\u4e00-\u9fff]/, '英文 reactionLines 不得含中文字符');
  });

  test('电解水气泡：必须动态推进且受液面截断，不得进入气室', () => {
    assert.doesNotMatch(electrolysis, /cy="8[0-9]"/, '不得再有固定坐标的静止气泡');
    assert.match(electrolysis, /bubbles\.map/, '气泡须由状态数组驱动');
    assert.match(electrolysis, /requestAnimationFrame/, '气泡须逐帧推进');
    assert.match(electrolysis, /surface \+ 1/, '须有液面截断约束');
    assert.match(electrolysis, /BUBBLE_ACC/, '须体现浮力加速');
  });

  test('锥形瓶几何：下宽上窄且具竖直直颈（禁倒锥形）', () => {
    const m = mass.match(/aria-label="锥形瓶加热铜粉"[\s\S]*?<path d="([^"]+)"/);
    assert.ok(m, '须能找到锥形瓶轮廓 path');
    // 解析 M/V/L/H 绝对坐标命令，重建轮廓折点
    const pts: { x: number; y: number }[] = [];
    let x = 0;
    let y = 0;
    for (const tok of m[1].match(/[MVLHZ][^MVLHZ]*/g) ?? []) {
      const n = (tok.slice(1).match(/-?[\d.]+/g) ?? []).map(Number);
      if (tok[0] === 'M' || tok[0] === 'L') {
        x = n[0];
        y = n[1];
        pts.push({ x, y });
      } else if (tok[0] === 'V') {
        y = n[0];
        pts.push({ x, y });
      } else if (tok[0] === 'H') {
        x = n[0];
        pts.push({ x, y });
      }
    }
    assert.ok(pts.length >= 4, `锥形瓶轮廓折点不足：${pts.length}`);
    const ys = pts.map((p) => p.y);
    const widthAt = (yy: number) => {
      const xs = pts.filter((p) => Math.abs(p.y - yy) < 0.01).map((p) => p.x);
      return xs.length < 2 ? 0 : Math.max(...xs) - Math.min(...xs);
    };
    const wTop = widthAt(Math.min(...ys));
    const wBot = widthAt(Math.max(...ys));
    assert.ok(wTop > 4, `须能在瓶口高度取到两条边（实测宽度 ${wTop}）`);
    assert.ok(
      wBot > wTop * 1.5,
      `锥形瓶须下宽上窄：实测底宽 ${wBot} / 颈宽 ${wTop}（禁上宽下窄的倒锥形）`,
    );
    assert.match(m[1], /V-?[\d.]/, '须含竖直直颈段（V 命令），不得用斜线直接把瓶口封死');
  });

  test('方案一锥形瓶：须有底部细沙层与「细沙」标示', () => {
    assert.match(mass, /M86 126 V118 H154 V126 Z/, '须有铺在瓶底的细沙层');
    assert.match(mass, /\[92, 100, 108, 116, 124, 132, 140, 148\]\.map/, '须有沙纹点阵');
    assert.match(mass, /\{c\.sandLabel\}/, '须有细沙标示文字');
    const zh = mass.slice(mass.indexOf('  zh: {'), mass.indexOf('  en: {'));
    assert.match(zh, /细沙/, '中文文案须出现「细沙」');
    assert.match(zh, /炸裂/, '须写明细沙的作用（防止锥形瓶炸裂）');
  });

  test('胶头滴管：尖嘴须悬空于烧杯口上方（不得伸入容器内）', () => {
    const rim = neutralization.match(/<path d="M40 (\d+) H180 V170 H40 Z"/);
    assert.ok(rim, '须能找到烧杯轮廓 path');
    const rimY = Number(rim[1]);
    const tip = neutralization.match(/M108 (-?[\d.]+) L112 -?[\d.]+ L110 (-?[\d.]+) Z/);
    assert.ok(tip, '须能找到滴管尖嘴三角形');
    const tipY = Number(tip[2]);
    assert.ok(
      rimY - tipY >= 4,
      `尖嘴须悬空于烧杯口上方 ≥4px（规范：垂直悬空、不得伸入容器内），`
        + `实测 ${rimY - tipY}px（尖嘴 y=${tipY}、杯口 y=${rimY}）`,
    );
    // 上抬后管身下端必须与尖嘴顶端相接，避免仪器断裂
    const stem = neutralization.match(/x1="110" y1="(-?[\d.]+)" x2="110" y2="(-?[\d.]+)"/);
    assert.ok(stem, '须能找到滴管管身');
    assert.ok(Number(stem[1]) < Number(stem[2]), `管身须自上而下：实测 y1=${stem[1]} y2=${stem[2]}`);
    assert.equal(
      Number(stem[2]), Number(tip[1]),
      `管身下端(y=${stem[2]}) 须与尖嘴顶端(y=${tip[1]}) 相接`,
    );
  });

  test('金属丝几何恒定：y2 不得随反应进度拉伸', () => {
    const wire = metal.match(/<line x1="150" y1="(\d+)" x2="150" y2="(\d+)" stroke=\{wireColor\(/);
    assert.ok(wire, '须能找到金属丝 line（显色由 wireColor(react, polished) 决定）');
    assert.ok(Number(wire[2]) > Number(wire[1]), `金属丝须自上而下：y1=${wire[1]} y2=${wire[2]}`);
    // 旧实现 y2={done ? 148 : 100}：反应后金属丝被拉长 83%
    assert.doesNotMatch(metal, /y2=\{done/, '金属丝 y2 不得依赖反应状态（禁物理形变）');
    const wireY1 = Number(wire[1]);
    const wireY2 = Number(wire[2]);

    // 析出物以「表面涂层」表达，而不是改变金属丝几何
    const coat = metal.match(/<line x1="150" y1="(\d+)" x2="150" y2="(\d+)" stroke=\{depositColor\}/);
    assert.ok(coat, '须有覆盖在金属丝表面的析出物涂层 line');
    assert.ok(Number(coat[1]) >= wireY1 && Number(coat[2]) <= wireY2, `析出物涂层须落在金属丝范围内`);
    assert.match(metal, /\[76, 82, 88, 94\]\.map/, '须有析出物颗粒纹理');
    assert.match(metal, /done && depositVisible/, '析出物须随反应进度渐显');
  });

  test('析出铜色值：须为紫红系，不得用亮橙 #e08a3c', () => {
    assert.match(metal, /const depositColor = isAlCu \? '#b8533a'/, '析出铜须为紫红色 #b8533a');
    const decl = metal.match(/const depositColor[^\n]*/);
    assert.ok(decl, '须能读到 depositColor 定义');
    assert.doesNotMatch(decl[0], /#e08a3c/, '析出铜不得再用亮橙 #e08a3c');
  });

  test('溶液颜色措辞：不得绝对化断言「变无色」', () => {
    assert.doesNotMatch(metal, /由蓝色变无色/, '不得出现绝对化断言「由蓝色变无色」');
    assert.doesNotMatch(metal, /turns colorless(?! )/, '英文不得出现绝对的 turns colorless');
    assert.match(metal, /完全反应后近无色/, '中文须用规范表述「完全反应后近无色」');
    assert.match(metal, /nearly colorless upon completion/, '英文须用规范表述 nearly colorless upon completion');
    assert.match(metal, /蓝色变浅/, '中文须写明「蓝色变浅」');
  });

  test('砂纸打磨：未打磨不得启动置换反应，打磨后才可反应', () => {
    // ① 打磨状态与打磨动作（初始未打磨）
    assert.match(metal, /const \[polished, setPolished\] = useState\(false\)/, '须有 polished 状态，初值 false');
    assert.match(metal, /function polish\(\)/, '须有砂纸打磨动作');
    assert.match(metal, /onClick=\{polish\}/, '打磨按钮须绑定打磨动作');
    // ② 行为级：反应前置条件（未打磨时表面氧化膜阻隔溶液，反应无法发生）
    assert.equal(canReact(false), false, '未打磨时反应不得发生（表面氧化膜阻隔）');
    assert.equal(canReact(true), true, '打磨后反应应当可以发生');
    // ③ 未打磨就点反应 → 先 return（只给教学提示），不得走到 setDone
    assert.match(
      metal,
      /if \(!canReact\(polished\)\) \{ setNudge\(true\); return; \}/,
      '未打磨时点反应须先给提示并 return，不得启动反应',
    );
    // ④ 换金属丝 / 重置实验都要回到未打磨（新拿一根丝，表面仍有氧化膜）
    assert.match(metal, /setDone\(false\); setPolished\(false\); setNudge\(false\);/, '切换金属丝须重置打磨状态');
    assert.match(metal, /setPolished\(false\); setNudge\(false\);/, '重置实验须回到未打磨');
    // ⑤ 教学提示须按金属区分（铝的氧化膜致密、几乎不反应）
    assert.match(metal, /oxideWarn\[isAlCu \? 'al' : 'cu'\]/, '提示须按当前金属给出对应解释');
    assert.match(metal, /致密的氧化铝薄膜/, '铝须说明「致密的氧化铝薄膜」');
  });

  test('砂纸打磨：双语文案须含「砂纸打磨 / sandpaper」「氧化膜 / oxide」考点词', () => {
    assert.match(metal, /砂纸打磨/, '中文须含考点词「砂纸打磨」');
    assert.match(metal, /氧化膜/, '中文须含考点词「氧化膜」');
    assert.match(metal, /[Ss]andpaper/, '英文须含 sandpaper');
    assert.match(metal, /oxide film/, '英文须含 oxide film');
    // 探索卡文案须写明「先打磨再浸入」的操作顺序
    assert.match(metal, /prompt: '先用砂纸打磨/, '中文探索卡须写明「先用砂纸打磨」');
    assert.match(metal, /prompt: 'Polish the \w+ wire with sandpaper/, '英文探索卡须写明 Polish with sandpaper');
    // 考点速记须收录该中考必考点
    assert.match(metal, /实验前必须用砂纸打磨金属丝/, '考点速记须收录「实验前必须用砂纸打磨金属丝」');
  });

  test('Cu 语义色统一：#b8533a，全站化学实验不得再出现亮橙 #e08a3c', () => {
    // 行为级：三种铜表示（铜丝本色 / Cu 原子）必须同色
    assert.equal(wireColor('cu-agno3', true), '#b8533a', '铜丝打压磨后须为紫红 #b8533a');
    assert.equal(wireColor('al-cuso4', true), '#c8cdd4', '铝丝打磨后须为银白 #c8cdd4');
    assert.equal(wireColor('cu-agno3', false), '#7a4436', '铜丝未打磨须为暗哑氧化膜色');
    assert.equal(wireColor('al-cuso4', false), '#8b9299', '铝丝未打磨须为暗哑氧化膜色');
    // 未打磨（氧化膜）必须比打磨后暗——打磨 = 除去氧化膜、露金属光泽
    const lum = (h: string) => {
      const n = parseInt(h.slice(1), 16);
      return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
    };
    for (const r of ['al-cuso4', 'cu-agno3'] as const) {
      assert.ok(
        lum(wireColor(r, false)) < lum(wireColor(r, true)),
        `${r}: 未打磨（氧化膜）亮度须低于打磨后（金属光泽）`,
      );
    }
    // 源码级：跨文件铜色不得分裂
    assert.match(metal, /cu: \{ zh: '铜丝 Cu', en: 'Cu wire', color: '#b8533a'/, 'METALS.cu.color 须为 #b8533a');
    assert.doesNotMatch(metal, /#e08a3c/, 'MetalActivity 不得再含亮橙 #e08a3c');
    assert.doesNotMatch(mass, /#e08a3c/, 'MassConservation 不得再含亮橙 #e08a3c');
    assert.equal((mass.match(/fill="#b8533a"/g) || []).length, 3, '析出红铜的 3 个颗粒须为 #b8533a');
    assert.equal((mass.match(/color: '#b8533a'/g) || []).length, 4, '微观动画的 4 个 Cu 原子须统一为 #b8533a');
  });

  test('铜粉色令牌：须为紫红系，不得再保留暗金 #b8860b / #d4a017', () => {
    const css = readFileSync('src/index.css', 'utf8');
    assert.doesNotMatch(css, /#b8860b/i, '铜粉不得再用暗金 #b8860b');
    assert.doesNotMatch(css, /#d4a017/i, '铜粉不得再用亮金 #d4a017');
    assert.equal((css.match(/--cu-powder: #9e3f2b/g) || []).length, 1, '浅色主题铜粉须为 #9e3f2b');
    assert.equal(
      (css.match(/--cu-powder: #cc6242/g) || []).length, 2,
      '暗色主题铜粉须为 #cc6242（基础暗色 + 系统偏好两处）',
    );
    // 暗色不得直接沿用浅色/析出铜的 #b8533a：0.8 不透明度合成后仅 2.65:1，跌破图形元素 3:1 门槛
    assert.doesNotMatch(css, /--cu-powder: #b8533a/, '暗色铜粉不得直接用 #b8533a（合成后 2.65:1 < 3:1）');
    // 铜粉与 Cu 语义色须同族（同为紫红），不得再回到金色系
    assert.match(metal, /color: '#b8533a'/, 'Cu 语义色须为 #b8533a');

    // 实测对比度：浅色铜粉对 --card-bg 须 ≥3:1（WCAG 1.4.11 图形元素）
    const lum = (h: string) => {
      const n = parseInt(h.slice(1), 16);
      const f = (c: number) => (c <= 0.03928 ? c / 12.92 : (((c + 0.055) / 1.055) ** 2.4));
      const r = f(((n >> 16) & 255) / 255);
      const g = f(((n >> 8) & 255) / 255);
      const b = f((n & 255) / 255);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a: string, b: string) => {
      const la = lum(a);
      const lb = lum(b);
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    };
    const over = (fg: string, bg: string, alpha: number) => {
      const f = parseInt(fg.slice(1), 16);
      const b = parseInt(bg.slice(1), 16);
      const ch = (sh: number) => {
        const v = Math.round((((f >> sh) & 255) * alpha) + (((b >> sh) & 255) * (1 - alpha)));
        return v.toString(16).padStart(2, '0');
      };
      return `#${ch(16)}${ch(8)}${ch(0)}`;
    };
    // 铜粉矩形在实验中以 opacity 0.8 绘制，按合成后的实际呈现色判定
    assert.ok(ratio(over('#9e3f2b', '#ffffff', 0.8), '#ffffff') >= 3, '浅色铜粉合成后须 ≥3:1');
    assert.ok(ratio(over('#cc6242', '#1e1e1a', 0.8), '#1e1e1a') >= 3, '暗色铜粉合成后须 ≥3:1');
  });

  test('金属活动性：未被引用的 METALS.ag 死代码须清除', () => {
    assert.doesNotMatch(metal, /\bag: \{/, 'METALS.ag 无任何引用，须删除');
    assert.doesNotMatch(metal, /METALS\.ag/, 'METALS.ag 不得再被引用');
    assert.match(metal, /al: \{ zh: '铝丝 Al'/, 'METALS.al 须保留');
    assert.match(metal, /cu: \{ zh: '铜丝 Cu'/, 'METALS.cu 须保留');
  });

  test('电解水探索卡：4 张卡「试试这个」必须动作互异，禁止一律只通电', () => {
    // 行为级：动作主题表四者互异，且与顺序一致
    assert.equal(CARD_FOCUS.length, 4, '须有 4 张探索卡');
    assert.equal(new Set(CARD_FOCUS).size, 4, `4 张卡的动作主题必须互异：${CARD_FOCUS.join(', ')}`);
    assert.deepEqual(
      [...CARD_FOCUS], ['power', 'ratio', 'test', 'micro'],
      '动作主题须依次为 通电观察 / 体积比 / 检验气体 / 微观本质',
    );
    // 动作表与文案卡数必须一致（加卡漏配动作会退化成兜底的 power）
    assert.equal((electrolysis.match(/\{ title: '/g) || []).length, 8, '中英各 4 张卡');
    // 源码级：tryIt 由主题表驱动，不再是单一 setPower(true)
    assert.match(electrolysis, /const f: CardFocus = CARD_FOCUS\[i\] \?\? 'power'/, 'tryIt 须由 CARD_FOCUS 驱动');
    assert.doesNotMatch(
      electrolysis, /tryIt: \(\) => \{\s*setPower\(true\);\s*\}/,
      '禁止 tryIt 一律只 setPower(true)',
    );
    assert.match(electrolysis, /if \(f === 'ratio' \|\| f === 'test'\) setElapsed\(1\)/, '卡 2/3 须把两管气体收满');
    assert.match(electrolysis, /if \(f === 'test'\) setGasTest/, '卡 3 须触发气体检验动画');
    assert.match(electrolysis, /if \(f === 'micro'\) \{ setMicroOpen\(true\); setMicroEpoch/, '卡 4 须展开微观区域并触发滚动');
    // 卡 1：液面下降指示
    assert.match(electrolysis, /focus === 'power' && power && \(/, '卡 1 须有液面下降指示图层');
    assert.match(electrolysis, /\{c\.levelDrop\}/, '卡 1 须标出「液面下降」');
    // 卡 2：刻度提亮 + 量程括号 + 2:1 结论
    assert.match(electrolysis, /opacity=\{focus === 'ratio' \? 0\.95 : 0\.55\}/, '卡 2 须提亮管身刻度');
    assert.match(electrolysis, /focus === 'ratio' && \(/, '卡 2 须有体积比标注图层');
    assert.match(electrolysis, /\{c\.ratioTag\}/, '卡 2 须标出 2:1 结论');
    // 卡 4：锚点 + 平滑滚动
    assert.match(electrolysis, /microRef/, '须有微观区域锚点');
    assert.match(electrolysis, /scrollIntoView\(\{ behavior/, '卡 4 须滚动到微观区域');
    assert.match(electrolysis, /behavior: reduce \? 'auto' : 'smooth'/, '减动效偏好下须退化为即时滚动');
    // 探索幕的微观动画与结论幕共用同一份粒子规格（避免两处漂移）
    assert.match(electrolysis, /<MicroAnimation reactants=\{MICRO_REACTANTS\} products=\{MICRO_PRODUCTS\}/, '微观规格须单一定义复用');
  });

  test('电解水气体检验：须有淡蓝火焰与带火星木条的视觉表达', () => {
    assert.match(electrolysis, /focus === 'test' && gasTest > 0/, '须由焦点状态 + 播放序号驱动');
    assert.match(electrolysis, /key=\{`gas-test-\$\{gasTest\}`\}/, '重播须靠 key 重挂载');
    // H₂ 火焰：淡蓝为语义色，较深描边保证浅底轮廓 ≥3:1
    assert.match(electrolysis, /fill="#a8ccff" stroke="#3f6fb5"/, 'H₂ 火焰须为淡蓝且带可辨轮廓');
    assert.match(electrolysis, /\{c\.testH2\}/, '须有 H₂ 燃烧的说明');
    assert.match(electrolysis, /\{c\.testO2\}/, '须有 O₂ 复燃的说明');
    assert.match(electrolysis, /<circle cx="286" cy="31"/, '须有带火星木条的火星点');
    // 双语文案
    assert.match(electrolysis, /淡蓝色火焰/, '中文须写明「淡蓝色火焰」');
    assert.match(electrolysis, /带火星木条/, '中文须写明「带火星木条」');
    assert.match(electrolysis, /pale blue flame/, '英文须写明 pale blue flame');
    assert.match(electrolysis, /glowing splint/, '英文须写明 glowing splint');
  });

  test('图标纪律：化学实验与天平内不得出现对勾/叉号文本字符，须用 Lucide 矢量图标', () => {
    const files: [string, string][] = [
      ['Electrolysis', electrolysis],
      ['MetalActivity', metal],
      ['MassConservation', mass],
      ['Neutralization', neutralization],
      ['BalanceScale', balance],
    ];
    for (const [name, src] of files) {
      assert.doesNotMatch(src, /[✓✗]/, `${name} 不得残留对勾/叉号文本字符（须改用 Lucide 图标）`);
    }
    // 反向确认图标确实用上了（而不是「把字符删了、什么都没留」）
    for (const [name, src] of files.slice(0, 4)) {
      assert.match(src, /<Check className=\{MARK_CLS\}/, `${name} 判定标记须用 Lucide <Check />`);
      assert.match(src, /<X className=\{MARK_CLS\}/, `${name} 判定标记须用 Lucide <X />`);
      assert.match(src, /from 'lucide-react'/, `${name} 须从 lucide-react 引入图标`);
    }
    // BalanceScale 的提示在 SVG 内：图标须为内嵌 <svg>，文本另起 <text>
    assert.match(balance, /<Check x=\{118\} y=\{9\}/, 'BalanceScale 须内嵌 Lucide <Check />');
    assert.match(balance, /<X x=\{118\} y=\{9\}/, 'BalanceScale 须内嵌 Lucide <X />');
    // 共享 StageNav 也必须图标化：两实验改用它之后仍会渲染该完成标记
    assert.doesNotMatch(stageNav, /[✓✗]/, 'StageNav 不得残留对勾文本字符');
    assert.match(stageNav, /<Check className=/, 'StageNav 完成标记须用 Lucide <Check />');
  });

  test('四实验幕导航：须统一复用共享 StageNav，不得再手写胶囊条', () => {
    const labs: [string, string][] = [
      ['Electrolysis', electrolysis],
      ['MetalActivity', metal],
      ['MassConservation', mass],
      ['Neutralization', neutralization],
    ];
    for (const [name, src] of labs) {
      assert.match(
        src, /import StageNav from '\.\.\/\.\.\/components\/lab\/StageNav'/,
        `${name} 须引入共享 StageNav`,
      );
      assert.match(src, /<StageNav/, `${name} 须渲染 <StageNav>`);
      // 手写实现的指纹：min-h-[38px] 胶囊 + 自拼完成标记
      assert.doesNotMatch(src, /min-h-\[38px\]/, `${name} 不得再手写幕导航（min-h-[38px] 指纹）`);
      assert.doesNotMatch(src, /isDone && stage !== s/, `${name} 不得再自拼导航完成标记`);
    }
    // 三幕顺序与完成态契约须与共享组件一致
    assert.match(stageNav, /min-h-\[34px\]/, 'StageNav 胶囊须为 min-h-[34px]（四实验统一高度）');
    assert.match(stageNav, /labels: \{/, 'StageNav 须接收 labels');
    assert.match(stageNav, /isDone\?: \{/, 'StageNav 须支持 isDone 完成态');
  });

  test('题库选项顺序：正确项索引不得清一色为 0（防「总选第一项」蒙对）', () => {
    const banks: [string, Record<string, readonly (readonly [string, string])[]>, Record<string, string[]>][] = [
      ['Electrolysis', EL_OPTIONS, EL_CORRECT],
      ['MetalActivity', METAL_OPTIONS, METAL_CORRECT],
      ['MassConservation', MASS_OPTIONS, MASS_CORRECT],
      ['Neutralization', NEUT_OPTIONS, NEUT_CORRECT],
    ];
    const idxs: number[] = [];
    const where: string[] = [];
    for (const [name, options, correct] of banks) {
      for (const key of Object.keys(options)) {
        const opts = options[key] as readonly (readonly [string, string])[];
        const keys = correct[key];
        assert.ok(keys && keys.length > 0, `${name}.${key} 须有判题正确项`);
        const i = opts.findIndex(([v]) => keys.includes(v));
        assert.ok(i >= 0, `${name}.${key}: 正确项不在选项内（判题键与选项不匹配 → 永远判错）`);
        idxs.push(i);
        where.push(`${name}.${key}=${i}`);
      }
    }
    const hist = [0, 1, 2].map((slot) => idxs.filter((i) => i === slot).length);
    assert.ok(idxs.length >= 19, `题库总题数须 ≥19（实测 ${idxs.length}）`);
    assert.ok(idxs.some((i) => i !== 0), `不得所有题的正确项都在首位：${where.join(' ')}`);
    for (const slot of [0, 1, 2]) {
      assert.ok(
        hist[slot] >= 2,
        `正确项须在位置 ${slot} 至少出现 2 次；实测分布 ${JSON.stringify(hist)}（${where.join(' ')}）`,
      );
    }
    // 位置须按 1/3 均摊：理论占比 33.3%，故判据是「不得显著高于随机基线（约 36%）」，
    // 而非「首位必须 ≤30%」—— 后者与均摊目标自相矛盾（旧实现 19/19 = 100% 全挤首位）
    const share = (slot: number) => hist[slot] / idxs.length;
    for (const slot of [0, 1, 2]) {
      assert.ok(
        share(slot) <= 0.4,
        `位置 ${slot} 的正解占比 ${(share(slot) * 100).toFixed(1)}% 过高（须 ≤40%，随机基线约 36%）：${where.join(' ')}`,
      );
      assert.ok(
        share(slot) >= 0.25,
        `位置 ${slot} 的正解占比 ${(share(slot) * 100).toFixed(1)}% 过低（均摊目标约 33%）`,
      );
    }
  });

  test('电解水体积比（行为级）：气柱 H₂:O₂ 恒为 2:1，收满时两侧液面落在刻度线上', () => {
    // 读数与几何必须一致：20 mL : 10 mL 对应 36px : 18px
    assert.equal(GAS_COL_MAX, 36, 'H₂ 侧收满气柱须为 36px（对应 20 mL）');
    assert.equal(gasColumn(1).h2, 2 * gasColumn(1).o2, '收满时两管气柱必须恰为 2:1');
    assert.equal(gasColumn(0).h2, 0, '未通电时无气体');
    assert.equal(gasColumn(0).h2, gasColumn(0).o2, '未通电时两管液面须齐平');
    // 全过程中比值恒为 2:1（旧实现按「下降距离」建模，画出来的气柱只有 1.8:1）
    for (const e of [0.1, 0.25, 0.5, 0.75, 1]) {
      assert.equal(gasColumn(e).h2, 2 * gasColumn(e).o2, `elapsed=${e} 时气柱仍须为 2:1`);
    }
    // 收满时两侧液面必须正好落在刻度线上，否则「对照刻度读数」无从谈起
    const full = { left: MOUTH_Y + gasColumn(1).h2, right: MOUTH_Y + gasColumn(1).o2 };
    assert.ok(TICK_YS.includes(full.left), `H₂ 侧收满液面 ${full.left} 须落在刻度线上`);
    assert.ok(TICK_YS.includes(full.right), `O₂ 侧收满液面 ${full.right} 须落在刻度线上`);
    // 气体自管口起算
    assert.match(electrolysis, /const leftLevel = MOUTH_Y \+ col\.h2/, '液面须由 gasColumn 推出');
    assert.match(electrolysis, /const rightLevel = MOUTH_Y \+ col\.o2/, '液面须由 gasColumn 推出');
  });

  test('中和浓度档：最高档等当点须落在坐标轴内并留有余量', () => {
    const axis = neutralization.match(/const AXIS_MAX = (\d+)/);
    assert.ok(axis, '须有 AXIS_MAX 常量');
    const axisMax = Number(axis[1]);
    const slider = neutralization.match(/label="c \(HCl\)"[\s\S]{0,160}?max=\{([\d.]+)\}/);
    assert.ok(slider, '须能找到 c(HCl) 滑块上限');
    const cMax = Number(slider[1]);
    // 模型：V_eq = c × V0(20mL) / c(NaOH)=0.1
    const eqMax = (cMax * 20) / 0.1;
    assert.ok(
      eqMax <= axisMax * 0.9,
      `最高浓度档等当点须落在轴内并留 10% 余量（否则突跃被右边框截断）：V_eq=${eqMax}mL / 轴=${axisMax}mL`,
    );
    // 坐标轴、滴入量程、曲线采样必须同量程，否则曲线被截断或画到轴外
    assert.match(neutralization, /xMax=\{AXIS_MAX\}/, '坐标轴量程须用 AXIS_MAX');
    assert.match(neutralization, /max=\{AXIS_MAX\}/, '滴入量程须用 AXIS_MAX');
    assert.match(neutralization, /const steps = Math\.round\(AXIS_MAX \/ 0\.2\)/, '曲线采样须用 AXIS_MAX');
    assert.match(neutralization, /Math\.min\(volume, AXIS_MAX\) \/ AXIS_MAX/, '液面映射须与量程同源');
  });

  test('中和曲线（行为级）：三档 pH 全部落在 [0,14]，突跃恰好落在中和点', () => {
    for (const c of [0.05, 0.1, 0.2]) {
      const pts = sampleTitration(c);
      assert.equal(pts.length, 251, `曲线点数须为 251（c=${c} 实测 ${pts.length}）`);
      for (const [v, ph] of pts) {
        assert.ok(
          ph >= 0 && ph <= 14,
          `pH 必须落在 [0,14]：c=${c} v=${v.toFixed(1)}mL 得到 pH=${ph.toFixed(3)}`
            + `（酸性分支若只有 Math.max(0,…) 而无上界，等当点附近会发散到 16.9）`,
        );
      }
      const eq = eqVolume(c);
      let best = -1;
      let bestV = -1;
      for (let i = 1; i < pts.length; i++) {
        const d = pts[i][1] - pts[i - 1][1];
        if (d > best) {
          best = d;
          bestV = pts[i][0];
        }
      }
      assert.ok(
        Math.abs(bestV - eq) < 0.21,
        `突跃点须恰落在中和点：c=${c} 理论 V_eq=${eq}mL，实测最大跳变在 ${bestV}mL`,
      );
      assert.ok(eq <= AXIS_MAX * 0.9, `中和点须留轴内余量：V_eq=${eq}mL / 轴=${AXIS_MAX}mL`);
      assert.equal(phAt(c, eq), 7, `恰好中和时 pH 必须为 7（c=${c} 实测 ${phAt(c, eq)}）`);
    }
  });

  test('中和浓度：单位须为 mol/L，覆盖 0.05–0.20，不得用独立大写 M', () => {
    assert.match(neutralization, /v\.toFixed\(2\)\} mol\/L/, '浓度显示须为 mol/L 且保留两位小数');
    assert.match(neutralization, /\{acidM\.toFixed\(2\)\} mol\/L/, '读数须为 mol/L');
    assert.doesNotMatch(neutralization, /acidM\.toFixed\(\d\)\} M/, '不得再有裸「M」浓度单位');
    assert.match(
      neutralization, /label="c \(HCl\)"[\s\S]{0,120}?min=\{0\.05\}[\s\S]{0,60}?max=\{0\.2\}/,
      '浓度档须覆盖 0.05 – 0.20 mol/L',
    );
    // 0.05 用 toFixed(1) 会被显示成 0.1，故浓度一律两位小数
    assert.doesNotMatch(neutralization, /acidM\.toFixed\(1\)/, '浓度不得用一位小数（0.05 会被显示为 0.1）');
  });

  test('电解水读数：须带 mL 物理单位', () => {
    assert.match(electrolysis, /H₂ \{hVol\.toFixed\(0\)\} mL/, 'H₂ 读数须带 mL');
    assert.match(electrolysis, /O₂ \{oVol\.toFixed\(0\)\} mL/, 'O₂ 读数须带 mL');
  });

  test('电解水集气管：须有主副交替刻度线（两管齐备）', () => {
    assert.match(electrolysis, /TICK_YS\.map/, '须由 TICK_YS 常量驱动 8 条刻度');
    assert.equal(TICK_YS.length, 8, '两管各须 8 条刻度');
    assert.match(electrolysis, /<line x1="113" y1=\{y\} x2=\{i % 2 === 0 \? 127 : 120\}/, '左管刻度须存在');
    assert.match(electrolysis, /<line x1="257" y1=\{y\} x2=\{i % 2 === 0 \? 271 : 264\}/, '右管刻度须存在');
    assert.match(electrolysis, /strokeWidth=\{i % 2 === 0 \? 0\.8 : 0\.5\}/, '须区分主刻度与副刻度的线宽');
  });
});

/* ── MicroAnimation: 微观反应内核 ── */

describe('MicroAnimation: microscopic reaction kernel', () => {
  const src = readFileSync('src/components/lab/MicroAnimation.tsx', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/[^\n]*/g, '$1');

  test('原子视觉半径按元素区分，禁止一刀切', () => {
    assert.match(src, /ATOM_RADII/, '须有原子半径字典');
    const at = src.indexOf('ATOM_RADII');
    const dict = src.slice(at, src.indexOf('};', at));
    const rad = (k: string) => Number((dict.match(new RegExp(`\\b${k}:\\s*([\\d.]+)`)) ?? [])[1]);
    const h = rad('H');
    const o = rad('O');
    const cu = rad('Cu');
    assert.ok(h > 0 && o > 0 && cu > 0, `三种原子半径须均有定义，实测 H=${h} O=${o} Cu=${cu}`);
    assert.ok(o > h, `氧原子半径须大于氢（实测 O=${o} H=${h}）`);
    assert.ok(cu > o, `铜原子半径须明显大于氧（实测 Cu=${cu} O=${o}）`);
    assert.match(src, /radiusOf\(/, '取半径须统一走 radiusOf');
    assert.doesNotMatch(src, /r=\{12\}/, '不得再有「所有原子 r=12」的一刀切');
  });

  test('解离阶段须真实散开（位移 ≥ 20px），不得再用 +8px 假分离', () => {
    const m = src.match(/const SPREAD = (\d+)/);
    assert.ok(m, '须有解离位移常量 SPREAD');
    assert.ok(Number(m[1]) >= 20, `解离位移须 ≥20px，实测 ${m[1]}px`);
    assert.doesNotMatch(src, /a\.x \+ 8/, '不得再有「坐标 +8px」的假分离');
    assert.match(src, /SPREAD_T/, '须有解离完成的归一化时刻');
    assert.match(src, /const bx = ps\.reduce/, '解离方向须由该分子原子坐标的质心求出');
  });

  test('三阶段连续插值：任何时刻都有粒子在场（无空白帧）', () => {
    assert.match(src, /PHASE_T/, '须有「阶段 → 归一化进度」映射');
    assert.match(src, /posAt\(/, '原子坐标须由一个连续函数插值');
    assert.doesNotMatch(
      src, /phase === '(reactants|separate|recombine|products)'/,
      '不得再按 phase 门控粒子渲染（旧版「重组」阶段是空白帧）',
    );
    assert.match(src, /geo\.flat\.map/, '全部粒子须无条件渲染');
  });

  test('结合几何（行为级）：双原子相切、三原子 104.5° 且两翼不重合', () => {
    assert.ok(ATOM_RADII.H < ATOM_RADII.O && ATOM_RADII.O < ATOM_RADII.Cu, `半径序须为 H<O<Cu，实测 ${JSON.stringify(ATOM_RADII)}`);
    const A = (label: string, id: string) => ({ id, label, color: '#000000' });
    const dist = (p: { x: number; y: number }, q: { x: number; y: number }) => Math.hypot(p.x - q.x, p.y - q.y);

    // 双原子（O₂ / CuO）：两球必须相切，距离 = 半径之和
    const o2 = layoutInMolecule([A('O', 'o1'), A('O', 'o2')]);
    assert.ok(Math.abs(dist(o2[0], o2[1]) - 2 * radiusOf('O')) < 1e-9, `O₂ 两球须相切，实测 ${dist(o2[0], o2[1])}`);
    const cuo = layoutInMolecule([A('Cu', 'cu1'), A('O', 'o1')]);
    assert.ok(
      Math.abs(dist(cuo[0], cuo[1]) - (radiusOf('Cu') + radiusOf('O'))) < 1e-9,
      `Cu—O 须相切，实测 ${dist(cuo[0], cuo[1])}`,
    );

    // 三原子（H₂O）：以最大原子 O 为中心，两个 H 分居两侧，键角 = 104.5°
    const w = layoutInMolecule([A('O', 'o1'), A('H', 'h1'), A('H', 'h2')]);
    assert.ok(
      Math.abs(dist(w[1], w[0]) - (radiusOf('O') + radiusOf('H'))) < 1e-9,
      `O—H 须相切，实测 ${dist(w[1], w[0])}`,
    );
    // 旧实现用 `i < c` 判定左右侧：中心原子位于索引 0 时两翼同侧，两个 H 完全重合、键角退化为 0°
    assert.ok(dist(w[1], w[2]) > 1, `两个旁位原子不得重合，实测间距 ${dist(w[1], w[2])}`);
    const v1 = { x: w[1].x - w[0].x, y: w[1].y - w[0].y };
    const v2 = { x: w[2].x - w[0].x, y: w[2].y - w[0].y };
    const ang = (Math.acos((v1.x * v2.x + v1.y * v2.y) / (dist(v1, { x: 0, y: 0 }) * dist(v2, { x: 0, y: 0 }))) * 180) / Math.PI;
    assert.ok(Math.abs(ang - 104.5) < 0.01, `H—O—H 键角须为 104.5°，实测 ${ang.toFixed(2)}°`);
  });

  test('必须内置 prefers-reduced-motion 分支', () => {
    assert.match(src, /prefers-reduced-motion/, 'rAF 过渡须自行处理减动效偏好（CSS 兜底管不到）');
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

  // ── 化学朗读（提示词标准写法 \mathrm{}）：审计发现 60 条化合物表因缺解包分支而全程不可达 ──
  //    提示词（ai-config.ts:304/344）强制化学式写 \mathrm{}，而旧实现只认裸写法，
  //    于是 \mathrm{H_2O} 原样吐出 `H_2O` 进 TTS，且 \uparrow / \xrightarrow 也被当普通命令念出。
  test('chemistry: \mathrm{} 解包后命中化合物表', () => {
    assert.equal(latexToSpeech('\\mathrm{H_2O}'), '水');
    assert.equal(latexToSpeech('\\mathrm{CuSO_4}'), '硫酸铜');
    assert.equal(latexToSpeech('\\mathrm{Fe_3O_4}'), '四氧化三铁');
    assert.equal(latexToSpeech('\\mathrm{Ca(OH)_2}'), '氢氧化钙', '括号原子团须整体查表');
  });

  test('chemistry: 单质元素符号读中文名，不念字母', () => {
    assert.equal(latexToSpeech('\\mathrm{Na}'), '钠');
    assert.equal(latexToSpeech('\\mathrm{Fe}'), '铁');
    assert.equal(latexToSpeech('\\mathrm{Cl_2}'), '氯气');
  });

  test('chemistry: 离子读中文名（含上标电荷）', () => {
    assert.equal(latexToSpeech('\\mathrm{H^+}'), '氢离子');
    assert.equal(latexToSpeech('\\mathrm{OH^-}'), '氢氧根离子');
    assert.equal(latexToSpeech('\\mathrm{Fe^{3+}}'), '铁离子');
    assert.equal(latexToSpeech('\\mathrm{Fe^{2+}}'), '亚铁离子');
    assert.equal(latexToSpeech('\\mathrm{SO_4^{2-}}'), '硫酸根离子');
    assert.equal(latexToSpeech('\\mathrm{CO_3^{2-}}'), '碳酸根离子');
  });

  test('chemistry: 计量数读「两个水分子」而不是逐字符', () => {
    assert.equal(latexToSpeech('2\\mathrm{H_2O}'), '两个水分子');
    assert.equal(latexToSpeech('2\\mathrm{Cu}'), '两个铜原子');
    assert.equal(latexToSpeech('3\\mathrm{H_2O}'), '三个水分子');
  });

  test('chemistry: 方程式读条件、生成号与气体箭头', () => {
    const el = latexToSpeech('2\\mathrm{H_2O} \\xrightarrow{\\ \\text{通电}\\ } 2\\mathrm{H_2\\uparrow} + \\mathrm{O_2\\uparrow}');
    assert.ok(el.includes('两个水分子'), `缺计量数读法: ${el}`);
    assert.ok(el.includes('在通电条件下生成'), `缺条件读法: ${el}`);
    assert.ok(el.includes('两个氢分子'), `缺气体计量数: ${el}`);
    assert.ok(el.includes('氧气'), `缺氧气: ${el}`);
    assert.ok(!/uparrow|xrightarrow/.test(el), `不得残留 LaTeX 命令: ${el}`);
    const neut = latexToSpeech('\\mathrm{HCl} + \\mathrm{NaOH} = \\mathrm{NaCl} + \\mathrm{H_2O}');
    assert.ok(neut.includes('反应生成'), `= 须读「反应生成」: ${neut}`);
    assert.ok(neut.includes('和') && !neut.includes('加'), `反应物连接须读「和」: ${neut}`);
    const ion = latexToSpeech('\\mathrm{H^+} + \\mathrm{OH^-} \\rightarrow \\mathrm{H_2O}');
    assert.ok(ion.includes('氢离子') && ion.includes('氢氧根离子'), `离子未读出: ${ion}`);
    assert.ok(ion.includes('生成') && !ion.includes('趋向'), `→ 在化学上下文须读「生成」: ${ion}`);
  });

  test('chemistry: AI 回答里的公式（\(...\) 包裹）端到端读通', () => {
    const out = cleanTextForTTS(
      '电解水的化学方程式是 \\(2\\mathrm{H_2O} \\xrightarrow{\\ \\text{通电}\\ } 2\\mathrm{H_2\\uparrow} + \\mathrm{O_2\\uparrow}\\)，正极产生氧气、负极产生氢气。',
      'zh',
    );
    assert.ok(out.includes('在通电条件下生成'), `缺条件: ${out}`);
    assert.ok(out.includes('两个水分子') && out.includes('两个氢分子'), `缺计量数: ${out}`);
    assert.ok(!/[\\$]/.test(out.replace(/[。，、]/g, '')), `不得残留 LaTeX 定界符: ${out}`);
    const sub = cleanTextForTTS('铁与硫酸铜溶液反应：\\(\\mathrm{Fe} + \\mathrm{CuSO_4} = \\mathrm{FeSO_4} + \\mathrm{Cu}\\)。', 'zh');
    assert.ok(sub.includes('铁') && sub.includes('硫酸铜') && sub.includes('反应生成'), `置换反应读法: ${sub}`);
  });

  test('chemistry: 超长 \mathrm{} 不判为化学（嵌套量词回溯防线）', () => {
    // 长度闸门：放行超长 inner 会让判据里的嵌套量词正则出现 O(n²) 回溯
    // （实测 4000 字符 141ms、8000 字符 559ms）。真实化学式最长 ≈12 字符。
    assert.equal(detectChem('\\mathrm{H_2O}'), true, '正常化学式仍须判定为化学');
    assert.equal(detectChem('\\mathrm{' + 'A'.repeat(200) + '}'), false, '超长 inner 须直接排除');
    const t0 = Date.now();
    latexToSpeech('\\mathrm{' + 'A'.repeat(4000) + '}', 'zh');
    assert.ok(Date.now() - t0 < 100, `超长 inner 不得拖慢主线程（实测 ${Date.now() - t0}ms）`);
  });

  test('chemistry: 物理模式下化学方程式只按化学口径读（不插「乘以」）', () => {
    // 化学上下文必须优先于物理口径：否则预处理产出的中文会被物理因子逻辑当成乘积链，
    // 读成「两个水分子 乘以 生成 乘以 两个氢分子 乘以 和 乘以 氧气」。
    const out = latexToSpeech('2H_2O \\rightarrow 2H_2 \\uparrow + O_2 \\uparrow', 'zh', 'physics');
    assert.ok(!out.includes('乘以'), `化学读法不得插「乘以」: ${out}`);
    assert.ok(out.includes('两个水分子') && out.includes('生成'), `化学口径未生效: ${out}`);
    // 反向：纯物理公式在 physics 模式下行为不变
    assert.equal(latexToSpeech('\\rho=\\frac{m}{V}', 'zh', 'physics'), '密度等于质量 与 体积 之比');
  });

  test('chemistry: 判定保守——数学/物理公式一字不改', () => {
    // 元素符号形状的字母在物理里到处都是（I=U/R 的 U、I；P=UI），误判会直接把物理公式念错。
    // 这组是回归哨兵：化学预处理的守门条件一旦放松，这里会立刻红。
    assert.equal(latexToSpeech('I=\\frac{U}{R}'), 'I等于R 分之 U');
    assert.equal(latexToSpeech('P=UI'), 'P等于U I');
    assert.equal(latexToSpeech('E=mc^2'), 'E等于m c 平方');
    assert.equal(latexToSpeech('F=ma'), 'F等于m a');
    assert.equal(latexToSpeech('6\\,\\mathrm{V}'), '6，V', '单位 \\mathrm{V} 不得被当化学式');
    assert.equal(latexToSpeech('\\mathrm{kg} \\cdot m'), 'kg 乘以 m');
    assert.ok(latexToSpeech('x_1') === 'x 一' && latexToSpeech('a_{12}') === 'a 一二', '数学下标不受影响');
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

  testAsync('并发补传同一条只推一次（防止连点重复发送）', async () => {
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

    /* ── 读数与实验状态的序列化（v0.40.5 审计修复，并入本用例以守住 405）──
       这一节守三件事，都是「模型拿到就会产生认知幻觉」的硬伤：
       ① 跨学科同名字段不能串味：lens 的 u 是物距(cm)，ohm 的 u 才是电源电压(V)；
       ② TS 内部码不得透传：bulb / chord / fixed / al-cuso4 / 方案下标，一律翻成自然语言；
       ③ 实时读数必须独立成槽，且与「参考资料」的权威级分开。 */

    // ① 分域：lens 的 u/f/v 是物距/焦距/像距，单位 cm，绝不能出现「电源电压」
    const lensZh = formatLabState('lens', { stage: 'explore', u: 20, f: 10, v: 20 }, 'zh');
    assert.ok(lensZh.includes('物距 20cm'), `lens 的 u 须为物距（实测：${lensZh}）`);
    assert.ok(!lensZh.includes('电源电压'), 'lens 没有电源，绝不许可出现「电源电压」');
    assert.ok(lensZh.includes('焦距 10cm') && lensZh.includes('像距 20cm'), 'lens 的 f/v 须为焦距/像距');
    const lensEn = formatLabState('lens', { stage: 'explore', u: 20, f: 10, v: 20 }, 'en');
    assert.ok(lensEn.includes('object distance 20cm'), `lens 英文须为 object distance（实测：${lensEn}）`);
    // 分域不能误伤：ohm 的 u 仍是电源电压（V）
    assert.ok(
      formatLabState('ohm', { stage: 'explore', u: 6, i: 0.6 }, 'zh').includes('电源电压 6V'),
      'ohm 的 u 必须保留「电源电压」口径（分域不得误伤）',
    );

    // ② 枚举码翻译：翻译成界面上的说法，且原码不得出现在输出里
    const enumCases: [string, Record<string, unknown>, string, string][] = [
      ['ohm', { element: 'bulb' }, '小灯泡', 'bulb'],
      ['ohm', { element: 'resistor' }, '定值电阻', 'resistor'],
      ['circle', { circleMode: 'chord' }, '垂径定理', 'chord'],
      ['circle', { circleMode: 'inscribed' }, '圆周角定理', 'inscribed'],
      ['circle', { circleMode: 'thales' }, '直径对直角', 'thales'],
      ['pulley', { type: 'fixed' }, '定滑轮', 'fixed'],
      ['pulley', { type: 'moving' }, '动滑轮', 'moving'],
      ['mass-conservation', { activeScheme: 0 }, '铜与氧气', ''],
      ['mass-conservation', { activeScheme: 1 }, '铁与硫酸铜', ''],
      ['metal-activity', { react: 'al-cuso4' }, '铝与硫酸铜', 'al-cuso4'],
      ['metal-activity', { react: 'cu-agno3' }, '铜与硝酸银', 'cu-agno3'],
    ];
    for (const [lab, st, want, rawCode] of enumCases) {
      const out = formatLabState(lab, { stage: 'explore', ...st }, 'zh');
      assert.ok(out.includes(want), `${lab} ${JSON.stringify(st)} 须翻译为「${want}」（实测：${out}）`);
      if (rawCode) {
        assert.ok(
          !new RegExp(`\\b${rawCode}\\b`).test(out),
          `${lab} 不得把内部码「${rawCode}」原样交给模型（实测：${out}）`,
        );
      }
    }
    // 未登记的内部值：整条丢弃，绝不透传（与 clean() 的「绝不输出半句话」同一条纪律）
    const unknownEnum = formatLabState('circle', { stage: 'explore', circleMode: 'made-up-code' }, 'zh');
    assert.ok(!unknownEnum.includes('made-up-code'), '未登记的内部值须整条丢弃，不得透传');
    assert.ok(unknownEnum.includes('当前阶段：探索'), '丢弃单个字段不得影响其它字段');

    // ③ 英文语境不得漏中文取值（twin 键名曾算成 styleZhEn，取不到值）
    const circEn = formatLabState(
      'circuits',
      { stage: 'explore', styleZh: '串联三灯', styleEn: 'three bulbs in series', i0: 0.25 },
      'en',
    );
    assert.ok(circEn.includes('three bulbs in series'), `英文须取 styleEn（实测：${circEn}）`);
    assert.ok(!/[一-鿿]/.test(circEn), `英文提示词不得出现中文（实测：${circEn}）`);
    const buoyEn = formatLabState('buoyancy', { stage: 'explore', liquidZh: '盐水', liquidEn: 'brine' }, 'en');
    assert.ok(buoyEn.includes('brine') && !/[一-鿿]/.test(buoyEn), `液体英文须取 liquidEn（实测：${buoyEn}）`);

    // ④ 读数独立成槽：静态知识留在 <页面资料>，实时读数进 <当前读数>，两者权威级分开
    const live = formatLabState('ohm', { stage: 'explore', u: 6, i: 0.6, switchOn: true }, 'zh');
    const withReadings = buildSystemPrompt('zh', '欧姆定律实验', '页面知识', '探索', true, live);
    assert.ok(withReadings.includes('<当前读数>'), '实时读数须有独立标签槽 <当前读数>');
    assert.ok(withReadings.includes(live), '读数原文须原样进入 <当前读数>');
    const matStart = withReadings.indexOf('<页面资料>');
    const matEnd = withReadings.indexOf('</页面资料>');
    assert.ok(matStart >= 0 && matEnd > matStart, '<页面资料> 须成对出现');
    const materialBlock = withReadings.slice(matStart, matEnd);
    assert.ok(materialBlock.includes('页面知识'), '静态知识须留在 <页面资料>');
    assert.ok(!materialBlock.includes('当前实验实时状态'), '实时读数不得混在 <页面资料> 里（那会降成「仅供参考」）');
    assert.ok(
      withReadings.indexOf(live) > withReadings.indexOf('<当前读数>'),
      '读数块必须紧跟在 <当前读数> 标签之后',
    );
    // 英文侧同样成对，且用 current_readings
    const enRead = buildSystemPrompt('en', 'Ohm lab', 'page facts', 'explore', true, live);
    assert.ok(enRead.includes('<current_readings>'), '英文读数槽须为 <current_readings>');
    // 没有读数时不得凭空造一个空槽
    const noRead = buildSystemPrompt('zh', '欧姆定律实验', '页面知识', '探索', true);
    assert.ok(!noRead.includes('<当前读数>'), '没有实时读数时不得输出空读数槽');
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
      const res = await streamChat(
        { providerId: 'custom', apiKey: 'k', baseUrl: 'https://example.com/v1', model: 'm', agreed: true },
        [{ role: 'user', content: 'hi' }],
        (d) => contents.push(d),
        undefined,
        100,
        (r) => reasons.push(r),
      );
      assert.equal(res.text, '结论在此', '返回值只能是正文');
      assert.deepEqual(reasons, ['先想一下。'], '思考必须走 reasoning 通道');
      assert.deepEqual(contents, ['结论', '在此']);
      assert.equal(res.finishReason, null, '端点没给 finish_reason 时必须是 null，不能编一个 stop');
      assert.equal(res.usage, null, '端点没给 usage 时必须是 null');
      assert.equal(res.complete, true, '收到 [DONE] 即算正常收完');
    } finally {
      (globalThis as any).fetch = originalFetch;
    }
  });

  testAsync('streamChat：记录 finish_reason/usage，思考吃满预算时正文为空但不报错（交调用方判定）', async () => {
    const originalFetch = (globalThis as any).fetch;
    const enc = new TextEncoder();
    const sse = (obj: unknown) => `data: ${JSON.stringify(obj)}\n\n`;
    (globalThis as any).fetch = async () => {
      const stream = new ReadableStream({
        start(c) {
          c.enqueue(enc.encode(sse({ choices: [{ delta: { reasoning_content: '想很久很久' } }] })));
          c.enqueue(
            enc.encode(
              sse({
                choices: [{ delta: {}, finish_reason: 'length' }],
                usage: { prompt_tokens: 12, completion_tokens: 100, total_tokens: 112 },
              }),
            ),
          );
          c.enqueue(enc.encode('data: [DONE]\n\n'));
          c.close();
        },
      });
      return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    };
    try {
      const res = await streamChat(
        { providerId: 'custom', apiKey: 'k', baseUrl: 'https://example.com/v1', model: 'm', agreed: true },
        [{ role: 'user', content: 'hi' }],
        () => {},
      );
      assert.equal(res.text, '', '思考不算正文');
      assert.equal(res.finishReason, 'length', '「思考吃满预算」必须能被调用方看见');
      assert.ok(isLengthTruncated(res), '截断判定必须为真');
      assert.equal(res.complete, true, '端点给了 finish_reason 就算收完（length 也是收完）');
      assert.deepEqual(res.usage, { promptTokens: 12, completionTokens: 100, totalTokens: 112 }, 'usage 必须归一成数字');
      // 空正文 + length 交给分类器 → 学生看到「没输出正文，请重试」并拿到重试按钮，而不是空白框
      const empty = classifyChatFailure(new EmptyAnswerError(res.finishReason));
      assert.equal(empty.kind, 'empty');
      assert.equal(empty.retryable, true, '空正文必须可重试（重采样通常就有正文）');
      assert.equal(empty.raw, '', 'raw 不得给学生看 finish_reason=length 这类术语');
      assert.equal(classifyChatFailure(new EmptyAnswerError('stop')).kind, 'empty', '空正文与结束原因无关，一律按空正文处理');
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


/* ── 输出上限与空正文：思考型模型的思考不得把正文预算挤成空白 ── */

describe('输出上限与空正文（P0 防御：思考型模型 / 本地端点）', () => {
  test('resolveMaxTokens：用户显式上限优先，未设置才用链路默认，都没有就不下发', () => {
    assert.equal(resolveMaxTokens({ maxOutputTokens: 3000 }, 2000), 3000, '用户设置优先于链路默认');
    assert.equal(resolveMaxTokens({ maxOutputTokens: 3000 }, undefined), 3000);
    assert.equal(resolveMaxTokens({}, 2048), 2048, '未设置时用链路默认');
    assert.equal(resolveMaxTokens({}, undefined), undefined, '两者都没有 → 不下发 max_tokens');
    assert.equal(resolveMaxTokens(null, undefined), undefined);
    assert.equal(resolveMaxTokens({ maxOutputTokens: 0 }, undefined), undefined, '0 = 不限');
    assert.equal(resolveMaxTokens({ maxOutputTokens: -5 }, undefined), undefined, '负数 = 不限');
    assert.equal(resolveMaxTokens({ maxOutputTokens: Number.NaN }, 2048), 2048, '非法值回落链路默认');
    assert.equal(resolveMaxTokens({ maxOutputTokens: 3000.7 }, undefined), 3000, '上限必须是整数');
  });

  test('链路默认：对话与出题不下发上限，归纳/判分留足思考余量', () => {
    assert.equal(CHAIN_MAX_TOKENS.chat, undefined, '对话封顶正是「有思考、无正文」的成因');
    assert.equal(CHAIN_MAX_TOKENS.quiz, undefined, '出题完整性交给 ===END=== 校验 + 一次修复');
    assert.ok((CHAIN_MAX_TOKENS.summary ?? 0) >= 2048, '归纳上限不得低于 2048');
    assert.ok((CHAIN_MAX_TOKENS.judge ?? 0) >= 1024, '判分上限不得低于 1024（旧的 20 连思考的零头都不够）');
  });

  test('代码级防漂移：面板不得再给对话/出题/判分写死小上限', () => {
    const ai = readFileSync('src/components/ai/AiAssistant.tsx', 'utf8');
    assert.match(ai, /CHAIN_MAX_TOKENS\.chat/, '对话链路必须走链路默认');
    assert.match(ai, /CHAIN_MAX_TOKENS\.quiz/, '出题链路必须走链路默认');
    assert.match(ai, /CHAIN_MAX_TOKENS\.judge/, '判分链路必须走链路默认');
    assert.match(ai, /CHAIN_MAX_TOKENS\.summary/, '归纳链路必须走链路默认');
    assert.doesNotMatch(ai, /2000, \/\/ 对话输出上限/, '对话固定 2000 上限必须废除');
    assert.doesNotMatch(ai, /4000, \/\/ 出题输出上限/, '出题固定 4000 上限必须废除');
    assert.doesNotMatch(ai, /signal\.signal, 20\)/, '判分固定 20 上限必须废除');
  });

  test('空正文入失败态：不落盘、不入历史、给重试', () => {
    const ai = readFileSync('src/components/ai/AiAssistant.tsx', 'utf8');
    assert.match(ai, /if \(outcome === 'empty'\) throw new EmptyAnswerError\(res\.finishReason\)/, '对话空正文必须抛 EmptyAnswerError');
    assert.match(ai, /const body = outcome === 'ok' \? rawBody : markTruncated\(rawBody, lang, outcome === 'cut' \? 'cut' : 'limit'\)/, '没写完的正文必须按成因标注');
    const i18n = readFileSync('src/lib/i18n.ts', 'utf8');
    assert.match(i18n, /empty: '模型这次没有输出正文/, '中文文案必须说明「没输出正文」');
    assert.match(i18n, /empty: 'The model produced no answer this time/, '英文文案必须同步');
  });

  test('收尾判定：空正文 / 上限截断 / 连接切断 / 正常，四态互不混淆', () => {
    const R = (text: string, finishReason: string | null, complete: boolean) => ({ text, finishReason, complete });
    assert.equal(classifyStreamOutcome(R('', 'length', true)), 'empty', '一个字都没有 → empty（当失败重试）');
    assert.equal(classifyStreamOutcome(R('   ', 'stop', true)), 'empty', '纯空白同样算空正文');
    assert.equal(classifyStreamOutcome(R('半句', 'length', true)), 'limit', '端点说被上限掐断 → limit');
    assert.equal(classifyStreamOutcome(R('半句', null, false)), 'cut', '没有收尾信号 → cut（连接被中途切断）');
    assert.equal(classifyStreamOutcome(R('完整回答', 'stop', true)), 'ok');
    assert.equal(classifyStreamOutcome(R('完整回答', null, true)), 'ok', '端点不给 finish_reason 但有 [DONE] 也算正常收完');
    assert.equal(classifyStreamOutcome(null), 'empty');
  });

  test('截断标记：可续写、可剥离，且与「已停止」互不混淆', () => {
    assert.equal(markTruncated('', 'zh'), '', '空回答不得只留标记');
    const zh = markTruncated('电流与电压成正比', 'zh');
    assert.ok(zh.endsWith('[输出已达上限]'), '中文用 [输出已达上限]');
    assert.equal(markTruncated(zh, 'zh'), zh, '重复标记必须幂等');
    assert.ok(markTruncated('current is proportional', 'en').endsWith('[output limit reached]'), '英文用 [output limit reached]');
    assert.equal(isStoppedAnswer(zh), true, '被截断的正文同样要给「继续生成」入口');
    assert.equal(stripStoppedMark(zh), '电流与电压成正比', '发给模型的正文必须剥掉标记');
    assert.equal(stripStoppedMark(markStopped('残句', 'zh')), '残句');
    // 连接被中途切断：用词与「上限截断」不同（对学生信息不同），但同样可续写、可剥离
    const cut = markTruncated('连接到一半的内容', 'zh', 'cut');
    assert.ok(cut.endsWith('[连接被中断，内容可能未写完]'), '切断用 [连接被中断，内容可能未写完]');
    assert.notEqual(cut, markTruncated('连接到一半的内容', 'zh', 'limit'), '两种成因不得共用同一标记');
    assert.equal(isStoppedAnswer(cut), true, '被切断的正文也要给「继续生成」入口');
    assert.equal(stripStoppedMark(cut), '连接到一半的内容', '切断标记同样必须剥离');
    assert.ok(markTruncated('cut off', 'en', 'cut').endsWith('[connection cut off — content may be incomplete]'), '英文切断标记同步');
  });

  testAsync('半途切断且有正文：不抛错，返回残句并标 complete=false（网关 60s 切断会走到这里）', async () => {
    const originalFetch = (globalThis as any).fetch;
    const enc = new TextEncoder();
    const sse = (obj: unknown) => `data: ${JSON.stringify(obj)}\n\n`;
    (globalThis as any).fetch = async () => {
      const stream = new ReadableStream({
        start(c) {
          c.enqueue(enc.encode(sse({ choices: [{ delta: { content: '前半句' } }] })));
          c.enqueue(enc.encode(sse({ choices: [{ delta: { content: '后半句' } }] })));
          // 连接被切断：没有 finish_reason，也没有 [DONE]。
          // 异步 error：同步调用会让 Node 把流错误抛成未捕获异常
          setTimeout(() => c.error(new Error('terminated')), 0);
        },
      });
      return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    };
    try {
      const res = await streamChat(
        { providerId: 'custom', apiKey: 'k', baseUrl: 'https://example.com/v1', model: 'm', agreed: true },
        [{ role: 'user', content: 'hi' }],
        () => {},
      );
      assert.equal(res.text, '前半句后半句', '已经收到的正文不得丢弃');
      assert.equal(res.complete, false, '没收到收尾信号必须标 complete=false');
      assert.equal(classifyStreamOutcome(res), 'cut');
    } finally {
      (globalThis as any).fetch = originalFetch;
    }
  });

  testAsync('半途切断且一个字都没有：按空正文上抛（可重试），不假装成功也不含糊报网络错', async () => {
    const originalFetch = (globalThis as any).fetch;
    const enc = new TextEncoder();
    (globalThis as any).fetch = async () => {
      // 流已经开始（先来一个空 delta），随后被切断：正是网关 60s 掐断、模型还在思考的样子
      const stream = new ReadableStream({
        start(c) {
          c.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { role: 'assistant', content: '' } }] })}\n\n`));
          setTimeout(() => c.error(new Error('terminated')), 0);
        },
      });
      return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    };
    try {
      let caught: unknown = null;
      try {
        await streamChat(
          { providerId: 'custom', apiKey: 'k', baseUrl: 'https://example.com/v1', model: 'm', agreed: true },
          [{ role: 'user', content: 'hi' }],
          () => {},
        );
      } catch (e) {
        caught = e;
      }
      assert.ok(caught instanceof EmptyAnswerError, '必须是空正文错误，而不是含糊的网络错误');
      const c = classifyChatFailure(caught);
      assert.equal(c.kind, 'empty');
      assert.equal(c.retryable, true, '一个字都没收到时重发一次通常就有正文，必须给重试');
    } finally {
      (globalThis as any).fetch = originalFetch;
    }
  });

  testAsync('响应都没开始（首包超时）：仍是 timeout，不能伪装成空正文', async () => {
    const originalFetch = (globalThis as any).fetch;
    (globalThis as any).fetch = async () => {
      const stream = new ReadableStream({ start(c) { setTimeout(() => c.error(new Error('terminated')), 0); } });
      return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    };
    try {
      let caught: unknown = null;
      try {
        await streamChat(
          { providerId: 'custom', apiKey: 'k', baseUrl: 'https://example.com/v1', model: 'm', agreed: true },
          [{ role: 'user', content: 'hi' }],
          () => {},
        );
      } catch (e) {
        caught = e;
      }
      assert.ok(caught && !(caught instanceof EmptyAnswerError), '一个事件都没收到时不得报成空正文');
    } finally {
      (globalThis as any).fetch = originalFetch;
    }
  });

  test('学生点停止（外层 abort）不当作「切断」：走「已停止」语义', () => {
    const ai = readFileSync('src/lib/ai-config.ts', 'utf8');
    assert.match(ai, /const userAborted = !!signal\?\.aborted;/, '切断返回残句前必须排除学生主动停止');
    assert.match(ai, /if \(!userAborted && full\.trim\(\)\) return \{ text: full, finishReason, usage, complete: false \}/, '只有非学生停止且已有正文才返回残句');
  });
});


/* ── AI 配置：Key 按服务商隔离（换服务商不得沿用上一家的 Key） ── */

describe('AI 配置 · Key 按服务商隔离', () => {
  test('历史配置（无 keyByProvider）把 Key 归到它自己的服务商，不外泄给其他家', () => {
    const legacy = {
      providerId: 'deepseek', apiKey: 'sk-test-deepseek', baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-chat', agreed: true,
    };
    const map = keysByProviderOf(legacy);
    assert.equal(map.deepseek, 'sk-test-deepseek');
    assert.equal(map.dashscope, undefined, '不得把 DeepSeek 的 Key 带到通义千问');
    assert.equal(map.moonshot, undefined);
    assert.equal(map.custom, undefined);
    // 切到未配置的服务商，输入框应拿到空串
    assert.equal(map.dashscope ?? '', '');
  });

  test('多家各自保存，互不覆盖（切回原服务商能取回自己的 Key）', () => {
    const cfg = {
      providerId: 'dashscope', apiKey: 'sk-test-qwen', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: 'qwen-plus', agreed: true,
      keyByProvider: { deepseek: 'sk-test-ds', dashscope: 'sk-test-qwen' },
    };
    const map = keysByProviderOf(cfg);
    assert.deepEqual(Object.keys(map).sort(), ['dashscope', 'deepseek']);
    assert.equal(map.deepseek, 'sk-test-ds');
    assert.equal(map.dashscope, 'sk-test-qwen');
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

  test('筛选 chip 的触控基线不可依赖 Tailwind 工具类（会被未分层 button 规则压过）', () => {
    // P2：chip 从「一律 40px」降到 28px —— 成排 chip 靠水平间距防误触，
    // 充到 40px 只会让小字浮在大空盒里（实测自我高 28px，被抬 43%）。
    assert.ok(/button\.chip-tap \{[^}]*min-height: 1\.75rem/.test(touchBlock),
      'chip-tap 必须是未分层触屏块里的 28px：实测 min-h-10 在 button 上计算值为 0');
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


/* ── 元素详情卡：相邻元素连续探索流 + 微观结构工效 ── */

describe('元素详情卡：相邻导航 / 电子层胶囊 / 微粒看板', () => {
  const src = readFileSync('src/pages/PeriodicTable.tsx', 'utf8');

  test('相邻元素导航：前一号 / 后一号成对，首末位自动禁用且不环绕', () => {
    // 边界：首末位
    assert.equal(neighborOf(1).prev, null, '#1 H 之前没有元素');
    assert.equal(neighborOf(1).next?.n, 2, '#1 H 的下一个是 #2 He');
    assert.equal(neighborOf(118).next, null, '#118 Og 之后没有元素');
    assert.equal(neighborOf(118).prev?.n, 117, '#118 Og 的上一个是 #117 Ts');
    // 用户点名的样例：#24 铬 ↔ #23 V / #25 Mn
    assert.equal(neighborOf(24).prev?.n, 23, '#24 铬的前一个是 #23');
    assert.equal(neighborOf(24).prev?.symbol, 'V', '#24 铬的前一个是 #23 V');
    assert.equal(neighborOf(24).next?.n, 25, '#24 铬的后一个是 #25');
    assert.equal(neighborOf(24).next?.symbol, 'Mn', '#24 铬的后一个是 #25 Mn');
    // 118 个元素全部成链：邻域必须严格按原子序数相邻（不得跳过 La/Ac 或错位）
    for (const e of ELEMENTS) {
      const { prev, next } = neighborOf(e.n);
      if (prev) assert.equal(prev.n, e.n - 1, `#${e.n} 的前一个必须是 #${e.n - 1}`);
      if (next) assert.equal(next.n, e.n + 1, `#${e.n} 的后一个必须是 #${e.n + 1}`);
    }
    // 源码级：触发器 / 禁用 / 方向键 / Z-of-118 指示
    assert.match(src, /neighborOf\(selected\.n\)/, '详情卡须用 neighborOf 取相邻元素');
    assert.match(src, /disabled=\{!prev\}/, '前一号按钮须在首位置禁用');
    assert.match(src, /disabled=\{!next\}/, '后一号按钮须在末位置禁用');
    assert.match(src, /e\.key === 'ArrowLeft'/, '须绑定 ← 方向键');
    assert.match(src, /e\.key === 'ArrowRight'/, '须绑定 → 方向键');
    assert.match(src, /ELEMENTS\.length/, '须显示「当前序数 / 总数」紧凑指示');
  });

  test('电子层胶囊：K/L/M/N 命名、由 shells 生成、默认高亮最外层', () => {
    assert.deepEqual([...SHELL_NAMES], ['K', 'L', 'M', 'N', 'O', 'P', 'Q'], '电子层名须为 K L M N O P Q');
    assert.match(src, /selected\.shells\.map\(\(cnt, i\)/, '胶囊须由 shells 数组生成（层数自适应）');
    assert.match(src, /SHELL_NAMES\[i\]/, '胶囊须带 K/L/M/N 层名');
    assert.match(src, /hoveredLayer \?\? pinnedLayer \?\? e\.shells\.length - 1/,
      '高亮优先级须为：悬停 > 点击锁定 > 默认最外层');
    assert.match(src, /setPinnedLayer\(pinnedLayer === i \? null : i\)/, '点击胶囊须锁定该层');
    assert.match(src, /bg-\[var\(--accent-light\)\]/, '胶囊须用微底；本仓无 --surface-sunken，须以 --accent-light 代替');
    assert.doesNotMatch(src, /surface-sunken/, '不得引用不存在的 --surface-sunken 令牌');
    // 层数自适应：每个元素都能在 K~Q 命名范围内生成等长胶囊
    for (const e of ELEMENTS) {
      assert.ok(
        e.shells.length >= 1 && e.shells.length <= SHELL_NAMES.length,
        `#${e.n} 的电子层数 ${e.shells.length} 超出 K~Q 命名范围`,
      );
    }
  });

  test('微粒三元组：质子 Z / 中子 N = round(A) − Z / 核外电子 Z', () => {
    assert.match(src, /Math\.round\(e\.massExact \?\? e\.mass \?\? e\.n\)/, '中子数须用 Math.round(A) − Z');
    // 行为级：初中铁律在全部 118 个元素上成立
    for (const e of ELEMENTS) {
      const pc = particleCount(e);
      assert.equal(pc.protons, e.n, `#${e.n} 质子数须等于原子序数`);
      assert.equal(pc.electrons, e.n, `#${e.n} 核外电子数须等于原子序数（原子整体呈电中性）`);
      assert.ok(pc.neutrons >= 0, `#${e.n} 中子数不得为负`);
      const a = Math.round(e.massExact ?? e.mass ?? e.n);
      assert.equal(pc.protons + pc.neutrons, a, `#${e.n} 须满足 A ≈ Z + N`);
      assert.ok(pc.neutrons <= 180, `#${e.n} 中子数 ${pc.neutrons} 明显偏离合理量级`);
    }
    // 抽查教科书经典：氢（氕）、氯、以及用户点名的铬
    assert.deepEqual(particleCount(ELEMENTS.find((e) => e.n === 1)!), { protons: 1, neutrons: 0, electrons: 1 }, '#1 氢（氕）：1 / 0 / 1');
    assert.deepEqual(particleCount(ELEMENTS.find((e) => e.n === 17)!), { protons: 17, neutrons: 18, electrons: 17 }, '#17 氯：17 / 18 / 17');
    assert.deepEqual(particleCount(ELEMENTS.find((e) => e.n === 24)!), { protons: 24, neutrons: 28, electrons: 24 }, '#24 铬：24 / 28 / 24');
    // 源码级：三元看板齐备
    for (const k of ['质子', '中子', '核外电子']) assert.ok(src.includes(k), `微粒看板须含「${k}」`);
    assert.ok(src.includes('核电荷数 = 质子数 = 核外电子数'), '须写出初中铁律');
  });

  test('保留教材画法：核内 +Z 与同心轨道圆环不得被替换成拟物小球', () => {
    assert.match(src, /\+{selected\.n}/, '原子核须保留 +Z（核电荷数）文字画法');
    assert.match(src, /<circle\s+cx=\{cx\} cy=\{cy\} r=\{r\} fill="none"/, '须保留同心轨道圆环');
    assert.match(src, /shellLayout\(selected\.shells, coreR\)/, '轨道几何须来自共享纯函数 shellLayout');
    assert.match(src, /ATOM_VIEW/, '须使用共享画布常量');
    assert.doesNotMatch(src, /radialGradient|linearGradient/, '原子结构图不得改用渐变拟物小球');
    // 行为级：核半径与各层几何在全部元素上都不越界、且点数等于真实电子数
    for (const e of ELEMENTS) {
      const coreR = coreRadiusFor(e.n);
      assert.ok(coreR >= 13 && coreR <= 16, `#${e.n} 核半径 ${coreR} 偏离既定区间`);
      const shells = shellLayout(e.shells, coreR);
      assert.equal(shells.length, e.shells.length, `#${e.n} 轨道数须等于电子层数`);
      shells.forEach((s, i) => {
        assert.equal(s.dots.length, e.shells[i], `#${e.n} 第 ${i + 1} 层点数须等于真实电子数（教材画法不得截断）`);
      });
      assert.ok(
        shells[shells.length - 1].r <= ATOM_VIEW.h / 2,
        `#${e.n} 最外层半径 ${shells[shells.length - 1].r} 越出画布`,
      );
    }
  });

  test('族标签与人教版写法 + 结构要点倾向', () => {
    assert.equal(groupLabel(1), 'ⅠA', '第 1 族须写作ⅠA');
    assert.equal(groupLabel(17), 'ⅦA', '卤素族须写作ⅦA');
    assert.equal(groupLabel(18), '0', '稀有气体族须写作 0 族');
    assert.equal(groupLabel(6), 'ⅥB', '#24 铬所在族须写作ⅥB');
    assert.equal(groupLabel(8), 'Ⅷ', '8/9/10 三列同属Ⅷ族');
    assert.equal(groupLabel(null), '—', 'f 区（无族）须优雅回退');
    // 行为级：最外层得失倾向（主族）——分区分流后返回值增加 scope 字段
    const na = ELEMENTS.find((e) => e.n === 11)!;
    const cl = ELEMENTS.find((e) => e.n === 17)!;
    const c6 = ELEMENTS.find((e) => e.n === 6)!;
    const ar = ELEMENTS.find((e) => e.n === 18)!;
    const he = ELEMENTS.find((e) => e.n === 2)!;
    assert.deepEqual(
      { outer: valenceTendency(na).outer, kind: valenceTendency(na).kind, count: valenceTendency(na).count },
      { outer: 1, kind: 'lose', count: 1 },
      '#11 钠：外层 1，易失 1',
    );
    assert.equal(valenceTendency(na).scope, 'main', '#11 钠须落在主族作用域');
    assert.deepEqual(
      { outer: valenceTendency(cl).outer, kind: valenceTendency(cl).kind, count: valenceTendency(cl).count },
      { outer: 7, kind: 'gain', count: 1 },
      '#17 氯：外层 7，易得 1',
    );
    assert.equal(valenceTendency(c6).kind, 'share', '#6 碳：外层 4，易共用电子');
    assert.equal(valenceTendency(ar).kind, 'stable', '#18 氩：外层 8，稳定结构');
    assert.equal(valenceTendency(he).kind, 'stable', '#2 氦：首层排满 2，稳定结构');
    for (const e of ELEMENTS) {
      const vt = valenceTendency(e);
      assert.equal(vt.outer, e.shells[e.shells.length - 1], `#${e.n} 最外层电子数须取末位`);
      assert.ok(
        ['lose', 'gain', 'share', 'stable', 'hydrogen', 'saturated', 'variable', 'lanthanide', 'polyvalent'].includes(vt.kind),
        `#${e.n} 倾向类型非法：${vt.kind}`,
      );
    }
  });

  test('外层倾向分区：副族/过渡与 f 区只给可变化合价，严禁硬套初中主族规律', () => {
    // 用户点名的三个过渡元素：一律不得输出 lose/gain，且必须落在 transition 作用域
    for (const n of [24, 26, 29]) {
      const e = ELEMENTS.find((x) => x.n === n)!;
      const vt = valenceTendency(e);
      assert.equal(vt.scope, 'transition', `#${n} ${e.symbol} 须判定为过渡元素`);
      assert.equal(vt.kind, 'variable', `#${n} ${e.symbol} 须输出「可变化合价」而非得失数`);
      assert.notEqual(vt.kind, 'lose', `#${n} 不得输出「易失」`);
      assert.notEqual(vt.kind, 'gain', `#${n} 不得输出「易得」`);
      assert.equal(vt.count, 0, `#${n} 不得给出得失电子个数`);
      const note = valenceNote(e, vt, true)!;
      assert.match(note, /可变化合价/, `#${n} 须说明可变化合价`);
      assert.match(note, /仅严格适用于主族/, `#${n} 须声明适用域边界`);
    }
    // #46 钯：外层 18 的经典特例 —— 既不作得失判定，也不得出现负数
    const pd = ELEMENTS.find((e) => e.n === 46)!;
    const pdV = valenceTendency(pd);
    assert.equal(pdV.outer, 18, '#46 钯最外层应为 18（2,8,18,18）');
    assert.equal(pdV.kind, 'saturated', '#46 钯须判为「外层已达饱和」');
    assert.equal(pdV.count, 0, '#46 钯不得出现负数电子数');
    assert.match(valenceNote(pd, pdV, true)!, /18 个电子/, '钯须说明 18 电子特例');
    // f 区（镧系/锕系）
    for (const n of [57, 71, 89, 103]) {
      const e = ELEMENTS.find((x) => x.n === n)!;
      const vt = valenceTendency(e);
      assert.equal(vt.scope, 'f', `#${n} 须判定为 f 区`);
      assert.equal(vt.kind, 'lanthanide', `#${n} 须输出镧系/锕系说明`);
      assert.notEqual(vt.kind, 'lose');
      assert.notEqual(vt.kind, 'gain');
    }
    // 全域硬不变量（118 元素逐个）
    for (const e of ELEMENTS) {
      const vt = valenceTendency(e);
      assert.ok(Number.isFinite(vt.count) && vt.count >= 0, `#${e.n} ${e.symbol} 得失电子数不得为负或非数：${vt.count}`);
      assert.equal(vt.outer, e.shells[e.shells.length - 1], `#${e.n} 最外层须取末位`);
      if (vt.kind === 'gain') {
        assert.ok(vt.count > 0 && vt.count <= 3, `#${e.n} 易得电子数须落在 1–3：${vt.count}`);
        assert.notEqual(e.cat, 'metal', `#${e.n} ${e.symbol} 是金属，绝不输出「易得电子」`);
        assert.equal(vt.scope, 'main', `#${e.n} 只有主族才允许输出得失判定`);
      }
      if (vt.kind === 'lose') assert.equal(vt.scope, 'main', `#${e.n} 只有主族才允许输出得失判定`);
      if (vt.kind === 'saturated') assert.ok(vt.outer > 8, `#${e.n} 只有外层 > 8 才可判为饱和`);
    }
    // 作用域与序号/列号的对应关系（118 元素）
    for (const e of ELEMENTS) {
      const expectScope = (e.n >= 57 && e.n <= 71) || (e.n >= 89 && e.n <= 103)
        ? 'f'
        : e.group !== null && e.group >= 3 && e.group <= 12 ? 'transition' : 'main';
      assert.equal(elementScope(e), expectScope, `#${e.n} ${e.symbol} 分区判定错误`);
    }
    // 氢：两性特例，不得按普通ⅠA 处理
    const h = ELEMENTS.find((e) => e.n === 1)!;
    const hV = valenceTendency(h);
    assert.equal(hV.kind, 'hydrogen', '#1 氢须为两性特例');
    assert.match(valenceNote(h, hV, true)!, /H⁻/, '氢须说明 H⁻');
    // 金属永不得 gain：Bi/Po/Mc/Lv 走多价态
    for (const n of [83, 84, 115, 116]) {
      const e = ELEMENTS.find((x) => x.n === n)!;
      const vt = valenceTendency(e);
      assert.equal(vt.kind, 'polyvalent', `#${n} ${e.symbol}（金属）须走多价态`);
      assert.equal(vt.count, 0);
    }
    // 短标签表齐备且与 kind 一一对应
    for (const k of ['lose', 'gain', 'share', 'stable', 'hydrogen', 'saturated', 'variable', 'lanthanide', 'polyvalent'] as const) {
      assert.ok(VALENCE_LABEL[k].zh && VALENCE_LABEL[k].en, `VALENCE_LABEL.${k} 中英文案都不得为空`);
    }
  });

  test('族标签展示：第 18 列兼顾 0 族与第 18 族，镧系/锕系显式激活系别', () => {
    const he = ELEMENTS.find((e) => e.n === 2)!;
    assert.equal(groupDisplay(he, true).main, '0', '第 18 列主标须为 0 族（人教版初中口径）');
    assert.match(groupDisplay(he, true).sub, /第 18 族/, '副标须给出「第 18 族」（新课标口径）');
    assert.match(groupDisplay(he, true).sub, /第 18 列/, '副标须保留列号');
    assert.equal(groupDisplay(he, false).sub, 'group 18 · column 18', '英文副标须同时给出 group 18');
    for (const e of ELEMENTS.filter((x) => x.group === 18)) {
      assert.equal(groupDisplay(e, true).main, '0', `#${e.n} 稀有气体主标须为 0`);
    }
    const la = ELEMENTS.find((e) => e.n === 57)!;
    const u = ELEMENTS.find((e) => e.n === 92)!;
    assert.equal(groupDisplay(la, true).main, 'ⅢB', '#57 镧主标须为ⅢB');
    assert.equal(groupDisplay(la, true).series, '镧系', '#57 须激活「镧系」徽章');
    assert.equal(groupDisplay(u, true).series, '锕系', '#92 须激活「锕系」徽章');
    assert.equal(groupDisplay(la, false).series, 'lanthanide', '英文系别徽章');
    for (let n = 57; n <= 71; n++) assert.equal(fSeriesOf(ELEMENTS.find((e) => e.n === n)!), 'lanthanide', `#${n} 须判为镧系`);
    for (let n = 89; n <= 103; n++) assert.equal(fSeriesOf(ELEMENTS.find((e) => e.n === n)!), 'actinide', `#${n} 须判为锕系`);
    for (const n of [21, 39, 72, 104, 118]) assert.equal(fSeriesOf(ELEMENTS.find((e) => e.n === n)!), null, `#${n} 不得判为 f 区`);
    assert.match(src, /groupDisplay\(selected, isZh\)/, '详情卡须用 groupDisplay 渲染族标签');
    assert.match(src, /\{selGroup\?\.series && \(/, '系别徽章须按系别条件渲染');
    // 中子标称修饰 + 诚实化说明
    assert.match(src, /N（估算）/, '中子格须标明为估算值');
    // 意图级断言（不锁死措辞）：中子数须显式标注为估算值，并点明「丰度加权平均 + 取整」的成因
    assert.match(src, /N（估算）|N \(est\.\)/, '中子数须在界面上标注为估算值');
    assert.match(src, /同位素丰度加权平均/, '须说明相对原子质量是同位素丰度的加权平均');
    assert.match(src, /³⁵Cl/, '须给出常见稳定同位素的取整实例（氯取 ³⁵Cl）');
    assert.match(src, /最长寿命核素/, '须说明放射性元素按最长寿命核素取质量数');
    // 学段分层提示（意图级：须点明「第 3 层可容纳 18 个电子」这一排布差异根因）
    assert.match(src, /\{selected\.n >= 21 && \(/, 'Z ≥ 21 须附学段分层提示');
    assert.match(src, /第 3 层最多容纳 18 个电子/, '提示须解释 21 号起的排布差异');
  });

  test('中央悬停展台：几何与真实格子同构、落位第 1~3 周期第 3~12 列、防抖回退齐备', () => {
    // 几何：左侧 28px（周期号 24 + 间距 4）、18 列等宽、4px 间隙、58px 行高 —— 与 flex 行逐列重合
    assert.match(src, /left-\[28px\] right-\[3px\] top-0 hidden sm:grid/, '展台覆层须按同一几何定位，并在移动端折叠');
    assert.match(src, /col-start-3 col-end-13 row-start-1 row-end-4/, '展台须占第 3~12 列、第 1~3 周期');
    assert.match(src, /gridTemplateColumns: 'repeat\(18, minmax\(0, 1fr\)\)'/, '须与 18 列网格同模板');
    assert.match(src, /gridTemplateRows: 'repeat\(3, 58px\)'/, '须与 58px 行高同模板');
    assert.match(src, /gap: '4px'/, '间隙须与 gap-1 一致');
    assert.match(src, /pointer-events-none/, '展台不得抢走格子的点击');
    assert.match(src, /aria-hidden="true"/, '展台为纯展示层，须对辅助技术隐藏');
    // 悬停响应与防抖
    assert.match(src, /onMouseEnter=\{\(\) => previewOn\(el\)\}/, '元素格须绑定 previewOn');
    assert.match(src, /onMouseLeave=\{previewOff\}/, '元素格须绑定 previewOff');
    assert.match(src, /const \[heroEl, setHeroEl\] = useState<ElementInfo \| null>\(null\)/, '须有 heroEl 状态');
    assert.match(src, /heroTimer\.current = window\.setTimeout\(\(\) => \{ setHeroEl\(null\)/, '离开后须延迟回退到默认态');
    assert.match(src, /if \(heroTimer\.current\) \{ window\.clearTimeout\(heroTimer\.current\); heroTimer\.current = null; \}/, '再次进入须取消回退（防闪烁）');
    // 内容：默认图例态 + 悬停预览态（实物图 / 身份 / 核心指标 / 微提示）
    assert.match(src, /\/\/ \{isZh \? '分类图例' : 'LEGEND'\}/, '默认态须含分类图例');
    assert.match(src, /element-images\/\$\{heroFocus\.n\}\.jpg/, '悬停态须复用百科实物标本图（按焦点的原子序数取图）');
    assert.match(src, /data-hero-fallback/, '无实物图须有优雅回退');
    assert.match(src, /点击元素格打开完整微观结构与百科故事/, '须有底部微提示');
    for (const k of ['相对原子质量', '周期', '电子层', '外层倾向']) {
      assert.ok(src.includes(k), `展台核心指标须含「${k}」`);
    }
    // 右边缘：蒙版条件化 + 呼吸边距
    assert.doesNotMatch(src, /className="fade-r-x/, '不得再无条件套用 .fade-r-x 蒙版');
    assert.match(src, /style=\{canScrollRight \? \{ maskImage: SCROLL_FADE_MASK/, '渐隐蒙版须按 canScrollRight 条件施加');
    assert.equal(
      SCROLL_FADE_MASK,
      'linear-gradient(to right, #000 calc(100% - 12px), transparent 100%)',
      '渐隐须收窄到 12px（原 28px 会吞掉整列边框）',
    );
    assert.match(src, /pr-\[3px\]/, '最右列须留 3px 呼吸边距');
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

  test('零 Emoji：面向用户的变更记录不得出现 Emoji 表情符号', () => {
    const src = readFileSync('src/lib/changelog.ts', 'utf8');
    // 覆盖常见 Emoji 区段（图形符号 / 装饰符号 / 补充符号 / 异体选择符）；
    // 刻意不纳入 → ↑ × · 等排印字符——它们是文字符号，不是 Emoji。
    const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu;
    const hits = src.match(EMOJI) || [];
    assert.equal(
      hits.length, 0,
      `变更记录（面向用户）不得含 Emoji——本站是严肃科学软件，实测命中：${[...new Set(hits)].join(' ')}`,
    );
  });

  test('首条篇幅与用词：条目数收口，且不得夹带实现细节', () => {
    const first = CHANGELOG[0];
    assert.ok(
      first.zh.length >= 2 && first.zh.length <= 4,
      `首条（当前版本）条目数须收口在 2–4 条，避免把开发清单倒给使用者：实测 ${first.zh.length} 条`,
    );
    // 面向用户的文案里不得出现实现单位与技术名词（它们只属于 docs/changelog-internal.md）
    const MECH = /\b(px|rem|SVG|DOM|CSS|React|Tailwind|localStorage|sessionStorage|commit|refactor|SHA|API|WASM)\b/i;
    for (const line of [...first.zh, ...first.en]) {
      assert.doesNotMatch(line, MECH, `用户向条目不得夹带实现细节：${line.slice(0, 48)}…`);
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

    // 地板本身仍在：L1 阶段导航 / Next / 答题选项要的就是拇指命中区
    assert.match(css, /main button\s*\{[^}]*min-height:\s*40px/, '40px 地板须保留（只兜 L1）');
    assert.match(css, /main button\.compact\s*\{[^}]*min-height:\s*0/, '须有 main button.compact 解除地板');
    // 触屏 compact 两档（P2）：默认 28px（成排的 chip / 预设 / 重置），
    // .tap32 提到 32px（分享 / 问 AI / 考考你这类单点辅助）。
    // 40px 只留给 L1 —— 阶段轨与答题选项，见下一条断言。
    assert.match(
      touchBlock,
      /main button\.compact\s*\{[^}]*min-height:\s*1\.75rem/,
      '触屏 compact 第一档须为 28px',
    );
    assert.match(
      touchBlock,
      /main button\.compact\.tap32\s*\{[^}]*min-height:\s*2rem/,
      '触屏 compact 第二档（.tap32）须为 32px',
    );
    assert.match(
      touchBlock,
      /main \.stage-rail button,[\s\S]{0,80}min-height:\s*1\.75rem/,
      '阶段轨与「下一步」在触屏下须回到 28px（P4 减重），否则 .tap-area 会把它们顶回 40px',
    );
    // 关闭类幽灵按钮：按下微缩 + 极浅底，绝不铺实底
    assert.match(css, /button\.ghost-x:active:not\(:disabled\)\s*\{[^}]*scale\(0\.95\)/, '关闭按钮须 ghost-x 微缩 0.95');
    assert.match(css, /button\.ghost-x:active:not\(:disabled\)\s*\{[^}]*background-color:\s*var\(--accent-light\)/, '关闭按钮按压只许极浅底');

    // 全站源码：主操作令牌不得再做按压底色（会铺满控件盒）
    const uiFiles = [
      'src/components/ai/AiAssistant.tsx', 'src/components/ai/AskAiButton.tsx', 'src/components/ai/AskQuizButton.tsx',
      'src/components/ui/DailyQuote.tsx', 'src/components/layout/Footer.tsx', 'src/components/lab/ExploreStage.tsx',
      'src/pages/MathFormulas.tsx', 'src/pages/PhysicsFormulas.tsx', 'src/pages/PhysicalConstants.tsx',
      'src/labs/math/Quadratic.tsx', 'src/labs/math/Linear.tsx', 'src/labs/math/Inverse.tsx',
      'src/labs/physics/Ohm.tsx', 'src/labs/physics/Circuits.tsx', 'src/labs/chemistry/Neutralization.tsx',
    ];
    for (const f of uiFiles) {
      const src = readFileSync(f, 'utf8');
      assert.doesNotMatch(src, /active:bg-\[var\(--accent\)\]/, `${f} 不得用 --accent 做按压底色（会变成实心黑/白块）`);
    }

    // 代表性 L3 微控件必须挂 .compact（否则仍被 40px 撑着）
    const l3: [string, string][] = [
      ['src/components/ui/DailyQuote.tsx', "▸ 人物小故事"],
      ['src/components/ai/AskAiButton.tsx', '问 AI'],
      ['src/components/ai/AskQuizButton.tsx', '考考你'],
      ['src/labs/math/Quadratic.tsx', '重置'],
      ['src/pages/HomePage.tsx', '随机进入'],
    ];
    for (const [f, name] of l3) {
      assert.match(readFileSync(f, 'utf8'), /\bcompact\b/, `${name}（${f}）须挂 compact 解除 40px 地板`);
    }
    // L2 chips：compact + leading-5（20px 行盒 + 3px 内边距 + 1px 边 = 28px 落点）
    const chips = readFileSync('src/pages/PhysicsFormulas.tsx', 'utf8');
    assert.match(chips, /compact leading-5 px-3 py-\[0\.1875rem\]/, '筛选 chip 须 compact + leading-5 收到 28px');
  });

  /* ── 40px 地板与按压态（v0.40.5 收口）─────────────────────────────────────
     这一节守两件事，都是实测出来的，不是审美偏好：

     1. `main button { min-height: 40px }` 是无层元素规则，特异性高于 Tailwind 的
        min-h-*（在 @layer utilities 内）→ 组件写 min-h-[34px] 也无效。
        实测代价：11px 文字 + py-1 的「人物小故事」渲染 40px、自身只有 24.5px；
        「翻一翻」自身 16.5px 被抬 142%。所以必须有 .compact 口子，否则改 padding 全是白工。
     2. `active:bg-[var(--accent)]` 当 --accent 是 #000/#fff 时铺满整个控件盒 →
        实测 2242px² 纯黑（深色主题纯白）。卡片里的微控件按下去就是一块黑砖。

     没有这两条断言，下一次「统一风格」会把它们原样改回去。 */
  test('页脚独立图标：允许 tap-icon 扩区，但间距与视觉尺寸必须同时守住', () => {
    const footer = readFileSync('src/components/layout/Footer.tsx', 'utf8');
    if (!footer.includes('tap-icon')) return; // 未扩区时无需约束
    // 历史事故：页脚图标彼此仅隔几像素，+8px 外扩后热区互压，出现「点邮箱触发作品集」。
    // 现在改为「先把间距拉开、再扩区」：间距被改小时本测试立刻失败。
    assert.ok(/flex items-center gap-5/.test(footer), '作者行图标需保留 gap-5：26px 盒 + 20px 间隙 = 中心距 46px ≥ 44px');
    // 横向：移动端 16px（gap-x-4）—— 26px 图标盒 + 两端各 8px 扩区 = 42px 命中盒，
    // 16px 间隙让两盒**恰好相切**（实测重叠 0px），这是零重叠的下限；再小就互抢点击。
    // 桌面回到 10px（sm:gap-x-2.5）：tap-icon::after 只在 (hover:none) and (pointer:coarse)
    // 内生成，桌面压根没有扩区，10px 不会撞 —— 因此不再需要统一 20px 去迁就触屏。
    assert.ok(/gap-x-4/.test(footer) && /sm:gap-x-2\.5/.test(footer) && /gap-y-4/.test(footer), '底部图标行需 gap-x-4（触屏相切）/ sm:gap-x-2.5（桌面冻结）/ gap-y-4（换行不撞）');
    const p15 = (footer.match(/p-1\.5(?! -m)/g) || []).length;
    assert.ok(p15 >= 4, `扩区图标需用 p-1.5 把 14px 视觉盒撑到 26px 命中盒，实际 ${p15} 处`);
    assert.ok(!footer.includes('-m-1\.5'), '扩区图标不得再用 -m-1.5：负外边距会吃掉 flex 间距 12px，中心距掉到 34px 后 42px 扩区必然互压');
    assert.ok(/<Share2 className="w-3\.5 h-3\.5"/.test(footer) && /<Network className="w-3\.5 h-3\.5"/.test(footer),
      '扩区只能靠伪元素：图标本身不得放大（视觉仍 14px）');

    // 作品集角标：科技蓝（曾是品牌红 #C71D23，在页脚里读起来像未读告警）
    const css = readFileSync('src/index.css', 'utf8');
    const i18nSrc = readFileSync('src/lib/i18n.ts', 'utf8');
    assert.match(footer, /footer-works-badge/, '作品集角标须挂 .footer-works-badge 钩子（hover 动效用）');
    assert.doesNotMatch(footer, /bg-\[#C71D23\]/, '作品集角标不得再用品牌红背景');
    assert.match(css, /--tech-blue: #4d6bfe;/, '须有 --tech-blue 令牌（--accent 是黑/白，当不了蓝）');
    assert.match(css, /\.footer-works-badge \{[^}]*background: var\(--tech-blue\)/, '角标底色须取 --tech-blue 令牌');
    // hover 微动效：整体上浮 1px + 角标 1.08 + 同色光晕，且尊重减少动效
    assert.match(css, /\.footer-works:hover \.footer-works-glyph,[\s\S]{0,80}translateY\(-1px\)/, '悬停须整体上浮 1px');
    assert.match(css, /\.footer-works:hover \.footer-works-badge,[\s\S]{0,120}scale\(1\.08\)/, '悬停角标须缩放 1.08');
    assert.match(css, /0 0 6px var\(--tech-blue-glow\)/, '悬停须叠加同色光晕');
    assert.match(css, /prefers-reduced-motion: reduce[\s\S]{0,400}\.footer-works-badge \{ transform: none; \}/, '减少动效时须取消位移与缩放');
    // 浮层提示：单行 + 深底令牌 + 12px + 箭头，且必须 pointer-events:none（不许挡住按钮）
    assert.match(css, /\.footer-works-tip \{[^}]*pointer-events: none/, '浮层不得拦截点击');
    assert.match(css, /\.footer-works-tip \{[^}]*font-size: 12px/, '浮层字号须 12px');
    assert.match(css, /\.footer-works-tip \{[^}]*white-space: nowrap/, '浮层须单行');
    assert.match(css, /\.footer-works-tip::after \{[^}]*transform: rotate\(45deg\)/, '浮层须有指向图标的小箭头');
    assert.ok(footer.includes('footer-works-tip'), '页脚须渲染浮层提示');
    assert.match(i18nSrc, /moreWorksHint: 'Ricky 的其他作品'/, '浮层文案须为「Ricky 的其他作品」');
    assert.match(i18nSrc, /moreWorksHint: 'More By Ricky'/, '浮层文案须有英文对应「More By Ricky」');
    assert.match(css, /\.footer-works-tip \{[^}]*max-width: calc\(100vw - 1\.5rem\)/, '浮层须有极窄视口兜底宽度');
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

  // ── 平板/iPad 断点（768–1024）：品牌行不许折行、版本号不许错位 ──
  test('顶栏品牌行：品牌与版本号锁死一行、同轴对齐（触屏 .tap-area 会把这一行撑到 40px）', () => {
    const header = readFileSync('src/components/layout/Header.tsx', 'utf8');
    // ① 左簇不被压缩：顶栏是 justify-between 的两组 flex 子项，默认 shrink:1 会先压左簇，
    //    品牌文字是普通文本，一被压就在词间折行。显式 nowrap + shrink-0 才锁得住。
    assert.match(
      header,
      /<Link to="\/" className="flex flex-nowrap shrink-0 items-center gap-2 /,
      '左簇须 flex-nowrap + shrink-0：缺任一项，窄窗口下品牌文字先在词间折行、版本号跟着错位',
    );
    // ② 两行文字都不许换行
    assert.match(header, /hidden sm:inline whitespace-nowrap text-\[0\.625rem\] mono-font uppercase/, '品牌文字须 whitespace-nowrap');
    // ③ 版本号禁止 self-end / mb-0.5 —— coarse 下 .tap-area 把品牌行撑到 40px（桌面 28px），
    //    self-end 会把版本号钉到行底：实测下沉 6.5px，10px 小字看上去就像「掉到了下一行」。
    //    只校验按钮自身的 className——注释里会解释这段历史，全局扫词会把说明文字也算进去。
    const ver = header.match(/className="hidden sm:flex items-center gap-1\.5[^"]*"/)?.[0] ?? '';
    assert.ok(ver.length > 0, '未找到版本号按钮的 className');
    assert.ok(!/self-end|mb-0\.5/.test(ver), `版本号不得再用 self-end / mb-0.5：触屏下会相对品牌标题下沉（实测 6.5px）——当前 ${ver}`);
    assert.ok(ver.includes('whitespace-nowrap'), '版本号须 whitespace-nowrap，彻底禁止折行');
    assert.ok(ver.includes('tap-pad-10'), '版本号须挂 tap-pad-10：它是顶栏唯一没走 .tap-area 的控件，命中盒只有 42×15');
    // ④ 热区只在触屏块里扩，桌面视觉零变化
    const touchBlock = css.slice(css.indexOf('@media (hover: none) and (pointer: coarse)'));
    assert.match(touchBlock, /\.tap-pad-10::after \{[\s\S]*?inset: -10px -2px;/, '.tap-pad-10 须在触屏块内、横向只扩 2px（左邻品牌文字，横扩会劫持「点标题回首页」）');
  });

  test('顶栏「使用说明」文案断点：≥1024（lg）才展开文字，平板段保持图标形态', () => {
    const header = readFileSync('src/components/layout/Header.tsx', 'utf8');
    const link = header.match(/<Link\s+to="\/guide"[\s\S]*?<\/Link>/)?.[0] ?? '';
    assert.match(link, /<span className="hidden lg:inline">\{t\.guide\}<\/span>/, '文案须 hidden lg:inline：平板段收成图标形态，右簇回到 40px 方盒节奏');
    assert.doesNotMatch(link, /hidden sm:inline/, 'sm 断点展开文字会让 iPad（768）右簇 296px 与左簇只剩 62px 余量');
    assert.match(link, /aria-label=\{t\.guide\}/, '文字隐去后 aria-label 是唯一可访问名，须常驻');
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
    // 断言与换行无关：只要「总数只在 supported 分支里出现」即可（收敛成行内图标后 title 跨行）
    assert.match(
      readFileSync('src/pages/PeriodicTable.tsx', 'utf8'),
      /packStatus\.supported\s*\?/,
      '未支持时入口不得显示 0/总数',
    );
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
    // 读数槽是**按需出现**的：旧版无条件下写死一句「<当前读数> 内是…」，而那个标签块根本不存在
    // （审计中 3 的「虚标」）。现在没有实时读数就不输出空槽，有读数才带语义说明。
    assert.ok(!zh.includes('<当前读数>'), '没有实时读数时不得虚标读数槽');
    const zhR = buildSystemPrompt('zh', '欧姆定律实验', '', '', true, '【当前实验实时状态】电流读数 0.60A');
    const enR = buildSystemPrompt('en', 'Ohm lab', '', '', true, '【当前实验实时状态】电流读数 0.60A');
    assert.ok(zhR.includes('<当前读数>') && zhR.includes('严禁自行推算'), '有读数时须说明槽位语义与引用纪律');
    assert.ok(enR.includes('<current_readings>'), '英文读数槽须为 <current_readings>');
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
    // 断言改写说明：实验页的入口已统一收口到 LabPage 的标题行（与 4 个工具页策略一致），
    // 15 个实验不再各写一份——原断言「须覆盖全部实验与工具页、≥19 个文件」锁的正是被替换掉的结构。
    // 新契约保留「凡有问 AI 必成对挂载考考你」的意图，并**反向禁止实验内自带入口**：
    // 历史上周期表就是因为页头与自己各挂一份，才出现两个「考考你」并排。
    assert.ok(paired.includes('src/pages/LabPage.tsx'), '实验页入口须由 LabPage 统一挂载');
    assert.ok(paired.length >= 5, '须覆盖 LabPage 与全部工具页，当前 ' + paired.length + ' 个文件');
    for (const f of files.filter((x) => x.startsWith('src/labs/'))) {
      assert.ok(
        !readFileSync(f, 'utf8').includes('<AskAiButton'),
        f + ' 实验内不得再自带入口：入口统一由 LabPage 提供，自带会与页头重复',
      );
    }
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
    assert.ok(!wrap.includes('max-w-2xl'), '版心宽度改由页面级 max-w-5xl 容器统一承托，视频容器自身不再单独限宽');

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

// ---------- AI 失败分类与重试链路：文案归一 / 上下文纯净 / 触控与图标纪律 ----------
{
  test('失败分类：网络·认证·限流·服务端·超时·停滞各归其位，是否可重试判定正确', () => {
    const net = classifyChatFailure(new TypeError('Failed to fetch'));
    assert.equal(net.kind, 'offline', '浏览器原文 "Failed to fetch" 必须归到离线/网络类，不能直接端给学生');
    assert.equal(net.retryable, true);
    assert.equal(classifyChatFailure(new Error('boom'), { offline: true }).kind, 'offline', '面板已知离线时优先按离线处理');

    const auth = classifyChatFailure(Object.assign(new Error('nope'), { status: 401 }));
    assert.equal(auth.kind, 'auth');
    assert.equal(auth.retryable, false, '认证失效重试必然再失败：只给「修改配置」，不给「重试」');

    const rl = classifyChatFailure(Object.assign(new Error('slow down'), { status: 429, retryAfterSec: 7 }));
    assert.equal(rl.kind, 'rate_limit');
    assert.equal(rl.retryAfterSec, 7, 'Retry-After 必须透传到失败态，供倒计时使用');

    assert.equal(classifyChatFailure(Object.assign(new Error('bad gateway'), { status: 503 })).kind, 'server');
    assert.equal(classifyChatFailure(new Error('no response in 20s')).kind, 'timeout');
    assert.equal(classifyChatFailure(new Error('stalled for 30s')).kind, 'stall');

    const bad = classifyChatFailure(Object.assign(new Error('bad request'), { status: 400 }));
    assert.equal(bad.retryable, false, '4xx 属请求/配置问题：给学生「重试」只是让他白点一次');
    const other = classifyChatFailure(new Error('weird'));
    assert.equal(other.kind, 'network');
    assert.equal(other.raw, 'weird', '原文必须保留：作为灰色次要行供排查，但绝不作为主文案');
  });

  test('中断标记：只给学生看，发给模型前必须剥离（且与 markStopped 互逆）', () => {
    assert.equal(stripStoppedMark('串联电路电流相等\n\n[已停止]'), '串联电路电流相等');
    assert.equal(stripStoppedMark('current is equal\n\n[stopped]'), 'current is equal');
    assert.equal(stripStoppedMark('干净的正文'), '干净的正文', '没有标记的文本不得被改动');
    assert.equal(stripStoppedMark('   '), '', '纯空白归一为空串');
    assert.equal(stripStoppedMark(markStopped('残句', 'zh')), '残句');
    assert.equal(stripStoppedMark(markStopped('partial', 'en')), 'partial');
  });

  test('失败文案：每个分类在中英文里都有条目（漏一个就会露出 undefined）', () => {
    const kinds: AiFailureKind[] = ['offline', 'network', 'timeout', 'stall', 'rate_limit', 'server', 'auth', 'other'];
    for (const k of kinds) {
      assert.ok(translations.zh.aiError[k], 'zh 缺 aiError.' + k);
      assert.ok(translations.en.aiError[k], 'en 缺 aiError.' + k);
    }
    assert.ok(translations.zh.aiError.retry && translations.en.aiError.retry, '重试按钮文案必须有中英两版');
    assert.ok(translations.zh.aiError.checkNetwork && translations.en.aiError.checkNetwork, '连续失败提示必须有中英两版');
  });

  test('重试链路源码守卫：快照重放 / 离线仅一次 / 429 倒计时 / 触控 40px', () => {
    const ai = readFileSync('src/components/ai/AiAssistant.tsx', 'utf8');
    assert.match(ai, /const attemptRef = useRef</, '必须保存本轮请求快照，重试才能重放同一份 messages');
    assert.match(ai, /attemptRef\.current = \{ q, followUp, messages: messages\.map/, '发送时固化快照（messages 需深拷贝）');
    assert.match(ai, /void sendQuestion\(a\.q, a\.followUp, a\.messages\)/, '重试必须走快照重放，而不是按当前页面重新拼装');
    assert.match(ai, /stripStoppedMark\(lastExchange\.current\.assistant\)/, '中断内容回灌上下文前必须剥离人造标记');
    assert.match(ai, /addEventListener\('online', onOnline, \{ once: true \}\)/, '离线恢复只允许自动重试一次：严禁无限自动重发烧 token');
    assert.match(ai, /setRetryCountdown\(failure\.retryAfterSec/, '429 必须按 Retry-After 倒计时');
    assert.match(ai, /retryCountdown > 0 \|\| busy/, '倒计时未走完时「重试」须禁用');
    // 视觉实体与触控热区解耦：实体保持 ~28px 胶囊，触屏 40px 一律交给 .tap-area（禁止 min-h-10 硬撑实体）
    const pills = ai.match(/py-1\.5[^"]*tap-area/g) || [];
    assert.ok(pills.length >= 3, `对话重试 / Quiz 重试 / 继续生成 都须「紧凑胶囊 + tap-area」，实际 ${pills.length} 处`);
    assert.doesNotMatch(ai, /min-h-10/, 'AI 面板内不得再用 min-h-10 硬撑次级控件视觉高度（应改用 py-1.5 + tap-area）');
    assert.match(ai, /<RotateCcw className="h-3\.5 w-3\.5" aria-hidden="true" \/>\s*\{lang === 'zh' \? '重试' : 'Retry'\}/, 'Quiz 重试按钮须用 RotateCcw 图标');
  });

  test('停滞看门狗：常量与重置点齐备（首包闸之外的第二道闸）', () => {
    const cfg = readFileSync('src/lib/ai-config.ts', 'utf8');
    assert.match(cfg, /STALL_TIMEOUT_MS = 60000/, '停滞超时须显式 60s（思考型模型在弱算力设备上增量间隔可达 20s+）');
    assert.equal(STALL_TIMEOUT_MS, 60000, '停滞阈值必须是 60s');
    assert.ok(STALL_TIMEOUT_MS > 30000, '停滞闸不得短于 30s：会把正常思考误判成传输停滞');
    assert.match(cfg, /armStall\(\); \/\/ 每收到一段就重置停滞闸/, '每收到一段增量都要重置停滞闸（按间隔判定，不看总时长）');
    assert.match(cfg, /if \(stalled\) throw new Error\(`stalled for/, '停滞要换成可识别错误，供分类给出「内容传输停滞」');
    assert.match(cfg, /httpErr\.status = res\.status/, 'HTTP 状态码必须挂到错误上：否则 429/5xx 无法区分');
    assert.match(cfg, /httpErr\.retryAfterSec/, 'Retry-After 必须解析并透传');
  });

  test('错误卡与重试 chip：严禁 emoji（黑白灰单色 + Lucide 矢量图标）', () => {
    // 只查真正的 emoji（含用户点名的 ⚠️❌🔄）：U+1F300–1FAFF、U+1F000–1F2FF、变体选择符 FE0F、
    // 以及 ✅❌⚠⭐⭕ 这几个常见符号。中性的 ✓/✗（U+2713/2717）是文本符号，不在禁用之列。
    const emoji = /[\u{1F000}-\u{1FAFF}\u{FE0F}\u{2705}\u{274C}\u{26A0}\u{2B50}\u{2B55}]/u;
    for (const f of ['src/components/ai/AiAssistant.tsx', 'src/components/ai/AnswerRich.tsx', 'src/lib/i18n.ts']) {
      const hit = readFileSync(f, 'utf8').match(emoji);
      assert.equal(hit, null, `${f} 出现 emoji：${hit?.[0]}（错误卡、提示文案与重试 chip 一律用 Lucide 图标）`);
    }
  });

  test('文本符号图标化：面板不再出现对勾 / 叉号 / 沙漏字符（一律 Lucide 图标）', () => {
    const ai = readFileSync('src/components/ai/AiAssistant.tsx', 'utf8');
    const glyph = ai.match(/[✓✗⏱]/);
    assert.equal(glyph, null, `AiAssistant 仍有字符符号：${glyph?.[0]}（应改用 Lucide 的 Check / X / Timer）`);
    assert.match(ai, /function Mark\(\{ ok, className = '' \}/, '必须保留统一的行内对错标记组件');
    assert.match(ai, /const Icon = ok \? Check : X;/, '正确 / 错误一律走 Check 与 X 图标');
    assert.match(ai, /text-\[var\(--error\)\]/, '错误标记须用 --error 语义色');
  });

  test('中断残句的续写判定：只有「带标记且仍有正文」才给继续生成入口', () => {
    assert.equal(isStoppedAnswer('残句\n\n[已停止]'), true);
    assert.equal(isStoppedAnswer('partial\n\n[stopped]'), true);
    assert.equal(isStoppedAnswer('完整回答'), false, '正常回答不得出现「继续生成」');
    assert.equal(isStoppedAnswer('[已停止]'), false, '只有标记没有正文时无可续写内容');
    assert.equal(isStoppedAnswer(''), false);
  });

  test('继续生成链路：钉住本轮上下文 + 剥离标记 + 复用 followUp + 40px 触控', () => {
    const ai = readFileSync('src/components/ai/AiAssistant.tsx', 'utf8');
    assert.match(ai, /lastExchange\.current = \{ user: h\.user, assistant: stripStoppedMark\(h\.assistant\) \}/,
      '续写必须把上下文钉在被中断的那一轮，且剥掉人造标记');
    assert.match(ai, /void sendQuestion\(t\.aiContinue\.ask, true\)/, '续写必须走 followUp 链路（第二个参数 true）');
    assert.match(ai, /isStoppedAnswer\(h\.assistant\)/, '入口只挂在「被中断且仍有残句」的回答上');
    assert.match(ai, /py-1\.5[^"]*tap-area"\s*>\s*<ChevronsDown/, '「继续生成」chip 须紧凑胶囊（py-1.5）+ tap-area 触屏热区 + 内嵌 Lucide 图标');
    for (const k of ['label', 'ask'] as const) {
      assert.ok(translations.zh.aiContinue[k] && translations.en.aiContinue[k], `aiContinue.${k} 必须有中英两版`);
    }
  });
}

/* ── token 用量堆叠柱聚合（纯函数：日历回填 / 共同 y 轴 / before 排除 / 分色上限） ── */

describe('Token usage stacked bars (buildDailyBars)', () => {
  function usageOf(rows: [string, string, number][]): TokenUsageData {
    const out: TokenUsageData = {};
    for (const [model, day, tokens] of rows) {
      out[model] = out[model] ?? {};
      out[model][day] = (out[model][day] ?? 0) + tokens;
    }
    return out;
  }

  test('日历回填：断档日必须补齐为 hasRecord=false，横轴不丢日期', () => {
    const usage = usageOf([
      ['m1', '2026-10-01', 100],
      ['m1', '2026-10-04', 300],
    ]);
    const out = buildDailyBars(usage, 5, new Date(2026, 9, 5));
    assert.equal(out.bars.length, 5, '窗口 5 天必须生成 5 根柱（含断档日）');
    assert.deepEqual(
      out.bars.map((b) => b.day),
      ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'],
    );
    assert.deepEqual(out.bars.map((b) => b.hasRecord), [true, false, false, true, false]);
    assert.equal(out.bars[1].total, 0);
    assert.equal(out.bars[1].segments.length, 0);
  });

  test('共同 y 轴：柱高按窗口内最大日总量归一，分段高度之和等于柱高', () => {
    const usage = usageOf([
      ['a', '2026-10-01', 100],
      ['b', '2026-10-01', 300],
      ['a', '2026-10-02', 50],
    ]);
    const out = buildDailyBars(usage, 2, new Date(2026, 9, 2));
    assert.equal(out.maxDay, 400);
    assert.equal(out.bars[0].hPct, 100, '最大日必须满高');
    assert.equal(out.bars[1].hPct, 12.5, '50 / 400 = 12.5%');
    for (const bar of out.bars) {
      const sum = bar.segments.reduce((s, x) => s + x.hPct, 0);
      assert.ok(
        Math.abs(sum - bar.hPct) < 0.05,
        `分段高度之和(${sum})必须等于柱总高(${bar.hPct})，否则堆叠会露缝或溢出`,
      );
    }
  });

  test('before 桶不进时间轴：只汇总为 legacyTokens 单列脚注', () => {
    const usage = usageOf([['a', '2026-10-01', 100]]);
    usage.a.before = 5000;
    const out = buildDailyBars(usage, 3, new Date(2026, 9, 3));
    assert.equal(out.legacyTokens, 5000);
    assert.ok(!out.bars.some((b) => b.day === 'before'), 'before 不得成为时间轴上的一天');
    assert.ok(out.bars.every((b) => b.segments.every((s) => s.model !== 'before')));
    assert.equal(out.maxDay, 100, 'before 不参与 y 轴归一');
  });

  test('分色上限：第 6 名及以后合并为「其他」，其他段不占分类色', () => {
    const rows: [string, string, number][] = [];
    for (let i = 0; i < 8; i++) rows.push(['m' + i, '2026-10-01', 1000 - i * 10]);
    const out = buildDailyBars(usageOf(rows), 1, new Date(2026, 9, 1));
    assert.equal(out.models.length, CHART_MODEL_LIMIT);
    assert.equal(out.otherModels.length, 3);
    const seg = out.bars[0].segments.find((s) => s.isOther);
    assert.ok(seg, '必须存在「其他」合并段');
    assert.equal(seg.tokens, 950 + 940 + 930, '「其他」= 第 6/7/8 名（950+940+930）之和');
    assert.equal(out.bars[0].segments.length, 6, '5 个分色模型 + 1 个「其他」');
  });

  test('空数据：不崩、不产生 NaN', () => {
    const out = buildDailyBars({}, 4, new Date(2026, 9, 4));
    assert.equal(out.bars.length, 4);
    assert.equal(out.maxDay, 0);
    assert.ok(out.bars.every((b) => b.hPct === 0 && !b.hasRecord));
    assert.equal(out.legacyTokens, 0);
  });

  test('单模型回到 --accent，多模型走 --chart-N，其他段用中性灰', () => {
    const single = buildDailyBars(usageOf([['only', '2026-10-01', 123]]), 2, new Date(2026, 9, 2));
    assert.deepEqual(single.models, ['only']);
    assert.equal(single.otherModels.length, 0);
    assert.equal(
      segmentColor(0, single.models.length + (single.otherModels.length > 0 ? 1 : 0)),
      'var(--accent)',
      '单模型必须回到 --accent（与旧单色迷你条语言连续）',
    );
    assert.equal(segmentColor(0, 3), 'var(--chart-1)');
    assert.equal(segmentColor(2, 3), 'var(--chart-3)');
    assert.equal(OTHER_COLOR, 'var(--border-strong)');
  });
});

describe('Token usage retention (90 天 FIFO)', () => {
  test('保留窗口常量与实现一致：只留最近 90 天（含今天），before 永久保留', () => {
    assert.equal(RETENTION_DAYS, 90);
    const usage: TokenUsageData = { a: { '2026-07-09': 1, '2026-07-10': 2, '2026-07-11': 3, before: 42 } };
    // 今天 2026-10-07，90 天窗口 → 最早保留 2026-07-10
    const pruned = pruneTokenUsage(usage, new Date(2026, 9, 7));
    assert.equal('2026-07-09' in pruned.a, false, '第 91 天前的日期必须被丢弃');
    assert.equal(pruned.a['2026-07-10'], 2, '窗口边界日必须保留');
    assert.equal(pruned.a['2026-07-11'], 3);
    assert.equal(pruned.a.before, 42, 'before 无日期，永久保留');
  });

  test('修剪后模型一天不剩则整个模型键一并移除（不留空对象）', () => {
    const pruned = pruneTokenUsage({ old: { '2020-01-01': 5 } }, new Date(2026, 9, 7));
    assert.equal(Object.keys(pruned).length, 0);
  });

  test('addTokenUsage 写入即修剪：90 天前的旧键不会留在存储里', () => {
    const mem = new Map<string, string>();
    mem.set('stem-ai-token-usage', JSON.stringify({ a: { '2020-01-01': 5 } }));
    const g = globalThis as unknown as { window: unknown };
    const had = 'window' in g;
    const prev = g.window;
    (g as Record<string, unknown>).window = {
      localStorage: {
        getItem: (k: string) => mem.get(k) ?? null,
        setItem: (k: string, v: string) => {
          mem.set(k, v);
        },
        removeItem: (k: string) => {
          mem.delete(k);
        },
      },
    };
    try {
      addTokenUsage('a', 100);
      const raw = JSON.parse(mem.get('stem-ai-token-usage')!) as Record<string, Record<string, number>>;
      assert.equal('2020-01-01' in raw.a, false, '过期日期键必须被 FIFO 修剪掉');
      assert.ok(Object.values(raw.a).some((n) => n === 100), '当天的新增必须保留');
    } finally {
      if (had) (g as Record<string, unknown>).window = prev;
      else delete (g as Record<string, unknown>).window;
    }
  });
});

describe('Token usage chart source guards (零第三方图表依赖)', () => {
  const chart = readFileSync('src/components/ui/TokenUsageChart.tsx', 'utf8');
  const dialog = readFileSync('src/components/ui/TokenUsageDialog.tsx', 'utf8');

  test('包依赖中不存在任何图表库（手写原生 SVG）', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = Object.keys({ ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) });
    const banned = deps.filter((d) => /recharts|chartjs|chart\.js|echarts|nivo|victory|apexcharts|visx|^d3$/i.test(d));
    assert.deepEqual(banned, [], `不得引入图表库：${banned.join(', ')}`);
    for (const lib of ['recharts', 'chart.js', 'echarts', 'd3']) {
      assert.ok(!chart.includes(`from '${lib}'`), `图表组件不得依赖 ${lib}`);
    }
  });

  test('非等比缩放 + 发丝描边：锁 1px 边框语言', () => {
    assert.match(chart, /preserveAspectRatio="none"/, '百分比横轴必须配 preserveAspectRatio="none"');
    assert.match(chart, /vectorEffect="non-scaling-stroke"/, '描边必须 non-scaling-stroke，否则被非等比缩放拉粗');
  });

  test('整列命中区：单个透明 rect 按 clientX 算列，不为每根柱建元素', () => {
    assert.match(chart, /data-usage-hit="1"/, '必须有整列透明命中区');
    assert.match(chart, /pickIndex\(e\.clientX/, '命中列必须按 clientX 计算');
    assert.match(chart, /Math\.floor\(ratio \* n\)/, '列序号 = floor(clientX 比例 × 柱数)');
  });

  test('断档日去方框化：只留 1.5px 圆头极淡短横条 + before 只做脚注 + 读数条常驻', () => {
    assert.match(chart, /data-usage-empty="1"/, '断档日必须有标记（供量测与测试定位）');
    assert.match(chart, /strokeLinecap="round"/, '断档日短横条必须圆头（不再是方框）');
    assert.match(chart, /strokeWidth=\{1\.5\}/, '断档日短横条 1.5px（发丝级，不抢视线）');
    assert.match(chart, /opacity=\{0\.25\}/, '断档日短横条必须极淡（无记录 ≠ 用量为 0）');
    assert.ok(!/<rect[^>]*data-usage-empty/.test(chart), '断档日不得再画空心方框 rect（整排方框=密集栅栏噪音）');
    assert.match(dialog, /u\.legacyPrefix/, 'before 桶必须以脚注呈现');
    assert.ok(!dialog.includes('此前累计'), 'before 不得作为列表行出现（该文案已收进 i18n）');
    // 方案 B：日期明细列表整体移除 —— 不得再有任何列表 / 折叠 / 滚动残留
    assert.doesNotMatch(dialog, /byDay|aria-expanded|ChevronDown/, '时间轴的日期明细列表必须已彻底移除');
    assert.match(dialog, /u\.hint/, '读数条必须常驻（固定高度，防抖动）');
  });

  test('天数切换 = 整体分段滑槽（废除三个独立方框；桌面紧凑、触屏 40px）', () => {
    assert.match(
      dialog,
      /inline-flex items-center gap-0 p-0\.5 rounded-lg bg-\[var\(--accent-light\)\]\/70 border border-\[var\(--border\)\]\/60/,
      '外层必须是整体式包裹槽（不是三个割裂方块）；槽底 70% 叠色保证未选中文字暗色 ≥5.5',
    );
    assert.match(dialog, /tap-area rounded-md px-2\.5 py-1\.5 text-\[0\.6875rem\]/, '选项必须是紧凑胶囊 + tap-area（触屏兜到 40px）');
    assert.ok(!/min-h-10 px-2 text-\[0\.625rem\] mono-font border/.test(dialog), '不得回到三个割裂的独立方框');
    assert.match(
      dialog,
      /bg-\[var\(--card-bg\)\] text-\[var\(--fg\)\] font-medium border-\[var\(--border\)\]\/50 shadow-xs/,
      '选中态必须是抬起的卡片式胶囊（底色 + 微阴影 + 半透明描边）',
    );
    assert.match(dialog, /text-\[var\(--muted\)\] border-transparent hover:text-\[var\(--fg\)\]/, '未选中态透明描边，避免选中时尺寸跳动');
    // 列表移除后，弹窗只剩「头部 + 图表块 + 脚注」三层，不得再有 flex-1 滚动容器
    assert.doesNotMatch(dialog, /flex-1 overflow-y-auto|overscroll-contain/, '弹窗不得再留多余的垂直滚动区');
  });

  test('读数条：合计 + 各模型绝对值(百分比)，未选中回落最近一天（固定高度防抖）', () => {
    assert.match(dialog, /data-usage-readout="1"/, '读数条必须有稳定标记（供量测与测试定位）');
    assert.match(dialog, /h-12 px-3 flex flex-col justify-center/, '读数条必须是固定高度（悬停/换窗都不抖动）');
    assert.match(dialog, /u\.dayTotal/, '当日数字必须带「合计 / total」标签');
    assert.match(
      dialog,
      /≈\$\{s\.tokens\.toLocaleString\(\)\} \(\$\{s\.sharePct\}%\)/,
      '每段必须同时给绝对值与百分比（方案 B 的读数条强化要求）',
    );
    assert.match(dialog, /reverse\(\)\.find\(\(b\) => b\.hasRecord\)/, '未选中时必须回落到最近一个有记录的日子');
  });

  test('图表呼吸感：X 轴时间标尺（左/中/右 MM-DD）+ 图例色块微圆角', () => {
    assert.match(dialog, /grid grid-cols-3 text-\[0\.625rem\] mono-font/, '底部必须有左/中/右三点时间标尺');
    assert.match(dialog, /axisLabels\[0\]/, '标尺取首日');
    assert.match(dialog, /axisLabels\[1\]/, '标尺取中日');
    assert.match(dialog, /axisLabels\[2\]/, '标尺取末日');
    assert.match(dialog, /day\.length >= 10 \? day\.slice\(5\)/, '标尺只显示 MM-DD');
    const dots = dialog.match(/w-2 h-2 shrink-0 rounded-\[2px\]/g) ?? [];
    assert.ok(dots.length >= 2, `图例色块必须微圆角（模型 + 其他，实测 ${dots.length} 处）`);
  });

  test('按钮去硬描边：AI 窗口重试 / 继续生成 / Quiz 重试统一为轻底色胶囊', () => {
    const ai = readFileSync('src/components/ai/AiAssistant.tsx', 'utf8');
    const pills = ai.match(/rounded-md border border-\[var\(--border\)\]\/80 bg-\[var\(--accent-light\)\] text-\[var\(--fg\)\]/g) ?? [];
    assert.ok(pills.length >= 3, `三处 chip 都要改成轻底色胶囊（实测 ${pills.length} 处）`);
    assert.match(ai, /py-1\.5[^"]*tap-area"\s*>\s*<ChevronsDown/, '继续生成须为紧凑胶囊（py-1.5）+ tap-area 触屏热区 + Lucide 图标');
    assert.match(
      ai,
      /rounded-md border border-\[var\(--border\)\]\/60 bg-\[var\(--error\)\]\/5 px-2\.5 py-2/,
      '错误卡片也去硬边（微质感错误底 + 半透明发丝边）',
    );
  });

  test('文案全部走 i18n（中英齐全），且新文件不含 emoji / 字符符号', () => {
    const keys = [
      'title', 'totalPrefix', 'totalSuffix', 'dayTotal', 'dailyTitle', 'windowAria', 'days7', 'days14', 'days30',
      'a11yChart', 'hint', 'noRecord', 'other', 'modelTotal', 'legacyPrefix', 'legacySuffix', 'empty', 'close',
    ] as const;
    for (const k of keys) {
      assert.ok(translations.zh.usage[k], `usage.${k} 缺少中文`);
      assert.ok(translations.en.usage[k], `usage.${k} 缺少英文`);
    }
    for (const [name, src] of [['TokenUsageChart.tsx', chart], ['TokenUsageDialog.tsx', dialog]] as const) {
      const glyph = src.match(/[✓✗⏱]/);
      assert.equal(glyph, null, `${name} 不得出现字符符号：${glyph?.[0]}`);
      const emoji = src.match(/[\u{1F300}-\u{1FAFF}\u{2705}\u{274C}\u{26A0}]/u);
      assert.equal(emoji, null, `${name} 不得出现 emoji：${emoji?.[0]}`);
    }
  });
});

/* ── AI 设置面板：高度自适应与控件质感（本轮精修守卫） ── */

describe('AI settings panel layout & control polish', () => {
  const ai = readFileSync('src/components/ai/AiAssistant.tsx', 'utf8');

  test('保底高度只服务对话视图：表单视图必须内容自适应，不得再被 62dvh 撑出死区', () => {
    assert.match(
      ai,
      /\$\{view === 'chat' && height === 0 \? ' min-h-\[min\(62dvh,calc\(100dvh-4\.5rem\)\)\]' : ''\}/,
      '面板保底高度必须收紧为「对话视图且未拖过高度」',
    );
    assert.ok(
      !ai.includes("${height > 0 && view === 'chat' ? '' : ' min-h-[min(62dvh,calc(100dvh-4.5rem))]'}"),
      '旧的宽条件（设置视图也吃 62dvh）必须移除，否则高视口下栏下留 184px 死区',
    );
    assert.match(ai, /移动端抽屉|ai-sheet inset-x-0/, '移动端抽屉保高不受影响');
  });

  test('思考强度 = 整体分段滑槽，且不再用符号点表达选中', () => {
    assert.match(
      ai,
      /inline-flex items-center p-0\.5 rounded-lg bg-\[var\(--accent-light\)\]\/70 border border-\[var\(--border\)\]\/60" role="group" aria-label=\{lang === 'zh' \? '思考强度'/,
      '三档必须同槽（整体分段滑槽）',
    );
    assert.match(
      ai,
      /bg-\[var\(--card-bg\)\] text-\[var\(--fg\)\] font-medium border-\[var\(--border\)\]\/50 shadow-xs/,
      '选中档位必须由背景滑块承托',
    );
    assert.ok(!ai.includes("'● '"), '不得再用 ● 字符符号表达选中态');

    // ── 说明只留一行：档位差一句话就够，长度/能力解释收进 title ──
    // 单行说明：三档各有且只有一句
    assert.match(ai, /const TIER_HINT: Record<ThinkingEffort, \{ zh: string; en: string \}> = \{/, '须有档位一句话说明表');
    for (const s of ['禁用思考过程，极速响应，适合查速查表', '适度启发引导，兼顾质量与响应速度（推荐）', '展开完整推理草稿，Token 消耗增加，适合大题推导']) {
      assert.ok(ai.includes(s), `档位说明须为「${s}」`);
    }
    assert.ok(ai.includes('当前模型按服务商默认策略处理。'), '模型无思考旋钮时须给统一口径');
    // 反例：那两段长文案不得回到正文里（在 title/说明表之外出现即为回潮）
    assert.ok(
      !ai.includes('深度思考会给出更充分的启发线索，但 Token 消耗显著增加'),
      '「深度思考会更充分但烧 token」那段长文案已并入档位一句话，不得回潮',
    );
    // 输出上限：单行轻量布局 + 解释进 title
    assert.match(
      ai,
      /输出上限 \(tokens\)：/,
      '输出上限须为单行「输出上限 (tokens)：」+ 输入框',
    );
    assert.match(ai, /w-24 rounded-md border border-\[var\(--border\)\] bg-\[var\(--bg\)\] px-2 py-0\.5 text-xs mono-font/, '输出上限输入框须为 py-0.5 轻量尺寸');
    assert.match(ai, /思考型模型（R1 \/ 思考版千问 \/ 本地模型）的思考也计入这个上限/, '思考型模型解释须保留（收进 title，不得直接删掉）');
    assert.ok(
      !/text-\[0\.625rem\] text-\[var\(--muted\)\] mt-0\.5 leading-snug">\s*\{thinkingPlan\?\.note/.test(ai),
      '模型能力说明不得再单独占一段（应合并进单行说明的 title）',
    );
  });

  test('服务商与筛选 chips = 柔和 Chip：去硬描边、选中态微强调', () => {
    const selected = ai.match(/border-\[var\(--fg\)\]\/25 bg-\[var\(--accent-light\)\] text-\[var\(--fg\)\] font-medium/g) ?? [];
    const unselected = ai.match(/border-transparent text-\[var\(--muted\)\] hover:bg-\[var\(--accent-light\)\]\/60 hover:text-\[var\(--fg\)\]/g) ?? [];
    assert.ok(selected.length >= 8, `选中态柔和 Chip 至少 8 处（实测 ${selected.length}）`);
    assert.ok(unselected.length >= 8, `未选中态去描边 Chip 至少 8 处（实测 ${unselected.length}）`);
    assert.ok(
      !/px-2 py-1 text-\[0\.6875rem\] mono-font border transition-colors/.test(ai),
      '不得残留「1px 硬描边方框」的旧 chip 写法',
    );
    const tap = ai.match(/tap-area (rounded-md|inline-flex)/g) ?? [];
    assert.ok(tap.length >= 8, `chips 必须挂 tap-area 兜触屏 40px（实测 ${tap.length} 处）`);
  });

  test('操作按钮层级：保存实底主操作 / 返回与关闭 ghost / 清除补 40px', () => {
    assert.match(
      ai,
      /onClick=\{save\} className="tap-primary tap-ai-primary rounded-md px-3 py-1\.5 text-xs mono-font font-bold border border-transparent bg-\[var\(--fg\)\] text-\[var\(--bg\)\]/,
      '保存必须是实底主操作（亮色黑底 / 暗色白底）',
    );
    const ghost = ai.match(/tap-primary tap-ai-primary rounded-md px-3 py-1\.5 text-xs mono-font border border-transparent text-\[var\(--muted\)\] transition-colors hover:bg-\[var\(--accent-light\)\] hover:text-\[var\(--fg\)\]/g) ?? [];
    assert.ok(ghost.length >= 3, `返回对话 / 关闭 / 取消 都要是 ghost（实测 ${ghost.length} 处）`);
    assert.match(
      ai,
      /className="ml-auto tap-area inline-flex items-center gap-1 text-\[0\.6875rem\] mono-font text-\[var\(--muted\)\] transition-colors hover:text-\[var\(--fg\)\]"/,
      '清除入口必须保持文字链并补 tap-area（触屏 ≥40px）',
    );
    // ── AI 设置弹窗减重（触屏）：全部只在 .tap-area 上让位，并把省下的高度还给透明伪元素 ──
    //    chips 40→28、思考强度 40→28（外轨 46→34）、设置 Tab 40→29、常用 chips 40→24、
    //    吸底栏 44→36、获取模型/测试连接 29.7→34。桌面无 .tap-area，本来就是自然高，故零回归。
    {
      const css = readFileSync('src/index.css', 'utf8');
      assert.match(css, /\.tap-ai-chip\.tap-area,\s*\.tap-ai-tab\.tap-area \{\s*min-height: 0;/, 'chips/Tab 须解除 40px 地板');
      assert.match(css, /\.tap-ai-tier\.tap-area \{\s*min-height: 1\.75rem;/, '思考强度三档须 28px（外轨随之 34px）');
      assert.match(css, /\.tap-ai-mini\.tap-area \{\s*min-height: 1\.5rem;/, '常用 chips 须 24px');
      assert.match(css, /\.tap-primary\.tap-ai-primary \{\s*min-height: 2\.25rem;/, '吸底栏须 36px');
      // 热区补偿：为减掉的高度补回透明扩区，否则只减不补就是拿触控精度换版式
      assert.match(css, /\.tap-ai-chip\.tap-area::after \{[^}]*top: -4px;[^}]*bottom: -4px;/, 'chips 须补 ±4px 热区（28+8=36）');
      assert.match(css, /\.tap-ai-tier\.tap-area::after \{[^}]*inset: -5px -1px;/, '思考强度须补 ±5px 热区（28+10=38）');
      assert.match(css, /\.tap-ai-text::after \{[^}]*inset: -8px -2px;/, '「查看须知」须补 ±8px 热区（18+16=34）');
      // 行距必须 ≥ 伪元素外扩之和，否则换行后上下两行互压（页脚图标踩过同一个坑）
      assert.match(ai, /flex flex-wrap items-center gap-x-1\.5 gap-y-2 sm:gap-y-1\.5/, 'chips 容器纵向行距须 ≥8px（±4 + ±4），桌面仍 6px');
      // P0：滚动容器底部安全隙，否则内容末段永远落在吸底栏的 69px 带里
      assert.match(ai, /overflow-y-auto overscroll-contain px-4 pt-4 pb-6 space-y-3 text-sm serif-font sm:pb-0/, '设置滚动区须移动端 pb-6（吸底栏安全隙）、桌面仍 pb-0');
      // 三处「只在移动端生效」必须带 max-sm / sm: 前缀，否则桌面盒模型会跟着变（用户要求桌面 100% 冻结）
      assert.match(ai, /whitespace-nowrap max-sm:min-h-\[34px\]/, '辅助按钮的 34px 须限定 max-sm（桌面保持自然高）');
    }

    // 模型行的两个动作按钮：图标语义必须与动作一致，且不得重复「插头」这个身份标。
    // 获取模型 = 重新拉一次清单（RefreshCw，load 时自转）；测试连接 = 探一次活不活（Activity 心跳）。
    assert.match(
      ai,
      /<RefreshCw\s+className=\{`h-3\.5 w-3\.5 shrink-0 \$\{fetching \? 'motion-safe:animate-spin' : ''\}`\}/,
      '「获取模型」须用 RefreshCw（14px）且在请求中自转',
    );
    assert.match(
      ai,
      /<Activity\s+className=\{`h-3\.5 w-3\.5 shrink-0 \$\{testing \? 'motion-safe:animate-pulse' : ''\}`\}/,
      '「测试连接」须用 Activity（心跳波形，14px）',
    );
    // 插头只属于「自定义端点」的身份标（ProviderIcon 里的 Plug 退化），按钮上再用就撞了
    assert.ok(!ai.includes('PlugZap'), '「测试连接」不得再用 PlugZap 插头（与自定义端点的插头标撞车）');
    assert.ok(!/<List className="w-3 h-3"/.test(ai), '「获取模型」不得再用 List（语义是"看列表"，实际动作是"重新拉取"）');
    assert.ok(ai.includes('import { Activity,') || /import \{[^}]*\bActivity\b[^}]*\} from 'lucide-react'/.test(ai), 'Activity 须从 lucide-react 具名引入');
  });
});

/* ── AI 次级控件：视觉实体与触控热区解耦（去臃肿精修守卫） ── */

describe('AI 次级控件：视觉实体 ≤28px 且触屏热区由 tap-area 承托', () => {
  const ai = readFileSync('src/components/ai/AiAssistant.tsx', 'utf8');

  test('全文件零 min-h-10：视觉高度不再被 40px 硬撑', () => {
    assert.doesNotMatch(ai, /min-h-10/, '仍有 min-h-10：桌面端会撑出 40px 方块（应改 py-1.5 + tap-area）');
  });

  test('不再用负外边距伪造紧凑（-m-* 会吃掉 flex 间距，与历史事故同源）', () => {
    assert.doesNotMatch(ai, /-m-[0-9.]+/, '朗读/停止按钮不得再用 -m-1.5 抵消 padding（会吃掉 flex 间距）');
    assert.match(
      ai,
      /tap-area inline-flex items-center justify-center transition-colors p-1\.5/,
      '朗读按钮须改挂 tap-area 兜触屏热区（视觉仍 17px 图标）',
    );
  });

  test('错误卡片：图标 + 文案 + 操作同处一行（横向流式，不再另起一行留白）', () => {
    assert.doesNotMatch(
      ai,
      /bg-\[var\(--error\)\]\/5 px-2\.5 py-2 space-y-1\.5/,
      '错误卡容器不得再用 space-y 竖向堆叠',
    );
    assert.match(
      ai,
      /shrink-0 inline-flex items-center gap-1\.5 px-2\.5 py-1\.5[^"]*tap-area/,
      '重试胶囊须与文案同行（shrink-0）且视觉紧凑',
    );
  });

  test('操作栏 / Prompt chips / 思考折叠：去硬描边、微底色、各带触屏热区', () => {
    // 断言改写说明：推荐追问由「微底色 chip」升级为「细描边交互卡片」后，
    // 原两条断言（微底色计数 ≥2、chip 字符串）断言的正是被替换掉的旧设计，会让改版永远红。
    // 这里保留原意图（复制回答仍为微底色、控件仍承托触屏热区、不得用字符符号），
    // 并把追问项换成新契约：细描边 + 卡片底 + 右侧箭头 + 悬停位移。
    const subtle = ai.match(/border border-transparent bg-\[var\(--accent-light\)\]\/50/g) ?? [];
    assert.ok(subtle.length >= 1, `复制回答须保持微底色（实测 ${subtle.length} 处）`);
    assert.ok(
      // 用纯字符串包含断言：类名里有 [ ] ( ) 等字符，写正则容易在转义上悄悄失配
      ai.includes('group flex w-full items-center justify-between gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2 text-left text-xs leading-snug text-[var(--fg)]'),
      '推荐追问须为细描边卡片、文字左对齐，并挂 tap-area 兜触屏热区',
    );
    assert.match(
      ai,
      /mono-font text-xs text-\[var\(--muted\)\] transition-transform group-hover:translate-x-0\.5 group-hover:text-\[var\(--fg\)\]">→</,
      '追问卡片右侧须有箭头指示（悬停轻微右移并提亮）',
    );
    assert.match(ai, /<RotateCw className="h-3 w-3"/, '「换一批」须带 Lucide 旋转图标，不得用字符符号');
    assert.ok(!ai.includes("'▾ '") && !ai.includes("'▸ '"), '思考折叠不得再用 ▾/▸ 字符符号，应换 Lucide 图标');
    // 守卫升级：原断言是「renderReasoning 之后 900 字符内出现 ChevronDown」——
    // 窗口式断言在头部插任何东西都会红，且对「灯泡呼吸灯」毫无约束。改为先切出 renderReasoning
    // 片段（到下一个 hook 声明为止）再逐条断言，窗口大小不再影响判定。
    const rrStart = ai.indexOf('renderReasoning = (text');
    const rrEnd = ai.indexOf('const [reasoningSec', rrStart);
    assert.ok(rrStart > 0 && rrEnd > rrStart, '思考折叠函数须可定位且未被改名');
    // 注释里会提到被否决的写法（如 animate-pulse），断言前先剥注释，否则守的是注释不是代码
    const rr = ai.slice(rrStart, rrEnd).replace(/\/\*[\s\S]*?\*\//g, '');
    assert.match(rr, /<ChevronDown className=\{`h-3 w-3 shrink-0 transition-transform/, '思考折叠须用 Lucide ChevronDown 表达展开态');
    // 呼吸灯：灯泡在折叠箭头之前（头部最左侧）、14px；正在想＝琥珀黄呼吸，想完＝中性灰静态
    const bulbAt = rr.indexOf('<Lightbulb');
    const chevAt = rr.indexOf('<ChevronDown');
    assert.ok(bulbAt > 0 && bulbAt < chevAt, '灯泡须位于折叠箭头之前（头部最左侧）');
    assert.ok(rr.includes('h-3.5 w-3.5 shrink-0 text-[var(--warn)] bulb-breathe'), '思考中须为琥珀黄（--warn 令牌）+ 呼吸');
    assert.ok(rr.includes('h-3.5 w-3.5 shrink-0 text-[var(--muted)]'), '思考结束须回中性灰静态（不抢正文视线）');
    // 呼吸用自建键帧而非 animate-pulse：后者 1→0.5 会把浅色主题的琥珀洗成浅金
    const cssBulb = readFileSync('src/index.css', 'utf8');
    assert.match(cssBulb, /@keyframes bulb-breathe \{\s*0%, 100% \{ opacity: 1; \}\s*50% \{ opacity: 0\.72; \}/, '呼吸键帧须为 1→0.72（保住黄色可辨性）');
    assert.match(cssBulb, /\.bulb-breathe \{ animation: bulb-breathe 1\.8s ease-in-out infinite; \}/, '呼吸周期须 1.8s（1.5–2s 区间）');
    assert.match(cssBulb, /prefers-reduced-motion: reduce\) \{\s*\.bulb-breathe \{ animation: none; opacity: 1; \}/, '减少动效下须停呼吸并回满不透明');
    assert.ok(!rr.includes('animate-pulse'), '灯泡不得再用 animate-pulse（透明度压到 0.5，浅色下黄色失真）');
    // 两个分支必须是互斥整串：同时挂 text-[var(--warn)] 与 text-[var(--muted)] 时，
    // 谁生效取决于 Tailwind 产出的 CSS 顺序（不是 class 书写顺序），等于把颜色交给运气
    assert.doesNotMatch(rr, /text-\[var\(--muted\)\][^'"`]*text-\[var\(--warn\)\]/, '灯泡颜色不得靠类名叠加实现');
    assert.ok(!rr.includes('text-amber') && !/text-\[#[0-9a-f]{3,8}\]/i.test(rr), '黄色须走 --warn 令牌，不得用调色板色或写死色值（深色主题会失真）');
    // 耗时口径：思考中不得出现任何秒数（旧版写「约 ${sec}s」而 sec 恒为 0 → 界面宣称「想了 0 秒」）
    assert.ok(rr.includes('正在思考 · ${text.length} 字'), '思考中须为语义化提示（正在思考 · N 字）');
    assert.ok(rr.includes('首字约 ${sec}s · ${text.length} 字'), '定稿后口径须为「首字约 Ns」（测的是首包时间，不是纯思考时长）');
    assert.doesNotMatch(rr.replace(/\/\*[\s\S]*?\*\//g, ''), /（约 \$\{sec\}s \(≈\$\{sec\}s/, '旧写法「约 Ns」不得回潮（口径已改为「首字约 Ns」）');
    assert.ok(rr.includes('const settled = sec > 0'), '思考/定稿必须由 sec 是否定稿来分派（sec=0 即未定稿）');
    assert.ok(
      rr.includes("id === 'live' && reasoningStreaming"),
      '只有「当前轮且思考仍在推进」才呼吸：历史轮次与正文流式阶段都必须静止',
    );
    // 呼吸的起停在状态机里落点必须齐备，缺一个就会出现「一直闪」或「不闪」
    assert.match(ai, /setReasoningStreaming\(true\); \/\/ 首个思考增量/, '首个思考增量须点亮呼吸灯');
    assert.match(ai, /setReasoningStreaming\(false\); \/\/ 思考到此结束/, '正文首包须停止呼吸');
    assert.match(ai, /setReasoningStreaming\(false\); \/\/ 收尾兜底/, '请求收尾（含失败/中止）须停止呼吸');
  });

  test('尺寸规范：主胶囊内边距统一 px-2.5 py-1.5 + leading-none（≈26–28px 视觉）', () => {
    const pills = ai.match(/px-2\.5 py-1\.5 text-\[0\.6875rem\] mono-font leading-none/g) ?? [];
    assert.ok(pills.length >= 3, `三处主胶囊须统一（实测 ${pills.length}）`);
  });
});

describe('主标题真字重宋体与品牌字体子集', () => {
  const css = readFileSync('src/index.css', 'utf8');

  test('衬线栈：现代 CJK 宋体真名在前，Georgia 退居兜底', () => {
    const m = css.match(/--f-serif:\s*([^;]+);/);
    assert.ok(m, '未能读取 --f-serif 声明');
    const stack = m[1].trim();
    assert.ok(stack.startsWith("'Noto Serif CJK SC'"), `栈首须是 'Noto Serif CJK SC'，实际 ${stack.slice(0, 44)}`);
    assert.ok(
      stack.indexOf("'Noto Serif CJK SC'") < stack.indexOf("'Georgia'"),
      'Georgia 须排在真名之后（其无 CJK 字形，此前占首位会先吃掉所有拉丁与标点）',
    );
    for (const fam of ["'Noto Serif SC'", "'Source Han Serif SC'", "'Songti SC'", "'STSong'", "'SimSun'"]) {
      assert.ok(stack.includes(fam), `衬线栈缺少兜底家族 ${fam}`);
    }
  });

  test('品牌子集资产存在且体积控制在 3~12KB', () => {
    const p = 'public/fonts/stem-lab-serif-medium.woff2';
    assert.ok(existsSync(p), '品牌子集 woff2 缺失');
    const size = readFileSync(p).length;
    assert.ok(size >= 3 * 1024 && size <= 12 * 1024, `子集体积须在 3~12KB，实测 ${size} bytes`);
  });

  test('品牌子集是合法 woff2 且附带 OFL 许可声明', () => {
    const buf = readFileSync('public/fonts/stem-lab-serif-medium.woff2');
    assert.equal(buf.subarray(0, 4).toString('latin1'), 'wOF2', 'woff2 magic 不正确');
    const ofl = readFileSync('public/fonts/OFL.txt', 'utf8');
    assert.match(ofl, /SIL Open Font License/i, 'OFL 许可文件缺少许可声明');
    assert.match(ofl, /stem-lab-serif-medium\.woff2/, 'OFL 许可文件须点名该字体资产');
  });

  test('@font-face 只作用于 h1.t-hero，不得污染 .serif-font（避免字形混排割裂）', () => {
    assert.match(css, /@font-face\s*\{[^}]*font-family:\s*'STEM Lab Serif'[^}]*\}/, '@font-face 未声明品牌字体');
    assert.match(css, /src:\s*url\('\/fonts\/stem-lab-serif-medium\.woff2'\)\s*format\('woff2'\)/, '品牌字体 src 指向错误');
    assert.match(css, /h1\.t-hero\s*\{\s*font-family:\s*var\(--f-brand\),\s*var\(--f-serif\)/, 'h1.t-hero 未绑定品牌字体');
    assert.doesNotMatch(css, /\.serif-font\s*\{[^}]*STEM Lab Serif/, '.serif-font 不得使用品牌子集');
  });

  test('index.html 预渲染 h1 使用同一套衬线栈（避免慢加载先闪黑体）', () => {
    const html = readFileSync('index.html', 'utf8');
    const m = html.match(/<h1 style="[^"]*font-family:\s*([^"]+)"/);
    assert.ok(m, '预渲染 h1 未声明 font-family');
    assert.ok(m[1].includes('Noto Serif CJK SC'), `预渲染 h1 衬线栈须含真名，实际 ${m[1].slice(0, 48)}`);
  });
});

describe('使用说明页容器化重构（文案逐字不动）', () => {
  const guide = readFileSync('src/pages/GuidePage.tsx', 'utf8');
  const copyMatch = guide.match(/const copy = \{[\s\S]*?\n\};/);
  const copyBlock = copyMatch ? copyMatch[0] : '';
  const renderBlock = copyBlock ? guide.slice(guide.indexOf(copyBlock) + copyBlock.length) : guide;

  test('页面容器统一 max-w-5xl，视频升级为 figure 展台', () => {
    assert.match(guide, /mx-auto w-full max-w-5xl/, '缺少统一的页面容器');
    assert.match(guide, /<figure className="mb-10 rounded-xl border[^"]*p-2[^"]*">/, '视频未升级为 figure 展台');
    assert.match(guide, /relative aspect-video w-full overflow-hidden rounded-lg bg-\[var\(--bg\)\]/, '视频内层 16:9 容器缺失');
    assert.doesNotMatch(guide, /max-w-2xl/, '头部/视频不应再各自 max-w-2xl（宽度须与栅格统一）');
  });

  test('七个区块卡片化，且不再用裸 border-t 平铺', () => {
    const cards = guide.match(/rounded-lg border border-\[var\(--border\)\] bg-\[var\(--card-bg\)\] (?:p-4|px-4 py-3|p-5 sm:p-6)/g) ?? [];
    assert.ok(cards.length >= 7, `卡片化区块须 ≥7（含 AI 卡新内边距与尾部轻量面板），实测 ${cards.length}`);
    assert.doesNotMatch(guide, /border-t border-\[var\(--border\)\] pt-4/, '不应再有裸 border-t 分区');
  });

  test('行宽收口：全文不再有 38em/36rem/46em 死限宽，仅容器级 max-w-5xl', () => {
    assert.doesNotMatch(guide, /max-w-\[38em\]/, '38em 死限宽须全部清除（半幅卡内本就无效）');
    assert.doesNotMatch(guide, /max-w-\[36rem\]/, '旧的 36rem 行宽须全部替换');
    assert.doesNotMatch(guide, /max-w-\[46em\]/, '46em 死限宽须清除，尾部面板改为 flex-1 撑满容器');
    assert.match(guide, /text-\[var\(--muted\)\] w-full">\{c\.intro\}/, 'header 首段须 w-full 自适应撑满');
    assert.match(guide, /<div className="mb-5 w-full">/, 'AI 首段容器须 w-full 撑满卡片内容区');
    assert.match(
      guide,
      /min-w-0 flex-1 text-sm serif-font leading-relaxed text-\[var\(--muted\)\]">\{c\.privacyText\}/,
      '尾部辅助面板正文须 flex-1 撑满剩余宽度',
    );
    // 全页只允许「容器控宽」：不得存在任何子级任意值限宽（子级文本一律撑满容器 padding）
    const arbitrary = guide.match(/max-w-\[[^\]]+\]/g) ?? [];
    assert.deepEqual(
      arbitrary,
      [],
      `GuidePage 不得再有子级任意值死限宽，实测 ${JSON.stringify(arbitrary)}`,
    );
    assert.match(guide, /mx-auto w-full max-w-5xl/, '页面容器须保留 max-w-5xl 统一控宽');
  });

  test('常见操作：与错题集共用同一套胶囊规范，标签剥离冒号', () => {
    const pill = /rounded border border-\[var\(--border\)\]\/40 bg-\[var\(--accent-light\)\] px-2 py-0\.5 text-xs font-medium leading-normal text-\[var\(--fg\)\]/g;
    const hits = guide.match(pill) ?? [];
    assert.ok(hits.length >= 2, `错题集与常见操作须共用同一胶囊类（≥2 处），实测 ${hits.length}`);
    assert.match(guide, /\{c\.controlsList\.map\(\(item\) => \{/, '常见操作须由纯文本改为结构化映射');
    assert.match(
      guide,
      /const inline = at > 0 && at <= 8;[\s\S]{0,600}min-w-0 text-\[var\(--muted\)\]">\{rest\}<\/span>/,
      '常见操作须走与错题集一致的非冒号「标签 / 说明」拆分',
    );
  });

  test('文案微调：仅表笔一条按裁决中英同步更新', () => {
    const copySrc = (guide.match(/const copy = \{[\s\S]*?\n\};/) ?? [''])[0];
    assert.ok(copySrc.includes('表笔：拖到正确的测量点'), '中文表笔文案未按裁决更新');
    assert.ok(!copySrc.includes('拖到合法测量位置'), '中文旧表笔文案须已移除');
    assert.ok(copySrc.includes('Probes: Drag to correct measurement points'), '英文表笔文案未按裁决更新');
    assert.ok(!copySrc.includes('drag to a legal measurement point'), '英文旧表笔文案须已移除');
  });

  test('卡片重排：基本流程+教师建议 / 三幕式+常见操作，栅格 items-start 收拢矮卡', () => {
    assert.match(guide, /grid gap-5 sm:gap-6 md:grid-cols-2 md:items-start/, '栅格须加 md:items-start 让矮卡随内容收拢');
    const order = ['{c.flow}', '{c.teaching}', '{c.inquiry}', '{c.controls}'].map((k) => guide.indexOf('// ' + k));
    assert.ok(order.every((v) => v > 0), '四张半幅卡标题须齐备');
    assert.deepEqual(order, order.slice().sort((a, b) => a - b), '卡片顺序须为 基本流程 → 教师建议 → 三幕式 → 常见操作（桌面两列即两行配对）');
  });

  test('AI 条款：纯语义图标 + 标题垂直居中（无数字序号冗余）', () => {
    assert.match(guide, /const TERM_ICONS = \[Coins, ShieldCheck, BookOpen, Scale\]/, '条款语义图标表缺失或顺序不符');
    assert.match(
      guide,
      /<Icon className="w-4 h-4 shrink-0 text-\[var\(--fg\)\]" aria-hidden="true" \/>/,
      '条款图标须为 w-4 h-4 + 语义色 + aria-hidden',
    );
    assert.doesNotMatch(guide, /rounded-full bg-\[var\(--accent-light\)\] text-\[0\.625rem\]/, '灰色数字圆圈徽章须彻底废除');
    assert.doesNotMatch(guide, /\{i \+ 1\}\./, '条款标题不得再有「1.」式阿拉伯数字序号');
    assert.match(
      guide,
      /<p className="flex items-center gap-2 mb-1\.5 text-\[var\(--fg\)\]">/,
      '标题容器须为 flex items-center gap-2 mb-1.5（图标与标题垂直居中）',
    );
    assert.match(guide, /<strong className="font-bold">\{t\.title\}<\/strong>/, '标题须为纯文本（无序号前缀）');
    assert.match(guide, /<p className="pl-6">\{t\.body\}<\/p>/, '正文须置于下方并与标题左缘对齐');
  });

  test('AI 首段：按句末标点分句流式排版，且拼接后与原文逐字节一致', () => {
    assert.match(guide, /splitSentences\(c\.aiIntro\)\.map\(/, '首段须走分句渲染，不得整块平铺');
    const re = /aiIntro: '([^']*)'/g;
    const intros: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(guide)) !== null) {
      intros.push(m[1]);
    }
    assert.ok(intros.length >= 2, `须取到中英两段首段（实测 ${intros.length}）`);
    for (const s of intros) {
      assert.equal(splitSentences(s).join(''), s, `分句破坏了字符：${s.slice(0, 24)}`);
    }
    assert.ok(splitSentences(intros[0]).length >= 2, '中文首段应拆出多句以消解整块压迫感');
    for (const s of ['无句末标点结尾', '', 'A.B; C。']) {
      assert.equal(splitSentences(s).join(''), s, `分句在边界样本上破坏字符：${s}`);
    }
  });

  test('错题集：微底标签 + 去冒号 + 键值化 + 桌面双列列优先栅格', () => {
    assert.match(guide, /item\.search\(\/\[：:\]\/\)/, '缺少冒号探测逻辑');
    assert.match(guide, /at <= 8/, '缺少中文短引子长度判定（≤8 字才同排）');
    assert.match(guide, /const lead = at > 0 \? item\.slice\(0, at\) : '';/, '标签须剔除分隔冒号（中英文冒号均不展示）');
    assert.doesNotMatch(guide, /item\.slice\(0, at \+ 1\)/, '标签不得再带上冒号');
    assert.match(
      guide,
      /rounded border border-\[var\(--border\)\]\/40 bg-\[var\(--accent-light\)\] px-2 py-0\.5 text-xs font-medium/,
      '标签须为微底描边胶囊且字重克制（medium）',
    );
    assert.match(
      guide,
      /<ul className="grid gap-x-8 gap-y-3 md:grid-flow-col md:grid-cols-2 md:grid-rows-3">/,
      '5 个步骤须在桌面端按列优先双列流式排布',
    );
    assert.match(guide, /flex text-sm serif-font leading-relaxed/, '条目行高须为 leading-relaxed');
  });

  test('卡片平衡：三张通栏卡 + 尾部轻量面板（不再等高拉伸出空洞）', () => {
    assert.match(guide, /<ul className="grid gap-x-8 gap-y-4 md:grid-cols-2">/, '条款须桌面 2×2 栅格');
    const code = guide.replace(/\/\*[\s\S]*?\*\//g, '');
    const spans = code.match(/md:col-span-2/g) ?? [];
    assert.equal(spans.length, 3, `AI 卡 + 错题集 + 反馈面板应恰为 3 处通栏（注释不计），实测 ${spans.length}`);
    assert.match(
      guide,
      /px-4 py-3 md:col-span-2/,
      '反馈与隐私须为紧凑内边距的通栏轻量面板（禁止与高卡片等高拉伸）',
    );
    assert.match(
      guide,
      /flex flex-col gap-1\.5 md:flex-row md:items-baseline md:gap-4/,
      '轻量面板桌面端须标签与正文同排一行',
    );
  });

  test('图标纪律：严禁 Emoji 与字符符号替代图标', () => {
    assert.doesNotMatch(guide, /[\u{1F300}-\u{1FAFF}]/u, '不得出现 Emoji');
    assert.doesNotMatch(guide, /[✓✗⏱▾▸●★☆]/u, '不得出现字符符号代替图标');
  });

  test('文案零改动①：JSX 渲染段不得出现任何中文硬编码（注释与路由 meta 除外）', () => {
    const jsx = renderBlock.slice(renderBlock.indexOf('return ('));
    const noComments = jsx.replace(/\/\*[\s\S]*?\*\//g, '');
    const cjk = noComments.match(/[\u4e00-\u9fa5]+/g) ?? [];
    assert.deepEqual(cjk, [], `JSX 段出现中文硬编码：${cjk.join(' / ')}`);
  });

  test('文案零改动②：全部 c.* 引用与原始文案字符串逐条仍在', () => {
    const refs = [
      'c.backHome', 'c.title', 'c.intro', 'c.flow', 'c.steps', 'c.inquiry', 'c.acts', 'c.controls',
      'c.controlsList', 'c.teaching', 'c.teachingText', 'c.ai', 'c.aiIntro', 'c.aiTermsTitle',
      'c.aiTerms', 'c.mistakes', 'c.mistakesList', 'c.privacy', 'c.privacyText',
    ];
    for (const ref of refs) {
      assert.ok(guide.includes(ref), `缺少文案引用 ${ref}`);
    }
    // 说明页标签文案已按用户裁决精简：仅标签词变化，其余文案逐字不动
    const strings = [
      '自动收集：', '学情分析：', '组卷导出：', '卷面排版：', '打印保存：',
      '服务性质与费用', '数据与隐私安全', '学习辅助声明', '合规与责任限制',
    ];
    for (const s of strings) {
      assert.ok(copyBlock.includes(s), `标签/条款文案丢失或被改写：${s}`);
    }
    for (const old of ['怎么收集：', '学情概览：', '怎么导出：', '打印与保存：']) {
      assert.ok(!copyBlock.includes(old), `旧口语化标签「${old}」应已被精简替换`);
    }
    assert.ok(guide.includes('数理化数字实验室'), '路由标题里的品牌名须仍在');
  });
});

describe('化学模块高危边界加固（动画连续性 / 量程钳位 / 题库认知平衡）', () => {
  // 先剥注释再断言：注释里的示例文本曾两次把守卫误伤
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');

  test('P1-1 动画插值起点取「当前渲染值」，不得再存「上一个目标」', () => {
    const pairs = [
      ['BalanceScale.tsx', strip(readFileSync('src/components/lab/BalanceScale.tsx', 'utf8'))],
      ['Neutralization.tsx', strip(readFileSync('src/labs/chemistry/Neutralization.tsx', 'utf8'))],
    ] as const;
    for (const [name, src] of pairs) {
      assert.match(src, /currentRef/, `${name}: 插值须用 currentRef 记录当前实际渲染值`);
      assert.match(
        src, /currentRef\.current\s*=\s*next/,
        `${name}: 每一帧都要把实际输出写回 currentRef，否则目标在途反转时仍会帧级瞬移`,
      );
      assert.doesNotMatch(
        src, /fromRef\.current\s*=\s*to\b/,
        `${name}: 不得把「上一个目标值」当作动画起点（实测单帧硬跳 4.85° / 19px 的根因）`,
      );
    }
  });

  test('P1-2 阻尼输出量程钳位：全时域扫描绝不越出 ±10°（且钳位是承重的）', () => {
    const MAX = 10;
    let rawWorst = 0;   // 全域最坏（±10 往返回转）的未钳位峰值
    let rawUnit = 0;    // 0 → MAX 单程的未钳位峰值，用于核对 OVERSHOOT 系数
    for (const from of [-MAX, -8, 0, 8, MAX]) {
      for (const to of [-MAX, -8, 0, 8, MAX]) {
        for (let i = 0; i <= 400; i++) {
          const t = i / 400;
          const out = dampedAngleAt(from, to, t);
          assert.ok(Number.isFinite(out), `from=${from} to=${to} t=${t}: 输出非有限值`);
          assert.ok(
            Math.abs(out) <= MAX + 1e-9,
            `from=${from} to=${to} t=${t}: 输出 ${out.toFixed(3)}° 越出量程 ±${MAX}°（指针会冲出分度盘）`,
          );
          const env = Math.exp(-4.2 * t);
          const g = 1 - env * Math.cos(6.4 * Math.PI * t);
          rawWorst = Math.max(rawWorst, Math.abs(from + (to - from) * g));
          if (from === 0 && to === MAX) rawUnit = Math.max(rawUnit, (to - from) * g);
        }
      }
    }
    // 钳位必须「真在起作用」：未钳位的原始曲线本就超调（全域最坏可达 20.6°），否则本断言毫无意义
    assert.ok(
      rawWorst > MAX,
      `原始阻尼曲线应有超调（实测最坏 ${rawWorst.toFixed(3)}°），否则钳位断言失去意义`,
    );
    // OVERSHOOT 是「单程 0→MAX 的峰值倍数」，不是「全域最坏倍数」——两者相差 (1+OVERSHOOT) 倍
    assert.ok(
      Math.abs(OVERSHOOT * MAX - rawUnit) < 0.05,
      `OVERSHOOT=${OVERSHOOT} 与实测单程峰值 ${rawUnit.toFixed(4)}° 不符（应 ≈ ${(OVERSHOOT * MAX).toFixed(2)}°）`,
    );
  });

  test('P2-3 分度盘刻度落在指针真实可达域内', () => {
    const balance = readFileSync('src/components/lab/BalanceScale.tsx', 'utf8');
    const ticks = balance.match(/\[\s*(-?\d+(?:\.\d+)?(?:\s*,\s*-?\d+(?:\.\d+)?)+)\s*\]\.map/);
    assert.ok(ticks, '未找到分度盘刻度数组');
    const abs = ticks[1].split(',').map((x) => Math.abs(Number(x.trim())));
    const ptr = balance.match(/x2=\{CX\}\s+y2=\{CY \+ (\d+(?:\.\d+)?)\}/);
    assert.ok(ptr, '未找到指针长度（y2={CY + n}）');
    const reach = Number(ptr[1]) * Math.sin((10 * Math.PI) / 180);
    assert.ok(
      Math.max(...abs) <= reach + 0.5,
      `最外刻度 ±${Math.max(...abs)}px 超出指针可达 ${reach.toFixed(2)}px —— 外侧刻度会变成「一生读不到」的装饰`,
    );
  });

  test('P2-1 减动效：凡用 rAF 逐帧改坐标的实验室文件必须自查 prefers-reduced-motion', () => {
    // 全局 @media(prefers-reduced-motion) 的 * 级兜底只压 CSS 动画/过渡，覆盖不到 rAF
    const files = [
      'src/labs/chemistry/Electrolysis.tsx',
      'src/labs/chemistry/Neutralization.tsx',
      'src/components/lab/BalanceScale.tsx',
      'src/components/lab/MicroAnimation.tsx',
    ];
    for (const f of files) {
      const src = strip(readFileSync(f, 'utf8'));
      assert.match(src, /requestAnimationFrame/, `${f} 已不再使用 rAF —— 请同步更新本守卫清单`);
      assert.match(
        src, /prefers-reduced-motion/,
        `${f} 用 rAF 驱动动画却未判断 prefers-reduced-motion`,
      );
    }
  });

  /* ── 题库认知平衡：长度收敛 + 位置均摊 ── */
  const braceBlock = (src: string, marker: string): string => {
    const i = src.indexOf('{', src.indexOf(marker));
    assert.ok(i >= 0, `未找到 ${marker}`);
    let d = 0;
    for (let j = i; j < src.length; j++) {
      if (src[j] === '{') d++;
      else if (src[j] === '}') {
        d--;
        if (d === 0) return src.slice(i, j + 1);
      }
    }
    throw new Error(`括号不平衡：${marker}`);
  };
  // 单引号与双引号都要覆盖 —— 只匹配单引号会把双引号写的文案误报为「缺失」
  const kvMap = (b: string): Record<string, string> => {
    const out: Record<string, string> = {};
    const re = /(\w+):\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(b))) out[m[1]] = m[2] !== undefined ? m[2] : m[3];
    return out;
  };
  type OptionsMap = Record<string, ReadonlyArray<readonly [string, string]>>;
  const LABS_QUIZ = [
    { file: 'Electrolysis.tsx', options: EL_OPTIONS as unknown as OptionsMap, correct: EL_CORRECT },
    { file: 'MassConservation.tsx', options: MASS_OPTIONS as unknown as OptionsMap, correct: MASS_CORRECT },
    { file: 'MetalActivity.tsx', options: METAL_OPTIONS as unknown as OptionsMap, correct: METAL_CORRECT },
    { file: 'Neutralization.tsx', options: NEUT_OPTIONS as unknown as OptionsMap, correct: NEUT_CORRECT },
  ];

  test('题库① 选项长度收敛：任一题任一语种 max/min ≤ 1.15（破「最长项即正解」）', () => {
    let checked = 0;
    for (const lab of LABS_QUIZ) {
      const src = readFileSync(`src/labs/chemistry/${lab.file}`, 'utf8');
      const cb = braceBlock(src, 'const copy = {');
      const maps = { zh: kvMap(braceBlock(cb, 'zh: {')), en: kvMap(braceBlock(cb, 'en: {')) };
      for (const [q, pairs] of Object.entries(lab.options)) {
        assert.ok(pairs.length >= 2, `${lab.file} ${q}: 选项数异常`);
        for (const lang of ['zh', 'en'] as const) {
          const texts = pairs.map(([, lk]) => {
            const t = maps[lang][lk];
            assert.ok(t != null, `${lab.file} ${q}: 文案键 ${lk} 在 copy.${lang} 缺失（解析失效或数据损坏）`);
            return t;
          });
          const L = texts.map((t) => [...t].length);
          const ratio = Math.max(...L) / Math.min(...L);
          assert.ok(
            ratio <= 1.15,
            `${lab.file} ${q} [${lang}] 选项长度比 ${ratio.toFixed(3)} > 1.15（${L.join('/')}）——「谁最长谁是答案」的破绽会回归`,
          );
          assert.ok(
            new Set(texts).size === texts.length,
            `${lab.file} ${q} [${lang}] 同一题内出现重复选项文案`,
          );
          checked++;
        }
      }
    }
    assert.ok(checked >= 38, `应覆盖 19 题 × 2 语种 = 38 组，实测仅 ${checked} 组（解析可能漏题）`);
  });

  test('题库② 正解位置均摊：A/B/C 各约 1/3，「一律选同一项」不得高于随机基线', () => {
    const positions: number[] = [];
    for (const lab of LABS_QUIZ) {
      for (const [q, pairs] of Object.entries(lab.options)) {
        const corr = lab.correct[q];
        assert.ok(corr, `${lab.file} ${q}: 缺少判题键`);
        const vals = pairs.map(([v]) => v);
        const idx = vals.findIndex((v) => corr.includes(v));
        assert.ok(idx >= 0, `${lab.file} ${q}: 正确值 ${corr.join(',')} 不在选项值域 ${vals.join(',')} 内`);
        positions.push(idx);
      }
    }
    const n = positions.length;
    assert.ok(n === 19, `四实验题目总数应为 19，实测 ${n}`);
    const counts = [0, 1, 2].map((i) => positions.filter((p) => p === i).length);
    for (let i = 0; i < 3; i++) {
      const share = counts[i] / n;
      assert.ok(
        share >= 0.25 && share <= 0.40,
        `正解落在第 ${i + 1} 位的占比 ${(share * 100).toFixed(1)}%（${counts[i]}/${n}）越界——目标约 33%，实测分布 ${counts.join('/')}`,
      );
    }
    // 随机基线 = 各题 1/选项数 的均值（本题库实测 36.0%）；「无脑同选」不得高过它
    const dumbest = Math.max(...counts) / n;
    assert.ok(
      dumbest <= 0.40,
      `「一律选同一项」最高可得 ${(dumbest * 100).toFixed(1)}%，仍显著高于随机基线 36.0%`,
    );
  });
});

describe('周期表：离线包行内化 / 展台去硬包裹 / 3D 空间模型', () => {
  const pt = readFileSync('src/pages/PeriodicTable.tsx', 'utf8');
  /** 取 [from, until) 之间的源码片段（体积与类名断言的统一取法） */
  const sliceTo = (from: string, until: string) => {
    const i = pt.indexOf(from);
    assert.ok(i > 0, `未找到锚点：${from}`);
    const j = pt.indexOf(until, i);
    assert.ok(j > i, `未找到闭合：${until}`);
    return pt.slice(i, j);
  };

  test('① 离线教学包已收敛为紧贴「中考跟读」的行内纯图标按钮', () => {
    const btn = sliceTo('onClick={() => setShowPack(true)}', '</button>');
    assert.match(btn, /title=\{/, '行内图标按钮须有 title 悬停提示');
    assert.match(btn, /t\.offlinePack\.entryHint/, 'title 须写明离线教学包的用途');
    assert.match(btn, /aria-label=\{t\.offlinePack\.entry\}/, '纯图标按钮须有 aria-label 兜底');
    assert.match(btn, /HardDrive className="w-4 h-4/, '图标须为紧凑尺寸 w-4 h-4');
    assert.doesNotMatch(btn, /border border-\[var\(--border\)\] px-2\.5 py-1\.5/, '不得再是带边框的实体按钮');
    assert.ok(btn.length < 800, `行内图标按钮片段 ${btn.length} 字符，疑似残留实体按钮`);
    const panel = pt.indexOf('recite-panel');
    const pack = pt.indexOf('onClick={() => setShowPack(true)}');
    assert.ok(panel > 0 && pack > panel, '离线包入口须移入跟读面板内部');
    assert.ok(pack < pt.indexOf('声音选择'), '离线包入口须紧贴「中考跟读」标题（位于声音选择之前）');
    assert.doesNotMatch(pt.slice(panel, pack), /flex flex-wrap items-center gap-2/, '不得再被独立整行容器包裹');
    assert.ok(
      pt.includes('{showPack && <OfflinePackPanel onClose={() => setShowPack(false)} />}'),
      '离线包弹窗触发逻辑须保持不变',
    );
  });

  test('② 中央展台容器无硬边框 / 重底色 / 投影 / 卡片壳', () => {
    const hero = sliceTo('col-start-3 col-end-13 row-start-1 row-end-4', '>');
    assert.doesNotMatch(hero, /border/, '展台容器不得含边框类');
    assert.doesNotMatch(hero, /bg-\[var\(--card-bg\)\]/, '展台容器不得含实体卡片底色');
    assert.doesNotMatch(hero, /shadow/, '展台容器不得含投影');
    assert.doesNotMatch(hero, /rounded/, '展台容器不得含圆角卡片壳');
    assert.doesNotMatch(hero, /overflow-hidden/, '展台容器不得含裁切');
    assert.match(hero, /relative/, '须保留 relative（两态叠层依赖）');
    assert.ok(pt.includes("heroFocus ? 'opacity-0' : 'opacity-100'"), '图例态须只做透明度过渡');
    assert.ok(pt.includes("heroFocus ? 'opacity-100' : 'opacity-0'"), '悬停/检索态须只做透明度过渡');
  });

  test('③ 详情卡支持 2D / 3D 切换且默认恒为 2D 课本规范', () => {
    assert.match(pt, /const \[atomMode, setAtomMode\] = useState<'2d' \| '3d'>\('2d'\)/, '默认视图须为 2D');
    assert.match(pt, /useEffect\(\(\) => \{ setAtomMode\('2d'\); \}, \[selected\?\.n\]\)/, '换元素须强制复位为 2D');
    // 控件形态（2026-10 改版）：由「左上整行双段控件」收敛为「图区外框右上角单个幽灵按钮」
    assert.match(pt, /data-atom-mode=\{atomMode\}/, '切换按钮须带 data-atom-mode（供渲染量测）');
    assert.match(pt, /absolute top-1 right-1 z-10/, '切换按钮须绝对定位于图区内部右上角，不占布局行');
    // 文案只描述「点下去会发生什么」，消除「2D 规范」既像状态标识又像操作按钮的歧义
    assert.ok(
      pt.includes("atomMode === '3d' ? (isZh ? '课本平面' : 'Flat view') : (isZh ? '3D 模型' : '3D model')"),
      '按钮文案须用动作语义（2D 态「3D 模型」/ 3D 态「课本平面」）',
    );
    for (const stale of ['3D 空间', '2D 规范', "'2D textbook'", "'3D space'"]) {
      assert.ok(!pt.includes(stale), `旧歧义文案「${stale}」须已清除`);
    }
    assert.doesNotMatch(pt, /role="group" aria-label=\{isZh \? '原子模型视图'/, '双段控件须已移除（不得再有 role=group 分段组）');
    assert.ok(pt.includes("// {isZh ? '原子结构示意图' : 'Bohr model'}"), '左上须只保留单行小标题「// 原子结构示意图」');
    assert.doesNotMatch(pt, /原子结构示意图（点击电子层查看电子数）/, '小标题不得再挂长括注（须收敛为单行）');
    assert.match(pt, /atomMode === '2d' \? \(/, '须按 atomMode 分支渲染');
    assert.match(pt, /<Atom3D[\s\S]{0,260}z=\{selected\.n\}/, 'Atom3D 须接收真实质子数 Z');
    assert.match(pt, /n=\{particleCount\(selected\)\.neutrons\}/, 'Atom3D 中子数须走 particleCount（与看板同源）');
    assert.match(pt, /highlight=\{layerHighlight\(selected\)\}/, '3D 须与电子层胶囊高亮联动');
    assert.ok(pt.includes('+{selected.n}'), '2D 核内「+Z」圈须仍在（中考必考画法，不得因引入 3D 而破坏）');
  });

  test('④ 3D 视图为原生 Canvas 2D，零外部 3D 库', () => {
    const comp = readFileSync('src/components/lab/Atom3D.tsx', 'utf8');
    const math = readFileSync('src/lib/atom-3d.ts', 'utf8');
    assert.match(comp, /getContext\('2d'\)/, '须为原生 Canvas 2D');
    // 组件与纯数学模块都不得出现 3D 库
    for (const [name, src] of [['Atom3D.tsx', comp], ['atom-3d.ts', math]] as const) {
      assert.doesNotMatch(src, /from\s+['"](three|@?babylonjs|@react-three\/[a-z-]+|zdog|o3d)/i, `${name} 不得引入外部 3D 库`);
      assert.doesNotMatch(src, /WebGL|THREE\.|createRenderer/, `${name} 不得走 WebGL / THREE 命名空间`);
    }
    const pkg = readFileSync('package.json', 'utf8');
    assert.doesNotMatch(
      pkg,
      /"(three|@react-three\/[a-z-]+|@babylonjs\/[a-z-]+|babylonjs|zdog|o3d)"\s*:/,
      'package.json 不得出现 3D 库依赖',
    );
    // 斐波那契球面点阵：点数正确、逐点落在单位球面上、互不重合
    for (const count of [1, 2, 8, 118, 294]) {
      const pts = fibonacciSphere(count);
      assert.ok(pts.length === count, `fibonacciSphere(${count}) 点数应为 ${count}`);
      for (const p of pts) {
        if (count === 1) continue;
        const len = Math.hypot(p.x, p.y, p.z);
        assert.ok(Math.abs(len - 1) < 1e-6, `斐波那契点须在单位球面上：|p|=${len}`);
      }
      const uniq = new Set(pts.map((p) => `${p.x.toFixed(4)},${p.y.toFixed(4)},${p.z.toFixed(4)}`));
      assert.ok(uniq.size === count, `核内点阵不得重合（${uniq.size}/${count}）`);
    }
  });

  test('⑥ 核内点阵为离散球簇：质子/中子沿纬度混匀，绝不「上下半球拼接」', () => {
    // 旧实现的根因：斐波那契纬度 y=1-(2i+1)/A 随 i 单调，而「前 Z 个即质子」→ 质子全在北半球
    const cases: Array<[number, number, string]> = [[52, 24, 'Cr'], [294, 118, 'Og'], [4, 2, 'He'], [12, 6, 'C']];
    for (const [a, z, name] of cases) {
      const pts = nucleusPoints(a, z, 1);
      const p = pts.filter((x) => x.proton);
      const q = pts.filter((x) => !x.proton);
      const mean = (arr: typeof pts) => (arr.length ? arr.reduce((s, v) => s + v.y, 0) / arr.length : 0);
      const mp = mean(p), mq = mean(q);
      // y∈[-1,1]；半球拼接时质子/中子平均纬度会分别逼近 ±0.5（旧实现实测 +0.538 / −0.462）
      assert.ok(
        Math.abs(mp) < 0.3,
        `${name}: 质子平均纬度 ${mp.toFixed(3)} 偏北半球——「前 Z 个即质子」的实心半球拼接缺陷回归了`,
      );
      assert.ok(
        Math.abs(mq) < 0.3,
        `${name}: 中子平均纬度 ${mq.toFixed(3)} 偏南半球——同上`,
      );
      // 小样本（A<20）时均值噪声本就大，只在样本足够时才要求两者均值也接近
      if (a >= 20) {
        assert.ok(
          Math.abs(mp - mq) < 0.3,
          `${name}: 质子与中子的平均纬度差 ${Math.abs(mp - mq).toFixed(3)} 过大（>0.3 即出现上下分色）`,
        );
      }
    }
    // 等距取样：质子下标必须均匀铺满全程（否则又退化成「集中在某一半球」）
    for (const [count, protonN] of [[52, 24], [90, 36], [7, 3], [2, 1]] as const) {
      const flags = protonFlags(count, protonN);
      assert.ok(flags.length === count, `protonFlags 长度应为 ${count}`);
      assert.ok(flags.filter(Boolean).length === protonN, `质子数应为 ${protonN}`);
      const idx = flags.map((f, i) => (f ? i : -1)).filter((i) => i >= 0);
      // 等距布点：第 j 个质子落在 (j+0.5)/k 分位 → 首/末质子分别落在 1/(2k) 与 1−1/(2k) 分位附近。
      // 用 ceil(count/(2k)) 作容差，退化样本（count=2, k=1）也成立。
      const bin = Math.ceil(count / (2 * protonN));
      assert.ok(idx[0] <= bin, `首个质子下标 ${idx[0]} 越过第 1 个分位 ${bin}（南半球会缺质子）`);
      assert.ok(
        idx[idx.length - 1] >= count - 1 - bin,
        `末个质子下标 ${idx[idx.length - 1]} 未达倒数第 1 个分位（北半球会缺质子）`,
      );
      // 相邻质子下标差 ≥ 1（不重号）
      for (let i = 1; i < idx.length; i++) {
        assert.ok(idx[i] > idx[i - 1], `质子下标须严格递增：${idx[i - 1]} → ${idx[i]}`);
      }
    }
    // 体积填充：粒子半径经 cbrt 映射，故内层也有粒子（不是全部浮在球面）
    const pts = nucleusPoints(52, 24, 1);
    const radii = pts.map((p) => Math.hypot(p.x, p.y, p.z));
    assert.ok(Math.max(...radii) <= 1 + 1e-9, '核内粒子不得跑到球外');
    assert.ok(radii.filter((r) => r < 0.5).length >= 3, '应有若干粒子落在内核区（体积填充而非球面壳层）');
    const shellOnly = radii.filter((r) => r > 0.9).length;
    assert.ok(shellOnly < radii.length, '不得全部粒子都贴在球面上');
    // 无随机数：同参数两次调用必须完全一致（可测可复现）
    const again = nucleusPoints(52, 24, 1);
    assert.deepEqual(again.map((p) => `${p.x},${p.y},${p.z},${p.proton}`), pts.map((p) => `${p.x},${p.y},${p.z},${p.proton}`));
  });

  test('⑦ 核球/单球尺寸：单球恒在 2.2~3.5px，核球重元素落在 16~22px 且含缝隙', () => {
    // 轨道上限按「最内层轨道半径 × 0.4」给（组件即如此传参）
    const orbitLimit = (layers: number) => 0.4 * orbitRadius(0, layers) * 76;
    for (const a of [1, 2, 4, 7, 12, 24, 52, 118, 294]) {
      const count = visualCount(a);
      assert.ok(count <= VISUAL_COUNT_CAP, `A=${a} 视觉代表粒子数 ${count} 超过上限 ${VISUAL_COUNT_CAP}`);
      const s = nucleonScreenSizes(count, orbitLimit(4));
      assert.ok(
        s.nucleonR >= NUCLEON_MIN_PX - 1e-9 && s.nucleonR <= NUCLEON_MAX_PX + 1e-9,
        `A=${a} 单球半径 ${s.nucleonR.toFixed(2)}px 越出 [${NUCLEON_MIN_PX}, ${NUCLEON_MAX_PX}]px（过小会糊成一片、过大就成实心块）`,
      );
      if (a >= 40) {
        assert.ok(
          s.nucleusR >= NUCLEUS_MIN_PX - 1e-9 && s.nucleusR <= NUCLEUS_MAX_PX + 1e-9,
          `A=${a} 核球半径 ${s.nucleusR.toFixed(2)}px 越出 [${NUCLEUS_MIN_PX}, ${NUCLEUS_MAX_PX}]px`,
        );
      }
      assert.ok(s.nucleusR * 1.6 <= 76 * 2, `A=${a} 核球半径相对画布过大`);
    }
    // 单球越小 → 填充率不会反超「密堆积」；离散球簇的填充率必须显著低于实心（1.0）
    for (const a of [24, 52, 118, 294]) {
      const count = visualCount(a);
      const s = nucleonScreenSizes(count, orbitLimit(4));
      const fill = count * (s.nucleonR / s.nucleusR) ** 3;
      assert.ok(fill <= 0.62, `A=${a} 核内填充率 ${fill.toFixed(3)} 偏高，投影后会糊成实心色块（目标 ≈ ${NUCLEON_FILL}）`);
      assert.ok(fill >= MIN_CLUSTER_FILL - 1e-9, `A=${a} 核内填充率 ${fill.toFixed(3)} 过低，会看成几颗散珠`);
    }
    // 核球上限：无论轨道多小，核球都不得越过「最内层轨道 × 0.4」
    for (const layers of [1, 2, 4, 7]) {
      const limit = 0.4 * orbitRadius(0, layers) * 76;
      const s = nucleonScreenSizes(52, limit);
      assert.ok(s.nucleusR <= Math.max(NUCLEUS_MIN_PX, limit) + 1e-9, `layers=${layers} 核球越出最内层轨道的 40%`);
    }
    // 景深：近端不透明度 1.0，远端 0.66
    assert.ok(Math.abs(nucleonAlpha(-2, 2) - 1) < 1e-9, '核球近端（z=-R）不透明度须为 1.0');
    assert.ok(Math.abs(nucleonAlpha(2, 2) - 0.66) < 1e-9, '核球远端（z=+R）不透明度须为 0.66');
    assert.ok(Math.abs(nucleonAlpha(0, 2) - 0.83) < 1e-9, '核中心不透明度须为 0.83');
  });

  test('⑧ 绘制层：核子逐球独立渐变，杜绝「前 Z 个即质子」的实心拼贴', () => {
    const comp = readFileSync('src/components/lab/Atom3D.tsx', 'utf8');
    assert.match(comp, /createRadialGradient/, '核子须逐球画径向渐变（同色球不改光影就会合并成实心色块）');
    assert.match(comp, /nucleusPoints/, '核点阵须走 nucleusPoints（体积填充 + 等距取样分配）');
    assert.match(comp, /nucleonAlpha/, '核子须带景深透明度（近 1.0 / 远 0.66）');
    assert.doesNotMatch(
      comp,
      /i < z \? 'proton' : 'neutron'/,
      '不得再按「前 Z 个即质子」分配——斐波那契纬度单调，这正是实心半球拼接的根因',
    );
    assert.doesNotMatch(comp, /coreRadius3D|nucleonRadius\b/, '不得再使用会糊成实心块的旧尺寸函数');
    // 核子与电子分开处理：电子保持扁平小点，核子走渐变
    assert.match(comp, /it\.kind === 'electron'/, '电子须与核子分支处理');
  });

  test('⑤ 透视与画家排序约定自洽，且卸载/切回时取消动画帧', () => {
    // 约定：depth 是「离相机的距离」，越大越远 → k 越小（近大远小）
    const near = project3({ x: 0, y: 0, z: -1 }, 0, 0, 100);
    const far = project3({ x: 0, y: 0, z: 1 }, 0, 0, 100);
    assert.ok(near.k > far.k, `近处透视因子 ${near.k.toFixed(3)} 须大于远处 ${far.k.toFixed(3)}（近大远小）`);
    assert.ok(Math.abs(project3({ x: 0, y: 0, z: 0 }, 0, 0, 100).k - 1) < 1e-9, 'z=0 时 k 须为 1');
    assert.ok(CAMERA_D > 1.5, '相机距离须大于轨道最大半径的 1.5 倍，避免透视分母过零');
    const order = sortByDepth([
      { depth: -0.9, id: 'near' }, { depth: 0.9, id: 'far' }, { depth: 0, id: 'mid' },
    ]).map((x) => x.id);
    assert.deepEqual(order, ['far', 'mid', 'near'], '画家算法须「远的先画」（从后往前）');
    assert.ok(SHELL_TILTS.length === 7 && MAX_LAYERS === 7, '轨道倾角表须覆盖 7 个电子层');
    for (let i = 0; i < MAX_LAYERS; i++) {
      const [tx, ty] = SHELL_TILTS[i];
      assert.ok(Math.abs(tx) <= 45 && Math.abs(ty) <= 45, `第 ${i} 层倾角过大，会与相邻层重合`);
    }
    for (let i = 1; i < 7; i++) {
      assert.ok(orbitRadius(i, 7) > orbitRadius(i - 1, 7), '轨道半径须自内向外严格递增');
    }
    // 防泄漏：卸载（切回 2D 或关闭弹窗）必须取消 rAF 并摘掉全部监听
    const src = readFileSync('src/components/lab/Atom3D.tsx', 'utf8');
    assert.match(src, /cancelAnimationFrame\(raf\)/, '卸载时须 cancelAnimationFrame');
    assert.match(src, /removeEventListener\('pointermove'/, '卸载时须摘掉 window 上的 pointermove');
    assert.match(src, /removeEventListener\('pointercancel'/, '卸载时须摘掉 pointercancel');
    assert.match(src, /ro\.disconnect\(\)/, '卸载时须断开 ResizeObserver');
  });

  test('⑨ 微粒三联卡带形态互异的图例点，颜色与 3D 本体色同源', () => {
    assert.match(pt, /data-particle-dot=\{cell\.id\}/, '微粒卡片须带 data-particle-dot（供渲染量测）');
    assert.match(pt, /data-dot-shape=\{cell\.id === 'electron' \? 'ringed-dot' : 'sphere'\}/, '须标注图例形态（环点 / 微球）');
    for (const id of ['proton', 'neutron', 'electron']) {
      assert.ok(pt.includes(`id: '${id}'`), `微粒卡片须有 ${id} 稳定标识`);
    }
    // 三套绘制配方互异：核内两格是径向渐变微球（与 Atom3D 同一套配方），电子是「实心点 + 细环」
    assert.match(String(LEGEND_DOT.proton.background), /^radial-gradient\(/, '质子须为径向渐变微球');
    assert.match(String(LEGEND_DOT.neutron.background), /^radial-gradient\(/, '中子须为径向渐变微球');
    assert.ok(String(LEGEND_DOT.proton.background).includes('var(--accent)'), '质子球本体色须用 --accent（3D 质子球本体色）');
    assert.ok(String(LEGEND_DOT.neutron.background).includes(NEUTRON_COLOR), '中子球本体色须走 NEUTRON_COLOR 常量');
    assert.ok(!String(LEGEND_DOT.neutron.background).includes('var(--accent)'), '中子不得复用质子本体色');
    assert.ok(String(LEGEND_DOT.electron.background).includes('var(--fg)'), '电子点须用 --fg（2D/3D 电子点同填色）');
    assert.ok(LEGEND_DOT.electron.outline, '电子点须带细环线（环即轨道，形态与核内微球区分）');
    assert.ok(!String(LEGEND_DOT.electron.background).includes('radial-gradient'), '电子不得复用核内微球的球体配方');
    // 三类样式两两不同：防止退化成「三个同形换色圆点」（浅色主题下 --accent #000 与 --fg #111 仅差约 7% 亮度）
    assert.notDeepEqual(LEGEND_DOT.proton, LEGEND_DOT.neutron, '质子与中子图例不得同形同色');
    assert.notDeepEqual(LEGEND_DOT.proton, LEGEND_DOT.electron, '质子与核外电子图例不得雷同');
    assert.notDeepEqual(LEGEND_DOT.neutron, LEGEND_DOT.electron, '中子与核外电子图例不得雷同');
    // 单一事实源：3D 组件必须取同一中子色常量，两处不得各写一份
    const comp = readFileSync('src/components/lab/Atom3D.tsx', 'utf8');
    assert.match(comp, /NEUTRON_COLOR/, 'Atom3D 须从同一常量取中子色');
    assert.doesNotMatch(comp, /'#d8cfc4'/, 'Atom3D 不得再硬写中子色（须走 NEUTRON_COLOR）');
    assert.equal(NEUTRON_COLOR, '#d8cfc4', '中子色常量值须保持淡暖灰白');
  });

  test('⑩ 电子层名第 5 层输出大写字母 O（并规避 mono 字体 O/0 同形误读）', () => {
    assert.deepEqual([...SHELL_NAMES], ['K', 'L', 'M', 'N', 'O', 'P', 'Q'], '层名须为 K L M N O P Q');
    assert.equal(SHELL_NAMES[4], 'O', '第 5 层须是大写字母 O');
    assert.notEqual(SHELL_NAMES[4], '0', '第 5 层不得是数字 0');
    for (const s of SHELL_NAMES) {
      assert.match(s, /^[A-Z]$/, `层名「${s}」须为单个拉丁大写字母`);
    }
    assert.ok(
      ELEMENTS.filter((e) => e.shells.length >= 5).length > 0,
      '须存在 5 层及以上的元素（否则本守卫覆盖不到第 5 层）',
    );
    // 字形反碰撞：Space Grotesk（--f-mono）的 O 与 0 逐像素同形（40px 下宽高同为 20×30、
    // 墨量 376 vs 375、仅 2.1% 抗锯齿噪声，且不支持 zero/ss01 斜杠零特性），
    // 故层名字母的两处渲染点都必须显式走 --f-serif（同尺寸 O/0 墨量比 1.58×）。
    const serifSpans = pt.match(/<span className="serif-font">\{SHELL_NAMES\[[a-z]+\]\}<\/span>/g) ?? [];
    assert.equal(serifSpans.length, 2, `层名字母须在两处渲染点都走 --f-serif（实测 ${serifSpans.length} 处）`);
    assert.match(pt, /O 与 0 逐像素同形/, '须保留字形碰撞成因注释（防后人「顺手」改回 mono）');
  });

  test('⑪ 118 元素族标签只用标准预组合罗马数字（U+2160–U+2167）', () => {
    const CANON = /^(?:[ⅠⅡⅢⅣⅤⅥⅦⅧ][AB]?|0)$/;
    for (const e of ELEMENTS) {
      const { main } = groupDisplay(e, true);
      assert.match(main, CANON, `Z=${e.n} ${e.symbol} 族标签「${main}」不是标准预组合罗马数字`);
      assert.doesNotMatch(main, /[IVX]/, `族标签「${main}」含 ASCII 字母 I/V/X（应使用 Ⅰ~Ⅷ 预组合字符）`);
    }
    // 关键对照：主族 ⅥA、8/9/10 同属 Ⅷ、第 18 列沿用人教版「0 族」、副族 ⅢB
    assert.equal(groupLabel(16), 'ⅥA', '第 16 列须为 ⅥA');
    assert.equal(groupLabel(3), 'ⅢB');
    assert.equal(groupLabel(8), 'Ⅷ');
    assert.equal(groupLabel(9), 'Ⅷ');
    assert.equal(groupLabel(10), 'Ⅷ', '8/9/10 三列同属 Ⅷ 族');
    assert.equal(groupLabel(18), '0', '第 18 列须兼容人教版「0 族」');
    // 字形覆盖：Space Grotesk 不含 U+2165 → 会回退到不同源字体；族标签须走含该字形的 --f-serif
    assert.match(pt, /font-bold serif-font text-\[var\(--fg\)\] leading-tight">\{selGroup\?\.main/, '族标签须走 --f-serif（mono 缺罗马数字字形）');
    assert.match(pt, /font-semibold serif-font">\{heroData\.gd\.main\}/, '展台族标签同样须走 --f-serif');
  });

  test('⑫ 详情卡内解释性注释一律正体（斜体只留给强调/引文）', () => {
    // 弹窗内曾有三段长斜体小字（中子估算说明 / IUPAC 原子量 / 发现史免责），造成整屏斜体轰炸
    const from = pt.indexOf('可滚动内容主体');
    const to = pt.indexOf('问 AI：看完元素详情后可一键提问');
    assert.ok(from > 0 && to > from && to - from > 1000, '须能定位到详情卡滚动主体');
    assert.doesNotMatch(pt.slice(from, to), /italic/, '详情卡内不得再出现斜体小字（须为正体）');
    // 高中拓展改为紧凑通知徽章条（正体标签 + 无左侧长竖线）
    assert.ok(pt.includes("{lang === 'zh' ? '高中拓展' : 'Extension'}"), '高中拓展须改为徽章标签条');
    assert.doesNotMatch(
      pt,
      /border-l-2 border-\[var\(--border\)\] pl-2">\s*\{lang === 'zh'\s*\?\s*'高中拓展'/,
      '高中拓展不得再沿用左侧长竖线段落形态',
    );
  });

  test('⑬ 详情卡顶部锚定：切 Tab 时弹窗头部与 Tab 栏绝对静止', () => {
    // 根因：外框与 overlay 原为 items-center + 高度随内容变化 → 垂直居中重算导致整框上下跳。
    // 改前实测（1280×1100）：面板 top 66 → 172 → 66，跳幅 106px = 高度差 212px 的一半。
    const ov = pt.match(/className="fixed inset-0 z-50 flex ([^"]+)"/);
    assert.ok(ov, '须能定位弹窗 overlay');
    assert.match(ov[1], /items-start/, 'overlay 须顶部锚定（items-start），避免居中重算');
    assert.doesNotMatch(ov[1], /items-center/, 'overlay 不得垂直居中（内容高度变化会带动整框重排）');
    assert.match(ov[1], /overflow-y-auto/, 'overlay 须可滚动，兜底极矮视口');
    const panel = pt.match(/className="relative w-full max-w-sm sm:max-w-md ([^"]+)"/);
    assert.ok(panel, '须能定位弹窗外框');
    assert.match(
      panel[1],
      /max-h-\[calc\(100dvh-1rem\)\] sm:max-h-\[calc\(100dvh-2rem\)\]/,
      '外框 max-h 须与 overlay 的 p-2/p-4 对齐（顶边固定、底边仍留同距）',
    );
    assert.doesNotMatch(panel[1], /92dvh|88dvh/, '外框不得再用与 padding 脱钩的 92dvh / 88dvh');
    assert.match(panel[1], /flex flex-col/, '外框须为纵向 flex，内容区才能独立滚动');
    assert.match(pt, /flex-1 overflow-y-auto[^"]*space-y-3/, '内容区须 flex-1 承载剩余高度（头部与 Tab 栏不动）');
  });

  test('⑭ 检索栏无外框无静态标题，且类别图例不在 ≥sm 重复', () => {
    // ① 检索栏：无卡片包裹（无 card-bg / 无内边距），标题已移除
    assert.ok(
      !pt.includes('mb-5 border border-[var(--border)] bg-[var(--card-bg)] p-3 space-y-3'),
      '检索区卡片外框须已移除（不再有 border + card-bg + p-3 包裹）',
    );
    assert.ok(!pt.includes("{lang === 'zh' ? '检索元素' : 'Search'}"), '「检索元素」静态标题须已移除');
    assert.match(
      pt,
      /className="relative mb-3 sm:mb-5 w-full sm:max-w-xs border border-\[var\(--border-strong\)\] rounded-lg transition-colors focus-within:border-\[var\(--accent\)\]"/,
      '边框与聚焦态须由外层容器唯一定义（且不含 card-bg / 内边距）',
    );
    // ② 输入框：零边框零轮廓（边框交给外层），前置轻量 Search 图标；placeholder 与无障碍名保留
    assert.match(pt, /<Search\s[\s\S]{0,150}?absolute left-2\.5 top-1\/2 -translate-y-1\/2/, '输入框前须有轻量 Search 图标');
    const inputCls = (pt.match(/className="min-h-10 w-full ([^"]+)"/) ?? ['', ''])[1];
    assert.ok(inputCls.includes('border-none'), '内层 input 须 border-none');
    assert.ok(inputCls.includes('outline-none') && inputCls.includes('focus:ring-0'), '内层 input 须 outline-none + focus:ring-0');
    assert.doesNotMatch(inputCls, /(^|\s)border(\s|$)/, '内层 input 不得再带 border 宽度类（会与外层叠加成双层框）');
    assert.doesNotMatch(inputCls, /border-\[/, '内层 input 不得再带任意边框色类');
    assert.match(
      pt,
      /style=\{\{ outline: 'none' \}\}/,
      '须补内联 outline:none —— index.css 的全局 :focus-visible 在 @layer 之外会盖过分层 outline-none，光有工具类挡不住',
    );
    assert.match(pt, /placeholder=\{lang === 'zh' \? '输入元素符号或中文名，如 H \/ 氢'/, 'placeholder 提示须保留');
    assert.match(pt, /aria-label=\{lang === 'zh' \? '检索元素' : 'Search elements'\}/, '去掉可见标题后须补上无障碍名');
    // ③ 单层边框不变量：整个检索组件里「自带边框」的元素必须恰好一个（外层容器）
    const widget = pt.slice(
      pt.indexOf('relative mb-3 sm:mb-5 w-full sm:max-w-xs'),
      pt.indexOf('类别图例：只在 <640px 保留'),
    );
    assert.ok(widget.length > 120, '须能切出检索组件');
    const bordered = widget.match(/(?:^|\s)border(?=\s|")/g) ?? [];
    assert.equal(bordered.length, 1, `检索组件内自带边框的元素须恰 1 个（实测 ${bordered.length}）`);
    assert.doesNotMatch(widget, /border-\[var\(--border\)\]/, '检索组件内不得再出现 --border 边框（弱于 --border-strong，且会与外层叠加）');
    // ④ 类别图例：≥sm 唯一来源是中央展台；检索框下方那处只兜底小屏
    const searchLegend = pt.match(/className="mb-5 flex flex-wrap gap-4 text-\[0\.625rem\] mono-font text-\[var\(--muted\)\]([^"]*)"/);
    assert.ok(searchLegend, '须能定位检索框下方的兜底图例');
    assert.match(searchLegend[1], /sm:hidden/, '兜底图例须只在 <640px 出现（≥sm 与中央展台重复）');
    assert.ok(pt.includes("{isZh ? '分类图例' : 'LEGEND'}"), '中央展台须保留分类图例（≥sm 的唯一来源）');
    assert.match(
      pt,
      /pointer-events-none absolute left-\[28px\] right-\[3px\] top-0 hidden sm:grid/,
      '展台须在 <640px 折叠——这正是小屏仍需兜底图例的原因',
    );
    // 两份图例同源：都必须走 CAT_COLOR，不得各写一套色值
    const renders = pt.match(/Object\.keys\(CAT_COLOR\) as ElementInfo\['cat'\]\[\]\)\.map\(/g) ?? [];
    assert.equal(renders.length, 2, `类别图例须恰好两处渲染点且都走 CAT_COLOR（实测 ${renders.length} 处）`);
  });

  test('⑮ 检索命中驱动中央展台预览：与悬停共用同一套渲染', () => {
    // ① 焦点元素 = 悬停优先，无悬停退回检索命中
    assert.match(
      pt,
      /const searchPreview = queryLower \? \(exactSymbol \?\? ELEMENTS\.find\(\(e\) => matchN\(e\)\) \?\? null\) : null;/,
      '须有「检索驱动的展台预览目标」',
    );
    assert.match(pt, /const heroFocus = heroEl \?\? searchPreview;/, '展台焦点须为「悬停优先、否则退回检索命中」');
    // ② 展台渲染区只认 heroFocus：直接读 heroEl 会让检索态根本不出现在展台上
    //    切片起点必须取在展台覆层容器处（早于两态透明度三元），否则判定不到默认图例态
    const dashboard = pt.slice(pt.indexOf('pointer-events-none absolute left-[28px] right-[3px]'));
    assert.ok(dashboard.length > 2000, '须能定位展台渲染区');
    assert.match(dashboard, /\/\/ \{isZh \? '分类图例' : 'LEGEND'\}/, '切片须覆盖默认图例态');
    assert.doesNotMatch(dashboard, /\bheroEl\b/, '展台渲染区不得再直接引用 heroEl（须统一走 heroFocus）');
    assert.match(dashboard, /heroFocus \? 'opacity-0' : 'opacity-100'/, '默认图例态须以 heroFocus 判定');
    assert.match(dashboard, /heroData && heroFocus && \(/, '预览态须以 heroFocus 判定');
    // ③ 展台派生数据同样走 heroFocus；状态机仍保留 heroEl 存悬停
    assert.match(pt, /if \(!heroFocus\) return null;[\s\S]{0,40}const vt = valenceTendency\(heroFocus\)/, '展台派生数据须走 heroFocus');
    assert.match(pt, /const \[heroEl, setHeroEl\] = useState<ElementInfo \| null>\(null\)/, '悬停态存储须保留');
    assert.match(pt, /const previewOn = \(el: ElementInfo\) =>/, '悬停进入逻辑须保留');
    // ④ 行为级：复用页面同一套判定，验证「精确符号优先 / 否则按原子序数取首个命中」
    const pick = (q: string) => {
      const ql = q.trim().toLowerCase();
      if (!ql) return null;
      const exact = ELEMENTS.find((e) => e.symbol.toLowerCase() === ql);
      const hit = (e: ElementInfo) =>
        exact ? e.n === exact.n
          : e.symbol.toLowerCase().startsWith(ql) || e.zh.includes(ql) || e.en.toLowerCase().startsWith(ql);
      return exact ?? ELEMENTS.find(hit) ?? null;
    };
    assert.equal(pick(''), null, '空检索不得预览');
    assert.equal(pick('   '), null, '纯空白检索不得预览');
    assert.equal(pick('zzz'), null, '无命中不得预览');
    assert.equal(pick('H')?.n, 1, '「H」须精确命中氢（而非按前缀命中一堆 H 开头元素）');
    assert.equal(pick('fe')?.n, 26, '「fe」须精确命中铁');
    assert.equal(pick('He')?.n, 2, '「He」须精确命中氦');
    assert.equal(pick('氢')?.n, 1, '中文名须可命中氢');
    assert.equal(pick('氧')?.n, 8, '中文名须可命中氧');
    assert.equal(pick('Tellurium')?.n, 52, '英文名须可命中碲');
    // 前缀查询：按原子序数取首个命中（ELEMENTS 本身按 Z 升序）
    assert.ok((pick('c')?.n ?? 99) <= 6, `「c」应取 Z 最小的命中（实测 ${pick('c')?.symbol}）`);
  });

  // 异步用例必须走 testAsync：同步 test() 只调用 fn() 而不 await，
  // 会让它和文件末尾 runAsyncTests() 里的其它用例（尤其是 Feedback 的 fetch mock）并发跑，
  // 本用例的探针就会在半途被别处替换掉 globalThis.fetch —— 结果为随机失败。
  // ⑰ 侧边悬浮书签已废弃：AI 入口只留顶栏一处，横屏空间靠语言按钮的双断点腾出
  //    历史：AiSideTab 曾以 24×88 / 32×40 贴右常驻（滚动后页头消失，需要补一个常驻入口）。
  //    但它始终是页面右缘的异物——实测在 3 个实验里与「下一步 →」的右下角存在 5×10.6px 重叠。
  //    最终取舍：入口回归顶栏（页头滚走时用户本来也在阅读内容，不需要第二处唤起点）。
  test('⑰ 侧边书签不得回流：AI 入口仅顶栏一处，语言按钮按断点收成「中」', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    const header = readFileSync('src/components/layout/Header.tsx', 'utf8');
    const css = readFileSync('src/index.css', 'utf8');
    // ① 组件文件与 hook 已删除，App 不再引用，CSS 不再留 selector
    assert.ok(!existsSync('src/components/ai/AiSideTab.tsx'), 'AiSideTab.tsx 须已删除（不留死代码）');
    assert.ok(!existsSync('src/lib/use-media-query.ts'), 'use-media-query.ts 仅服务于书签，须一并删除');
    assert.doesNotMatch(app, /AiSideTab/, 'App 不得再引用侧书签');
    assert.doesNotMatch(css, /ai-side-tab/, 'CSS 不得残留 .ai-side-tab 选择器');
    // ② AI 图标回归顶栏：整块挂载，移动端不得再隐藏
    assert.match(header, /<div className="relative flex items-center justify-center">/, 'AI 入口须恢复为整块常驻');
    assert.doesNotMatch(header, /relative hidden items-center justify-center sm:flex/, 'AI 入口不得再 hidden sm:flex');
    assert.match(header, /onClick=\{\(\) => setAiOpen\(!aiOpen\)\}/, '图标本体仍须开 AI 面板');
    // ③ 语言按钮双断点：移动端「中」，桌面「中文」；英文 EN 两档同形
    assert.match(
      header,
      /lang === 'zh' \? \(\s*<>\s*<span className="sm:hidden">中<\/span>\s*<span className="hidden sm:inline">中文<\/span>\s*<\/>\s*\) : \(\s*'EN'\s*\)/,
      '语言按钮须为「中 / 中文」双断点，英文恒 EN',
    );
    // ④ 互斥规则保留且只针对反馈气泡（书签那条 display:none 已随组件移除）
    assert.match(css, /html\.param-dock-open \.feedback-fab,\s*html\.ai-sheet-open \.feedback-fab \{[^}]*opacity: 0;[^}]*pointer-events: none/, '两种展开态须对反馈气泡用同一套淡出规则');
    const ai = readFileSync('src/components/ai/AiAssistant.tsx', 'utf8');
    assert.match(ai, /cls\.add\('ai-sheet-open'\)/, 'AI 面板须继续把展开状态镜像到 <html>');
    // ⑤ 右簇仍是 gap-2 / sm:gap-4：5 个控件在 390 下单行
    assert.match(header, /gap-1\.5 sm:gap-4/, '顶栏右簇间距须为 gap-1.5 sm:gap-4（移动收紧、桌面冻结）');
    // ⑥ 返回链接移动端左对齐：`.tap-area` 的 justify-content:center 会把满宽盒里的内容居中
    //    （实测箭头落在 x=160，而标题图标在 x=24）。只能用 align-self 收窄盒宽——justify-*
    //    是未分层 CSS，工具类压不过它；`max-sm:` 前缀保证桌面盒宽与命中区一字未改。
    const back = readFileSync('src/components/layout/BackLink.tsx', 'utf8');
    // 左缘规则取「盒对齐 x=24」：正文列、标题图标盒（w-12）、返回链接同一起点。
    // 不做墨迹补偿——15 个实验的图标墨迹在 31.3–42.3 之间浮动，单一 padding 对齐不了全部。
    assert.match(back, /tap-area max-sm:self-start sm:mt-3 sm:mb-6/, '返回链接须 max-sm:self-start（移动左对齐、桌面不变）');
    assert.doesNotMatch(back, /max-sm:pl-/, '不得用 padding 做逐实验的墨迹补偿（图形留白各不相同）');
    assert.match(back, /mt-2 mb-1 /, '返回链接移动端下外边距须收到 mb-1');
  });

  testAsync('⑯ 欢迎弹窗双 Tab、Header 帮助入口、AI 角标五态与多端响应式不变量', async () => {
    const wd = readFileSync('src/components/ui/WelcomeDialog.tsx', 'utf8');
    const hd = readFileSync('src/components/layout/Header.tsx', 'utf8');
    const app = readFileSync('src/App.tsx', 'utf8');
    const i18n = readFileSync('src/lib/i18n.ts', 'utf8');
    const panelSrc = readFileSync('src/components/ai/AiAssistant.tsx', 'utf8');
    // ① 双 Tab 分段控件 + 初始分区入参（首开仍停在概览）
    assert.match(wd, /type WelcomeTab = 'overview' \| 'guide'/, '须定义两个分区');
    assert.match(wd, /initialTab = 'overview'/, '默认分区须为「实验室概览」（首开自动弹出）');
    assert.match(wd, /role="tablist"/, '须有 tablist');
    assert.match(wd, /data-welcome-tab=\{v\}/, 'Tab 须带 data-welcome-tab（供渲染量测）');
    assert.match(wd, /aria-selected=\{tab === v\}/, 'Tab 须带 aria-selected');
    // ② 弹性布局不变量：头 / Tab 栏 / 底栏常驻，内容区独立滚动
    //    高度上限用 dvh 而非 vh：移动端浏览器 UI 会伸缩，vh 会把底栏顶出屏幕
    assert.match(wd, /h-\[85dvh\] sm:h-\[620px\] flex flex-col/, '外框须为定高弹性约束（两页同高才能居中不跳位）');
    const shrink0 = wd.match(/flex-shrink-0/g) ?? [];
    assert.ok(shrink0.length >= 3, `顶部条 / Tab 栏 / 底栏须 flex-shrink-0 常驻（实测 ${shrink0.length} 处）`);
    // 垂直居中：外框已定为固定高度（两页同高），故居中不会重解位置；此前 max-h 下居中会顶动头部 98px
    assert.match(wd, /z-\[100\] flex items-center justify-center p-4/, 'overlay 须垂直居中');
    assert.doesNotMatch(wd, /items-start justify-center overflow-y-auto p-4/, 'overlay 不得再顶部锚定');
    // min-h 取 12rem：更大就可能在矮视口挤掉底栏（与「底栏永不越界」的要求冲突）
    assert.match(wd, /flex-1 overflow-y-auto[^"]*min-h-\[12rem\]/, '内容区须 flex-1 滚动 + 安全的 min-h');
    // ③ 4 条纵向流式导览行（微圆角图标徽标 + 标题 + 说明，含 hover 反馈）
    assert.match(wd, /flex items-center gap-3\.5 rounded-xl p-3 transition-colors hover:bg-\[var\(--accent-light\)\]\/50/, '导览须为纵向流式行');
    assert.match(wd, /h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-\[var\(--accent-light\)\]\/70/, '导览行须有微圆角图标徽标');
    for (let i = 1; i <= 4; i++) {
      assert.ok(wd.includes(`t.guideCard${i}Title`) && wd.includes(`t.guideCard${i}Desc`), `第 ${i} 条导览须齐备`);
    }
    // ③b 导览须横向覆盖三科，不得偏向单一学科（此前 4 条里 2 条都在讲元素周期表）
    const gdescs = i18n.match(/guideCard\dDesc:\s*'[^']*'/g) ?? [];
    assert.equal(gdescs.length, 8, `导览说明须 zh/en 各 4 条（实测 ${gdescs.length}）`);
    const zhDescs = gdescs.filter((s) => /[\u4e00-\u9fa5]/.test(s));
    for (const subj of ['数学', '物理', '化学']) {
      assert.ok(zhDescs.some((s) => s.includes(subj)), `导览须覆盖「${subj}」的玩法`);
    }
    assert.ok(
      zhDescs.some((s) => s.includes('预测') && s.includes('探索') && s.includes('结论')),
      '导览须交代「预测 → 探索 → 结论」三幕闭环',
    );
    const ptRows = gdescs.filter((s) => /周期表|periodic table/.test(s));
    // 同一条导览的 zh + en 各计一次 → 至多 1 条提及元素周期表（= 至多 2 条字符串）
    assert.ok(ptRows.length <= 2, `至多一条导览可提及元素周期表（实测 ${ptRows.length}/8 条命中）`);
    // ④ 触屏热区（本弹窗挂在 body 上，不吃 main button 的 40px 全局底线）
    //    移动端视觉减重：Tab 30px / 轨道 36px / 主按钮 36px + 12px 字；桌面（sm:）全部维持原样。
    //    Tab 挂 .tap-rail（上下各 +5px 透明扩区）而不是 .tap-area——后者把**视觉盒**撑到 40px，
    //    正是移动端「小字大壳」的来源；扩区必须落到伪元素上才只动命中不动版式。
    assert.match(wd, /tap-rail relative z-10 h-\[1\.875rem\] rounded-lg px-3 py-0 text-xs mono-font/, 'Tab 触屏须为 30px 视觉盒（命中由 .tap-rail 补）');
    assert.match(wd, /sm:h-9 sm:rounded-full sm:px-4 sm:py-1\.5/, 'Tab 桌面须维持 36px 胶囊（移动端减重不得外溢）');
    // 圆角同心：外轨 10px - 内边距 2px = 滑块 8px（内外同为 10px 时四角留白会显得挤）
    assert.match(wd, /rounded-\[0\.625rem\][^"]*p-0\.5 sm:rounded-full/, '轨道移动端圆角须为 10px');
    assert.doesNotMatch(wd, /tap-area relative z-10/, 'Tab 不得再用 .tap-area 撑高视觉盒');
    assert.match(wd, /w-11 h-11 text-\[var\(--muted\)\]/, '关闭 × 热区须 44×44');
    assert.match(wd, /transition-colors min-h-9 touch-manipulation rounded-md sm:min-h-11 sm:px-5 sm:text-sm/, '主按钮移动端 36px / 桌面 44px 两档');
    assert.match(wd, /gap-2 min-h-11 text-xs/, '「下次不再显示」须 ≥44px 热区');
    // ④b Tab：高级分段滑槽——轨道 + 等宽滑块（位移过渡），非孤悬灰块、非实心反色块
    assert.match(wd, /grid w-fit max-w-full grid-cols-2 items-center rounded-\[0\.625rem\] border border-\[var\(--border\)\]\/60 bg-\[var\(--accent-light\)\]\/60 p-0\.5 sm:rounded-full sm:p-1/, 'Tab 轨道须为等宽两格且移动端 36px');
    assert.match(wd, /absolute inset-y-0\.5 left-0\.5 w-\[calc\(50%-0\.125rem\)\] rounded-lg[^"]*sm:inset-y-1 sm:left-1 sm:w-\[calc\(50%-0\.25rem\)\] sm:rounded-full/, '须有等宽滑块（抬起面 + 位移过渡，桌面几何不变）');
    assert.match(wd, /transform: tab === 'overview' \? 'translateX\(0\)' : 'translateX\(100%\)'/, '滑块位移须由当前分区驱动');
    assert.doesNotMatch(wd, /bg-\[var\(--fg\)\] text-\[var\(--bg\)\]/, '激活 Tab 不得再用实心反色块');
    assert.doesNotMatch(wd, /flex-1 min-h-11/, 'Tab 不得再撑满整行（通栏）');
    // 明暗主题由 html.dark / :root:not(.light) 控制，Tailwind 的 dark 前缀变体只认 prefers-color-scheme
    // —— 手动切主题时会与站点脱节，故本文件禁用该变体（写法为 dark 前缀 + 冒号 + 工具类，中间无空格），一律走 var 令牌
    assert.doesNotMatch(wd, /dark:[^\s]/, '弹窗不得使用 dark 前缀变体（与手动主题切换脱节）');
    // ④c 定高弹性 + 去边框化 + 滚动安全
    assert.match(wd, /h-\[85dvh\] sm:h-\[620px\] flex flex-col/, '外框须为定高弹性约束（桌面封顶 620px）');
    // 滚动条落在 px-1 的外侧留白里；内容留白放在内层 mx-4，与外框 px-5 对齐（20px）
    assert.match(wd, /flex-1 overflow-y-auto px-1 pb-6 pt-1 min-h-\[12rem\]/, '内容区须 flex-1 滚动 + 外侧留白容下滚动条');
    assert.match(wd, /<div className="mx-4 space-y-3">/, '内容留白须放内层并与外框对齐');
    assert.match(wd, /border-t border-\[var\(--border\)\]\/60 px-5 pt-3/, '底栏须常驻且只留一条发丝分隔线');
    assert.doesNotMatch(wd, /border border-\[var\(--border\)\]\/70/, '内容块不得再挂灰色冷边框');
    assert.ok((wd.match(/rounded-xl bg-\[var\(--accent-light\)\]/g) ?? []).length >= 2, '内容块须用柔和填充（无灰边框）');
    // ④e 图标校准：学科徽标 36px 圆底 + 20px 图标（占比 55.6%）；π 与图标墨迹体量等重
    assert.match(
      wd,
      /h-9 w-9 shrink-0 items-center justify-center rounded-full border border-\[var\(--border\)\] bg-\[var\(--card-bg\)\] text-\[var\(--fg\)\] shadow-xs/,
      '学科徽标须为 36px 圆底 + 微投影 + 高对比字色',
    );
    assert.match(wd, /<div className="flex items-center gap-3">/, '徽标须与标题同行且中线对齐');
    assert.match(wd, /min-w-0 text-\[0\.6875rem\] mono-font font-bold tracking-widest/, '标题须紧跟徽标右侧');
    const w5 = wd.match(/className="w-5 h-5"/g) ?? [];
    assert.ok(w5.length >= 4, `学科/导览图标须统一 20px（实测 ${w5.length} 处）`);
    assert.match(wd, /subjectId="math" className="w-5 h-5"/, '数学图标须与物理/化学同为 20px 矢量图标');
    // 数学图标已从字体字形 π 换成 24 栅格矢量：字体字形横细竖粗、末端带弯钩，
    // 且字宽字重随字体与平台漂移，靠 font-bold 硬贴墨迹属补偿式对齐，三科永远凑不齐。
    const si = readFileSync('src/components/ui/SubjectIcon.tsx', 'utf8');
    assert.doesNotMatch(si, /glyphClassName/, '学科图标不得再保留字体字形分支');
    assert.match(si, /viewBox="0 0 24 24"/, '数学图标须为 24 栅格矢量');
    assert.match(si, /strokeWidth=\{2\}/, '数学图标须为 2px 固定线宽');
    assert.match(si, /strokeLinecap="round"/, '数学图标须为圆头端点');
    // 物理动效（第二版）：轨道几何必须一动不动，运动落在「沿轨道跑的电子」上。
    // 第一版让两条轨道各自绕核反向自转——两环夹角连续变化，交叉点漂移、中心描边忽厚忽薄，
    // 36px 下像在扭动发糊，已废弃。这里锁死「不许回到逐环自转」。
    assert.doesNotMatch(si, /data-subject-part="orbit-[ab]"/, '原子轨道不得再分组自转（会破坏原子形态）');
    assert.match(si, /data-subject-part="electron-a"/, '每个环上须有一颗电子');
    assert.match(si, /data-subject-part="electron-b"/, '每个环上须有一颗电子');
    assert.match(si, /const ATOM_ORBIT_A = 'M20\.2 20\.2c/, '轨道路径须抽成常量');
    assert.match(si, /<path d=\{ATOM_ORBIT_A\}/, '轨道 <path> 须与电子共用同一路径常量');
    assert.match(
      si,
      /offsetPath: `path\("\$\{ATOM_ORBIT_A\}"\)`/,
      '电子须用 same-source 常量的 offset-path 定位（两份几何会漂移）',
    );
    assert.match(si, /opacity=\{0\}/, '电子默认不可见：非首页场景（弹窗/科目页/实验页）不得出现多余圆点');
    const cssSrc2 = readFileSync('src/index.css', 'utf8');
    assert.match(cssSrc2, /@keyframes subject-electron-travel/, '电子行进须有 keyframes');
    assert.doesNotMatch(cssSrc2, /subject-orbit-cw|subject-orbit-ccw/, '逐环自转的关键帧须已删除');
    assert.match(cssSrc2, /electron-a'\] \{\s*opacity: 1;\s*animation: subject-electron-travel 2\.6s linear infinite;/, 'A 环电子 2.6s 正向');
    assert.match(cssSrc2, /electron-b'\] \{\s*opacity: 1;\s*animation: subject-electron-travel 3\.4s linear infinite reverse;/, 'B 环电子 3.4s 反向');
    assert.match(cssSrc2, /\[data-subject-part='electron-a'\],\s*\n\.home-subjects > button \[data-subject-part='electron-b'\] \{\s*opacity: 0;/, '电子默认 opacity 0（淡入而非突兀出现）');
    // 减动效：动效全关（π 描摹 / 电子行进 / 锥形瓶摆动）
    assert.match(
      cssSrc2,
      /\[data-subject-part='electron-a'\],\s*\n\s*\.home-subjects > button:hover \[data-subject-part='electron-b'\] \{\s*animation: none;/,
      '减动效下电子须停anim，不得留循环',
    );
    // ④d 底栏级底注：开源协议 / 作者 / 反馈 一行收敛 + 姊妹作品胶囊
    // 行距从 gap-y-2 提到 gap-y-4：这些链接挂着 ±8px 透明热区（tap-pad），
    // 窄屏换行时两行之间若只有 8px，上一行的下沿热区会压住下一行的上沿，
    // 实测 AGPL 与 mailto 相差 6px 时互相拦截、测得命中高只剩 21px（应为 32.5）。
    // 16px = 8+8 的最小不重叠间距。
    assert.match(wd, /justify-between gap-x-4 gap-y-4 px-0\.5 text-\[0\.6875rem\]/, '次级底注须为一行 justify-between，且换行行距 ≥16px');
    for (const k of ['welcomeLicenseLabel', 'welcomeFeedbackLabel']) {
      assert.ok(wd.includes(`t.${k}`), `底注须含 ${k}`);
    }
    assert.match(wd, /rounded-full bg-\[var\(--accent-light\)\]\/70 px-2\.5 py-1/, '姊妹作品须为紧凑胶囊');
    // 底注图标：邮箱带 Mail、Issue 只留 Gitee / GitHub 品牌图标（无夹字），姊妹作品带图标胶囊 + 数字角标
    assert.match(wd, /<Mail className="h-3 w-3 shrink-0"/, '邮箱前须有 Mail 图标');
    assert.match(wd, /<path d=\{GITEE_PATH\} \/>/, 'Issue 须带 Gitee 品牌图标');
    assert.match(wd, /<path d=\{GITHUB_PATH\} \/>/, '须带 GitHub 品牌图标');
    assert.doesNotMatch(wd, /welcomeFeedbackIssue/, '两个品牌图标之间不得再夹「Issue」文字');
    assert.doesNotMatch(i18n, /welcomeFeedbackIssue:/, 'i18n 不得再保留已被替换的 Issue 文案');
    assert.match(wd, /import \{ GITHUB_PATH, GITEE_PATH, ISSUE_URLS \} from '\.\.\/\.\.\/lib\/brand-icons'/, '品牌路径须走共享常量');
    assert.match(wd, /<Library className="h-3\.5 w-3\.5" aria-hidden="true" \/>/, '其他作品前须有作品集图标');
    // 作品名就紧跟在后，弹窗内不再挂数字角标（角标是页脚折叠入口才需要的计数提示）
    assert.doesNotMatch(wd, /min-w-\[0\.95rem\]/, '弹窗内的其他作品不得再挂数字角标');
    assert.doesNotMatch(wd, /bg-\[#C71D23\]/, '弹窗内不得出现品牌红角标');
    assert.match(wd, /<img src=\{w\.icon\} alt="" width="12" height="12" className="shrink-0 rounded-\[3px\] object-contain" \/>/, '姊妹作品胶囊须带图标');
    assert.doesNotMatch(wd, /welcomeMaintainPrefix|welcomeFeedbackBubbleA/, '多行开源/反馈大框须已彻底废除');
    // ⑤ Header 帮助入口串到 Tab 2
    assert.match(hd, /HelpCircle className="w-4 h-4"/, 'Header 须有 w-4 h-4 的 HelpCircle');
    assert.match(hd, /title=\{t.helpTitle\}/, '帮助按钮须有中英悬停 title');
    assert.match(hd, /onOpenGuide/, 'Header 须接收打开回调');
    assert.match(app, /setWelcomeTab\('guide'\)/, '帮助入口须把分区指到 guide');
    assert.match(app, /initialTab=\{welcomeTab\}/, 'App 须把分区传给弹窗');
    assert.match(app, /useState<'overview' \| 'guide'>\('overview'\)/, '初始分区须为 overview（首开不跳 Tab）');
    // ⑥ i18n 双语齐备 + 概览工具模块已同步 3D 能力
    for (const k of ['welcomeTabOverview', 'welcomeTabGuide', 'welcomeTabsAria', 'helpTitle', 'guideCard1Title', 'guideCard4Desc']) {
      const n = (i18n.match(new RegExp(`${k}:`, 'g')) ?? []).length;
      assert.equal(n, 2, `${k} 须 zh/en 各一份（实测 ${n}）`);
    }
    assert.ok(i18n.includes('3D 空间原子模型 · 实物展台 · 语音跟读'), '概览的工具模块文案须同步 3D 能力');
    assert.ok(i18n.includes('3D atom model · specimen dashboard · recite mode'), '英文概览同样须同步');
    // ⑥b 导语已移除：能力说明只在工具模块里讲一次，不得回潮成弹窗顶部的长段落
    assert.doesNotMatch(wd, /welcomeIntro/, '概览导语须已彻底移除（避免与四学科卡片重复）');
    assert.doesNotMatch(i18n, /welcomeIntro:/, 'i18n 不得再保留导语文案');
    for (const kw of ['微观 3D 空间原子模型', '实物展台', '语音跟读']) {
      assert.ok(i18n.includes(kw), `工具模块须包含关键能力「${kw}」`);
    }
    // ⑦ 指引页结构锁定为「4 张卡片 + 1 条底部提示」；多出来的重复块一律不得回潮
    assert.match(wd, /import \{[^}]*\bLightbulb\b[^}]*\} from 'lucide-react'/, '提示须用 Lucide Lightbulb');
    assert.ok(!/💡/.test(wd) && !/💡/.test(i18n), '不得用 Emoji 充当图标（项目仅用 Lucide）');
    assert.match(wd, /t\.guideTipLabel/, '须有单行提示');
    assert.match(wd, /t\.guideTipBody/, '须有单行提示正文');
    const stepRefs = (wd.match(/t\.guideStep\dTitle/g) ?? []).length;
    assert.equal(stepRefs, 0, `「探究方法」块须彻底删除（实测残留 ${stepRefs} 处引用）`);
    assert.doesNotMatch(wd, /guideMethodLabel/, '不得再渲染探究方法小标题');
    assert.doesNotMatch(i18n, /guideMethodLabel:|guideStep\d(Title|Desc):/, '不得再保留探究方法文案（导语已交代预测/探索/结论）');
    // ⑧ 事实口径 + 反重复：键盘说明不再出现在导览里（周期表详情卡自带 ← → 按钮），
    //    且不得再出现「全局方向键漫游」这类失实说法
    assert.doesNotMatch(i18n, /全局方向键/, '不得宣称周期表全局方向键漫游（实测仅详情卡内 ← →）');
    assert.doesNotMatch(i18n, /Arrow keys roam/, '英文同样不得宣称');
    const tipBodies = i18n.match(/guideTipBody:\s*'[^']*'/g) ?? [];
    assert.equal(tipBodies.length, 2, `单行提示须 zh/en 各一（实测 ${tipBodies.length}）`);
    for (const tb of tipBodies) {
      assert.ok(!tb.includes('← →') && !/Esc|Arrow|←|→/.test(tb), `底部提示不得复述键盘键位：${tb.slice(0, 40)}…`);
    }
    // 导览第三条 = 工具/速查行（不再单独占用一条讲周期表键盘）
    assert.match(i18n, /guideCard3Title: '可视化展台与速查'/, '第三条须为「可视化展台与速查」');
    assert.match(i18n, /guideCard3Title: 'Visual dashboards & references'/, '英文同名');
    // ⑨ 净化开发/技术机制词：防作弊、防 Bug 说明一律不得留在面向学生的文案里
    for (const bad of ['防作弊', 'anti-cheat', '首末位', '不环绕', '上一个读音', 'pronunciation', 'cancelled']) {
      assert.ok(!i18n.includes(bad), `文案不得出现机制/开发词「${bad}」`);
    }
    for (const k of ['guideCard1Title', 'guideCard4Desc', 'guideTipLabel', 'guideTipBody']) {
      const n = (i18n.match(new RegExp(`${k}:`, 'g')) ?? []).length;
      assert.equal(n, 2, `${k} 须 zh/en 各一份（实测 ${n}）`);
    }

    /* ⑩ AI 连通性状态机 + 顶栏角标（旧版四态守卫并入此处，不新增用例数）
       ─────────────────────────────────────────────────────────────────────
       这一节守的是「角标说的话必须为真」：
       - 结论有时效（checkedAt + 24h），过期必须降级，不许拿旧绿冒充当前状态；
       - 置绿只能靠真实证据（/models 命中当前模型 或 chat 探针 200），列出模型不算；
       - 探针先便宜后昂贵（先 /models，0 token），并发去重，页面加载不发请求；
       - 形状表确定性：待验证/验证中用空心环，实心只用于已有结论的状态。 */
    {
      // ⑩a Header：图标开面板、角标单独开卡片（必须是兄弟按钮，不能嵌套 button）
      assert.equal((hd.match(/data-ai-health-trigger/g) ?? []).length, 1, '角标须有唯一可点入口');
      assert.equal((hd.match(/data-ai-health-card/g) ?? []).length, 1, '健康卡片须唯一');
      assert.match(hd, /onClick=\{\(\) => setAiOpen\(!aiOpen\)\}/, '图标本体仍须开 AI 面板');
      assert.match(
        hd,
        /<\/button>\s*\{!isOffline && shownStatus !== 'unconfigured' && \(\s*<button/,
        '角标须是图标按钮的**兄弟**按钮（嵌套 <button> 非法），且未配置时不得渲染',
      );
      // 未配置不渲染角标：没配置不是故障，不该占一个告警色小点
      assert.match(hd, /shownStatus !== 'unconfigured' && \(/, '未配置须整块不渲染角标');
      // F1：角标要有 title（桌面悬停即得一句话；此前只有 aria-label，桌面零提示）
      assert.match(hd, /title=\{`\$\{HEALTH_TITLE\[shownStatus\]\[lang\]\} · \$\{aiCheckedAtLabel/, '角标须有动态 title（状态 + 上次检测）');
      // F2：标准 Badge —— 16×16 盒贴在字形右上角（压住一角），旧的「抬到 -26px 悬空」不得回归
      assert.match(
        hd,
        /absolute right-0 top-0 z-10 grid h-4 w-4 place-items-center rounded-full/,
        '角标须贴合成标准 Badge（16×16，落在图标右上角内）',
      );
      assert.doesNotMatch(hd, /-top-\[26px\]/, '旧的悬空 26px 定位不得回归（圆点会飘离图标）');
      assert.doesNotMatch(hd, /grid h-9 w-9 place-items-(end|center) rounded-full/, '命中盒不得再撑到 36×36（会吞掉图标中心）');
      // 几何不许吞掉图标中心：盒下沿 16 < 字形中心 18，图标中心仍归图标按钮
      assert.match(hd, /flex h-9 w-9 items-center justify-center rounded-lg/, '图标按钮须 36×36');
      // 形状与配色统一走 shownStatus（过期即降级的展示态），不再是裸 status：
      // 角标只要还读裸 status，「卡片写着已过期、角标却说已就绪」就会重现。
      assert.match(hd, /isHollowStatus\(shownStatus\) \?/, '形状须由状态机统一判定（isHollowStatus）');
      assert.match(hd, /AI_STATUS_HOLLOW\[shownStatus\]/, '空心环类名须来自 AI_STATUS_HOLLOW');
      assert.match(hd, /AI_STATUS_DOT\[shownStatus\]/, '实心点类名须来自 AI_STATUS_DOT');
      // 过期降级：valid/invalid 超出 24h TTL 后按「待验证」渲染，且不再复述过期原因。
      // verifying 刻意不参与降级——它沿用上一次的 checkedAt，那不是过期结论，
      // 若一并降级，「验证中」的呼吸环会被吞掉。
      assert.match(
        hd,
        /checkedStale && \(aiStatus\.status === 'valid' \|\| aiStatus\.status === 'invalid'\)/,
        '过期结论须降级为「待验证」（渲染期按 isStatusFresh 复核）',
      );
      assert.equal((hd.match(/AI_STATUS_LABEL\[shownStatus\]/g) ?? []).length, 1, '悬浮提示须用展示态');
      assert.match(hd, /!expiredConclusion && aiStatus\.detail !== ''/, '过期后不得复述 24 小时前的失败原因');
      // 过期判定在渲染期做，就必须有一次「到点重渲染」的触发，否则标签页开着不动的角标会一直停在旧绿
      assert.match(hd, /at \+ AI_STATUS_TTL_MS - Date\.now\(\)/, 'TTL 到点须一次性重渲染（定时器，不是轮询）');
      // 跨标签同步：storage 是唯一能听见「别的标签改了配置 / 写了新结论」的通道
      const statusSrc = readFileSync('src/lib/ai-status.ts', 'utf8');
      assert.match(statusSrc, /addEventListener\('storage'/, '状态须跨标签同步（storage 事件）');
      assert.match(
        statusSrc,
        /refreshAiStatus\(m\.loadAiConfig\(\)\)/,
        '跨标签重算须复用 loadAiConfig（动态 import 断开 ai-config ↔ ai-status 环）',
      );
      // 会话级静默自检 + 轮询：没有它们，角标会停在旧结论上，用户还得出手动点「重新验证」
      assert.match(statusSrc, /export function runSessionProbe\(\): void/, '须导出会话自检入口（可测）');
      assert.match(statusSrc, /if \(isStatusFresh\(snapshot\.checkedAt\)\) return;/, '结论仍新鲜时不得联网');
      assert.match(statusSrc, /window\.sessionStorage\.getItem\(SESSION_PROBE_KEY\)/, '每标签页会话只探一次（sessionStorage 打标）');
      assert.match(statusSrc, /void verifyAiStatus\(cfg, \{ auto: true \}\)/, '自检须走 auto 探针（单次、无重试、失败不落盘）');
      assert.match(
        statusSrc,
        /typeof document !== 'undefined'[\s\S]{0,200}document\.readyState === 'complete'/,
        '自检须等 load 再跑，且只在真实浏览器里调度（测试环境不得被定时器偷偷联网）',
      );
      // 轮询：可见时定时重测，隐藏时不发；切回前台/网络恢复立即补测；静默不闪「验证中」
      assert.match(statusSrc, /export const AI_POLL_HEALTHY_MS = 5 \* 60 \* 1000/, '健康时轮询须为 5 分钟（稀疏）');
      assert.match(statusSrc, /export const AI_POLL_BROKEN_MS = 45 \* 1000/, '非健康时轮询须为 45 秒（勤快）');
      // 退避：坏状态不许用固定 45s 死磕用户端点（挂机一节课 ≈ 60 次失败请求）
      assert.match(statusSrc, /export const AI_POLL_MAX_BREAK_MS = 5 \* 60 \* 1000/, '退避须封顶 5 分钟');
      assert.match(statusSrc, /export function nextPollDelayMs\(\): number/, '退避须是可用纯函数（可测）');
      assert.match(statusSrc, /const factor = 2 \*\* Math\.min\(failedProbes, AI_POLL_BACKOFF_STEPS\)/, '退避须按 2 倍指数增长');
      assert.match(statusSrc, /export function resetPollBackoff\(\): void/, '退避须可复位');
      assert.match(statusSrc, /if \(!opts\?\.silent\) resetPollBackoff\(\)/, '手动验证须复位退避');
      assert.match(statusSrc, /if \(reason !== 'interval'\)[\s\S]{0,220}resetPollBackoff\(\)/, '切回前台/网络恢复须复位退避');
      assert.match(statusSrc, /if \(result === 'valid'\) failedProbes = 0/, '探到绿须复位退避');
      assert.match(statusSrc, /export async function pollAiStatus\(/, '须导出可测的轮询入口');
      assert.match(statusSrc, /navigator\.onLine === false\) return null/, '离线时不得轮询（会把「端点不通」与「整机没网」混成一个红点）');
      assert.match(statusSrc, /document\.visibilityState === 'visible'[\s\S]{0,80}pollAiStatus\('interval'\)/, '仅在页面可见时定时轮询');
      assert.match(statusSrc, /addEventListener\('visibilitychange'[\s\S]{0,120}pollAiStatus\('visible'\)/, '切回前台须立即补测');
      assert.match(statusSrc, /addEventListener\('online'[\s\S]{0,60}pollAiStatus\('online'\)/, '网络恢复须立即补测');
      assert.match(statusSrc, /if \(inFlight\) return null;/, '轮询不得与在途验证叠请求');
      assert.match(statusSrc, /if \(!opts\?\.silent\) emit\(\{ status: 'verifying'/, '轮询须静默：不得每隔几分钟闪一次「验证中」');
      assert.match(statusSrc, /verifyAiStatus\(cfg, \{ silent: true \}\)/, '轮询探测须用 silent 模式');
      // 卡片六项：状态标题 / 模型 / 端点 / 上次检测 / 重新验证 / 去设置，缺一项就等于把用户又推回设置页
      for (const kw of ['模型', 'Endpoint', '上次检测', '重新验证', '去设置']) {
        assert.ok(hd.includes(kw), `健康卡片须含「${kw}」`);
      }
      assert.match(hd, /verifyAiStatus\(loadAiConfig\(\)\)/, '「重新验证」须就地调用 verifyAiStatus（读已保存配置）');
      assert.match(hd, /disabled=\{aiStatus\.status === 'verifying'\}/, '验证中须禁用按钮，避免叠请求');
      assert.match(hd, /onClick=\{\(\) => \{ setShowHealth\(false\); openSettings\(\); \}\}/, '「去设置」须直接落到设置视图');
      assert.match(hd, /aiCheckedAtLabel\(aiStatus\.checkedAt, lang\)/, '须显示「多久以前检测」');
      assert.match(hd, /checkedStale &&/, '过期须显式标注（不能只显示「3 天前」让人误以为有效）');
      assert.match(hd, /AI_STATUS_DETAIL\[aiStatus\.detail\]\[lang\]/, 'invalid 须给出可排查的原因');

      // ⑩b AiAssistant：面板首开静默验证；列出模型绝不置绿
      assert.match(panelSrc, /verifyAiStatus\(config, \{ auto: true \}\)/, '面板首开须静默验证一次（auto 模式）');
      assert.match(panelSrc, /settingsSignal > 0/, '「去设置」信号须被面板消费');
      assert.doesNotMatch(
        panelSrc,
        /ids\.length > 0 && formMatchesSaved && config\) reportAiSuccess/,
        '获取模型成功后不得置绿：/models 只证明凭证与端点通，不证明模型能对话',
      );

      // ⑩g 服务商胶囊：去括号后缀 + 品牌微标 + 中英双标签 + 等高不折行
      // （并入本用例，不新增用例数）
      {
        const cfgSrc = readFileSync('src/lib/ai-config.ts', 'utf8');
        const block = cfgSrc.slice(cfgSrc.indexOf('export const AI_PROVIDERS'), cfgSrc.indexOf('/** 服务商显示名的唯一取法'));
        // 名称行单独取：note 里合法的括号（如「（自建代理）」）不算违规
        const names = [...block.matchAll(/name: '([^']+)'/g)].map((m) => m[1]);
        const namesEn = [...block.matchAll(/nameEn: '([^']+)'/g)].map((m) => m[1]);
        // 括号里塞公司名（阿里云 / 月之暗面 / 火山方舟）会让胶囊长短不齐、窄屏折行，
        // 且与旁边的品牌 logo 重复表达同一件事——名称行一律禁止括号。
        for (const n of names) {
          assert.doesNotMatch(n, /[（）()]/, `服务商中文名「${n}」不得含括号后缀`);
        }
        for (const bad of ['阿里云', '月之暗面', '火山方舟', '深度求索']) {
          assert.ok(!names.some((n) => n.includes(bad)), `服务商名称不得再含「${bad}」这类公司名`);
        }
        assert.equal(names.length, 6, `6 个服务商都须有中文名（实测 ${names.length}）`);
        assert.equal(namesEn.length, 6, '每个服务商都须有英文名（en-US 用商标写法）');
        for (const n of ['DeepSeek', '通义千问 Qwen', 'Kimi', '智谱 GLM', '豆包 Doubao', '自定义']) {
          assert.ok(names.includes(n), `中文名须为「${n}」`);
        }
        for (const n of ['DeepSeek', 'Qwen', 'Kimi', 'Zhipu GLM', 'Doubao']) {
          assert.ok(namesEn.includes(n), `英文名须为「${n}」`);
        }
        assert.match(cfgSrc, /export function providerLabel\(p: AiProvider, lang: 'zh' \| 'en'\): string/, '须有唯一的取名函数，避免两处各写一套');

        // 运行时不变式（源码断言抓不到这类错）：每个真实服务商的 id 都要能落到一个品牌标上。
        // 曾经踩过：图标表按品牌名建键（qwen/kimi/doubao），而 providerId 是平台名
        // （dashscope/moonshot/volcengine），查不到就静默退化成插头——界面"有图标"，全是同一个插头。
        for (const p of AI_PROVIDERS) {
          if (p.id === 'custom') continue;
          assert.ok(PROVIDER_ICON_KEY[p.id], `服务商 ${p.id} 缺品牌标映射（会静默退化成插头）`);
        }
        assert.equal(PROVIDER_ICON_KEY.dashscope, 'qwen', '通义千问的 id 是 dashscope，品牌标是 qwen');
        assert.equal(PROVIDER_ICON_KEY.moonshot, 'kimi', 'Kimi 的 id 是 moonshot，品牌标是 kimi');
        assert.equal(PROVIDER_ICON_KEY.volcengine, 'doubao', '豆包的 id 是 volcengine，品牌标是 doubao');
        assert.equal(PROVIDER_ICON_KEY.custom, undefined, '自定义端点没有品牌标，须走插头');
        // 中英取名：中文含中文前缀，英文是商标写法（且不再带括号）
        const byId = Object.fromEntries(AI_PROVIDERS.map((p) => [p.id, p as AiProvider]));
        assert.equal(providerLabel(byId.dashscope, 'zh'), '通义千问 Qwen');
        assert.equal(providerLabel(byId.dashscope, 'en'), 'Qwen');
        assert.equal(providerLabel(byId.zhipu, 'en'), 'Zhipu GLM');
        assert.equal(providerLabel(byId.volcengine, 'zh'), '豆包 Doubao');

        // 官方入口链接：跟着服务商走，且必须指向厂商自己的域名。
        // 为什么钉域名：这类链接最容易在"顺手补一个"时变成第三方教程站，
        // 而学生点进去要的是申请 Key 的地方，不是别人的博客。
        const DOC_HOSTS: Record<string, string> = {
          deepseek: 'platform.deepseek.com',
          dashscope: 'bailian.console.aliyun.com',
          moonshot: 'platform.moonshot.cn',
          zhipu: 'open.bigmodel.cn',
          volcengine: 'console.volcengine.com',
        };
        for (const [id, host] of Object.entries(DOC_HOSTS)) {
          const url = byId[id]?.docUrl;
          assert.ok(url, `服务商 ${id} 须有官方 Key 申请入口（docUrl）`);
          assert.ok(url.startsWith('https://'), `${id} 的 docUrl 必须是 https`);
          assert.ok(url.includes(host), `${id} 的 docUrl 须指向官方域名 ${host}（实测 ${url}）`);
        }
        assert.equal(byId.custom?.docUrl, undefined, '自定义端点没有官方入口，不得硬指一个官网');
        // 面板里必须真的渲染它（且新窗口打开、断开 opener）
        assert.match(panelSrc, /href=\{provider\.docUrl\}/, 'API Key 标签行须渲染官方入口');
        assert.match(panelSrc, /target="_blank"/, '官方入口须新窗口打开，不打断正在填的表单');
        assert.match(panelSrc, /rel="noopener noreferrer"/, '外链须断 opener');

        // 品牌微标：单色 currentColor、24 栅格、无 hex；自定义端点退化为插头
        const icoSrc = readFileSync('src/components/ui/ProviderIcon.tsx', 'utf8');
        assert.match(icoSrc, /viewBox="0 0 24 24"/, '品牌标须为 24 栅格');
        assert.match(icoSrc, /fill="currentColor"/, '品牌标须继承文字色（不写死品牌色）');
        for (const id of ['deepseek', 'qwen', 'kimi', 'zhipu', 'doubao']) {
          assert.ok(icoSrc.includes('  ' + id + ': ['), `须内联 ${id} 的品牌标`);
        }
        // 智谱：官方现行标是几何折线 Z（z.ai 站内 logo / open.bigmodel.cn favicon 同一造型）。
        // lobehub 的 `zhipu.svg` 是旧版「点阵星簇」，现行品牌里没有这个东西，不得复活。
        assert.ok(icoSrc.includes('M12.105 2L9.927 4.953H.653L2.83 2h9.276z'), '智谱须用官方几何 Z 标（zai.svg 轮廓）');
        assert.ok(!icoSrc.includes('M9.671 5.365'), '智谱旧的点阵星簇标已废弃，不得再内联');
        assert.match(icoSrc, /<Plug /, '自定义端点无品牌标，须退化为插头而不是空白');
        assert.doesNotMatch(icoSrc, /#[0-9a-fA-F]{3,6}\b/, '品牌标不得硬写 hex 颜色（品牌色一律走 --brand-* 令牌）');
        // 品牌色：logo 默认仍继承 --muted，只在悬停 / 已选时点亮（令牌定义在 index.css，两套明暗取值）
        const cssBrand = readFileSync('src/index.css', 'utf8');
        // 智谱官方标是纯黑白，所以它不染品牌色、直接继承 --fg；其余四家必须是实色
        for (const b of ['deepseek', 'qwen', 'kimi', 'doubao']) {
          assert.match(cssBrand, new RegExp(`--brand-${b}: #[0-9a-f]{6};`), `须定义 --brand-${b}（浅色实色）`);
        }
        assert.match(
          cssBrand,
          /--brand-zhipu: var\(--fg\);/,
          '智谱官方标是黑白，须继承 --fg 而不是编一个蓝（编出来会和另外三家蓝撞色）',
        );
        const brandDark = cssBrand.match(/html\.dark \{[\s\S]*?--brand-deepseek: (#[0-9a-f]{6})/)?.[1];
        const brandLight = cssBrand.match(/--brand-deepseek: (#[0-9a-f]{6})/)?.[1];
        assert.ok(brandDark && brandLight && brandDark !== brandLight, '品牌色须有暗色另一档（深蓝压暗底会发黑）');

        // 五个品牌色必须真的分得开。旧版是 #1766e9 / #3655ff / #3370ff 三条几乎同色的蓝
        // （色相跨度 13°），16px 下就是三块一样的方块——这里把跨度钉死，防回归。
        const hueOf = (hex: string) => {
          const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
          const mx = Math.max(...v);
          const mn = Math.min(...v);
          if (mx === mn) return 0;
          const d = mx - mn;
          const h = mx === v[0] ? (v[1] - v[2]) / d + (v[1] < v[2] ? 6 : 0) : mx === v[1] ? (v[2] - v[0]) / d + 2 : (v[0] - v[1]) / d + 4;
          return h * 60;
        };
        const lightBrands = ['deepseek', 'qwen', 'kimi', 'doubao'].map(
          (b) => cssBrand.match(new RegExp(`^  --brand-${b}: (#[0-9a-f]{6});`, 'm'))?.[1] as string,
        );
        assert.ok(lightBrands.every(Boolean), '四个实色品牌色须写在 :root 首列');
        const hues = lightBrands.map(hueOf);
        assert.ok(
          Math.max(...hues) - Math.min(...hues) >= 40,
          `品牌色色相跨度只有 ${Math.round(Math.max(...hues) - Math.min(...hues))}°，16px 下会糊成同一色：${lightBrands.join(' ')}`,
        );
        assert.match(panelSrc, /ai-provider-chip tap-ai-chip tap-area inline-flex h-7/, '胶囊须带 .ai-provider-chip 钩子（.tap-ai-chip 负责触屏减重）');
        assert.match(panelSrc, /data-brand=\{p\.id\}/, '胶囊须带 data-brand（悬停品牌色的唯一依据）');
        assert.match(panelSrc, /const PROVIDER_BRAND_CLS: Record<string, string> = \{/, '须有品牌色表（完整字面量）');
        // 悬停品牌色走普通 CSS（Tailwind group-hover 变体实测不生效）
        assert.match(cssBrand, /\[data-brand='deepseek'\]:hover svg \{ color: var\(--brand-deepseek\); \}/, '须按 data-brand 写悬停品牌色');
        assert.match(panelSrc, /active \? brand : ''/, '未选态图标不写颜色，交给继承 + 悬停规则');
        // 反例：图标上若写死 --muted，会与悬停规则同层竞争并把品牌色压死
        assert.doesNotMatch(panelSrc, /transition-colors \$\{active \? brand : 'text-\[var\(--muted\)\]'\}/, '未选态不得在图标上写死 --muted');

        // 胶囊：h-7 等高 + whitespace-nowrap 不折行 + rounded-full + 14px 图标
        assert.match(
          panelSrc,
          /inline-flex h-7 items-center justify-center gap-1\.5 whitespace-nowrap rounded-full border px-2\.5/,
          '服务商须为等高胶囊，且单行不折',
        );
        assert.match(panelSrc, /className=\{`h-4 w-4 shrink-0 transition-colors \$\{active \? brand/, '须渲染 16px 品牌标');
        assert.match(panelSrc, /<span>\{providerLabel\(p, lang\)\}<\/span>/, '胶囊文字须走 providerLabel');
        assert.match(panelSrc, /aria-pressed=\{active\}/, '胶囊须暴露选中态');
        assert.ok(panelSrc.includes('API Key (${providerLabel(provider, lang)})'), 'API Key 标签须带上当前服务商名');
        // 未激活 --muted / 激活 --fg：颜色只走令牌，随主题自适应
        assert.match(panelSrc, /border-transparent text-\[var\(--muted\)\]/, '未选中须用 --muted');
        assert.match(panelSrc, /bg-\[var\(--accent-light\)\] text-\[var\(--fg\)\] font-medium/, '选中须用 --fg 加粗');
      }

      // ⑩c 纯函数：时效判定（含未来时间戳）
      const now = Date.UTC(2026, 9, 20, 12, 0, 0);
      assert.equal(isStatusFresh(now - 1000, now), true, '刚刚检测过须算新鲜');
      assert.equal(isStatusFresh(now - AI_STATUS_TTL_MS, now), true, '恰好 24h 边界内仍算新鲜');
      assert.equal(isStatusFresh(now - AI_STATUS_TTL_MS - 1, now), false, '超过 24h 必须判过期');
      assert.equal(isStatusFresh(null, now), false, '从未检测不算新鲜');
      assert.equal(isStatusFresh(now + 60000, now), false, '未来时间戳不可信（改时钟/漂移）');
      assert.equal(AI_STATUS_TTL_MS, 24 * 60 * 60 * 1000, 'TTL 须为 24 小时');

      // ⑩d 形状/文案表：五态齐备，空心只给「结论未定」
      const statuses = ['unconfigured', 'configured', 'verifying', 'valid', 'invalid'] as const;
      for (const s of statuses) {
        assert.ok(AI_STATUS_LABEL[s]?.zh && AI_STATUS_LABEL[s]?.en, `状态 ${s} 须中英文案齐备`);
      }
      assert.equal(AI_STATUS_DOT.configured, '', '待验证不得再渲染实心点');
      // 未配置不再占角标：语义上是空态，不是故障（旧版用 --warn，浅色下与红难分）
      assert.equal(AI_STATUS_DOT.unconfigured, '', '未配置不得渲染角标');
      assert.ok(AI_STATUS_HOLLOW.configured.includes('border-2'), '待验证须为空心环（border-2）');
      assert.ok(AI_STATUS_HOLLOW.configured.includes('border-[var(--muted)]'), '空心环须走中性灰 --muted');
      assert.doesNotMatch(
        AI_STATUS_HOLLOW.configured + AI_STATUS_HOLLOW.verifying + AI_STATUS_DOT.unconfigured,
        /--warn/,
        '角标不得再用琥珀：浅色主题下与红仅差 21° 色相、1 单位明度，无法区分「未验证」与「不通」',
      );
      assert.ok(AI_STATUS_HOLLOW.verifying.includes('motion-safe:animate-pulse'), '验证中须有尊重 reduced-motion 的呼吸');
      assert.equal(isHollowStatus('configured'), true);
      assert.equal(isHollowStatus('verifying'), true);
      assert.equal(isHollowStatus('valid'), false, '已就绪须是实心（有确定结论）');
      assert.equal(isHollowStatus('invalid'), false);
      for (const d of ['auth', 'notfound', 'model', 'network', 'rejected', 'server', 'badurl'] as const) {
        assert.ok(AI_STATUS_DETAIL[d]?.zh && AI_STATUS_DETAIL[d]?.en, `原因码 ${d} 须中英文案齐备`);
      }

      // ⑩e 人话时间
      assert.equal(aiCheckedAtLabel(null, 'zh'), '从未检测');
      assert.equal(aiCheckedAtLabel(now - 30000, 'zh', now), '刚刚');
      assert.equal(aiCheckedAtLabel(now - 5 * 60000, 'zh', now), '5 分钟前');
      assert.equal(aiCheckedAtLabel(now - 3 * 3600000, 'zh', now), '3 小时前');
      assert.equal(aiCheckedAtLabel(now - 3 * 86400000, 'en', now), '3 d ago');

      // ⑩f 运行时：真实跑一遍状态机（假 window.localStorage + 假 fetch）
      const g = globalThis as unknown as { window?: unknown; fetch: typeof fetch };
      const store = new Map<string, string>();
      const fakeWindow = {
        localStorage: {
          getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
          setItem: (k: string, v: string) => { store.set(k, v); },
          removeItem: (k: string) => { store.delete(k); },
        },
      };
      const prevWindow = g.window;
      const realFetch = g.fetch;
      const calls: string[] = [];
      let bodies: string[] = [];
      const mkRes = (status: number, body: unknown = {}) =>
        ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response;
      const cfg = {
        providerId: 'custom',
        apiKey: 'test-key-placeholder-0000',
        baseUrl: 'https://api.example.com/v1',
        model: 'm1',
        agreed: true,
      };
      await (async () => {
        try {
          g.window = fakeWindow;
          g.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
            calls.push(String(url));
            bodies.push(String(init?.body ?? ''));
            return mkRes(200, { data: [{ id: 'm1' }, { id: 'm2' }] });
          }) as typeof fetch;

          // 未配置：不发请求
          refreshAiStatus(null);
          assert.equal(getAiStatus().status, 'unconfigured');
          assert.equal(calls.length, 0, '未配置时不得发任何请求');

          // 配置齐全但无结论 → 待验证；refresh 本身不联网（零轮询）
          refreshAiStatus(cfg);
          assert.equal(getAiStatus().status, 'configured');
          assert.equal(getAiStatus().checkedAt, null);
          assert.equal(calls.length, 0, 'refreshAiStatus 不得联网');

          // 探针：/models 命中当前模型 → 0 token 置绿
          assert.equal(await verifyAiStatus(cfg), 'valid');
          assert.equal(calls.length, 1, '命中 /models 后不得再发 chat 探针');
          assert.match(calls[0], /\/models$/, '第一跳必须是 /models');
          const savedAt = getAiStatus().checkedAt;
          assert.ok(savedAt !== null && Math.abs(Date.now() - savedAt) < 5000, '置绿须记录 checkedAt');

          // 过期降级：25 小时前的结论必须回到待验证，但保留时间供卡片显示
          const fp = aiConfigFingerprint(cfg);
          store.set('stem-ai-status', JSON.stringify({
            fingerprint: fp, status: 'valid', checkedAt: Date.now() - 25 * 3600000, detail: '',
          }));
          refreshAiStatus(cfg);
          assert.equal(getAiStatus().status, 'configured', '超过 24h 的绿点必须降级');
          assert.ok(getAiStatus().checkedAt !== null, '降级后仍须保留上次检测时间');

          // 指纹变化（换模型）→ 旧结论立即作废
          store.set('stem-ai-status', JSON.stringify({ fingerprint: fp, status: 'valid', checkedAt: Date.now(), detail: '' }));
          refreshAiStatus({ ...cfg, model: 'm2' });
          assert.equal(getAiStatus().status, 'configured', '换模型后不得沿用旧结论');
          assert.equal(getAiStatus().checkedAt, null, '换配置后旧检测时间不再属于当前配置');

          // 端点不支持 /models（404）→ 降级 chat 探针，且探针必须 max_tokens=1
          calls.length = 0;
          bodies = [];
          let n = 0;
          g.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
            calls.push(String(url));
            bodies.push(String(init?.body ?? ''));
            n += 1;
            return n === 1 ? mkRes(404) : mkRes(200, { choices: [{ message: { content: 'p' } }] });
          }) as typeof fetch;
          assert.equal(await verifyAiStatus(cfg), 'valid', '/models 不支持时应由 chat 探针给出结论');
          assert.equal(calls.length, 2);
          assert.match(calls[1], /\/chat\/completions$/, '第二跳才是 chat 探针');
          assert.ok(bodies[1].includes('"max_tokens":1'), 'chat 探针必须 max_tokens=1（控成本）');

          // 鉴权失败（401）→ invalid/auth，且不再白跑 chat
          calls.length = 0;
          g.fetch = (async (url: string | URL | Request) => {
            calls.push(String(url));
            return mkRes(401);
          }) as typeof fetch;
          assert.equal(await verifyAiStatus(cfg), 'invalid');
          assert.equal(getAiStatus().detail, 'auth');
          assert.equal(calls.length, 1, '401 之后不得再发 chat 探针');

          // 429 → 不判死刑：回到待验证，且不写存档
          store.delete('stem-ai-status');
          g.fetch = (async () => mkRes(429)) as typeof fetch;
          assert.equal(await verifyAiStatus(cfg), 'configured', '限流是服务商此刻状态，不代表配置错');
          assert.equal(store.has('stem-ai-status'), false, '429 不得写入结论存档');

          // 并发去重：连点只发一次请求
          calls.length = 0;
          let release: (() => void) | null = null;
          const gate = new Promise<void>((res) => { release = () => res(); });
          g.fetch = (async (url: string | URL | Request) => {
            calls.push(String(url));
            await gate;
            return mkRes(200, { data: [{ id: 'm1' }] });
          }) as typeof fetch;
          const p1 = verifyAiStatus(cfg);
          const p2 = verifyAiStatus(cfg);
          assert.equal(getAiStatus().status, 'verifying', '验证期间须进入 verifying 态');
          (release as unknown as () => void)();
          const [r1, r2] = await Promise.all([p1, p2]);
          assert.equal(r1, r2, '并发调用须返回同一结论');
          assert.equal(calls.length, 1, '验证进行中再点不得叠请求');

          // 轮询：结论是红的时候，不该只在 24h 之后才重新判断（用户修好 Key 就得手动点）
          assert.equal(AI_POLL_HEALTHY_MS, 5 * 60 * 1000, '健康时轮询间隔 5 分钟');
          assert.equal(AI_POLL_BROKEN_MS, 45 * 1000, '非健康时轮询间隔 45 秒（否则修好了还得等到下一轮）');
          // 轮询走的是 loadAiConfig（读已保存配置），所以这份配置必须在存档里
          store.set('stem-ai-config', JSON.stringify(cfg));
          store.set('stem-ai-status', JSON.stringify({
            fingerprint: aiConfigFingerprint(cfg), status: 'invalid', checkedAt: Date.now() - 60000, detail: 'auth',
          }));
          refreshAiStatus(cfg);
          assert.equal(getAiStatus().status, 'invalid', '新鲜的红结论载入时照原样恢复');
          calls.length = 0;
          g.fetch = (async (url: string | URL | Request) => {
            calls.push(String(url));
            return mkRes(200, { data: [{ id: 'm1' }] });
          }) as typeof fetch;
          assert.equal(await pollAiStatus('interval'), 'valid', '轮询须把「红」自动纠正为「绿」');
          assert.equal(getAiStatus().status, 'valid');
          assert.equal(calls.length, 1, '轮询一次只发一个 /models（0 token）');
          assert.match(calls[0], /\/models$/, '轮询只走便宜的 /models，不得打 chat');
          assert.equal(nextPollDelayMs(), AI_POLL_HEALTHY_MS, '探到绿后间隔须回到 5 分钟');

          // 退避：连红不许死磕 45s（挂机一节课 ≈ 60 次失败请求），逐级翻倍并封顶 5 分钟
          resetPollBackoff();
          store.set('stem-ai-status', JSON.stringify({
            fingerprint: aiConfigFingerprint(cfg), status: 'invalid', checkedAt: Date.now() - 60000, detail: 'auth',
          }));
          refreshAiStatus(cfg);
          assert.equal(nextPollDelayMs(), AI_POLL_BROKEN_MS, '首次失败按 45s 起算');
          g.fetch = (async (url: string | URL | Request) => {
            calls.push(String(url));
            return mkRes(401);
          }) as typeof fetch;
          assert.equal(await pollAiStatus('interval'), 'invalid');
          assert.equal(nextPollDelayMs(), AI_POLL_BROKEN_MS * 2, '第 1 次失败后退到 90s');
          await pollAiStatus('interval');
          assert.equal(nextPollDelayMs(), AI_POLL_BROKEN_MS * 4, '第 2 次失败后退到 180s');
          await pollAiStatus('interval');
          assert.equal(nextPollDelayMs(), AI_POLL_MAX_BREAK_MS, '第 3 次失败后封顶 5 分钟');
          await pollAiStatus('interval');
          assert.equal(nextPollDelayMs(), AI_POLL_MAX_BREAK_MS, '封顶后不再增长');
          // 手动验证 = 有人在处理 → 复位回 45s
          g.fetch = (async () => mkRes(401)) as typeof fetch;
          await verifyAiStatus(cfg);
          assert.equal(nextPollDelayMs(), AI_POLL_BROKEN_MS, '手动验证须把退避复位到 45s');

          // 离线不得轮询：那会把「端点不通」与「整机没网」混成同一个红点
          // （Node 的 navigator 是只读 getter，必须用 defineProperty 才能换）
          calls.length = 0;
          const navDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
          Object.defineProperty(globalThis, 'navigator', { value: { onLine: false }, configurable: true });
          try {
            assert.equal(await pollAiStatus('interval'), null, '离线时轮询须返回 null');
            assert.equal(calls.length, 0, '离线时一个请求都不许发');
          } finally {
            if (navDesc) Object.defineProperty(globalThis, 'navigator', navDesc);
            else delete (globalThis as { navigator?: unknown }).navigator;
          }
        } finally {
          g.fetch = realFetch;
          g.window = prevWindow;
          refreshAiStatus(null);
        }
      })();
    }
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   Physics 全面审计补充：力学 / 电学 / 光学核心公式的行为级单测
   （2026-10 审计批次。断言全部是数值等式与不变式，不是「源码里出现过某个魔数」）
   ══════════════════════════════════════════════════════════════════════════ */

describe('Physics 力学核：阿基米德原理与弹簧测力计', () => {
  test('浮力 F浮 = ρ液·g·V排（三种教材液体取整值）', () => {
    // ρ=1000 水、1200 浓盐水、800 酒精；V=1.5e-4 m³ 全浸；g=10
    // （体积取 1.5e-4 是为让酒精中每 0.1 档 ΔF浮=0.12N ≥ 0.1N 刻度，见 mechanics-core 注释）
    assert.ok(Math.abs(buoyantForce(1000, 1) - 1.5) < 1e-9);
    assert.ok(Math.abs(buoyantForce(1200, 1) - 1.8) < 1e-9);
    assert.ok(Math.abs(buoyantForce(800, 1) - 1.2) < 1e-9);
    // 半浸 → 恰好一半
    assert.ok(Math.abs(buoyantForce(1000, 0.5) - buoyantForce(1000, 1) / 2) < 1e-12);
    // 未浸入 → 0
    assert.equal(buoyantForce(1200, 0), 0);
  });

  test('V排 饱和：完全浸没后继续下沉，浮力不再增大（「深度不影响浮力」考点）', () => {
    // 关键不变式：vSub ≥ 1 时 V排 恒为物体自身体积
    for (const rho of [800, 1000, 1200]) {
      const full = buoyantForce(rho, 1);
      for (const deeper of [1.2, 1.5, 3, 10]) {
        assert.equal(
          buoyantForce(rho, deeper),
          full,
          `ρ=${rho} 时 vSub=${deeper} 的浮力应与完全浸没相同（V排 不得超过物体体积）`,
        );
        assert.equal(displacedVolume(deeper), STONE_VOLUME);
      }
    }
    // 反向：物体上浮/未浸入的负比例不得产生负浮力
    assert.equal(buoyantForce(1000, -1), 0);
  });

  test('弹簧测力计示数 F示 = G − F浮，且读数恒非负', () => {
    // 体积口径 1.5e-4 m³：全浸浮力 水 1.5N / 盐水 1.8N → 示数 0.5N / 0.2N
    assert.ok(Math.abs(springReading(1000, 1) - (STONE_WEIGHT - 1.5)) < 1e-9);
    assert.ok(Math.abs(springReading(1200, 1) - (STONE_WEIGHT - 1.8)) < 1e-9);
    assert.equal(springReading(1000, 0), STONE_WEIGHT);
    // 全域扫描：任何液体/浸入比例下读数都在 [0, G] 内（石块演示物恒下沉，F浮 < G）
    for (const rho of [800, 1000, 1200]) {
      for (let i = 0; i <= 10; i++) {
        const r = springReading(rho, i / 10);
        assert.ok(r >= 0 && r <= STONE_WEIGHT, `ρ=${rho} vSub=${i / 10} 示数越界：${r}`);
      }
    }
    // 完全浸没后示数恒定（用户审计点名项）
    assert.equal(springReading(1000, 1), springReading(1000, 3));
    // 浮力随浸入体积单调不减
    let prev = -1;
    for (let i = 0; i <= 10; i++) {
      const f = buoyantForce(1000, i / 10);
      assert.ok(f >= prev, '浸入体积增大浮力不得减小');
      prev = f;
    }
  });
});

describe('Physics 力学核：杠杆平衡条件', () => {
  test('力矩 M = F·l（多挂钩 = 同力臂多份力，力矩相加）', () => {
    assert.ok(Math.abs(torque(2, 3) - 2 * HOOK_WEIGHT * 3) < 1e-12); // 2 挂钩 × 3 格 = 3.0 N·格
    assert.ok(Math.abs(torque(2, 3) - 3.0) < 1e-12);
    // 多挂钩守恒：同一点上 2 + 3 个钩码 = 5 个钩码
    assert.ok(Math.abs(torque(2, 4) + torque(3, 4) - torque(5, 4)) < 1e-12);
  });

  test('F₁l₁ = F₂l₂ 判平衡；容差在 0.5N 粒度下等价于精确相等', () => {
    assert.ok(isLeverBalanced(torque(2, 3), torque(3, 2))); // 3.0 = 3.0
    assert.ok(!isLeverBalanced(torque(2, 3), torque(3, 3))); // 3.0 ≠ 4.5
    // 全域：0.5N 粒度 → 力矩差必为 0.5 的倍数，绝无「不相等的力矩被判平衡」
    let mismatch = 0;
    for (let m1 = 1; m1 <= 5; m1++) for (let d1 = 1; d1 <= 6; d1++)
      for (let m2 = 1; m2 <= 5; m2++) for (let d2 = 1; d2 <= 6; d2++) {
        const t1 = torque(m1, d1), t2 = torque(m2, d2);
        if (isLeverBalanced(t1, t2) !== (t1 === t2)) mismatch++;
      }
    assert.equal(mismatch, 0, '容差把不相等的力矩判成平衡');
  });

  test('杠杆倾角：平衡为 0、夹在 ±8°、方向随力矩差', () => {
    assert.equal(leverTilt(3, 3), 0);
    assert.ok(leverTilt(3, 4.5) > 0, '右侧力矩大 → 顺时针为正');
    assert.ok(leverTilt(4.5, 3) < 0);
    // 全域：任何组合都不越界（±8°）——对应 SVG rotate 的角度上限
    for (let d = -10; d <= 10; d += 0.5) {
      const a = leverTilt(3, 3 + d);
      assert.ok(Math.abs(a) <= LEVER_MAX_TILT + 1e-9, `倾角越界：${a}`);
    }
    // 单调：力矩差越大（同向）倾角越大，直到夹顶
    assert.ok(leverTilt(3, 3.5) <= leverTilt(3, 4));
  });
});

describe('Physics 力学核：固体压强 p = F/S', () => {
  test('p = F/S 且量纲为 kPa（1 cm² = 1e-4 m²）', () => {
    assert.ok(Math.abs(solidPressure(10, 5) - 20) < 1e-9); // 10N / 5cm² = 20 kPa
    assert.ok(Math.abs(solidPressure(50, 1) - 500) < 1e-9);
    assert.ok(Math.abs(solidPressure(10, 20) - 5) < 1e-9);
  });

  test('p 随压力单调增、随受力面积单调减', () => {
    assert.ok(solidPressure(20, 5) > solidPressure(10, 5));
    assert.ok(solidPressure(10, 5) > solidPressure(10, 10));
  });

  test('全域有限：S → 0 不产生 Infinity/NaN（分母有下界）', () => {
    for (const f of [0, 5, 40]) for (const s of [0, -1, 1, 5, 10]) {
      const p = solidPressure(f, s);
      assert.ok(Number.isFinite(p), `F=${f} S=${s} → ${p}`);
      assert.ok(Number.isFinite(dentAmount(f, s)), `凹陷非有限 F=${f} S=${s}`);
    }
    assert.ok(Math.abs(solidPressure(10, 0) - solidPressure(10, 1)) < 1e-9, 'S 下界应为 1cm²');
  });

  test('凹陷代理量恒在 [0,1]', () => {
    for (const f of [5, 10, 40]) for (const s of [1, 5, 10]) {
      const d = dentAmount(f, s);
      assert.ok(d >= 0 && d <= 1, `凹陷越界：${d}`);
    }
  });

  test('常量口径：g = 10 N/kg、石块 2 N / 1.5e-4 m³、每格钩码 0.5 N', () => {
    assert.equal(MECH_G, 10);
    assert.equal(STONE_WEIGHT, 2);
    assert.equal(STONE_VOLUME, 1.5e-4);
    assert.equal(HOOK_WEIGHT, 0.5);
  });
});

describe('Physics 电学核：欧姆定律与分压口径', () => {
  test('I = U/R 精确值与单调性', () => {
    assert.ok(Math.abs(coreCurrentOf(6, 10, 'resistor') - 0.6) < 1e-12);
    assert.ok(Math.abs(coreCurrentOf(12, 4, 'resistor') - 3) < 1e-12);
    for (const R of [1, 5, 10, 20, 50]) {
      assert.ok(coreCurrentOf(12, R, 'resistor') > coreCurrentOf(6, R, 'resistor'), 'U 增大 I 必增大');
      assert.ok(coreCurrentOf(6, R, 'resistor') >= coreCurrentOf(6, R + 5, 'resistor'), 'R 增大 I 不增');
    }
  });

  test('分压口径：元件两端 U_elem = U·R/(R+Rp)，且 U_elem + U_rp = U', () => {
    for (const R of [5, 10, 20]) for (const Rp of [0, 1, 7, 40]) {
      const I = coreCurrentOf(6, R, 'resistor', Rp);
      const uElem = I * R;
      const uRp = I * Rp;
      assert.ok(Math.abs(uElem - (6 * R) / (R + Rp)) < 1e-12, `R=${R} Rp=${Rp} 分压不符`);
      assert.ok(Math.abs(uElem + uRp - 6) < 1e-9, `R=${R} Rp=${Rp} 分压之和 ≠ 电源电压`);
    }
  });

  test('灯泡非线性：R_eff = R₀ + γU，曲线上翘（斜率递减）', () => {
    assert.ok(Math.abs(coreElementResistance(10, 'bulb', 6) - (10 + 0.4 * 6)) < 1e-12);
    assert.equal(coreElementResistance(10, 'resistor', 6), 10);
    const pts = coreSampleOhm(10, 'bulb');
    // 灯泡 I-U 曲线必为凹（割线斜率随 U 递减）
    const slope = (k: number) => pts[k][1] / (pts[k][0] || 1e-9);
    assert.ok(slope(120) < slope(60), '灯泡曲线应上翘（等效电阻随电压增大）');
  });

  test('定值电阻 I-U 曲线斜率恒为 1/R（横轴 = 元件真实压降）', () => {
    for (const R of [5, 10, 20, 50]) {
      const pts = coreSampleOhm(R, 'resistor');
      for (const [x, y] of pts) {
        assert.ok(Math.abs(y - x / R) < 1e-12, `R=${R} 点 (${x}, ${y}) 偏离 1/R`);
      }
    }
  });

  test('采样横轴无浮点累加漂移：121 点、恰为 0.1 的整数倍、末点精确 12', () => {
    const pts = coreSampleOhm(10, 'resistor');
    assert.equal(pts.length, 121);
    assert.equal(pts[120][0], 12, '末点横轴须精确为 12（累加式为 11.999999999999973）');
    // 循环索引 u = k·0.1 精确；派生坐标 x = i·R 有普通浮点乘除舍入（≤1e-12），
    // 与「累加漂移到 11.999999999999973」是两回事
    let worst = 0;
    for (let k = 0; k <= 120; k++) worst = Math.max(worst, Math.abs(pts[k][0] - k * 0.1));
    assert.ok(worst < 1e-12, `横轴与 0.1 整数倍的最大偏差 ${worst} 超出浮点舍入量级`);
  });

  test('数值稳定性：全量程扫描 0 NaN / 0 Infinity 越界', () => {
    let nan = 0, inf = 0, neg = 0;
    for (const el of ['resistor', 'bulb'] as const) {
      for (const R of [0, 1, 5, 10, 20, 50]) {
        for (const Rp of [0, 1, 7, 40]) {
          for (const u of [0, 0.5, 6, 12]) {
            const i = coreCurrentOf(u, R, el, Rp);
            if (Number.isNaN(i)) nan++;
            if (!Number.isFinite(i) && !Number.isNaN(i)) inf++;
            if (i < 0) neg++;
          }
          for (const [x, y] of coreSampleOhm(R, el, Rp)) {
            if (Number.isNaN(x) || Number.isNaN(y)) nan++;
            if (x < 0 || y < 0) neg++;
          }
        }
      }
    }
    assert.equal(nan, 0, '出现 NaN（U=0 且总阻为 0 时曾为 0/0）');
    assert.equal(neg, 0, '出现负值');
    // 唯一允许的 Infinity：真短路（U>0 且元件与变阻器总阻为 0）——由组件层显示 "∞"
    assert.ok(inf >= 0);
    assert.ok(Number.isFinite(coreCurrentOf(0, 0, 'resistor', 0)), 'U=0 总阻 0 不得为 NaN/Inf');
    assert.equal(coreCurrentOf(0, 0, 'resistor', 0), 0, '无驱动电压时读数应为 0');
  });
});

describe('Physics 电学核：串并联电流电压分配', () => {
  test('串联：电流处处相等，电压按阻值分配且 U = ΣUᵢ', () => {
    const rs = [5, 10, 25];
    const I = seriesCurrent(6, rs);
    assert.ok(Math.abs(I - 6 / 40) < 1e-12);
    const us = elementVoltages(6, rs, 'series');
    assert.ok(Math.abs(us[0] + us[1] + us[2] - 6) < 1e-9, '串联分压之和 = 电源电压');
    assert.ok(Math.abs(us[1] - I * 10) < 1e-12);
    // 电流处处相等
    assert.ok(Math.abs(mainCurrent(6, rs, 'series') - I) < 1e-12);
  });

  test('并联：各支路电压相等且等于电源电压，干路电流 = 各支路之和', () => {
    const rs = [10, 20];
    const u = 6;
    const is = parallelBranchCurrents(u, rs);
    assert.ok(Math.abs(is[0] - 0.6) < 1e-12);
    assert.ok(Math.abs(is[1] - 0.3) < 1e-12);
    assert.ok(Math.abs(mainCurrent(u, rs, 'parallel') - 0.9) < 1e-12, 'I₀ = I₁ + I₂');
    const us = elementVoltages(u, rs, 'parallel');
    assert.ok(Math.abs(us[0] - u) < 1e-12 && Math.abs(us[1] - u) < 1e-12, '并联各支路电压相等');
  });

  test('并联总电阻小于任一支路', () => {
    for (const rs of [[10, 10], [5, 20], [4, 6, 12]] as number[][]) {
      const rp = parallelResistance(rs);
      assert.ok(rp > 0 && rp < Math.min(...rs), `R总=${rp} 应小于最小支路 ${Math.min(...rs)}`);
    }
    assert.ok(Math.abs(parallelResistance([10, 10]) - 5) < 1e-12);
  });

  test('支路开关：断开的支路电流为 0，其余支路不受影响；干路开关断开则全为 0', () => {
    const rs = [10, 20];
    const is = parallelBranchCurrents(6, rs, [true, false]);
    assert.ok(Math.abs(is[0] - 0.6) < 1e-12);
    assert.equal(is[1], 0);
    const off = parallelBranchCurrents(6, rs, undefined, false);
    assert.deepEqual(off, [0, 0]);
    assert.equal(seriesCurrent(6, rs, false), 0);
  });

  test('零阻支路（短路导线）：返回有限值而非 Infinity/NaN', () => {
    const is = parallelBranchCurrents(6, [0, 10]);
    assert.ok(is.every(Number.isFinite), `短路支路产生非有限值：${is}`);
    assert.equal(is[0], 0, '零阻支路按短路导线处理，不给出 Infinity');
    assert.ok(Math.abs(is[1] - 0.6) < 1e-12);
    assert.equal(parallelResistance([0, 10]), 0, '含短路支路的并联总阻为 0');
    // 全短路串联
    assert.equal(seriesCurrent(12, [0, 0]), 0);
    assert.ok(Number.isFinite(seriesCurrent(12, [0, 0])));
  });

  test('功率 P = I²R（亮度标定口径）', () => {
    assert.ok(Math.abs(elementPower(0.6, 10) - 3.6) < 1e-12);
    assert.equal(elementPower(0, 10), 0);
  });
});

describe('Physics 光学核：薄透镜成像边界', () => {
  test('成像公式恒等式 1/u + 1/v = 1/f（含虚像）', () => {
    const f = 10;
    for (const u of [2, 5, 8, 9, 12, 15, 20, 25, 40]) {
      const v = imageV(u, f);
      assert.ok(v !== null, `u=${u} 应成像`);
      assert.ok(Math.abs(1 / u + 1 / (v as number) - 1 / f) < 1e-9, `u=${u} 违反薄透镜公式`);
    }
  });

  test('共轭关系：v 作为物距时像距回到 u（1/u + 1/v 对称）', () => {
    const f = 10;
    for (const u of [15, 20, 25, 30]) {
      const v = imageV(u, f) as number;
      const back = imageV(v, f) as number;
      assert.ok(Math.abs(back - u) < 1e-9, `u=${u} → v=${v} → 反算 ${back}`);
    }
  });

  test('四种成像情形 + u = f 不成像（null，不是 NaN）', () => {
    const f = 10;
    assert.ok((imageV(25, f) as number) > f && (imageV(25, f) as number) < 2 * f, 'u>2f → f<v<2f 缩小实像');
    assert.ok(Math.abs((imageV(20, f) as number) - 20) < 1e-9, 'u=2f → v=2f 等大');
    assert.ok((imageV(15, f) as number) > 2 * f, 'f<u<2f → v>2f 放大实像');
    assert.ok((imageV(5, f) as number) < 0, 'u<f → v<0 虚像');
    assert.equal(imageV(10, f), null, 'u=f 不成像');
    assert.equal(imageV(10.005, f), null);
    assert.equal(imageV(9.995, f), null);
    assert.ok(!Number.isNaN(imageV(10, f) as unknown as number), 'u=f 必须严格 null 而非 NaN');
  });

  test('放大率与像距同号关系：|v/u| 在 u=2f 时为 1', () => {
    assert.ok(Math.abs(Math.abs((imageV(20, 10) as number) / 20) - 1) < 1e-9);
    // 物距越小（成实像时）放大率越大
    const m = (u: number) => Math.abs((imageV(u, 10) as number) / u);
    assert.ok(m(12) > m(15) && m(15) > m(20) && m(20) > m(30), '物距越小像越大');
  });

  test('u≈f 邻域像距会暴涨 → 绘制侧必须夹取（画布不可按真实放大率画）', () => {
    // 物理事实：|v| 无上界（u→f ⁺ 时 v→+∞）
    assert.ok((imageV(10.02, 10) as number) > 1000, 'u 略大于 f 时像距应远超光具座量程');
    assert.ok(Math.abs(imageV(10.5, 10) as number) < 1e-9 + 210, 'u=10.5 → v=210cm');
    // 源码守卫：LensBench 必须对绘制像高与虚像位置做夹取，否则 20× 放大时像高 720px 溢出画布
    const bench = readFileSync('src/components/lab/LensBench.tsx', 'utf8');
    assert.match(bench, /const IMG_H_MAX = \d+/, '缺少绘制像高上限常量');
    assert.match(bench, /Math\.min\(Math\.abs\(mag\) \* CANDLE_H, IMG_H_MAX\)/, '像高未夹取');
    assert.match(bench, /Math\.max\(LENS_X \+ v \* SCALE, X_MIN\)/, '虚像位置未夹取');
  });
});

describe('Physics 修复防退化守卫（源码结构级）', () => {
  const P = (f: string) => readFileSync(`src/labs/physics/${f}`, 'utf8');

  test('物理实验零 ✓/✗ 判分字形（改用 Lucide Check / X）', () => {
    for (const f of ['Ohm.tsx', 'Circuits.tsx', 'Buoyancy.tsx', 'Lever.tsx', 'Lens.tsx', 'Pressure.tsx', 'Pulley.tsx']) {
      const src = P(f);
      assert.ok(!/[\u2713\u2717\u2714\u2718]/.test(src), `${f} 仍含对勾/叉字形`);
      assert.match(src, /MARK_CLS/, `${f} 未使用统一判分图标类`);
      assert.match(src, /from 'lucide-react'/, `${f} 未从 lucide 引入判分图标`);
    }
  });

  test('算式统一走计算核，实验内不得再各持一份公式', () => {
    const b = P('Buoyancy.tsx');
    assert.ok(!/function buoyancy\(/.test(b), 'Buoyancy 又出现本地浮力公式');
    assert.match(b, /from '\.\/mechanics-core'/, 'Buoyancy 未接入力学核');
    assert.match(b, /springReading\(/, 'Buoyancy 未使用核内示数函数');
    // 读数精度：与仪器刻度（0.1N）一致，不得出现 0.01N 的虚假精度
    assert.ok(!/FReading\.toFixed\(2\)|Fb\.toFixed\(2\)/.test(b), '浮力读数出现 2 位小数的虚假精度');
    const l = P('Lever.tsx');
    assert.ok(!/m1 \* 0\.5 \* d1/.test(l), 'Lever 又出现本地力矩算式');
    assert.match(l, /torque\(m1, d1\)/, 'Lever 未走核内力矩函数');
    const pr = P('Pressure.tsx');
    assert.ok(!/\(F \/ \(S \* 1e-4\)\) \/ 1000/.test(pr), 'Pressure 又出现本地压强算式');
    assert.match(pr, /solidPressure\(F, S\)/, 'Pressure 未走核内压强函数');
    const c = P('Circuits.tsx');
    assert.match(c, /from '\.\/circuits-core'/, 'Circuits 未接入电路核');
    assert.ok(!/u \/ effR\[i\]/.test(c), 'Circuits 并联支路仍在裸除（零阻会得 Infinity）');
  });

  test('欧姆核算采样不得用浮点累加，且不得返回 NaN', () => {
    const ohmRaw = readFileSync('src/labs/physics/ohm-core.ts', 'utf8');
    // 先剥注释：头注释里为说明问题写了「u += 0.1」这个反例，不剥会自打红
    const ohm = ohmRaw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    assert.ok(!/u \+= /.test(ohm), 'sampleOhm 又用累加（会产生 11.999999999999973 漂移）');
    assert.match(ohm, /const u = k \* SAMPLE_STEP/, '横轴须用索引乘法');
    assert.match(ohm, /return u === 0 \? 0 : u \/ denom/, '缺少 0/0 → 0 的 NaN 兜底');
  });

  test('动效：杠杆禁用过冲缓动（y2>1 会回弹），统一走单调缓动令牌', () => {
    const l = P('Lever.tsx');
    assert.ok(!/cubic-bezier\(0\.34, 1\.56/.test(l), '杠杆缓动又带回弹（1.56 > 1）');
    assert.match(l, /transition: 'transform var\(--dur-slow\) var\(--ease-out\)'/, '杠杆未走单调缓动令牌');
  });

  test('文案：欢迎弹窗物理清单不得宣称不存在的「液体压强」实验', () => {
    const i18n = readFileSync('src/lib/i18n.ts', 'utf8');
    assert.ok(!i18n.includes('液体压强'), '物理清单又出现「液体压强」（全站只有固体压强 p=F/S）');
    assert.ok(!i18n.includes('liquid pressure'), '英文清单同样不得宣称');
    assert.ok(i18n.includes('滑轮 · 压强 · 凸透镜成像'), '清单须与实际实验一致');
  });
});

describe('Physics 电学门面（应用真实调用点）：边界兜底与采样口径', () => {
  test('sampleOhm 门面：121 点、索引乘法、末点精确 12（应用走的正是这条循环）', () => {
    const pts = sampleOhm(10, 'resistor', 0);
    assert.equal(pts.length, 121);
    assert.equal(pts[120][0], 12, '末点横轴须精确为 12（累加式为 11.999999999999973）');
    let worst = 0;
    for (let k = 0; k <= 120; k++) worst = Math.max(worst, Math.abs(pts[k][0] - k * 0.1));
    assert.ok(worst < 1e-12, `门面横轴偏差 ${worst} 超出浮点舍入量级`);
  });

  test('currentOf 门面：U=0 且总阻为 0 时返回 0（不是 NaN）', () => {
    // 应用运行时可能已切到 WASM 实现；门面必须把 NaN 归一为 0，否则电表读数渲染 "NaN"
    for (const el of ['resistor', 'bulb'] as const) {
      const v = currentOf(0, 0, el, 0);
      assert.ok(!Number.isNaN(v), `门面 currentOf(0,0,${el},0) 返回 NaN`);
      assert.equal(v, 0);
    }
    assert.ok(Math.abs(currentOf(6, 10, 'resistor', 0) - 0.6) < 1e-12, '正常工况不得被兜底逻辑改变');
  });

  test('imageV 门面：u≈f 必须严格 null（WASM 侧若返回 NaN 也要归一）', () => {
    for (const u of [10, 10.005, 9.995]) {
      const v = imageV(u, 10);
      assert.equal(v, null, `u=${u} 应为 null`);
      assert.ok(!Number.isNaN(v as unknown as number));
    }
    assert.ok((imageV(20, 10) as number) > 0, '正常工况不得被归一逻辑吞掉');
  });

  test('门面源码守卫：NaN 兜底 + 非有限归一 + 索引乘法循环 + 头注释警示', () => {
    const fe = readFileSync('src/labs/physics/stem-engine.ts', 'utf8');
    assert.match(fe, /return Number\.isNaN\(v\) \? 0 : v;/, 'currentOf 缺少 NaN→0 兜底');
    assert.match(fe, /Number\.isFinite\(v\) \? v : null/, 'imageV 缺少非有限→null 归一');
    assert.ok(!/u \+= 0\.1/.test(fe.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')), '门面采样又用累加');
    assert.match(fe, /for \(let k = 0; k \* 0\.1 <= 12\.0001; k\+\+\)/, '门面采样须用索引乘法');
    assert.ok(fe.includes('只改 TS core 对应用无效'), '头注释须警示「改了 core 但应用仍 NaN」这个坑');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   物理题库守卫（对标化学 standard）：正确值必须在值域、位置分布不偏、无对勾叉字形
   ══════════════════════════════════════════════════════════════════════════ */

describe('公共工具与 AI 链路守卫', () => {
  const read = (path: string) => readFileSync(path, 'utf8');

  test('物理常量：数值/单位/初中口径（不含高中大学常量）', () => {
    const byKey = new Map(PC.map((c) => [c.symbol + '|' + c.value, c]));
    const expect: [string, string, string][] = [
      ['g', '9.8', 'N/kg'],
      ['ρ水', '1.0×10³', 'kg/m³'],
      ['ρ酒精', '0.8×10³', 'kg/m³'],
      ['ρ铁', '7.9×10³', 'kg/m³'],
      ['ρ铜', '8.9×10³', 'kg/m³'],
      ['ρ铝', '2.7×10³', 'kg/m³'],
      ['p₀', '1.013×10⁵', 'Pa'],
      ['c水', '4.2×10³', 'J/(kg·°C)'],
      ['c酒精', '2.4×10³', 'J/(kg·°C)'],
      ['c冰', '2.1×10³', 'J/(kg·°C)'],
      ['c', '3×10⁸', 'm/s'],
      ['v水', '2.25×10⁸', 'm/s'],
      ['f', '50 Hz', ''],
    ];
    for (const [sym, val, unit] of expect) {
      const hit = byKey.get(sym + '|' + val);
      assert.ok(hit, '常量 ' + sym + ' = ' + val + ' 缺失或数值被改动');
      assert.strictEqual(hit!.unit as string, unit, sym + ' 单位应为「' + unit + '」');
    }
    for (const c of PC) {
      assert.ok(!/^\s*-/.test(c.value), c.name.zh + ' 的负号应为学术减号 U+2212');
      assert.ok(c.name.zh.length > 0 && c.name.en.length > 0, c.name.zh + ' 缺中英名');
    }
    const all = PC.map((c) => c.symbol + c.name.zh).join('|');
    assert.doesNotMatch(all, /万有引力|引力常量|元电荷/, '混入非初中常量');
  });

  test('AI 密钥仅存本机：localStorage 读写、无第三方上报通道', () => {
    const cfg = read('src/lib/ai-config.ts');
    assert.match(cfg, /window\.localStorage\.setItem\(STORAGE_KEY/, '密钥未写入本机存储');
    assert.match(cfg, /window\.localStorage\.getItem\(STORAGE_KEY/, '配置读取未走本机存储');
    assert.match(cfg, /window\.localStorage\.removeItem\(STORAGE_KEY/, '清除未走本机存储');
    assert.doesNotMatch(cfg, /sendBeacon/, '出现后台上报通道');
    const fetches = Array.from(cfg.matchAll(/fetch\(([^,)]+)/g)).map((m) => m[1]);
    assert.ok(fetches.length > 0, '未找到任何请求点');
    for (const target of fetches) {
      assert.doesNotMatch(target, /['"]\/(api|log|report|collect)/, '请求目标疑似本站后端：' + target);
      assert.doesNotMatch(target, /location\.(origin|href)/, '请求目标使用了本站源：' + target);
    }
    const panel = read('src/components/ai/AiAssistant.tsx');
    assert.doesNotMatch(panel, /sendBeacon/, '面板出现上报通道');
    const copy = panel.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
    assert.doesNotMatch(copy, /加密/, '出现「加密」不实表述');
  });

  test('公式速查搜索框：单层极简（--border-strong + 内联 outline:none + aria-label）', () => {
    for (const f of ['src/pages/MathFormulas.tsx', 'src/pages/PhysicsFormulas.tsx']) {
      const src = read(f);
      assert.match(src, /focus-within:border-\[var\(--accent\)\]/, f + ' 外层容器缺聚焦态');
      assert.match(src, /border-\[var\(--border-strong\)\]/, f + ' 边框未用 --border-strong（对比度不足 3:1）');
      assert.match(src, /style=\{\{ outline: 'none' \}\}/, f + ' 内层缺内联 outline:none（会出现双层黑框）');
      assert.match(src, /border-none bg-transparent/, f + ' 内层 input 仍有边框');
      assert.match(src, /aria-label=\{/, f + ' 搜索框缺无障碍标签');
    }
  });

  test('长公式与长回答不撑破容器：KaTeX 与 AI 气泡都有溢出保护', () => {
    const css = read('src/index.css');
    const kd = css.slice(css.indexOf('.katex-display'), css.indexOf('.katex-display') + 260);
    assert.match(kd, /overflow-x: auto/, '.katex-display 缺 overflow-x（长公式会撑破布局）');
    assert.match(kd, /max-width: 100%/, '.katex-display 缺 max-width');
    const panel = read('src/components/ai/AiAssistant.tsx');
    assert.match(panel, /max-w-\[95%\] min-w-0 break-words/, 'AI 回答气泡缺 break-words（长 token 会溢出）');
    assert.match(panel, /max-h-\[min\(85dvh/, 'AI 面板缺 85dvh 高度上限');
  });

  test('全站界面零 ✓/✗ 判分字形（smoke 自身除外）', () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const q = dir + '/' + e.name;
        if (e.isDirectory()) walk(q);
        else if (/\.(tsx?|css)$/.test(e.name)) {
          if (/[✓✗]/.test(readFileSync(q, 'utf8'))) hits.push(q);
        }
      }
    };
    ['src/pages', 'src/components', 'src/labs', 'src/lib'].forEach(walk);
    assert.deepStrictEqual(hits, [], '以下文件仍含 ✓/✗ 字形：' + hits.join(', '));
  });
});

describe('数学模块数值稳定性与题库守卫', () => {
  const read = (path: string) => readFileSync(path, 'utf8');
  const CORE = './labs/math/quadratic-core';

  test('二次采样：末点精确落在 +4，点距恒等（无浮点累加漂移）', () => {
    const pts = QC.sampleQuadratic(1, 0, 0);
    const n = Math.round((QC.SAMPLE_MAX - QC.SAMPLE_MIN) / QC.SAMPLE_STEP);
    assert.strictEqual(pts.length, n + 1, `采样点数应为 ${n + 1}`);
    assert.strictEqual(pts[0][0], -4, '首点应为 -4');
    assert.strictEqual(pts[pts.length - 1][0], 4, '末点必须精确为 +4（旧实现漂移为 3.9999999999999396）');
    // 点距恒为 0.05（索引乘法下仅剩 ulp 级差异；浮点累加会漂移到 0.05000000000000071 等并逐段累积）
    for (let i = 1; i < pts.length; i++) {
      const d = pts[i][0] - pts[i - 1][0];
      assert.ok(Math.abs(d - 0.05) < 1e-12, `第 ${i} 段点距 ${d} 偏离 0.05`);
    }
    // 采样点与索引乘法公式逐点一致
    pts.forEach(([x, y], k) => {
      assert.strictEqual(x, -4 + k * 0.05, '第 k 点 x 应为 -4 + k·0.05');
      assert.ok(Math.abs(y - (x * x)) < 1e-12, 'y 应为 x²');
    });
    // 旧模式必须已被移除
    const coreSrc = read('src/labs/math/quadratic-core.ts');
    const facadeSrc = read('src/labs/physics/stem-engine.ts');
    assert.doesNotMatch(coreSrc, /x \+= 0\.05/, 'quadratic-core 仍在浮点累加');
    assert.doesNotMatch(facadeSrc, /x \+= 0\.05/, '门面 stem-engine 仍在浮点累加（真正运行的是它）');
    // 反比例与一次函数两支同样不得累加
    assert.doesNotMatch(read('src/labs/math/Inverse.tsx'), /x \+= 0\.05/, 'Inverse 仍在浮点累加');
    assert.doesNotMatch(read('src/labs/math/Linear.tsx'), /x \+= 0\.05/, 'Linear 仍在浮点累加');
  });

  test('判别式与实根：Δ<0 返回空数组（绝不 Math.sqrt 负数产出 NaN）', () => {
    assert.strictEqual(QC.discriminant(1, 0, 1), -4);
    assert.deepStrictEqual(QC.quadraticRoots(1, 0, 1), [], 'Δ<0 必须无实根且不产生 NaN');
    assert.deepStrictEqual(QC.quadraticRoots(1, 0, 0), [0], 'Δ=0 重根');
    const r = QC.quadraticRoots(1, -3, 2); // x²−3x+2 → 1, 2
    assert.ok(Math.abs(r[0] - 1) < 1e-12 && Math.abs(r[1] - 2) < 1e-12);
    assert.ok(r[0] <= r[1], '根须升序');
    // 全域扫描：任何系数下返回值都必须是有限数（杜绝 NaN / Infinity 进入坐标渲染）
    for (const a of [-3, -1, -0.5, 0, 0.5, 1, 3]) {
      for (const b of [-5, -1, 0, 1, 5]) {
        for (const c of [-5, -1, 0, 1, 5]) {
          for (const root of QC.quadraticRoots(a, b, c)) {
            assert.ok(Number.isFinite(root), `系数 a=${a} b=${b} c=${c} 产生非有限根 ${root}`);
          }
        }
      }
    }
    // a=0 退化：一次方程
    assert.deepStrictEqual(QC.quadraticRoots(0, 2, -4), [2]);
    assert.deepStrictEqual(QC.quadraticRoots(0, 0, 5), [], 'a=b=0 无解');
  });

  test('圆几何退化：动点重合 / 零长向量不得产出 NaN 夹角', () => {
    // 签名：(ax,ay,bx,by,cx,cy)，顶点在 b
    assert.strictEqual(IC.angleBetween(0, 0, 0, 0, 0, 0), 0, '零长向量夹角须为 0 而非 NaN');
    assert.strictEqual(IC.angleBetween(1, 1, 1, 1, 2, 2), 0, '单侧零长向量同样不得 NaN');
    assert.ok(Number.isFinite(IC.angleBetween(1, 0, 0, 0, 0, 1)), '直角顶点须有限');
    // 全域退化扫描：任何重合组合都必须有限且在 [0, π]
    const pts = [[0, 0], [1, 0], [0, 1], [-1, -1], [2, 2]];
    for (const [ax, ay] of pts) for (const [bx, by] of pts) for (const [cx, cy] of pts) {
      const ang = IC.angleBetween(ax, ay, bx, by, cx, cy);
      assert.ok(Number.isFinite(ang), `退化组合 (${ax},${ay})(${bx},${by})(${cx},${cy}) 产生 NaN 夹角`);
      assert.ok(ang >= 0 && ang <= Math.PI + 1e-12, '夹角越界');
    }
    // 直径所对圆周角 = 90°（Thales）：C 在单位圆上，AB 为直径
    for (const t of [0.3, 1.1, 2.4, 3.9, 5.5]) {
      const cx = Math.cos(t), cy = Math.sin(t);
      const ang = IC.angleBetween(-1, 0, cx, cy, 1, 0);
      assert.ok(Math.abs(ang - Math.PI / 2) < 1e-9, `C=(${cx.toFixed(3)},${cy.toFixed(3)}) 处圆周角应为 90°`);
    }
    // 垂径：圆心到弦的垂足与两端等距（AE = EB），弦退化到直径/零弦时仍成立
    for (const half of [0, 0.5, 1, 12]) {
      assert.ok(Math.abs(IC.dist(-half, 0, 0, 0) - IC.dist(0, 0, half, 0)) < 1e-12, `半弦 ${half} 时 AE ≠ EB`);
    }
    // 平行线不得返回交点（|d| < 1e-10 → null）
    assert.strictEqual(IC.lineIntersect(0, 0, 1, 0, 0, 1, 1, 1), null, '平行线须无交点');
    const ix = IC.lineIntersect(0, 0, 2, 2, 0, 2, 2, 0);
    assert.ok(ix !== null && Number.isFinite(ix.x) && Number.isFinite(ix.y), '非平行必须有有限交点');
  });

  test('题库注册表：值与文案键成对、正解在值域内、渲染顺序与注册表一致', () => {
    const files = ['Circle', 'Inverse', 'Linear', 'Quadratic'];
    const all: { file: string; key: string; vals: string[]; correct: string[] }[] = [];
    for (const f of files) {
      const src = read(`src/labs/math/${f}.tsx`);
      const optsBlock = src.match(/export const OPTIONS = \{\n([\s\S]*?)\n\} as const;/);
      const corrBlock = src.match(/export const QUIZ_CORRECT: Record<string, string\[\]> = \{\n([\s\S]*?)\n\};/);
      assert.ok(optsBlock && corrBlock, `${f} 缺 OPTIONS / QUIZ_CORRECT 导出`);
      const opts = Object.fromEntries(
        Array.from(optsBlock![1].matchAll(/(\w+): \[((?:\[[^\]]*\],?\s*)+)\]/g)).map((m) => [
          m[1],
          Array.from(m[2].matchAll(/\['([^']+)', '([^']+)'\]/g)).map((x) => [x[1], x[2]]),
        ]),
      );
      const corr = Object.fromEntries(
        Array.from(corrBlock![1].matchAll(/(\w+): \[([^\]]*)\]/g)).map((m) => [m[1], Array.from(m[2].matchAll(/'([^']+)'/g)).map((x) => x[1])]),
      );
      assert.deepStrictEqual(Object.keys(opts).sort(), Object.keys(corr).sort(), `${f} 题键不一致`);
      for (const [k, pairs] of Object.entries(opts)) {
        assert.ok(pairs.length >= 2, `${f}.${k} 选项不足`);
        for (const [v, label] of pairs) {
          assert.ok(v.length > 0 && label.length > 0, `${f}.${k} 存在空值/空文案键`);
        }
        assert.strictEqual(new Set(pairs.map((p) => p[0])).size, pairs.length, `${f}.${k} 选项值重复`);
        for (const c of corr[k]) {
          assert.ok(pairs.some((p) => p[0] === c), `${f}.${k} 正确值 ${c} 不在选项值域内（永远判不对）`);
        }
        all.push({ file: f, key: k, vals: pairs.map((p) => p[0]), correct: corr[k] });
      }
      // 判分表必须只此一处（组件内引用注册表）
      assert.match(src, /const correctKeys = QUIZ_CORRECT;|QUIZ_CORRECT\[key\]/, `${f} 组件未引用注册表`);
    }
    // 位置均衡：正解不得扎堆在同一项
    const hist: Record<number, number> = {};
    for (const q of all) hist[q.vals.indexOf(q.correct[0])] = (hist[q.vals.indexOf(q.correct[0])] || 0) + 1;
    const total = all.length;
    assert.strictEqual(total, 15, `判分题总数应为 15，实为 ${total}`);
    for (const [pos, n] of Object.entries(hist)) {
      assert.ok(n / total <= 0.45, `位置 ${pos} 正解占比 ${(100 * n / total).toFixed(1)}% 超过 45%（位置偏见）`);
    }
    assert.strictEqual(Object.keys(hist).length, 3, '三个位置都应被用到');
  });

  test('数学模块零 ✓/✗ 判分字形（统一 Lucide Check / X）', () => {
    for (const f of ['src/labs/math/Circle.tsx', 'src/labs/math/Inverse.tsx', 'src/labs/math/Linear.tsx',
      'src/labs/math/Quadratic.tsx', 'src/components/lab/InteractiveCircle.tsx']) {
      const src = read(f);
      assert.doesNotMatch(src, /[✓✗]/, `${f} 仍有 ✓/✗ 字形`);
    }
    // 四个判分实验都使用 Lucide 图标常量
    for (const f of ['Circle', 'Inverse', 'Linear', 'Quadratic']) {
      const src = read(`src/labs/math/${f}.tsx`);
      assert.match(src, /from 'lucide-react'/, `${f} 未引入 Lucide`);
    }
  });

  test('坐标渲染：负号使用学术减号 U+2212，且只用设计令牌', () => {
    const cp = read('src/components/lab/CoordPlane.tsx');
    assert.match(cp, /export const mathMinus/, '缺 mathMinus 工具');
    assert.strictEqual(CP2.mathMinus(-3), '\u22123', '负数须渲染为 U+2212');
    assert.strictEqual(CP2.mathMinus('(-2, 3)'), '(\u22122, 3)', '坐标文本须整体替换');
    assert.strictEqual(CP2.mathMinus(4), '4', '正数不受影响');
    // 刻度与标注都过格式化
    assert.match(cp, /\{mathMinus\(v\)\}/, '刻度未过 mathMinus');
    assert.match(cp, /\{mathMinus\(m\.dot\.label\)\}/, '点标注未过 mathMinus');

    /* ---- 网格双层化 / 光晕 / 贴轴：行为级契约（2026-10 坐标系审计）---- */
    // 细网格：目标 8~10 格（旧版按「7 条刻度」反推，Quadratic 只剩 4×3 格，像渔网）
    assert.equal(CP2.fineStep(8), 1, 'x 范围 8 的细网格步长须为 1（旧版 2 → 只有 4 格）');
    assert.equal(CP2.fineStep(41), 5, 'y 范围 41 的细网格步长须为 5（旧版 10 → 只有 3 格）');
    for (const [range, want] of [[8, 8], [41, 8], [68, 6], [2.4, 9.6]] as const) {
      const cells = range / CP2.fineStep(range);
      assert.ok(cells >= want * 0.95, `range=${range} 细网格仅 ${cells.toFixed(1)} 格，低于 ${want}`);
    }
    // 主网格（带数字）必须是细网格整数倍，且标签条数收口到 ≤6（否则数字互相压）
    for (const range of [8, 41, 68, 2.4, 40]) {
      const fine = CP2.fineStep(range);
      const major = CP2.majorStepFor(range, fine);
      assert.ok(Math.abs(major / fine - Math.round(major / fine)) < 1e-9, `range=${range} 主网格不是细网格整数倍`);
      assert.ok(range / major <= 6.5, `range=${range} 主网格 ${(range / major).toFixed(1)} 格，标签会挤`);
    }
    // 光晕必须走令牌，不得写死色值（深色主题下会露出白边）
    assert.equal(CP2.TEXT_HALO.stroke, 'var(--card-bg)', '光晕描边须用 --card-bg 令牌');
    assert.equal(CP2.TEXT_HALO.paintOrder, 'stroke', '光晕须把描边画在填充之前');
    const haloUses = (cp.match(/\{\.\.\.TEXT_HALO\}/g) ?? []).length;
    assert.ok(haloUses >= 6, `刻度/原点/标注/轴名/图例都要挂光晕（实测 ${haloUses} 处）`);
    // 刻度贴轴：不得再钉在画布底边（旧版 H-PAD.bottom+15 与 y=0 相差 290px）
    assert.doesNotMatch(cp, /y=\{H - PAD\.bottom \+ 15\}/, 'x 刻度不得再钉在画布底边');
    assert.match(cp, /const xTickY = clamp\(zeroY \+ 15/, 'x 刻度须贴在 x 轴下方');
    assert.match(cp, /const yTickX = Math\.max\(zeroX - 6/, 'y 刻度须贴在 y 轴左侧');
    // 图例：不得再用字符破折号冒充线型；底板宽度必须动态
    assert.ok(!cp.includes("'— '") && !cp.includes("'- - '"), '图例不得再用 — / - - 字符冒充线型');
    assert.match(cp, /<line\s+x1=\{legendX \+ 6\}/, '图例须用真实 <line> 画线型');
    assert.match(cp, /Math\.max\(\s*120,\s*\.\.\.curves\.map/, '图例底板宽度须按最长标签动态撑开（旧版写死 125px，长系数溢出 40px）');
    // 越界防护：特征点在绘图区外时整条不画（旧版会把半截虚线画到画布外）
    assert.match(cp, /const inPlotX = \(px: number\)/, '须有越界判定');
    // 点标注落位：Quadratic 必须按开口方向传 place（否则文字被抛物线横穿）
    const qd = read('src/labs/math/Quadratic.tsx');
    assert.match(qd, /place: a < 0 \? 'above' : 'below'/, '顶点/交点标注须按开口方向避让');
    // 反比例：与坐标轴重合的渐近线不得再叠虚线
    const inv = read('src/labs/math/Inverse.tsx');
    assert.match(inv, /noLine: true/, '与坐标轴重合的渐近线须 noLine（否则轴线被虚线打断）');

    for (const f of ['src/components/lab/CoordPlane.tsx', 'src/labs/math/Circle.tsx', 'src/labs/math/Inverse.tsx',
      'src/labs/math/Linear.tsx', 'src/labs/math/Quadratic.tsx']) {
      assert.doesNotMatch(read(f), /#[0-9a-fA-F]{3,6}\b/, `${f} 出现硬编码色值`);
    }
  });
});

describe('滑动变阻器「一上一下」结构与直角走线守卫', () => {
  const read = (path: string) => readFileSync(path, 'utf8');
  const RHEO = read('src/components/lab/circuit/CircuitParts.tsx');
  const RHEO_BLOCK = RHEO.slice(RHEO.indexOf('export function Rheostat'), RHEO.indexOf('/* ---------- 固定电表'));
  const OHM = read('src/labs/physics/Ohm.tsx');
  const TOPO = read('src/labs/physics/circuitStyles.ts');

  test('三层结构齐备：下层线圈瓷筒 + 上层金属杆 + 中层滑片垂直连通', () => {
    assert.match(RHEO_BLOCK, /下层：漆包线线圈瓷筒/, '缺下层线圈瓷筒');
    assert.match(RHEO_BLOCK, /上层：导电金属杆/, '缺上层金属杆');
    assert.match(RHEO_BLOCK, /中层：滑片 P/, '缺中层滑片');
    // 瓷筒 = rect；金属杆 = 横线；滑片垂直连杆 + 触头三角
    assert.match(RHEO_BLOCK, /width=\{RHEO_W\}[\s\S]*?height=\{RHEO_H\}/, '瓷筒矩形缺失');
    assert.match(RHEO_BLOCK, /<line x1=\{t\.C\.x\} y1=\{rodY\} x2=\{t\.D\.x\} y2=\{rodY\}/, '金属杆横线缺失');
    assert.match(RHEO_BLOCK, /<line x1="0" y1=\{rodY\} x2="0" y2=\{coilTop\}/, '滑片垂直连杆缺失（会与上下两层脱节）');
    assert.match(RHEO_BLOCK, /<polygon points=\{`-2\.6,\$\{coilTop\}/, '触头三角缺失');
  });

  test('四接线柱 A/B/C/D 齐备且几何与父级共用常量一致', () => {
    assert.match(RHEO_BLOCK, /\['A', 'B', 'C', 'D'\] as const/, '未渲染 A/B/C/D 四柱');
    const t0 = CP.rheostatTerminals(190, 60);
    assert.deepStrictEqual(t0.A, { x: 173, y: 60 }, 'A 应为左下接线柱');
    assert.deepStrictEqual(t0.D, { x: 207, y: 44 }, 'D 应为右上接线柱');
    assert.strictEqual(CP.RHEO_W / 2, 17, '瓷筒半宽须为 17（父级按 17 布局）');
    // 父级 circuitStyles 的金属杆偏移必须与组件一致，否则出线接不上接线柱
    assert.strictEqual(TOPO_RHEO_ROD_DY, CP.RHEO_ROD_DY, 'circuitStyles 的 RHEO_ROD_DY 与组件不一致');
  });

  test('滑片单调性：ratio 增 → 滑片右移 → 接入线圈有效长度变长', () => {
    const xs = [0, 0.25, 0.5, 0.75, 1].map((r) => CP.rheostatWiperX(190, r));
    for (let i = 1; i < xs.length; i++) assert.ok(xs[i] > xs[i - 1], '滑片位置未随 ratio 单调右移');
    // 行程不越过瓷筒端头（两端各留 4px）
    assert.ok(Math.abs(xs[0] - 177) < 1e-9 && Math.abs(xs[4] - 203) < 1e-9, '滑片行程超界');
    // 接入长度 = 4px 起始余量 + 26px·ratio（仿射）：用差值验证线性，不能直接用比值（含常量项）
    const len = (r: number) => CP.rheostatWiperX(190, r) - CP.rheostatTerminals(190, 60).A.x;
    assert.ok(Math.abs((len(1) - len(0)) - 2 * (len(0.5) - len(0))) < 1e-9, '接入长度的增量非线性');
    assert.ok(Math.abs(len(0) - 4) < 1e-9, '起始余量应为 4px（滑片不越过瓷筒端头）');
  });

  test('导线全部横平竖直（90° 直角），端点吸附接线柱圆心', () => {
    const terms = CP.rheostatTerminals(190, 60);
    // Ohm：左进线端点 = A，出线起点 = D，直角折下后落于元件左端
    assert.match(OHM, /<line x1="145" y1="60" x2="173" y2="60" \/>/, '左进线未吸附 A(173,60)');
    assert.match(OHM, /<line x1="207" y1="44" x2="230" y2="44" \/>/, '出线未自 D(207,44) 起');
    assert.match(OHM, /<line x1="230" y1="44" x2="230" y2="60" \/>/, '出线缺 90° 折下段');
    assert.strictEqual(terms.A.x, 173);
    assert.strictEqual(terms.D.y, 44);
    // 该区域的每一条导线都必须轴对齐（x1==x2 或 y1==y2）
    const segs = [
      [145, 60, 173, 60],
      [207, 44, 230, 44],
      [230, 44, 230, 60],
    ];
    for (const [x1, y1, x2, y2] of segs) {
      assert.ok(x1 === x2 || y1 === y2, `导线 ${x1},${y1}→${x2},${y2} 非 90° 直角`);
    }
    // 变阻器符号内不得出现曲线路径（贝塞尔）或斜线导线
    assert.doesNotMatch(RHEO_BLOCK, /<path/, '变阻器符号出现曲线路径（禁止贝塞尔）');
    assert.doesNotMatch(RHEO_BLOCK, /\b[QCST]\s*-?\d/, '变阻器符号出现曲线命令');
  });

  test('串联网末段同样走「一上一下」且与组件常量一致', () => {
    assert.match(TOPO, /elems\[n - 1\]\.kind === 'rheostat'/, '串联网未对末位变阻器特殊处理');
    const rodY = 60 + TOPO_RHEO_ROD_DY;
    assert.strictEqual(rodY, 44, '金属杆高度应为 44');
    // 行为断言（取代原「源码正则」）：右端竖线起点必须与末位元件同源 ——
    // 末位是变阻器时自金属杆高度(44)起（与出线段闭合），否则自主回路 y=60；
    // 原正则把「无条件自 60+RHEO_ROD_DY 起」写死，等于放行了无变阻器样式的悬空露头。
    for (const st of CIRCUIT_STYLES.filter((x) => x.kind === 'series')) {
      const topo = TOPO_GEN(st);
      const right = topo.wires.find((w) => w.id === 'dry-right');
      assert.ok(right, `${st.id} 缺右端竖线`);
      const lastKind = st.elements[st.elements.length - 1].kind;
      assert.strictEqual(right!.y1, lastKind === 'rheostat' ? rodY : 60,
        `${st.id}：右端竖线起点应为 ${lastKind === 'rheostat' ? rodY : 60}（末位元件 ${lastKind}），否则右上角出现悬空露头`);
      assert.strictEqual(right!.x1, TOPO_RIGHT_X, `${st.id}：右端竖线须落在汇合母线 x 上`);
      assert.strictEqual(right!.x2, TOPO_RIGHT_X, `${st.id}：右端竖线须垂直`);
    }
    for (const [x1, y1, x2, y2] of [[268 + 17, rodY, 290, rodY], [290, rodY, 290, 140]]) {
      assert.ok(x1 === x2 || y1 === y2, '串联网出线非 90° 直角');
    }
  });

  test('仅用设计令牌，无硬编码色值噪音', () => {
    for (const token of ['var(--fg)', 'var(--muted)', 'var(--card-bg)', 'var(--accent)']) {
      assert.ok(RHEO_BLOCK.includes(token), `缺令牌 ${token}`);
    }
    assert.doesNotMatch(RHEO_BLOCK, /#[0-9a-fA-F]{3,6}\b/, '变阻器出现硬编码色值');
    assert.doesNotMatch(RHEO_BLOCK, /stroke="black"|strokeWidth="2\.5"/, '出现粗黑视觉噪音');
  });
});

describe('物理教学边界守卫（电表量程 / 透镜超程 / 测力计插值 / 触控热区 / 浮力分辨率）', () => {
  const read = (path: string) => readFileSync(path, 'utf8');

  test('电表指针两端极值夹取：负值 / 超量程都不会把指针推出表盘', () => {
    const src = read('src/components/lab/MeterGauge.tsx');
    assert.match(src, /const clamped = Math\.max\(0, Math\.min\(v, max\)\)/, '指针角度未做两端夹取');
    assert.match(src, /const over = value !== null && v > max/, '未定义超量程状态');
    assert.match(src, /超量程（\$\{max\}\$\{unit\}）/, '缺超量程中文警示');
    assert.match(src, /Over range \(\$\{max\}\$\{unit\}\)/, '缺超量程英文警示');
    assert.match(src, /onCycleRange/, '缺手动换档入口');
    assert.doesNotMatch(src, /Math\.min\(v, max\) \/ max/, '仍存在会飞出零位的旧算式');
  });

  test('双量程档位与实物一致：电流 0.6/3A、电压 3/15V（电压表不再固定单档 15V）', () => {
    const ohm = read('src/labs/physics/Ohm.tsx');
    assert.match(ohm, /const A_RANGES = \[0\.6, 3\];/, '电流表量程应为 0.6/3A');
    assert.match(ohm, /const V_RANGES = \[3, 15\];/, '电压表量程应为 3/15V');
    const cir = read('src/labs/physics/Circuits.tsx');
    assert.match(cir, /const V_RANGES = \[3, 15\];/, '串并联电压表量程应为 3/15V');
  });

  test('透镜超程：量程带与夹取常量同源，越界判定语义正确，中英文案齐备', () => {
    const bench = read('src/components/lab/LensBench.tsx');
    assert.match(bench, /export const BENCH_V_MIN = \(X_MIN - LENS_X\) \/ SCALE/, '量程带未与夹取常量同源');
    assert.match(bench, /export const BENCH_V_MAX = \(CLAMP_MAX - LENS_X\) \/ SCALE/, '量程带未与夹取常量同源');
    assert.strictEqual(BENCH.isBeyondBench(null), false);
    assert.strictEqual(BENCH.isBeyondBench(BENCH.BENCH_V_MAX), false);
    assert.strictEqual(BENCH.isBeyondBench(BENCH.BENCH_V_MAX + 1), true);
    assert.strictEqual(BENCH.isBeyondBench(BENCH.BENCH_V_MIN), false);
    assert.strictEqual(BENCH.isBeyondBench(BENCH.BENCH_V_MIN - 1), true);
    // 真实场景：u=10.5cm、f=10cm → v=210cm 远超量程
    assert.strictEqual(BENCH.isBeyondBench(210), true);
    const i18n = read('src/lib/i18n.ts');
    assert.match(i18n, /lensOutOfBench: '光屏已超出光具座量程'/, '缺中文超程提示');
    assert.match(i18n, /lensOutOfBench: 'Screen exceeds optical bench limit'/, '缺英文超程提示');
  });

  test('弹簧测力计挂钩位移改由 transform 驱动（<line> 的 y2 不是 CSS 可动画属性）', () => {
    const src = read('src/labs/physics/Buoyancy.tsx');
    assert.match(src, /translateY\(\$\{springDy\}px\)/, '挂钩位移未改为 transform');
    assert.match(src, /transition: 'transform var\(--dur-base\) var\(--ease-out\)'/, '缺少过渡令牌');
    assert.doesNotMatch(src, /y2=\{springBottomY\}/, '弹簧仍由 y2 属性驱动');
  });

  test('浮力步长分辨率：三种液体每 0.1 档 ΔF浮 ≥ 0.1N（0.1N 刻度可见）', () => {
    for (const rho of [800, 1000, 1200]) {
      for (let k = 1; k <= 10; k++) {
        const d = MC.buoyantForce(rho, k / 10) - MC.buoyantForce(rho, (k - 1) / 10);
        assert.ok(d >= 0.1 - 1e-9, `ρ=${rho} 第 ${k} 档增量 ${d.toFixed(3)}N 不足 0.1N`);
      }
    }
    // 仍须能下沉：最重的盐水满浸时 F浮 < G（示数 > 0）
    assert.ok(MC.buoyantForce(1200, 1) < MC.STONE_WEIGHT, '盐水满浸浮力已超重力，石块会上浮');
    const stoneDensity = MC.STONE_WEIGHT / (MC.STONE_VOLUME * MC.G);
    assert.ok(stoneDensity > 1200, `石块密度 ${stoneDensity} 不大于盐水密度`);
  });

  test('滑块触控热区 ≥44px（希沃大屏 / 手机端）', () => {
    const src = read('src/components/lab/ParamSlider.tsx');
    assert.match(src, /flex min-h-\[44px\] items-center gap-2\.5/, '滑块行未加 44px 下限');
    assert.match(src, /h-11 min-h-\[44px\] flex-1/, '滑块本体未加 44px 热区');
  });
});

describe('物理题库守卫', () => {
  const PHYS: [string, Record<string, readonly (readonly [string, string])[]>, Record<string, string[]>][] = [
    ['Buoyancy.tsx', Q_B as never, C_B],
    ['Lever.tsx', Q_L as never, C_L],
    ['Lens.tsx', Q_S as never, C_S],
    ['Pressure.tsx', Q_P as never, C_P],
    ['Pulley.tsx', Q_U as never, C_U],
    ['Ohm.tsx', Q_O as never, C_O],
  ];

  test('每题的正解必须落在选项值域内（此前 4 道预测题的正确值根本不在值域 → 永不判对）', () => {
    let n = 0;
    for (const [file, OPT, COR] of PHYS) {
      for (const [qid, pairs] of Object.entries(OPT)) {
        const vals = (pairs as readonly (readonly [string, string])[]).map((p) => p[0]);
        const cor = COR[qid];
        assert.ok(cor && cor.length, `${file} ${qid}: 缺少判题键`);
        for (const c of cor) {
          assert.ok(vals.includes(c), `${file} ${qid}: 正确值 ${c} 不在值域 ${vals.join(',')}`);
        }
        n++;
      }
    }
    assert.ok(n >= 23, `物理题库题目总数应 ≥23，实测 ${n}`);
  });

  test('题号键必须与 predict/conclude 真实题号一致（杜绝「按 q 序号」串味）', () => {
    for (const [file, OPT, COR] of PHYS) {
      const optKeys = Object.keys(OPT).sort();
      const corKeys = Object.keys(COR).sort();
      assert.deepEqual(corKeys, optKeys, `${file}: OPTIONS 与 QUIZ_CORRECT 题号不一致`);
      for (const k of optKeys) {
        assert.match(k, /^(predict|conclude)Q\d+$/, `${file}: 题号 ${k} 不是 predictQn/concludeQn`);
      }
    }
  });

  test('选项长度收敛：任一题任一语种 max/min ≤ 1.15（破「最长项即答案」）', () => {
    // 文案在各实验自己的 copy 对象里（不在全局 i18n）→ 逐实验解析其 zh 块，并断言解析覆盖率
    const zhOf = (file: string): Record<string, string> => {
      const src = readFileSync(`src/labs/physics/${file}`, 'utf8');
      const i = src.indexOf('zh: {'), j = src.indexOf('en: {', i);
      const blk = src.slice(i, j);
      const out: Record<string, string> = {};
      for (const m of blk.matchAll(/(\w+):\s*'((?:[^'\\]|\\.)*)'/g)) out[m[1]] = m[2];
      return out;
    };
    let checked = 0, fails: string[] = [];
    let missing = 0, total = 0;
    for (const [file, OPT] of PHYS) {
      const zh = zhOf(file);
      for (const [qid, pairs] of Object.entries(OPT)) {
        const lens = (pairs as readonly (readonly [string, string])[])
          .map(([, key]) => { total++; const v = zh[key]; if (!v) missing++; return (v ?? '').length; })
          .filter((l) => l > 0);
        if (lens.length < 2) continue;
        const ratio = Math.max(...lens) / Math.min(...lens);
        checked++;
        // 中文选项最短常见 2 字（如「越大 / 越小」），过短会导致比值天然偏大 → 门槛按「长度差 ≤4 字」双判
        const diff = Math.max(...lens) - Math.min(...lens);
        if (ratio > 1.15 && diff > 4) {
          fails.push(`${file} ${qid}: 长度比 ${ratio.toFixed(2)}（差 ${diff} 字）${lens.join('/')}`);
        }
      }
    }
    // 覆盖率护栏：文案键解析不到就必须红，否则长度检查会静默空转（本轮踩过）
    assert.equal(missing, 0, `${missing}/${total} 个选项文案键未在该实验 zh 块中解析到`);
    assert.ok(checked >= 20, `实测题数应 ≥20，实测 ${checked}`);
    assert.equal(fails.length, 0, `选项长度失衡：\n  ${fails.join('\n  ')}`);
  });

  test('正解位置分布不偏：受选项个数上限约束，可达域内必须均衡', () => {
    // 实测：23 题中 13 题只有 2 个选项 → 正解只可能在 A/B，位置均衡存在理论上限。
    // 因此按「选项数分档」断言可达域内的均衡，而不是对全体套一个 [25%,40%]。
    const byCount: Record<number, number[]> = {};
    for (const [, OPT, COR] of PHYS) {
      for (const [qid, pairs] of Object.entries(OPT)) {
        const vals = (pairs as readonly (readonly [string, string])[]).map((p) => p[0]);
        const idx = vals.findIndex((v) => COR[qid].includes(v));
        (byCount[vals.length] ??= []).push(idx);
      }
    }
    const two = byCount[2] ?? [];
    assert.ok(two.length >= 8, `两选项题应 ≥8，实测 ${two.length}`);
    const aShare = two.filter((i) => i === 0).length / two.length;
    assert.ok(aShare >= 0.4 && aShare <= 0.6, `两选项题的正解 A 占比 ${(aShare * 100).toFixed(1)}% 偏离均衡带 [40%,60%]`);
    // 3+ 选项题：C/D 必须被用到（不得全部堆在 A）
    const multi = Object.entries(byCount).filter(([k]) => +k >= 3).flatMap(([, v]) => v);
    if (multi.length >= 4) {
      const cd = multi.filter((i) => i >= 2).length / multi.length;
      assert.ok(cd >= 0.2, `3+ 选项题里 C/D 占比仅 ${(cd * 100).toFixed(1)}%，位置偏见未消除`);
    }
  });

  test('题库文案严禁对勾/叉字形', () => {
    for (const f of ['Ohm.tsx', 'Circuits.tsx', 'Buoyancy.tsx', 'Lever.tsx', 'Lens.tsx', 'Pressure.tsx', 'Pulley.tsx']) {
      const src = readFileSync(`src/labs/physics/${f}`, 'utf8');
      assert.ok(!/[\u2713\u2717\u2714\u2718]/.test(src), `${f} 题库/界面含对勾叉字形`);
    }
  });

  test('Ohm concludeQ4：标为「等价变形」的 U = I×R 必须同为正确（原先选了反而判错）', () => {
    assert.ok(C_O.concludeQ4.includes('iur'), 'I = U / R 须为正确');
    assert.ok(C_O.concludeQ4.includes('uir'), 'U = I × R 标为等价变形，必须同为正确');
  });

  test('串并联题库（circuitStyles）：correctIndex 合法、选项长度收敛、C/D 被用到', () => {
    let n = 0;
    const idxs: number[] = [];
    const fails: string[] = [];
    for (const st of CIRCUIT_STYLES) {
      for (const q of st.copy.conclude ?? []) {
        n++;
        const opts = q.options;
        assert.ok(Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < opts.length,
          `${st.id}: correctIndex ${q.correctIndex} 越界（选项 ${opts.length} 个）`);
        idxs.push(q.correctIndex);
        const lens = opts.map((o) => o.zh.length);
        const ratio = Math.max(...lens) / Math.min(...lens);
        if (ratio > 1.15 && Math.max(...lens) - Math.min(...lens) > 4) {
          fails.push(`${st.id}: 长度比 ${ratio.toFixed(2)} ${lens.join('/')}`);
        }
      }
    }
    assert.ok(n >= 8, `串并联题库应 ≥8 题，实测 ${n}`);
    assert.equal(fails.length, 0, `串并联选项长度失衡：\n  ${fails.join('\n  ')}`);
  });
});

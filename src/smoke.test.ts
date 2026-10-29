/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * Smoke tests: covering the parts that must not silently break.
 * Uses Node built-in assert + the register-then-run harness in src/testing/harness.ts —
 * no test framework dependency. Every case is registered first and executed once by
 * runAll() at the end of this file; skipped cases are reported as skipped, never passed.
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
import { labs, labMap, labsForSubject, isToolLab } from './lib/labs';
import { translations } from './lib/i18n';
import { planTasks, formatSize, type PackManifest } from './lib/offline-pack';
import {
  AUDIO_CACHE, AUDIO_URL_PATTERN, DIAGRAM_CACHE, DIAGRAM_URL_PATTERN,
  PHOTO_CACHE, PHOTO_URL_PATTERN,
} from './lib/offline-media';
import { subjects, subjectList } from './lib/subjects';
import { isStoppedAnswer, markStopped, stripStoppedMark } from './lib/ai-history';
import { isNearBottom, STICK_THRESHOLD } from './lib/ai-scroll';
import { parseQuizBatch, judgeFillAnswer, parseQuizQuestion, stripModelDecorations } from './lib/ai-quiz';
import {
  buildSystemPrompt, buildQuizPrompt,
  keysByProviderOf,
  STALL_TIMEOUT_MS,
  estimateTokens, countCjk, classifyChatFailure, type AiFailureKind } from './lib/ai-config';
import { shellLayout, coreRadiusFor, dotRadiusFor, ATOM_VIEW } from './lib/atom-shells';
import { ELEMENTS } from './lib/elements';
import { APP_VERSION, CHANGELOG } from './lib/changelog';
import { getDynamicQuestions } from './lib/ai-dynamic-questions';
import { addTokenUsage, clearTokenUsage, loadTokenUsage, pruneTokenUsage, tokenUsageTotal, RETENTION_DAYS, type TokenUsageData } from './lib/token-usage';
import { ATOM_RADII, radiusOf, layoutInMolecule } from './components/lab/MicroAnimation';
import { phAt } from './labs/chemistry/Neutralization';
import {
  currentOf as coreCurrentOf,
  elementResistance as coreElementResistance,
  sampleOhm as coreSampleOhm,
} from './labs/physics/ohm-core';
import { currentOf, elementResistance, getEngineKind, loadOhmEngine, sampleOhm } from './labs/physics/ohm-engine';
import { imageV } from './labs/physics/lens-core';
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
import { CONSTANTS as PC } from './lib/constants';
import * as BENCH from './components/lab/LensBench';
import {

  imageV as stemImageV,
  quadraticY as stemQuadraticY,
  sampleQuadratic as stemSampleQuadratic,
} from './labs/physics/stem-engine';
import { quadraticY, sampleQuadratic } from './labs/math/quadratic-core';

// ── AI 面板源码全集（P0 拆分 + P1 抽 Hook 后）─────────────────
// 面板 JSX 已外置到 components/ai/panels/*，业务状态与处理器已抽到 components/ai/hooks/*，
// 页面学科名的 helper 在 components/ai/page-subject.ts。设计纪律守卫（热区 / 描边 / 图标 /
// 尺寸 / 文案）与链路守卫（思考参数同一出口、出题走链路默认、信号被消费）原本整片扫
// AiAssistant.tsx；拆分后若仍只扫主文件，守卫会静默失效（P0 时实测 14 项变红、P1 时 3 项变红）。
// 约定：这些守卫一律用 readAiPanel() 读「主文件 + 全部外置面板 + 共享件 + 全部 Hook」的拼接。
const AI_PANEL_FILES = [
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
const readAiPanel = (): string => AI_PANEL_FILES.map((f) => readFileSync(f, 'utf8')).join('\n');


// 运行器：先注册、后执行。执行入口在文件末尾的 runAll()，不在文件中段。
import { describe, test, setup, runAll } from './testing/harness';

/* ── Lab registration ── */

describe('Lab registration', () => {
  test('has 16 registered labs', () => {
    assert.equal(labs.length, 16);
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
    assert.equal(labsForSubject('physics').length, 8);
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

/* ── 数学纯函数「二次函数采样」已拆为独立入口 ──
 * 见 src/labs/math/math-pure.entry.test.ts：它有自己的 harness 实例与 runAll()，
 * 不要在 smoke 里再次注册，否则同一批用例会被执行两遍。
 * 注意：本文件第 221 行的 quadraticY / sampleQuadratic 导入仍被下方
 * stem-engine 门面对拍用例使用，不要一并删除。 */

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

// loadOhmEngine 永不 reject：无产物 / 缺函数 / 实例化失败一律回退 js。
// 阶段一：加载动作改为显式 setup 步骤——它注册在「未 load」套件之后、「load 后」套件之前，
// 由运行器按注册顺序执行，不再依赖模块顶层语句的先后（原先靠这里的顶层 await）。
let loadedOhmKind: 'js' | 'wasm' | undefined;
setup('加载 Ohm / Stem 计算引擎（loadOhmEngine；失败静默回退 js）', async () => {
  loadedOhmKind = await loadOhmEngine();
});

describe('Ohm engine facade（loadOhmEngine 后）', () => {
  test('加载不抛错，kind ∈ {js, wasm}；本机无 stemCore.js 时应为 js', () => {
    assert.ok(loadedOhmKind === 'js' || loadedOhmKind === 'wasm');
    assert.equal(getEngineKind(), loadedOhmKind);
  });

  test('引擎种类与产物探测一致（存在 stemCore.js → wasm；否则 JS 回退）', () => {
    assert.ok(loadedOhmKind === 'js' || loadedOhmKind === 'wasm', `实测 kind=${loadedOhmKind}`);
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

  test('产物探测与引擎种类一致（存在 stemCore.js → 应走 wasm；否则 js 回退）', () => {
    if (hasWasm) {
      assert.equal(loadedOhmKind, 'wasm', `实测 kind=${loadedOhmKind}`); // 本机有产物且导出齐全 → 必须 wasm
    } else {
      assert.equal(loadedOhmKind, 'js', `实测 kind=${loadedOhmKind}`);
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

/* ── 计算引擎徽标文案：单点来源 + 结果一致性（老实验三件套与工作台共用一套）── */

describe('计算引擎徽标的悬停文案（单点 + 结果一致性）', () => {
  test('引擎文案必须来自单点文件：老实验走 formulas、工作台走 circuit，不得再逐字复制', () => {
    const targets: [string, string][] = [
      ['src/labs/physics/Ohm.tsx', 'formulas'],
      ['src/labs/physics/Lens.tsx', 'formulas'],
      ['src/labs/math/Quadratic.tsx', 'formulas'],
      ['src/labs/physics/circuit-bench/CircuitEngineBadge.tsx', 'circuit'],
    ];
    for (const [f, scope] of targets) {
      const src = readFileSync(f, 'utf8');
      assert.match(
        src,
        new RegExp(`getEngineTooltip\\([^)]*, '${scope}', lang\\)`),
        `${f} 须调用单点 getEngineTooltip(…, '${scope}', …)`,
      );
      // 裸字面量：三实验旧的两条中英文案、工作台私有的两段标题，一律不得回归
      assert.doesNotMatch(
        src,
        /计算引擎：|Engine: C\+\+ WebAssembly|Engine: JS fallback|线性求解核已加载|WASM 产物未构建时自动回退/,
        `${f} 不得再有裸的引擎文案字面量（只能从 engine-copy 取）`,
      );
      // 各自维护一份 i18n 键 = 复制粘贴的源头（zh/en 各一份都要删干净）
      assert.doesNotMatch(src, /engineWasm|engineJs/, `${f} 不得再维护自己的 engineWasm/engineJs 键`);
    }
  });

  test('八条文案都须含结果一致性语义，且排版无全角半角混排', () => {
    const code = readFileSync('src/components/lab/engine-copy.ts', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    const zh = code.match(/zh: '[^']*'/g) ?? [];
    const en = code.match(/en: '[^']*'/g) ?? [];
    assert.equal(zh.length, 4, `中文文案须 4 条（2 职责 × 2 态），实测 ${zh.length}`);
    assert.equal(en.length, 4, `英文文案须 4 条（2 职责 × 2 态），实测 ${en.length}`);
    // 学生看到徽章变成「JS」时唯一会担心的是「结果会不会变」——这半句必须每条都有
    for (const s of zh) assert.match(s, /结果与|结果一致/, `中文文案缺结果一致性语义：${s}`);
    for (const s of en) assert.match(s, /identical results/, `英文文案缺结果一致性语义：${s}`);
    // 排版：全角括号前不留半角空格（旧文案 `TypeScript 线性核 （…）` 正是反例），
    // 且 CJK 与拉丁字母之间必须留一个空格（「原生 C++ 计算核」，不是「原生 C++计算核」）
    assert.doesNotMatch(code, /\s（/, '全角括号前不得留半角空格');
    assert.doesNotMatch(code, /[\u4e00-\u9fa5][A-Za-z]|[A-Za-z][\u4e00-\u9fa5]/, 'CJK 与拉丁字母之间必须留一个空格');
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

// 「Chemistry labs: academic hard-fault regressions」已整体拆为独立入口（29 个用例）：
// src/labs/chemistry/chemistry-labs-guards.entry.test.ts。不要在此重新注册。
// 注册模块在 src/testing/（含 ✓/✗ 字面量，放进 src/labs 会被全站字形守卫判红）；
// 其 repoPath() 从模块位置推导仓库根，不再依赖 process.cwd()。

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

// 「LaTeX → TTS speech conversion」已整体拆为独立入口（30 个用例）：
// src/lib/latex-speech.entry.test.ts。不要在此重新注册。
// 逐字快照另见 src/latex-speech.golden.test.ts（109 输入 × 4 配置），两者互补。

/* ── AI Q&A history (localStorage persistence) ── */

// 「AI Q&A history (localStorage persistence)」已整体拆为独立入口（5 个用例）：
// src/lib/ai-history-storage.entry.test.ts。不要在此重新注册。
// 注册模块在 src/testing/ai-history-storage.test.ts（用例内装假 window，finally 还原）。

/* ── Feedback queue (localStorage cap + remove) ── */

// 「Feedback queue (localStorage persistence)」已整体拆为独立入口（3 个用例）：
// src/lib/feedback-queue-storage.entry.test.ts。不要在此重新注册。
// 注册模块在 src/testing/feedback-queue-storage.test.ts（假 window + 假 fetch，finally 还原）。

/* ── Quiz history (localStorage cap + wrong filter) ── */

// 「Quiz history (localStorage persistence)」已整体拆为独立入口（5 个用例）：
// src/lib/quiz-history-storage.entry.test.ts。不要在此重新注册。
// 注册模块在 src/testing/quiz-history-storage.test.ts（用例内装假 window，finally 还原）。

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

// 错题集「学情概览」聚合层的三组守卫与样本构造器 qh() 已整体迁出；
// qh() 现由 src/testing/quiz-summary-fixtures.ts 提供（函数体逐字未改）。

// 「Quiz summary — 错误类型归类」已整体拆为独立入口（4 个用例）：
// src/lib/quiz-summary-error-kinds.entry.test.ts。不要在此重新注册。
// 注册模块在 src/testing/quiz-summary-error-kinds.test.ts。

// 「Quiz summary — 科目与薄弱知识点」已整体拆为独立入口（3 个用例）：
// src/lib/quiz-summary-overview.entry.test.ts。不要在此重新注册。
// 注册模块在 src/testing/quiz-summary-overview.test.ts。

// 「Quiz summary — 趋势与 AI 输入」已整体拆为独立入口（9 个用例）：
// src/lib/quiz-summary-trend.entry.test.ts。不要在此重新注册。
// 注册模块在 src/testing/quiz-summary-trend.test.ts；样本构造器 qh() 见 quiz-summary-fixtures。

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

// 「Feedback push path (one push per submission)」已整体拆为独立入口（7 个用例，全 async）：
// src/lib/feedback-push-path.entry.test.ts。不要在此重新注册。
// 注册模块在 src/testing/feedback-push-path.test.ts；队列状态由模块级变量驱动，
// 用例顺序即语义，入口内必须串行（harness runAll() 逐个 await，已满足）。


// 「AI prompt contracts」已整体拆为独立入口（20 个用例）：
// src/lib/ai-prompt-contracts.entry.test.ts。不要在此重新注册。
// 注册模块在 src/testing/ai-prompt-contracts.test.ts；原文件级助手 Q() 与样本 RAW_OK
// 只被该套件使用，已随块搬走（此处不再保留死代码）。


// 「AI thinking stream (display only)」已整体拆为独立入口（6 个用例，含 2 个 async）：
// src/lib/ai-thinking-stream.entry.test.ts。不要在此重新注册。
// 注册模块在 src/testing/ai-thinking-stream.test.ts；原文件级常量 T_OPEN / T_CLOSE
// 仅该套件使用，已随块搬走（此处不再保留死代码）。

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

// 「AI 思考强度档位（逐模型能力表；教学伦理：只调思考深度，不改提示词约束）」已整体拆为
// 独立入口（10 个用例，含 1 个 async）：src/lib/ai-thinking-tiers.entry.test.ts。
// 注册模块在 src/testing/ai-thinking-tiers.test.ts（零文件读取）。


/* ── 思考参数下发：请求体与界面留痕共用唯一出口 resolveThinkingDispatch ── */

// 「思考参数下发 · 留痕与实发同源（resolveThinkingDispatch）」已整体拆为独立入口（5 个用例）：
// src/lib/ai-thinking-dispatch.entry.test.ts。不要在此重新注册。
// 注册模块在 src/testing/ai-thinking-dispatch.test.ts（1 处读源码 + readAiPanel 走 ai-panel-source）。


/* ── 输出上限与空正文：思考型模型的思考不得把正文预算挤成空白 ── */

// 「输出上限与空正文（P0 防御：思考型模型 / 本地端点）」已整体拆为独立入口（10 个用例）：
// src/lib/ai-output-limits.entry.test.ts。不要在此重新注册。
// 注册模块在 src/testing/ai-output-limits.test.ts（2 处读源码 + readAiPanel 走 ai-panel-source）。


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
  const panelSrc = readAiPanel();
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
  const panelSrc = readAiPanel();
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
    // P0 拆分后：这里只认「设置面板自己的」吸底栏。AI 聊天区另有一个 sticky bottom-0 的
    // 「回到最新」浮动层（h-0 + pointer-events-none，本就是透明的空占位），
    // 若与面板源码拼接在一起判断，首个匹配会取到它，护卫就误报了。
    const settings = readFileSync('src/components/ai/panels/SettingsPanel.tsx', 'utf8');
    const bar = settings.match(/className="sticky bottom-0[^"]*"/);
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
  const panelSrc = readAiPanel();
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

// 「元素详情卡：相邻导航 / 电子层胶囊 / 微粒看板」已整体拆为独立入口（8 个用例）：
// src/pages/periodic-detail-card.entry.test.ts。不要在此重新注册。
// 注册模块在 src/testing/periodic-detail-card.test.ts（1 处读源码走 repoPath）。


/* ── 计数口径：对外文案必须与注册表真值一致（曾出现「15 实验 / 16 实验」「4 工具 / 5 工具」两套数并存） ── */

describe('计数口径（注册表真值 ↔ 对外文案）', () => {
  const regularLabs = labs.filter((lab) => !isToolLab(lab)).length;
  const toolLabs = labs.filter((lab) => isToolLab(lab)).length;
  // 固定路由查表工具：元素周期表 / 物理常量 / 物理公式 / 数学公式（见 vite.config.ts 的固定路由表）
  const LOOKUP_TOOLS = 4;
  const TOOL_TOTAL = LOOKUP_TOOLS + toolLabs;

  test('注册表真值：15 个常规实验 + 5 个工具（4 查表 + 1 工具台）', () => {
    assert.equal(regularLabs, 15, `常规实验数变了就须同步全站文案：实测 ${regularLabs}`);
    assert.equal(toolLabs, 1, `工具台数变了就须同步全站文案：实测 ${toolLabs}`);
    assert.equal(regularLabs + TOOL_TOTAL, 20, '可互动页面总数（实验 + 工具）应仍为 20');
  });

  const SURFACES: [string, string[]][] = [
    ['index.html', ['15 个交互实验', '5 个工具']],
    ['README.md', ['15 个交互实验 + 5 个工具', '15 interactive labs + 5 tools', 'All 15 labs and all 5 tool pages']],
    ['src/lib/use-page-meta.ts', ['15 个交互实验 + 5 个工具']],
    ['vite.config.ts', ['15 个交互实验 + 5 个工具']],
    ['src/lib/i18n.ts', ['15 个实验都按', 'All 15 labs run']],
  ];

  const STALE = [
    '16 个交互实验',
    '4 个查表工具',
    '16 个实验',
    '16 interactive labs',
    '4 lookup tools',
    '4 tool pages',
    '4 个工具页',
    '405 项',
    '405 assertions',
  ];

  /** 断言只扫代码段：注释里允许出现旧口径的说明（本项目已两度被自己引用的旧文案绊倒） */
  const code = (file: string, src: string) =>
    /\.(ts|tsx)$/.test(file)
      ? src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
      : src;

  test('对外文案已无过时口径（防回归）', () => {
    for (const [file] of SURFACES) {
      const src = code(file, readFileSync(file, 'utf8'));
      for (const stale of STALE) {
        assert.ok(!src.includes(stale), `${file} 仍含过时计数口径「${stale}」`);
      }
    }
  });

  test('对外文案写明现行口径', () => {
    for (const [file, needles] of SURFACES) {
      const src = code(file, readFileSync(file, 'utf8'));
      for (const needle of needles) {
        assert.ok(src.includes(needle), `${file} 缺少现行计数口径「${needle}」`);
      }
    }
  });
});

/* ── README 首屏纪律：工业风（禁 Emoji）+ 硬指标与实测一致 ── */

describe('README（工业风纪律与硬指标）', () => {
  const readme = readFileSync('README.md', 'utf8');
  const hero = readme.split('\n---\n')[0];

  test('全文禁 Emoji（工业/学术风纪律；白名单仅 ▶ 这一个最小几何符号）', () => {
    // 白名单只有 ▶（U+25B6，首屏「在线体验」的前缀）。它落在几何符号区，
    // 因此这里把 25A0–25FF 一并纳入扫描范围，让白名单成为「显式的唯一例外」而不是漏网。
    const WHITELIST = new Set(['▶']);
    const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{25A0}-\u{25FF}\u{FE0F}]/gu;
    const hits = (readme.match(EMOJI) || []).filter((ch) => !WHITELIST.has(ch));
    assert.equal(
      hits.length,
      0,
      `README 全文不得出现 Emoji —— 实测命中：${[...new Set(hits)].join(' ')}`,
    );
  });

  test('白名单符号确实在用（白名单不得空转成无解释的例外）', () => {
    assert.ok(readme.includes('▶'), '白名单里的 ▶ 已不再使用——应把它从白名单移除');
  });

  test('首屏硬指标须与注册表/实测一致（徽章与三栏表同源）', () => {
    const regular = labs.filter((lab) => !isToolLab(lab)).length;
    const tools = labs.filter((lab) => isToolLab(lab)).length + 4; // +4 固定路由查表工具
    assert.ok(
      hero.includes(`${regular} 个交互实验 + ${tools} 个工具`),
      `首屏须写明注册表真值「${regular} 个交互实验 + ${tools} 个工具」`,
    );
    // 徽章视觉：统一深炭灰 labelColor，禁用高饱和撞色
    const badges = hero.match(/https:\/\/img\.shields\.io\/[^\s")]+/g) || [];
    assert.ok(badges.length >= 5, `首屏徽章数偏少：${badges.length}`);
    for (const b of badges) {
      assert.ok(b.includes('labelColor=18181b'), `徽章须统一深炭灰底 labelColor=18181b：${b.slice(0, 60)}…`);
      assert.ok(!/color=(f|e|d)[0-9a-f]{5}/i.test(b), `徽章值色不得用高饱和亮色：${b.slice(0, 60)}…`);
    }
  });

  test('首屏锚点必须指向真实存在的标题（防坏链）', () => {
    // GitHub 锚点规则：小写、去掉标点、空格转连字符（中文保留），故这里同样 slug 化后再比对
    const slug = (h: string) =>
      h.trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-');
    const headings = readme
      .split('\n')
      .filter((l) => /^#{1,3} /.test(l))
      .map((l) => slug(l.replace(/^#{1,3} /, '')));
    const anchors = [...hero.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
    assert.ok(anchors.length >= 4, `首屏导航锚点偏少：${anchors.length}`);
    for (const a of anchors) {
      assert.ok(
        headings.includes(decodeURIComponent(a).toLowerCase()),
        `首屏锚点 #${a} 在 README 里没有对应标题（会变成死链）`,
      );
    }
    assert.ok(!hero.includes('README_EN.md'), 'README 首屏不得链接不存在的 README_EN.md（英文在文内 #english）');
  });

  test('首屏与正文的测试数必须同源（防只改一处）', () => {
    // 五处口径：徽章 / 三栏表 / 口径注释 / 中文正文 / 英文正文。
    // 本守卫只能保证「五处彼此一致」——它们可以一起错。真正的「与实测一致」由
    // scripts/check-readme-stats.mjs 在整条测试链跑完后比对（那里才有全量统计），
    // 所以这里改完数字后仍必须跑完整 npm test，不能只看本守卫是否为绿。
    const badge = /Tests-(\d+)%20passed/.exec(hero)?.[1];
    const table = /(\d+) 项单测门禁/.exec(readme)?.[1];
    const note = /(\d+) passed\s+←\s+npm test 实测/.exec(readme)?.[1];
    const zh = /\*\*(\d+) 项全绿\*\*/.exec(readme)?.[1];
    const en = /\*\*(\d+) assertions, all green\*\*|\*\*(\d+) cases, all green\*\*/.exec(readme);
    const enNum = en?.[1] ?? en?.[2];
    assert.ok(
      badge && table && note && zh && enNum,
      `五处测试数都要能取到：徽章 ${badge} / 三栏表 ${table} / 口径注释 ${note} / 中文 ${zh} / 英文 ${enNum}`,
    );
    assert.equal(badge, table, `徽章测试数（${badge}）与三栏表（${table}）不一致`);
    assert.equal(badge, note, `徽章测试数（${badge}）与口径注释（${note}）不一致`);
    assert.equal(badge, zh, `徽章测试数（${badge}）与中文正文（${zh}）不一致`);
    assert.equal(badge, enNum, `徽章测试数（${badge}）与英文正文（${enNum}）不一致`);
  });
});

/* ── issue 模板：与 README 提示同一套字段，且刻意保留空白 issue ── */

describe('issue 模板（.github/ISSUE_TEMPLATE）', () => {
  const form = readFileSync('.github/ISSUE_TEMPLATE/bug.yml', 'utf8');
  const picker = readFileSync('.github/ISSUE_TEMPLATE/config.yml', 'utf8');
  const readme = readFileSync('README.md', 'utf8');

  test('缺陷表单含四项必填字段（页面 / 步骤 / 环境 / 版本）', () => {
    for (const id of ['page', 'steps', 'env', 'version']) {
      assert.ok(new RegExp(`id: ${id}\\b`).test(form), `issue 表单缺少字段 id: ${id}`);
    }
    for (const label of ['出问题的页面', '复现步骤', '浏览器与设备', '版本号']) {
      assert.ok(form.includes(label), `issue 表单缺少字段标签「${label}」`);
    }
    assert.equal(
      (form.match(/required: true/g) || []).length,
      4,
      '必填字段应恰为 4 个（截图一栏必须留可选，不能拿必填把人挡在门外）',
    );
  });

  test('表单与 README 提示同源（改一处必须改两处）', () => {
    for (const needle of ['复现步骤', '浏览器与设备', '版本号']) {
      assert.ok(readme.includes(needle), `README 反馈段未提示「${needle}」`);
    }
    assert.ok(
      /include the \*\*page, browser and device, and the steps to reproduce\*\*/.test(readme),
      '英文侧同样要提示字段（中英同步）',
    );
  });

  test('保留空白 issue + 并列给出站内反馈气泡入口', () => {
    assert.ok(/blank_issues_enabled:\s*true/.test(picker), '不得禁用空白 issue（模板只用来把信息问清，不强迫填表）');
    assert.ok(picker.includes('https://stem.irky.dev/guide'), '选择器须给出站内反馈气泡入口');
    assert.ok(/name: 缺陷反馈|description: .+/.test(form), '表单须声明 name / description（两平台都要求）');
  });
});

/* ── 使用说明页（/guide）与现状同步：发布主打功能不得在说明里缺席、用词须与界面一致 ── */

describe('使用说明页（/guide）文案同步', () => {
  const src = readFileSync('src/pages/GuidePage.tsx', 'utf8');

  test('覆盖电学工作台与工具区（新功能不得在说明里缺席）', () => {
    for (const needle of ['工作台接线', '工作台视图', '工作台模拟', '工作台数据', '工具页例外']) {
      assert.ok(src.includes(needle), `说明页缺少「${needle}」条目`);
    }
  });

  test('视图用词与界面一致，且不出现已退役旧词', () => {
    assert.ok(src.includes('电路图 / 仿真图'), '说明页须用界面词「电路图 / 仿真图」');
    for (const stale of ['原理图', '实物图', 'schematic', 'realistic']) {
      assert.ok(!src.includes(stale), `说明页仍含已退役旧词「${stale}」`);
    }
  });

  test('中英同步：新增条目两侧都在（防止只加一侧）', () => {
    const pairs: [string, string][] = [
      ['工作台接线', 'Workbench wiring'],
      ['工作台视图', 'Workbench views'],
      ['工作台模拟', 'Workbench run'],
      ['工作台数据', 'Workbench data'],
      ['工具页例外', 'Tool pages'],
      ['3D 立体模型', '3D model'],
    ];
    for (const [zh, en] of pairs) {
      assert.ok(src.includes(zh), `中文侧缺少「${zh}」`);
      assert.ok(src.includes(en), `English side missing "${en}"`);
    }
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
    // README 首屏的版本徽章没有第二个守卫，改版本时最容易漏掉它，在这里一起核。
    const readme = readFileSync('README.md', 'utf8');
    const badge = /badge\/Version-v(\d+\.\d+\.\d+)-/.exec(readme)?.[1];
    const alt = /alt="Version v(\d+\.\d+\.\d+)"/.exec(readme)?.[1];
    assert.equal(badge, APP_VERSION, `README 版本徽章（${badge}）与 APP_VERSION（${APP_VERSION}）不一致`);
    assert.equal(alt, APP_VERSION, `README 版本徽章 alt（${alt}）与 APP_VERSION（${APP_VERSION}）不一致`);
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

  test('首条用词与界面对齐：不得用已退役的界面旧词，也不得夹带内部路径', () => {
    const first = CHANGELOG[0];
    // 两个视图的界面用词只有一个来源：circuit-bench-view.ts 的 viewModeLabel
    // （zh 电路图 / 仿真图，en Circuit / Simulation）——旧词「原理图 / 实物图」早已退役，
    // 工具栏甚至用断言禁止它们回归；变更记录若继续用旧词，用户在界面上找不到对应物。
    const RETIRED = ['原理图', '实物图', 'Schematic', 'schematic', 'Physical', 'realistic', '熔毁', '专业电学工作台'];
    // 禁写清单（规范 §四）：不写实现机制与内部地址，地址栏字符串对非技术读者无意义
    const ROUTE = /(^|[\s（(])\/[a-z][a-z0-9-]{2,}/;
    for (const line of [...first.zh, ...first.en]) {
      for (const stale of RETIRED) {
        assert.ok(!line.includes(stale), `变更记录仍在用界面已退役的旧词「${stale}」：${line.slice(0, 40)}…`);
      }
      assert.doesNotMatch(line, ROUTE, `变更记录不得夹带内部路径（规范 §四 禁写清单）：${line.slice(0, 40)}…`);
    }
  });
});


/* ── 错题卷组卷（纯函数）：分节 / 连续编号 / 答案形态 / 留白 ── */

// 「错题卷组卷（buildQuizPaper）」已整体拆为独立入口（13 个用例）：
// src/lib/quiz-paper.entry.test.ts。不要在此重新注册。
// 注册模块在 src/testing/quiz-paper.test.ts（纯逻辑，零文件读取）。

/* 执行入口已移到文件末尾：全部 describe / test 注册完成后由 runAll() 统一执行。 */

// 「触屏热区 · 反向对抗守护（v0.35.0）」已整体拆为独立入口（7 个用例）：
// src/components/layout/touch-target-guards.entry.test.ts。不要在此重新注册。
// 注册模块在 src/testing/touch-target-guards.test.ts（12 处读源码走 repoPath）。



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
    assert.match(readAiPanel(), /offlineAi\.localApi/, 'AI 面板须按端点类型区分断网文案');
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
    const ai = readAiPanel();
    assert.ok(!/behavior:\s*'smooth'/.test(ai), "流式滚动不得再用 smooth：每 delta 重启平滑动画会抖，也会吃掉用户手势");
    assert.match(ai, /if \(!el \|\| !stickRef\.current\) return;/, '仅吸底状态才跟随滚动');
    assert.match(ai, /onScroll=\{/, '滚动容器须带 onScroll 才能判定用户是否离底');
    assert.match(ai, /isNearBottom\(/, '离底判定须复用 ai-scroll 的纯函数（阈值单一口径）');
    assert.match(ai, /addEventListener\('wheel'/, '需监听滚轮主动上滑并解锁吸底');
    assert.match(ai, /addEventListener\('touchmove'/, '需监听触屏上滑并解锁吸底');
    assert.match(ai, /'回到最新内容'/, '离底后须给出回到底部的入口');
  });

  test('中断保全与首包超时：停止后成果入历史与上下文，20s 首包闸，reader 收口', () => {
    const ai = readAiPanel();
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
    const ai = readAiPanel();
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
    const ai = readAiPanel();
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
    const ai = readAiPanel();
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

// 「Token usage stacked bars (buildDailyBars)」已整体拆为独立入口（6 个用例）：
// src/lib/token-usage-bars.entry.test.ts。不要在此重新注册。
// 注册模块在 src/testing/token-usage-bars.test.ts（纯逻辑，零文件读取）。

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

// 「Token usage chart source guards (零第三方图表依赖)」已整体拆为独立入口（9 个用例）：
// src/components/ui/token-usage-chart.entry.test.ts。不要在此重新注册。
// 注册模块在 src/testing/token-usage-chart.test.ts（3 处读源码 + readAiPanel 走 ai-panel-source）。

/* ── AI 设置面板：高度自适应与控件质感（本轮精修守卫） ── */

// 「AI settings panel layout & control polish」已整体拆为独立入口（5 个用例）：
// src/components/ai/ai-settings-layout.entry.test.ts。不要在此重新注册。
// 注册模块在 src/testing/ai-settings-layout.test.ts；readAiPanel() 改由 src/testing/ai-panel-source.ts 提供。

/* ── AI 次级控件：视觉实体与触控热区解耦（去臃肿精修守卫） ── */

// 「AI 次级控件：视觉实体 ≤28px 且触屏热区由 tap-area 承托」已整体拆为独立入口（5 个用例）：
// src/components/ai/ai-secondary-controls.entry.test.ts。不要在此重新注册。
// 注册模块在 src/testing/ai-secondary-controls.test.ts；readAiPanel() 走 ai-panel-source。

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

// 「使用说明页信息层级重构（视频以下三层结构）」已整体拆为独立入口（10 个用例）：
// src/pages/guide-page-layers.entry.test.ts。不要在此重新注册。
// 注册模块在 src/testing/guide-page-layers.test.ts（1 处读源码走 repoPath）。

// 「化学模块高危边界加固（动画连续性 / 量程钳位 / 题库认知平衡）」已整体拆为独立入口（6 个用例）：
// src/labs/chemistry/chemistry-high-risk-guards.entry.test.ts。不要在此重新注册。
// 注册模块在 src/testing/chemistry-high-risk-guards.test.ts（5 处读源码走 repoPath）。

// 「周期表：离线包行内化 / 展台去硬包裹 / 3D 空间模型」已整体拆为独立入口（17 个用例）：
// src/pages/periodic-table-guards.entry.test.ts。不要在此重新注册。
// 注册模块在 src/testing/periodic-table-guards.test.ts；其 repoPath() 从模块位置推导仓库根，
// 不再依赖 process.cwd()。其中 21 处读源码改走 readSrc()，2 处「必须不存在」的反向断言走
// repoTarget()（repoPath 会校验存在性，反向断言用它会报错，语义正好相反）。

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

// 「Physics 电学核：欧姆定律与分压口径」已整体拆为独立入口（6 个用例）：
// src/labs/physics/ohm-core-guards.entry.test.ts。不要在此重新注册。
// 注册模块在 src/testing/ohm-core-guards.test.ts（纯逻辑，零文件读取）；
// 走 ohm-core 真源，不经 WASM 门面，故与引擎状态无关。

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

  // 「门面源码守卫：NaN 兜底 + 非有限归一 + 索引乘法循环 + 头注释警示」已拆为独立入口
  // （源码守卫，路径基准改为从模块位置推导）：
  // src/labs/physics/stem-engine-source-guards.entry.test.ts。不要在此重新注册。
  // 本套件其余用例依赖 loadOhmEngine() 之后的引擎指针状态，保留原位。
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

// 「数学模块数值稳定性与题库守卫」剩余 3 个用例已整体拆为独立入口：
// src/labs/math/math-numeric-guards.entry.test.ts。不要在此重新注册。
// 注册模块在 src/testing/math-numeric-guards.test.ts（1 处读源码走 repoPath）。

// 「滑动变阻器『一上一下』结构与直角走线守卫」已整体拆为独立入口（6 个用例）：
// src/labs/physics/rheostat-topology-guards.entry.test.ts。不要在此重新注册。
// 注册模块在 src/testing/rheostat-topology-guards.test.ts（1 处读源码走 repoPath）。

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

// 「物理题库守卫」已整体拆为独立入口（7 个用例）：
// src/labs/physics/physics-question-bank-guards.entry.test.ts。不要在此重新注册。
// 注册模块在 src/testing/physics-question-bank-guards.test.ts（2 处读源码走 repoPath）。


/* ── 电学工作台 M1 已拆为独立入口 ──
 * 见 src/labs/physics/circuit-bench/circuit-bench.entry.test.ts：它有自己的 harness
 * 实例与 runAll()，不要在 smoke 里再次注册，否则同一批用例会被执行两遍。 */

/* ── 执行入口：所有用例注册完毕后才开始跑 ── */

const summary = await runAll();
if (summary.exitCode !== 0) process.exit(summary.exitCode);

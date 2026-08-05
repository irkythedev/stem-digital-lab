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
  test('has 13 registered labs', () => {
    assert.equal(labs.length, 13);
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
    assert.equal(labsForSubject('chemistry').length, 2);
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

/* ── Summary ── */

console.log(`\n${'─'.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

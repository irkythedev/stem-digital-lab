/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 演示分步契约守卫：四几何实验每一步都必须有可观察的 dwell，
 * 且 HUD 不得再隐藏移动端 prev/next、必须保留 连播/步进 模式入口。
 */
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { runEntry } from '../../run-entry';
import { CONSTRUCTION_DEMO } from '../../../labs/math/construction-demo';
import { POSE_STEPS, SSA_STEPS } from '../../../labs/math/congruence-demo';
import { SIMILARITY_DEMO } from '../../../labs/math/similarity-demo';
import { POLYGON_DEMO } from '../../../labs/math/polygon-pi-demo';
import type { DemoStep } from '../../../components/lab/use-auto-timeline';

function register(test: (name: string, fn: () => unknown) => void): void {
  test('four geometry demos declare animation + dwell, and HUD keeps step access', () => {
    const groups: DemoStep<unknown>[][] = [
      ...Object.values(CONSTRUCTION_DEMO),
      POSE_STEPS,
      SSA_STEPS,
      SIMILARITY_DEMO,
      POLYGON_DEMO,
    ];
    for (const steps of groups) {
      for (const step of steps) {
        assert.ok((step.animationDuration ?? step.duration ?? 0) > 0, `${step.id} 缺少 animationDuration`);
        assert.ok((step.dwellDuration ?? 0) >= 500, `${step.id} 的 dwellDuration 不得低于 500ms`);
      }
    }

    const hud = readFileSync('src/components/lab/demo-hud.tsx', 'utf8');
    assert.doesNotMatch(hud, /hidden[^\n]*sm:inline-flex/, '移动端上一步/下一步不得再被 hidden');
    assert.match(hud, /labels\.auto/, 'HUD 缺少连播模式文案');
    assert.match(hud, /labels\.step/, 'HUD 缺少步进模式文案');
  });
}

await runEntry({ suite: '演示分步契约 · 四几何实验', register });

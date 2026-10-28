/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学工作台 · 页头计算核徽标
 *
 * 工作台不再自带顶栏，C++ / JS 徽标随标准实验页头的动作簇一起出现。
 * 加载策略与求解器一致：有 WASM 产物就显示「C++」，否则静默回退「JS」，
 * 因此这里只订阅 loadCircuitBenchEngine 的结果，不参与任何演算。
 * 悬停 / 读屏文案统一取自 components/lab/engine-copy（与三个老实验同一来源，
 * 只是职责范围换成 'circuit'）。
 */
import { useEffect, useState } from 'react';

import { useApp } from '../../../lib/app-context';
import EngineBadge from '../../../components/lab/EngineBadge';
import { getEngineTooltip } from '../../../components/lab/engine-copy';
import { loadCircuitBenchEngine, type CircuitEngineKind } from './circuit-bench-engine';

export default function CircuitEngineBadge() {
  const { lang } = useApp();
  const [kind, setKind] = useState<CircuitEngineKind>('ts');

  useEffect(() => {
    let alive = true;
    void loadCircuitBenchEngine().then((engine) => {
      if (alive) setKind(engine.kind);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <EngineBadge kind={kind === 'wasm' ? 'wasm' : 'js'} title={getEngineTooltip(kind, 'circuit', lang)} />
  );
}

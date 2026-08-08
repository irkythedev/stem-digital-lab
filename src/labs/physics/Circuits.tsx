/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 物理实验 · 串并联电路三幕式探究（苏科版 九上）
 *
 * 8 例经典电路图样式（串联 4 例 + 并联 4 例），样式切换共享同一套
 * 物理引擎、拓扑生成器、探针自由放置与模拟表盘。
 *
 * 幕 1 预测：按样式出预测题（亮度/分压/调光方向/分流关系）
 * 幕 2 探索：任务卡引导 + 自由操作（开关/滑块/探针测量）+ 观察笔记
 * 幕 3 结论：按样式出结论单选 + 考点速记
 *
 * 可视化：SVG 电路图（导线/灯泡/闸刀开关/电池/保险丝/变阻器/固定电表）
 * + 电流小点流动 + 灯泡亮度 ∝ P + 自由放置探针（虚线预览/非法接法拒绝）
 */
import { useMemo, useState } from 'react';
import { useApp } from '../../lib/app-context';
import ParamSlider from '../../components/lab/ParamSlider';
import ExploreStage, { type Observation, type ExploreCard } from '../../components/lab/ExploreStage';
import MeterProbe, { type MeterTarget } from '../../components/lab/MeterProbe';
import MeterGauge from '../../components/lab/MeterGauge';
import { GrabIcon } from '../../components/ui/LabIcon';
import Formula from '../../components/ui/Formula';
import { Bulb, BladeSwitch, Battery, HouseholdCircuit, Fuse, Rheostat, FixedMeter } from '../../components/lab/circuit/CircuitParts';
import {
  CIRCUIT_STYLES,
  genTopology,
  SVG_W,
  SVG_H,
  BATT_X,
  SW_X1,
  SW_X2,
  RIGHT_X,
  RETURN_Y,
  type CircuitStyleId,
} from './circuitStyles';

type Stage = 'predict' | 'explore' | 'conclude';

const baseCopy = {
  zh: {
    prompt: '先预测，再自由探索，最后自己下结论。每一步都可以来回调整。',
    params: '参数',
    readout: '读数',
    reset: '重置',
    styleLabel: '电路样式',
    modeSeries: '串联',
    modeParallel: '并联',
    circuitLabel: '电路图',
    switchLabel: '开关',
    switchOn: '闭合',
    switchOff: '断开',
    switchOpenHint: '开关断开，电路中没有电流。合上开关再看读数。',
    currentDirLabel: '电流方向（传统）：正极 → 负极',
    currentDirLabelHouse: '家庭电路为交流电：电流在火线（L）与零线（N）之间往返',
    stagePredict: '预测',
    stageExplore: '探索',
    stageConclude: '结论',
    stageDone: '完成',
    nextStage: '下一步 →',
    redoLabel: '再次实验',
    predictTitle: '预测',
    predictDone: '已记录你的预测',
    predictHint: '猜完，就可以揭示电路',
    revealLabel: '揭示电路 →',
    exploreTitle: '探索',
    exploreEmpty: '还没有观察记录。切换样式、拖动滑块、测量读数，看到有意思的状态时记一条。',
    notePlaceholder: '写一句话：你观察到了什么？',
    recordLabel: '记一条观察',
    clearLabel: '清空记录',
    tryLabel: '试试这个',
    concludeTitle: '结论',
    concludeQuestion: '综合你的探索，这个电路有什么规律？',
    concludeSkipHint: '还没在预测幕猜过——建议先回预测幕完成预测，再做结论会更有意义。',
    concludeHint: '选完所有题，看看结论和你的观察是否一致',
    feedbackText:
      '本模拟用电功率近似表示灯泡亮度。串联电路电流处处相等、电压按电阻分配（R 大分压大）；' +
      '并联电路各支路电压相等（都等于电源电压）、干路电流等于各支路电流之和。' +
      '并联总电阻比任一支路都小，所以相同电源下并联时灯更亮。',
    tipsTitle: '考点速记',
    readoutI0: '干路电流 I',
    readoutU: '电源电压 U',
    meterHint: '拖动电流表(A)到导线上测电流、电压表(V)到元件两端测电压',
    meterAmmeterErr: '电流表不能并联在元件两端——内阻极小会短路！应串在导线上。',
    meterVoltmeterErr: '电压表要并联在元件两端测电压，不能串在导线上。',
  },
  en: {
    prompt: 'Predict, explore freely, then draw your own conclusion. You can move between stages any time.',
    params: 'Parameters',
    readout: 'Readings',
    reset: 'Reset',
    styleLabel: 'Circuit style',
    modeSeries: 'Series',
    modeParallel: 'Parallel',
    circuitLabel: 'Circuit',
    switchLabel: 'Switch',
    switchOn: 'Closed',
    switchOff: 'Open',
    switchOpenHint: 'The switch is open — no current flows. Close it to read the meters.',
    currentDirLabel: 'Current direction (conventional): + → −',
    currentDirLabelHouse: 'Household circuits use AC: current alternates between live (L) and neutral (N)',
    stagePredict: 'Predict',
    stageExplore: 'Explore',
    stageConclude: 'Conclude',
    stageDone: 'Done',
    nextStage: 'Next →',
    redoLabel: 'Redo',
    predictTitle: 'Predict',
    predictDone: 'Prediction recorded',
    predictHint: 'After guessing, reveal the circuit',
    revealLabel: 'Reveal circuit →',
    exploreTitle: 'Explore',
    exploreEmpty: 'No observations yet. Switch styles, drag sliders, take readings — record what you find.',
    notePlaceholder: 'One sentence: what did you observe?',
    recordLabel: 'Record observation',
    clearLabel: 'Clear',
    tryLabel: 'Try this',
    concludeTitle: 'Conclude',
    concludeQuestion: 'Based on your exploration, what pattern does this circuit follow?',
    concludeSkipHint: 'You haven\'t predicted yet — go back to the predict stage first for a more meaningful conclusion.',
    concludeHint: 'Answer all questions, then check against your observations',
    feedbackText:
      'In this simulation, electrical power is used as an approximation for bulb brightness. In series, current is the same everywhere and voltage divides by resistance; ' +
      'in parallel, every branch shares the supply voltage and main current is the sum of branches. ' +
      'Total parallel resistance is smaller than any branch, so bulbs are brighter in parallel under the same supply.',
    tipsTitle: 'Key Points',
    readoutI0: 'Main current I',
    readoutU: 'Supply voltage U',
    meterHint: 'Drag ammeter (A) onto a wire for current, voltmeter (V) across a component for voltage',
    meterAmmeterErr: 'An ammeter cannot be connected in parallel across a component — its tiny internal resistance would short-circuit it! It must be in series on a wire.',
    meterVoltmeterErr: 'A voltmeter must be connected in parallel across a component, not in series on a wire.',
  },
};

export default function Circuits() {
  const { lang } = useApp();
  const t = baseCopy[lang];

  const [stage, setStage] = useState<Stage>('predict');
  const [styleId, setStyleId] = useState<CircuitStyleId>('series2');
  const [predIdx, setPredIdx] = useState<number | null>(null);
  const [u, setU] = useState(6);
  const [rValues, setRValues] = useState<number[]>(() => CIRCUIT_STYLES[0].elements.map((e) => e.r));
  const [rp, setRp] = useState(15);
  const [switchOn, setSwitchOn] = useState(true);
  const [branchSw, setBranchSw] = useState<boolean[]>([]);
  const [meterA, setMeterA] = useState<MeterTarget | null>({ id: 'dry-mid', x: 125, y: 60 });
  const [meterV, setMeterV] = useState<MeterTarget | null>({ id: 'battery', x: 72, y: 100 });
  const [meterErr, setMeterErr] = useState<string | null>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [answers, setAnswers] = useState<(number | null)[]>([]);

  const style = CIRCUIT_STYLES.find((s) => s.id === styleId)!;
  const isSeries = style.kind === 'series';
  const isHouse = style.id === 'parallelHouse';
  const topo = useMemo(() => genTopology(style), [styleId]); // eslint-disable-line react-hooks/exhaustive-deps
  // 展开当前语言的样式文案（copy 每字段是 {zh,en} 字典）
  const sc = useMemo(
    () => ({
      title: style.copy.title[lang],
      predict: {
        question: style.copy.predict.question[lang],
        options: style.copy.predict.options.map((o) => o[lang]),
        hint: style.copy.predict.hint[lang],
      },
      cards: style.copy.cards.map((c) => ({ title: c.title[lang], prompt: c.prompt[lang] })),
      conclude: style.copy.conclude.map((q) => ({ question: q.question[lang], options: q.options.map((o) => o[lang]) })),
      tips: style.copy.tips.map((x) => x[lang]),
    }),
    [styleId, lang] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // 恢复样式默认参数（切样式 & 重置共用；不走 switchStyle 守卫）
  const applyDefaults = (cfg: (typeof CIRCUIT_STYLES)[number]) => {
    setRValues(cfg.elements.map((e) => e.r));
    setRp(cfg.rheostatIndex !== undefined ? cfg.elements[cfg.rheostatIndex].r : 15);
    setBranchSw(cfg.elements.map(() => true));
    setSwitchOn(true);
    // 家庭电路为交流 220V，其余样式用 6V 直流
    setU(cfg.id === 'parallelHouse' ? 220 : 6);
    // 固定电表/保险丝样式：A 探针初始放干路左段，避免与符号重叠
    setMeterA({ id: cfg.fuse || cfg.fixedMeters ? 'dry-left' : 'dry-mid', x: cfg.fuse || cfg.fixedMeters ? 50 : 125, y: 60 });
    setMeterV({ id: 'battery', x: 72, y: 100 });
    setMeterErr(null);
  };

  // 切样式：重置该样式的全部交互状态
  const switchStyle = (id: CircuitStyleId) => {
    if (id === styleId) return;
    const cfg = CIRCUIT_STYLES.find((s) => s.id === id)!;
    setStyleId(id);
    applyDefaults(cfg);
    setPredIdx(null);
    setAnswers([]);
    setObservations([]);
  };

  /* ---------- 物理（通用引擎：串联分压 / 并联分流） ---------- */
  const effR = style.elements.map((e, i) => (e.kind === 'rheostat' ? rp : rValues[i]));
  const totalR = effR.reduce((a, b) => a + b, 0);
  const seriesI = isSeries && switchOn && totalR > 0 ? u / totalR : 0;
  const branchI = style.elements.map((_, i) =>
    isSeries ? seriesI : switchOn && (!style.branchSwitches || branchSw[i]) ? u / effR[i] : 0
  );
  const i0 = isSeries ? seriesI : branchI.reduce((a, b) => a + b, 0);
  const vPerElem = style.elements.map((_, i) =>
    isSeries ? seriesI * effR[i] : switchOn && (!style.branchSwitches || branchSw[i]) ? u : 0
  );
  const pPerElem = style.elements.map((_, i) => branchI[i] * branchI[i] * effR[i]);
  // 相对功率亮度：同电路内按最大功率标定（√(P/Pmax)），饱和不丢失排序
  const pMax = pPerElem.length ? Math.max(...pPerElem) : 0;
  const glowOf = (i: number): number => (pMax > 1e-6 ? Math.sqrt(pPerElem[i] / pMax) : 0);

  const reset = () => {
    applyDefaults(style);
  };

  const redoAll = () => {
    setStage('predict');
    setPredIdx(null);
    setAnswers([]);
    setObservations([]);
    reset();
  };

  const reveal = () => {
    setStage('explore');
  };

  const addObservation = (note: string) => {
    setObservations((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        snapshot: [
          { label: '方式', value: isSeries ? t.modeSeries : t.modeParallel },
          { label: 'I₀', value: `${i0.toFixed(2)}A` },
          ...branchI.map((v, i) => ({ label: `I${i + 1}`, value: `${v.toFixed(2)}A` })),
          { label: 'U', value: `${u.toFixed(1)}V` },
        ],
        note,
      },
    ]);
  };

  const cards: ExploreCard[] = sc.cards.map((card, i) => ({
    key: `card-${styleId}-${i}`,
    title: card.title,
    prompt: card.prompt,
    tryLabel: t.tryLabel,
    tryIt: () => {
      setSwitchOn(true);
      if (!isSeries && style.branchSwitches) setBranchSw((prev) => prev.map(() => true));
    },
  }));

  /* ---------- 表盘/读数 ---------- */
  const gaugeValue = (kind: 'current' | 'voltage', target: MeterTarget | null): number | null => {
    if (!target) return null;
    if (kind === 'current') {
      const w = topo.wires.find((x) => x.id === target.id);
      if (!w) return null;
      if (w.current === 'i0') return i0;
      const idx = parseInt(w.current.slice(1), 10) - 1;
      return branchI[idx] ?? null;
    }
    const comp = topo.comps.find((x) => x.id === target.id);
    if (!comp) return null;
    if (comp.voltage === 'u') return u;
    const idx = parseInt(comp.voltage.slice(1), 10) - 1;
    return vPerElem[idx] ?? null;
  };

  const gaugeMax = (kind: 'current' | 'voltage', target: MeterTarget | null): number =>
    kind === 'current' ? ((gaugeValue(kind, target) ?? 0) <= 0.6 ? 0.6 : 3) : isHouse ? 250 : 15;

  const gaugeLabel = (kind: 'current' | 'voltage'): string => {
    const target = kind === 'current' ? meterA : meterV;
    if (!target) return '—';
    if (kind === 'current') {
      const w = topo.wires.find((x) => x.id === target.id);
      if (!w) return '—';
      if (w.current === 'i0') return t.readoutI0;
      const idx = parseInt(w.current.slice(1), 10) - 1;
      const el = style.elements[idx];
      return el ? `${el.label} 中电流 I${idx + 1}` : '—';
    }
    const comp = topo.comps.find((x) => x.id === target.id);
    if (!comp) return '—';
    if (comp.voltage === 'u') return t.readoutU;
    const idx = parseInt(comp.voltage.slice(1), 10) - 1;
    const el = style.elements[idx];
    return el ? `${el.label} 两端电压` : '—';
  };

  const conclusionComplete = answers.length === sc.conclude.length && answers.every((a) => a !== null);
  const predComplete = predIdx !== null;
  const stageOrder: Stage[] = ['predict', 'explore', 'conclude'];
  const stageIdx = stageOrder.indexOf(stage);

  return (
    <div className="flex flex-col space-y-6">

      <div className="flex justify-center py-2">
        <Formula tex="I = \frac{U}{R}" block className="text-lg" />
      </div>

      {/* 幕导航 */}
      <div className="flex items-center gap-2 text-[11px] mono-font uppercase tracking-widest text-[var(--muted)]">
        {stageOrder.map((s, i) => (
          <span key={s} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden="true">/</span>}
            <button
              type="button"
              onClick={() => setStage(s)}
              className={`transition-colors ${stage === s ? 'font-bold text-[var(--fg)]' : 'hover:text-[var(--fg)]'}`}
            >
              {s === 'predict' && t.stagePredict}
              {s === 'explore' && t.stageExplore}
              {s === 'conclude' && t.stageConclude}
            </button>
          </span>
        ))}
        <span className="ml-auto">
          {stageIdx < 2 ? (
            <button
              type="button"
              onClick={() => setStage(stageOrder[stageIdx + 1])}
              className="underline text-[var(--fg)] hover:opacity-70"
            >
              {t.nextStage}
            </button>
          ) : (
            <button
              type="button"
              onClick={redoAll}
              className="underline text-[var(--muted)] hover:text-[var(--fg)]"
            >
              {t.redoLabel} ↻
            </button>
          )}
        </span>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
        {/* 左列：电路图 + 读数 */}
        <div className="flex flex-col space-y-6">
          <div className="border border-[var(--border)] p-4">
            <h3 className="text-[11px] font-bold tracking-widest text-[var(--muted)] mono-font uppercase mb-2">
              // {t.circuitLabel} · {sc.title}
            </h3>
            {/* 表盘：电路图上方（A/V 表显）；家庭电路显示干路电流与 L-N 电压，其余跟随探针吸附测点 */}
            <div className="mb-2 flex items-start justify-center gap-6">
              <MeterGauge
                value={isHouse ? i0 : gaugeValue('current', meterA)}
                max={gaugeMax('current', meterA)}
                unit="A"
                label={isHouse ? t.readoutI0 : gaugeLabel('current')}
              />
              <MeterGauge
                value={isHouse ? u : gaugeValue('voltage', meterV)}
                max={gaugeMax('voltage', meterV)}
                unit="V"
                label={isHouse ? 'L–N' : gaugeLabel('voltage')}
              />
            </div>
            <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full h-auto" role="img" aria-label={t.circuitLabel} strokeLinecap="round" strokeLinejoin="round">
              {style.id === 'parallelHouse' ? (
                /* ── 家庭电路：真实 L/N 双母线结构 ── */
                <HouseholdCircuit
                  on={switchOn}
                  branchOn={branchSw}
                  u={u}
                  effR={effR}
                  glow={style.elements.map((_, i) => glowOf(i))}
                  onToggleMaster={() => setSwitchOn((s) => !s)}
                  onToggleBranch={(i) => setBranchSw((prev) => prev.map((v, j) => (j === i ? !v : v)))}
                />
              ) : (
                <>
              {/* 导线（含电压引线） */}
              <g stroke="var(--fg)" strokeWidth="1.2" fill="none">
                {/* 电池支路竖线：正极段(60→70) 与负极段(82→140)，电池符号填补 70-82 间隙 */}
                <line x1={BATT_X} y1="60" x2={BATT_X} y2="70" />
                <line x1={BATT_X} y1="82" x2={BATT_X} y2="140" />
                {/* 电压表并联引线 */}
                {topo.vLeads.map((l, i) => (
                  <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
                ))}
                {/* 主回路导线 */}
                {topo.wires.map((w) => (
                  <line key={w.id} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} />
                ))}
              </g>

              {/* 保险丝（家庭电路：干路） */}
              {style.fuse && <Fuse x={122} y={60} />}

              {/* 总开关 S */}
              <BladeSwitch
                x1={SW_X1}
                y1={60}
                x2={SW_X2}
                y2={60}
                on={switchOn}
                onToggle={() => setSwitchOn((s) => !s)}
                label="S"
              />

              {/* 电源：直流电池（家庭电路已在独立分支渲染交流电源） */}
              <Battery cx={BATT_X} cy={110} />

              {/* 并联支路开关 S₁/S₂… */}
              {!isSeries &&
                style.branchSwitches &&
                topo.branchYs.map((y, i) => (
                  <g key={`bsw${i}`}>
                    <BladeSwitch
                      x1={155}
                      y1={y}
                      x2={180}
                      y2={y}
                      on={branchSw[i]}
                      onToggle={() => setBranchSw((prev) => prev.map((v, j) => (j === i ? !v : v)))}
                      label={`S${i + 1}`}
                      labelY={y + 16}
                      flipDown={y >= 100}
                    />
                  </g>
                ))}

              {/* 元件：串联链 / 并联支路 */}
              {isSeries
                ? style.elements.map((e, i) => (
                    <g key={`elm${i}`}>
                      {e.kind === 'bulb' ? (
                        <Bulb cx={e.x} cy={60} glow={glowOf(i)} label={`${e.label}=${effR[i]}Ω`} labelY={80} />
                      ) : (
                        <Rheostat x={e.x} y={60} value={rp} max={40} label={`R_p=${rp}Ω`} />
                      )}
                    </g>
                  ))
                : style.elements.map((e, i) => {
                    const y = topo.branchYs[i];
                    // 第三支路（y=160）下方被回流线(y=180)占据：标签放灯上方；其余放下方
                    const labelY = y >= 140 ? y - 20 : y + 22;
                    return (
                      <g key={`elmp${i}`}>
                        <Bulb
                          cx={200}
                          cy={y}
                          glow={glowOf(i)}
                          label={`${e.label}=${effR[i]}Ω`}
                          labelY={labelY}
                        />
                      </g>
                    );
                  })}

              {/* 固定电表（并-3 三电流表：干路 A₀ + 支路 A₁/A₂） */}
              {style.fixedMeters && (
                <>
                  <FixedMeter x={125} y={60} glyph="A" reading={i0.toFixed(2)} unit="A" />
                  <FixedMeter x={250} y={topo.branchYs[0]} glyph="A" reading={branchI[0].toFixed(2)} unit="A" />
                  <FixedMeter x={250} y={topo.branchYs[1]} glyph="A" reading={branchI[1].toFixed(2)} unit="A" />
                </>
              )}

              {/* 可拖动电表探针 */}
              <MeterProbe
                kind="current"
                glyph="A"
                wires={topo.wires}
                comps={topo.comps}
                active={meterA}
                onPlace={(target) => {
                  setMeterA(target);
                  setMeterErr(null);
                }}
                onError={() => {
                  setMeterA(null);
                  setMeterErr(t.meterAmmeterErr);
                }}
                initial={style.fuse || style.fixedMeters ? { x: 50, y: 60 } : { x: 125, y: 60 }}
              />
              <MeterProbe
                kind="voltage"
                glyph="V"
                wires={topo.wires}
                comps={topo.comps}
                active={meterV}
                onPlace={(target) => {
                  setMeterV(target);
                  setMeterErr(null);
                }}
                onError={() => {
                  setMeterV(null);
                  setMeterErr(t.meterVoltmeterErr);
                }}
                initial={{ x: 72, y: 100 }}
              />

              {/* 电流小点：每条路径用自己的电流（串联 i0；并联各支路） */}
              {topo.flowPaths.map((p, pi) => {
                const flowI = isSeries ? seriesI : branchI[pi];
                return (
                  flowI > 0.01 && (
                    <g
                      key={`flow-${styleId}-${pi}-${flowI.toFixed(2)}-${switchOn}-${branchSw.join('')}`}
                      fill="var(--fg)"
                      opacity="0.85"
                    >
                      {[0, 1.1].map((offset) => (
                        <circle key={offset} r="2.4">
                          <animateMotion
                            dur={`${Math.max(0.45, 2.2 / flowI).toFixed(2)}s`}
                            begin={`${offset}s`}
                            repeatCount="indefinite"
                            path={p}
                          />
                        </circle>
                      ))}
                    </g>
                  )
                );
              })}
              </>
              )}
            </svg>
            {!switchOn && <p className="text-xs text-[var(--muted)] serif-font italic mt-2">{t.switchOpenHint}</p>}
            <p className="text-[11px] mono-font text-[var(--muted)] mt-1">{style.id === 'parallelHouse' ? t.currentDirLabelHouse : t.currentDirLabel}</p>
            {/* 拖拽测量提示（家庭电路无探针交互，不显示） */}
            {!isHouse && (
              <p className="mt-1 flex items-center gap-1.5 text-[11px] mono-font text-[var(--muted)]">
                <GrabIcon className="h-3.5 w-3.5 shrink-0" />
                {t.meterHint}
              </p>
            )}
            {meterErr && (
              <p className="text-xs text-[var(--error)] serif-font mt-1" role="alert">
                ⚠ {meterErr}
              </p>
            )}
          </div>

          {/* 读数 */}
          <div className="border border-[var(--border)] p-4">
            <h3 className="text-[11px] font-bold tracking-widest text-[var(--muted)] mono-font uppercase mb-2">
              // {t.readout}
            </h3>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div>
                <p className="text-[11px] text-[var(--muted)] mono-font">{t.readoutI0}</p>
                <p className="text-sm mono-font text-[var(--fg)]">
                  {i0.toFixed(2)}
                  <span className="ml-1 text-[10px] text-[var(--muted)]">A</span>
                </p>
              </div>
              {branchI.map((v, i) => (
                <div key={i}>
                  <p className="text-[11px] text-[var(--muted)] mono-font">
                    {`${style.elements[i]?.label ?? 'R'} 中电流 I${i + 1}`}
                  </p>
                  <p className="text-sm mono-font text-[var(--fg)]">
                    {v.toFixed(2)}
                    <span className="ml-1 text-[10px] text-[var(--muted)]">A</span>
                  </p>
                </div>
              ))}
              {vPerElem.map((v, i) => (
                <div key={`v${i}`}>
                  <p className="text-[11px] text-[var(--muted)] mono-font">
                    {`${style.elements[i]?.label ?? 'R'} 两端电压`}
                  </p>
                  <p className="text-sm mono-font text-[var(--fg)]">
                    {v.toFixed(1)}
                    <span className="ml-1 text-[10px] text-[var(--muted)]">V</span>
                  </p>
                </div>
              ))}
              <div>
                <p className="text-[11px] text-[var(--muted)] mono-font">{t.readoutU}</p>
                <p className="text-sm mono-font text-[var(--fg)]">
                  {u.toFixed(1)}
                  <span className="ml-1 text-[10px] text-[var(--muted)]">V</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 右列：样式 + 参数 + 三幕 */}
        <div className="flex flex-col space-y-6">
          <div className="border border-[var(--border)] p-4 space-y-4">
            <h3 className="text-[11px] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
              // {t.styleLabel}
            </h3>
            <div className="space-y-2">
              <p className="text-[11px] mono-font uppercase tracking-widest text-[var(--muted)]">{t.modeSeries}</p>
              <div className="flex flex-wrap gap-1.5">
                {CIRCUIT_STYLES.filter((s) => s.kind === 'series').map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => switchStyle(s.id)}
                    className={`text-xs mono-font px-2 py-1 border transition-colors ${
                      styleId === s.id
                        ? 'border-[var(--fg)] text-[var(--fg)]'
                        : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                    }`}
                  >
                    {s.copy.title[lang]}
                  </button>
                ))}
              </div>
              <p className="text-[11px] mono-font uppercase tracking-widest text-[var(--muted)] pt-1">{t.modeParallel}</p>
              <div className="flex flex-wrap gap-1.5">
                {CIRCUIT_STYLES.filter((s) => s.kind === 'parallel').map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => switchStyle(s.id)}
                    className={`text-xs mono-font px-2 py-1 border transition-colors ${
                      styleId === s.id
                        ? 'border-[var(--fg)] text-[var(--fg)]'
                        : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                    }`}
                  >
                    {s.copy.title[lang]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="border border-[var(--border)] p-4 space-y-4">
            <h3 className="text-[11px] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
              // {t.params}
            </h3>
            <ParamSlider
              label={isHouse ? 'U (L-N)' : 'U'}
              value={u}
              min={isHouse ? 0 : 0}
              max={isHouse ? 250 : 12}
              step={isHouse ? 10 : 0.5}
              onChange={setU}
              format={(v) => `${v.toFixed(0)}V`}
            />
            {!isHouse &&
              style.elements.map((e, i) =>
                e.kind === 'rheostat' ? (
                  <div key={`sl${i}`}>
                    <ParamSlider label="R_p" value={rp} min={0} max={40} step={1} onChange={setRp} format={(v) => `${v.toFixed(0)}Ω`} />
                  </div>
                ) : (
                  <div key={`sl${i}`}>
                    <ParamSlider
                      label={e.label}
                      value={rValues[i]}
                      min={5}
                      max={50}
                      step={5}
                      onChange={(v) => setRValues((prev) => prev.map((old, j) => (j === i ? v : old)))}
                      format={(v) => `${v.toFixed(0)}Ω`}
                    />
                  </div>
                )
              )}
            <button
              type="button"
              onClick={reset}
              className="text-xs mono-font uppercase underline text-[var(--muted)] hover:text-[var(--fg)]"
            >
              {t.reset}
            </button>
          </div>

          {/* 幕1 预测 */}
          {stage === 'predict' && (
            <div className="border border-[var(--border)] p-4 space-y-4">
              <h3 className="text-[11px] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
                // {t.predictTitle} · {sc.title}
              </h3>
              <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">{sc.predict.question}</p>
              <div className="space-y-2">
                <div className="grid grid-cols-1 gap-2">
                  {sc.predict.options.map((opt, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPredIdx(i)}
                      className={`text-left text-xs px-2 py-1.5 border transition-colors ${
                        predIdx === i ? 'border-[var(--fg)] text-[var(--fg)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
              {predComplete ? (
                <button
                  type="button"
                  onClick={reveal}
                  className="text-xs mono-font px-3 py-1.5 border border-[var(--fg)] text-[var(--fg)] hover:bg-[var(--accent-light)] transition-colors"
                >
                  ✓ {t.predictDone} — {t.revealLabel}
                </button>
              ) : (
                <p className="text-xs text-[var(--muted)] serif-font italic">{t.predictHint}</p>
              )}
            </div>
          )}

          {/* 幕2 探索 */}
          {stage === 'explore' && (
            <ExploreStage
              cards={cards}
              observations={observations}
              onAddObservation={addObservation}
              onClearObservations={() => setObservations([])}
              notePlaceholder={t.notePlaceholder}
              recordLabel={t.recordLabel}
              clearLabel={t.clearLabel}
              emptyLabel={t.exploreEmpty}
              title={t.exploreTitle}
            />
          )}

          {/* 幕3 结论 */}
          {stage === 'conclude' && (
            <div className="border border-[var(--border)] p-4 space-y-4">
              <h3 className="text-[11px] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
                // {t.concludeTitle}
              </h3>
              <p className="text-sm serif-font leading-relaxed text-[var(--fg)]">{t.concludeQuestion}</p>
              {!predComplete && (
                <p className="text-xs text-[var(--muted)] serif-font italic border-l-2 border-[var(--border)] pl-2">
                  {t.concludeSkipHint}
                </p>
              )}
              {sc.conclude.map((q, qi) => (
                <div key={qi} className="space-y-2">
                  <p className="text-xs font-bold text-[var(--fg)] mono-font">{q.question}</p>
                  <div className="grid grid-cols-1 gap-2">
                    {q.options.map((opt, oi) => {
                      const selected = answers[qi] === oi;
                      const correct = q.correctIndex === oi;
                      const showFeedback = answers[qi] !== undefined && answers[qi] !== null;
                      return (
                        <button
                          key={oi}
                          type="button"
                          onClick={() => setAnswers((prev) => {
                            const next = [...prev];
                            next[qi] = oi;
                            return next;
                          })}
                          className={`text-left text-xs px-2 py-1.5 border transition-colors ${
                            selected
                              ? correct
                                ? 'border-[var(--fg)] text-[var(--fg)]'
                                : 'border-[var(--error)] text-[var(--error)]'
                              : showFeedback && correct
                                ? 'border-[var(--muted)] text-[var(--muted)]'
                                : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                          }`}
                        >
                          {selected && (correct ? '✓ ' : '✗ ')}
                          {showFeedback && !selected && correct && '✓ '}
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {conclusionComplete ? (
                <p className="text-xs mono-font text-[var(--fg)]">✓ {t.concludeHint}</p>
              ) : (
                <p className="text-xs text-[var(--muted)] serif-font italic">{t.concludeHint}</p>
              )}
            </div>
          )}

          {/* 完成态 */}
          {stage === 'conclude' && conclusionComplete && (
            <div className="border border-[var(--fg)] p-4 space-y-2">
              <p className="text-sm font-bold mono-font text-[var(--fg)]">✓ {t.stageDone}</p>
              <p className="text-xs text-[var(--muted)] serif-font leading-relaxed">{t.feedbackText}</p>
              <button
                type="button"
                onClick={redoAll}
                className="text-xs mono-font uppercase underline text-[var(--fg)] hover:opacity-70"
              >
                {t.redoLabel} ↻
              </button>
            </div>
          )}

          {/* 考点速记 */}
          {stage === 'conclude' && conclusionComplete && (
            <div className="border border-[var(--border)] p-4 space-y-2">
              <h3 className="text-[11px] font-bold tracking-widest text-[var(--muted)] mono-font uppercase">
                // {t.tipsTitle}
              </h3>
              <ul className="space-y-1.5">
                {sc.tips.map((tip, i) => (
                  <li key={i} className="text-xs text-[var(--fg)] serif-font leading-relaxed flex gap-2">
                    <span className="text-[var(--muted)] mono-font shrink-0">{i + 1}.</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学实验台 · 数据记录面板（画布下方两栏卡片）
 *
 * 左栏：X/Y 探针选择（应用内下拉，见 BenchSelect.tsx）→ 记录当前读数 → CSV / 清空 → 数据表。
 * 右栏：散点图 + 最小二乘拟合线，宽度不小于 280px。
 * 整块可折叠（顶栏「数据记录」按钮控制），折叠后只留一条标题行。
 * 不做自动采样，避免 M1 把「学生读数」变成后台黑箱。
 *
 * `floating`（全屏）：整块从页面流里挪到底部浮层，收起时是一枚胶囊，
 * 展开时是磨砂抽屉，让画布在全屏下能拿到 100% 的纵向空间。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

import { useApp } from '../../../lib/app-context';
import BenchSelect from '../../../components/ui/BenchSelect';
import { downloadText, fitLinear, reconcileProbeKey, toCsv, type FitPoint } from './circuit-bench-fit';
import { fmt } from './circuit-bench-core';
import type { BenchState, SolveResult } from './circuit-bench-core';
import type { CircuitPreset } from './circuit-bench-presets';
import { buildOptions, goldenAxes, meterOptions, readProbe, type ProbeOption } from './circuit-bench-probes';
import { chartGeometry } from './workbench-layout';

/** 两栏卡片里图表固定高度；宽度由 ResizeObserver 实测，保证字号不被拉伸。 */
const CHART_H = 232;

interface Row {
  id: number;
  time: number;
  x: number;
  y: number;
}

export interface MeasurementPanelProps {
  state: BenchState;
  result: SolveResult | null;
  preset: CircuitPreset | null;
  /** 加载预设 / 清空工作台时递增，强制清空已记录数据。 */
  resetToken?: number;
  /** 折叠状态由顶栏的「数据记录」按钮统一控制。 */
  open?: boolean;
  onToggle?: () => void;
  /**
   * 全屏浮层形态：收起时收成一枚胶囊，展开时是磨砂抽屉贴在画布底边。
   * 外层容器是 pointer-events-none，所以面板自己要把指针事件收回来。
   */
  floating?: boolean;
  /**
   * 悬停某个探针选项时把它的元件 id 报给上层做画布轮廓微光（离开报 null）。
   * 多表同屏时，光看下拉里的「电压表 V₁」不知道指的是画布上哪一只。
   */
  onProbeHover?: (elementId: string | null) => void;
}

export default function MeasurementPanel({
  state,
  result,
  preset,
  resetToken = 0,
  open = true,
  onToggle,
  floating = false,
  onProbeHover,
}: MeasurementPanelProps) {
  const { lang } = useApp();
  const zh = lang === 'zh';
  const options = useMemo(() => buildOptions(state, zh ? 'zh' : 'en'), [state, zh]);

  // 画布上到底有没有测量电表：没有电表时给一条「现在记的是元件计算值」的说明，
  // 一条探针都没有时才转成空态（见下面 noOptions / noMeter 的分工）。
  const meters = useMemo(() => meterOptions(options), [options]);
  const hasMeter = meters.length > 0;
  /** 真·空台：画布上一个可记录的量都没有（拖进来之前、或全删光之后）。 */
  const noOptions = options.length === 0;

  // 载入预设时横纵轴的落点：先按「物理角色」找课标要的那对表（欧姆定律 → V/I，
  // 电桥 → 检流计），角色找不到才用预设作者写的 probes，最后才退到列表前两项。
  // 探针已不在画布上（学生删掉了元件）时同样逐级往下走，轴不会停在幽灵探针上。
  const [defaultX, defaultY] = useMemo(
    () => goldenAxes(preset?.id, preset?.probes, options),
    [preset, options],
  );
  const [xKey, setXKey] = useState(defaultX);
  const [yKey, setYKey] = useState(defaultY);
  const [throughOrigin, setThroughOrigin] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    setXKey(defaultX);
    setYKey(defaultY);
    setRows([]);
    setError('');
    // 只在预设切换/清空时重置；options 随参数改变不应清空已记录的实验数据。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset?.id, resetToken]);

  // 元件被移除后 xKey/yKey 会指向画布上已经不存在的探针：拉回仍然可用的探针。
  // 改前实测：删掉电流表后下拉仍列着 `a1 I (A)`，「记录当前读数」只报「读数无效」，
  // 一行也记不下——学生看到的选项与实际能记录的量不一致。
  useEffect(() => {
    setXKey((k) => reconcileProbeKey(k, options, 0));
    setYKey((k) => reconcileProbeKey(k, options, 1));
  }, [options]);

  const xProbe = options.find((o) => o.key === xKey) ?? options[0];
  const yProbe = options.find((o) => o.key === yKey) ?? options[1] ?? options[0];
  // 下拉框绑定的是「解析后仍在的键」：上面那个 effect 落地前一帧也不会闪成空白。
  const xKeyShown = xProbe?.key ?? '';
  const yKeyShown = yProbe?.key ?? '';

  // 下拉悬停 → 画布微光。「选项值 → 元件 id」的换算只留在这一处，
  // 下拉组件本身不需要知道「探针」是什么概念。
  const hoverProbe = (key: string | null) => {
    onProbeHover?.(key ? (options.find((o) => o.key === key)?.elementId ?? null) : null);
  };
  // 面板被卸载（切实验室、退出全屏换子树）时撤掉画布上残留的那圈微光，
  // 否则元件会一直亮着，像是还停在下拉里选它。
  useEffect(() => () => onProbeHover?.(null), [onProbeHover]);

  const record = () => {
    if (!xProbe || !yProbe) {
      setError(zh ? '没有可记录的探针' : 'No probe available');
      return;
    }
    const x = readProbe(state, result, xProbe);
    const y = readProbe(state, result, yProbe);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      setError(zh ? '当前读数无效，检查电路是否接通' : 'Reading is invalid; check the circuit');
      return;
    }
    setError('');
    setRows((prev) => [...prev, { id: Date.now() + prev.length, time: Date.now(), x, y }]);
  };

  // 记录区中部的空态文案，两级：画布上一条可记录的量都没有（还没拖元件 / 全删光了）
  // 才请学生去元件库；只是还没记录就照旧提示怎么记。
  const emptyCopy = noOptions
    ? zh
      ? '请从左侧元件库拖入电流表或电压表连接后记录数据。'
      : 'Drag a voltmeter or ammeter from the parts bin and wire it up to record data.'
    : zh
      ? '还没有记录，调整电路后点「记录当前读数」。'
      : 'No readings yet — record once the circuit is set.';

  const points: FitPoint[] = rows.map((r) => ({ x: r.x, y: r.y }));
  const fit = fitLinear(points, { throughOrigin });

  // 图表按真实像素绘制（而不是缩放固定 viewBox），字号与网格线才不会被拉伸。
  const chartRef = useRef<HTMLDivElement | null>(null);
  const [chartW, setChartW] = useState(320);
  useEffect(() => {
    const el = chartRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setChartW(w);
    });
    ro.observe(el);
    setChartW(el.getBoundingClientRect().width || 320);
    return () => ro.disconnect();
  }, []);
  const chart = useMemo(
    () => chartGeometry(points, fit.slope, fit.intercept, Boolean(fit.ok), { w: chartW, h: CHART_H }),
    [points, fit, chartW],
  );

  const exportCsv = () => {
    if (!rows.length || !xProbe || !yProbe) return;
    // 列名直接用探针的 label——它已经带上了单位（「灯泡 L₁ · 电压 U (V)」），
    // 再拼一次 `(${unit})` 就会变成 `(V) (V)`。
    const csv = toCsv(
      [zh ? '序号' : 'n', zh ? '时间' : 'time', xProbe.label, yProbe.label],
      rows.map((r, i) => [i + 1, new Date(r.time).toISOString(), r.x, r.y]),
    );
    downloadText(`circuit-bench-${preset?.id ?? 'free'}-${Date.now()}.csv`, csv);
  };

  return (
    <div
      // 短视口（横屏手机）由 `index.css` 的 `(max-height: 520px) and (min-width: 640px)`
      // 一档挪成贴底浮层：那边只能用属性选择器命中，`max-sm:` 管不到 844 宽。
      // `data-open` 区分「展开抽屉 / 收起胶囊」两种姿态，与 `max-sm:` 那套一一对应。
      data-measure-card=""
      data-open={open ? '' : undefined}
      className={
        floating
          ? open
            ? 'pointer-events-auto max-h-full w-full max-w-3xl overflow-auto rounded-xl border border-[var(--border)] bg-[var(--card-bg)]/95 shadow-lg backdrop-blur-md'
            : 'pointer-events-auto rounded-full border border-[var(--border)] bg-[var(--card-bg)]/95 shadow-lg backdrop-blur-md'
          : `rounded-xl border border-[var(--border)] bg-[var(--card-bg)] ${
              open
                ? // 窄屏：数据记录不再占页面流的高度，改成贴底抽屉（与全屏那套同一个姿态）。
                  // 45dvh 是上限而不是定高，两三行记录时它自己缩回去，画布留得更多。
                  'max-sm:fixed max-sm:inset-x-2 max-sm:bottom-2 max-sm:z-40 max-sm:max-h-[45dvh] max-sm:overflow-auto'
                : 'max-sm:fixed max-sm:left-2 max-sm:bottom-2 max-sm:z-40 max-sm:w-auto max-sm:rounded-full'
            }`
      }
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-2 text-left ${
          floating && !open ? 'rounded-full px-3 py-1' : 'px-3 py-1.5'
        }`}
      >
        <span className="flex items-baseline gap-2">
          <span className="text-xs font-semibold text-[var(--fg)]">{zh ? '数据记录' : 'Measurements'}</span>
          <span className="text-[10px] text-[var(--muted)]">
            {rows.length} {zh ? '组' : 'rows'}
          </span>
        </span>
        <span className="flex items-center gap-1 text-[10px] text-[var(--muted)]">
          {open ? (zh ? '收起' : 'Collapse') : zh ? '展开' : 'Expand'}
          {open ? <ChevronUp className="h-3.5 w-3.5 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0" />}
        </span>
      </button>

      {open && (
        <div className="grid grid-cols-1 gap-3 border-t border-[var(--border)] p-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.9fr)]">
          {/* 左栏：探针、动作、数据表 */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {/* `label` 必须留在 `<ProbeSelect` 同一行：单测按
                  `/<ProbeSelect label=\{zh \? '横轴'/` 定位这两个轴选择器，
                  换行会被判成「选择器被改没了」。 */}
              <ProbeSelect label={zh ? '横轴' : 'X'}
                value={xKeyShown}
                options={options}
                onChange={setXKey}
                onHoverOption={hoverProbe}
              />
              <ProbeSelect label={zh ? '纵轴' : 'Y'}
                value={yKeyShown}
                options={options}
                onChange={setYKey}
                onHoverOption={hoverProbe}
              />
              <button
                type="button"
                onClick={record}
                // 画布上一个可记录的量都没有时置灰：这时候点下去只会得到一句报错。
                disabled={noOptions}
                className="compact tap32 h-8 shrink-0 rounded-lg bg-[var(--fg)] px-4 text-xs font-medium text-[var(--bg)] transition-opacity hover:opacity-90 disabled:opacity-45 disabled:hover:opacity-45"
              >
                {zh ? '记录当前读数' : 'Record'}
              </button>
              <button
                type="button"
                onClick={exportCsv}
                disabled={!rows.length}
                className="compact tap32 h-8 shrink-0 rounded-lg border border-[var(--border)] px-2.5 text-xs text-[var(--fg)] transition-colors hover:border-[var(--accent)] disabled:opacity-45"
              >
                CSV
              </button>
              <button
                type="button"
                onClick={() => setRows([])}
                disabled={!rows.length}
                className="compact tap32 h-8 shrink-0 rounded-lg border border-[var(--border)] px-2.5 text-xs text-[var(--fg)] transition-colors hover:border-[var(--danger)] disabled:opacity-45"
              >
                {zh ? '清空' : 'Clear'}
              </button>
            </div>

            {error && <div className="mt-1.5 text-[10px] text-[var(--danger)]">{error}</div>}
            {/* 画布上没有电表、但仍有一条可记录的量（「短路与保险丝」预设就是这种：
                只有电源、开关、灯泡与保险丝，学生记的正是灯泡的 U/I）——
                这时候不能按「空台」处理，否则等于把这台现成的实验关掉。
                只给一句软提示说明读的是元件计算值，按钮照常可用。 */}
            {!hasMeter && !noOptions && (
              <div className="mt-1.5 text-[10px] text-[var(--muted)]">
                {zh
                  ? '未接入测量电表 · 当前记录的是元件计算值'
                  : 'No meter connected — recording computed element values'}
              </div>
            )}

            <div className="mt-2 max-h-36 overflow-auto rounded-lg border border-[var(--border)]">
              {rows.length ? (
                <table className="w-full border-collapse text-[10px]">
                  <thead className="sticky top-0 bg-[var(--accent-light)] text-[var(--muted)]">
                    <tr>
                      <th className="px-2 py-1 text-left">#</th>
                      {/* 表头用紧凑档（`灯泡 L₁ · U (V)`）：列很窄，带单位的短名既不截断也读得全。 */}
                      <th className="px-2 py-1 text-right">{xProbe?.short}</th>
                      <th className="px-2 py-1 text-right">{yProbe?.short}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.id} className="border-t border-[var(--border)]">
                        <td className="px-2 py-1 text-[var(--muted)]">{i + 1}</td>
                        <td className="px-2 py-1 text-right mono-font text-[var(--fg)]">{fmt(r.x, 4)}</td>
                        <td className="px-2 py-1 text-right mono-font text-[var(--fg)]">{fmt(r.y, 4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="px-2 py-4 text-center text-[10px] text-[var(--muted)]">{emptyCopy}</div>
              )}
            </div>

            <div className="mt-1.5 flex items-center justify-between text-[10px] text-[var(--muted)]">
              <label className="flex min-h-9 items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={throughOrigin}
                  onChange={(e) => setThroughOrigin(e.target.checked)}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                {zh ? '过原点拟合' : 'Through origin'}
              </label>
              <span className="mono-font text-[var(--fg)]">
                {fit.ok ? `y = ${fmt(fit.slope, 3)}x + ${fmt(fit.intercept, 3)} · R²=${fmt(fit.r2, 4)}` : '—'}
              </span>
            </div>
          </div>

          {/* 右栏：散点 + 拟合线，最小 280px */}
          <div className="min-w-0">
            <div
              ref={chartRef}
              className="min-w-[280px] rounded-lg border border-[var(--border)] bg-[var(--bg)] p-1"
              style={{ height: CHART_H + 8 }}
            >
              <svg
                width={chartW}
                height={CHART_H}
                viewBox={`0 0 ${chartW} ${CHART_H}`}
                className="block"
                role="img"
                aria-label={zh ? '读数散点与拟合线' : 'Scatter plot with fitted line'}
              >
                <line x1={chart.plot.left} y1={chart.plot.bottom} x2={chart.plot.right} y2={chart.plot.bottom} stroke="var(--border)" strokeWidth={1} />
                <line x1={chart.plot.left} y1={chart.plot.top} x2={chart.plot.left} y2={chart.plot.bottom} stroke="var(--border)" strokeWidth={1} />
                {[0.25, 0.5, 0.75, 1].map((f) => {
                  const gw = chart.plot.right - chart.plot.left;
                  const gh = chart.plot.bottom - chart.plot.top;
                  return (
                    <g key={f}>
                      <line
                        x1={chart.plot.left}
                        y1={chart.plot.bottom - gh * f}
                        x2={chart.plot.right}
                        y2={chart.plot.bottom - gh * f}
                        stroke="var(--border)"
                        strokeDasharray="2 3"
                        opacity={0.5}
                      />
                      <line
                        x1={chart.plot.left + gw * f}
                        y1={chart.plot.top}
                        x2={chart.plot.left + gw * f}
                        y2={chart.plot.bottom}
                        stroke="var(--border)"
                        strokeDasharray="2 3"
                        opacity={0.5}
                      />
                    </g>
                  );
                })}
                {chart.line && (
                  <line
                    x1={chart.line.x1}
                    y1={chart.line.y1}
                    x2={chart.line.x2}
                    y2={chart.line.y2}
                    stroke="var(--accent)"
                    strokeWidth={1.4}
                  />
                )}
                {chart.points.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={2.6} fill="var(--accent)" opacity={0.9} />
                ))}
                <text x={chart.plot.left - 4} y={chart.plot.top + 3} textAnchor="end" fontSize={9} fill="var(--muted)" fontFamily="var(--f-mono)">
                  {yProbe?.unit ?? ''}
                </text>
                <text x={chart.plot.right} y={chart.plot.bottom + 13} textAnchor="end" fontSize={9} fill="var(--muted)" fontFamily="var(--f-mono)">
                  {xProbe?.unit ?? ''}
                </text>
                {!rows.length && (
                  <text
                    x={(chart.plot.left + chart.plot.right) / 2}
                    y={(chart.plot.top + chart.plot.bottom) / 2}
                    textAnchor="middle"
                    fontSize={10}
                    fill="var(--muted)"
                  >
                    {zh ? '记录至少一组读数' : 'Record at least one point'}
                  </text>
                )}
              </svg>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProbeSelect({
  label,
  value,
  options,
  onChange,
  onHoverOption,
}: {
  label: string;
  value: string;
  options: ProbeOption[];
  onChange: (v: string) => void;
  /** 悬停选项 → 画布高亮：交给 BenchSelect 转发（见它抬头里的「离开即清空」契约）。 */
  onHoverOption?: (key: string | null) => void;
}) {
  // 探针选择原先用浏览器原生 <select>：系统弹层带不进全站令牌（深色主题下弹出白底列表）、
  // 系统行高在希沃红外屏上点不准、触屏上还会把列表摆到屏幕中央盖住学生正看的散点图。
  // 改走应用内下拉后，选项文案也跟着重排成两列：左列元件名、右列「物理量 符号 (单位)」——
  // 原先三者挤成一串（`A I (A)`、`l1 I (A)`），无衬线字体下小写 `l` 与电流符号 `I` 根本分不开。
  //
  // 右列再挂一截当前挡位（`电压 U (V) · 3 V 挡`）：量程变了读数含义就变了，
  // 多表同屏时「电压表 V₁ 打在 3 V 挡、V₂ 打在 15 V 挡」必须在下拉里一眼分得开。
  // 挡位只进这一列，不进 `label` / `short`——那两处有「元件名 · 物理量 符号 (单位)」
  // 的形状契约（见 circuit-bench.test.ts 的三段式断言），多挂一截会把契约撑破。
  const { lang } = useApp();
  const zh = lang === 'zh';
  const items = options.map((o) => ({
    value: o.key,
    label: o.name,
    hint: `${o.quantityName} (${o.unit})${o.gear ? (zh ? ` · ${o.gear} 挡` : ` · ${o.gear} range`) : ''}`,
    short: o.short,
  }));
  return (
    <BenchSelect
      label={label}
      ariaLabel={label}
      value={value}
      options={items}
      onChange={onChange}
      onOptionHover={onHoverOption}
      // 画布上一条可记录的量都没有时（拖进来之前、或全删光之后）触发器自己的空态文案。
      placeholder={zh ? '暂无可用电表' : 'No meter'}
      // 触发器只放得下一行，悬停时给完整文案（含物理量全称）兜底。
      title={options.find((o) => o.key === value)?.label}
      // 触发器比原先宽：`变阻器 Rp · R (Ω)` 这类文案在 150px 里会被截成
      // 「变阻器 Rp · R (…」，学生看不到读的是哪个量。
      className="max-w-[196px]"
    />
  );
}

/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学工作台 · 悬浮检查器
 *
 * 不再占用常驻边栏：选中元件/导线时，画布**左侧**（`left-4 top-14`，元件坞胶囊之下）
 * 浮出一块圆角半透明毛玻璃卡片，顶部一行是三个动作 —— 旋转 90°、调换极性、移除；
 * 下面是读数与参数滑杆。未选中任何对象时，仅在存在全局告警时显示一条提示。
 *
 * 左控右看：左半边画布只谈「怎么调」（元件坞 / 这块检查器），右上角那块 HUD 只谈
 * 「现在怎么了」。两者由 workbench 保证同一时刻各占一边、左边只站一块面板。
 */
import { ArrowLeftRight, RotateCcw, RotateCw, Trash2, X } from 'lucide-react';

import { useApp } from '../../../lib/app-context';
import ParamSlider from '../../../components/lab/ParamSlider';
import BenchSelect from './BenchSelect';
import {
  removeComponent,
  removeWire,
  rotateComponent,
  swapPolarity,
  toggleSwitch,
  updateParams,
} from './circuit-bench-state';
import { ELEMENT_MODELS, MATERIAL_RHO, materialOf } from './circuit-bench-models';
import {
  fmt,
  fmtNumber,
  formatPhysicalValue,
  meterGearLabel,
  meterGears,
  resetElementState,
  snapMeterRange,
  type BenchState,
  type CircuitComponent,
  type ParamBag,
  type SolveResult,
} from './circuit-bench-core';
import { KIND_LABEL, elementName } from './circuit-bench-naming';
import { readingReversed, signedCurrent } from './circuit-bench-labels';

export interface InspectorPanelProps {
  state: BenchState;
  result: SolveResult | null;
  selectedId: string | null;
  selectedWireId?: string | null;
  onChange: (next: BenchState) => void;
  onSelect: (id: string | null) => void;
  onRemoveWire?: (id: string) => void;
  /**
   * 换掉某只熔毁/待换元件（灯泡、保险丝）。
   *
   * 给这条路径单独的 prop，而不是就地 `onChange(resetElementState(...))`：更换元件
   * 之前可能要先按实验规范断电（见 `RepairConfirm`），那套门禁在上层。检查器自己
   * 直接改状态就会绕过它——同一个「更换灯泡」，从看板点要断电、从检查器点就不用了，
   * 学生学到的只会是「规矩看运气」。不传时退回就地复位，保持面板可独立复用。
   */
  onRepair?: (id: string) => void;
  /** 收起这块面板。单击元件不再自动打开它，所以必须给一条明确的退出路径。 */
  onClose?: () => void;
}

/** 有极性接线的元件：调换极性对其才有物理意义。 */
const POLAR_KINDS = new Set(['battery', 'ammeter', 'voltmeter', 'galvanometer']);

/** 面板右上角的收起按钮：28px 方形，触控屏上手指也点得中。 */
function CloseButton({ zh, onClose }: { zh: boolean; onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      title={zh ? '收起参数面板' : 'Close parameters'}
      aria-label={zh ? '收起参数面板' : 'Close parameters'}
      className="compact tap-area relative z-40 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--border)] text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--fg)]"
    >
      <X className="h-3.5 w-3.5 shrink-0" />
    </button>
  );
}

export default function InspectorPanel({
  state,
  result,
  selectedId,
  selectedWireId = null,
  onChange,
  onSelect,
  onRemoveWire,
  onRepair,
  onClose,
}: InspectorPanelProps) {
  const { lang } = useApp();
  const zh = lang === 'zh';
  const el = selectedId ? state.components.find((c) => c.id === selectedId) ?? null : null;
  const wire = selectedWireId ? state.wires.find((w) => w.id === selectedWireId) ?? null : null;

  const warnings = result?.warnings ?? [];
  const elementWarnings = el
    ? warnings.filter((w) => w.elementIds?.includes(el.id))
    : warnings.filter((w) => !w.elementIds || w.elementIds.length === 0);
  // 选中某个元件后，「全局告警」（短路、保险丝过载、电源缺失…）不该被吞掉——
  // 它们描述的是整条电路，与当前选中项是谁无关，必须一直看得见。
  const globalWarnings = warnings.filter((w) => !w.elementIds || w.elementIds.length === 0);

  if (wire) {
    // 端点名与画布、下拉同源：`灯泡 L₁.b`。只有导线真指向一个不存在的元件时
    // 才退回裸 id（那时候也没有更好的名字可给）。
    const endpoint = (ref: string) => {
      const [id, t] = ref.split(':');
      const owner = state.components.find((c) => c.id === id);
      return `${owner ? elementName(state, owner, lang) : id}.${t}`;
    };
    return (
      <div className="pointer-events-auto w-[256px] rounded-2xl border border-[var(--accent)]/40 bg-[var(--card-bg)]/85 p-2 shadow-xl backdrop-blur-md max-sm:w-full">
        <div className="flex items-center justify-between gap-1">
          <span className="text-[11px] font-semibold text-[var(--fg)]">{zh ? '导线' : 'Wire'}</span>
          <span className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => {
                (onRemoveWire ?? (() => {}))(wire.id);
                onSelect(null);
              }}
              className="compact tap32 flex h-7 items-center gap-1 rounded-md border border-[var(--danger)]/50 px-2 text-xs text-[var(--danger)] hover:bg-[var(--danger)]/10"
            >
              <Trash2 className="h-3 w-3 shrink-0" />
              {zh ? '移除导线' : 'Remove wire'}
            </button>
            {onClose && <CloseButton zh={zh} onClose={onClose} />}
          </span>
        </div>
        <p className="mt-1 font-mono text-[10px] text-[var(--muted)]">
          {endpoint(wire.from)} → {endpoint(wire.to)}
        </p>
      </div>
    );
  }

  if (!el) {
    if (!warnings.length) return null;
    return (
      <div className="pointer-events-auto w-[256px] rounded-2xl border border-[var(--border)] bg-[var(--card-bg)]/85 p-2 shadow-lg backdrop-blur-md max-sm:w-full">
        <WarningList warnings={warnings} zh={zh} />
      </div>
    );
  }

  return (
    <div className="pointer-events-auto flex max-h-full w-[256px] flex-col overflow-y-auto rounded-2xl border border-[var(--accent)]/40 bg-[var(--card-bg)]/85 p-2 shadow-xl backdrop-blur-md max-sm:w-full">
      <div className="mb-1.5 flex items-center justify-between gap-1">
        <span className="truncate text-[11px] font-semibold text-[var(--fg)]">
          {elementName(state, el, zh ? 'zh' : 'en')}
        </span>
        <span className="shrink-0 font-mono text-[9px] text-[var(--muted)]">
          {KIND_LABEL[el.kind][zh ? 'zh' : 'en']} · {el.rotation}°
        </span>
        {onClose && <CloseButton zh={zh} onClose={onClose} />}
      </div>

      <div className="mb-1.5 flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(rotateComponent(state, el.id))}
          title={zh ? '旋转 90°' : 'Rotate 90°'}
          className="compact tap32 flex h-7 flex-1 items-center justify-center gap-1 rounded-md border border-[var(--border)] px-2 text-xs text-[var(--fg)] transition-colors hover:border-[var(--accent)]"
        >
          <RotateCw className="h-3.5 w-3.5 shrink-0" />
          {zh ? '旋转 90°' : 'Rotate 90°'}
        </button>
        {POLAR_KINDS.has(el.kind) && (
          <button
            type="button"
            onClick={() => onChange(swapPolarity(state, el.id))}
            title={zh ? '调换极性' : 'Swap polarity'}
            className="compact tap32 flex h-7 flex-1 items-center justify-center gap-1 rounded-md border border-[var(--border)] px-2 text-xs text-[var(--fg)] transition-colors hover:border-[var(--accent)]"
          >
            <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" />
            {zh ? '调换极性' : 'Polarity'}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            onChange(removeComponent(state, el.id));
            onSelect(null);
          }}
          title={zh ? '移除' : 'Remove'}
          aria-label={zh ? '移除' : 'Remove'}
          className="compact tap32 flex h-7 items-center justify-center rounded-md border border-[var(--danger)]/50 px-2 text-[var(--danger)] transition-colors hover:bg-[var(--danger)]/10"
        >
          <Trash2 className="h-3.5 w-3.5 shrink-0" />
        </button>
      </div>

      <Readout el={el} result={result} zh={zh} />

      {elementWarnings.length > 0 && (
        <div className="mt-1.5">
          <WarningList warnings={elementWarnings} zh={zh} />
        </div>
      )}

      {globalWarnings.length > 0 && (
        <div className="mt-1.5">
          <WarningList warnings={globalWarnings} zh={zh} />
        </div>
      )}

      <div className="mt-1.5">
        <Params el={el} onChange={(patch) => onChange(updateParams(state, el.id, patch))} zh={zh} />
      </div>

      {el.kind === 'switch' && (
        <button
          type="button"
          onClick={() => onChange(toggleSwitch(state, el.id))}
          className="compact tap32 mt-1.5 h-7 w-full rounded-md border border-[var(--border)] bg-[var(--accent-light)] px-2 text-xs font-medium text-[var(--fg)] transition-colors hover:border-[var(--accent)]"
        >
          {el.params.closed === false ? (zh ? '闭合开关' : 'Close switch') : zh ? '断开开关' : 'Open switch'}
        </button>
      )}

      {(el.kind === 'bulb' || el.kind === 'fuse') && (
        <button
          type="button"
          // 单只「换新」与顶栏的「一键修复」必须同一套口径：都走 core 的
          // `resetElementState`（整只元件回到 `defaultElementState`）。
          // 这里原先手写了一份 `{ temp: T_AMBIENT, heat: 0, burnt: false, blown: false }`，
          // 与 core 的定义是两份平行拷贝——将来只要有一边加了字段（比如灯泡的高温
          // 老化标记），两处就会各修各的，而学生根本看不出「换灯泡」和「全部修复」
          // 得到的灯丝状态该不该一样。
          //
          // 第二处口径统一是「谁来做这件事」：交给上层的 `onRepair`（没有才就地复位）。
          // 上层会在带电时先弹「实验要求先断开开关再更换」——否则从这块面板点
          // 「更换灯泡」就成了一条不用断电的后门，规范提示等于形同虚设。
          onClick={() => (onRepair ? onRepair(el.id) : onChange(resetElementState(state, el.id)))}
          className="compact tap32 mt-1.5 h-7 w-full rounded-md border border-[var(--border)] bg-[var(--accent-light)] px-2 text-xs font-medium text-[var(--fg)] transition-colors hover:border-[var(--accent)]"
        >
          {el.kind === 'bulb' ? (zh ? '更换灯泡' : 'Replace bulb') : zh ? '更换保险丝' : 'Replace fuse'}
        </button>
      )}
    </div>
  );
}

function Readout({ el, result, zh }: { el: CircuitComponent; result: SolveResult | null; zh: boolean }) {
  const r = result?.elements[el.id];
  // 读数一律走工程单位换算：3 位有效数字 + 自适应单位，界面上不会出现 e-6 / e+6。
  //
  // 符号口径与画布完全一致：电流表 / 电流计保留 `currentAB` 的符号（a 端是红柱「+」，
  // 负号＝表笔接反），电压表保留 `voltage` 的符号；电池与其它元件取幅值。
  const reversed = r ? readingReversed(el.kind, r) : false;
  const signedAmp = el.kind === 'ammeter' || el.kind === 'galvanometer';
  const iRaw = r ? signedCurrent(r) : 0;
  const current = r ? formatPhysicalValue(signedAmp ? iRaw : Math.abs(iRaw), 'A') : '—';
  const voltage = r
    ? formatPhysicalValue(el.kind === 'voltmeter' ? r.voltage : Math.abs(r.voltage), 'V')
    : '—';
  const power = r ? formatPhysicalValue(Math.abs(r.power), 'W') : '—';
  const resistance = r ? formatPhysicalValue(r.resistance, 'Ω') : '∞';
  const emf = Number(el.params.emf);
  const source = Number.isFinite(emf) ? formatPhysicalValue(emf, 'V') : '—';
  // 电源没有「自己两端的电阻」这回事，第四格换成电动势更贴合学生的读数需求。
  const fourth =
    el.kind === 'battery'
      ? { k: zh ? '电动势' : 'EMF', v: source }
      : { k: zh ? '电阻' : 'R', v: resistance };
  const items = [
    { k: zh ? '电流' : 'I', v: current },
    { k: zh ? '电压' : 'U', v: voltage },
    { k: zh ? '功率' : 'P', v: power },
    fourth,
  ];
  return (
    <div className="space-y-1.5">
      {reversed && (
        <div className="rounded-md border border-[var(--danger)]/45 bg-[var(--danger)]/8 px-1.5 py-1 text-[9px] leading-snug text-[var(--danger)]">
          {zh ? '⚠ 表笔接反：红柱应接高电位侧（电流由「+」流入）' : '⚠ Probes reversed: red post must take current in'}
        </div>
      )}
      <div className="grid grid-cols-2 gap-1.5">
        {items.map((it) => (
          <div key={it.k} className="rounded-lg border border-[var(--border)]/60 bg-[var(--accent-light)] px-2 py-1.5">
            <div className="text-[9px] leading-none text-[var(--muted)]">{it.k}</div>
            <div className="mt-1.5 font-mono text-[11px] leading-none tabular-nums text-[var(--fg)]">{it.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WarningList({ warnings, zh }: { warnings: SolveResult['warnings']; zh: boolean }) {
  return (
    <div className="space-y-1">
      {warnings.map((w, i) => (
        <div
          key={`${w.code}-${i}`}
          className="rounded-md border border-[var(--danger)]/35 bg-[var(--danger)]/8 px-1.5 py-1 text-[9px] leading-snug text-[var(--danger)]"
        >
          {zh ? w.zh : w.en}
        </div>
      ))}
    </div>
  );
}

interface Field {
  key: string;
  zh: string;
  en: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
}

function paramFields(el: CircuitComponent): Field[] {
  switch (el.kind) {
    case 'battery':
      return [
        { key: 'emf', zh: '电动势', en: 'EMF', min: 0.5, max: 24, step: 0.1, unit: 'V' },
        { key: 'r', zh: '内阻', en: 'Internal R', min: 0, max: 2, step: 0.01, unit: 'Ω' },
      ];
    case 'resistor':
      return el.params.mode === 'specimen'
        ? [
            { key: 'length', zh: '长度 L', en: 'Length L', min: 0.1, max: 10, step: 0.1, unit: 'm' },
            { key: 'area', zh: '横截面积 S', en: 'Area S', min: 1e-7, max: 5e-6, step: 1e-7, unit: 'm²' },
          ]
        : [{ key: 'r', zh: '阻值', en: 'Resistance', min: 0.1, max: 1000, step: 0.1, unit: 'Ω' }];
    case 'bulb':
      return [
        { key: 'ratedVoltage', zh: '额定电压', en: 'Rated V', min: 0.5, max: 24, step: 0.1, unit: 'V' },
        { key: 'ratedPower', zh: '额定功率', en: 'Rated P', min: 0.05, max: 100, step: 0.01, unit: 'W' },
      ];
    case 'rheostat':
      return [
        { key: 'maxR', zh: '最大阻值', en: 'Max R', min: 1, max: 200, step: 1, unit: 'Ω' },
        { key: 'ratio', zh: '滑片比例', en: 'Wiper ratio', min: 0, max: 1, step: 0.01 },
      ];
    case 'fuse':
      return [
        { key: 'ratedCurrent', zh: '额定电流', en: 'Rated I', min: 0.05, max: 20, step: 0.05, unit: 'A' },
        { key: 'r', zh: '冷态电阻', en: 'Cold R', min: 0.001, max: 2, step: 0.001, unit: 'Ω' },
      ];
    case 'heater':
      return [
        { key: 'r', zh: '电阻', en: 'Resistance', min: 1, max: 500, step: 1, unit: 'Ω' },
        { key: 'mass', zh: '质量', en: 'Mass', min: 0.001, max: 5, step: 0.001, unit: 'kg' },
      ];
    case 'ammeter':
    case 'voltmeter':
    case 'galvanometer':
      // 量程不是「可调参数」，而是电表上的标准挡位，交给下方的挡位选择器渲染。
      return [];
    default:
      return [];
  }
}

/**
 * ρ 的显示文案：1.7×10⁻⁸ Ω·m。
 *
 * 数字由材料表给出，文字由数字生成——只改材料表也得跟着变，不会出现
 * 「选项上印着 1.0×10⁻⁷、引擎里跑着 2.8×10⁻⁸」这种对不上的事。
 * 尾数保留一位小数（1.0 而不是 1），与教科书表格的写法一致。
 */
function rhoText(rho: number): string {
  if (!Number.isFinite(rho) || rho <= 0) return '';
  const exp = Math.floor(Math.log10(rho));
  const mantissa = (rho / Math.pow(10, exp)).toFixed(1);
  const sup = String(exp).replace(/[0-9-]/g, (c) => (c === '-' ? '⁻' : '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(c)]));
  return `${mantissa}×10${sup} Ω·m`;
}

/**
 * 电表挡位选择器：电表只有物理标准量程（接线柱上印死的那几挡），
 * 用一排按钮切换，绝不提供连续滑块——8.333 V 这种读数不该存在。
 * 当前挡位由 snapMeterRange 反查，旧存档里的非标准量程会显示为吸附后的标准挡。
 */
function MeterGears({
  el,
  onChange,
  zh,
}: {
  el: CircuitComponent;
  onChange: (patch: ParamBag) => void;
  zh: boolean;
}) {
  const gears = meterGears(el.kind);
  if (!gears) return null;
  const active = snapMeterRange(el.kind, el.params.range) ?? gears[0];
  const label = zh ? '量程挡位' : 'Range gear';
  return (
    <div>
      <div className="mb-0.5 text-[9px] text-[var(--muted)]">{label}</div>
      <div role="group" aria-label={label} className="flex gap-1">
        {gears.map((g) => {
          const on = g === active;
          return (
            <button
              key={g}
              type="button"
              aria-pressed={on}
              onClick={() => onChange({ range: g })}
              className={`compact tap32 h-7 flex-1 rounded-md border px-2 font-mono text-[11px] tabular-nums transition-colors ${
                on
                  ? 'border-[var(--accent)] bg-[var(--accent-light)] font-semibold text-[var(--fg)]'
                  : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]'
              }`}
            >
              {meterGearLabel(el.kind, g)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 单个参数行的「恢复出厂值」按钮：把这一格写回 `ELEMENT_MODELS[kind].defaults[key]`。
 *
 * 只重置这一个参数——不同时换灯泡、不清电路、不动同一元件上其它参数。学生把某一格
 * 拖飞了想退回来，不该顺手赔上整只元件。数值本来就等于出厂值时按钮置灰，
 * 一眼就能看出「这格没被动过」，也省掉一次无意义的撤销点。
 *
 * 参数种类、范围与出厂值三者同源：出厂值直接读元件模型表，界面里不再抄第二份数字。
 */
function ResetParamButton({
  el,
  field,
  value,
  onChange,
  zh,
}: {
  el: CircuitComponent;
  field: Field;
  value: number;
  onChange: (patch: ParamBag) => void;
  zh: boolean;
}) {
  const def = ELEMENT_MODELS[el.kind]?.defaults?.[field.key];
  if (typeof def !== 'number') return null;
  const atDefault = value === def || Math.abs(value - def) < 1e-9;
  const label = zh ? `恢复出厂值：${field.zh}` : `Restore default: ${field.en}`;
  return (
    <button
      type="button"
      disabled={atDefault}
      aria-label={label}
      title={zh ? '恢复出厂值' : 'Restore default'}
      onClick={() => onChange({ [field.key]: def })}
      className="compact tap32 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--border)] text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--fg)] disabled:cursor-default disabled:opacity-30 disabled:hover:border-[var(--border)] disabled:hover:text-[var(--muted)]"
    >
      <RotateCcw className="h-3.5 w-3.5 shrink-0" />
    </button>
  );
}

// patch 的类型就是 state 层的 ParamBag：材料下拉一次要同时写 material(string) 与
// rho(number)，原先那个「全字符串或全数字」的联合类型根本表达不了一次合法的混合写入。
function Params({ el, onChange, zh }: { el: CircuitComponent; onChange: (patch: ParamBag) => void; zh: boolean }) {
  const fields = paramFields(el);
  const num = (key: string, fallback = 0) => {
    const v = Number(el.params[key]);
    return Number.isFinite(v) ? v : fallback;
  };

  return (
    <div className="space-y-1.5">
      <MeterGears el={el} onChange={onChange} zh={zh} />

      {el.kind === 'resistor' && (
        <label className="flex min-h-9 items-center justify-between rounded-md bg-[var(--accent-light)] px-1.5 py-1 text-[10px] text-[var(--fg)] max-sm:min-h-10">
          <span>{zh ? '电阻定律试样' : 'Resistivity specimen'}</span>
          <input
            type="checkbox"
            checked={el.params.mode === 'specimen'}
            onChange={(e) => onChange({ mode: e.target.checked ? 'specimen' : 'fixed' })}
            className="h-4 w-4 accent-[var(--accent)]"
          />
        </label>
      )}

      {el.kind === 'resistor' && el.params.mode === 'specimen' && (
        <div className="text-[9px] text-[var(--muted)]">
          <div className="mb-0.5">{zh ? '材料电阻率 ρ' : 'Material rho'}</div>
          {/* 材料与 ρ 必须一起写：引擎只认 params.rho，只改字符串等于换了个标签、读数不动。 */}
          <BenchSelect
            dense
            className="w-full"
            ariaLabel={zh ? '材料电阻率 ρ' : 'Material rho'}
            value={String(el.params.material ?? 'copper')}
            options={MATERIAL_RHO.map((m) => ({
              value: m.id,
              label: zh ? m.zh : m.en,
              hint: rhoText(m.rho),
            }))}
            onChange={(id) => onChange({ material: id, rho: materialOf(id).rho })}
          />
        </div>
      )}

      {fields.map((f) => {
        const v = num(f.key, f.min);
        const digits = f.step < 0.01 ? 7 : 2;
        return (
          <div key={f.key} className="flex items-start gap-1">
            <div className="min-w-0 flex-1">
              <ParamSlider
                label={zh ? f.zh : f.en}
                value={v}
                min={f.min}
                max={f.max}
                step={f.step}
                precision={digits}
                format={(next) => (f.unit ? formatPhysicalValue(next, f.unit) : fmtNumber(next, 3))}
                onChange={(next) => onChange({ [f.key]: next })}
              />
            </div>
            <ResetParamButton el={el} field={f} value={v} onChange={onChange} zh={zh} />
          </div>
        );
      })}

      {el.kind === 'bulb' && (
        <div className="rounded-md bg-[var(--accent-light)] px-1.5 py-1 text-[9px] text-[var(--muted)]">
          {zh ? '灯丝' : 'Filament'} <span className="font-mono text-[var(--fg)]">{fmt(el.state.temp, 0)} K</span>
          {' · '}
          <span className="text-[var(--fg)]">{el.state.burnt ? (zh ? '已烧毁' : 'burnt') : zh ? '正常' : 'ok'}</span>
        </div>
      )}

      {el.kind === 'fuse' && (
        <div className="rounded-md bg-[var(--accent-light)] px-1.5 py-1 text-[9px] text-[var(--muted)]">
          {zh ? '热积累' : 'Heat'} <span className="font-mono text-[var(--fg)]">{fmt(el.state.heat, 2)}</span>
          {' · '}
          <span className="text-[var(--fg)]">{el.state.blown ? (zh ? '已熔断' : 'blown') : zh ? '正常' : 'ok'}</span>
        </div>
      )}

      {el.kind === 'heater' && (
        <div className="rounded-md bg-[var(--accent-light)] px-1.5 py-1 text-[9px] text-[var(--muted)]">
          {zh ? '累计热量' : 'Heat'} <span className="font-mono text-[var(--fg)]">{fmt(el.state.heat, 1)} J</span>
        </div>
      )}
    </div>
  );
}

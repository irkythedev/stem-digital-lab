/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学实验台 · 元件状态 HUD（Live monitor）
 *
 * 画布右上角的一块半透明毛玻璃浮窗：一眼看清每只元件现在多大电压、多大电流，
 * 以及它到底是「正在工作 / 通路静息 / 断开熄灭 / 已经烧掉」。
 *
 * 三条硬约束决定了这里的形态：
 *
 * 1. **不吃版心宽度**。整块卡是 `absolute` 浮层，画布永远是 100% 宽的居中画布；
 *    挡在电路上的只是一层 80% 透明的壳，底下的点阵网格与导线仍隐约可见。
 *    为此卡宽收在 256px（`w-64`），版面上留出的净空由画布初始平移让出（见 CircuitCanvas）。
 * 2. **一格一只元件**。2 列微型仪表盘：首行「名字 + 状态徽标」，次行一枚等宽读数，
 *    六只元件压进三行；这里是「扫一眼」而不是「读报表」的地方，没有进度条、没有大留白。
 * 3. **故障不会被折起来忘掉**。出现熔毁元件时看板自动展开、顶部立刻亮起红色横幅
 *    与「一键修复」；就算学生手动收成了 30px 药丸，药丸自己也转成告警色并把
 *    「一键修复」摆在旁边，不必先把面板摊开。红条还负责把「修不修得住」说清楚：
 *    短接开关还闭着就修，换上的保险丝 0.1 秒内还会熔断，所以按钮下面直接写出
 *    「先断开 S₂ 再修复」（`repairCaution`）——提示必须赶在按钮被按下之前。
 * 4. **空台面不给结论，给下一步**。画布上一只元件都没有时，这张卡没有可看的读数，
 *    也谈不上「正常」（0 只元件当然 0 只损坏）——那时它换一份身份：页眉不再报数、
 *    正文变成「先放元件 → 再接线 → 后合闸」的三步引导加一枚「打开元件库」按钮，
 *    收成药丸说的也是「空白画布 · 从这里开始」而不是一个绿勾。判定由 `monitorVerdict` 给出。
 * 5. **默认收成药丸**。这张卡默认收起，与左侧元件坞同一个姿态：第一眼把整块画布交给
 *    学生，需要读数时点一下药丸（药丸本身已经写着「几只正常 / 几只损坏」）。默认收起
 *    并不削弱第 3 条——唯一会自己摊开的情形仍是**出故障**：那是事件，不是状态，
 *    不能躺在药丸里等学生自己去发现。
 *
 * 配色语义（工程认知里颜色就是信息，颜色错比字错更误导）：
 *   琥珀金 = 正在工作（发光 · 发热）｜红 = 真故障（烧毁 · 熔断 · 过载）
 *   翡翠绿 = 通路正常（闭合 · 导通 · 供电）｜中性灰 = 静息（断开 · 熄灭 · 未接入）
 * 浅色档取 -600/-500（-500 的白底对比度只有 2:1，10px 徽标读不动），深色档取 -400，
 * 与隔壁 PresetBriefing 的四阶段徽标同一套写法。
 *
 * 表格只呈现 `circuit-bench-monitor` 算好的行，组件本身不做任何物理判断。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Gauge, Plus, Wrench } from 'lucide-react';

import { useApp } from '../../../lib/app-context';
import type { BenchState, ElementReading } from './circuit-bench-core';
import {
  buildMonitorModel,
  monitorValue,
  monitorVerdict,
  repairCaution,
  usageText,
  type LoadRow,
  type MeterRow,
} from './circuit-bench-monitor';

export interface CircuitMonitorProps {
  state: BenchState;
  readings?: Record<string, ElementReading> | null;
  /**
   * 求解器报出的短路告警。看板据此把电源标红——短路时端电压接近 0，
   * 只看读数与轻载分不开，拓扑判定才是权威的。
   */
  shortCircuit?: boolean;
  selectedId: string | null;
  /** 点某一格：选中画布上那只元件（再点一次取消）。 */
  onSelect?: (id: string | null) => void;
  /** 一键修复全部熔毁元件。 */
  onRepairAll?: () => void;
  /** 只修某一只（画布徽章共用这条路径）。 */
  onRepairElement?: (id: string) => void;
  /**
   * 空台面引导里的「打开元件库」：由上层把左侧元件坞从胶囊摊开。
   * 不传就只给文字提示（组件本身不认识元件坞，别在这里偷偷改上层布局）。
   */
  onOpenPalette?: () => void;
  /**
   * 停靠角。默认右上角（`top-14 right-4`，画布卡工具栏下沿）。
   * 实验导读浮卡打开时让到右下角：导读卡固定 `z-50` 且默认就停在右上角，
   * 两块卡各占一角才不至于把实时读数整个盖住。
   */
  corner?: 'top-right' | 'bottom-right';
  /**
   * 受控展开态。窄屏要保证「同一时刻只有一块浮层」，而这块卡会因故障自动摊开——
   * 上层必须知道它摊开了（才能收起其它浮层），也必须能替它收起。
   * 不传则退回组件内部状态（桌面行为与旧版一致）。
   */
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}

/**
 * 徽标语义色。深色档走 `[html.dark_&]:`（= `html.dark &`）而不是 `dark:`——
 * 站点的手动主题开关挂的是 `html.dark` 类，`dark:` 只认系统偏好，手动切主题时徽标会停在浅色档。
 *
 * 浅色档一律取 700 级：600 级压在半透明同色底上只有 2.94（live）/ 3.32（ok）/
 * 4.13（fault）/ 4.28（idle），四档全部不到 4.5:1，而这是 10px 正文级文字。
 * 700 级实测 4.62 / 4.87 / 5.56 / 9.25，四档齐过 AA。深色档不动：
 * 400 级在 #1e1e1a 上已经是 6.8–10.6，再深反而掉回门槛下。
 */
type Tone = 'live' | 'fault' | 'ok' | 'idle';

const TONE: Record<Tone, string> = {
  live: 'text-amber-700 bg-amber-500/10 [html.dark_&]:text-amber-400 [html.dark_&]:bg-amber-400/10',
  fault: 'text-red-700 bg-red-500/15 [html.dark_&]:text-red-400',
  ok: 'text-emerald-700 bg-emerald-500/10 [html.dark_&]:text-emerald-400 [html.dark_&]:bg-emerald-400/10',
  idle: 'text-zinc-700 bg-zinc-500/10 [html.dark_&]:text-zinc-400 [html.dark_&]:bg-zinc-400/10',
};

/** 微型单元：等高、等宽，六只元件排下来左右两列才对得齐。 */
const CELL =
  'flex min-w-0 flex-col rounded-lg border border-[var(--border)]/40 bg-[var(--bg)]/50 p-1.5 py-1 text-left text-[11px] leading-none transition-colors';
/**
 * 格子里的按钮一律挂 `.compact`：`main button` 有一条 40px 最小高度的触屏地板
 * （见 index.css），不解除的话一格会被撑成 92px —— 三行就是 304px，六只元件的
 * 紧凑表盘立刻变成半屏大卡。`.compact` 是那条地板留的显式口子。
 */
const CELL_BTN = 'compact min-w-0 text-left';
const CELL_ON = 'border-[var(--fg)] bg-[var(--accent-light)]';
const CELL_OFF = 'hover:border-[var(--border)] hover:bg-[var(--accent-light)]/60';
/**
 * 状态徽标：浅底同色字，行高锁 13px 与首行的名字齐平。
 *
 * `text-[10px]` 只给字号不给行高，继承来的行高会把首行抬到 14px+；
 * 徽标与名字两个数对不上时，格子的高度就由「谁更高」随机决定，三行加起来能差出十几像素。
 */
const BADGE = 'shrink-0 rounded px-1 text-[10px] leading-[13px] font-medium whitespace-nowrap';

/**
 * 紧凑读数：`2.96V` / `258mA`。
 *
 * `formatPhysicalValue` 是给画布气泡与检查器用的（`2.96 V`，数字与单位之间留空格）；
 * 格子里要塞下 U 与 I 两个读数，把那个空格去掉才排得开，单位仍然跟着数字走。
 */
function num(value: number, unit: string): string {
  return monitorValue(value, unit).replace(/\s+/g, '');
}

/** 一格的全部内容：这里是唯一的渲染结构，三种元件共用，高度才不会各行其是。 */
interface Cell {
  id: string;
  name: string;
  /** 状态徽标文案。 */
  badge: string;
  tone: Tone;
  /** 次行等宽读数或 `—`。 */
  detail: string;
  /** 悬停提示：写全「量程 / 额定值 / 读数来源」，格子里放不下的都在这里。 */
  hint: string;
}

function loadCell(row: LoadRow): Cell {
  // 熄灭 / 未通电一律走中性灰，而且**先判**再问 row.live。
  // 变电站：断开开关时灯泡仍然是「挂好的、没坏的」（row.live 依旧为真），
  // 早先的顺序让一盏黑灯拿到绿色「正常」徽标——一块绿色「一切正常」压在黑灯上，
  // 学生只会读成「灯亮着、电路通着」，而这正是「开关到底合没合」最关键的判据。
  // 绿只留给真的在导通的状态。
  const tone: Tone = row.faulty
    ? 'fault'
    : row.status === 'lit' || row.status === 'heating'
      ? 'live'
      : row.status === 'dark' || !row.live
        ? 'idle'
        : 'ok';
  return {
    id: row.id,
    name: row.name,
    badge: row.statusText,
    tone,
    detail: row.live ? `${num(row.voltage, 'V')} · ${num(row.current, 'A')}` : '—',
    hint: `${row.name} · ${row.statusText}`,
  };
}

function meterCell(row: MeterRow, zh: boolean): Cell {
  // 过载是真故障（会烧表），接反只是接线极性提醒——前者红、后者琥珀。
  const tone: Tone = row.over ? 'fault' : row.reversed ? 'live' : row.live ? 'ok' : 'idle';
  const badge = row.over
    ? zh
      ? '过载'
      : 'Over'
    : row.reversed
      ? zh
        ? '接反'
        : 'Rev'
      : row.live
        ? zh
          ? '正常'
          : 'Normal'
        : zh
          ? '未接入'
          : 'Idle';
  return {
    id: row.id,
    name: row.name,
    badge,
    tone,
    detail: row.live ? `${num(row.value, row.unit)} · ${usageText(row.usage)}` : '—',
    hint: zh
      ? `${row.name} · 量程 ${monitorValue(row.range, row.unit)} · 占用 ${usageText(row.usage)}`
      : `${row.name} · range ${monitorValue(row.range, row.unit)} · ${usageText(row.usage)}`,
  };
}

export default function CircuitMonitor({
  state,
  readings,
  shortCircuit = false,
  selectedId,
  onSelect,
  onRepairAll,
  onRepairElement,
  onOpenPalette,
  corner = 'top-right',
  open: openProp,
  onOpenChange,
}: CircuitMonitorProps) {
  const { lang } = useApp();
  const zh = lang === 'zh';
  /**
   * 默认收起：与左侧元件坞（也默认收成胶囊）取同一个姿态。
   *
   * 画布是主角，这块卡是配角——一进来就摊开一张 256px 的面板，等于替学生决定了
   * 「先读表再搭电路」，还把右上角的电路压掉一块。药丸本身就是结论（几只正常 /
   * 几只损坏 / 空白画布），要细节再点开。注意别把默认值改回去：这是有意的默认，
   * 不是漏写的 `true`。
   */
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (v: boolean) => {
    setOpenState(v);
    onOpenChange?.(v);
  };
  /**
   * 停靠角：常态贴画布右上角（工具栏 `top-14` 之下），导读卡占着右上角时让到右下角。
   *
   * 窄屏由上层传 `bottom-right`（元件库展开时临时让回 `top-right`，见 CircuitBench）：
   * 右上角在窄屏是参数面板关闭钮与全屏按钮的地盘，HUD 胶囊压上去就会出现
   * 「想关面板、结果展开了监控」的误触（审计 P0-2）。
   */
  const anchor = corner === 'bottom-right' ? 'absolute right-4 bottom-4 z-30' : 'absolute top-14 right-4 z-30';
  const model = useMemo(
    () => buildMonitorModel({ state, readings, lang: zh ? 'zh' : 'en', shortCircuit }),
    [state, readings, zh, shortCircuit],
  );
  const faultCount = model.faultIds.length;
  const faultKey = model.faultIds.join(',');
  const prevFaults = useRef(0);
  // 故障是「事件」而不是「状态」：默认收起的看板也照样在出事的那一刻摊开，
  // 别让烧掉的元件躺在药丸里等学生自己发现。首帧就有故障（载入存档）时同理。
  useEffect(() => {
    if (faultCount > 0 && prevFaults.current === 0) setOpen(true);
    prevFaults.current = faultCount;
  }, [faultCount, faultKey]);

  const rows = model.loads.length + model.meters.length + model.others.length;
  const verdict = monitorVerdict(model);
  const empty = verdict === 'empty';
  /**
   * 「修了等于白修」的提醒：这次一键修复之后，保险丝/灯泡会不会立刻又坏？
   *
   * 只在有故障时才算（平时一次电路求解都不多跑）。有故障时每帧至多几次求解，
   * 与主仿真同量级，不构成负担。
   */
  const caution = useMemo(
    () => (faultCount > 0 ? repairCaution({ state, lang: zh ? 'zh' : 'en' }) : null),
    [state, faultCount, zh],
  );

  /** 三种元件统一成同一种格子：顺序即阅读顺序（用电器 → 电表 → 电源与控制）。 */
  const cells: Cell[] = useMemo(
    () => [
      ...model.loads.map((row) => loadCell(row)),
      ...model.meters.map((row) => meterCell(row, zh)),
      ...model.others.map((row) => ({
        id: row.id,
        name: row.name,
        badge: row.text,
        tone: (row.status === 'fault' ? 'fault' : row.status === 'ok' ? 'ok' : 'idle') as Tone,
        // 导线元件两端同节点，U/I 恒为 0，那不是它的读数（支路电流由回路决定、
        // 连接件本身不单独计量）。这里不能照抄 `0.000 V · 0.000 A`，那会读成
        // 「测到了零电流」，恰恰和紧挨着的「导通」自相矛盾。
        detail:
          row.kind === 'wire'
            ? row.live
              ? zh
                ? '两端同电位'
                : 'Same node'
              : '—'
            : row.live
              ? `${num(row.voltage, 'V')} · ${num(row.current, 'A')}`
              : '—',
        hint: `${row.name} · ${row.text}`,
      })),
    ],
    [model, zh],
  );

  /**
   * 折叠态药丸：`🟢 6 元件正常` / `⚠ 1 元件损坏` / `◌ 空白画布 · 从这里开始`。
   *
   * 三档文案由 `verdict` 决定，而不是由计数算出来：空台面既不是「0 元件正常」
   * （绿勾是没有测量支撑的空真），也不该在药丸上装作一块仪表——它是一条入口，
   * 点开就是那张三步引导。空心灰点与「正常」的实心绿点刻意不同色同形，
   * 扫一眼就能分清「检查过了」和「还没有可检查的」。
   *
   * 药丸是默认形态，所以空台面那档不能只写「空白画布」——默认收起之后，这半句
   * 就是学生在空画布上能看到的**唯一**提示，只说现象不给下一步等于又把
   * 「机械式」请了回来；「· 从这里开始」与 `pillTitle` 一起把话说完。
   */
  const pillText = zh
    ? verdict === 'fault'
      ? `${faultCount} 元件损坏`
      : verdict === 'meter'
        ? `${model.meterAlerts} 只电表异常`
        : empty
          ? '空白画布 · 从这里开始'
          : `${rows} 元件正常`
    : verdict === 'fault'
      ? `${faultCount} faulty`
      : verdict === 'meter'
        ? `${model.meterAlerts} meter alert${model.meterAlerts === 1 ? '' : 's'}`
        : empty
          ? 'Blank canvas — start here'
          : `${rows} OK`;
  const pillTitle = zh
    ? empty
      ? '展开：从这里开始搭电路'
      : verdict === 'meter'
        ? '展开：查看超量程 / 接反的电表'
        : '展开元件状态监控'
    : empty
      ? 'Open: get started'
      : verdict === 'meter'
        ? 'Open: check over-range / reversed meters'
        : 'Open live monitor';
  const pill = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-expanded={false}
      title={pillTitle}
      className={`compact tap32 flex h-[30px] items-center gap-1.5 rounded-full border px-3 text-[11px] leading-none shadow-lg backdrop-blur-md ${
        faultCount > 0
          ? 'border-[var(--danger)] bg-[var(--danger)]/12 text-[var(--danger)]'
          : verdict === 'meter'
            ? 'border-[var(--warn)] bg-[var(--warn)]/12 text-[var(--warn)]'
            : 'border-[var(--border)] bg-[var(--card-bg)]/75 text-[var(--muted)]'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          empty ? 'border border-[var(--muted)]' : ''
        }`}
        style={{
          background:
            faultCount > 0
              ? 'var(--danger)'
              : verdict === 'meter'
                ? 'var(--warn)'
                : empty
                  ? 'transparent'
                  : 'var(--success)',
        }}
      />
      <span className="whitespace-nowrap font-medium">{pillText}</span>
      <ChevronDown className="h-3 w-3 shrink-0" />
    </button>
  );

  if (!open) {
    return (
      <div data-drop-blocked="" className={`${anchor} flex items-center gap-1.5`}>
        {pill}
        {/* 收成药丸也留着修复入口：故障本身就在药丸上亮着，不必先摊开面板。 */}
        {faultCount > 0 && (
          <button
            type="button"
            onClick={() => onRepairAll?.()}
            title={zh ? '一键修复损坏元件' : 'Repair damaged parts'}
            className="compact tap32 flex h-[30px] items-center gap-1 rounded-full bg-[var(--danger)] px-3 text-[11px] leading-none font-medium text-[var(--card-bg)] shadow-lg transition-colors hover:bg-[var(--danger)]/85"
          >
            <Wrench className="h-3 w-3 shrink-0" />
            <span className="whitespace-nowrap">{zh ? '一键修复' : 'Repair'}</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      data-drop-blocked=""
      className={`${anchor} flex w-64 max-w-[calc(100%-2rem)] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card-bg)]/80 text-[var(--fg)] shadow-lg backdrop-blur-md max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:z-40 max-sm:max-h-[45dvh] max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:rounded-t-2xl`}
    >
      <div className="flex h-6 shrink-0 items-center gap-1.5 px-2">
        <Gauge className="h-3 w-3 shrink-0 text-[var(--muted)]" />
        <span className="truncate text-[11px] leading-[14px] font-medium">
          {zh ? '元件状态监控' : 'Live monitor'}
        </span>
        {/* 空台面不报「0」：没有东西可数的时候，那个数字只是把「空」再写一遍。 */}
        {!empty && (
          <span className="mono-font text-[10px] leading-[14px] text-[var(--muted)] tabular-nums">
            {rows}
          </span>
        )}
        {faultCount > 0 && (
          <span className="mono-font text-[10px] leading-[14px] text-[var(--danger)] tabular-nums">
            ⚠ {faultCount}
          </span>
        )}
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-expanded
          title={zh ? '最小化为药丸' : 'Minimize'}
          aria-label={zh ? '最小化元件状态监控' : 'Minimize live monitor'}
          className="compact tap-area relative z-40 ml-auto -mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-[var(--muted)] transition-colors hover:bg-[var(--accent-light)] hover:text-[var(--fg)]"
        >
          <ChevronUp className="h-3 w-3 shrink-0" />
        </button>
      </div>

      {/* 损坏置顶：只在真出事时占用一行，红色横幅 + 一键修复，永远在表盘之上。 */}
      {faultCount > 0 && (
        <div className="flex shrink-0 flex-col border-y border-red-500/20 bg-red-500/15 px-2 py-1 text-[10px] leading-[14px] text-red-700 [html.dark_&]:text-red-400">
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1 font-medium">
              <span className="shrink-0">⚠️</span>
              <span className="truncate">{zh ? '元件损坏' : 'Parts damaged'}</span>
            </span>
            {/* 红底白字取 red-600：red-500 上的白字只有 3.81:1，而这颗按钮的字
                是全站最要紧的一句「一键修复」。red-600 提到 4.77（两套主题同值，
                因为这里的红底是 Tailwind 固定色阶，不走 --danger）。
                hover 跟着下探一档到 red-700：底色抬到 600 之后如果 hover 还是
                600，按钮就彻底没有悬停反馈了。 */}
            <button
              type="button"
              onClick={() => onRepairAll?.()}
              title={
                zh
                  ? `一键修复损坏元件（${faultCount} 只烧毁/熔断）：换新并恢复额定阻值`
                  : `Repair damaged parts (${faultCount}): replace and restore rated resistance`
              }
              className="compact flex shrink-0 items-center gap-0.5 rounded bg-red-600 px-1.5 py-0.5 text-[10px] leading-[14px] font-medium text-white transition-colors hover:bg-red-700"
            >
              <Wrench className="h-3 w-3 shrink-0" />
              <span className="whitespace-nowrap">{zh ? '一键修复' : 'Repair'}</span>
            </button>
          </div>
          {/*
            修不修得住，先说在按按钮之前。

            真实课堂里最气人的一幕：短接开关还闭着就点「一键修复」，换上去的保险丝
            0.09 s 内又熔断——学生眼里这是「按钮坏了」，而真相是「路还是短路的」。
            提示写在按钮正下方（同一条红条里），手还没离开鼠标就能看见；措辞给出
            具体标号（先断开 S₂），而不是泛泛的「请检查电路」——能照着做的话才是话。
          */}
          {caution && (
            <p className="mt-0.5 flex items-start gap-1 leading-[13px] text-red-700/90 [html.dark_&]:text-red-300/90">
              <span className="shrink-0">↳</span>
              <span className="min-w-0">{caution.text}</span>
            </p>
          )}
        </div>
      )}

      {/*
        空台面：这张卡没有读数可报，就改说「下一步做什么」——与空闲读数区的空态
        一个口径（那边也请学生去元件库），三句话正好是自由实验台预设里的三步，
        学生照着做就能把这张卡重新变回仪表。
      */}
      {empty ? (
        <div className="px-2 pb-2 text-[10px] leading-[15px] text-[var(--muted)]">
          <p className="font-medium text-[var(--fg)]">{zh ? '画布还是空的' : 'Blank canvas'}</p>
          <ol className="mt-0.5 space-y-0.5">
            <li>{zh ? '① 点「+ 元件库」，拖入电源、用电器和开关' : '① Open + Parts and drag in a source, a load and a switch'}</li>
            <li>{zh ? '② 点「接线」，依次点两个接线柱' : '② Pick Wire, then click two terminals in order'}</li>
            <li>{zh ? '③ 闭合开关，元件状态就在这里实时更新' : '③ Close the switch — live states appear here'}</li>
          </ol>
          {onOpenPalette && (
            <button
              type="button"
              onClick={onOpenPalette}
              title={zh ? '摊开左侧元件库，拖入元件开始搭建' : 'Expand the parts bin and drag a component onto the canvas'}
              className="compact mt-1.5 flex h-6 w-full items-center justify-center gap-1 rounded-md border border-[var(--border)] bg-[var(--card-bg)]/70 text-[10px] leading-none font-medium text-[var(--fg)] transition-colors hover:bg-[var(--accent-light)]"
            >
              <Plus className="h-3 w-3 shrink-0" />
              <span className="whitespace-nowrap">{zh ? '打开元件库' : 'Open parts'}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid max-h-[calc(100vh-220px)] grid-cols-2 gap-1 overflow-y-auto p-2">
          {cells.map((cell) => {
            const selected = cell.id === selectedId;
            const faulty = model.faultIds.includes(cell.id);
            const pick = () => onSelect?.(selected ? null : cell.id);
            return (
              <div
                key={cell.id}
                className={`${CELL} ${selected ? CELL_ON : CELL_OFF} ${
                  faulty ? 'border-[var(--danger)]' : ''
                }`}
              >
                <span className="flex min-w-0 items-center justify-between gap-1">
                  <button
                    type="button"
                    onClick={pick}
                    title={cell.hint}
                    className={`${CELL_BTN} flex-1 truncate text-xs leading-[13px] font-semibold`}
                  >
                    {cell.name}
                  </button>
                  {/* 熔毁的那一格把徽标就地变成「更换」：不必先选中再开检查器。 */}
                  {faulty ? (
                    <button
                      type="button"
                      onClick={() => onRepairElement?.(cell.id)}
                      title={zh ? '点击更换新元件' : 'Replace this component'}
                      className={`${BADGE} ${TONE.fault} compact hover:bg-red-500/25`}
                    >
                      {zh ? '更换' : 'Repair'}
                    </button>
                  ) : (
                    <span className={`${BADGE} ${TONE[cell.tone]}`}>{cell.badge}</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={pick}
                  title={cell.hint}
                  className={`${CELL_BTN} mt-px truncate mono-font text-[10px] leading-[11px] text-[var(--muted)] tabular-nums`}
                >
                  {cell.detail}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

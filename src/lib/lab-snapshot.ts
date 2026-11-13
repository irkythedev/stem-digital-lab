/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 实验快照的纯格式化：把 getLabState() 的易失读数变成一句「纸墨手稿摘要」。
 * 只做字符串，不读 DOM、不发网络请求；分享组件在点击瞬间调用。
 */

const STAGE_LABEL = {
  predict: { zh: '预测', en: 'predict' },
  explore: { zh: '探索', en: 'explore' },
  conclude: { zh: '结论', en: 'conclude' },
} as const;

const UNIT: Record<string, string> = {
  u: 'V', i: 'A', r: 'Ω', rp: 'Ω', elemVoltage: 'V',
  f: 'cm', v: 'cm', uF: 'cm',
  m1: '', d1: '', m2: '', d2: '',
  a: '', b: '', c: '', k: '',
  angleBPC: '°', angleBQC: '°', angleBOC: '°', chordLen: 'cm', halfChord: 'cm', perpDist: 'cm',
};

const FIELD_LABEL: Record<string, { zh: string; en: string }> = {
  u: { zh: '电压', en: 'voltage' },
  i: { zh: '电流', en: 'current' },
  r: { zh: '定值电阻', en: 'resistance' },
  rp: { zh: '滑动变阻器', en: 'rheostat' },
  elemVoltage: { zh: '元件电压', en: 'element voltage' },
  f: { zh: '焦距', en: 'focal length' },
  v: { zh: '像距', en: 'image distance' },
  m1: { zh: '左钩码', en: 'left weights' },
  d1: { zh: '左力臂', en: 'left arm' },
  m2: { zh: '右钩码', en: 'right weights' },
  d2: { zh: '右力臂', en: 'right arm' },
  beforeMass: { zh: '反应前质量', en: 'mass before' },
  afterMass: { zh: '反应后质量', en: 'mass after' },
};

function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}

function trimCoef(n: number): string {
  if (n === 1) return '';
  if (n === -1) return '-';
  return fmtNum(n);
}

/** 二次函数/一次函数的表达式；只在字段齐全时使用。 */
function quadraticExpr(a: number, b: number, c: number): string {
  let s = `${trimCoef(a)}x²`;
  if (Math.abs(b) > 1e-9) s += ` ${b > 0 ? '+' : '−'} ${trimCoef(Math.abs(b))}x`;
  if (Math.abs(c) > 1e-9) s += ` ${c > 0 ? '+' : '−'} ${fmtNum(Math.abs(c))}`;
  return `y = ${s}`;
}

function linearExpr(k: number, b: number): string {
  let s = `${trimCoef(k)}x`;
  if (Math.abs(b) > 1e-9) s += ` ${b > 0 ? '+' : '−'} ${fmtNum(Math.abs(b))}`;
  return `y = ${s}`;
}

export interface SnapshotSummaryOptions {
  labId: string;
  state?: Record<string, unknown>;
  lang: 'zh' | 'en';
}

/** 把状态压成一行「当前工况」；拿不到字段时回退到通用数字字段。 */
export function snapshotSummary({ labId, state, lang }: SnapshotSummaryOptions): string {
  if (!state) return lang === 'zh' ? '参数未记录' : 'parameters not recorded';
  const n = (k: string): number | null => {
    const v = state[k];
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  };

  if (labId === 'quadratic') {
    const a = n('a'); const b = n('b'); const c = n('c');
    if (a !== null && b !== null && c !== null) return quadraticExpr(a, b, c);
  }
  if (labId === 'linear') {
    const k = n('k'); const b = n('b');
    if (k !== null && b !== null) return linearExpr(k, b);
  }
  if (labId === 'inverse') {
    const k = n('k');
    if (k !== null) return `y = ${trimCoef(k)}/x`;
  }
  if (labId === 'ohm') {
    const u = n('u'); const r = n('r'); const i = n('i');
    const parts: string[] = [];
    if (u !== null) parts.push(`U=${fmtNum(u)} V`);
    if (r !== null) parts.push(`R=${fmtNum(r)} Ω`);
    if (i !== null) parts.push(`I=${fmtNum(i)} A`);
    if (parts.length) return parts.join(' · ');
  }

  const parts: string[] = [];
  for (const [key, value] of Object.entries(state)) {
    if (key === 'stage' || typeof value !== 'number' || !Number.isFinite(value)) continue;
    if (parts.length >= 4) break;
    const label = FIELD_LABEL[key];
    const unit = UNIT[key] ?? '';
    parts.push(label
      ? `${lang === 'zh' ? label.zh : label.en}=${fmtNum(value)}${unit ? ` ${unit}` : ''}`
      : `${key}=${fmtNum(value)}${unit ? ` ${unit}` : ''}`);
  }
  return parts.length ? parts.join(' · ') : (lang === 'zh' ? '参数未记录' : 'parameters not recorded');
}

export interface LabShareTextOptions {
  labName: { zh: string; en: string };
  labId: string;
  state?: Record<string, unknown>;
  url: string;
  lang: 'zh' | 'en';
  /** URL 是否真的带回了可还原参数 */
  restorable?: boolean;
}

/** 分享正文：纸墨手稿摘要 + 直达快照链接。 */
export function buildLabShareText({ labName, labId, state, url, lang, restorable = true }: LabShareTextOptions): string {
  const name = lang === 'zh' ? labName.zh : labName.en;
  const stageRaw = typeof state?.stage === 'string' ? state.stage : '';
  const stage = STAGE_LABEL[stageRaw as keyof typeof STAGE_LABEL];
  const stageText = stage ? (lang === 'zh' ? stage.zh : stage.en) : '';
  const summary = snapshotSummary({ labId, state, lang });
  const head = lang === 'zh'
    ? `【STEM 数字实验室 · ${name}】当前工况：${summary}${stageText ? `（${stageText}阶段）` : ''}`
    : `[STEM Digital Lab · ${name}] Current state: ${summary}${stageText ? ` (${stageText})` : ''}`;
  const tail = restorable
    ? (lang === 'zh' ? '→ 打开即刻复现：' : '→ reopen exactly: ')
    : (lang === 'zh' ? '→ 打开实验页：' : '→ open the lab: ');
  return `${head}${tail}${url}`;
}

/** 判断当前 URL 是否已经带了可还原的实验参数（stage 或核心参数）。 */
export function urlHasSnapshot(url: string): boolean {
  return /[?&](stage|a|b|c|k|u|r|f|m1|d1|m2|d2)=/.test(url);
}

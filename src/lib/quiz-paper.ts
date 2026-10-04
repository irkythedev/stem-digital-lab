/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 错题卷组卷（纯函数）——把本地错题记录编排成「可打印 A4 复习卷」的数据结构。
 *
 * 设计约束：
 * - 纯函数、不读 DOM、不触网、不依赖 React：便于单元测试，也便于将来复用到别处；
 * - 只做结构编排（分节 / 排序 / 连续编号 / 留白高度 / 答案集 / 限时估算），
 *   所有文字与排版交给展示层；
 * - 不修改传入数组（返回新对象），调用方传什么就编什么（筛选由调用方决定）。
 */
import type { QuizHistoryEntry } from './quiz-history';

/** 演算留白档位 */
export type PaperBlankLevel = 'compact' | 'standard' | 'roomy';
/** 排序：按知识点分组 / 按时间倒序 */
export type PaperSortMode = 'topic' | 'time';

export interface PaperOptions {
  /** 是否在文末附答案与解析（默认否：先做题） */
  includeAnswers?: boolean;
  /** 演算留白档位（默认 standard=20mm） */
  blankLevel?: PaperBlankLevel;
  /** 排序方式（默认 topic=按知识点分组） */
  sortMode?: PaperSortMode;
}

/** 演算留白高度（mm）：紧凑不留、标准 20、宽松 35 */
export const BLANK_MM: Record<PaperBlankLevel, number> = { compact: 0, standard: 20, roomy: 35 };

/** 选项序号标签 */
export const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

/** 填空题未作答时的占位（展示层按语言渲染） */
export const BLANK_ANSWER = '____';

export interface PaperItem {
  /** 连续题号（跨分节，1 起） */
  no: number;
  topic: string;
  subject: string;
  type: 'choice' | 'fill';
  question: string;
  options: string[];
  /** 正确选项下标；-1 = 无标准答案 */
  answerIdx: number;
  fillAnswers: string[];
  /** 正确答案的可读文本：选择题为 'A'；填空为各家答案；无答案为 '' */
  correctText: string;
  /** 学生的错答文本：选择题为 'B'；填空为其原文；未答/超时为 '' */
  wrongText: string;
  explanation?: string;
  /** 该题演算留白高度（mm） */
  blankMm: number;
  /** 溯源实验名（由调用方解析；缺省空串） */
  source: string;
  timedOut: boolean;
}

export interface PaperSection {
  /** 分节标题（time 模式下为空串：不渲染小节标题） */
  topic: string;
  items: PaperItem[];
}

export interface QuizPaper {
  /** 卷面涉及的全部学科（按出现顺序去重） */
  subjects: string[];
  /** 卷面涉及的全部知识点（归一化后，去重） */
  topics: string[];
  total: number;
  sections: PaperSection[];
  /** 需要印答案的题目（与正文同序；includeAnswers=false 时为空数组） */
  answers: PaperItem[];
  /** 建议限时（分钟；0 = 无法估算） */
  estimatedMinutes: number;
  blankMm: number;
  includeAnswers: boolean;
}

/** 选项下标 → 'A'/'B'…；越界返回空串 */
export function optionLabel(idx: number): string {
  return idx >= 0 && idx < OPTION_LABELS.length ? OPTION_LABELS[idx] : '';
}

/**
 * 知识点归一化：剥掉括号里的年级等提示（与面板展示口径一致），空值兜底「综合」。
 */
export function normalizeTopic(topic: string): string {
  const t = (topic || '').replace(/[（(].*?[）)]/g, '').trim();
  return t || '综合';
}

/** 正确答案文本：选择 → 'A'；填空 → 多家答案用「或」连接（展示层再本地化）；无答案 → '' */
export function correctTextOf(e: QuizHistoryEntry): string {
  if (e.type === 'fill') return (e.fillAnswers ?? []).filter((x) => x && x.trim()).join(' / ');
  if (typeof e.answerIdx === 'number' && e.answerIdx >= 0) return optionLabel(e.answerIdx);
  return '';
}

/** 学生错答文本：超时/未答 → ''；其余取选项下标或填空原文 */
export function wrongTextOf(e: QuizHistoryEntry): string {
  if (e.timedOut) return '';
  if (e.type === 'fill') return (e.userAnswer ?? '').trim();
  return typeof e.pickedIdx === 'number' && e.pickedIdx >= 0 ? optionLabel(e.pickedIdx) : '';
}

/** 单题限时估算（秒）：优先真实限时，否则按题型给默认值 */
export function estimateSeconds(e: QuizHistoryEntry): number {
  if (typeof e.timeLimit === 'number' && e.timeLimit > 0) return e.timeLimit;
  return e.type === 'fill' ? 90 : 60;
}

/**
 * 组卷。
 *
 * @param entries 待编入的错题（调用方负责筛选，例如「仅错题 + 当前知识点」）
 * @param opts    选项（答案 / 留白 / 排序）
 * @param sourceOf 可选：把记录里的来源路径解析为实验名（展示层传入，保持本模块无依赖）
 */
export function buildQuizPaper(
  entries: QuizHistoryEntry[],
  opts: PaperOptions = {},
  sourceOf?: (path: string) => string,
): QuizPaper {
  const includeAnswers = opts.includeAnswers === true;
  const level: PaperBlankLevel = opts.blankLevel ?? 'standard';
  const sortMode: PaperSortMode = opts.sortMode ?? 'topic';
  const blankMm = BLANK_MM[level] ?? BLANK_MM.standard;

  // 只收录有题干的记录；空题干无法成卷
  const usable = (entries ?? []).filter((e) => e && typeof e.question === 'string' && e.question.trim().length > 0);

  // 组内排序：时间倒序（最近做错的先复习）
  const byTime = [...usable].sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));

  // 分节
  let buckets: { topic: string; items: QuizHistoryEntry[] }[];
  if (sortMode === 'time') {
    buckets = [{ topic: '', items: byTime }];
  } else {
    const map = new Map<string, QuizHistoryEntry[]>();
    for (const e of byTime) {
      const key = normalizeTopic(e.topic);
      const arr = map.get(key);
      if (arr) arr.push(e);
      else map.set(key, [e]);
    }
    buckets = [...map.entries()].map(([topic, items]) => ({ topic, items }));
    // 分节顺序：错题多的知识点优先（薄弱点先复习），同数量按最近一次作答时间倒序
    buckets.sort((a, b) => {
      if (b.items.length !== a.items.length) return b.items.length - a.items.length;
      return (b.items[0]?.ts ?? 0) - (a.items[0]?.ts ?? 0);
    });
  }

  let no = 0;
  const sections: PaperSection[] = buckets.map((b) => ({
    topic: b.topic,
    items: b.items.map((e) => {
      no += 1;
      return {
        no,
        topic: normalizeTopic(e.topic),
        subject: e.subject || '',
        type: e.type === 'fill' ? ('fill' as const) : ('choice' as const),
        question: e.question,
        options: Array.isArray(e.options) ? e.options : [],
        answerIdx: typeof e.answerIdx === 'number' ? e.answerIdx : -1,
        fillAnswers: Array.isArray(e.fillAnswers) ? e.fillAnswers : [],
        correctText: correctTextOf(e),
        wrongText: wrongTextOf(e),
        explanation: e.explanation,
        blankMm,
        source: sourceOf ? sourceOf(e.path || '') : '',
        timedOut: e.timedOut === true,
      };
    }),
  }));

  const items = sections.flatMap((s) => s.items);
  const subjects = [...new Set(items.map((i) => i.subject).filter(Boolean))];
  const topics = [...new Set(items.map((i) => i.topic).filter(Boolean))];
  // 建议限时：按题累加后向上取整到 5 分钟
  const rawSeconds = usable.reduce((sum, e) => sum + estimateSeconds(e), 0);
  const estimatedMinutes = rawSeconds > 0 ? Math.ceil(rawSeconds / 60 / 5) * 5 : 0;

  return {
    subjects,
    topics,
    total: items.length,
    sections,
    answers: includeAnswers ? items : [],
    estimatedMinutes,
    blankMm,
    includeAnswers,
  };
}

/**
 * 选项是否可用两列排布（省纸）。
 * 仅选择题、至少 3 项、且「任一项含 LaTeX（$）就一律单列」——
 * 公式宽度由 KaTeX 渲染后决定，两列会横向挤压甚至越界，故含公式一律放单列。
 * 其余选项按去掉公式后的可见长度判断，偏长的同样退回单列。
 */
export function canUseTwoColumnOptions(type: string, options: string[]): boolean {
  if (type !== 'choice' || options.length < 3) return false;
  if (options.some((o) => o.includes('$'))) return false;
  return options.every((o) => o.replace(/\$[^$]*\$/g, '').replace(/\s+/g, '').length <= 12);
}

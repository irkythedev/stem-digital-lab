/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 考考你（Quiz）答题历史 —— 纯浏览器本地持久化（localStorage）。
 * 独立于问答历史（stem-ai-history）：错题集 + 正确率统计的数据底座。
 *
 * 隐私承诺：
 * - 数据仅存用户本机浏览器，不触网、不上传、不中转；
 * - 与 stem-ai-config 同生命周期：用户清除浏览器数据即一并清除；
 * - 容量上限 100 条，超出丢最旧。
 */
export interface QuizHistoryEntry {
  /** 时间戳36进制 + 随机36进制 */
  id: string;
  /** 作答完成时间（ms） */
  ts: number;
  /** 来源页面完整路径（含 query） */
  path: string;
  /** 科目（数学/物理/化学…，页面语言对应） */
  subject: string;
  /** 页面主题（如「凸透镜成像」） */
  topic: string;
  /** 题干（可能含 LaTeX 公式） */
  question: string;
  /** 四个选项 */
  options: string[];
  /** 正确选项下标（0-3；解析失败为 -1） */
  answerIdx: number;
  /** 学生选择的下标（0-3） */
  pickedIdx: number;
  /** 是否答对 */
  correct: boolean;
  /** 题型：choice（四选一）/ fill（填空）；老数据缺省 choice */
  type?: 'choice' | 'fill';
  /** 填空标准答案（可多个等价写法；选择题为空） */
  fillAnswers?: string[];
  /** 学生填空输入（选择题为空字符串） */
  userAnswer?: string;
  /** AI 解析讲解（为什么对/错；旧数据可能没有该字段） */
  explanation?: string;
  /** 每题限时（秒；0/缺省 = 不限时） */
  timeLimit?: number;
  /** 实际作答用时（秒） */
  elapsedMs?: number;
  /** 是否超时判错（超时 = 未答 = 错） */
  timedOut?: boolean;
  /** 所用模型名 */
  model: string;
}

const STORAGE_KEY = 'stem-quiz-history';
/** 记录容量上限：保留最近 100 条，超出丢最旧（与问答历史一致） */
export const QUIZ_HISTORY_LIMIT = 100;

/** 读取记录（损坏/异常一律返回空数组，绝不让数据拖垮面板） */
export function listQuizHistory(): QuizHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? (arr as QuizHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

/** 仅错题（答错或未判分的记录） */
export function wrongQuizHistory(): QuizHistoryEntry[] {
  return listQuizHistory().filter((e) => !e.correct);
}

/** 写入一条作答记录（每次作答完成时调用） */
export function saveQuizHistory(entry: Omit<QuizHistoryEntry, 'id' | 'ts'>): void {
  if (typeof window === 'undefined') return;
  const item: QuizHistoryEntry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    ts: Date.now(),
    ...entry,
  };
  const list = listQuizHistory();
  // 简单去重：同一 id 不重复写入
  const next = [item, ...list.filter((x) => x.id !== item.id)].slice(0, QUIZ_HISTORY_LIMIT);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // QuotaExceededError 等：丢最旧一批（约 1/4）再试一次
    try {
      const retry = next.slice(0, Math.max(1, Math.floor(QUIZ_HISTORY_LIMIT * 0.75)));
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(retry));
    } catch {
      // 仍失败：静默放弃本次写入，不抛到 UI
    }
  }
}

/** 清空全部记录（只清考考你历史，不动配置与问答历史） */
export function clearQuizHistory(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 静默
  }
}

/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * AI 出题练习（Quiz）数据解析：
 * 把 AI 按 buildQuizPrompt 输出的格式化单题解析为结构化对象。
 * 宽容解析：精确 marker 优先，变体回退，最后降级为「原样题目 + 无选项」。
 */

export interface QuizQuestion {
  /** 题干（可能含 LaTeX 公式） */
  question: string;
  /** 四个选项（长度 0-4；解析失败时为空数组） */
  options: string[];
  /** 正确选项下标（0-3；解析失败时为 -1） */
  answerIdx: number;
  /** 解析（为什么对/错） */
  explanation: string;
}

/** 提取连续选项行（A./B./C./D. 或 A、B、… 开头），返回选项数组与消费到的下标 */
function extractOptions(lines: string[], from: number): { options: string[]; next: number } {
  const options: string[] = [];
  let i = from;
  while (i < lines.length && options.length < 4) {
    const line = lines[i].trim();
    const m = line.match(/^([A-Da-d])[.、)．:：]\s*(.*)$/);
    if (m) {
      const idx = m[1].toUpperCase().charCodeAt(0) - 65;
      // 允许跳过缺失的选项字母（如只有 B C D），但仍要尽量对齐 A B C D
      while (options.length < idx) options.push('');
      options.push(m[2].trim());
      i++;
    } else {
      break;
    }
  }
  return { options, next: i };
}

/** 把 AI 原始输出解析为 QuizQuestion（宽容失败降级） */
export function parseQuizQuestion(raw: string): QuizQuestion {
  if (!raw || !raw.trim()) {
    return { question: '', options: [], answerIdx: -1, explanation: '' };
  }
  const text = raw.trim();
  // 按字段名切分（支持中文【】）
  const parts = text.split(/\n(?=【题目】|【答案】|【解析】)/);
  let question = '';
  let answerLetter = '';
  let explanation = '';
  let body = text; // 默认：整段作为题目区（解析失败兜底）

  for (const seg of parts) {
    if (seg.startsWith('【题目】')) {
      question = seg.slice('【题目】'.length).trim();
      body = seg;
    } else if (seg.startsWith('【答案】')) {
      const m = seg.match(/【答案】\s*([A-Da-d])/);
      if (m) answerLetter = m[1].toUpperCase();
    } else if (seg.startsWith('【解析】')) {
      explanation = seg.slice('【解析】'.length).trim();
    }
  }

  // 从 body 提取选项（跳过题干行）
  const bodyLines = body.split('\n');
  const { options, next } = extractOptions(bodyLines, 1);

  // 若 body 内选项不足 4 个，回退到全文本里找（AI 可能把选项和题干混排）
  let opts = options;
  if (opts.length < 4) {
    const { options: o2 } = extractOptions(text.split('\n'), 0);
    if (o2.length > opts.length) opts = o2;
  }

  // 题干里剥离选项行（AI 有时把选项写在题干行内，如 "请问...？A. ... B. ..."）
  const qLines = question.split('\n').filter((l) => !/^[A-Da-d][.、)．:：]/.test(l.trim()));
  question = qLines.join('\n').trim();

  const answerIdx = answerLetter ? answerLetter.charCodeAt(0) - 65 : -1;

  return {
    question: question || text.slice(0, 200),
    options: opts.slice(0, 4),
    answerIdx: answerIdx >= 0 && answerIdx < 4 ? answerIdx : -1,
    explanation,
  };
}

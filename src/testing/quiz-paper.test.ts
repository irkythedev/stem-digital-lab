/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 错题卷组卷守卫（注册模块，不含执行入口）。
 *
 * 迁移来源：`src/smoke.test.ts` 的 `错题卷组卷（buildQuizPaper）` 套件，**整组 13 个用例一次迁出**。
 * 用例名、断言、错误消息与执行顺序与迁移前逐字相同；本套件零文件读取、零 DOM、零 async，
 * 除入口登记外无任何改写。
 *
 * 依赖特征：纯逻辑，只调 `buildQuizPaper` 与排版判定函数。
 *
 * 本模块不导入 smoke.test.ts，也不导入 harness 的具体实现，只接收注入的测试注册函数。
 */
import assert from 'node:assert';
import type { TestFn } from './harness';
import type { QuizHistoryEntry } from '../lib/quiz-history';
import {
  BLANK_MM, buildQuizPaper, canUseTwoColumnOptions, correctTextOf, estimateSeconds, normalizeTopic, optionLabel,
  wrongTextOf, type PaperBlankLevel,
} from '../lib/quiz-paper';

export function registerQuizPaperTests(test: TestFn): void {
  const E = (over: Partial<QuizHistoryEntry>): QuizHistoryEntry => ({
    id: 'x', ts: 1000, path: '/lab/ohm', subject: '物理', topic: '欧姆定律',
    question: '题干', options: ['甲', '乙', '丙', '丁'], answerIdx: 1, pickedIdx: 2,
    correct: false, model: 'm', ...over,
  });

  test('选项排布：含公式一律单列，短文本选项才两列', () => {
    assert.equal(canUseTwoColumnOptions('choice', ['甲', '乙', '丙']), true, '短文本选择题可两列省纸');
    assert.equal(canUseTwoColumnOptions('choice', ['甲', '乙']), false, '不足 3 项不分组');
    assert.equal(canUseTwoColumnOptions('fill', ['甲', '乙', '丙']), false, '非选择题不分组');
    assert.equal(
      canUseTwoColumnOptions('choice', ['$y=ax^{2}+bx+c$', '乙', '丙']),
      false,
      '含 LaTeX 一律单列：公式宽度由 KaTeX 渲染后决定，两列会横向挤压甚至越界',
    );
    assert.equal(
      canUseTwoColumnOptions('choice', ['甲', '乙', '丙', '这是一段明显偏长的选项文本']),
      false,
      '偏长选项退回单列',
    );
  });

  test('选择题：正确答案为选项字母、错答为学生所选字母', () => {
    const paper = buildQuizPaper([E({ answerIdx: 1, pickedIdx: 3 })]);
    assert.equal(paper.sections[0].items[0].correctText, 'B');
    assert.equal(paper.sections[0].items[0].wrongText, 'D');
  });

  test('填空题：多家答案顺序连接，错答为原文；超时不展示错答', () => {
    assert.equal(correctTextOf(E({ type: 'fill', fillAnswers: ['0.6A', '0.60A'] })), '0.6A / 0.60A');
    assert.equal(wrongTextOf(E({ type: 'fill', userAnswer: '0.5A' })), '0.5A');
    assert.equal(wrongTextOf(E({ type: 'fill', userAnswer: '0.5A', timedOut: true })), '', '超时未答不得展示错答');
    assert.equal(wrongTextOf(E({ type: 'fill', userAnswer: '' })), '');
  });

  test('无标准答案（answerIdx=-1 或缺失）不产出正确答案文本', () => {
    assert.equal(correctTextOf(E({ answerIdx: -1 })), '');
    assert.equal(correctTextOf(E({ answerIdx: undefined as unknown as number })), '');
    assert.equal(optionLabel(4), 'E', '标签表覆盖 A–F，下标 4 是合法项');
    assert.equal(optionLabel(6), '', '下标 6 已越出标签表，不得产出标签');
    assert.equal(optionLabel(-1), '');
  });

  test('按知识点分组：同组归并，组间按错题数降序（薄弱点优先）', () => {
    const paper = buildQuizPaper([
      E({ topic: '欧姆定律' }), E({ topic: '欧姆定律' }), E({ topic: '欧姆定律' }),
      E({ topic: '凸透镜成像' }), E({ topic: '凸透镜成像' }),
      E({ topic: '质量守恒' }),
    ]);
    assert.deepEqual(paper.sections.map((s) => s.topic), ['欧姆定律', '凸透镜成像', '质量守恒']);
    assert.deepEqual(paper.sections.map((s) => s.items.length), [3, 2, 1]);
  });

  test('题号跨分节连续，且与分节展平顺序一致', () => {
    const paper = buildQuizPaper([E({ topic: 'B' }), E({ topic: 'A' }), E({ topic: 'A' })]);
    const flat = paper.sections.flatMap((s) => s.items);
    assert.deepEqual(flat.map((i) => i.no), [1, 2, 3]);
    assert.equal(paper.total, 3);
    assert.equal(flat.length, paper.total);
  });

  test('time 模式：只有单节且不设小节标题', () => {
    const paper = buildQuizPaper([E({ topic: 'A' }), E({ topic: 'B' })], { sortMode: 'time' });
    assert.equal(paper.sections.length, 1);
    assert.equal(paper.sections[0].topic, '');
    assert.deepEqual(paper.sections[0].items.map((i) => i.no), [1, 2]);
  });

  test('演算留白档位：compact 0 / standard 20 / roomy 35（每道题都带）', () => {
    for (const [lv, mm] of Object.entries(BLANK_MM)) {
      const paper = buildQuizPaper([E({}), E({})], { blankLevel: lv as PaperBlankLevel });
      assert.equal(paper.blankMm, mm, `${lv} 应为 ${mm}mm`);
      assert.ok(paper.sections[0].items.every((i) => i.blankMm === mm));
    }
    assert.equal(buildQuizPaper([E({})]).blankMm, 20, '默认应为标准 20mm');
  });

  test('答案开关：关闭时答案集为空，开启时与正文同序同数', () => {
    const off = buildQuizPaper([E({}), E({ topic: '另一个' })]);
    assert.deepEqual(off.answers, [], '默认不出答案');
    assert.equal(off.includeAnswers, false);
    const on = buildQuizPaper([E({}), E({ topic: '另一个' })], { includeAnswers: true });
    assert.equal(on.answers.length, on.total);
    assert.deepEqual(on.answers.map((i) => i.no), on.sections.flatMap((s) => s.items).map((i) => i.no));
  });

  test('空记录与空题干：不抛错且 total 为 0', () => {
    for (const input of [[], [E({ question: '' })], [E({ question: '   ' })]]) {
      const paper = buildQuizPaper(input);
      assert.equal(paper.total, 0);
      assert.deepEqual(paper.sections, []);
      assert.equal(paper.estimatedMinutes, 0);
    }
  });

  test('建议限时：优先真实限时，否则按题型默认，向上取整到 5 分钟', () => {
    assert.equal(estimateSeconds(E({})), 60, '选择题默认 60s');
    assert.equal(estimateSeconds(E({ type: 'fill' })), 90, '填空默认 90s');
    assert.equal(estimateSeconds(E({ timeLimit: 150 })), 150, '有真实限时则优先');
    // 3 题各 60s = 180s = 3min → 向上取整到 5
    assert.equal(buildQuizPaper([E({}), E({}), E({})]).estimatedMinutes, 5);
    // 5 题各 60s = 300s = 5min → 恰好 5
    assert.equal(buildQuizPaper([E({}), E({}), E({}), E({}), E({})]).estimatedMinutes, 5);
  });

  test('知识点归一化：剥除括号提示，空值兜底「综合」', () => {
    assert.equal(normalizeTopic('欧姆定律（8-9 年级）'), '欧姆定律');
    assert.equal(normalizeTopic('凸透镜成像(实验)'), '凸透镜成像');
    assert.equal(normalizeTopic(''), '综合');
    assert.equal(normalizeTopic('   '), '综合');
    // 分节也走同一归一化，避免同一知识点被拆成两节
    const paper = buildQuizPaper([E({ topic: '欧姆定律' }), E({ topic: '欧姆定律（8-9 年级）' })]);
    assert.equal(paper.sections.length, 1);
    assert.equal(paper.sections[0].items.length, 2);
  });

  test('溯源：sourceOf 解析器为每题补上实验名', () => {
    const paper = buildQuizPaper(
      [E({ path: '/lab/ohm' }), E({ path: '/lab/unknown' })],
      {},
      (path) => (path === '/lab/ohm' ? '欧姆定律实验' : ''),
    );
    const flat = paper.sections.flatMap((s) => s.items);
    assert.equal(flat[0].source, '欧姆定律实验');
    assert.equal(flat[1].source, '');
  });
}

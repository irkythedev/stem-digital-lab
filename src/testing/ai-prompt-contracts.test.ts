/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * AI 提示词契约与出题容错守卫（注册模块，不含执行入口）。
 *
 * 迁移来源：`src/smoke.test.ts` 的 `AI prompt contracts` 套件，**整组 20 个用例一次迁出**。
 * 用例名、断言、正则、错误消息、循环边界与执行顺序与迁移前逐字相同；本套件零文件读取、
 * 零 DOM、零 async，因此除「把 smoke 里同名的两个辅助常量搬过来」外无任何改写。
 *
 * 随块搬迁的两个辅助定义（原本就在 smoke 文件级、仅本套件使用，块外零引用，代码逐字照搬）：
 *   - `Q()`：构造一条最小 `QuizQuestion` 的工厂；
 *   - `RAW_OK`：一份带结束哨兵的完整出题输出样本。
 *
 * 为什么它们不能留在 smoke：整组迁走后 smoke 里再无使用者，留着就是死代码。
 *
 * 本模块不导入 smoke.test.ts，也不导入 harness 的具体实现，只接收注入的 `test`。
 */
import assert from 'node:assert';
import type { TestFn } from './harness';
import {
  PROMPT_VERSION, QUIZ_SENTINEL, buildFillJudgePrompt, buildQuizPrompt, buildSystemPrompt,
} from '../lib/ai-config';
import {
  dedupeQuizQuestions, parseJudgeVerdict, parseQuizBatchChecked, shuffleOptions, type QuizQuestion,
} from '../lib/ai-quiz';
import {
  clearLabState, formatLabState, getDynamicQuestions, getLabState, labIdFromPath, setLabState, stageLabel,
} from '../lib/ai-dynamic-questions';

export function registerAiPromptContractsTests(test: TestFn): void {
  /** 构造一条最小可用的题目（原 smoke 文件级助手，仅本套件使用）。 */
  const Q = (over: Partial<QuizQuestion> = {}): QuizQuestion => ({
    question: '题干', options: [], answerIdx: -1, explanation: '', type: 'choice', fillAnswers: [], ...over,
  });

  /** 一份带结束哨兵的完整出题输出（原 smoke 文件级常量，仅本套件使用）。 */
  const RAW_OK = `【第1题】
【类型】单选
【题目】题干一
A. 甲
B. 乙
C. 丙
D. 丁
【答案】B
【解析】略

【第2题】
【类型】单选
【题目】题干二
A. 甲
B. 乙
C. 丙
D. 丁
【答案】C
【解析】略

===END===`;
  test('提示词版本号是显式常量（解析异常日志会带上它）', () => {
    assert.equal(typeof PROMPT_VERSION, 'string');
    assert.ok(PROMPT_VERSION.length > 0);
    assert.equal(QUIZ_SENTINEL, '===END===');
  });

  test('答疑提示词：带阶段、禁反问、禁承诺、追问契约在系统侧、资料进标签槽', () => {
    const zh = buildSystemPrompt('zh', '欧姆定律实验', '页面资料', '预测', true);
    assert.ok(zh.includes('当前阶段：预测'), '应带上实验阶段');
    assert.ok(zh.includes('严禁向学生提问或反问'), '必须禁止反问');
    assert.ok(zh.includes('严禁承诺后续交互'), '必须禁止承诺后续');
    assert.ok(zh.includes('可以继续了解：'), '追问标记必须原样出现在契约里');
    assert.ok(zh.includes('不给最终结论'), '探究型问题不给结论');
    assert.ok(zh.includes('<页面资料>'), '页面资料进标签槽');

    /* ── 读数与实验状态的序列化（v0.40.5 审计修复，并入本用例以守住 405）──
       这一节守三件事，都是「模型拿到就会产生认知幻觉」的硬伤：
       ① 跨学科同名字段不能串味：lens 的 u 是物距(cm)，ohm 的 u 才是电源电压(V)；
       ② TS 内部码不得透传：bulb / chord / fixed / al-cuso4 / 方案下标，一律翻成自然语言；
       ③ 实时读数必须独立成槽，且与「参考资料」的权威级分开。 */

    // ① 分域：lens 的 u/f/v 是物距/焦距/像距，单位 cm，绝不能出现「电源电压」
    const lensZh = formatLabState('lens', { stage: 'explore', u: 20, f: 10, v: 20 }, 'zh');
    assert.ok(lensZh.includes('物距 20cm'), `lens 的 u 须为物距（实测：${lensZh}）`);
    assert.ok(!lensZh.includes('电源电压'), 'lens 没有电源，绝不许可出现「电源电压」');
    assert.ok(lensZh.includes('焦距 10cm') && lensZh.includes('像距 20cm'), 'lens 的 f/v 须为焦距/像距');
    const lensEn = formatLabState('lens', { stage: 'explore', u: 20, f: 10, v: 20 }, 'en');
    assert.ok(lensEn.includes('object distance 20cm'), `lens 英文须为 object distance（实测：${lensEn}）`);
    // 分域不能误伤：ohm 的 u 仍是电源电压（V）
    assert.ok(
      formatLabState('ohm', { stage: 'explore', u: 6, i: 0.6 }, 'zh').includes('电源电压 6V'),
      'ohm 的 u 必须保留「电源电压」口径（分域不得误伤）',
    );

    // ② 枚举码翻译：翻译成界面上的说法，且原码不得出现在输出里
    const enumCases: [string, Record<string, unknown>, string, string][] = [
      ['ohm', { element: 'bulb' }, '小灯泡', 'bulb'],
      ['ohm', { element: 'resistor' }, '定值电阻', 'resistor'],
      ['circle', { circleMode: 'chord' }, '垂径定理', 'chord'],
      ['circle', { circleMode: 'inscribed' }, '圆周角定理', 'inscribed'],
      ['circle', { circleMode: 'thales' }, '直径对直角', 'thales'],
      ['pulley', { type: 'fixed' }, '定滑轮', 'fixed'],
      ['pulley', { type: 'moving' }, '动滑轮', 'moving'],
      ['mass-conservation', { activeScheme: 0 }, '铜与氧气', ''],
      ['mass-conservation', { activeScheme: 1 }, '铁与硫酸铜', ''],
      ['metal-activity', { react: 'al-cuso4' }, '铝与硫酸铜', 'al-cuso4'],
      ['metal-activity', { react: 'cu-agno3' }, '铜与硝酸银', 'cu-agno3'],
    ];
    for (const [lab, st, want, rawCode] of enumCases) {
      const out = formatLabState(lab, { stage: 'explore', ...st }, 'zh');
      assert.ok(out.includes(want), `${lab} ${JSON.stringify(st)} 须翻译为「${want}」（实测：${out}）`);
      if (rawCode) {
        assert.ok(
          !new RegExp(`\\b${rawCode}\\b`).test(out),
          `${lab} 不得把内部码「${rawCode}」原样交给模型（实测：${out}）`,
        );
      }
    }
    // 未登记的内部值：整条丢弃，绝不透传（与 clean() 的「绝不输出半句话」同一条纪律）
    const unknownEnum = formatLabState('circle', { stage: 'explore', circleMode: 'made-up-code' }, 'zh');
    assert.ok(!unknownEnum.includes('made-up-code'), '未登记的内部值须整条丢弃，不得透传');
    assert.ok(unknownEnum.includes('当前阶段：探索'), '丢弃单个字段不得影响其它字段');

    // ③ 英文语境不得漏中文取值（twin 键名曾算成 styleZhEn，取不到值）
    const circEn = formatLabState(
      'circuits',
      { stage: 'explore', styleZh: '串联三灯', styleEn: 'three bulbs in series', i0: 0.25 },
      'en',
    );
    assert.ok(circEn.includes('three bulbs in series'), `英文须取 styleEn（实测：${circEn}）`);
    assert.ok(!/[一-鿿]/.test(circEn), `英文提示词不得出现中文（实测：${circEn}）`);
    const buoyEn = formatLabState('buoyancy', { stage: 'explore', liquidZh: '盐水', liquidEn: 'brine' }, 'en');
    assert.ok(buoyEn.includes('brine') && !/[一-鿿]/.test(buoyEn), `液体英文须取 liquidEn（实测：${buoyEn}）`);

    // ④ 读数独立成槽：静态知识留在 <页面资料>，实时读数进 <当前读数>，两者权威级分开
    const live = formatLabState('ohm', { stage: 'explore', u: 6, i: 0.6, switchOn: true }, 'zh');
    const withReadings = buildSystemPrompt('zh', '欧姆定律实验', '页面知识', '探索', true, live);
    assert.ok(withReadings.includes('<当前读数>'), '实时读数须有独立标签槽 <当前读数>');
    assert.ok(withReadings.includes(live), '读数原文须原样进入 <当前读数>');
    const matStart = withReadings.indexOf('<页面资料>');
    const matEnd = withReadings.indexOf('</页面资料>');
    assert.ok(matStart >= 0 && matEnd > matStart, '<页面资料> 须成对出现');
    const materialBlock = withReadings.slice(matStart, matEnd);
    assert.ok(materialBlock.includes('页面知识'), '静态知识须留在 <页面资料>');
    assert.ok(!materialBlock.includes('当前实验实时状态'), '实时读数不得混在 <页面资料> 里（那会降成「仅供参考」）');
    assert.ok(
      withReadings.indexOf(live) > withReadings.indexOf('<当前读数>'),
      '读数块必须紧跟在 <当前读数> 标签之后',
    );
    // 英文侧同样成对，且用 current_readings
    const enRead = buildSystemPrompt('en', 'Ohm lab', 'page facts', 'explore', true, live);
    assert.ok(enRead.includes('<current_readings>'), '英文读数槽须为 <current_readings>');
    // 没有读数时不得凭空造一个空槽
    const noRead = buildSystemPrompt('zh', '欧姆定律实验', '页面知识', '探索', true);
    assert.ok(!noRead.includes('<当前读数>'), '没有实时读数时不得输出空读数槽');
  });

  test('物理分支判定：显式判定优先，主题串含「物理」作为回退（实验页显示名不含「物理」）', () => {
    // 实验页：显示名是「欧姆定律实验」，必须靠显式判定走物理分支
    assert.ok(buildSystemPrompt('zh', '欧姆定律实验', '', '', true).includes('公式的中文口语读法由朗读功能处理'));
    // 非实验的物理工具页：没有 lab 记录，靠主题串回退
    assert.ok(buildSystemPrompt('zh', '物理公式速查').includes('公式的中文口语读法由朗读功能处理'));
    // 数学实验页：两条都不满足 → 要求补读法
    assert.ok(buildSystemPrompt('zh', '圆的性质实验', '', '', false).includes('补中文口语读法'));
  });

  test('答疑提示词：非物理中文要求补口语读法；无资料时不出现资料块', () => {
    const zh = buildSystemPrompt('zh', '化学元素周期表实验');
    assert.ok(zh.includes('公式首次出现时紧跟一个括号补中文口语读法'));
    assert.ok(!zh.includes('<页面资料>'), '没有资料就不应出现资料块');
  });

  test('英文答疑提示词：禁反问、追问标记、问题进 student_question 标签', () => {
    const en = buildSystemPrompt('en', 'Ohm lab', 'page material', 'predict');
    assert.ok(en.includes('Never ask the student a question'));
    assert.ok(en.includes('You can also explore:'));
    assert.ok(en.includes('<student_question>'));
    assert.ok(en.includes('stage: predict'));
  });

  test('出题提示词：中英都要求输出结束哨兵（解析端据此判截断）', () => {
    const zh = buildQuizPrompt('zh', '欧姆定律实验', '资料', 5, 'basic', 0, 'choice');
    const en = buildQuizPrompt('en', 'Ohm lab', 'material', 5, 'basic', 0, 'choice');
    assert.ok(zh.includes(QUIZ_SENTINEL), '中文出题提示词必须含哨兵');
    assert.ok(en.includes(QUIZ_SENTINEL), '英文出题提示词必须含哨兵');
  });

  test('判分提示词：学生答案进标签槽，输出契约是单个大写字母', () => {
    const zh = buildFillJudgePrompt('zh', '电流是多少', '500 mA', ['0.5A']);
    assert.ok(zh.user.includes('<学生答案>500 mA</学生答案>'));
    assert.ok(zh.system.includes('只输出一个大写字母'));
    assert.ok(zh.system.includes('无法判断时输出 N'));
    const en = buildFillJudgePrompt('en', 'current?', '500 mA', ['0.5A']);
    assert.ok(en.user.includes('<student_answer>500 mA</student_answer>'));
    assert.ok(en.system.includes('Output exactly one capital letter'));
  });

  test('判分结论解析：取第一个 Y/N，不被 Markdown 或标点带偏', () => {
    assert.equal(parseJudgeVerdict('Y'), true);
    assert.equal(parseJudgeVerdict('**Y**'), true, '粗体 Y 必须判对');
    assert.equal(parseJudgeVerdict('"Y"'), true, '带引号的 Y 必须判对');
    assert.equal(parseJudgeVerdict('Y。'), true);
    assert.equal(parseJudgeVerdict(' y '), true);
    assert.equal(parseJudgeVerdict('N'), false);
    assert.equal(parseJudgeVerdict('**N**'), false);
    assert.equal(parseJudgeVerdict(''), false);
    assert.equal(parseJudgeVerdict('抱歉，我无法判断'), false);
  });

  test('出题批量解析：带哨兵的完整输出 = 无需修复', () => {
    const r = parseQuizBatchChecked(RAW_OK, 2);
    assert.equal(r.items.length, 2);
    assert.equal(r.complete, true);
    assert.equal(r.short, false);
    assert.equal(r.reason, '');
  });

  test('出题批量解析：缺哨兵 = 提示末题可能被截断', () => {
    const r = parseQuizBatchChecked(RAW_OK.split(QUIZ_SENTINEL).join(''), 2);
    assert.equal(r.items.length, 2);
    assert.equal(r.complete, false);
    assert.ok(r.reason.includes('结束标记'));
  });

  test('出题批量解析：题数不足 = 提示补齐', () => {
    const one = RAW_OK.split('【第2题】')[0] + '\n' + QUIZ_SENTINEL;
    const r = parseQuizBatchChecked(one, 2);
    assert.equal(r.items.length, 1);
    assert.equal(r.short, true);
    assert.ok(r.reason.includes('2 道'));
  });

  test('出题批量解析：完全解析不出 = 空结果且给出原因', () => {
    const r = parseQuizBatchChecked('模型今天不想出题', 5);
    assert.equal(r.items.length, 0);
    assert.equal(r.reason, '没有解析出任何一道题');
  });

  test('题干去重：同一道题只留一条（修复重试最容易产出重复题）', () => {
    const items = [Q({ question: '同一道题' }), Q({ question: '同一道题' }), Q({ question: '另一道题' })];
    const out = dedupeQuizQuestions(items);
    assert.equal(out.length, 2);
    assert.equal(out[0].question, '同一道题');
    assert.equal(out[1].question, '另一道题');
  });

  test('选项洗牌：选项是原集合的排列，且答案仍指向同一个选项内容', () => {
    const base = Q({ options: ['甲', '乙', '丙', '丁'], answerIdx: 2, explanation: 'x' });
    const seq = [0.9, 0.1, 0.5];
    let k = 0;
    const shuffled = shuffleOptions(base, () => seq[k++ % seq.length]);
    assert.deepEqual([...shuffled.options].sort(), [...base.options].sort(), '洗牌不应增删选项');
    assert.equal(shuffled.options[shuffled.answerIdx], '丙', '答案必须跟着选项一起搬家');
  });

  test('选项洗牌：填空题与非选择题原样返回', () => {
    const fill = Q({ type: 'fill', options: [], answerIdx: -1 });
    assert.equal(shuffleOptions(fill).options.length, 0);
    const broken = Q({ options: ['甲', '乙'], answerIdx: -1 });
    assert.equal(shuffleOptions(broken).answerIdx, -1, '无标准答案不洗牌');
  });

  test('动态问题：欧姆定律用当前读数出题，缺读数则回退静态文案', () => {
    const withReading = getDynamicQuestions('ohm', { u: 6, i: 0.48, element: 'bulb' }, 'zh', '静态问题');
    assert.equal(withReading.length, 2);
    assert.ok(withReading[0].includes('6.00V') && withReading[0].includes('0.48A'), '应插进当前读数');
    assert.ok(withReading[0].includes('灯泡'));
    assert.equal(withReading[1], '静态问题', '静态文案留在末位兜底');
    const missing = getDynamicQuestions('ohm', { u: 6 }, 'zh', '静态问题');
    assert.deepEqual(missing, ['静态问题'], '读数不全时不得输出半句话');
  });

  test('动态问题：凸透镜 u≈f（像距为空）与未注册实验都回退静态文案', () => {
    assert.deepEqual(getDynamicQuestions('lens', { u: 10, f: 10, v: null }, 'zh', '静态'), ['静态']);
    const ok = getDynamicQuestions('lens', { u: 25, f: 10, v: 16.67 }, 'zh', '静态');
    assert.ok(ok[0].includes('25.00cm') && ok[0].includes('16.67cm'));
    assert.deepEqual(getDynamicQuestions('circle', { u: 1 }, 'zh', '静态'), ['静态']);
  });

  test('动态问题：杠杆带平衡状态；英文模板同样成句', () => {
    const bal = getDynamicQuestions('lever', { m1: 2, d1: 3, m2: 3, d2: 2, balanced: true }, 'zh', '静态');
    assert.ok(bal[0].includes('2×3') && bal[0].includes('刚好平衡'));
    const en = getDynamicQuestions('lever', { m1: 2, d1: 3, m2: 3, d2: 2, balanced: false }, 'en', 'static');
    assert.ok(en[0].includes('tilts to the heavier side'));
  });

  test('动态问题：三个试点的输出都不含 undefined / NaN', () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ['ohm', { u: 6, i: 0.6, element: 'resistor' }],
      ['lens', { u: 25, f: 10, v: 16.67 }],
      ['lever', { m1: 2, d1: 3, m2: 3, d2: 2, balanced: false }],
    ];
    for (const [lab, state] of cases) {
      const out = getDynamicQuestions(lab, state, 'zh', '静态')[0];
      assert.ok(!/undefined|NaN/.test(out), lab + ' 输出不应含 undefined/NaN');
    }
  });

  test('实验状态注册表与阶段标签：写入即读、可清除、可从路径取实验 id', () => {
    setLabState('ohm', { stage: 'explore' });
    assert.equal(getLabState('ohm')?.stage, 'explore');
    clearLabState('ohm');
    assert.equal(getLabState('ohm'), undefined);
    assert.equal(labIdFromPath('/lab/ohm?x=1'), 'ohm');
    assert.equal(labIdFromPath('/periodic-table'), '');
    assert.equal(stageLabel('predict', 'zh'), '预测');
    assert.equal(stageLabel('conclude', 'en'), 'conclude');
    assert.equal(stageLabel(undefined, 'zh'), '');
  });
}

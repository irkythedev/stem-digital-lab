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
import type { TestFn } from '../../harness';
import {
  PROMPT_VERSION, LAB_TARGETS, LAB_SUBMODE_TARGETS, resolveLabTarget, EXPLORE_KNOWLEDGE_OVERRIDES, QUIZ_SENTINEL, buildFillJudgePrompt, buildQuizPrompt, buildSystemPrompt,
} from '../../../lib/ai-config';
import {
  dedupeQuizQuestions, parseJudgeVerdict, parseQuizBatchChecked, shuffleOptions, type QuizQuestion,
} from '../../../lib/ai-quiz';
import { formatAiAnswerForClipboard } from '../../../lib/ai-clipboard';
import { labs } from '../../../lib/labs';
import {
  PREDICT_WHITELIST, clearLabState, formatLabState, getDynamicQuestions, getLabState, getPageQuestion, labIdFromPath, labSubmodeOf, setLabState, setPageQuestion, stageLabel,
} from '../../../lib/ai-dynamic-questions';

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
    assert.ok(buildSystemPrompt('zh', '欧姆定律实验', '', '', true).includes('仅在易读错的希腊字母'));
    // 非实验的物理工具页：没有 lab 记录，靠主题串回退
    assert.ok(buildSystemPrompt('zh', '物理公式速查').includes('仅在易读错的希腊字母'));
    // 数学实验页：两条都不满足 → 要求补读法
    assert.ok(buildSystemPrompt('zh', '圆的性质实验', '', '', false).includes('基础代数式与常见方程直接陈述含义'));
  });

  test('答疑提示词：非物理中文要求补口语读法；无资料时不出现资料块', () => {
    const zh = buildSystemPrompt('zh', '化学元素周期表实验');
    assert.ok(zh.includes('化学式与离子符号直接写「中文名 + 化学式」'));
    assert.ok(!zh.includes('<页面资料>'), '没有资料就不应出现资料块');
  });

  test('三科 Prompt 解耦：化学/数学/物理专属规范互不串科，且全局思考限长', () => {
    const chem = buildSystemPrompt('zh', '化学元素周期表实验');
    assert.ok(chem.includes('化合价标在元素或原子团正上方'), '化学 Prompt 缺少化合价正上方规则');
    assert.ok(chem.includes('绝不可把化合价说成标在右上角'), '化学 Prompt 缺少化合价位置纠错');
    assert.ok(chem.includes('离子所带电荷才标在右上角'), '化学 Prompt 缺少离子电荷右上角规则');
    assert.ok(!chem.includes('严禁使用高中导数'), '化学 Prompt 不得串入数学规则');

    const math = buildSystemPrompt('zh', '圆的性质实验');
    assert.ok(math.includes('严禁使用高中导数'), '数学 Prompt 缺少禁导数规则');
    assert.ok(math.includes('集合描述法') && math.includes('区间符号'), '数学 Prompt 缺少禁集合/区间规则');
    assert.ok(!math.includes('化合价标在元素或原子团正上方'), '数学 Prompt 不得串入化学规则');

    const phys = buildSystemPrompt('zh', '欧姆定律实验', '', '', true);
    assert.ok(phys.includes('汉字修饰下标必须用 \\text{...}'), '物理 Prompt 缺少中文下标 \\text{} 规则');
    assert.ok(phys.includes('保持标量计算'), '物理 Prompt 缺少初中标量边界');
    assert.ok(!phys.includes('严禁使用高中导数'), '物理 Prompt 不得串入数学规则');

    for (const p of [chem, math, phys]) {
      assert.ok(p.includes('思考过程仅允许列出核心判据'), '三科均须注入思考限长规则');
      assert.ok(p.includes('三个梯度'), '三科均须注入追问梯度契约');
    }
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

  // ── v2 启发式 Prompt 专项守卫（PREDICT/EXPLORE/CONCLUDE 阶段化）──────────────
  test('v2：预测阶段禁止首句结论，要求先写预测和画布观察', () => {
    const zh = buildSystemPrompt('zh', '欧姆定律实验', '页面知识', '预测', true);
    assert.ok(!zh.includes('① 一句话结论或判断'), 'v2 不得再有结论先行旧句');
    assert.ok(zh.includes('严禁给出最终结论'), '预测阶段须含最终结论禁令');
    assert.ok(zh.includes('请先写下你的预测'), '预测阶段须要求先写预测');
    assert.ok(zh.includes('现象锚定'), '预测首段须为现象锚定');
    assert.ok(zh.includes('预测阶段优先于其它所有规则'), '须有预测阶段最高优先级条款');
  });

  test('v2：探索阶段要求引用读数并给画布可执行验证动作', () => {
    const zh = buildSystemPrompt('zh', '欧姆定律实验', '页面知识', '探索', true);
    assert.ok(zh.includes('你现在在画布上看到的是'), '探索首段须锚定画布现象');
    assert.ok(zh.includes('可立即动手执行的验证动作') || zh.includes('立即动手执行的验证动作'), '探索结尾须给验证动作');
    assert.ok(zh.includes('本页当前读数'), '探索须引用当前读数');
  });

  test('v2：化学新增观察量在 Explore 输出，Predict 自动隐藏结果读数', () => {
    const explore = formatLabState('mass-conservation', {
      stage: 'explore', beforeMass: 100, afterMass: 95, sealed: false, reactionDone: true,
    }, 'zh');
    assert.ok(explore.includes('反应前总质量 100g'), `须输出反应前质量（实测：${explore}）`);
    assert.ok(explore.includes('反应后总质量 95g'), `须输出反应后质量（实测：${explore}）`);
    assert.ok(explore.includes('容器密封：敞开'), '须输出密封状态');
    assert.ok(explore.includes('反应状态：已反应'), '须输出反应状态');

    const predict = formatLabState('neutralization', {
      stage: 'predict', volume: 20, acidM: 0.1, ph: 7, indicatorColor: 'pink', equivalenceReached: true,
    }, 'zh');
    assert.ok(predict.includes('预测阶段'), 'Predict 须有防剧透标记');
    assert.ok(predict.includes('滴入液体积 20mL'), '预测阶段仍应保留独立自变量');
    assert.ok(!predict.includes('pH 值'), 'Predict 不得泄露 pH 结果');
    assert.ok(!predict.includes('指示剂颜色'), 'Predict 不得泄露指示剂颜色');
    assert.ok(!predict.includes('是否到达等当点'), 'Predict 不得泄露等当点结果');
  });

  test('v2：考考你预测阶段只出前置概念题，禁止泄露目标结论', () => {
    const zh = buildQuizPrompt('zh', '欧姆定律实验', '资料', 3, 'basic', 0, 'choice', 'predict');
    assert.ok(zh.includes('预测阶段'), '预测阶段出题须标注阶段');
    assert.ok(zh.includes('前置基础概念'), '须限定前置基础概念题');
    assert.ok(zh.includes('严禁在题干、选项或【解析】中直接出现'), '须禁止在题干/选项/解析泄题');
    const en = buildQuizPrompt('en', 'Ohm lab', 'material', 3, 'basic', 0, 'choice', 'predict');
    assert.ok(en.includes('Predict') && en.includes('Never put'), '英文须镜像预测阶段约束');
  });

  test('v2：getPageQuestion 按 predict/explore/conclude 返回阶段化问句', () => {
    setPageQuestion('mass-conservation', '反应前后质量如何变化？');
    setLabState('mass-conservation', { stage: 'predict' });
    assert.ok(getPageQuestion('mass-conservation').includes('我正在做预测'), 'predict 须加预测前缀');
    assert.ok(getPageQuestion('mass-conservation').includes('线索'), 'predict 须要观察线索');
    setLabState('mass-conservation', { stage: 'explore' });
    assert.ok(getPageQuestion('mass-conservation').includes('我正在探索'), 'explore 须加探索前缀');
    assert.ok(getPageQuestion('mass-conservation').includes('比较哪两个量'), 'explore 须引导比较读数');
    setLabState('mass-conservation', { stage: 'conclude' });
    assert.ok(getPageQuestion('mass-conservation').includes('我正在结论阶段'), 'conclude 须加结论前缀');
    assert.ok(getPageQuestion('mass-conservation').includes('证据链'), 'conclude 须引导证据链归纳');
    clearLabState('mass-conservation');
  });

  test('v2：公式书写规范——分式必须用 LaTeX \\frac，禁止斜杠文本', () => {
    const zh = buildSystemPrompt('zh');
    assert.ok(zh.includes('分式必须用 LaTeX \\frac{分子}{分母}'), '中文须要求分式用 LaTeX \\frac');
    assert.ok(zh.includes('禁止写成 b/2a、(b)/(2a)、-b/2a'), '中文须禁止斜杠分式');
    assert.ok(zh.includes('x=-\\frac{1}{2}'), '中文须给出规范分式示例');
    const en = buildSystemPrompt('en');
    assert.ok(en.includes('Fractions must use LaTeX \\frac'), '英文须要求分式用 LaTeX \\frac');
    assert.ok(en.includes('never write b/2a'), '英文须禁止斜杠分式');
  });

  test('v2：Predict 白名单覆盖数学/物理，不泄露顶点、pi、比值、电流、像距', () => {
    const cases: Array<[string, Record<string, unknown>, string[], string[]]> = [
      ['quadratic', { stage: 'predict', a: -2, b: 0, c: 3, vertexH: 0, vertexK: 3, revealed: false },
        ['a 值 -2'], ['顶点横坐标', '顶点纵坐标']],
      ['polygon-pi', { stage: 'predict', n: 6, showOuter: true, piLo: 3.0, piHi: 3.2 },
        ['正多边形边数 6'], ['内接 π 估计', '外切 π 估计']],
      ['similarity', { stage: 'predict', k: 2, perimeterRatio: 2, areaRatio: 4 },
        ['k 值 2'], ['实测周长比', '实测面积比']],
      ['ohm', { stage: 'predict', u: 6, r: 10, element: 'resistor', rp: 0, switchOn: true, i: 0.6, elemVoltage: 6 },
        ['电源电压 6V'], ['电流读数', '元件两端电压']],
      ['lens', { stage: 'predict', u: 25, f: 10, v: 16.67 },
        ['物距 25cm'], ['像距']],
    ];
    for (const [lab, state, must, forbidden] of cases) {
      const out = formatLabState(lab, state, 'zh');
      for (const s of must) assert.ok(out.includes(s), `${lab} Predict 应保留自变量「${s}」（实测：${out}）`);
      for (const s of forbidden) assert.ok(!out.includes(s), `${lab} Predict 不得泄露结果「${s}」（实测：${out}）`);
    }
    // 未知实验在 Predict 下只给阶段标记，不给任何字段
    const unknown = formatLabState('not-a-lab', { stage: 'predict', i: 9, v: 8 }, 'zh');
    assert.ok(!unknown.includes('电流') && !unknown.includes('像距'), '未知实验 Predict 不得输出任何字段');
  });

  test('v2：Predict 下 getPageQuestion 不复用动态读数问句', () => {
    setPageQuestion('ohm', '<当前读数>电压 6.00V，电流 0.48A</当前读数>为什么电流会变化？');
    setLabState('ohm', { stage: 'predict' });
    const q = getPageQuestion('ohm');
    assert.ok(q.includes('我正在做预测') && q.includes('线索'), '须返回预测引导');
    assert.ok(!q.includes('6.00V') && !q.includes('0.48A'), `预测提问不得携带读数（实测：${q}）`);
    assert.ok(!q.includes('<当前读数>'), '预测提问不得残留读数标签');
    clearLabState('ohm');
  });

  test('v2.1：问题相关性 A/B/C 与 labId 目标块注入正确', () => {
    const zh = buildSystemPrompt('zh', '相似与位似实验', '', '探索', false, undefined, undefined, 'math', 'similarity');
    assert.ok(zh.includes('A. 直接相关'), '须有 A 类直接相关');
    assert.ok(zh.includes('B. 基础相关'), '须有 B 类基础相关');
    assert.ok(zh.includes('C. 无关通用'), '须有 C 类无关通用');
    assert.ok(zh.includes('【七、本页探究目标】'), '须注入本页探究目标块');
    assert.ok(zh.includes('位似比'), '相似页目标须提及位似比');
    assert.ok(!zh.includes('<当前读数>'), '无读数时目标块不得虚标读数标签');

    const chem = buildSystemPrompt('zh', '酸碱中和实验', '', '探索', false, undefined, undefined, 'chemistry', 'neutralization');
    assert.ok(chem.includes('中和反应'), '中和页目标须提及中和反应');
    assert.ok(!chem.includes('二次函数'), '不得串入其它实验目标');

    const withRead = buildSystemPrompt('zh', '二次函数实验', '页面知识', '探索', false, '【当前读数】a=-2', undefined, 'math', 'quadratic');
    assert.ok(withRead.includes('C 类无关通用问题不得引用'), 'readingsBlock 须明确 C 类不引用读数');
  });

  test('v2.1：剪贴板清洗必须剔除 think/reasoning 内容', () => {
    const clean = formatAiAnswerForClipboard('前言<think>隐藏推理</think>正文<reasoning>内部草稿</reasoning>\n可以继续了解：\n1. 追问');
    assert.equal(clean, '前言正文', 'think/reasoning 与追问段都不得进入剪贴板');
    assert.ok(!clean.includes('隐藏推理') && !clean.includes('内部草稿'), '剪贴板不得残留内部推理');
  });

  test('v2.3：真实 aiKnowledge 的阶段隔离（Explore 安全，Conclude 完整）', () => {
    const qlab = labs.find((x) => x.id === 'quadratic')!;
    const qKnowledge = `二次函数实验（人教版）：${qlab.description.zh}。\n${qlab.aiKnowledge}`;
    const qExplore = buildSystemPrompt('zh', '二次函数实验', qKnowledge, '探索', false, undefined, undefined, 'math', 'quadratic');
    assert.ok(!qExplore.includes('a 决定开口方向'), 'Quadratic Explore 不得注入 a 目标规律');
    assert.ok(!qExplore.includes('b 影响对称轴位置'), 'Quadratic Explore 不得注入 b 目标规律');
    assert.ok(!qExplore.includes('c 决定与 y 轴交点'), 'Quadratic Explore 不得注入 c 目标规律');
    assert.ok(qExplore.includes('观察开口朝向'), 'Quadratic Explore 仍须保留安全观察说明');
    const qConclude = buildSystemPrompt('zh', '二次函数实验', qKnowledge, '结论', false, undefined, undefined, 'math', 'quadratic');
    assert.ok(qConclude.includes('a 决定开口方向'), 'Quadratic Conclude 必须保留完整知识');

    const blab = labs.find((x) => x.id === 'buoyancy')!;
    const bKnowledge = `浮力实验（苏科版）：${blab.description.zh}。\n${blab.aiKnowledge}`;
    const bExplore = buildSystemPrompt('zh', '浮力实验', bKnowledge, '探索', true, undefined, undefined, 'physics', 'buoyancy');
    assert.ok(!bExplore.includes('完全浸没后排开体积不变'), 'Buoyancy Explore 不得注入目标规律');
    assert.ok(bExplore.includes('弹簧测力计'), 'Buoyancy Explore 仍须保留称重法背景');
    const bConclude = buildSystemPrompt('zh', '浮力实验', bKnowledge, '结论', true, undefined, undefined, 'physics', 'buoyancy');
    assert.ok(bConclude.includes('完全浸没后排开体积不变'), 'Buoyancy Conclude 必须保留完整知识');

    // 其他含目标公式的 aiKnowledge 也须在 Explore 被阶段清洗
    for (const id of ['ohm', 'lever', 'pressure']) {
      const l = labs.find((x) => x.id === id)!;
      const k = `${l.name.zh}实验：${l.description.zh}。\n${l.aiKnowledge}`;
      const p = buildSystemPrompt('zh', `${l.name.zh}实验`, k, '探索', l.subjectId === 'physics', undefined, undefined, l.subjectId, id);
      const target = { ohm: 'I=U/R', lever: 'F₁l₁=F₂l₂', pressure: 'p=F/S' }[id]!;
      assert.ok(!p.includes(target), `${id} Explore 不得注入目标公式 ${target}`);
    }
  });

  test('v2.4：20 实验注册全覆盖，Predict 阶段同样脱敏，PROMPT_VERSION 升级', () => {
    assert.equal(PROMPT_VERSION, '2026.11.v3', 'PROMPT_VERSION 必须升级到 v3');
    const ids = labs.map((l) => l.id);
    assert.equal(ids.length, 20, 'labs 必须覆盖 20 个实验');
    for (const id of ids) {
      assert.ok(LAB_TARGETS[id], `${id} 缺 LAB_TARGETS`);
      assert.ok(EXPLORE_KNOWLEDGE_OVERRIDES[id], `${id} 缺 EXPLORE_KNOWLEDGE_OVERRIDES`);
      assert.ok(PREDICT_WHITELIST[id], `${id} 缺 PREDICT_WHITELIST`);
    }
    const qlab = labs.find((l) => l.id === 'quadratic')!;
    const knowledge = `二次函数实验（人教版）：${qlab.description.zh}。\n${qlab.aiKnowledge}`;
    for (const stage of ['预测', 'predict']) {
      const p = buildSystemPrompt('zh', '二次函数实验', knowledge, stage, false, undefined, undefined, 'math', 'quadratic');
      assert.ok(!p.includes('a 决定开口方向'), `${stage} 不得注入 a 目标规律`);
      assert.ok(!p.includes('b 影响对称轴位置'), `${stage} 不得注入 b 目标规律`);
      assert.ok(!p.includes('c 决定与 y 轴交点'), `${stage} 不得注入 c 目标规律`);
      assert.ok(!p.includes('4ac-b^2'), `${stage} 不得注入顶点公式`);
      assert.ok(p.includes('观察开口朝向'), `${stage} 仍须保留安全观察说明`);
    }
  });

  test('v2.5：子模式探究目标——circle 按定理、construction 按关卡精确到当前模式', () => {
    // 两个多模式实验都必须有子模式条目，且每个子模式键可被 resolveLabTarget 命中
    for (const mode of ['chord', 'inscribed', 'thales']) {
      assert.ok(LAB_SUBMODE_TARGETS.circle?.[mode], `circle 缺子模式目标 ${mode}`);
      assert.ok(resolveLabTarget('circle', mode)?.zh.includes(
        mode === 'chord' ? '垂径定理' : mode === 'inscribed' ? '圆周角定理' : '直径',
      ), `circle/${mode} 子模式目标须对应本定理`);
    }
    for (const [idx, id] of [['0', 'perp-bisector'], ['1', 'midpoint'], ['2', 'angle-bisector'], ['3', 'perp-through']] as const) {
      assert.ok(LAB_SUBMODE_TARGETS.construction?.[id], `construction 缺子模式目标 ${id}`);
      assert.ok(resolveLabTarget('construction', idx), `construction 关卡 ${idx} 须可解析`);
    }
    // Explore 提示词：子模式命中时只注入本模式目标，整页宽目标不得出现
    const pChord = buildSystemPrompt('zh', '圆的性质实验', '页面知识', '探索', false, undefined, undefined, 'math', 'circle', 'chord');
    assert.ok(pChord.includes('垂径定理：垂直于弦的直径平分'), 'circle/chord 须注入垂径子模式目标');
    assert.ok(!pChord.includes('圆周角定理、圆周角与直径所对圆周角'), 'circle/chord 不得再注入整页宽目标');
    // 未命中子模式（未登记 / 非法值）回退整页条目——新增模式默认安全
    assert.equal(resolveLabTarget('circle', 'unknown'), LAB_TARGETS.circle, '未知子模式须回退整页目标');
    assert.equal(resolveLabTarget('circle'), LAB_TARGETS.circle, '无子模式须回退整页目标');
    assert.equal(labSubmodeOf('circle', { stage: 'explore' }), undefined, 'circleMode 缺失须安全返回 undefined');
    assert.equal(labSubmodeOf('construction', { stage: 'explore', task: 2 }), 'angle-bisector', 'construction 关卡序号须映射为 id');
    assert.equal(labSubmodeOf('ohm', { stage: 'explore' }), undefined, '无子模式的实验须返回 undefined');
  });

  test('v2.5：inverse 与 circuit-bench 目标补齐——k 的几何意义带 |k| 与增减性象限前提', () => {
    const inv = LAB_TARGETS.inverse;
    assert.ok(inv.zh.includes('|k|') && inv.zh.includes('增减性'), 'inverse 目标须含 |k| 几何意义与增减性');
    assert.ok(inv.zh.includes('象限') || inv.zh.includes('k>0'), 'inverse 增减性须带象限/符号前提');
    const bench = LAB_TARGETS['circuit-bench'];
    assert.ok(bench.zh.includes('串联分压') && bench.zh.includes('并联分流'), 'circuit-bench 目标须含分压分流规律');
    assert.ok(bench.zh.includes('P=UI'), 'circuit-bench 目标须含电功率');
    const pInv = buildSystemPrompt('zh', '反比例函数实验', '页面知识', '探索', false, undefined, undefined, 'math', 'inverse');
    assert.ok(pInv.includes('|k|'), 'inverse Explore 目标块须注入补齐后的 |k| 描述');
  });

  test('v2.2：Explore 不注入目标公式，Conclude 不注入目标块', () => {
    const mathExplore = buildSystemPrompt('zh', '二次函数实验', '页面知识：二次函数 y=ax²+bx+c；顶点、对称轴、开口与 a/b/c 的关系。', '探索', false, undefined, undefined, 'math', 'quadratic');
    assert.ok(!mathExplore.includes('4ac-b^2'), 'Explore 不得从系统提示注入顶点纵坐标公式');
    assert.ok(!mathExplore.includes('x=-\\frac{b}{2a}'), 'Explore 不得从系统提示注入对称轴公式');
    assert.ok(mathExplore.includes('【七、本页探究目标】'), 'Explore 须保留目标概念块');

    const mathConclude = buildSystemPrompt('zh', '二次函数实验', '页面知识：二次函数 y=ax²+bx+c；顶点、对称轴、开口与 a/b/c 的关系。', '结论', false, undefined, undefined, 'math', 'quadratic');
    assert.ok(!mathConclude.includes('【七、本页探究目标】'), 'Conclude 不应注入 Explore 目标限制块');
    assert.ok(mathConclude.includes('结论阶段'), 'Conclude 须保留结论阶段规则');

    const buoyExplore = buildSystemPrompt('zh', '浮力实验', '页面知识：阿基米德原理。', '探索', true, undefined, undefined, 'physics', 'buoyancy');
    assert.ok(!buoyExplore.includes('F_{\\text{浮}}=\\rho_{\\text{液}}'), 'Explore 不得从系统提示注入浮力目标公式');
    const buoyConclude = buildSystemPrompt('zh', '浮力实验', '页面知识：阿基米德原理。', '结论', true, undefined, undefined, 'physics', 'buoyancy');
    assert.ok(!buoyConclude.includes('【七、本页探究目标】'), '浮力 Conclude 不应注入 Explore 目标块');
  });
}

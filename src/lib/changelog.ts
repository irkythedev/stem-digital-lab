/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 版本历史（面向用户的更新记录，非技术性）。
 * 对外展示用，语言贴近使用者而非开发者。
 */
// 应用版本号（与 package.json 同步维护）
export const APP_VERSION = '1.0.3';

export interface ChangelogEntry {
  version: string;
  date: string;
  zh: string[];
  en: string[];
}

/** 新版本记录在前。 */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.0.3',
    date: '2026-08',
    zh: [
      '欧姆定律参数区更贴合教材伏安法：滑动变阻器作为调压元件，定值电阻或小灯泡作为被测对象',
      '参数滑块随所选元件自动匹配（定值电阻显示 R，小灯泡显示 R₀）',
    ],
    en: [
      'Ohm\'s law parameters now match the textbook voltmeter-ammeter method: the rheostat adjusts voltage while a fixed resistor or bulb is the measured element',
      'Parameter sliders auto-match the selected element (R for resistor, R₀ for bulb)',
    ],
  },
  {
    version: '1.0.2',
    date: '2026-08',
    zh: [
      '欧姆定律加入滑动变阻器：拖动滑片即可改变电流与元件两端电压，更贴近教材的伏安法测电阻实验',
      '修复欧姆定律中小灯泡与导线的连接，电路图显示更准确',
    ],
    en: [
      'Ohm\'s law now includes a rheostat: drag the wiper to change current and the voltage across the element, matching the textbook voltmeter-ammeter method',
      'Fixed the bulb-to-wire connection in Ohm\'s law so the circuit diagram renders accurately',
    ],
  },
  {
    version: '1.0.1',
    date: '2026-08',
    zh: [
      '优化触屏与点击操作：开关、按钮、滑块都更容易点中和拖动',
      '家庭电路的开关、灯泡等元件在平板上操作更跟手',
      '修正若干交互细节，让课堂演示与个人操作更顺滑',
    ],
    en: [
      'Improved touch & tap experience: switches, buttons and sliders are easier to tap and drag',
      'Household-circuit components (switches, bulbs) respond better on tablets',
      'Refined interaction details for smoother classroom demo and personal use',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-08',
    zh: [
      '首发完整版：覆盖数学、物理、化学三大科目共 9 个探究实验',
      '每个实验采用「预测 → 探索 → 结论」三幕式，鼓励先猜想再验证',
      '家庭电路改为真实的交流电逻辑：火线、零线、接地三线清晰呈现',
      '支持中英双语、深浅主题，课堂投影与个人使用都舒适',
      '可安装到手机/电脑桌面（PWA），离线也能用',
      '支持一键分享、二维码分享，方便同学交流',
      '可保存到本机，无需账号、数据不上传',
    ],
    en: [
      'First full release: 9 inquiry labs across Math, Physics and Chemistry',
      'Every lab follows a Predict → Explore → Conclude flow that encourages guessing before verifying',
      'Household circuit now uses real AC logic: live, neutral and earth wires clearly shown',
      'Bilingual (zh/en) and light/dark themes, comfortable for classroom projection and personal use',
      'Installable to your device home screen (PWA) and usable offline',
      'One-tap and QR-code sharing for easy exchange with classmates',
      'Saves locally — no account, no uploads',
    ],
  },
  {
    version: '0.0.0',
    date: '2026-07',
    zh: ['项目起步，搭建数字实验平台基础框架'],
    en: ['Project inception: basic framework of the digital lab platform'],
  },
];

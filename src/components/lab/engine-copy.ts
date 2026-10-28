/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 计算引擎徽标（EngineBadge）的悬停 / 读屏文案 —— 单点配置。
 *
 * 为什么要有这个文件：同一件事（「C++ 核在算 / 回退了 JS」）原本散在四个实验里，
 * 三个老实验各自逐字复制了一份中英文案（共 8 条），工作台另写一份。
 * 文案越像越好，复制越多越会漂：改一处只要漏掉一处，界面就会出现两套口径。
 * 现在四处都从这里取，改一次即全站一致。
 *
 * 三个固定信息槽（缺一即读者会自行脑补最坏情况）：
 *   ① 谁在算（原生 C++ 核 / JS 引擎）
 *   ② 核的职责（公式求值 / 电路求解）
 *   ③ 结果是否受影响（回退不改变结果 —— 学生看到「JS」时唯一会担心的事）
 *
 * 措辞纪律：徽章只显示 `C++` / `JS` 两个字母，因此这里不出现 WebAssembly、
 * Emscripten、TypeScript 等实现细节；CJK 与拉丁字母之间留一个空格，全角括号前
 * 不留半角空格（旧文案的 `TypeScript 线性核 （…）` 就是反例）。
 */

/** 计算核的职责范围：老实验三件套用公式核，工作台用线性求解核 */
export type EngineScope = 'formulas' | 'circuit';

/**
 * 引擎态。历史上有两套写法：老实验用 'js' | 'wasm'，工作台用 'ts' | 'wasm'
 * （它的经手侧叫 TypeScript）。这里一并接受，映射到「原生」与「回退」两态。
 */
export type EngineKind = 'wasm' | 'ts' | 'cpp' | 'js';

type Lang = 'zh' | 'en';

const COPY: Record<EngineScope, { native: Record<Lang, string>; fallback: Record<Lang, string> }> = {
  formulas: {
    native: {
      zh: '公式求值由原生 C++ 计算核接管；与 JS 回退结果一致',
      en: 'Formulas evaluated by native C++ core — identical results to JS fallback',
    },
    fallback: {
      zh: '公式求值使用 JS 引擎（原生核未载入时自动回退）；结果与 C++ 一致',
      en: 'Formulas evaluated in JS (auto-fallback when native core unavailable) — identical results to C++',
    },
  },
  circuit: {
    native: {
      zh: '电路求解由原生 C++ 线性求解核接管；与 JS 回退结果一致',
      en: 'Circuit solved by native C++ linear solver — identical results to JS fallback',
    },
    fallback: {
      zh: '电路求解使用 JS 引擎（原生核未载入时自动回退）；结果与 C++ 一致',
      en: 'Circuit solved in JS (auto-fallback when native core unavailable) — identical results to C++',
    },
  },
};

/** 取引擎徽标的悬停/读屏文案（EngineBadge 把 title 同时用作 aria-label） */
export function getEngineTooltip(kind: EngineKind, scope: EngineScope, lang: Lang): string {
  const native = kind === 'wasm' || kind === 'cpp';
  return COPY[scope][native ? 'native' : 'fallback'][lang];
}

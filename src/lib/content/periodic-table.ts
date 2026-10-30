/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 元素周期表页的 GEO 内容模块。
 *
 * 只被 PeriodicTable 页面引用，JSON 因此只进入该页面的分包，
 * 不随应用主入口下载。
 */
import periodicTableData from '../../../content/tools/periodic-table.json';
import { parseLabContent } from '../lab-content-core';

export const PERIODIC_TABLE_CONTENT = parseLabContent(
  periodicTableData,
  'content/tools/periodic-table.json',
);

/**
 * 答案层的数据表口径说明。
 *
 * 默认文案是凸透镜专用的（会谎称表格来自薄透镜计算核），周期表必须显式覆盖。
 * 客户端阅读页与构建期静态快照共用同一份文案。
 */
export const PERIODIC_TABLE_TABLE_NOTE = {
  zh: '本表由 src/lib/elements.ts 的 118 元素数据生成，相对原子质量采用初中教材取整值，可在元素周期表页逐项核对。',
  en: 'This table is generated from the 118-element data in src/lib/elements.ts using textbook rounded atomic masses and can be checked against the interactive periodic table.',
} as const;

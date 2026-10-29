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

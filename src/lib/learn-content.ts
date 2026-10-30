/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 结构化讲解阅读页（/learn/<id>）的内容懒加载表。
 *
 * 正文从工具页/实验页移出后，JSON 只在阅读页被下载：交互页不再为了
 * 首屏之下的一段长文把整份内容拖进自己的分包。构建期静态化仍由
 * tools/build-static.ts 直接读取 content/ 生成，两条链路共用同一份 JSON。
 */
import type { Bi, LabContent } from './lab-content-core';

export interface LearnContentEntry {
  content: LabContent;
  /** 数据表口径说明；凸透镜沿用 LabAnswerLayer 的默认文案。 */
  tableNote?: Bi;
}

const LOADERS: Record<string, () => Promise<LearnContentEntry>> = {
  lens: () => import('./content/lens').then((m) => ({ content: m.LENS_CONTENT })),
  'periodic-table': () =>
    import('./content/periodic-table').then((m) => ({
      content: m.PERIODIC_TABLE_CONTENT,
      tableNote: m.PERIODIC_TABLE_TABLE_NOTE,
    })),
  'chemistry-formulas': () =>
    import('./content/chemistry-formulas').then((m) => ({
      content: m.CHEMISTRY_FORMULAS_CONTENT,
      tableNote: m.CHEMISTRY_FORMULAS_TABLE_NOTE,
    })),
};

/** 阅读页 id → 返回的交互页路径。 */
export const LEARN_BACK_PATHS: Record<string, string> = {
  lens: '/lab/lens',
  'periodic-table': '/periodic-table',
  'chemistry-formulas': '/chemistry-formulas',
};

/** 返回阅读页的内容加载器；未接入答案层的 id 返回 undefined。 */
export function learnContentLoader(id: string): (() => Promise<LearnContentEntry>) | undefined {
  return LOADERS[id];
}

/** 阅读页的规范路径（绝对地址由调用方拼接站点域名）。 */
export function learnPath(id: string): string {
  return `/learn/${id}`;
}

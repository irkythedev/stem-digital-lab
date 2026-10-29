/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * GEO 内容懒加载表：实验页需要内容时按 id 动态 import 对应模块。
 *
 * 刻意不静态 import 任何 content/*.json：LabPage 被所有实验共用，
 * 静态引用会把全部页面的 JSON 拖进同一个分包。动态 import 后，
 * 每份 JSON 只跟随它所属的页面/实验 chunk。
 */
import type { LabContent } from './lab-content-core';

const LOADERS: Record<string, () => Promise<LabContent>> = {
  lens: () => import('./content/lens').then((m) => m.LENS_CONTENT),
};

/** 返回实验对应的内容加载器；未接入答案层的实验返回 undefined。 */
export function labContentLoader(labId: string): (() => Promise<LabContent>) | undefined {
  return LOADERS[labId];
}

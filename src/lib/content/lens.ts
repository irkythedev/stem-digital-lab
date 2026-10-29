/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 凸透镜成像页的 GEO 内容模块。
 *
 * 只被 Lens 组件（及其 JSON-LD 懒加载器）引用，JSON 因此只进入光学实验的
 * 分包，不会随应用主入口下载。新增实验时按同样方式建一个独立模块即可。
 */
import lensData from '../../../content/labs/lens.json';
import { parseLabContent } from '../lab-content-core';

export const LENS_CONTENT = parseLabContent(lensData, 'content/labs/lens.json');

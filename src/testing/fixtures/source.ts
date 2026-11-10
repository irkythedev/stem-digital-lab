/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 源码守卫的共享读取器。
 *
 * 为什么需要它：22 个守卫文件各自抄了一份
 * `(p, enc = 'utf8') => readFileSync(repoPath(p), enc)`，其中两个还叫 `read`、
 * 一个叫 `readSrc`——同一件事三种名字。收敛后守卫只关心「断言什么」，
 * 不再关心路径基准与编码。
 *
 * 路径基准由 `repoPath()` 提供：从模块位置推导仓库根，不依赖 `process.cwd()`，
 * 且拒绝 `../` 越界（详见 repo-paths.ts）。
 */
import { readFileSync } from 'node:fs';

import assert from 'node:assert';

import { repoPath } from '../repo-paths';

/** 读仓库内源码文件。路径为仓库相对路径，越界由 `repoPath()` 抛错。 */
export const readSrc = (path: string, encoding: BufferEncoding = 'utf8'): string =>
  readFileSync(repoPath(path), encoding);

/**
 * 把多个文件拼成一份「源码全集」。
 *
 * 用于跨文件的纪律守卫：面板拆成 `panels/*` 与 `hooks/*` 之后，只扫主文件会让
 * 守卫静默失效（见 ai-panel-source.ts 的历史说明）。
 */
export const readSources = (files: readonly string[], separator = '\n'): string =>
  files.map((f) => readSrc(f)).join(separator);

/**
 * 断言源码里出现了**全部**给定模式。
 *
 * 一次性列出缺哪几个，而不是让第一条失败就中断——守卫红的时候应该直接告诉你
 * 还差什么，而不是挤牙膏式地重跑。
 *
 * @param patterns `[正则, 缺失时的说明]` 列表
 */
export function expectAllIn(
  src: string,
  patterns: readonly (readonly [RegExp, string])[],
): void {
  const missing = patterns.filter(([re]) => !re.test(src)).map(([, why]) => why);
  assert.deepEqual(missing, [], `源码缺少：\n${missing.map((m) => `  - ${m}`).join('\n')}`);
}

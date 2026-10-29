/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 测试用路径基准：**从本文件自身位置**推导仓库根，不依赖 `process.cwd()`。
 *
 * 为什么需要它：源码守卫用 `readFileSync('src/…')` 读文件，相对路径由 Node 按
 * `process.cwd()` 解析。也就是说，这些守卫隐含「必须在仓库根目录启动」的前提——
 * 从 `/tmp` 或任何别的目录用绝对路径启动入口，就会 `ENOENT`，而失败信息看起来
 * 像「源码丢了」，而不是「工作目录不对」。
 *
 * 本模块的做法与约束：
 *   - 基准取 `import.meta.url`（本项目 `module: ESNext` + tsx，ESM 顶层可用；
 *     `src/smoke.test.ts` 早已用同一手法定位 `src/wasm/stemCore.js`）；
 *   - 从所在目录逐级向上找 `package.json`，找到即为仓库根，**不硬编码任何绝对路径**；
 *   - 找不到就**抛错**，绝不退回 `process.cwd()`、也绝不静默跳过——
 *     「路径解析悄悄降级成 cwd」正是这批守卫最怕的失效方式；
 *   - 不引入任何第三方依赖，只用 `node:fs` / `node:path` / `node:url`。
 */
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 仓库根标志文件：与项目根一致。 */
const MARKER = 'package.json';
/** 向上查找的最大层数，防止符号链接成环时死循环。 */
const MAX_DEPTH = 12;

function findRepoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < MAX_DEPTH; i++) {
    if (existsSync(join(dir, MARKER))) return dir;
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  throw new Error(
    `无法从 ${import.meta.url} 向上找到 ${MARKER}：源码守卫的路径基准解析失败。` +
      '不会退回 process.cwd()，也不会静默跳过——请确认测试文件仍在仓库内。',
  );
}

/** 仓库根绝对路径（模块求值时即确定）。 */
export const REPO_ROOT: string = findRepoRoot();

/**
 * 把仓库相对路径解析为绝对路径，**只做越界校验、不校验存在性**。
 *
 * 越界拒绝（batch-5 补的最小加固）：`../` 与指向仓库外的绝对路径都会被
 * `relative(REPO_ROOT, abs)` 暴露为 `..` 开头，一律抛错。守卫只该读仓库内的
 * 文件，否则「路径写错」会变成「静默读到了仓库外的同名文件」。
 * 指向仓库内的绝对路径仍然放行（`resolve` 对绝对路径原样返回）。
 *
 * 边界判定必须**精确**（repo-paths-boundary-fix）：
 *   - `inside === '..'`            → 仓库根的父目录，越界；
 *   - `inside` 以 `` `..${sep}` `` 开头 → 父目录之下的路径，越界；
 *   - `isAbsolute(inside)`         → 与 REPO_ROOT 不在同一个可比根下（Windows 跨盘符），越界。
 * 不能用 `inside.startsWith('..')`：仓库内合法名 `..fixtures/example.ts` 的 relative
 * 结果同样以 `..` 开头，但它并没有逃逸——旧写法会把这种路径误判成越界（已实测复现）。
 * 分隔符取 `node:path` 的 `sep`，不写死 `/`。
 *
 * `inside === ''`（目标就是仓库根本身）沿用 batch-5 的既有约定：拒绝。
 * 这不是越界，但「守卫只读具体文件、不读目录」的约定保持原样，本次不改变。
 *
 * 反向断言（检验某文件「必须已被删除」，如 `!existsSync('src/components/ai/AiSideTab.tsx')`）
 * 必须用本函数而不是 `repoPath()`：这类调用天生要传一个不存在的路径，走 `repoPath()`
 * 会被存在性校验挡下并报「目标不存在」——与守卫意图正好相反（batch-8 实测复现）。
 */
export function repoTarget(relPath: string): string {
  const abs = resolve(REPO_ROOT, relPath);
  const inside = relative(REPO_ROOT, abs);
  const escapes = inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside);
  if (inside === '' || escapes) {
    throw new Error(`源码守卫路径越界：${relPath} 解析为 ${abs}，不在仓库根 ${REPO_ROOT} 内`);
  }
  return abs;
}

/**
 * 把仓库相对路径解析为绝对路径，并**校验存在性**。
 * 缺失时抛错而不是让 `readFileSync` 抛一个只有绝对路径的 ENOENT——
 * 守卫失败信息必须说清「哪个目标不见了」。
 *
 * 反向断言（要求某文件「必须不存在」）不要用本函数，改用 `repoTarget()`：
 * 否则会被存在性校验挡下，失败消息与守卫意图正好相反（batch-8 实测）。
 */
export function repoPath(relPath: string): string {
  const abs = repoTarget(relPath);
  if (!existsSync(abs)) {
    throw new Error(`源码守卫目标不存在：${relPath}（解析为 ${abs}）`);
  }
  return abs;
}

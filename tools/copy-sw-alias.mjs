#!/usr/bin/env node
/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 版本化 SW（dist/sw-<version>.js）生成后，复制一份为 dist/sw.js。
 * 旧版本（<0.47.9）注册的是 /sw.js，升级时需要从该路径拿到新 SW。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const src = join(root, 'dist', `sw-${version}.js`);
const out = join(root, 'dist', 'sw.js');
if (!existsSync(src)) {
  console.error(`✗ 未找到 ${src}（vite build 未生成版本化 SW）`);
  process.exit(1);
}
writeFileSync(out, readFileSync(src));
console.log(`✓ SW 别名已生成：dist/sw.js ← sw-${version}.js`);

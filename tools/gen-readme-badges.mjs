#!/usr/bin/env node
/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 自托管 README 徽章生成器。
 *
 * 为什么自建：README 顶部原本用 img.shields.io，但 shields.io 在部分网络（含内网/国内）
 * 不可达，徽章图片加载失败、只显示裂图或 alt 文本。把徽章改成仓库内的静态 SVG，内外网
 * 都能正常显示，且不依赖任何第三方服务。
 *
 * 动态项：版本号取自 package.json；测试数取自 tools/run-tests.mjs 落盘的
 * node_modules/.cache/test-stats.json（没有统计时回退读现有 tests.svg，保持稳定）。
 * 输出：public/badges/{license,version,core,frontend,tests}.svg
 *
 * 用法：node tools/gen-readme-badges.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'badges');

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const APP_VERSION = String(pkg.version);

function readTests() {
  try {
    const s = JSON.parse(readFileSync(join(ROOT, 'node_modules', '.cache', 'test-stats.json'), 'utf8'));
    if (Number.isFinite(s.passed)) return s.passed;
  } catch {
    /* 没有统计就跑构建：回退读现有徽章 */
  }
  try {
    const svg = readFileSync(join(OUT_DIR, 'tests.svg'), 'utf8');
    const m = />(\d+)\s+passed</.exec(svg);
    if (m) return Number(m[1]);
  } catch {
    /* 首次生成且无统计：留待下次 */
  }
  return null;
}

const tests = readTests();

/** 统一深炭灰 labelColor（与旧 shields 视觉一致，禁用高饱和撞色）。 */
const LABEL_BG = '#18181b';
const H = 20;
const FS = 11;
const CHAR = 6.7; // Verdana 11px 近似字宽
const PAD = 10;

const badges = [
  { file: 'license.svg', label: 'License', value: 'AGPL-3.0', color: '#2e90fa' },
  { file: 'version.svg', label: 'Version', value: `v${APP_VERSION}`, color: '#52525b' },
  { file: 'core.svg', label: 'Core', value: 'C++17 / WASM', color: '#00599C' },
  { file: 'frontend.svg', label: 'Frontend', value: 'React 19 + TS', color: '#3178C6' },
  ...(tests === null
    ? []
    : [{ file: 'tests.svg', label: 'Tests', value: `${tests} passed`, color: '#16a34a' }]),
];

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
const width = (t) => Math.round(String(t).length * CHAR + PAD);

function svg(b) {
  const lw = width(b.label);
  const vw = width(b.value);
  const W = lw + vw;
  const aria = `${b.label}: ${b.value}`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" role="img" aria-label="${esc(aria)}">\n` +
    `  <title>${esc(aria)}</title>\n` +
    `  <g shape-rendering="crispEdges">\n` +
    `    <rect width="${lw}" height="${H}" fill="${LABEL_BG}"/>\n` +
    `    <rect x="${lw}" width="${vw}" height="${H}" fill="${b.color}"/>\n` +
    `  </g>\n` +
    `  <g fill="#ffffff" text-anchor="middle" font-family="Verdana,Geneva,'DejaVu Sans',sans-serif" font-size="${FS}">\n` +
    `    <text x="${lw / 2}" y="14">${esc(b.label)}</text>\n` +
    `    <text x="${lw + vw / 2}" y="14">${esc(b.value)}</text>\n` +
    `  </g>\n` +
    `</svg>\n`
  );
}

mkdirSync(OUT_DIR, { recursive: true });
for (const b of badges) {
  writeFileSync(join(OUT_DIR, b.file), svg(b), 'utf8');
}
console.log(`✓ 已生成 ${badges.length} 个徽章 → public/badges/（version=${APP_VERSION}${tests === null ? '' : `, tests=${tests}`}）`);

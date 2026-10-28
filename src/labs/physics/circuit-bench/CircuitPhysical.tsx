/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 电学实验台 · 仿真图画法（兼容入口）
 *
 * 实现已迁到 render/physical.tsx，由 render 策略注册表统一分派。
 * 保留这个文件是为了不打断既有 import 路径。
 */
export { PhysicalBody, type PhysicalBodyProps } from './render/physical';

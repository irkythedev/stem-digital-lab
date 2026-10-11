/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 「3D 空间原子模型」的纯几何数学（零依赖）。
 *
 * 与 `atom-shells.ts`（2D 玻尔模型，中考必考画法）并列：本模块只做三维点阵、
 * 轨道倾角、旋转矩阵、透视投影与深度排序，**全部自己算，不引入任何 3D 库**。
 * 纯函数，供 Atom3D 组件与 smoke 测试共用同一实现，避免两处漂移。
 */

/** 各电子层的空间倾角（度，[绕 X, 绕 Y]）：逐层交错成三维电子云；表长即最大层数 */
export const SHELL_TILTS: ReadonlyArray<readonly [number, number]> = [
  [0, 0], [24, -20], [-30, 34], [40, 14], [-16, -38], [32, 26], [-42, 10],
];
/** 每层轨道的采样段数（段越多环越平滑，且逐段参与深度排序） */
export const ORBIT_SAMPLES = 48;
/** 相机距离：透视因子 k = CAMERA_D / (CAMERA_D + z)。取 5 使 |z|≤1 时 k∈[0.83,1.25]——
 *  既读得出景深，又不会把最外层轨道近端放大到出画布（旧值 3.2 会放大 1.455 倍）。 */
export const CAMERA_D = 5;
/** 最大电子层数（教材最多 7 层） */
export const MAX_LAYERS = SHELL_TILTS.length;

/** 最内层轨道半径占最外层的比例：留出中心空腔，让核球簇「克制收拢」在最内层轨道内部 */
const INNER_ORBIT_FRAC = 0.7;
/** 核球簇外包络半径上限：严格 ≤ 最内层轨道半径 × 0.4（与发丝轨道之间留出负空间呼吸） */
export const NUCLEUS_ORBIT_FRAC = 0.4;

/** 核球簇屏幕半径区间（px）与单个核子屏幕半径区间（px） */
export const NUCLEUS_MIN_PX = 16;
export const NUCLEUS_MAX_PX = 22;
export const NUCLEON_MIN_PX = 2.2;
export const NUCLEON_MAX_PX = 3.5;
/** 视觉代表粒子数上限：重元素（A > 90）夹取到 90 个代表粒子，避免密恐与糊成一坨 */
export const VISUAL_COUNT_CAP = 90;

/** 核球簇的目标体积占比：**0.38 是「看得见缝隙」的关键**。
 *  旧实现按 0.857 的密堆积反解半径，投影后小球完全糊成一个实心圆盘（即「实心色块」观感的来源之一）；
 *  降到 0.38 后相邻球之间留出可见间隙，才读得出是离散球簇而非实心块。 */
export const NUCLEON_FILL = 0.38;

/** 中子球本体色（淡暖灰白）。**单一事实源**：3D 核内中子球与元素详情卡的微粒图例小圆点
 *  共用本常量，避免两处手写色值漂移；保持「暖」的语义，不随主题切换跳色。 */
export const NEUTRON_COLOR = '#d8cfc4';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
/** 黄金比小数部分：一维低差异序列，配 cbrt 变换后在球内**体积均匀**分布（不用 Math.random，保证可测可复现） */
const GOLDEN_FRAC = 0.6180339887498949;

export interface Vec3 { x: number; y: number; z: number }

/** 第 i 层轨道半径（世界单位）：自内向外线性外扩，最外层固定 1.0 */
export function orbitRadius(i: number, layers: number): number {
  return layers > 1 ? INNER_ORBIT_FRAC + (i / (layers - 1)) * (1 - INNER_ORBIT_FRAC) : 1.0;
}

/** 核球簇外包络半径（世界单位）：由最内层轨道半径派生，保证 ≤ 其 40% */
export function nucleusRadiusWorld(layers: number): number {
  return NUCLEUS_ORBIT_FRAC * orbitRadius(0, layers);
}

/** 视觉代表粒子数：不超过 A，且夹取到 90 个上限 */
export function visualCount(a: number): number {
  return Math.max(1, Math.min(Math.floor(a), VISUAL_COUNT_CAP));
}

/** 簇拥下限填充率：低于此值会看成「几颗散珠」而非紧密簇拥，此时应收拢核球半径 */
export const MIN_CLUSTER_FILL = 0.22;

/**
 * 由核子数反解「核球屏幕半径」与「单个核子屏幕半径」（px）。
 *
 * 两阶段（这是同时满足「核球 16~22px」与「单球 2.2~3.5px」的关键）：
 *  1. 先取由最内层轨道派生的上限 `orbitLimitPx` 夹到 [16, 22]px，按 `r = R·cbrt(FILL/N)` 求 r，
 *     再把 r 夹进 [2.2, 3.5]px —— 于是**粒子再多，单球也不会小于 2.2px 糊成一片**；
 *  2. 用实际 r 回算填充率：若因「球大粒少」导致填充率低于 `MIN_CLUSTER_FILL`，
 *     则**等比收拢 R（r 不变）**——轻元素不至于变成「大空球里几颗小珠」。
 *
 * 于是：重元素（A≥40）核球稳定落在 16~22px；轻元素核球按 A^(1/3) 收缩但簇拥感一致。
 */
export function nucleonScreenSizes(count: number, orbitLimitPx: number): { nucleusR: number; nucleonR: number } {
  const n = Math.max(1, count);
  let R = Math.max(NUCLEUS_MIN_PX, Math.min(NUCLEUS_MAX_PX, orbitLimitPx));
  const r = Math.max(NUCLEON_MIN_PX, Math.min(NUCLEON_MAX_PX, R * Math.cbrt(NUCLEON_FILL / n)));
  const fill = n * (r / R) ** 3;
  if (fill < MIN_CLUSTER_FILL) R = r / Math.cbrt(MIN_CLUSTER_FILL / n);
  return { nucleusR: R, nucleonR: r };
}

/**
 * 质子/中子分配：在 `0..count-1` 上**等距取样** protonN 个下标。
 *
 * ⚠️ 反回归要点：**绝不能按「前 Z 个为质子」分配**（旧实现的缺陷根因）。
 * 斐波那契点阵的纬度 `y = 1 − (2i+1)/A` 随 i **单调递减**，故前 Z 个点全落在 y>0 的北半球、
 * 其余全在南半球 —— 画出来就是「上半球一色 + 下半球另一色」的**实心半球拼接**。
 * 实测：Cr（A=52,Z=24）质子平均纬度 +0.538 / 中子 −0.462；He 精确 ±0.500。
 * 改为等距取样后相邻下标差 ≥ count/k ≥ 1，既不重号，又沿纬度均匀混开。
 */
export function protonFlags(count: number, protonN: number): boolean[] {
  const flags = new Array<boolean>(Math.max(0, count)).fill(false);
  const k = Math.max(0, Math.min(count, Math.round(protonN)));
  if (k <= 0 || count <= 0) return flags;
  for (let j = 0; j < k; j++) flags[Math.min(count - 1, Math.floor(((j + 0.5) * count) / k))] = true;
  return flags;
}

export interface Nucleon extends Vec3 { proton: boolean }

/**
 * 核内粒子三维坐标集合（离散球簇）。
 * 方向取斐波那契球面（角分布均匀），半径取 `R × cbrt(u)`（u 为低差异序列）——
 * 粒子**铺满整个球体**而非全部浮在球面上，且完全确定（无随机数，可测可复现）。
 */
export function nucleusPoints(a: number, z: number, nucleusR: number): Nucleon[] {
  const count = visualCount(a);
  const dirs = fibonacciSphere(count);
  const protonN = Math.round((count * Math.max(0, z)) / Math.max(1, a));
  const flags = protonFlags(count, protonN);
  return dirs.map((d, i) => {
    const rad = count === 1 ? 0 : nucleusR * Math.cbrt(((i + 1) * GOLDEN_FRAC) % 1);
    return { x: d.x * rad, y: d.y * rad, z: d.z * rad, proton: flags[i] };
  });
}

/**
 * 核内景深系数：以核球**自身**的 z 区间归一化（近端 → 1.0，远端 → 0.66）。
 * 用全局 z 区间会让核内粒子透明度几乎一致，读不出核子之间的前后遮挡。
 * 约定 z 是「离相机的距离」，故近端是 z = −R。
 */
export function nucleonAlpha(z: number, nucleusR: number): number {
  const t = nucleusR > 0 ? (nucleusR - z) / (2 * nucleusR) : 0.5;
  return 0.66 + 0.34 * Math.max(0, Math.min(1, t));
}

/** 斐波那契球面点阵：把 count 个点尽量均匀铺在单位球面上（单点落原点，避免除零）。
 *  ⚠️ 纬度随下标单调，故**取子集时不可按下标顺序截断**（见 protonFlags 的说明）。 */
export function fibonacciSphere(count: number): Vec3[] {
  const n = Math.max(0, Math.floor(count));
  if (n === 0) return [];
  if (n === 1) return [{ x: 0, y: 0, z: 0 }];
  const pts: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * i + 1) / n;                      // -1 → 1 均衡铺开
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const a = i * GOLDEN_ANGLE;
    pts.push({ x: Math.cos(a) * r, y, z: Math.sin(a) * r });
  }
  return pts;
}

/** 绕 X、Y 轴旋转（先 Y 后 X）→ 相机空间坐标 */
export function rotate3(p: Vec3, rotX: number, rotY: number): Vec3 {
  const cy = Math.cos(rotY), sy = Math.sin(rotY);
  const x1 = p.x * cy + p.z * sy, z1 = -p.x * sy + p.z * cy;
  const cx = Math.cos(rotX), sx = Math.sin(rotX);
  return { x: x1, y: p.y * cx - z1 * sx, z: p.y * sx + z1 * cx };
}

/** 轨道上角度 angle 的点：先按该层倾角把 XY 平面圆转成三维环，再叠加全局旋转 */
export function orbitPoint(i: number, angle: number, radius: number, rotX: number, rotY: number): Vec3 {
  const [tx, ty] = SHELL_TILTS[i % SHELL_TILTS.length];
  const local: Vec3 = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, z: 0 };
  return rotate3(rotate3(local, (tx * Math.PI) / 180, (ty * Math.PI) / 180), rotX, rotY);
}

/** 透视投影（近大远小）。**约定：z 是离相机的距离，越大越远**，故 k = d/(d+z) 随 z 递减；
 *  画布 y 轴朝下故取负；返回的 depth 即离相机距离，供画家算法排序。 */
export function project3(p: Vec3, cx: number, cy: number, scale: number) {
  const k = CAMERA_D / (CAMERA_D + p.z);
  return { x: cx + p.x * k * scale, y: cy - p.y * k * scale, k, depth: p.z };
}

/** 画家算法：按离相机距离**从大到小**排序——远的先画（远轨道/远电子 → 核内小球 → 近轨道/近电子） */
export function sortByDepth<T extends { depth: number }>(items: T[]): T[] {
  return items.sort((a, b) => b.depth - a.depth);
}

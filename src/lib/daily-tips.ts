/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 首页「每日科学 · 考点速记」卡片数据：初中数理化核心考点（教材对齐）。
 * 与名言条目合并为统一内容池（见 DailyQuote：名言与考点速记自然混合，无类型切换）。
 * 内容按人教版/苏科版教材表述，每条约 1 句话。
 */
export interface DailyTip {
  subject: 'math' | 'physics' | 'chemistry';
  zh: string;
  en: string;
}

export const DAILY_TIPS: DailyTip[] = [
  { subject: 'physics', zh: '欧姆定律：I = U / R——电阻一定时，电流与导体两端电压成正比。', en: "Ohm's law: I = U / R — with fixed resistance, current is proportional to the voltage across the conductor." },
  { subject: 'physics', zh: '串联分压：串联电路中电阻越大，分得的电压越多（U = IR）。', en: 'Series voltage division: in series, the larger the resistance, the more voltage it takes (U = IR).' },
  { subject: 'physics', zh: '并联分流：干路电流等于各支路电流之和（I₀ = I₁ + I₂）。', en: 'Parallel splitting: the main-line current equals the sum of the branch currents (I₀ = I₁ + I₂).' },
  { subject: 'physics', zh: '凸透镜成像：物距大于 2 倍焦距成倒立缩小实像（照相机）；在焦距与 2 倍焦距之间成倒立放大实像（投影仪）。', en: 'Convex lens: object beyond 2f forms an inverted, reduced real image (camera); between f and 2f forms an inverted, magnified real image (projector).' },
  { subject: 'physics', zh: '浮力：F浮 = ρ液 g V排——浸没后排开液体的体积不变，浮力与深度无关。', en: 'Buoyancy: F = ρ·g·V — once fully submerged, displaced volume is fixed, so buoyancy does not depend on depth.' },
  { subject: 'physics', zh: '杠杆平衡条件：动力 × 动力臂 = 阻力 × 阻力臂（F₁L₁ = F₂L₂）。', en: 'Lever balance: effort × effort arm = load × load arm (F₁L₁ = F₂L₂).' },
  { subject: 'physics', zh: '压强：p = F / S；液体压强 p = ρgh，随深度增加而增大。', en: 'Pressure: p = F / S; liquid pressure p = ρgh grows with depth.' },
  { subject: 'physics', zh: '滑轮：定滑轮不省力但改变用力方向；动滑轮省一半力但不改变方向。', en: 'Pulleys: a fixed pulley changes direction but not effort; a moving pulley halves the effort but does not change direction.' },
  { subject: 'chemistry', zh: '质量守恒定律：化学反应前后，原子的种类、数目、质量都不变。', en: 'Conservation of mass: in a chemical reaction, the kinds, numbers and masses of atoms are unchanged.' },
  { subject: 'chemistry', zh: '金属活动性顺序：排在前面的金属，能把排在后面的金属从它的盐溶液中置换出来。', en: 'Metal activity series: a more active metal displaces a less active one from its salt solution.' },
  { subject: 'chemistry', zh: '酸碱中和反应：酸 + 碱 → 盐 + 水；恰好完全反应时溶液呈中性。', en: 'Neutralization: acid + base → salt + water; at the equivalence point the solution is neutral.' },
  { subject: 'math', zh: '二次函数 y = ax² + bx + c：a > 0 开口向上，a < 0 开口向下。', en: 'Quadratic y = ax² + bx + c: a > 0 opens upward, a < 0 opens downward.' },
  { subject: 'math', zh: '圆周角定理：同弧所对的圆周角等于圆心角的一半。', en: 'Inscribed-angle theorem: an inscribed angle is half the central angle subtending the same arc.' },
  { subject: 'math', zh: '勾股定理：直角三角形两直角边的平方和等于斜边的平方（a² + b² = c²）。', en: 'Pythagorean theorem: in a right triangle, a² + b² = c².' },
  { subject: 'physics', zh: '声音的传播需要介质，真空不能传声；15℃ 空气中声速约为 340 m/s。', en: 'Sound needs a medium — it cannot travel in a vacuum; in 15°C air it travels at about 340 m/s.' },
  { subject: 'physics', zh: '光在同种均匀介质中沿直线传播，小孔成像成倒立实像。', en: 'Light travels in straight lines in a uniform medium; a pinhole forms an inverted real image.' },
  { subject: 'physics', zh: '光的反射定律：反射角等于入射角，反射光线、入射光线与法线在同一平面内。', en: 'Law of reflection: the angle of reflection equals the angle of incidence; all three rays lie in one plane.' },
  { subject: 'physics', zh: '平面镜成像：成正立、等大的虚像，像与物关于镜面对称。', en: 'Plane mirrors form upright, equal-size virtual images; image and object are symmetric about the mirror.' },
  { subject: 'physics', zh: '光的折射：光从空气斜射入水或玻璃中，折射角小于入射角。', en: 'Refraction: light entering water or glass from air bends toward the normal (refraction angle < incidence angle).' },
  { subject: 'physics', zh: '晶体熔化与凝固：晶体有固定熔点（冰为 0℃），熔化吸热、凝固放热。', en: 'Melting and freezing: crystals have a fixed melting point (ice: 0°C); melting absorbs heat, freezing releases it.' },
  { subject: 'physics', zh: '比热容：水的比热容较大，相同质量吸放热本领强，沿海地区昼夜温差小。', en: 'Specific heat: water\'s high specific heat makes coastal areas warm and cool slowly — small daily temperature swings.' },
  { subject: 'physics', zh: '焦耳定律：电流通过导体产生的热量 Q = I²Rt。', en: 'Joule\'s law: heat produced by a current is Q = I²Rt.' },
  { subject: 'chemistry', zh: '空气的组成（体积分数）：氮气约 78%，氧气约 21%，其余为稀有气体、二氧化碳等。', en: 'Air composition (by volume): nitrogen ≈ 78%, oxygen ≈ 21%, the rest noble gases, carbon dioxide and others.' },
  { subject: 'chemistry', zh: '电解水：正极产生氧气、负极产生氢气，体积比约为 1:2。', en: 'Electrolysis of water: oxygen at the anode, hydrogen at the cathode, volume ratio about 1:2.' },
  { subject: 'chemistry', zh: '燃烧的条件：可燃物、与氧气（空气）接触、温度达到着火点，三者缺一不可。', en: 'Combustion needs three conditions: a fuel, contact with oxygen, and reaching the ignition temperature — all three are required.' },
  { subject: 'chemistry', zh: '溶液酸碱性：pH < 7 为酸性，pH = 7 为中性，pH > 7 为碱性。', en: 'Acidity: pH < 7 acidic, pH = 7 neutral, pH > 7 alkaline.' },
  { subject: 'math', zh: '一元二次方程 ax² + bx + c = 0（a≠0）：判别式 b² − 4ac ≥ 0 时有实数根。', en: 'Quadratic equation ax² + bx + c = 0 (a≠0): real roots exist when the discriminant b² − 4ac ≥ 0.' },
  { subject: 'math', zh: '全等三角形的判定：SSS、SAS、ASA、AAS，直角三角形还有 HL。', en: 'Congruent triangles: SSS, SAS, ASA, AAS, and HL for right triangles.' },
  { subject: 'math', zh: '相似三角形：对应角相等、对应边成比例；面积比等于相似比的平方。', en: 'Similar triangles: corresponding angles equal and sides proportional; the area ratio equals the square of the similarity ratio.' },
  { subject: 'math', zh: '弧长与扇形面积：弧长 l = nπr/180，扇形面积 S = nπr²/360。', en: 'Arc length l = nπr/180 and sector area S = nπr²/360 (n in degrees).' },
];
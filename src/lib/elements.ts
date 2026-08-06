/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 元素周期表数据（118 元素）：
 *   n=原子序数, symbol=元素符号, zh=中文名, en=英文名, mass=相对原子质量,
 *   period=周期, group=族, x/y=周期表坐标(18列), cat=类别(metal/nonmetal/metalloid/noble)
 * 数据源：Periodic-Table-JSON (MIT) + 中国化学会标准中文名
 */

export type ElementCategory = 'metal' | 'nonmetal' | 'metalloid' | 'noble';

export interface ElementInfo {
  n: number;
  symbol: string;
  zh: string;
  en: string;
  mass: number | null;
  period: number;
  group: number | null;
  x: number;
  y: number;
  cat: ElementCategory;
}

export const ELEMENTS: ElementInfo[] = [
  { n: 1, symbol: 'H', zh: '氢', en: 'Hydrogen', mass: 1.008, period: 1, group: 1, x: 1, y: 1, cat: 'nonmetal' },
  { n: 2, symbol: 'He', zh: '氦', en: 'Helium', mass: 4.0026, period: 1, group: 18, x: 18, y: 1, cat: 'noble' },
  { n: 3, symbol: 'Li', zh: '锂', en: 'Lithium', mass: 6.94, period: 2, group: 1, x: 1, y: 2, cat: 'metal' },
  { n: 4, symbol: 'Be', zh: '铍', en: 'Beryllium', mass: 9.0122, period: 2, group: 2, x: 2, y: 2, cat: 'metal' },
  { n: 5, symbol: 'B', zh: '硼', en: 'Boron', mass: 10.81, period: 2, group: 13, x: 13, y: 2, cat: 'metalloid' },
  { n: 6, symbol: 'C', zh: '碳', en: 'Carbon', mass: 12.011, period: 2, group: 14, x: 14, y: 2, cat: 'nonmetal' },
  { n: 7, symbol: 'N', zh: '氮', en: 'Nitrogen', mass: 14.007, period: 2, group: 15, x: 15, y: 2, cat: 'nonmetal' },
  { n: 8, symbol: 'O', zh: '氧', en: 'Oxygen', mass: 15.999, period: 2, group: 16, x: 16, y: 2, cat: 'nonmetal' },
  { n: 9, symbol: 'F', zh: '氟', en: 'Fluorine', mass: 18.9984, period: 2, group: 17, x: 17, y: 2, cat: 'nonmetal' },
  { n: 10, symbol: 'Ne', zh: '氖', en: 'Neon', mass: 20.1798, period: 2, group: 18, x: 18, y: 2, cat: 'noble' },
  { n: 11, symbol: 'Na', zh: '钠', en: 'Sodium', mass: 22.9898, period: 3, group: 1, x: 1, y: 3, cat: 'metal' },
  { n: 12, symbol: 'Mg', zh: '镁', en: 'Magnesium', mass: 24.305, period: 3, group: 2, x: 2, y: 3, cat: 'metal' },
  { n: 13, symbol: 'Al', zh: '铝', en: 'Aluminium', mass: 26.9815, period: 3, group: 13, x: 13, y: 3, cat: 'metal' },
  { n: 14, symbol: 'Si', zh: '硅', en: 'Silicon', mass: 28.085, period: 3, group: 14, x: 14, y: 3, cat: 'metalloid' },
  { n: 15, symbol: 'P', zh: '磷', en: 'Phosphorus', mass: 30.9738, period: 3, group: 15, x: 15, y: 3, cat: 'nonmetal' },
  { n: 16, symbol: 'S', zh: '硫', en: 'Sulfur', mass: 32.06, period: 3, group: 16, x: 16, y: 3, cat: 'nonmetal' },
  { n: 17, symbol: 'Cl', zh: '氯', en: 'Chlorine', mass: 35.45, period: 3, group: 17, x: 17, y: 3, cat: 'nonmetal' },
  { n: 18, symbol: 'Ar', zh: '氩', en: 'Argon', mass: 39.9481, period: 3, group: 18, x: 18, y: 3, cat: 'noble' },
  { n: 19, symbol: 'K', zh: '钾', en: 'Potassium', mass: 39.0983, period: 4, group: 1, x: 1, y: 4, cat: 'metal' },
  { n: 20, symbol: 'Ca', zh: '钙', en: 'Calcium', mass: 40.0784, period: 4, group: 2, x: 2, y: 4, cat: 'metal' },
  { n: 21, symbol: 'Sc', zh: '钪', en: 'Scandium', mass: 44.9559, period: 4, group: 3, x: 3, y: 4, cat: 'metal' },
  { n: 22, symbol: 'Ti', zh: '钛', en: 'Titanium', mass: 47.8671, period: 4, group: 4, x: 4, y: 4, cat: 'metal' },
  { n: 23, symbol: 'V', zh: '钒', en: 'Vanadium', mass: 50.9415, period: 4, group: 5, x: 5, y: 4, cat: 'metal' },
  { n: 24, symbol: 'Cr', zh: '铬', en: 'Chromium', mass: 51.9962, period: 4, group: 6, x: 6, y: 4, cat: 'metal' },
  { n: 25, symbol: 'Mn', zh: '锰', en: 'Manganese', mass: 54.938, period: 4, group: 7, x: 7, y: 4, cat: 'metal' },
  { n: 26, symbol: 'Fe', zh: '铁', en: 'Iron', mass: 55.8452, period: 4, group: 8, x: 8, y: 4, cat: 'metal' },
  { n: 27, symbol: 'Co', zh: '钴', en: 'Cobalt', mass: 58.9332, period: 4, group: 9, x: 9, y: 4, cat: 'metal' },
  { n: 28, symbol: 'Ni', zh: '镍', en: 'Nickel', mass: 58.6934, period: 4, group: 10, x: 10, y: 4, cat: 'metal' },
  { n: 29, symbol: 'Cu', zh: '铜', en: 'Copper', mass: 63.5463, period: 4, group: 11, x: 11, y: 4, cat: 'metal' },
  { n: 30, symbol: 'Zn', zh: '锌', en: 'Zinc', mass: 65.382, period: 4, group: 12, x: 12, y: 4, cat: 'metal' },
  { n: 31, symbol: 'Ga', zh: '镓', en: 'Gallium', mass: 69.7231, period: 4, group: 13, x: 13, y: 4, cat: 'metal' },
  { n: 32, symbol: 'Ge', zh: '锗', en: 'Germanium', mass: 72.6308, period: 4, group: 14, x: 14, y: 4, cat: 'metalloid' },
  { n: 33, symbol: 'As', zh: '砷', en: 'Arsenic', mass: 74.9216, period: 4, group: 15, x: 15, y: 4, cat: 'metalloid' },
  { n: 34, symbol: 'Se', zh: '硒', en: 'Selenium', mass: 78.9718, period: 4, group: 16, x: 16, y: 4, cat: 'nonmetal' },
  { n: 35, symbol: 'Br', zh: '溴', en: 'Bromine', mass: 79.904, period: 4, group: 17, x: 17, y: 4, cat: 'nonmetal' },
  { n: 36, symbol: 'Kr', zh: '氪', en: 'Krypton', mass: 83.7982, period: 4, group: 18, x: 18, y: 4, cat: 'noble' },
  { n: 37, symbol: 'Rb', zh: '铷', en: 'Rubidium', mass: 85.4678, period: 5, group: 1, x: 1, y: 5, cat: 'metal' },
  { n: 38, symbol: 'Sr', zh: '锶', en: 'Strontium', mass: 87.621, period: 5, group: 2, x: 2, y: 5, cat: 'metal' },
  { n: 39, symbol: 'Y', zh: '钇', en: 'Yttrium', mass: 88.9058, period: 5, group: 3, x: 3, y: 5, cat: 'metal' },
  { n: 40, symbol: 'Zr', zh: '锆', en: 'Zirconium', mass: 91.2242, period: 5, group: 4, x: 4, y: 5, cat: 'metal' },
  { n: 41, symbol: 'Nb', zh: '铌', en: 'Niobium', mass: 92.9064, period: 5, group: 5, x: 5, y: 5, cat: 'metal' },
  { n: 42, symbol: 'Mo', zh: '钼', en: 'Molybdenum', mass: 95.951, period: 5, group: 6, x: 6, y: 5, cat: 'metal' },
  { n: 43, symbol: 'Tc', zh: '锝', en: 'Technetium', mass: 98.0, period: 5, group: 7, x: 7, y: 5, cat: 'metal' },
  { n: 44, symbol: 'Ru', zh: '钌', en: 'Ruthenium', mass: 101.072, period: 5, group: 8, x: 8, y: 5, cat: 'metal' },
  { n: 45, symbol: 'Rh', zh: '铑', en: 'Rhodium', mass: 102.9055, period: 5, group: 9, x: 9, y: 5, cat: 'metal' },
  { n: 46, symbol: 'Pd', zh: '钯', en: 'Palladium', mass: 106.421, period: 5, group: 10, x: 10, y: 5, cat: 'metal' },
  { n: 47, symbol: 'Ag', zh: '银', en: 'Silver', mass: 107.8682, period: 5, group: 11, x: 11, y: 5, cat: 'metal' },
  { n: 48, symbol: 'Cd', zh: '镉', en: 'Cadmium', mass: 112.4144, period: 5, group: 12, x: 12, y: 5, cat: 'metal' },
  { n: 49, symbol: 'In', zh: '铟', en: 'Indium', mass: 114.8181, period: 5, group: 13, x: 13, y: 5, cat: 'metal' },
  { n: 50, symbol: 'Sn', zh: '锡', en: 'Tin', mass: 118.7107, period: 5, group: 14, x: 14, y: 5, cat: 'metal' },
  { n: 51, symbol: 'Sb', zh: '锑', en: 'Antimony', mass: 121.7601, period: 5, group: 15, x: 15, y: 5, cat: 'metalloid' },
  { n: 52, symbol: 'Te', zh: '碲', en: 'Tellurium', mass: 127.603, period: 5, group: 16, x: 16, y: 5, cat: 'metalloid' },
  { n: 53, symbol: 'I', zh: '碘', en: 'Iodine', mass: 126.9045, period: 5, group: 17, x: 17, y: 5, cat: 'nonmetal' },
  { n: 54, symbol: 'Xe', zh: '氙', en: 'Xenon', mass: 131.2936, period: 5, group: 18, x: 18, y: 5, cat: 'noble' },
  { n: 55, symbol: 'Cs', zh: '铯', en: 'Cesium', mass: 132.9055, period: 6, group: 1, x: 1, y: 6, cat: 'metal' },
  { n: 56, symbol: 'Ba', zh: '钡', en: 'Barium', mass: 137.3277, period: 6, group: 2, x: 2, y: 6, cat: 'metal' },
  { n: 57, symbol: 'La', zh: '镧', en: 'Lanthanum', mass: 138.9055, period: 6, group: 3, x: 3, y: 9, cat: 'metal' },
  { n: 58, symbol: 'Ce', zh: '铈', en: 'Cerium', mass: 140.1161, period: 6, group: 3, x: 4, y: 9, cat: 'metal' },
  { n: 59, symbol: 'Pr', zh: '镨', en: 'Praseodymium', mass: 140.9077, period: 6, group: 3, x: 5, y: 9, cat: 'metal' },
  { n: 60, symbol: 'Nd', zh: '钕', en: 'Neodymium', mass: 144.2423, period: 6, group: 3, x: 6, y: 9, cat: 'metal' },
  { n: 61, symbol: 'Pm', zh: '钷', en: 'Promethium', mass: 145.0, period: 6, group: 3, x: 7, y: 9, cat: 'metal' },
  { n: 62, symbol: 'Sm', zh: '钐', en: 'Samarium', mass: 150.362, period: 6, group: 3, x: 8, y: 9, cat: 'metal' },
  { n: 63, symbol: 'Eu', zh: '铕', en: 'Europium', mass: 151.9641, period: 6, group: 3, x: 9, y: 9, cat: 'metal' },
  { n: 64, symbol: 'Gd', zh: '钆', en: 'Gadolinium', mass: 157.253, period: 6, group: 3, x: 10, y: 9, cat: 'metal' },
  { n: 65, symbol: 'Tb', zh: '铽', en: 'Terbium', mass: 158.9254, period: 6, group: 3, x: 11, y: 9, cat: 'metal' },
  { n: 66, symbol: 'Dy', zh: '镝', en: 'Dysprosium', mass: 162.5001, period: 6, group: 3, x: 12, y: 9, cat: 'metal' },
  { n: 67, symbol: 'Ho', zh: '钬', en: 'Holmium', mass: 164.9303, period: 6, group: 3, x: 13, y: 9, cat: 'metal' },
  { n: 68, symbol: 'Er', zh: '铒', en: 'Erbium', mass: 167.2593, period: 6, group: 3, x: 14, y: 9, cat: 'metal' },
  { n: 69, symbol: 'Tm', zh: '铥', en: 'Thulium', mass: 168.9342, period: 6, group: 3, x: 15, y: 9, cat: 'metal' },
  { n: 70, symbol: 'Yb', zh: '镱', en: 'Ytterbium', mass: 173.0451, period: 6, group: 3, x: 16, y: 9, cat: 'metal' },
  { n: 71, symbol: 'Lu', zh: '镥', en: 'Lutetium', mass: 174.9668, period: 6, group: 3, x: 17, y: 9, cat: 'metal' },
  { n: 72, symbol: 'Hf', zh: '铪', en: 'Hafnium', mass: 178.492, period: 6, group: 4, x: 4, y: 6, cat: 'metal' },
  { n: 73, symbol: 'Ta', zh: '钽', en: 'Tantalum', mass: 180.9479, period: 6, group: 5, x: 5, y: 6, cat: 'metal' },
  { n: 74, symbol: 'W', zh: '钨', en: 'Tungsten', mass: 183.841, period: 6, group: 6, x: 6, y: 6, cat: 'metal' },
  { n: 75, symbol: 'Re', zh: '铼', en: 'Rhenium', mass: 186.2071, period: 6, group: 7, x: 7, y: 6, cat: 'metal' },
  { n: 76, symbol: 'Os', zh: '锇', en: 'Osmium', mass: 190.233, period: 6, group: 8, x: 8, y: 6, cat: 'metal' },
  { n: 77, symbol: 'Ir', zh: '铱', en: 'Iridium', mass: 192.2173, period: 6, group: 9, x: 9, y: 6, cat: 'metal' },
  { n: 78, symbol: 'Pt', zh: '铂', en: 'Platinum', mass: 195.0849, period: 6, group: 10, x: 10, y: 6, cat: 'metal' },
  { n: 79, symbol: 'Au', zh: '金', en: 'Gold', mass: 196.9666, period: 6, group: 11, x: 11, y: 6, cat: 'metal' },
  { n: 80, symbol: 'Hg', zh: '汞', en: 'Mercury', mass: 200.5923, period: 6, group: 12, x: 12, y: 6, cat: 'metal' },
  { n: 81, symbol: 'Tl', zh: '铊', en: 'Thallium', mass: 204.38, period: 6, group: 13, x: 13, y: 6, cat: 'metal' },
  { n: 82, symbol: 'Pb', zh: '铅', en: 'Lead', mass: 207.21, period: 6, group: 14, x: 14, y: 6, cat: 'metal' },
  { n: 83, symbol: 'Bi', zh: '铋', en: 'Bismuth', mass: 208.9804, period: 6, group: 15, x: 15, y: 6, cat: 'metal' },
  { n: 84, symbol: 'Po', zh: '钋', en: 'Polonium', mass: 209.0, period: 6, group: 16, x: 16, y: 6, cat: 'metal' },
  { n: 85, symbol: 'At', zh: '砹', en: 'Astatine', mass: 210.0, period: 6, group: 17, x: 17, y: 6, cat: 'metalloid' },
  { n: 86, symbol: 'Rn', zh: '氡', en: 'Radon', mass: 222.0, period: 6, group: 18, x: 18, y: 6, cat: 'noble' },
  { n: 87, symbol: 'Fr', zh: '钫', en: 'Francium', mass: 223.0, period: 7, group: 1, x: 1, y: 7, cat: 'metal' },
  { n: 88, symbol: 'Ra', zh: '镭', en: 'Radium', mass: 226.0, period: 7, group: 2, x: 2, y: 7, cat: 'metal' },
  { n: 89, symbol: 'Ac', zh: '锕', en: 'Actinium', mass: 227.0, period: 7, group: 3, x: 3, y: 10, cat: 'metal' },
  { n: 90, symbol: 'Th', zh: '钍', en: 'Thorium', mass: 232.0377, period: 7, group: 3, x: 4, y: 10, cat: 'metal' },
  { n: 91, symbol: 'Pa', zh: '镤', en: 'Protactinium', mass: 231.0359, period: 7, group: 3, x: 5, y: 10, cat: 'metal' },
  { n: 92, symbol: 'U', zh: '铀', en: 'Uranium', mass: 238.0289, period: 7, group: 3, x: 6, y: 10, cat: 'metal' },
  { n: 93, symbol: 'Np', zh: '镎', en: 'Neptunium', mass: 237.0, period: 7, group: 3, x: 7, y: 10, cat: 'metal' },
  { n: 94, symbol: 'Pu', zh: '钚', en: 'Plutonium', mass: 244.0, period: 7, group: 3, x: 8, y: 10, cat: 'metal' },
  { n: 95, symbol: 'Am', zh: '镅', en: 'Americium', mass: 243.0, period: 7, group: 3, x: 9, y: 10, cat: 'metal' },
  { n: 96, symbol: 'Cm', zh: '锔', en: 'Curium', mass: 247.0, period: 7, group: 3, x: 10, y: 10, cat: 'metal' },
  { n: 97, symbol: 'Bk', zh: '锫', en: 'Berkelium', mass: 247.0, period: 7, group: 3, x: 11, y: 10, cat: 'metal' },
  { n: 98, symbol: 'Cf', zh: '锎', en: 'Californium', mass: 251.0, period: 7, group: 3, x: 12, y: 10, cat: 'metal' },
  { n: 99, symbol: 'Es', zh: '锿', en: 'Einsteinium', mass: 252.0, period: 7, group: 3, x: 13, y: 10, cat: 'metal' },
  { n: 100, symbol: 'Fm', zh: '镄', en: 'Fermium', mass: 257.0, period: 7, group: 3, x: 14, y: 10, cat: 'metal' },
  { n: 101, symbol: 'Md', zh: '钔', en: 'Mendelevium', mass: 258.0, period: 7, group: 3, x: 15, y: 10, cat: 'metal' },
  { n: 102, symbol: 'No', zh: '锘', en: 'Nobelium', mass: 259.0, period: 7, group: 3, x: 16, y: 10, cat: 'metal' },
  { n: 103, symbol: 'Lr', zh: '铹', en: 'Lawrencium', mass: 266.0, period: 7, group: 3, x: 17, y: 10, cat: 'metal' },
  { n: 104, symbol: 'Rf', zh: '𬬻', en: 'Rutherfordium', mass: 267.0, period: 7, group: 4, x: 4, y: 7, cat: 'metal' },
  { n: 105, symbol: 'Db', zh: '𬭊', en: 'Dubnium', mass: 268.0, period: 7, group: 5, x: 5, y: 7, cat: 'metal' },
  { n: 106, symbol: 'Sg', zh: '𬭳', en: 'Seaborgium', mass: 269.0, period: 7, group: 6, x: 6, y: 7, cat: 'metal' },
  { n: 107, symbol: 'Bh', zh: '𬭛', en: 'Bohrium', mass: 270.0, period: 7, group: 7, x: 7, y: 7, cat: 'metal' },
  { n: 108, symbol: 'Hs', zh: '𬭶', en: 'Hassium', mass: 269.0, period: 7, group: 8, x: 8, y: 7, cat: 'metal' },
  { n: 109, symbol: 'Mt', zh: '鿏', en: 'Meitnerium', mass: 278.0, period: 7, group: 9, x: 9, y: 7, cat: 'metal' },
  { n: 110, symbol: 'Ds', zh: '𫟼', en: 'Darmstadtium', mass: 281.0, period: 7, group: 10, x: 10, y: 7, cat: 'metal' },
  { n: 111, symbol: 'Rg', zh: '鿔', en: 'Roentgenium', mass: 282.0, period: 7, group: 11, x: 11, y: 7, cat: 'metal' },
  { n: 112, symbol: 'Cn', zh: '𨭆', en: 'Copernicium', mass: 285.0, period: 7, group: 12, x: 12, y: 7, cat: 'metal' },
  { n: 113, symbol: 'Nh', zh: '鿭', en: 'Nihonium', mass: 286.0, period: 7, group: 13, x: 13, y: 7, cat: 'metal' },
  { n: 114, symbol: 'Fl', zh: '𫓧', en: 'Flerovium', mass: 289.0, period: 7, group: 14, x: 14, y: 7, cat: 'metal' },
  { n: 115, symbol: 'Mc', zh: '镆', en: 'Moscovium', mass: 289.0, period: 7, group: 15, x: 15, y: 7, cat: 'metal' },
  { n: 116, symbol: 'Lv', zh: '𫟷', en: 'Livermorium', mass: 293.0, period: 7, group: 16, x: 16, y: 7, cat: 'metal' },
  { n: 117, symbol: 'Ts', zh: '鿬', en: 'Tennessine', mass: 294.0, period: 7, group: 17, x: 17, y: 7, cat: 'metalloid' },
  { n: 118, symbol: 'Og', zh: '鿫', en: 'Oganesson', mass: 294.0, period: 7, group: 18, x: 18, y: 7, cat: 'noble' },
];

/** 按原子序数快速索引 */
export const elementByNumber = new Map<number, ElementInfo>(ELEMENTS.map((e) => [e.n, e]));

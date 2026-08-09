/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * 三大科目元数据：id / 路由路径 / 年级范围。
 * 科目图标统一由 components/ui/SubjectIcon 渲染，不在此维护（避免强制统一模板）。
 * 文案（标题/状态/说明）按语言放在 i18n.ts 的 subjects 中。
 */
export type SubjectId = 'math' | 'physics' | 'chemistry';

export interface SubjectMeta {
  id: SubjectId;
  path: string;
  /** 年级范围（随语言切换，如 zh: 7-9 年级 / en: Grades 7-9） */
  gradeZh: string;
  gradeEn: string;
}

export const subjects: Record<SubjectId, SubjectMeta> = {
  math: {
    id: 'math',
    path: '/subject/math',
    gradeZh: '7-9 年级',
    gradeEn: 'Grades 7-9',
  },
  physics: {
    id: 'physics',
    path: '/subject/physics',
    gradeZh: '8-9 年级',
    gradeEn: 'Grades 8-9',
  },
  chemistry: {
    id: 'chemistry',
    path: '/subject/chemistry',
    gradeZh: '9年级',
    gradeEn: 'Grade 9',
  },
};

/** 有序列表，供首页卡片与路由循环使用 */
export const subjectList: SubjectMeta[] = [subjects.math, subjects.physics, subjects.chemistry];

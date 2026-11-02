import type { PrismaClient } from '../../generated/prisma/client.js';

export const examQuestionTypes = ['single', 'multiple', 'fill', 'subjective'] as const;
interface Spec { type: typeof examQuestionTypes[number]; count: number; score: number }
export interface ExamRuleGroup { topicId: string; topicIds: string[]; subjectId: string; questionTypes: Spec[] }
export class ExamRuleError extends Error {}

export function validateQuestionTypes(input: unknown): Spec[] {
  if (!Array.isArray(input) || !input.length) throw new ExamRuleError('每条规则至少配置一种题型。');
  const seen = new Set<string>();
  return input.map(spec => {
    if (!examQuestionTypes.includes(spec?.type)) throw new ExamRuleError('考试规则包含无效题型，请重新选择。');
    if (seen.has(spec.type)) throw new ExamRuleError('同一条规则不能重复配置相同题型，请检查单选题、多选题的选择。');
    seen.add(spec.type);
    if (!Number.isInteger(spec.count) || spec.count < 1) throw new ExamRuleError('抽题数量必须是大于 0 的整数。');
    if (!Number.isInteger(spec.score) || spec.score < 1) throw new ExamRuleError('每题分值必须是大于 0 的整数。');
    return { type: spec.type, count: spec.count, score: spec.score };
  });
}

// The database stores a course rule once per chapter. Rejoin identical chapter copies
// before counting or sampling; distinct courses and distinct configurations remain separate.
export async function readExamRuleGroups(db: PrismaClient, examId: string): Promise<ExamRuleGroup[]> {
  const stored = await db.examRule.findMany({ where: { examId }, orderBy: { id: 'asc' } });
  const topics = await db.topic.findMany({ where: { id: { in: stored.map(rule => rule.topicId) } }, select: { id: true, parentId: true } });
  const parents = new Map(topics.map(topic => [topic.id, topic.parentId || topic.id]));
  const groups = new Map<string, ExamRuleGroup>();
  for (const rule of stored) {
    let specs: Spec[];
    try { specs = JSON.parse(rule.questionTypesJson); } catch { throw new ExamRuleError('已有考试规则格式异常，请编辑后重新保存。'); }
    if (!Array.isArray(specs)) throw new ExamRuleError('已有考试规则格式异常，请编辑后重新保存。');
    const subjectId = parents.get(rule.topicId) || rule.topicId;
    const signature = JSON.stringify(specs.map(spec => ({ type: spec.type, count: spec.count, score: spec.score })).sort((a, b) => String(a.type).localeCompare(String(b.type))));
    const key = subjectId + ':' + signature;
    const group = groups.get(key);
    if (group) group.topicIds.push(rule.topicId);
    else groups.set(key, { topicId: rule.topicId, topicIds: [rule.topicId], subjectId, questionTypes: specs });
  }
  return [...groups.values()];
}

export async function expandExamRules(db: PrismaClient, input: unknown) {
  if (!Array.isArray(input) || !input.length) throw new ExamRuleError('请至少添加一条考试规则。');
  const usedTopics = new Set<string>();
  const usedCourses = new Set<string>();
  const expanded: { topicIds: string[]; questionTypes: Spec[] }[] = [];
  for (const rule of input) {
    const questionTypes = validateQuestionTypes(rule.questionTypes);
    let ids: string[] = rule.chapterIds ?? rule.topicIds ?? (rule.topicId ? [rule.topicId] : []);
    if (!Array.isArray(ids)) throw new ExamRuleError('章节范围格式错误。');
    ids = [...new Set(ids.filter(id => typeof id === 'string' && id.trim()).map(id => id.trim()))];
    const subjectIds = rule.subjectIds ?? (rule.subjectId ? [rule.subjectId] : []);
    for (const subjectId of subjectIds) {
      if (usedCourses.has(subjectId)) throw new ExamRuleError('同一课程请在一条规则中配置所有题型，不能重复添加课程规则。');
      usedCourses.add(subjectId);
    }
    if (!ids.length && Array.isArray(subjectIds) && subjectIds.length) {
      ids = (await db.topic.findMany({ where: { parentId: { in: subjectIds } }, select: { id: true } })).map(topic => topic.id);
    }
    if (!ids.length) throw new ExamRuleError('所选课程没有可用章节，请重新选择课程。');
    const topics = await db.topic.findMany({ where: { id: { in: ids } }, select: { id: true, parentId: true } });
    if (topics.length !== ids.length) throw new ExamRuleError('规则中有不存在的章节，请重新选择。');
    if (subjectIds.length && topics.some(topic => !subjectIds.includes(topic.parentId))) throw new ExamRuleError('所选章节不属于该课程。');
    for (const id of ids) {
      if (usedTopics.has(id)) throw new ExamRuleError('不同规则的章节范围不能重叠，请合并为同一条规则。');
      usedTopics.add(id);
    }
    expanded.push({ topicIds: ids, questionTypes });
  }
  return expanded;
}

export async function buildExamPools(db: PrismaClient, examId: string) {
  const rules = await readExamRuleGroups(db, examId);
  if (!rules.length) throw new ExamRuleError('考试尚未配置抽题规则。');
  const pools = [];
  for (const rule of rules) {
    for (const spec of validateQuestionTypes(rule.questionTypes)) {
      const questions = await db.question.findMany({
        where: { topicId: { in: rule.topicIds }, type: spec.type },
        include: { options: { orderBy: { sortOrder: 'asc' } } },
      });
      pools.push({ ...spec, topicIds: rule.topicIds, questions });
    }
  }
  return pools;
}

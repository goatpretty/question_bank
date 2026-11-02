import { randomUUID } from 'node:crypto';
import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../db/prisma.js';
import type {
  WrongBookAnswer, WrongBookDetailData, WrongBookItemView, WrongBookListData,
  WrongBookListQuery, WrongBookOccurrenceView, WrongBookQuestionSnapshot,
  WrongBookQuestionType, WrongBookSource, WrongBookStats,
} from '../../shared/wrongbook.js';

export class WrongBookError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const questionInclude = {
  topic: { include: { parentTopic: true } },
  options: { orderBy: { sortOrder: 'asc' as const } },
} satisfies Prisma.QuestionInclude;

type StoredQuestion = Prisma.QuestionGetPayload<{ include: typeof questionInclude }>;
type StoredItem = Prisma.WrongBookItemGetPayload<{ include: { question: { include: typeof questionInclude } } }>;
type StoredOccurrence = Prisma.WrongBookOccurrenceGetPayload<Record<string, never>>;

export interface RecordWrongOccurrenceInput {
  userId: string;
  questionId: string;
  sourceType: WrongBookSource;
  sourceSessionId: string;
  sourceAnswerId: string;
  sourceTitle: string;
  submittedAt: Date;
  userAnswer: WrongBookAnswer;
  correctAnswer: WrongBookAnswer;
  snapshot: WrongBookQuestionSnapshot;
  snapshotStatus: 'captured' | 'reconstructed';
  preserveMastery?: boolean;
}

export function parseStoredAnswer(raw: string): WrongBookAnswer {
  let answer: unknown;
  try {
    answer = JSON.parse(raw);
  } catch {
    throw new WrongBookError(422, '来源答案数据损坏，无法可靠收录。');
  }
  if (typeof answer === 'string' || (Array.isArray(answer) && answer.every(item => typeof item === 'string'))) {
    return answer;
  }
  throw new WrongBookError(422, '来源答案格式不支持。');
}

export function hasAnswer(answer: WrongBookAnswer): boolean {
  return Array.isArray(answer) ? answer.some(item => item.trim().length > 0) : answer.trim().length > 0;
}

export function questionType(raw: string): WrongBookQuestionType {
  const value = raw.toLowerCase().trim();
  if (['single', 'single_choice', 'singlechoice', 'choice', 'radio', 'scq', '单选', '单选题'].includes(value)) return 'single';
  if (['multiple', 'multiple_choice', 'multiplechoice', 'checkbox', 'mcq', '多选', '多选题'].includes(value)) return 'multiple';
  if (['fill', 'blank', 'fill_blank', 'fillblank', 'gap', '填空', '填空题'].includes(value)) return 'fill';
  return 'subjective';
}

function optionLabel(index: number): string {
  let result = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    result = String.fromCharCode(65 + ((n - 1) % 26)) + result;
  }
  return result;
}

export function snapshotQuestion(question: StoredQuestion): WrongBookQuestionSnapshot {
  const topic = question.topic;
  return {
    id: question.id,
    topicId: topic.id,
    chapterName: topic.parentId ? topic.name : '',
    subjectId: topic.parentId ?? topic.id,
    subjectName: topic.parentTopic?.name ?? topic.name,
    type: questionType(question.type),
    content: question.content,
    options: question.options.map((option, index) => ({ id: option.optionId, content: option.content, displayLabel: optionLabel(index) })),
    answer: parseStoredAnswer(question.answer),
    analysis: question.analysis,
  };
}

function itemView(item: StoredItem): WrongBookItemView {
  return {
    id: item.id, userId: item.userId, questionId: item.questionId, wrongCount: item.wrongCount,
    lastWrongAt: item.lastWrongAt.toISOString(), isMastered: item.isMastered,
    masteredAt: item.masteredAt?.toISOString() ?? null,
    question: snapshotQuestion(item.question),
  };
}

function occurrenceView(occurrence: StoredOccurrence): WrongBookOccurrenceView {
  const snapshot = JSON.parse(occurrence.snapshotJson) as WrongBookQuestionSnapshot;
  const userAnswer = parseStoredAnswer(occurrence.userAnswerJson);
  const correctAnswer = parseStoredAnswer(occurrence.correctAnswerJson);
  const display = (answer: WrongBookAnswer): WrongBookAnswer => {
    const map = new Map(snapshot.options.map(option => [option.id, option.displayLabel]));
    return Array.isArray(answer) ? answer.map(id => map.get(id) ?? id) : map.get(answer) ?? answer;
  };
  return {
    id: occurrence.id, sourceType: occurrence.sourceType as WrongBookSource,
    sourceSessionId: occurrence.sourceSessionId, sourceAnswerId: occurrence.sourceAnswerId,
    sourceTitle: occurrence.sourceTitle, submittedAt: occurrence.submittedAt.toISOString(),
    recordedAt: occurrence.recordedAt.toISOString(), userAnswer, correctAnswer,
    userDisplayAnswer: display(userAnswer), correctDisplayAnswer: display(correctAnswer),
    snapshotStatus: occurrence.snapshotStatus as WrongBookOccurrenceView['snapshotStatus'], question: snapshot,
  };
}

export async function recordWrongOccurrence(input: RecordWrongOccurrenceInput) {
  return prisma.$transaction(tx => recordWrongOccurrenceInTransaction(tx, input));
}

export async function recordWrongOccurrenceInTransaction(tx: Prisma.TransactionClient, input: RecordWrongOccurrenceInput) {
  if (!['practice', 'exam'].includes(input.sourceType) || !input.userId || !input.questionId || !input.sourceSessionId || !input.sourceAnswerId ||
      !Number.isFinite(input.submittedAt.getTime()) || input.snapshot.id !== input.questionId ||
      input.snapshot.type === 'subjective' || !hasAnswer(input.userAnswer) || !hasAnswer(input.correctAnswer) ||
      !['captured', 'reconstructed'].includes(input.snapshotStatus)) {
    throw new WrongBookError(422, '错题来源或快照不完整。');
  }
  const key = {
    userId: input.userId, sourceType: input.sourceType,
    sourceSessionId: input.sourceSessionId, questionId: input.questionId,
  };
  const existing = await tx.wrongBookOccurrence.findUnique({ where: { userId_sourceType_sourceSessionId_questionId: key } });
  if (existing) return { created: false, occurrenceId: existing.id };
  const item = await tx.wrongBookItem.upsert({
    where: { userId_questionId: { userId: input.userId, questionId: input.questionId } },
    create: { id: randomUUID(), userId: input.userId, questionId: input.questionId, wrongCount: 0, lastWrongAt: input.submittedAt },
    update: {},
  });
  const occurrence = await tx.wrongBookOccurrence.create({
    data: {
      id: randomUUID(), ...key, sourceAnswerId: input.sourceAnswerId, sourceTitle: input.sourceTitle,
      submittedAt: input.submittedAt, userAnswerJson: JSON.stringify(input.userAnswer),
      correctAnswerJson: JSON.stringify(input.correctAnswer), snapshotJson: JSON.stringify(input.snapshot),
      snapshotStatus: input.snapshotStatus,
    },
  });
  const reopen = !input.preserveMastery && (!item.masteredAt || input.submittedAt > item.masteredAt);
  await tx.wrongBookItem.update({
    where: { id: item.id },
    data: {
      wrongCount: { increment: 1 },
      lastWrongAt: item.lastWrongAt > input.submittedAt ? item.lastWrongAt : input.submittedAt,
      ...(reopen ? { isMastered: false, masteredAt: null } : {}),
    },
  });
  return { created: true, occurrenceId: occurrence.id };
}

async function stats(tx: Prisma.TransactionClient, where: Prisma.WrongBookItemWhereInput): Promise<WrongBookStats> {
  const groups = await tx.wrongBookItem.groupBy({ by: ['isMastered'], where, _count: { _all: true } });
  const total = groups.reduce((sum, group) => sum + group._count._all, 0);
  const mastered = groups.find(group => group.isMastered)?._count._all ?? 0;
  return { total, mastered, unmastered: total - mastered, masteryRate: total ? mastered / total * 100 : 0 };
}

export async function getWrongBookStats(userId: string): Promise<WrongBookStats> {
  return prisma.$transaction(tx => stats(tx, { userId }));
}

export async function listWrongBook(userId: string, query: WrongBookListQuery): Promise<WrongBookListData> {
  const scope: Prisma.WrongBookItemWhereInput = {
    userId,
    question: {
      ...(query.chapterId ? { topicId: query.chapterId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.subjectId ? { topic: { OR: [{ id: query.subjectId, parentId: null }, { parentId: query.subjectId }] } } : {}),
    },
  };
  const where = { ...scope, ...(query.isMastered !== undefined ? { isMastered: query.isMastered } : {}) };
  return prisma.$transaction(async tx => {
    const total = await tx.wrongBookItem.count({ where });
    const rows = await tx.wrongBookItem.findMany({
      where, skip: (query.page - 1) * query.limit, take: query.limit,
      orderBy: query.sortBy === 'wrongCount' ? [{ wrongCount: 'desc' }, { lastWrongAt: 'desc' }, { id: 'asc' }] : [{ lastWrongAt: 'desc' }, { id: 'asc' }],
      include: { question: { include: questionInclude } },
    });
    return {
      wrongQuestions: rows.map(itemView), total, page: query.page, limit: query.limit,
      stats: await stats(tx, { userId }), filteredStats: await stats(tx, scope),
    };
  });
}

export async function detailWrongBook(userId: string, questionId: string, page: number, limit: number): Promise<WrongBookDetailData> {
  return prisma.$transaction(async tx => {
    const item = await tx.wrongBookItem.findUnique({
      where: { userId_questionId: { userId, questionId } }, include: { question: { include: questionInclude } },
    });
    if (!item) throw new WrongBookError(404, '错题记录不存在。');
    const total = await tx.wrongBookOccurrence.count({ where: { userId, questionId } });
    const rows = await tx.wrongBookOccurrence.findMany({
      where: { userId, questionId }, orderBy: [{ submittedAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * limit, take: limit,
    });
    return { item: itemView(item), occurrences: rows.map(occurrenceView), total, page, limit, legacyOccurrenceCount: Math.max(0, item.wrongCount - total) };
  });
}

export async function setWrongBookMastery(userId: string, questionId: string, isMastered: boolean): Promise<WrongBookItemView> {
  return prisma.$transaction(async tx => {
    const item = await tx.wrongBookItem.findUnique({ where: { userId_questionId: { userId, questionId } } });
    if (!item) throw new WrongBookError(404, '错题记录不存在。');
    const updated = await tx.wrongBookItem.update({
      where: { id: item.id },
      data: { isMastered, masteredAt: isMastered ? item.masteredAt ?? new Date() : null },
      include: { question: { include: questionInclude } },
    });
    return itemView(updated);
  });
}

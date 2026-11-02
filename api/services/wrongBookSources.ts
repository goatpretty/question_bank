import { prisma } from '../db/prisma.js';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  hasAnswer, parseStoredAnswer, questionInclude, questionType, recordWrongOccurrence, snapshotQuestion, WrongBookError,
  type RecordWrongOccurrenceInput,
} from './wrongBook.js';
import type { WrongBookAnswer, WrongBookOptionSnapshot, WrongBookQuestionSnapshot, WrongBookSource } from '../../shared/wrongbook.js';
import { isAnswerCorrect } from '../../shared/answer.js';

export function isCorrectExamAnswer(snapshot: WrongBookQuestionSnapshot, userAnswer: WrongBookAnswer): boolean {
  return isAnswerCorrect(snapshot.type, snapshot.answer, userAnswer);
}

export function validateChoiceAnswers(snapshot: WrongBookQuestionSnapshot, userAnswer: WrongBookAnswer) {
  if (snapshot.type !== 'single' && snapshot.type !== 'multiple') return;
  const ids = new Set(snapshot.options.map(option => option.id));
  const values = (answer: WrongBookAnswer) => Array.isArray(answer) ? answer : [answer];
  if (snapshot.type === 'single' && (values(userAnswer).length !== 1 || values(snapshot.answer).length !== 1)) {
    throw new WrongBookError(422, '单选题必须对应一个选项。');
  }
  if (!ids.size || values(userAnswer).some(id => !ids.has(id)) || values(snapshot.answer).some(id => !ids.has(id))) {
    throw new WrongBookError(422, '历史答案与选项无法可靠对应，暂不收录。');
  }
}

export function parseExamOptions(raw: string): WrongBookOptionSnapshot[] {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new WrongBookError(422, '考试选项快照损坏。');
  }
  if (!Array.isArray(value) || !value.length) throw new WrongBookError(422, '考试选项快照不完整。');
  const options = value.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object') throw new WrongBookError(422, '考试选项快照格式不支持。');
    const item = entry as Record<string, unknown>;
    if (typeof item.optionId !== 'string' || typeof item.content !== 'string' || typeof item.displayLabel !== 'string') {
      throw new WrongBookError(422, '考试选项快照格式不支持。');
    }
    return { id: item.optionId, content: item.content, displayLabel: item.displayLabel };
  });
  if (new Set(options.map(option => option.id)).size !== options.length || new Set(options.map(option => option.displayLabel)).size !== options.length) {
    throw new WrongBookError(422, '考试选项快照包含重复标识。');
  }
  return options;
}

export class SourceSkipError extends WrongBookError {
  constructor(public reason: 'correct' | 'unanswered' | 'subjective', message: string) { super(422, message); }
}
export async function buildFromCompletedSource(tx: Prisma.TransactionClient, userId: string, questionId: string, sourceType: WrongBookSource, sourceSessionId: string): Promise<RecordWrongOccurrenceInput> {
  const question = await tx.question.findUnique({ where: { id: questionId }, include: questionInclude });
  if (!question) throw new WrongBookError(404, '题目不存在。');
  if (questionType(question.type) === 'subjective') throw new SourceSkipError('subjective', '主观题暂不自动收录。');
  const snapshot = snapshotQuestion(question);

  if (sourceType === 'practice') {
    const session = await tx.practiceSession.findFirst({ where: { id: sourceSessionId, userId } });
    if (!session) throw new WrongBookError(404, '作答来源不存在。');
    if (session.status !== 'completed') throw new WrongBookError(409, '仅允许收录已正式提交的作答。');
    if (!session.endTime) throw new WrongBookError(422, '历史练习缺少提交时间。');
    const answer = await tx.practiceAnswer.findUnique({ where: { sessionId_questionId: { sessionId: session.id, questionId } } });
    if (!answer) throw new WrongBookError(404, '该来源中没有此题的作答。');
    const userAnswer = parseStoredAnswer(answer.userAnswerJson);
    if (!hasAnswer(userAnswer)) throw new SourceSkipError('unanswered', '未作答题目不计入错题。');
    if (answer.isCorrect) throw new SourceSkipError('correct', '仅收录已作答且判错的题目。');
    validateChoiceAnswers(snapshot, userAnswer);
    return {
      userId, questionId, sourceType, sourceSessionId, sourceAnswerId: answer.id,
      sourceTitle: `${snapshot.subjectName}练习`, submittedAt: session.endTime,
      userAnswer, correctAnswer: snapshot.answer, snapshot, snapshotStatus: 'reconstructed',
    };
  }

  const submission = await tx.examSubmission.findFirst({ where: { id: sourceSessionId, userId }, include: { exam: true } });
  if (!submission) throw new WrongBookError(404, '作答来源不存在。');
  if (submission.status !== 'completed') throw new WrongBookError(409, '仅允许收录已正式提交的作答。');
  if (!submission.completedAt) throw new WrongBookError(422, '历史考试缺少提交时间。');
  const examQuestion = await tx.examSubmissionQuestion.findUnique({ where: { submissionId_questionId: { submissionId: submission.id, questionId } } });
  const answer = await tx.examAnswer.findUnique({ where: { submissionId_questionId: { submissionId: submission.id, questionId } } });
  if (!examQuestion) throw new WrongBookError(404, '该来源中没有此题的作答。');
  if (!answer) throw new SourceSkipError('unanswered', '未作答题目不计入错题。');
  const userAnswer = parseStoredAnswer(answer.answerJson);
  if (!hasAnswer(userAnswer)) throw new SourceSkipError('unanswered', '未作答题目不计入错题。');
  if (examQuestion.shuffledOptionsJson) snapshot.options = parseExamOptions(examQuestion.shuffledOptionsJson);
  validateChoiceAnswers(snapshot, userAnswer);
  if (isCorrectExamAnswer(snapshot, userAnswer)) throw new SourceSkipError('correct', '该题按现存标准答案判定为正确，不能收录。');
  return {
    userId, questionId, sourceType, sourceSessionId, sourceAnswerId: answer.id,
    sourceTitle: submission.exam.name, submittedAt: submission.completedAt,
    userAnswer, correctAnswer: snapshot.answer, snapshot, snapshotStatus: 'reconstructed',
  };
}

export async function recordFromCompletedSource(userId: string, questionId: string, sourceType: WrongBookSource, sourceSessionId: string) {
  const input = await prisma.$transaction(async tx => {
    const job = await tx.wrongBookCollectionJob.findUnique({ where: { userId_sourceType_sourceSessionId: { userId, sourceType, sourceSessionId } } });
    if (job) {
      const entries = JSON.parse(job.payloadJson) as (Omit<RecordWrongOccurrenceInput, 'submittedAt'> & { submittedAt: string })[];
      const entry = entries.find(item => item.questionId === questionId);
      if (!entry) throw new SourceSkipError('correct', '该题不属于此次提交的错题。');
      return { ...entry, submittedAt: new Date(entry.submittedAt) };
    }
    return buildFromCompletedSource(tx, userId, questionId, sourceType, sourceSessionId);
  });
  return recordWrongOccurrence(input);
}

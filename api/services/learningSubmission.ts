import { randomUUID } from 'node:crypto';
import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../db/prisma.js';
import {
  hasAnswer, parseStoredAnswer, questionInclude, questionType, snapshotQuestion, WrongBookError,
  type RecordWrongOccurrenceInput,
} from './wrongBook.js';
import { isCorrectExamAnswer, parseExamOptions, validateChoiceAnswers } from './wrongBookSources.js';
import { collectionForSource, enqueueCollection } from './wrongBookCollection.js';
import type { WrongBookAnswer } from '../../shared/wrongbook.js';

interface PracticeInput { questionId: string; userAnswer: WrongBookAnswer }
interface PracticeReceipt {
  session: Record<string, unknown>;
  correctCount: number;
  totalCount: number;
  completed: boolean;
}
interface ExamReceipt { submission: Record<string, unknown>; completed: boolean }

function answerValue(value: unknown): WrongBookAnswer {
  if (typeof value === 'string' || (Array.isArray(value) && value.every(item => typeof item === 'string'))) return value;
  throw new WrongBookError(400, '答案必须是文本或文本数组。');
}

async function receiptFor<T>(tx: Prisma.TransactionClient, userId: string, sourceType: 'practice' | 'exam', sourceSessionId: string): Promise<T | null> {
  const job = await tx.wrongBookCollectionJob.findUnique({ where: { userId_sourceType_sourceSessionId: { userId, sourceType, sourceSessionId } } });
  return job ? JSON.parse(job.receiptJson) as T : null;
}

export async function submitPractice(userId: string, practiceId: string, rawAnswers: unknown, completed: boolean) {
  const data = await prisma.$transaction(async tx => {
    const session = await tx.practiceSession.findFirst({ where: { id: practiceId, userId } });
    if (!session) throw new WrongBookError(404, '练习不存在。');
    if (session.status === 'completed' && completed) {
      const previous = await receiptFor<PracticeReceipt>(tx, userId, 'practice', practiceId);
      if (previous) return previous;
      return { session: { ...session, topicIds: JSON.parse(session.topicIdsJson) }, correctCount: session.correctCount,
        totalCount: await tx.practiceAnswer.count({ where: { sessionId: practiceId } }), completed: true };
    }
    if (session.status !== 'in_progress') throw new WrongBookError(409, '练习已结束，不能修改答案。');
    if (!Array.isArray(rawAnswers)) throw new WrongBookError(400, '答案格式不正确。');
    const inputs: PracticeInput[] = rawAnswers.map((raw: unknown) => {
      if (!raw || typeof raw !== 'object' || typeof (raw as PracticeInput).questionId !== 'string') throw new WrongBookError(400, '缺少题目 ID。');
      const item = raw as PracticeInput;
      return { questionId: item.questionId, userAnswer: answerValue(item.userAnswer) };
    });
    const submittedAnswers: Record<string, unknown>[] = [];
    for (const input of inputs) {
      const question = await tx.question.findUnique({ where: { id: input.questionId }, include: questionInclude });
      if (!question) throw new WrongBookError(404, '练习题目不存在。');
      const topicIds = JSON.parse(session.topicIdsJson) as string[];
      if (!topicIds.includes(question.topicId) && !topicIds.includes(question.topic.parentId ?? '')) throw new WrongBookError(400, '题目不属于本次练习范围。');
      const snapshot = snapshotQuestion(question);
      if (hasAnswer(input.userAnswer) && snapshot.type !== 'subjective') validateChoiceAnswers(snapshot, input.userAnswer);
      const isCorrect = hasAnswer(input.userAnswer) && snapshot.type !== 'subjective' && isCorrectExamAnswer(snapshot, input.userAnswer);
      const saved = await tx.practiceAnswer.upsert({
        where: { sessionId_questionId: { sessionId: practiceId, questionId: input.questionId } },
        create: { id: randomUUID(), sessionId: practiceId, questionId: input.questionId, userAnswerJson: JSON.stringify(input.userAnswer), isCorrect },
        update: { userAnswerJson: JSON.stringify(input.userAnswer), isCorrect, answeredAt: new Date() },
      });
      submittedAnswers.push({ ...saved, userAnswer: input.userAnswer, correctAnswer: snapshot.answer });
    }
    const answers = await tx.practiceAnswer.findMany({ where: { sessionId: practiceId }, include: { question: { include: questionInclude } } });
    if (completed && !answers.some(answer => hasAnswer(parseStoredAnswer(answer.userAnswerJson)))) throw new WrongBookError(400, '请至少作答一题后再提交。');
    const submittedAt = new Date();
    const entries: RecordWrongOccurrenceInput[] = [];
    let totalCorrect = 0;
    for (const answer of answers) {
      const userAnswer = parseStoredAnswer(answer.userAnswerJson);
      const snapshot = snapshotQuestion(answer.question);
      if (hasAnswer(userAnswer) && snapshot.type !== 'subjective') validateChoiceAnswers(snapshot, userAnswer);
      const isCorrect = hasAnswer(userAnswer) && snapshot.type !== 'subjective' && isCorrectExamAnswer(snapshot, userAnswer);
      if (isCorrect) totalCorrect++;
      if (completed) await tx.practiceAnswer.update({ where: { id: answer.id }, data: { isCorrect } });
      if (completed && hasAnswer(userAnswer) && !isCorrect && snapshot.type !== 'subjective') entries.push({
        userId, questionId: answer.questionId, sourceType: 'practice', sourceSessionId: practiceId,
        sourceAnswerId: answer.id, sourceTitle: `${snapshot.subjectName}练习`, submittedAt,
        userAnswer, correctAnswer: snapshot.answer, snapshot, snapshotStatus: 'captured',
      });
    }
    const updated = await tx.practiceSession.update({ where: { id: practiceId }, data: {
      correctCount: totalCorrect, ...(completed ? { status: 'completed', endTime: submittedAt } : {}),
    } });
    const receipt: PracticeReceipt = {
      session: { id: updated.id, userId, topicIds: JSON.parse(updated.topicIdsJson), totalQuestions: updated.totalQuestions,
        correctCount: totalCorrect, startTime: updated.startTime, endTime: updated.endTime, status: updated.status, submittedAnswers },
      correctCount: totalCorrect, totalCount: answers.filter(answer => hasAnswer(parseStoredAnswer(answer.userAnswerJson))).length, completed,
    };
    if (completed) await enqueueCollection(tx, userId, 'practice', practiceId, entries, receipt);
    return receipt;
  }, { maxWait: 10000, timeout: 30000 });
  return { ...data, ...(completed ? { wrongBookCollection: await collectionForSource(userId, 'practice', practiceId) } : {}) };
}

export async function submitExam(userId: string, submissionId: string, body: Record<string, unknown>) {
  if (body.completed !== undefined && typeof body.completed !== 'boolean') throw new WrongBookError(400, 'completed 必须为布尔值。');
  const requestedCompletion = body.completed === true;
  const data = await prisma.$transaction(async tx => {
    const submission = await tx.examSubmission.findFirst({ where: { id: submissionId, userId }, include: { exam: true } });
    if (!submission) throw new WrongBookError(404, '考试作答不存在。');
    if (submission.status === 'completed' && requestedCompletion) {
      const previous = await receiptFor<ExamReceipt>(tx, userId, 'exam', submissionId);
      if (previous) return previous;
      const questions = await tx.examSubmissionQuestion.findMany({ where: { submissionId } });
      const maxScore = questions.reduce((sum, question) => sum + question.score, 0);
      return { submission: { ...submission, exam: undefined, totalScore: submission.score, maxScore,
        percentScore: maxScore ? Math.round(submission.score / maxScore * 100) : 0 }, completed: true };
    }
    if (submission.status !== 'in_progress') throw new WrongBookError(409, '考试已结束，不能修改答案。');
    const submittedAt = new Date();
    const expired = !!submission.endTime && submittedAt > submission.endTime;
    const completed = requestedCompletion || expired;
    const questions = await tx.examSubmissionQuestion.findMany({ where: { submissionId }, orderBy: { order: 'asc' }, include: { question: { include: questionInclude } } });
    let current = body.questionId ? questions.find(question => question.questionId === body.questionId) : undefined;
    const order = body.order ?? body.questionOrder;
    if (!current && order !== undefined) {
      if (!/^\d+$/.test(String(order))) throw new WrongBookError(400, '题目序号不正确。');
      current = questions.find(question => question.order === Number(order));
    }
    if (!expired && body.answer !== undefined && current) {
      const answer = answerValue(body.answer);
      const snapshot = snapshotQuestion(current.question);
      if (current.shuffledOptionsJson) snapshot.options = parseExamOptions(current.shuffledOptionsJson);
      if (hasAnswer(answer) && snapshot.type !== 'subjective') validateChoiceAnswers(snapshot, answer);
      await tx.examAnswer.upsert({
        where: { submissionId_questionId: { submissionId, questionId: current.questionId } },
        create: { id: randomUUID(), submissionId, questionId: current.questionId, answerJson: JSON.stringify(answer) },
        update: { answerJson: JSON.stringify(answer) },
      });
    } else if (!expired && body.questionId && !current) throw new WrongBookError(400, '题目不属于本次考试。');
    if (!completed && !current) throw new WrongBookError(400, '请提供题目 ID 或序号。');
    const maxScore = questions.reduce((sum, question) => sum + question.score, 0);
    let score = submission.score;
    const entries: RecordWrongOccurrenceInput[] = [];
    if (completed) {
      score = 0;
      const answers = await tx.examAnswer.findMany({ where: { submissionId } });
      for (const question of questions) {
        const saved = answers.find(answer => answer.questionId === question.questionId);
        if (!saved || questionType(question.question.type) === 'subjective') continue;
        const userAnswer = parseStoredAnswer(saved.answerJson);
        if (!hasAnswer(userAnswer)) continue;
        const snapshot = snapshotQuestion(question.question);
        if (question.shuffledOptionsJson) snapshot.options = parseExamOptions(question.shuffledOptionsJson);
        validateChoiceAnswers(snapshot, userAnswer);
        if (isCorrectExamAnswer(snapshot, userAnswer)) score += question.score;
        else entries.push({
          userId, questionId: question.questionId, sourceType: 'exam', sourceSessionId: submissionId,
          sourceAnswerId: saved.id, sourceTitle: submission.exam.name, submittedAt,
          userAnswer, correctAnswer: snapshot.answer, snapshot, snapshotStatus: 'captured',
        });
      }
    }
    const updated = completed ? await tx.examSubmission.update({ where: { id: submissionId }, data: { status: 'completed', score, completedAt: submittedAt } }) : submission;
    const receipt: ExamReceipt = { submission: {
      id: updated.id, examId: updated.examId, userId, startTime: updated.startTime, endTime: updated.endTime,
      status: updated.status, score, completedAt: updated.completedAt, totalScore: score, maxScore,
      percentScore: maxScore ? Math.round(score / maxScore * 100) : 0,
    }, completed };
    if (completed) await enqueueCollection(tx, userId, 'exam', submissionId, entries, receipt);
    return receipt;
  }, { maxWait: 10000, timeout: 30000 });
  return { ...data, ...(data.completed ? { wrongBookCollection: await collectionForSource(userId, 'exam', submissionId) } : {}) };
}

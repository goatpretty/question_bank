import express from 'express';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth.js';
import { prisma } from '../db/prisma.js';
import { submitExam } from '../services/learningSubmission.js';
import { WrongBookError } from '../services/wrongBook.js';
import { readExamRuleGroups, expandExamRules, buildExamPools, examQuestionTypes, ExamRuleError } from '../services/examRules.js';

const router = express.Router();

// ──────────────── Helpers ────────────────

function normalizeQuestionType(type: unknown): 'single' | 'multiple' | 'fill' | 'subjective' {
  const t = String(type || '').toLowerCase().trim();
  if (['single', 'single_choice', 'singlechoice', 'choice', 'radio', 'scq', '单选', '单选题'].includes(t)) return 'single';
  if (['multiple', 'multiple_choice', 'multiplechoice', 'checkbox', 'mcq', '多选', '多选题'].includes(t)) return 'multiple';
  if (['fill', 'blank', 'fill_blank', 'fillblank', 'gap', '填空', '填空题'].includes(t)) return 'fill';
  if (['subjective', 'essay', 'text', '主观', '主观题'].includes(t)) return 'subjective';
  return 'subjective';
}

function parseAnswerValue(value: unknown): string | string[] | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) {
    return value.map(v => String(v).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return '';
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(v => String(v).trim()).filter(Boolean);
      }
      if (parsed === null || parsed === undefined) return null;
      return String(parsed).trim();
    } catch {
      return raw;
    }
  }
  return String(value).trim();
}

function getOptionLabel(index: number): string {
  let label = '';
  let n = index;
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

function normalizeSingleAnswer(answer: string | string[] | null): string {
  if (answer === null || answer === undefined) return '';
  if (Array.isArray(answer)) {
    return answer.length > 0 ? String(answer[0]).trim().toUpperCase() : '';
  }
  return String(answer).trim().toUpperCase();
}

function normalizeAnswerArray(answer: string | string[] | null): string[] {
  if (answer === null || answer === undefined) return [];
  if (Array.isArray(answer)) {
    return [...new Set(answer.map(v => String(v).trim().toUpperCase()).filter(Boolean))].sort();
  }
  const raw = String(answer).trim();
  if (!raw) return [];
  return [...new Set(raw.split(',').map(v => v.trim().toUpperCase()).filter(Boolean))].sort();
}

function gradeAnswer(question: any, userAnswer: string | string[] | null): { isCorrect: boolean; score: number } {
  const normalizedType = normalizeQuestionType(question.type);
  const correctAnswer = parseAnswerValue(question.answer);
  const parsedUserAnswer = parseAnswerValue(userAnswer);

  let isCorrect = false;
  const maxScore = question.score || 0;

  if (normalizedType === 'single') {
    const normalizedCorrect = normalizeSingleAnswer(correctAnswer);
    const normalizedUser = normalizeSingleAnswer(parsedUserAnswer);
    isCorrect = normalizedUser === normalizedCorrect;
  } else if (normalizedType === 'multiple') {
    const normalizedCorrect = normalizeAnswerArray(correctAnswer);
    const normalizedUser = normalizeAnswerArray(parsedUserAnswer);
    isCorrect = normalizedCorrect.join(',') === normalizedUser.join(',');
  } else if (normalizedType === 'fill') {
    isCorrect = String(parsedUserAnswer ?? '').trim().toLowerCase() === String(correctAnswer ?? '').trim().toLowerCase();
  } else {
    // subjective: never auto-correct
    isCorrect = false;
  }


  return { isCorrect, score: isCorrect ? maxScore : 0 };
}

function toFrontendExam(dbExam: any): any {
  return {
    id: dbExam.id,
    name: dbExam.name,
    description: dbExam.description || '',
    duration: dbExam.duration,
    isActive: dbExam.isActive,
    status: dbExam.status,
    createdBy: dbExam.createdBy,
    createdAt: dbExam.createdAt,
    updatedAt: dbExam.updatedAt,
    rules: [],
  };
}

async function toFrontendExamWithRules(dbExam: any): Promise<any> {
  const frontendRules = await readExamRuleGroups(prisma, dbExam.id);
  const questionCount = frontendRules.reduce((total, rule) => total + rule.questionTypes.reduce((sum, spec) => sum + spec.count, 0), 0);
  const totalScore = frontendRules.reduce((total, rule) => total + rule.questionTypes.reduce((sum, spec) => sum + spec.count * spec.score, 0), 0);

  return {
    ...toFrontendExam(dbExam),
    rules: frontendRules,
    questionCount,
    totalScore,
  };
}

// ──────────────── GET / ────────────────
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const pageN = Math.max(1, parseInt(page as string));
    const limitN = Math.max(1, Math.min(100, parseInt(limit as string)));

    const where: any = {};
    if (status === 'unarchived') where.status = { not: 'archived' };
    else if (status) where.status = status;

    const [total, dbExams] = await Promise.all([
      prisma.exam.count({ where }),
      prisma.exam.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pageN - 1) * limitN,
        take: limitN,
      }),
    ]);

    const exams = await Promise.all(dbExams.map(toFrontendExamWithRules));

    res.json({
      success: true,
      data: {
        exams,
        total,
        page: pageN,
        limit: limitN,
      },
    });
  } catch (error) {
    console.error('Get exams error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch exams.' });
  }
});

// ──────────────── POST / ────────────────
router.post('/', authMiddleware, requireRole(['teacher', 'admin']), async (req: AuthRequest, res) => {
  try {
    const { name, description, duration, isActive = true, status = 'draft' } = req.body;
    let { rules = [] } = req.body;

    rules = await expandExamRules(prisma, rules);

    const nameOk = typeof name === 'string' && name.trim().length > 0;
    const dur = parseInt(duration as any) || 60;
    if (!nameOk || !dur) {
      return res.status(400).json({ success: false, error: 'Missing required fields.' });
    }

    const examId = Date.now().toString();

    await prisma.$transaction(async (tx) => {
      await tx.exam.create({
        data: {
          id: examId,
          name,
          description: description || '',
          duration: dur,
          isActive,
          status,
          createdBy: req.user!.id,
        },
      });

      if (Array.isArray(rules) && rules.length > 0) {
        for (const rule of rules) {
          const topicIds: string[] = Array.isArray(rule.topicIds) ? rule.topicIds : [];
          for (const tid of topicIds) {
            await tx.examRule.create({
              data: {
                id: `${examId}_${tid}`,
                examId,
                topicId: tid,
                questionTypesJson: JSON.stringify(rule.questionTypes || []),
              },
            });
          }
        }
      }
    });

    const dbExam = await prisma.exam.findUnique({ where: { id: examId } });
    const frontendExam = dbExam ? await toFrontendExamWithRules(dbExam) : null;

    res.status(201).json({ success: true, data: frontendExam });
  } catch (error) {
    if (error instanceof ExamRuleError) return res.status(400).json({ success: false, error: error.message });
    console.error('Create exam error:', error instanceof Error ? error.message : 'unknown error');
    res.status(500).json({ success: false, error: 'Failed to create exam.' });
  }
});

// ──────────────── GET /history ────────────────
router.get('/history', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { page = 1, limit = 10, includeAbandoned } = req.query;
    const pageN = Math.max(1, parseInt(page as string));
    const limitN = Math.max(1, Math.min(100, parseInt(limit as string)));

    const where: any = { userId, status: 'completed' };
    if (includeAbandoned === 'true') {
      where.status = { in: ['completed', 'abandoned'] };
    }

    const [total, dbSubmissions] = await Promise.all([
      prisma.examSubmission.count({ where }),
      prisma.examSubmission.findMany({
        where,
        include: { exam: true },
        orderBy: { startTime: 'desc' },
        skip: (pageN - 1) * limitN,
        take: limitN,
      }),
    ]);

    // Collect submission IDs
    const submissionIds = dbSubmissions.map((s: any) => s.id);

    // Fetch all submission questions and answers for score recalculation
    const allSubmissionQuestions = await prisma.examSubmissionQuestion.findMany({
      where: { submissionId: { in: submissionIds } },
      include: { question: true },
    });

    // Calculate maxScore from examSubmissionQuestion.score (exam-configured score)
    const maxScoreMap = new Map<string, number>();
    for (const eq of allSubmissionQuestions) {
      const sid = eq.submissionId;
      const current = maxScoreMap.get(sid) || 0;
      maxScoreMap.set(sid, current + (eq.score || 0));
    }

    // Count correct questions per submission (exclude subjective)
    // and recalculate obtainedScore from exam-configured scores
    const allDbAnswers = await prisma.examAnswer.findMany({
      where: { submissionId: { in: submissionIds } },
    });

    const correctCountMap = new Map<string, number>();
    const totalCountMap = new Map<string, number>();
    const obtainedScoreMap = new Map<string, number>();

    for (const ans of allDbAnswers) {
      const sid = ans.submissionId;
      const total = totalCountMap.get(sid) || 0;
      totalCountMap.set(sid, total + 1);

      const eq = allSubmissionQuestions.find(q => q.submissionId === sid && q.questionId === ans.questionId);
      if (!eq) continue;

      const dbQuestion = eq.question;
      if (!dbQuestion) continue;

      const normalizedType = normalizeQuestionType(dbQuestion.type);
      if (normalizedType === 'subjective') continue;

      const correctCount = correctCountMap.get(sid) || 0;

      let correctAnswer: string | string[] | null = null;
      try { correctAnswer = JSON.parse(ans.answerJson); } catch { /* 保留 null */ }

      const gradeResult = gradeAnswer(dbQuestion, correctAnswer);
      if (gradeResult.isCorrect) {
        correctCountMap.set(sid, correctCount + 1);
        const obtained = obtainedScoreMap.get(sid) || 0;
        obtainedScoreMap.set(sid, obtained + (eq.score || 0));
      }
    }

    const submissions = dbSubmissions.map((s: any) => {
      const maxScore = maxScoreMap.get(s.id) || 0;
      const obtainedScore = obtainedScoreMap.get(s.id) || 0;
      const percentScore = maxScore > 0 ? Math.round((obtainedScore / maxScore) * 100) : 0;
      const correctCount = correctCountMap.get(s.id) || 0;
      const totalCount = totalCountMap.get(s.id) || 0;
      return {
        id: s.id,
        examId: s.examId,
        userId: s.userId,
        startTime: s.startTime,
        endTime: s.endTime,
        status: s.status,
        score: obtainedScore,
        completedAt: s.completedAt,
        abandonedAt: s.abandonedAt,
        exam: s.exam ? {
          id: s.exam.id,
          name: s.exam.name,
          duration: s.exam.duration,
        } : null,
        totalScore: maxScore,
        maxScore,
        percentScore,
        correctCount,
        totalCount,
        totalQuestions: totalCount,
        questionCount: `${correctCount}/${totalCount}`,
      };
    });

    res.json({
      success: true,
      data: { submissions, total, page: pageN, limit: limitN },
    });
  } catch (error) {
    console.error('Get exam history error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch exam history.' });
  }
});

// ──────────────── GET /:id ────────────────
router.get('/:id', async (req, res) => {
  try {
    const dbExam = await prisma.exam.findUnique({
      where: { id: req.params.id },
    });
    if (!dbExam) {
      return res.status(404).json({ success: false, error: 'Exam not found.' });
    }

    const frontendExam = await toFrontendExamWithRules(dbExam);

    res.json({
      success: true,
      data: {
        exam: frontendExam,
        questions: [],
      },
    });
  } catch (error) {
    console.error('Get exam error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch exam.' });
  }
});

// ──────────────── PUT /:id ────────────────
router.put('/:id', authMiddleware, requireRole(['teacher', 'admin']), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const dbExam = await prisma.exam.findUnique({ where: { id } });
    if (!dbExam) {
      return res.status(404).json({ success: false, error: 'Exam not found.' });
    }
    if (dbExam.status === 'archived') {
      return res.status(409).json({ success: false, error: '考试已归档，请先恢复为草稿后再编辑。' });
    }

    const payload = req.body || {};
    if (payload.rules !== undefined) payload.rules = await expandExamRules(prisma, payload.rules);

    await prisma.$transaction(async (tx) => {
      await tx.exam.update({
        where: { id },
        data: {
          name: payload.name ?? dbExam.name,
          description: payload.description ?? dbExam.description,
          duration: payload.duration ?? dbExam.duration,
          isActive: payload.isActive ?? dbExam.isActive,
          status: payload.status ?? dbExam.status,
        },
      });

      if (Array.isArray(payload.rules)) {
        await tx.examRule.deleteMany({ where: { examId: id } });
        for (const rule of payload.rules) {
          const topicIds: string[] = Array.isArray(rule.topicIds) ? rule.topicIds : [];
          for (const tid of topicIds) {
            await tx.examRule.create({
              data: {
                id: `${id}_${tid}`,
                examId: id,
                topicId: tid,
                questionTypesJson: JSON.stringify(rule.questionTypes || []),
              },
            });
          }
        }
      }
    });

    const updated = await prisma.exam.findUnique({ where: { id } });
    const frontendExam = updated ? await toFrontendExamWithRules(updated) : null;

    res.json({ success: true, data: frontendExam });
  } catch (error) {
    if (error instanceof ExamRuleError) return res.status(400).json({ success: false, error: error.message });
    console.error('Update exam error:', error instanceof Error ? error.message : 'unknown error');
    res.status(500).json({ success: false, error: 'Failed to update exam.' });
  }
});

// ──────────────── DELETE /:id ────────────────
router.delete('/:id', authMiddleware, requireRole(['teacher', 'admin']), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const dbExam = await prisma.exam.findUnique({ where: { id } });
    if (!dbExam) {
      return res.json({ success: true, message: 'Exam not found, treated as deleted.' });
    }

    // Remove only this exam's records, atomically; shared question-bank content is retained.
    await prisma.$transaction(async (tx) => {
      const submissions = await tx.examSubmission.findMany({ where: { examId: id }, select: { id: true } });
      const submissionIds = submissions.map(submission => submission.id);
      await tx.examAnswer.deleteMany({ where: { submissionId: { in: submissionIds } } });
      await tx.examSubmissionQuestion.deleteMany({ where: { submissionId: { in: submissionIds } } });
      await tx.examSubmission.deleteMany({ where: { examId: id } });
      await tx.examRule.deleteMany({ where: { examId: id } });
      await tx.exam.deleteMany({ where: { id } });
    });

    res.json({ success: true, message: 'Exam deleted.' });
  } catch (error) {
    console.error('Delete exam error:', error);
    res.status(500).json({ success: false, error: '删除考试失败，考试及关联记录未删除，请重试。' });
  }
});

// Archiving keeps every submission and answer; restoring returns the exam to an unpublished draft.
router.post('/:id/archive', authMiddleware, requireRole(['teacher', 'admin']), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const exam = await prisma.exam.findUnique({ where: { id } });
    if (!exam) return res.status(404).json({ success: false, error: '考试不存在。' });
    const archived = await prisma.exam.update({ where: { id }, data: { status: 'archived', isActive: false } });
    res.json({ success: true, data: await toFrontendExamWithRules(archived) });
  } catch (error) {
    console.error('Archive exam error:', error);
    res.status(500).json({ success: false, error: '归档失败，请重试。' });
  }
});

router.post('/:id/restore', authMiddleware, requireRole(['teacher', 'admin']), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const exam = await prisma.exam.findUnique({ where: { id } });
    if (!exam) return res.status(404).json({ success: false, error: '考试不存在。' });
    if (exam.status !== 'archived') return res.status(409).json({ success: false, error: '仅已归档考试可以恢复。' });
    const restored = await prisma.exam.update({ where: { id }, data: { status: 'draft', isActive: true } });
    res.json({ success: true, data: await toFrontendExamWithRules(restored) });
  } catch (error) {
    console.error('Restore exam error:', error);
    res.status(500).json({ success: false, error: '恢复失败，请重试。' });
  }
});

// ──────────────── POST /:id/publish ────────────────
router.post('/:id/publish', authMiddleware, requireRole(['teacher', 'admin']), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const dbExam = await prisma.exam.findUnique({ where: { id } });
    if (!dbExam) return res.status(404).json({ success: false, error: 'Exam not found.' });
    if (dbExam.status === 'archived') return res.status(409).json({ success: false, error: '考试已归档，请先恢复为草稿后再发布。' });
    const pools = await buildExamPools(prisma, id);
    if (pools.some(pool => pool.questions.length < pool.count)) return res.status(400).json({ success: false, error: '部分规则范围内的题目不足，请调整抽题数量后再发布。' });

    const updated = await prisma.exam.update({
      where: { id },
      data: { status: 'published', isActive: true },
    });

    res.json({ success: true, data: await toFrontendExamWithRules(updated) });
  } catch (error) {
    console.error('Publish exam error:', error);
    if (error instanceof ExamRuleError) return res.status(400).json({ success: false, error: error.message });
    res.status(500).json({ success: false, error: 'Failed to publish exam.' });
  }
});

// ──────────────── POST /:id/unpublish ────────────────
router.post('/:id/unpublish', authMiddleware, requireRole(['teacher', 'admin']), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const dbExam = await prisma.exam.findUnique({ where: { id } });
    if (!dbExam) return res.status(404).json({ success: false, error: 'Exam not found.' });
    if (dbExam.status === 'archived') return res.status(409).json({ success: false, error: '考试已归档，请先恢复为草稿。' });

    const updated = await prisma.exam.update({
      where: { id },
      data: { status: 'draft' },
    });

    res.json({ success: true, data: await toFrontendExamWithRules(updated) });
  } catch (error) {
    console.error('Unpublish exam error:', error);
    res.status(500).json({ success: false, error: 'Failed to unpublish exam.' });
  }
});

// ──────────────── GET /:id/preview ────────────────
router.get('/:id/preview', authMiddleware, requireRole(['teacher', 'admin']), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const dbExam = await prisma.exam.findUnique({ where: { id } });
    if (!dbExam) return res.status(404).json({ success: false, error: 'Exam not found.' });

    const pools = await buildExamPools(prisma, id);
    const allTopicIds = [...new Set(pools.flatMap(pool => pool.topicIds))];
    const byType = await Promise.all(examQuestionTypes.map(async type => ({
      type,
      required: pools.filter(pool => pool.type === type).reduce((sum, pool) => sum + pool.count, 0),
      available: await prisma.question.count({ where: { topicId: { in: allTopicIds }, type } }),
    })));
    const totalRequired = byType.reduce((sum, row) => sum + row.required, 0);
    const totalAvailable = byType.reduce((sum, row) => sum + row.available, 0);
    const labels = { single: '单选题', multiple: '多选题', fill: '填空题', subjective: '主观题' };
    const warnings = pools.filter(pool => pool.questions.length < pool.count).map(pool =>
      labels[pool.type] + '在对应规则范围内仅有 ' + pool.questions.length + ' 题，少于需求 ' + pool.count + ' 题');

    res.json({ success: true, data: { byType, totalRequired, totalAvailable, warnings } });
  } catch (error) {
    if (error instanceof ExamRuleError) return res.status(400).json({ success: false, error: error.message });
    console.error('Preview exam error:', error);
    res.status(500).json({ success: false, error: 'Failed to preview exam.' });
  }
});

// ──────────────── POST /:id/start ────────────────
router.post('/:id/start', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const dbExam = await prisma.exam.findUnique({ where: { id } });
    if (!dbExam) {
      return res.status(404).json({ success: false, error: 'Exam not found.' });
    }
    if (dbExam.status !== 'published' || !dbExam.isActive) {
      return res.status(400).json({ success: false, error: 'Exam is not available.' });
    }

    const pools = await buildExamPools(prisma, id);
    const selectedQuestions: Array<{ question: any; score: number }> = [];
    const selectedIds = new Set<string>();
    for (const pool of pools) {
      const available = pool.questions.filter(question => !selectedIds.has(question.id));
      if (available.length < pool.count) {
        return res.status(400).json({ success: false, error: '对应规则范围内的题目不足，请调整抽题数量。' });
      }
      // Fisher-Yates gives each question the same chance of selection.
      for (let i = available.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [available[i], available[j]] = [available[j], available[i]];
      }
      for (const question of available.slice(0, pool.count)) {
        selectedIds.add(question.id);
        selectedQuestions.push({ question, score: pool.score });
      }
    }

    const typeOrder: Record<string, number> = { single: 0, multiple: 1, fill: 2, subjective: 3 };
    selectedQuestions.sort((a, b) => {
      const ta = typeOrder[a.question.type] ?? 99;
      const tb = typeOrder[b.question.type] ?? 99;
      return ta - tb;
    });

    const submissionId = Date.now().toString();
    const submissionQuestions: any[] = [];

    await prisma.$transaction(async (tx) => {
      await tx.examSubmission.create({
        data: {
          id: submissionId,
          examId: id,
          userId,
          status: 'in_progress',
          score: 0,
          startTime: new Date(),
          endTime: new Date(Date.now() + dbExam.duration * 60 * 1000),
        },
      });

      for (let i = 0; i < selectedQuestions.length; i++) {
        const { question, score } = selectedQuestions[i];
        let shuffledOptionsJson: string | null = null;

        if (question.options && question.options.length > 0) {
          const shuffled = [...question.options].sort(() => Math.random() - 0.5);
          const displayOptions = shuffled.map((opt: any, idx: number) => ({
            optionId: opt.optionId,
            content: opt.content,
            displayLabel: getOptionLabel(idx),
          }));
          shuffledOptionsJson = JSON.stringify(displayOptions);
        }

        await tx.examSubmissionQuestion.create({
          data: {
            submissionId,
            questionId: question.id,
            order: i + 1,
            score,
            shuffledOptionsJson,
          },
        });

        submissionQuestions.push({
          questionId: question.id,
          order: i + 1,
          score,
          shuffledOptionsJson,
        });
      }
    });

    res.status(201).json({
      success: true,
      data: {
        id: submissionId,
        examId: id,
        userId,
        startTime: new Date(),
        endTime: new Date(Date.now() + dbExam.duration * 60 * 1000),
        status: 'in_progress',
        score: 0,
        answers: [],
        questions: submissionQuestions.map((q: any) => ({
          questionId: q.questionId,
          order: q.order,
          shuffledOptions: q.shuffledOptionsJson ? JSON.parse(q.shuffledOptionsJson) : undefined,
        })),
      },
    });
  } catch (error) {
    if (error instanceof ExamRuleError) return res.status(400).json({ success: false, error: error.message });
    console.error('Start exam error:', error);
    res.status(500).json({ success: false, error: 'Failed to start exam.' });
  }
});

// ──────────────── GET /submission/:submissionId/question/:order ────────────────
router.get('/submission/:submissionId/question/:order', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { submissionId, order } = req.params;
    const userId = req.user!.id;
    const orderN = parseInt(order);

    const submission = await prisma.examSubmission.findFirst({
      where: { id: submissionId, userId },
    });
    if (!submission) {
      return res.status(404).json({ success: false, error: 'Submission not found.' });
    }
    if (submission.status !== 'in_progress') {
      return res.status(400).json({ success: false, error: 'Submission is not in progress.' });
    }

    const examSubQ = await prisma.examSubmissionQuestion.findFirst({
      where: { submissionId, order: orderN },
    });
    if (!examSubQ) {
      return res.status(404).json({ success: false, error: 'Question not found.' });
    }

    const dbQuestion = await prisma.question.findUnique({
      where: { id: examSubQ.questionId },
      include: { options: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!dbQuestion) {
      return res.status(404).json({ success: false, error: 'Question data not found.' });
    }

    const dbAnswer = await prisma.examAnswer.findFirst({
      where: { submissionId, questionId: dbQuestion.id },
    });

    // 考试进行中不下发标准答案与解析，避免通过接口直接读取
    const displayQuestion: any = {
      id: dbQuestion.id,
      topicId: dbQuestion.topicId,
      type: dbQuestion.type,
      content: dbQuestion.content,
      options: [],
      difficulty: dbQuestion.difficulty || 1,
      score: dbQuestion.score || 5,
      tags: JSON.parse(dbQuestion.tags || '[]'),
    };

    if (examSubQ.shuffledOptionsJson) {
      const parsed = JSON.parse(examSubQ.shuffledOptionsJson);
      displayQuestion.options = parsed.map((o: any) => ({
        id: o.optionId,
        content: o.content,
        displayLabel: o.displayLabel,
      }));
    } else {
      const shuffled = [...dbQuestion.options].sort(() => Math.random() - 0.5);
      displayQuestion.options = shuffled.map((opt: any, idx: number) => ({
        id: opt.optionId,
        content: opt.content,
        displayLabel: getOptionLabel(idx),
      }));
    }

    const totalQuestions = await prisma.examSubmissionQuestion.count({ where: { submissionId } });

    res.json({
      success: true,
      data: {
        question: displayQuestion,
        order: examSubQ.order,
        totalQuestions,
        userAnswer: dbAnswer ? JSON.parse(dbAnswer.answerJson) : null,
      },
    });
  } catch (error) {
    console.error('Get exam question error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch exam question.' });
  }
});

// ──────────────── POST /submission/:submissionId/answer ────────────────
router.post('/submission/:submissionId/answer', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const data = await submitExam(req.user!.id, String(req.params.submissionId), req.body || {});
    res.json({ success: true, data });
  } catch (error) {
    res.status(error instanceof WrongBookError ? error.status : 500).json({
      success: false, error: error instanceof WrongBookError ? error.message : '考试提交失败，请重试。',
    });
  }
});

// ──────────────── POST /submission/:submissionId/abandon ────────────────
router.post('/submission/:submissionId/abandon', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { submissionId } = req.params;
    const userId = req.user!.id;

    const submission = await prisma.examSubmission.findFirst({
      where: { id: submissionId, userId },
    });
    if (!submission) {
      return res.status(404).json({ success: false, error: 'Submission not found.' });
    }
    if (submission.status !== 'in_progress') {
      return res.status(400).json({ success: false, error: 'Submission is already completed or abandoned.' });
    }

    const abandonedAt = new Date();
    await prisma.examSubmission.update({
      where: { id: submissionId },
      data: { status: 'abandoned', abandonedAt },
    });

    res.json({
      success: true,
      data: {
        id: submissionId,
        examId: submission.examId,
        userId: submission.userId,
        startTime: submission.startTime,
        endTime: submission.endTime,
        status: 'abandoned',
        score: submission.score,
        abandonedAt,
      },
    });
  } catch (error) {
    console.error('Abandon exam error:', error);
    res.status(500).json({ success: false, error: 'Failed to abandon exam.' });
  }
});

// ──────────────── GET /submission/:submissionId/result ────────────────
router.get('/submission/:submissionId/result', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { submissionId } = req.params;
    const userId = req.user!.id;

    const submission = await prisma.examSubmission.findFirst({
      where: { id: submissionId, userId },
      include: { exam: true },
    });
    if (!submission) {
      return res.status(404).json({ success: false, error: 'Submission not found.' });
    }
    if (submission.status !== 'completed') {
      return res.status(400).json({ success: false, error: 'Submission is not completed.' });
    }

    const submissionQuestions = await prisma.examSubmissionQuestion.findMany({
      where: { submissionId },
      orderBy: { order: 'asc' },
    });

    const dbAnswers = await prisma.examAnswer.findMany({
      where: { submissionId },
    });

    const results: any[] = [];
    let totalMaxScore = 0;
    let correctCount = 0;
    let totalCount = 0;

    for (const eq of submissionQuestions) {
      const dbQuestion = await prisma.question.findUnique({
        where: { id: eq.questionId },
        include: { options: { orderBy: { sortOrder: 'asc' } } },
      });
      if (!dbQuestion) continue;
      const normalizedType = normalizeQuestionType(dbQuestion.type);
      if (normalizedType !== 'subjective') {
        totalCount++;
      }
      totalMaxScore += eq.score || 0;

      const dbAnswer = dbAnswers.find(a => a.questionId === eq.questionId);

      const gradeResult = gradeAnswer(dbQuestion, dbAnswer ? JSON.parse(dbAnswer.answerJson) : null);
      if (gradeResult.isCorrect && normalizedType !== 'subjective') {
        correctCount++;
      }

      let optionsWithLabels: any[] = [];
      let correctDisplay: string | string[] = JSON.parse(dbQuestion.answer);
      let userDisplay: string | string[] | null = dbAnswer ? JSON.parse(dbAnswer.answerJson) : null;

      if (dbQuestion.options && dbQuestion.options.length > 0) {
        let displayOptions: any[];
        if (eq.shuffledOptionsJson) {
          displayOptions = JSON.parse(eq.shuffledOptionsJson);
        } else {
          displayOptions = dbQuestion.options.map((opt: any, idx: number) => ({
            optionId: opt.optionId,
            content: opt.content,
            displayLabel: getOptionLabel(idx),
          }));
        }

        optionsWithLabels = displayOptions.map((o: any) => ({
          id: o.optionId,
          content: o.content,
          displayLabel: o.displayLabel,
        }));

        const optMap = new Map<string, string>();
        displayOptions.forEach((opt: any) => {
          optMap.set(opt.optionId, opt.displayLabel);
        });

        const ca = JSON.parse(dbQuestion.answer);
        correctDisplay = Array.isArray(ca) ? ca.map((id: string) => optMap.get(id) ?? id) : (optMap.get(String(ca)) ?? String(ca));

        if (dbAnswer) {
          const ua = JSON.parse(dbAnswer.answerJson);
          userDisplay = Array.isArray(ua) ? ua.map((id: string) => optMap.get(id) ?? id) : (optMap.get(String(ua)) ?? String(ua));
        }
      }

      results.push({
        questionId: dbQuestion.id,
        order: eq.order,
        type: dbQuestion.type,
        content: dbQuestion.content,
        options: optionsWithLabels,
        correctAnswer: correctDisplay,
        userAnswer: userDisplay,
        isCorrect: gradeResult.isCorrect,
        score: gradeResult.isCorrect ? (eq.score || 0) : 0,
        maxScore: eq.score || 0,
        analysis: dbQuestion.analysis || '暂无解析',
      });
    }

    const percentScore = totalMaxScore > 0 ? Math.round((submission.score / totalMaxScore) * 100) : 0;

    res.json({
      success: true,
      data: {
        submission: {
          id: submission.id,
          examId: submission.examId,
          userId: submission.userId,
          startTime: submission.startTime,
          endTime: submission.endTime,
          status: submission.status,
          score: submission.score,
          completedAt: submission.completedAt,
        },
        results,
        totalScore: submission.score,
        maxScore: totalMaxScore,
        percentScore,
        correctCount,
        totalCount,
        questionCount: `${correctCount}/${totalCount}`,
      },
    });
  } catch (error) {
    console.error('Get exam result error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch exam result.' });
  }
});

export { router as examRouter };

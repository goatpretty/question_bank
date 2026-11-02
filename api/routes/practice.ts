import express from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db/prisma.js';
import { submitPractice } from '../services/learningSubmission.js';
import { WrongBookError } from '../services/wrongBook.js';

const router = express.Router();

// ============================================
// Map Prisma PracticeSession to frontend-compatible shape
// ============================================

function toFrontendSession(dbSession: any): any {
  return {
    id: dbSession.id,
    userId: dbSession.userId,
    topicIds: JSON.parse(dbSession.topicIdsJson || '[]'),
    totalQuestions: dbSession.totalQuestions,
    correctCount: dbSession.correctCount,
    startTime: dbSession.startTime,
    endTime: dbSession.endTime,
    status: dbSession.status,
  };
}

// ============================================
// Map Prisma Question + options to frontend shape
// ============================================

function toFrontendQuestion(dbQ: any): any {
  const opts = (dbQ.options || []).map((o: any) => ({
    id: o.optionId,
    content: o.content,
  }));
  return {
    id: dbQ.id,
    topicId: dbQ.topicId,
    type: dbQ.type,
    content: dbQ.content,
    options: opts.length > 0 ? opts : undefined,
    answer: JSON.parse(dbQ.answer),
    analysis: dbQ.analysis || '',
    difficulty: dbQ.difficulty || 1,
    score: dbQ.score || 5,
    tags: JSON.parse(dbQ.tags || '[]'),
    createdAt: dbQ.createdAt,
    updatedAt: dbQ.updatedAt,
  };
}

// ============================================
// Routes
// ============================================

// POST /api/practice/start
router.post('/start', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { topicIds, questionCount } = req.body;
    const userId = req.user!.id;

    if (!topicIds || !Array.isArray(topicIds) || topicIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Topic IDs are required.'
      });
    }

    const count = questionCount || 20;

    // Resolve effective topic IDs: if a topic has children, use children
    const effectiveTopicIds = new Set<string>();
    for (const tid of topicIds) {
      const topic = await prisma.topic.findUnique({ where: { id: tid } });
      if (!topic) continue;
      if (!topic.parentId) {
        // course: use child chapters
        const children = await prisma.topic.findMany({ where: { parentId: tid } });
        children.forEach(ch => effectiveTopicIds.add(ch.id));
      } else {
        effectiveTopicIds.add(tid);
      }
    }

    if (effectiveTopicIds.size === 0) {
      return res.status(404).json({
        success: false,
        error: 'No valid topics found.'
      });
    }

    // Query questions from Prisma
    const dbQuestions = await prisma.question.findMany({
      where: { topicId: { in: [...effectiveTopicIds] } },
      include: { options: { orderBy: { sortOrder: 'asc' } } },
    });

    if (dbQuestions.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No questions available for the selected topics.'
      });
    }

    // Create session with all questions
    const sessionId = Date.now().toString();
    const allQuestionIds = dbQuestions.map(q => q.id);

    const session = await prisma.$transaction(async (tx) => {
      return tx.practiceSession.create({
        data: {
          id: sessionId,
          userId,
          totalQuestions: Math.min(count, dbQuestions.length),
          correctCount: 0,
          status: 'in_progress',
          topicIdsJson: JSON.stringify([...effectiveTopicIds]),
          servedQuestionsJson: JSON.stringify(allQuestionIds),
        },
      });
    });

    res.status(201).json({
      success: true,
      data: toFrontendSession(session)
    });
  } catch (error) {
    console.error('Start practice error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start practice session.'
    });
  }
});

// GET /api/practice/question/:sessionId
router.get('/question/:sessionId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user!.id;

    const session = await prisma.practiceSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Practice session not found.'
      });
    }

    if (session.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        error: 'Practice session is not in progress.'
      });
    }

    // Get served question IDs from session
    const servedIds: string[] = JSON.parse(session.servedQuestionsJson || '[]');
    if (servedIds.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No questions available.'
      });
    }

    // Get already answered question IDs
    const answered = await prisma.practiceAnswer.findMany({
      where: { sessionId },
      select: { questionId: true },
    });
    const answeredIds = new Set(answered.map(a => a.questionId));

    // Find first unanswered question from served list
    let nextQuestionId: string | null = null;
    for (const qid of servedIds) {
      if (!answeredIds.has(qid)) {
        nextQuestionId = qid;
        break;
      }
    }

    if (!nextQuestionId) {
      return res.status(404).json({
        success: false,
        error: 'No more questions available.',
        noMoreQuestions: true,
      });
    }

    const dbQ = await prisma.question.findUnique({
      where: { id: nextQuestionId },
      include: { options: { orderBy: { sortOrder: 'asc' } } },
    });

    if (!dbQ) {
      return res.status(404).json({
        success: false,
        error: 'Question not found.'
      });
    }

    // Remove the returned question from servedQuestionsJson so it won't be returned again
    const remainingServedIds = servedIds.filter(id => id !== nextQuestionId);
    await prisma.practiceSession.update({
      where: { id: sessionId },
      data: { servedQuestionsJson: JSON.stringify(remainingServedIds) },
    });

    res.json({
      success: true,
      data: toFrontendQuestion(dbQ)
    });
  } catch (error) {
    console.error('Get practice question error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch practice question.'
    });
  }
});

// POST /api/practice/submit
router.post('/submit', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { practiceId, answers, completed = false } = req.body || {};
    if (typeof practiceId !== 'string' || !practiceId || typeof completed !== 'boolean') {
      return res.status(400).json({ success: false, error: '练习 ID 或 completed 参数不正确。' });
    }
    const data = await submitPractice(req.user!.id, practiceId, answers, completed);
    res.json({ success: true, data });
  } catch (error) {
    res.status(error instanceof WrongBookError ? error.status : 500).json({
      success: false, error: error instanceof WrongBookError ? error.message : '练习提交失败，请重试。',
    });
  }
});

// POST /api/practice/:sessionId/end
router.post('/:sessionId/end', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const sessionId = String(req.params.sessionId);
    const userId = req.user!.id;
    const status = req.body?.status ?? 'completed';
    if (status === 'completed') {
      const result = await submitPractice(userId, sessionId, [], true);
      return res.json({ success: true, data: { ...result.session, wrongBookCollection: result.wrongBookCollection } });
    }
    if (status !== 'abandoned') throw new WrongBookError(400, '结束状态不支持。');
    const session = await prisma.practiceSession.findFirst({ where: { id: sessionId, userId } });
    if (!session) throw new WrongBookError(404, '练习不存在。');
    if (session.status !== 'in_progress') throw new WrongBookError(409, '练习已结束。');
    await prisma.practiceSession.updateMany({ where: { id: sessionId, userId, status: 'in_progress' }, data: { status: 'abandoned', endTime: new Date() } });
    const updated = await prisma.practiceSession.findUniqueOrThrow({ where: { id: sessionId } });
    res.json({ success: true, data: toFrontendSession(updated) });
  } catch (error) {
    res.status(error instanceof WrongBookError ? error.status : 500).json({
      success: false, error: error instanceof WrongBookError ? error.message : '结束练习失败，请重试。',
    });
  }
});

// GET /api/practice/session/:id
router.get('/session/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const session = await prisma.practiceSession.findFirst({
      where: { id, userId },
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Practice session not found.'
      });
    }

    const dbAnswers = await prisma.practiceAnswer.findMany({
      where: { sessionId: id },
      orderBy: { answeredAt: 'asc' },
    });

    const answers = dbAnswers.map((a: any) => ({
      id: a.id,
      sessionId: a.sessionId,
      questionId: a.questionId,
      userAnswer: JSON.parse(a.userAnswerJson),
      isCorrect: a.isCorrect,
      answeredAt: a.answeredAt,
    }));

    res.json({
      success: true,
      data: {
        session: toFrontendSession(session),
        answers
      }
    });
  } catch (error) {
    console.error('Get practice session error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch practice session.'
    });
  }
});

// GET /api/practice/result/:sessionId
router.get('/result/:sessionId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user!.id;

    const session = await prisma.practiceSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'Practice session not found.' });
    }

    // Get topic IDs and resolve effective chapter IDs
    const topicIds: string[] = JSON.parse(session.topicIdsJson || '[]');
    const effectiveTopicIds = new Set<string>();
    for (const tid of topicIds) {
      const topic = await prisma.topic.findUnique({ where: { id: tid } });
      if (!topic) continue;
      if (!topic.parentId) {
        const children = await prisma.topic.findMany({ where: { parentId: tid } });
        children.forEach(ch => effectiveTopicIds.add(ch.id));
      } else {
        effectiveTopicIds.add(tid);
      }
    }

    // Get all questions for this session
    const dbQuestions = await prisma.question.findMany({
      where: { topicId: { in: [...effectiveTopicIds] } },
      include: { options: { orderBy: { sortOrder: 'asc' } } },
    });

    // Get answered questions
    const dbAnswers = await prisma.practiceAnswer.findMany({
      where: { sessionId },
    });
    const answerMap = new Map<string, any>();
    dbAnswers.forEach(a => answerMap.set(a.questionId, a));

    // Build results
    const results = dbQuestions.map((question: any) => {
      const answered = answerMap.get(question.id);
      const displayQuestion = toFrontendQuestion(question);

      if (answered) {
        return {
          question: displayQuestion,
          userAnswer: JSON.parse(answered.userAnswerJson),
          correctAnswer: displayQuestion.answer,
          isCorrect: answered.isCorrect,
        };
      } else {
        return {
          question: displayQuestion,
          userAnswer: null,
          correctAnswer: displayQuestion.answer,
          isCorrect: false,
        };
      }
    });

    const total = dbAnswers.length;
    const correct = dbAnswers.filter(a => a.isCorrect).length;

    res.json({
      success: true,
      data: {
        session: toFrontendSession(session),
        results,
        total,
        correct,
        totalQuestions: session.totalQuestions
      }
    });
  } catch (error) {
    console.error('Get practice result error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch practice result.' });
  }
});

// GET /api/practice/history
router.get('/history', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { page = 1, limit = 10 } = req.query;

    const pageN = Math.max(1, parseInt(page as string));
    const limitN = Math.max(1, Math.min(100, parseInt(limit as string)));

    const total = await prisma.practiceSession.count({
      where: { userId, status: 'completed' },
    });

    const dbSessions = await prisma.practiceSession.findMany({
      where: { userId, status: 'completed' },
      orderBy: { startTime: 'desc' },
      skip: (pageN - 1) * limitN,
      take: limitN,
    });

    const sessions = dbSessions.map(toFrontendSession);

    res.json({
      success: true,
      data: {
        sessions,
        total,
        page: pageN,
        limit: limitN
      }
    });
  } catch (error) {
    console.error('Get practice history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch practice history.'
    });
  }
});

export { router as practiceRouter };

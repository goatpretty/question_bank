import express from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { Question, QuestionType, PracticeSession, PracticeAnswer } from '@/shared/types';
import { questions, topics } from './questions.js';
const router = express.Router();

const practiceSessions: PracticeSession[] = [];
const practiceAnswers: PracticeAnswer[] = [];
const servedQuestionIdsBySession: Record<string, Set<string>> = {};

router.post('/start', authMiddleware, (req: AuthRequest, res) => {
  try {
    const { topicIds, questionCount, difficultyRange } = req.body;
    const userId = req.user!.id;

    if (!topicIds || !questionCount) {
      return res.status(400).json({
        success: false,
        error: 'Topic IDs and question count are required.'
      });
    }

    const newSession: PracticeSession = {
      id: Date.now().toString(),
      userId,
      topicIds,
      totalQuestions: questionCount,
      correctCount: 0,
      startTime: new Date(),
      status: 'in_progress'
    };

    practiceSessions.push(newSession);
    servedQuestionIdsBySession[newSession.id] = new Set<string>();

    res.status(201).json({
      success: true,
      data: newSession
    });
  } catch (error) {
    console.error('Start practice error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start practice session.'
    });
  }
});

router.post('/submit', authMiddleware, (req: AuthRequest, res) => {
  try {
    const { practiceId, answers, completed = false } = req.body;
    const userId = req.user!.id;

    const session = practiceSessions.find(s => s.id === practiceId && s.userId === userId);
    
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

    let correctCount = 0;
    const submittedAnswers: PracticeAnswer[] = [];

    for (const answer of answers) {
      const isCorrect = checkAnswer(answer.questionId, answer.userAnswer);
      if (isCorrect) correctCount++;

      const existing = practiceAnswers.find(a => a.sessionId === practiceId && a.questionId === answer.questionId);
      if (existing) {
        existing.userAnswer = answer.userAnswer;
        existing.isCorrect = isCorrect;
        existing.answeredAt = new Date();
        submittedAnswers.push(existing);
      } else {
        const practiceAnswer: PracticeAnswer = {
          id: Date.now().toString() + Math.random(),
          sessionId: practiceId,
          questionId: answer.questionId,
          userAnswer: answer.userAnswer,
          isCorrect,
          answeredAt: new Date()
        };
        submittedAnswers.push(practiceAnswer);
        practiceAnswers.push(practiceAnswer);
      }
    }

    const totalCorrect = practiceAnswers.filter(a => a.sessionId === practiceId && a.isCorrect).length;
    session.correctCount = totalCorrect;
    
    if (completed) {
      session.status = 'completed';
      session.endTime = new Date();
    }

    // 统计当前会话已提交答案总数（包含本次提交）
    const totalAnswered = practiceAnswers.filter(a => a.sessionId === practiceId).length;

    res.json({
      success: true,
      data: {
        session: {
          ...session,
          submittedAnswers
        },
        correctCount,
        totalCount: totalAnswered
      }
    });
  } catch (error) {
    console.error('Submit practice error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit practice answers.'
    });
  }
});

router.get('/session/:id', authMiddleware, (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const session = practiceSessions.find(s => s.id === id && s.userId === userId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Practice session not found.'
      });
    }

    const answers = practiceAnswers.filter(a => a.sessionId === id);

    res.json({
      success: true,
      data: {
        session,
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

router.get('/result/:sessionId', authMiddleware, (req: AuthRequest, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user!.id;

    const session = practiceSessions.find(s => s.id === sessionId && s.userId === userId);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Practice session not found.' });
    }

    const answers = practiceAnswers.filter(a => a.sessionId === sessionId);
    const results = answers.map(a => {
      const question = questions.find(q => q.id === a.questionId);
      return {
        question,
        userAnswer: a.userAnswer,
        correctAnswer: question ? question.answer : null,
        isCorrect: a.isCorrect
      };
    });

    const total = answers.length;
    const correct = answers.filter(a => a.isCorrect).length;

    res.json({
      success: true,
      data: {
        session: {
          ...session,
          correctCount: correct
        },
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

router.get('/question/:sessionId', authMiddleware, (req: AuthRequest, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user!.id;

    const session = practiceSessions.find(s => s.id === sessionId && s.userId === userId);
    
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

    // Get questions based on session criteria
    const { topicIds } = session;
    const effectiveIds = new Set<string>();
    for (const id of topicIds) {
      const t = topics.find(tp => tp.id === id);
      if (t && !t.parentId) {
        // course id: include child chapters
        topics.filter(tp => tp.parentId === id).forEach(tp => effectiveIds.add(tp.id));
      } else {
        effectiveIds.add(id);
      }
    }
    const availableQuestions = questions.filter((q: Question) => effectiveIds.has(q.topicId));
    
    if (availableQuestions.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No questions available.'
      });
    }

    // Select a random question that hasn't been answered yet
    const answeredQuestionIds = practiceAnswers
      .filter(a => a.sessionId === sessionId)
      .map(a => a.questionId);
    const servedSet = servedQuestionIdsBySession[sessionId] || new Set<string>();
    
    const unansweredQuestions = availableQuestions.filter(
      (q: Question) => !answeredQuestionIds.includes(q.id) && !servedSet.has(q.id)
    );

    if (unansweredQuestions.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No more questions available.'
      });
    }

    const randomQuestion = unansweredQuestions[Math.floor(Math.random() * unansweredQuestions.length)];
    servedSet.add(randomQuestion.id);
    servedQuestionIdsBySession[sessionId] = servedSet;

    const displayQuestion: Question = {
      ...randomQuestion,
      options: randomQuestion.options ? [...randomQuestion.options].sort(() => Math.random() - 0.5) : undefined
    };

    res.json({
      success: true,
      data: displayQuestion
    });
  } catch (error) {
    console.error('Get practice question error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch practice question.'
    });
  }
});

router.get('/history', authMiddleware, (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { page = 1, limit = 10 } = req.query;

    const userSessions = practiceSessions
      .filter(s => s.userId === userId)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

    const startIndex = (parseInt(page as string) - 1) * parseInt(limit as string);
    const endIndex = startIndex + parseInt(limit as string);
    
    const paginatedSessions = userSessions.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        sessions: paginatedSessions,
        total: userSessions.length,
        page: parseInt(page as string),
        limit: parseInt(limit as string)
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

function checkAnswer(questionId: string, userAnswer: string | string[]): boolean {
  const question = questions.find(q => q.id === questionId);
  if (!question) return false;
  if (Array.isArray(question.answer)) {
    if (!Array.isArray(userAnswer)) return false;
    const expected = [...question.answer].map(a => String(a)).sort();
    const received = [...userAnswer].map(a => String(a)).sort();
    if (expected.length !== received.length) return false;
    for (let i = 0; i < expected.length; i++) {
      if (expected[i] !== received[i]) return false;
    }
    return true;
  } else {
    if (Array.isArray(userAnswer)) return false;
    return String(question.answer).toLowerCase().trim() === String(userAnswer).toLowerCase().trim();
  }
}

export { router as practiceRouter };

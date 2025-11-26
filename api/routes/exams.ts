import express from 'express';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth.js';
import { questions, topics } from './questions.js';
import { Question, QuestionType } from '@/shared/types';

interface ExamRuleTypeSpec {
  type: QuestionType;
  count: number;
  score: number;
}

interface ExamRuleSpec {
  topicIds: string[]; // 多章节ID集合
  questionTypes: ExamRuleTypeSpec[];
}

interface Exam {
  id: string;
  name: string;
  description?: string;
  duration: number; // minutes
  rules: ExamRuleSpec[];
  isActive: boolean;
  createdBy: string;
  status: 'draft' | 'published';
  createdAt: Date;
  updatedAt: Date;
}

interface ExamQuestion {
  id: string;
  examId: string;
  submissionId: string;
  questionId: string;
  order: number;
  score: number;
}

interface ExamAnswer {
  id: string;
  submissionId: string;
  questionId: string;
  answer: string | string[];
  createdAt: Date;
  updatedAt: Date;
}

interface ExamSubmission {
  id: string;
  examId: string;
  userId: string;
  startTime: Date;
  endTime: Date;
  status: 'in_progress' | 'completed';
  score: number;
  answers: ExamAnswer[];
  completedAt?: Date;
}

const router = express.Router();

const exams: Exam[] = [];
const examQuestions: ExamQuestion[] = [];
const examSubmissions: ExamSubmission[] = [];
const examAnswers: ExamAnswer[] = [];

router.get('/', (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    let filteredExams = exams;
    if (status) {
      filteredExams = filteredExams.filter(e => e.status === status);
    }
    
    const startIndex = (parseInt(page as string) - 1) * parseInt(limit as string);
    const endIndex = startIndex + parseInt(limit as string);
    
    const paginatedExams = filteredExams.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      data: {
        exams: paginatedExams,
        total: filteredExams.length,
        page: parseInt(page as string),
        limit: parseInt(limit as string)
      }
    });
  } catch (error) {
    console.error('Get exams error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch exams.'
    });
  }
});

router.post('/', authMiddleware, requireRole(['teacher', 'admin']), (req: AuthRequest, res) => {
  try {
    let { name, description, duration, rules = [], isActive = true, status = 'draft' } = req.body;
    // 兼容前端发送的 subjectId + chapterIds 结构：展开为后端规则
    if (Array.isArray(rules) && rules.length > 0) {
      const expanded: ExamRuleSpec[] = [];
      for (const r of rules) {
        const subjectIds: string[] = Array.isArray(r.subjectIds)
          ? r.subjectIds
          : r.subjectId
            ? [r.subjectId]
            : [];
        let chs: string[] = Array.isArray(r.chapterIds)
          ? r.chapterIds
          : Array.isArray(r.topicIds)
            ? r.topicIds
            : r.topicId
              ? [r.topicId]
              : [];
        if (subjectIds.length > 0) {
          const fromSubjects = subjectIds.flatMap((sid: string) => topics.filter((t: any) => t.parentId === sid).map((t: any) => t.id));
          chs = Array.from(new Set([...(chs || []), ...fromSubjects]));
        }
        expanded.push({ topicIds: chs, questionTypes: Array.isArray(r.questionTypes) ? r.questionTypes : [] });
      }
      rules = expanded;
    }
    // 宽松校验：允许空规则保存，后续开始考试时再校验题量
    const nameOk = typeof name === 'string' && name.trim().length > 0;
    const dur = parseInt(duration as any) || 60;
    if (!nameOk || !dur) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields.'
      });
    }
    const newExam: Exam = {
      id: Date.now().toString(),
      name,
      description,
      duration: dur,
      rules: Array.isArray(rules) ? rules : [],
      isActive,
      createdBy: req.user!.id,
      status,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    exams.push(newExam);
    
    res.status(201).json({
      success: true,
      data: newExam
    });
  } catch (error) {
    console.error('Create exam error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create exam.'
    });
  }
});

// Place history route BEFORE dynamic :id to avoid routing conflicts
router.get('/history', authMiddleware, (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { page = 1, limit = 10 } = req.query;

    const userSubmissions = examSubmissions
      .filter(s => s.userId === userId)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

    const startIndex = (parseInt(page as string) - 1) * parseInt(limit as string);
    const endIndex = startIndex + parseInt(limit as string);
    const paginatedSubmissions = userSubmissions.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: { submissions: paginatedSubmissions, total: userSubmissions.length, page: parseInt(page as string), limit: parseInt(limit as string) }
    });
  } catch (error) {
    console.error('Get exam history error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch exam history.' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const exam = exams.find(e => e.id === req.params.id);
    
    if (!exam) {
      return res.status(404).json({
        success: false,
        error: 'Exam not found.'
      });
    }
    
    const examQuestionList = examQuestions.filter(eq => eq.examId === exam.id);
    
    res.json({
      success: true,
      data: {
        exam,
        questions: examQuestionList
      }
    });
  } catch (error) {
    console.error('Get exam error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch exam.'
    });
  }
});

router.put('/:id', authMiddleware, requireRole(['teacher', 'admin']), (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const idx = exams.findIndex(e => e.id === id);
    if (idx === -1) {
      return res.status(404).json({ success: false, error: 'Exam not found.' });
    }
    let payload = req.body || {};
    // 兼容前端发送的 subjectId + chapterIds 结构：聚合为单条规则（多章节）
    if (Array.isArray(payload.rules)) {
      const expanded: ExamRuleSpec[] = [];
      for (const r of payload.rules) {
        const subjectIds: string[] = Array.isArray(r.subjectIds)
          ? r.subjectIds
          : r.subjectId
            ? [r.subjectId]
            : [];
        let chs: string[] = Array.isArray(r.chapterIds)
          ? r.chapterIds
          : Array.isArray(r.topicIds)
            ? r.topicIds
            : r.topicId
              ? [r.topicId]
              : [];
        if (subjectIds.length > 0) {
          const fromSubjects = subjectIds.flatMap((sid: string) => topics.filter((t: any) => t.parentId === sid).map((t: any) => t.id));
          chs = Array.from(new Set([...(chs || []), ...fromSubjects]));
        }
        expanded.push({ topicIds: chs, questionTypes: Array.isArray(r.questionTypes) ? r.questionTypes : [] });
      }
      payload.rules = expanded;
    }
    const updated: Exam = {
      ...exams[idx],
      name: payload.name ?? exams[idx].name,
      description: payload.description ?? exams[idx].description,
      duration: payload.duration ?? exams[idx].duration,
      rules: Array.isArray(payload.rules) ? payload.rules : exams[idx].rules,
      isActive: payload.isActive ?? exams[idx].isActive,
      status: payload.status ?? exams[idx].status,
      updatedAt: new Date()
    };
    exams[idx] = updated;
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update exam error:', error);
    res.status(500).json({ success: false, error: 'Failed to update exam.' });
  }
});

router.delete('/:id', authMiddleware, requireRole(['teacher', 'admin']), (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const idx = exams.findIndex(e => e.id === id);
    if (idx === -1) {
      // Idempotent delete: if exam not found, treat as deleted
      return res.json({ success: true, message: 'Exam not found, treated as deleted.' });
    }
    exams.splice(idx, 1);
    for (let i = examQuestions.length - 1; i >= 0; i--) {
      if (examQuestions[i].examId === id) examQuestions.splice(i, 1);
    }
    for (let i = examSubmissions.length - 1; i >= 0; i--) {
      if (examSubmissions[i].examId === id) examSubmissions.splice(i, 1);
    }
    res.json({ success: true, message: 'Exam deleted.' });
  } catch (error) {
    console.error('Delete exam error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete exam.' });
  }
});

router.post('/:id/start', authMiddleware, (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    
    const exam = exams.find(e => e.id === id);
    
    if (!exam) {
      return res.status(404).json({
        success: false,
        error: 'Exam not found.'
      });
    }
    
    // Generate exam questions based on UNION of selected chapters across ALL rules
    const selectedQuestions: ExamQuestion[] = [];
    let orderCounter = 1;

    // Union of all topicIds from all rules
    const unionTopicIds = Array.from(new Set((exam.rules || []).flatMap(r => {
      const rr: any = r;
      const subjectIds: string[] = rr.subjectIds || (rr.subjectId ? [rr.subjectId] : []);
      const baseChapters: string[] = rr.topicIds || rr.chapterIds || (rr.topicId ? [rr.topicId] : []);
      const fromSubjects = subjectIds.flatMap((sid: string) => topics.filter((t: any) => t.parentId === sid).map((t: any) => t.id));
      return [...(baseChapters || []), ...fromSubjects];
    })));
    // Helper to normalize type labels
    const normalizeType = (t: string): QuestionType | null => {
      const s = String(t || '').toLowerCase().trim();
      if (['single','single_choice','scq','单选','单选题'].includes(s)) return 'single';
      if (['multiple','multiple_choice','mcq','多选','多选题'].includes(s)) return 'multiple';
      if (['fill','gap','blank','填空','填空题'].includes(s)) return 'fill';
      if (['subjective','essay','主观','主观题'].includes(s)) return 'subjective';
      return null;
    };

    // Merge type specs across rules by type: use max count to avoid multiplying by chapters
    const mergedSpecs: Record<string, { count: number; score: number }> = {};
    for (const rule of (exam.rules || [])) {
      for (const qt of (rule.questionTypes || [])) {
        const t = normalizeType(qt.type);
        if (!t) continue;
        if (!mergedSpecs[t]) {
          mergedSpecs[t] = { count: qt.count, score: qt.score };
        } else {
          mergedSpecs[t].count = Math.max(mergedSpecs[t].count, qt.count);
          mergedSpecs[t].score = qt.score;
        }
      }
    }
    // For each type, select from UNION pool
    for (const [type, spec] of Object.entries(mergedSpecs)) {
      const t = normalizeType(type) as QuestionType;
      const pool = questions.filter((q: Question) => unionTopicIds.includes(q.topicId) && q.type === t);
      if (pool.length < spec.count) {
        return res.status(400).json({ success: false, error: `Not enough questions for selected chapters and type ${t}.` });
      }
      const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, spec.count);
      for (const q of shuffled) {
        selectedQuestions.push({
          id: `${id}-${userId}-${orderCounter}`,
          examId: id,
          submissionId: '', // fill later
          questionId: q.id,
          order: orderCounter++,
          score: spec.score
        });
      }
    }
    
    // Sort selected questions by type order: single -> multiple -> fill -> subjective
    const typeOrder: Record<string, number> = { single: 0, multiple: 1, fill: 2, subjective: 3 };
    selectedQuestions.sort((a, b) => {
      const qa = questions.find(q => q.id === a.questionId);
      const qb = questions.find(q => q.id === b.questionId);
      const ta = qa ? typeOrder[qa.type] ?? 99 : 99;
      const tb = qb ? typeOrder[qb.type] ?? 99 : 99;
      return ta - tb;
    });
    // Reassign order
    for (let i = 0; i < selectedQuestions.length; i++) {
      selectedQuestions[i].order = i + 1;
    }

    // Create new submission
    const newSubmission: ExamSubmission = {
      id: Date.now().toString(),
      examId: id,
      userId,
      startTime: new Date(),
      endTime: new Date(Date.now() + exam.duration * 60 * 1000),
      status: 'in_progress',
      score: 0,
      answers: []
    };
    
    examSubmissions.push(newSubmission);
    
    // Assign submissionId and push
    selectedQuestions.forEach((eq) => {
      examQuestions.push({ ...eq, submissionId: newSubmission.id });
    });
    
    res.status(201).json({
      success: true,
      data: newSubmission
    });
  } catch (error) {
    console.error('Start exam error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start exam.'
    });
  }
});

// Preview exam distribution: type-wise required vs available in UNION of selected chapters
router.get('/:id/preview', authMiddleware, requireRole(['teacher','admin']), (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const exam = exams.find(e => e.id === id);
    if (!exam) return res.status(404).json({ success:false, error:'Exam not found.' });

    const normalizeType = (t: string): QuestionType | null => {
      const s = String(t || '').toLowerCase().trim();
      if (['single','single_choice','scq','单选','单选题'].includes(s)) return 'single';
      if (['multiple','multiple_choice','mcq','多选','多选题'].includes(s)) return 'multiple';
      if (['fill','gap','blank','填空','填空题'].includes(s)) return 'fill';
      if (['subjective','essay','主观','主观题'].includes(s)) return 'subjective';
      return null;
    };

    const unionTopicIds = Array.from(new Set((exam.rules || []).flatMap(r => {
      const rr: any = r;
      const subjectIds: string[] = rr.subjectIds || (rr.subjectId ? [rr.subjectId] : []);
      const baseChapters: string[] = rr.topicIds || rr.chapterIds || (rr.topicId ? [rr.topicId] : []);
      const fromSubjects = subjectIds.flatMap((sid: string) => topics.filter((t: any) => t.parentId === sid).map((t: any) => t.id));
      return [...(baseChapters || []), ...fromSubjects];
    })));
    const mergedSpecs: Record<QuestionType, { count:number; score:number }> = {
      single: { count: 0, score: 0 },
      multiple: { count: 0, score: 0 },
      fill: { count: 0, score: 0 },
      subjective: { count: 0, score: 0 }
    };
    for (const rule of (exam.rules || [])) {
      for (const qt of (rule.questionTypes || [])) {
        const t = normalizeType(qt.type);
        if (!t) continue;
        mergedSpecs[t].count = Math.max(mergedSpecs[t].count, qt.count);
        mergedSpecs[t].score = qt.score;
      }
    }

    const byType: Array<{ type: QuestionType; required: number; available: number }> = [];
    const types: QuestionType[] = ['single','multiple','fill','subjective'];
    for (const t of types) {
      const available = questions.filter(q => unionTopicIds.includes(q.topicId) && q.type === t).length;
      byType.push({ type: t, required: mergedSpecs[t].count, available });
    }
    const totalRequired = byType.reduce((s, r) => s + r.required, 0);
    const totalAvailable = byType.reduce((s, r) => s + r.available, 0);
    const warnings: string[] = byType.filter(r => r.available < r.required).map(r => `题型${r.type}可用 ${r.available} 少于需求 ${r.required}`);

    res.json({ success:true, data: { byType, totalRequired, totalAvailable, warnings } });
  } catch (error) {
    console.error('Preview exam error:', error);
    res.status(500).json({ success:false, error:'Failed to preview exam.' });
  }
});

router.get('/submission/:submissionId/question/:order', authMiddleware, (req: AuthRequest, res) => {
  try {
    const { submissionId, order } = req.params;
    const userId = req.user!.id;
    
    const submission = examSubmissions.find(s => s.id === submissionId && s.userId === userId);
    
    if (!submission) {
      return res.status(404).json({
        success: false,
        error: 'Submission not found.'
      });
    }
    
    if (submission.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        error: 'Submission is not in progress.'
      });
    }
    
    const examQuestion = examQuestions.find(eq => eq.submissionId === submissionId && eq.order === parseInt(order));
    
    if (!examQuestion) {
      return res.status(404).json({
        success: false,
        error: 'Question not found.'
      });
    }
    
    const question = questions.find(q => q.id === examQuestion.questionId);
    
    if (!question) {
      return res.status(404).json({
        success: false,
        error: 'Question data not found.'
      });
    }
    
    const userAnswer = examAnswers.find(a => a.submissionId === submissionId && a.questionId === question.id);
    
    const displayQuestion = {
      ...question,
      options: question?.options ? [...question.options].sort(() => Math.random() - 0.5) : undefined
    };

    res.json({
      success: true,
      data: {
        question: displayQuestion,
        order: examQuestion.order,
        totalQuestions: examQuestions.filter(eq => eq.submissionId === submissionId).length,
        userAnswer: userAnswer?.answer || null
      }
    });
  } catch (error) {
    console.error('Get exam question error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch exam question.'
    });
  }
});

router.post('/submission/:submissionId/answer', authMiddleware, (req: AuthRequest, res) => {
  try {
    const { submissionId } = req.params;
    const { questionId, answer, completed = false } = req.body;
    const userId = req.user!.id;
    
    const submission = examSubmissions.find(s => s.id === submissionId && s.userId === userId);
    
    if (!submission) {
      return res.status(404).json({
        success: false,
        error: 'Submission not found.'
      });
    }
    
    if (submission.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        error: 'Submission is not in progress.'
      });
    }
    
    // Check if time has expired
    const now = new Date();
    if (now > submission.endTime) {
      submission.status = 'completed';
      return res.status(400).json({
        success: false,
        error: 'Exam time has expired.'
      });
    }
    
    // Update or create answer
    let existingAnswer = examAnswers.find(a => a.submissionId === submissionId && a.questionId === questionId);
    
    if (existingAnswer) {
      existingAnswer.answer = answer;
      existingAnswer.updatedAt = new Date();
    } else {
      const newAnswer: ExamAnswer = {
        id: Date.now().toString(),
        submissionId,
        questionId,
        answer,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      examAnswers.push(newAnswer);
    }
    
    if (completed) {
      // Calculate score
      const submissionQuestions = examQuestions.filter(eq => eq.submissionId === submissionId);
      let totalScore = 0;
      
      for (const eq of submissionQuestions) {
        const question = questions.find(q => q.id === eq.questionId);
        const userAnswer = examAnswers.find(a => a.submissionId === submissionId && a.questionId === eq.questionId);
        
        if (question && userAnswer) {
          const isCorrect = checkAnswer(question.id, userAnswer.answer);
          if (isCorrect) {
            totalScore += question.score;
          }
        }
      }
      
      submission.status = 'completed';
      submission.score = totalScore;
      submission.completedAt = new Date();
    }
    
    res.json({
      success: true,
      data: {
        submission,
        completed
      }
    });
  } catch (error) {
    console.error('Submit exam answer error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit exam answer.'
    });
  }
});

router.get('/submission/:submissionId/result', authMiddleware, (req: AuthRequest, res) => {
  try {
    const { submissionId } = req.params;
    const userId = req.user!.id;
    
    const submission = examSubmissions.find(s => s.id === submissionId && s.userId === userId);
    
    if (!submission) {
      return res.status(404).json({
        success: false,
        error: 'Submission not found.'
      });
    }
    
    if (submission.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Submission is not completed.'
      });
    }
    
    const submissionQuestions = examQuestions.filter(eq => eq.submissionId === submissionId);
    const answers = examAnswers.filter(a => a.submissionId === submissionId);
    
    const results = submissionQuestions.map(eq => {
      const question = questions.find(q => q.id === eq.questionId);
      const answer = answers.find(a => a.questionId === eq.questionId);
      
      return {
        question,
        order: eq.order,
        userAnswer: answer?.answer || null,
        isCorrect: question && answer ? checkAnswer(question.id, answer.answer) : false,
        score: question && answer && checkAnswer(question.id, answer.answer) ? question.score : 0
      };
    });
    
    res.json({
      success: true,
      data: {
        submission,
        results,
        totalScore: submission.score,
        maxScore: submissionQuestions.reduce((sum, eq) => {
          const question = questions.find(q => q.id === eq.questionId);
          return sum + (question?.score || 0);
        }, 0)
      }
    });
  } catch (error) {
    console.error('Get exam result error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch exam result.'
    });
  }
});

// Publish/Unpublish endpoints
router.post('/:id/publish', authMiddleware, requireRole(['teacher','admin']), (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const idx = exams.findIndex(e => e.id === id);
    if (idx === -1) return res.status(404).json({ success:false, error:'Exam not found.' });
    exams[idx] = { ...exams[idx], status: 'published', isActive: true, updatedAt: new Date() };
    res.json({ success:true, data: exams[idx] });
  } catch (error) {
    console.error('Publish exam error:', error);
    res.status(500).json({ success:false, error:'Failed to publish exam.' });
  }
});

router.post('/:id/unpublish', authMiddleware, requireRole(['teacher','admin']), (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const idx = exams.findIndex(e => e.id === id);
    if (idx === -1) return res.status(404).json({ success:false, error:'Exam not found.' });
    exams[idx] = { ...exams[idx], status: 'draft', updatedAt: new Date() };
    res.json({ success:true, data: exams[idx] });
  } catch (error) {
    console.error('Unpublish exam error:', error);
    res.status(500).json({ success:false, error:'Failed to unpublish exam.' });
  }
});

function checkAnswer(questionId: string, userAnswer: string | string[]): boolean {
  const question = questions.find(q => q.id === questionId);
  if (!question) return false;
  
  if (Array.isArray(question.answer)) {
    if (!Array.isArray(userAnswer)) return false;
    return question.answer.length === userAnswer.length && 
           question.answer.every(a => userAnswer.includes(a));
  } else {
    if (Array.isArray(userAnswer)) return false;
    return question.answer.toLowerCase().trim() === userAnswer.toLowerCase().trim();
  }
}

export { router as examRouter };

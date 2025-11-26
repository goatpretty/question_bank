import express from 'express';
import fs from 'fs';
import path from 'path';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { Question, QuestionType } from '@/shared/types';
import multer from 'multer';
import * as XLSX from 'xlsx';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

function parseMultiAnswer(ansRaw: string) {
  const letters = (ansRaw || '').toUpperCase().match(/[A-D]/g) || [];
  return Array.from(new Set(letters));
}

export const questions: Question[] = [
  {
    id: '1',
    topicId: '2',
    type: 'single',
    content: '解方程: 2x + 5 = 13，求x的值。',
    options: [
      { id: 'A', content: 'x = 3' },
      { id: 'B', content: 'x = 4' },
      { id: 'C', content: 'x = 5' },
      { id: 'D', content: 'x = 6' }
    ],
    answer: 'B',
    analysis: '2x + 5 = 13 → 2x = 8 → x = 4',
    difficulty: 2,
    score: 5,
    tags: ['代数', '一元一次方程'],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '2',
    topicId: '2',
    type: 'multiple',
    content: '下列哪些是二次方程？',
    options: [
      { id: 'A', content: 'x² + 2x + 1 = 0' },
      { id: 'B', content: '2x + 3 = 0' },
      { id: 'C', content: 'x² - 4 = 0' },
      { id: 'D', content: '3x³ + 2x = 0' }
    ],
    answer: ['A', 'C'],
    analysis: '二次方程是指最高次数为2的方程，A和C都是二次方程。',
    difficulty: 3,
    score: 8,
    tags: ['代数', '二次方程'],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '3',
    topicId: '3',
    type: 'fill',
    content: '一个三角形的三个内角分别是60°、70°和____°。',
    answer: '50',
    analysis: '三角形内角和为180°，所以第三个角为180° - 60° - 70° = 50°。',
    difficulty: 1,
    score: 4,
    tags: ['几何', '三角形'],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '4',
    topicId: '3',
    type: 'subjective',
    content: '请简述勾股定理的内容，并给出一个应用实例。',
    answer: '勾股定理：在直角三角形中，两条直角边的平方和等于斜边的平方。即a² + b² = c²，其中c为斜边。应用实例：一个直角三角形两直角边分别为3和4，则斜边为5，因为3² + 4² = 9 + 16 = 25 = 5²。',
    analysis: '勾股定理是几何学中的基本定理，应用广泛。',
    difficulty: 3,
    score: 10,
    tags: ['几何', '勾股定理'],
    createdAt: new Date(),
    updatedAt: new Date()
  }
];
export const topics = [
  { id: '1', name: '数学', parentId: null, sortOrder: 1, createdAt: new Date() },
  { id: '2', name: '代数', parentId: '1', sortOrder: 1, createdAt: new Date() },
  { id: '3', name: '几何', parentId: '1', sortOrder: 2, createdAt: new Date() },
  { id: '4', name: '语文', parentId: null, sortOrder: 2, createdAt: new Date() },
  { id: '5', name: '物理', parentId: null, sortOrder: 3, createdAt: new Date() }
];

router.get('/', (req, res) => {
  try {
    const { topicId, type, difficulty, page = 1, limit = 20 } = req.query;
    
    let filteredQuestions = questions;
    
    if (topicId) {
      const tid = String(topicId).trim();
      filteredQuestions = filteredQuestions.filter(q => q.topicId === tid);
    }
    
    if (type) {
      filteredQuestions = filteredQuestions.filter(q => q.type === type);
    }
    
    if (difficulty) {
      const difficultyNum = parseInt(difficulty as string);
      filteredQuestions = filteredQuestions.filter(q => q.difficulty === difficultyNum);
    }
    
    const startIndex = (parseInt(page as string) - 1) * parseInt(limit as string);
    const endIndex = startIndex + parseInt(limit as string);
    
    const paginatedQuestions = filteredQuestions.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      data: {
        questions: paginatedQuestions,
        total: filteredQuestions.length,
        page: parseInt(page as string),
        limit: parseInt(limit as string)
      }
    });
  } catch (error) {
    console.error('Get questions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch questions.'
    });
  }
});

router.get('/topics', (req, res) => {
  try {
    const enriched = topics.map(t => ({
      ...t,
      type: t.parentId ? 'chapter' : 'course',
      courseId: t.parentId || null
    }));
    res.json({
      success: true,
      data: enriched
    });
  } catch (error) {
    console.error('Get topics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch topics.'
    });
  }
});

// 运行期课程/章节题量统计（置于 /:id 之前，避免被动态路由拦截）
router.get('/stats', (req, res) => {
  try {
    const courses = topics.filter(t => !t.parentId).map(course => {
      const chapterList = topics.filter(t => t.parentId === course.id).map(ch => ({
        id: ch.id,
        name: ch.name,
        courseId: course.id,
        count: questions.filter(q => q.topicId === ch.id).length
      }));
      const totalCount = chapterList.reduce((sum, c) => sum + c.count, 0);
      return {
        id: course.id,
        name: course.name,
        chapters: chapterList,
        totalCount
      };
    });
    const chapters = topics.filter(t => !!t.parentId).map(ch => ({
      id: ch.id,
      name: ch.name,
      courseId: ch.parentId,
      count: questions.filter(q => q.topicId === ch.id).length
    }));
    res.json({ success: true, data: { courses, chapters } });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stats.' });
  }
});

// 创建科目/章节（parentId 为空为科目，否则为章节）
router.post('/topics', authMiddleware, requireRole(['teacher', 'admin']), (req, res) => {
  try {
    const { name, parentId } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ success: false, error: 'Topic name is required.' });
    }

    if (parentId) {
      const parent = topics.find(t => t.id === parentId);
      if (!parent) {
        return res.status(404).json({ success: false, error: 'Parent subject not found.' });
      }
    }

    const newTopic = { id: Date.now().toString(), name, parentId: parentId || null, sortOrder: 0, createdAt: new Date() };
    topics.push(newTopic);
    saveStore();
    res.status(201).json({ success: true, data: newTopic });
  } catch (error) {
    console.error('Create topic error:', error);
    res.status(500).json({ success: false, error: 'Failed to create topic.' });
  }
});

// 删除科目/章节
router.delete('/topics/:id', authMiddleware, requireRole(['teacher', 'admin']), (req, res) => {
  try {
    const { id } = req.params;
    const index = topics.findIndex(t => t.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Topic not found.' });
    }
    // 同时删除其子章节
    const children = topics.filter(t => t.parentId === id).map(t => t.id);
    // 需要删除的标签ID集合（包含自身与子章节）
    const idsToDelete = [id, ...children];

    // 删除 topics 中的自身与子章节
    // 先删除子章节
    for (const childId of children) {
      const ci = topics.findIndex(t => t.id === childId);
      if (ci !== -1) topics.splice(ci, 1);
    }
    // 再删除自身
    topics.splice(index, 1);

    // 级联删除 questions：删除属于这些章节的所有题目
    const originalQuestionCount = questions.length;
    const remainingQuestions = questions.filter(q => !idsToDelete.includes(q.topicId));
    const removedQuestionCount = originalQuestionCount - remainingQuestions.length;
    // 用剩余题目覆盖原数组内容
    questions.splice(0, questions.length, ...remainingQuestions);
    saveStore();
    res.json({ 
      success: true, 
      message: 'Topic and related data deleted.',
      data: {
        deletedTopicId: id,
        deletedChildChapterCount: children.length,
        deletedQuestionCount: removedQuestionCount
      }
    });
  } catch (error) {
    console.error('Delete topic error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete topic.' });
  }
});

router.post('/', authMiddleware, requireRole(['teacher', 'admin']), (req, res) => {
  try {
    const { topicId, chapterId, type, content, options, answer, analysis, score, tags } = req.body;
    
    const effectiveTopicId = chapterId || topicId;
    if (!effectiveTopicId || !type || !content || !answer || score === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields.'
      });
    }
    
    const chapter = topics.find(t => t.id === effectiveTopicId);
    if (!chapter) {
      return res.status(404).json({
        success: false,
        error: 'Chapter not found.'
      });
    }
    // 章节必须有科目父节点
    if (!chapter.parentId) {
      return res.status(400).json({ success: false, error: 'Chapter must belong to a subject. Please create subject and chapter first.' });
    }
    const parentSubject = topics.find(t => t.id === chapter.parentId);
    if (!parentSubject) {
      return res.status(400).json({ success: false, error: 'Parent subject not found. Please create subject first.' });
    }
    
    const newQuestion: Question = {
      id: Date.now().toString(),
      topicId: effectiveTopicId,
      type: type as QuestionType,
      content,
      options,
      answer,
      analysis: analysis || '',
      difficulty: 1,
      score: parseInt(score),
      tags: tags || [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    questions.push(newQuestion);
    saveStore();
    res.status(201).json({
      success: true,
      data: newQuestion
    });
  } catch (error) {
    console.error('Create question error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create question.'
    });
  }
});

// Download Excel template
router.get('/import/template', (req, res) => {
  try {
    const header = ['序号','题型','题干','A','B','C','D','答案','解析','课程','章节','标签'];
    const example = [
      ['1','单选','示例题干','选项A','选项B','','','A','解析文本','数学','代数','基础'],
      ['2','填空','示例填空题','','','','','正确答案','解析文本','数学','几何','']
    ];
    const ws = XLSX.utils.aoa_to_sheet([header, ...example]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '模板');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="question_import_template.xlsx"');
    res.send(buf);
  } catch (error) {
    console.error('Generate template error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate template.' });
  }
});

// Aliases for template path
router.get('/import/template.xlsx', (req, res) => {
  try {
    const header = ['序号','题型','题干','A','B','C','D','答案','解析','课程','章节','标签'];
    const example = [
      ['1','单选','示例题干','选项A','选项B','','','A','解析文本','数学','代数','基础'],
      ['2','填空','示例填空题','','','','','正确答案','解析文本','数学','几何','']
    ];
    const ws = XLSX.utils.aoa_to_sheet([header, ...example]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '模板');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="question_import_template.xlsx"');
    res.send(buf);
  } catch (error) {
    console.error('Generate template error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate template.' });
  }
});
router.get('/import-template', (req, res) => res.redirect('./import/template'));

// Import questions from Excel
router.post('/import', authMiddleware, requireRole(['teacher','admin']), upload.single('file'), (req: express.Request & { file?: Express.Multer.File }, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded.' });
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
    if (!rows || rows.length < 2) return res.status(400).json({ success: false, error: 'Empty worksheet.' });
    const header = rows[0].map((h: any) => String(h || '').trim());
    const col = (name: string) => header.findIndex(h => h === name);
    const idx = {
      seq: col('序号'), type: col('题型'), stem: col('题干'),
      A: col('A'), B: col('B'), C: col('C'), D: col('D'),
      ans: col('答案'), ana: col('解析'), course: col('课程'), chapter: col('章节'), tags: col('标签')
    };
    const required = ['序号','题型','题干','答案','课程','章节'];
    for (const r of required) { if (col(r) === -1) { return res.status(400).json({ success:false, error:`Missing column: ${r}` }); } }

    const normalizeType = (t: string): QuestionType | null => {
      const s = (t || '').toLowerCase();
      if (['单选','single'].includes(s)) return 'single';
      if (['多选','multiple'].includes(s)) return 'multiple';
      if (['填空','fill'].includes(s)) return 'fill';
      if (['主观','subjective'].includes(s)) return 'subjective';
      return null;
    };
    const splitMulti = (v: string) => parseMultiAnswer(v);
    const splitTags = (v: string) => (v || '').split(/[|,，;；、\s]+/).map(s => s.trim()).filter(Boolean);

    let imported = 0; const skipped: { row:number; reason:string }[] = [];
    const created: Question[] = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]; if (!r) continue;
      const seq = String(r[idx.seq] || '').trim();
      const tRaw = String(r[idx.type] || '').trim();
      const stem = String(r[idx.stem] || '').trim();
      const ansRaw = String(r[idx.ans] || '').trim();
      const courseName = String(r[idx.course] || '').trim();
      const chapterName = String(r[idx.chapter] || '').trim();
      if (!seq || !tRaw || !ansRaw || !courseName || !chapterName) { skipped.push({ row:i+1, reason:'必填列为空' }); continue; }
      const qType = normalizeType(tRaw); if (!qType) { skipped.push({ row:i+1, reason:'题型不合法' }); continue; }
      // match course/chapter
      const course = topics.find(t => !t.parentId && t.name === courseName);
      if (!course) { skipped.push({ row:i+1, reason:'课程不存在' }); continue; }
      const chapter = topics.find(t => t.parentId === course.id && t.name === chapterName);
      if (!chapter) { skipped.push({ row:i+1, reason:'章节不存在或不匹配' }); continue; }

      let options: { id:string; content:string }[] | undefined;
      let answer: string | string[];
      if (qType === 'single' || qType === 'multiple') {
        const A = String(r[idx.A] || '').trim();
        const B = String(r[idx.B] || '').trim();
        const C = String(r[idx.C] || '').trim();
        const D = String(r[idx.D] || '').trim();
        options = [];
        if (A) options.push({ id:'A', content: A });
        if (B) options.push({ id:'B', content: B });
        if (C) options.push({ id:'C', content: C });
        if (D) options.push({ id:'D', content: D });
        if ((options?.length || 0) < 2) { skipped.push({ row:i+1, reason:'选择题选项少于两个' }); continue; }
        if (qType === 'single') {
          const a = ansRaw.toUpperCase();
          if (!['A','B','C','D'].includes(a)) { skipped.push({ row:i+1, reason:'单选答案非法' }); continue; }
          answer = a;
        } else {
          const arr = splitMulti(ansRaw).filter(l => ['A','B','C','D'].includes(l));
          if (arr.length < 1) { skipped.push({ row:i+1, reason:'多选答案非法' }); continue; }
          answer = Array.from(new Set(arr)).sort();
        }
      } else {
        options = undefined;
        answer = ansRaw;
      }

      const analysis = String(r[idx.ana] || '').trim();
      const tags = splitTags(String(r[idx.tags] || ''));
      const newQuestion: Question = {
        id: Date.now().toString() + '_' + i,
        topicId: chapter.id,
        type: qType,
        content: stem,
        options,
        answer,
        analysis,
        difficulty: 1,
        score: 5,
        tags,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      questions.push(newQuestion);
      created.push(newQuestion);
      imported++;
    }
    saveStore();
    res.json({ success:true, data: { imported, skipped: skipped.length, errors: skipped } });
  } catch (error) {
    console.error('Import questions error:', error);
    res.status(500).json({ success:false, error:'Failed to import questions.' });
  }
});

// Import preview without committing
router.post('/import/preview', authMiddleware, requireRole(['teacher','admin']), upload.single('file'), (req: express.Request & { file?: Express.Multer.File }, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded.' });
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
    if (!rows || rows.length < 2) return res.status(400).json({ success: false, error: 'Empty worksheet.' });
    const header = rows[0].map((h: any) => String(h || '').trim());
    const col = (name: string) => header.findIndex(h => h === name);
    const idx = {
      seq: col('序号'), type: col('题型'), stem: col('题干'),
      A: col('A'), B: col('B'), C: col('C'), D: col('D'),
      ans: col('答案'), ana: col('解析'), course: col('课程'), chapter: col('章节'), tags: col('标签')
    };
    const out: any[] = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]; if (!r) continue;
      const seq = String(r[idx.seq] || '').trim();
      const tRaw = String(r[idx.type] || '').trim();
      const stem = String(r[idx.stem] || '').trim();
      const ansRaw = String(r[idx.ans] || '').trim();
      const courseName = String(r[idx.course] || '').trim();
      const chapterName = String(r[idx.chapter] || '').trim();
      const A = String(r[idx.A] || '').trim();
      const B = String(r[idx.B] || '').trim();
      const C = String(r[idx.C] || '').trim();
      const D = String(r[idx.D] || '').trim();
      const analysis = String(r[idx.ana] || '').trim();
      const tags = String(r[idx.tags] || '').trim();
      const errors: string[] = [];
      if (!seq) errors.push('序号为空');
      if (!tRaw) errors.push('题型为空');
      if (!ansRaw) errors.push('答案为空');
      if (!courseName) errors.push('课程为空');
      if (!chapterName) errors.push('章节为空');
      out.push({ row: i+1, seq, type: tRaw, stem, A, B, C, D, answer: ansRaw, analysis, course: courseName, chapter: chapterName, tags, errors });
    }
    res.json({ success: true, data: { rows: out } });
  } catch (error) {
    console.error('Import preview error:', error);
    res.status(500).json({ success:false, error:'Failed to preview import.' });
  }
});

// Commit edited rows from preview
router.post('/import/commit', authMiddleware, requireRole(['teacher','admin']), (req, res) => {
  try {
    const payload = req.body || {};
    const rows: any[] = Array.isArray(payload.rows) ? payload.rows : [];
    if (rows.length === 0) return res.status(400).json({ success:false, error:'No rows to commit.' });
    let imported = 0; const errors: any[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] || {};
      const courseName = String(r.course || '').trim();
      const chapterName = String(r.chapter || '').trim();
      const typeRaw = String(r.type || '').trim();
      const stem = String(r.stem || '').trim();
      const ansRaw = String(r.answer || '').trim();
      const analysis = String(r.analysis || '').trim();
      const tags = Array.isArray(r.tags) ? r.tags : String(r.tags || '').split(/[|,，;；、\s]+/).map((s: string) => s.trim()).filter(Boolean);
      const normalizeType = (t: string): QuestionType | null => {
        const s = (t || '').toLowerCase();
        if (['单选','single'].includes(s)) return 'single';
        if (['多选','multiple'].includes(s)) return 'multiple';
        if (['填空','fill'].includes(s)) return 'fill';
        if (['主观','subjective'].includes(s)) return 'subjective';
        return null;
      };
      const qType = normalizeType(typeRaw);
      if (!courseName || !chapterName || !qType || !ansRaw || !stem) { errors.push({ index:i, reason:'缺少必填字段' }); continue; }
      const course = topics.find(t => !t.parentId && t.name === courseName);
      if (!course) { errors.push({ index:i, reason:'课程不存在' }); continue; }
      const chapter = topics.find(t => t.parentId === course.id && t.name === chapterName);
      if (!chapter) { errors.push({ index:i, reason:'章节不存在或不匹配' }); continue; }
      let options: { id:string; content:string }[] | undefined;
      let answer: string | string[] = ansRaw;
      if (qType === 'single' || qType === 'multiple') {
        const A = String(r.A || '').trim();
        const B = String(r.B || '').trim();
        const C = String(r.C || '').trim();
        const D = String(r.D || '').trim();
        options = [];
        if (A) options.push({ id:'A', content: A });
        if (B) options.push({ id:'B', content: B });
        if (C) options.push({ id:'C', content: C });
        if (D) options.push({ id:'D', content: D });
        if ((options?.length || 0) < 2) { errors.push({ index:i, reason:'选择题选项少于两个' }); continue; }
        if (qType === 'single') {
          const a = ansRaw.toUpperCase();
          if (!['A','B','C','D'].includes(a)) { errors.push({ index:i, reason:'单选答案非法' }); continue; }
          answer = a;
        } else {
          const arr = parseMultiAnswer(ansRaw).filter(l => ['A','B','C','D'].includes(l));
          if (arr.length < 1) { errors.push({ index:i, reason:'多选答案非法' }); continue; }
          answer = Array.from(new Set(arr)).sort();
        }
      }
      const newQuestion: Question = {
        id: Date.now().toString() + '_' + i,
        topicId: chapter.id,
        type: qType,
        content: stem,
        options,
        answer,
        analysis,
        difficulty: 1,
        score: 5,
        tags,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      questions.push(newQuestion);
      imported++;
    }
    saveStore();
    res.json({ success:true, data:{ imported, errors } });
  } catch (error) {
    console.error('Import commit error:', error);
    res.status(500).json({ success:false, error:'Failed to commit import.' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const qid = String(req.params.id).trim();
    const question = questions.find(q => q.id === qid);
    
    if (!question) {
      return res.status(404).json({
        success: false,
        error: 'Question not found.'
      });
    }
    
    res.json({
      success: true,
      data: question
    });
  } catch (error) {
    console.error('Get question error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch question.'
    });
  }
});

router.put('/:id', authMiddleware, requireRole(['teacher', 'admin']), (req, res) => {
  try {
    const questionIndex = questions.findIndex(q => q.id === req.params.id);
    
    if (questionIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Question not found.'
      });
    }
    
    const updatedQuestion = {
      ...questions[questionIndex],
      ...req.body,
      updatedAt: new Date()
    };
    
    questions[questionIndex] = updatedQuestion;
    saveStore();
    res.json({
      success: true,
      data: updatedQuestion
    });
  } catch (error) {
    console.error('Update question error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update question.'
    });
  }
});

router.delete('/:id', authMiddleware, requireRole(['teacher', 'admin']), (req, res) => {
  try {
    const questionIndex = questions.findIndex(q => q.id === req.params.id);
    
    if (questionIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Question not found.'
      });
    }
    
    questions.splice(questionIndex, 1);
    saveStore();
    res.json({
      success: true,
      message: 'Question deleted successfully.'
    });
  } catch (error) {
    console.error('Delete question error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete question.'
    });
  }
});

export { router as questionRouter };
// 运行期课程/章节题量统计

// 简易持久化：将 topics / questions 保存到本地文件，避免重启丢失
const STORE_DIR = path.resolve(process.cwd(), 'api', 'data');
const STORE_FILE = path.join(STORE_DIR, 'store.json');

function ensureStoreDir() {
  try {
    if (!fs.existsSync(STORE_DIR)) {
      fs.mkdirSync(STORE_DIR, { recursive: true });
    }
  } catch {}
}

function saveStore() {
  try {
    ensureStoreDir();
    const payload = JSON.stringify({ topics, questions }, null, 2);
    fs.writeFileSync(STORE_FILE, payload, 'utf-8');
  } catch (e) {
    console.error('Save store error:', e);
  }
}

function loadStoreIfExists() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf-8');
      const data = JSON.parse(raw || '{}');
      if (Array.isArray(data?.topics)) {
        topics.splice(0, topics.length, ...data.topics);
      }
      if (Array.isArray(data?.questions)) {
        questions.splice(0, questions.length, ...data.questions);
      }
    } else {
      // 首次运行，将默认示例数据写入文件
      saveStore();
    }
  } catch (e) {
    console.error('Load store error:', e);
  }
}

// 模块初始化时加载持久化数据
loadStoreIfExists();

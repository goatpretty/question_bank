import express from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { prisma } from '../db/prisma.js';
import { Question, QuestionType } from '../../shared/types.js';
import { extractOptionColumns, extractOptionValues } from '../utils/optionLabel.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
    fields: 20,
  },
});

// Map Prisma Question + QuestionOption[] to frontend-expected Question structure

function parseMultiAnswer(ansRaw: string) {
  const letters = (ansRaw || '').toUpperCase().match(/[A-Z]/g) || [];
  return Array.from(new Set(letters));
}

// Map Prisma Question + QuestionOption[] to frontend-expected Question structure
function toFrontendQuestion(dbQ: any): Question {
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

// ──────────────── GET / ────────────────
router.get('/', async (req, res) => {
  try {
    const { topicId, type, difficulty, keyword, subjectId, page = 1, limit = 20 } = req.query;
    const pageN = Math.max(1, parseInt(page as string));
    const limitN = Math.max(1, Math.min(100, parseInt(limit as string)));

    // Build where clause
    const where: any = {};
    if (type) where.type = type;
    if (difficulty) where.difficulty = parseInt(difficulty as string);
    if (topicId) {
      where.topicId = String(topicId).trim();
    } else if (subjectId) {
      const childTopics = await prisma.topic.findMany({
        where: { parentId: String(subjectId).trim() },
        select: { id: true },
      });
      where.topicId = { in: childTopics.map((t: any) => t.id) };
    }

    // For keyword, Prisma SQLite doesn't support OR across relations well, so filter after
    const [totalRaw, dbQuestions] = await Promise.all([
      prisma.question.count({ where }),
      prisma.question.findMany({
        where,
        include: { options: { orderBy: { sortOrder: 'asc' } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Apply keyword filter in memory
    let filtered = dbQuestions;
    let total = totalRaw;
    if (keyword) {
      const kw = String(keyword).trim().toLowerCase();
      filtered = dbQuestions.filter((q: any) => {
        const contentMatch = q.content.toLowerCase().includes(kw);
        const analysisMatch = (q.analysis || '').toLowerCase().includes(kw);
        const tags = JSON.parse(q.tags || '[]') as string[];
        const tagsMatch = tags.some((t: string) => t.toLowerCase().includes(kw));
        return contentMatch || analysisMatch || tagsMatch;
      });
      total = filtered.length;
    }

    // Pagination
    const totalPages = Math.max(0, Math.ceil(total / limitN));
    const startIndex = (pageN - 1) * limitN;
    const paginated = filtered.slice(startIndex, startIndex + limitN);
    const questions = paginated.map(toFrontendQuestion);

    res.json({
      success: true,
      data: {
        questions,
        total,
        page: pageN,
        limit: limitN,
        totalPages
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

// ──────────────── GET /topics ────────────────
router.get('/topics', async (req, res) => {
  try {
    const dbTopics = await prisma.topic.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    const enriched = dbTopics.map((t: any) => ({
      ...t,
      type: t.parentId ? 'chapter' : 'course',
      courseId: t.parentId || null,
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

// ──────────────── GET /stats ────────────────
router.get('/stats', async (req, res) => {
  try {
    const dbTopics = await prisma.topic.findMany({
      orderBy: { createdAt: 'asc' },
    });
    const courses = dbTopics.filter((t: any) => !t.parentId);
    const chapters = dbTopics.filter((t: any) => !!t.parentId);

    // Count questions per chapter in parallel
    const chapterCounts = await Promise.all(
      chapters.map(async (ch: any) => {
        const count = await prisma.question.count({ where: { topicId: ch.id } });
        return { id: ch.id, name: ch.name, courseId: ch.parentId, count };
      })
    );

    const coursesWithChapters = courses.map((course: any) => {
      const courseChapters = chapterCounts.filter((ch: any) => ch.courseId === course.id);
      const totalCount = courseChapters.reduce((sum: number, ch: any) => sum + ch.count, 0);
      return {
        id: course.id,
        name: course.name,
        chapters: courseChapters,
        totalCount
      };
    });

    res.json({ success: true, data: { courses: coursesWithChapters, chapters: chapterCounts } });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stats.' });
  }
});

// ──────────────── POST /topics ────────────────
router.post('/topics', authMiddleware, requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { name, parentId } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ success: false, error: 'Topic name is required.' });
    }

    if (parentId) {
      const parent = await prisma.topic.findUnique({ where: { id: String(parentId) } });
      if (!parent) {
        return res.status(404).json({ success: false, error: 'Parent subject not found.' });
      }
    }

    const maxSort = await prisma.topic.aggregate({
      _max: { sortOrder: true },
    });

    const newTopic = await prisma.topic.create({
      data: {
        id: Date.now().toString(),
        name,
        parentId: parentId ? String(parentId) : null,
        sortOrder: (maxSort._max.sortOrder || 0) + 1,
      },
    });

    res.status(201).json({ success: true, data: newTopic });
  } catch (error) {
    console.error('Create topic error:', error);
    res.status(500).json({ success: false, error: 'Failed to create topic.' });
  }
});

// ──────────────── DELETE /topics/:id ────────────────
router.delete('/topics/:id', authMiddleware, requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const topic = await prisma.topic.findUnique({ where: { id } });
    if (!topic) {
      return res.status(404).json({ success: false, error: 'Topic not found.' });
    }

    // Find all descendant chapter IDs
    const children = await prisma.topic.findMany({ where: { parentId: id }, select: { id: true } });
    const idsToDelete = [id, ...children.map((c: any) => c.id)];

    // Count questions to be deleted
    const questionCount = await prisma.question.count({ where: { topicId: { in: idsToDelete } } });

    // Delete in transaction: questions first (via cascade from topics), then topics
    await prisma.$transaction(async (tx) => {
      // Delete questions belonging to these topics
      await tx.question.deleteMany({ where: { topicId: { in: idsToDelete } } });
      // Delete child topics
      for (const ch of children) {
        await tx.topic.delete({ where: { id: ch.id } });
      }
      // Delete the topic itself
      await tx.topic.delete({ where: { id } });
    });

    res.json({
      success: true,
      message: 'Topic and related data deleted.',
      data: {
        deletedTopicId: id,
        deletedChildChapterCount: children.length,
        deletedQuestionCount: questionCount
      }
    });
  } catch (error) {
    console.error('Delete topic error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete topic.' });
  }
});

// ──────────────── POST / ────────────────
router.post('/', authMiddleware, requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { topicId, chapterId, type, content, options, answer, analysis, score, tags, difficulty } = req.body;

    const effectiveTopicId = chapterId || topicId;
    if (!effectiveTopicId || !type || !content || !answer || score === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields.'
      });
    }

    const chapter = await prisma.topic.findUnique({ where: { id: String(effectiveTopicId) } });
    if (!chapter) {
      return res.status(404).json({ success: false, error: 'Chapter not found.' });
    }
    if (!chapter.parentId) {
      return res.status(400).json({ success: false, error: 'Chapter must belong to a subject. Please create subject and chapter first.' });
    }
    const parentSubject = await prisma.topic.findUnique({ where: { id: chapter.parentId } });
    if (!parentSubject) {
      return res.status(400).json({ success: false, error: 'Parent subject not found. Please create subject first.' });
    }

    const created = await prisma.$transaction(async (tx) => {
      const q = await tx.question.create({
        data: {
          id: Date.now().toString(),
          topicId: String(effectiveTopicId),
          type: String(type),
          content,
          answer: JSON.stringify(answer),
          analysis: analysis || '',
          difficulty: difficulty || 1,
          score: parseInt(score),
          tags: JSON.stringify(tags || []),
        },
      });

      if (options && Array.isArray(options)) {
        for (let i = 0; i < options.length; i++) {
          await tx.questionOption.create({
            data: {
              questionId: q.id,
              optionId: options[i].id,
              content: options[i].content,
              sortOrder: i,
            },
          });
        }
      }

      // Return with options for response
      return tx.question.findUnique({
        where: { id: q.id },
        include: { options: { orderBy: { sortOrder: 'asc' } } },
      });
    });

    res.status(201).json({
      success: true,
      data: created ? toFrontendQuestion(created) : null
    });
  } catch (error) {
    console.error('Create question error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create question.'
    });
  }
});

// ──────────────── GET /import/template.json ────────────────
router.get('/import/template.json', (req, res) => {
  try {
    const jsonTemplate = [
      {
        "id": "template_0",
        "topicId": "1764140150589",
        "type": "single",
        "content": "1925年5月,以( )为起点,国共两党掀起了全国范围的大革命浪潮",
        "options": [
          { "id": "A", "content": "成立黄埔军校" },
          { "id": "B", "content": "国民党一大" },
          { "id": "C", "content": "广州国民政府成立" },
          { "id": "D", "content": "五卅运动" }
        ],
        "answer": "D",
        "analysis": "五卅运动是1925年5月30日发生在上海的反帝爱国运动，标志着大革命高潮的到来",
        "difficulty": 1,
        "score": 5,
        "tags": ["中国近代史", "大革命时期"],
        "createdAt": "2025-11-26T06:56:11.438Z",
        "updatedAt": "2025-11-26T06:56:11.438Z"
      },
      {
        "id": "template_1",
        "topicId": "1764140150589",
        "type": "multiple",
        "content": "下列哪些是中国的直辖市？",
        "options": [
          { "id": "A", "content": "北京" },
          { "id": "B", "content": "上海" },
          { "id": "C", "content": "广州" },
          { "id": "D", "content": "重庆" }
        ],
        "answer": ["A", "B", "D"],
        "analysis": "中国的直辖市包括北京、上海、天津、重庆",
        "difficulty": 1,
        "score": 8,
        "tags": ["中国地理", "行政区划"],
        "createdAt": "2025-11-26T06:56:11.438Z",
        "updatedAt": "2025-11-26T06:56:11.438Z"
      },
      {
        "id": "template_2",
        "topicId": "1764140150589",
        "type": "fill",
        "content": "中国的首都是______",
        "options": [],
        "answer": "北京",
        "analysis": "北京是中华人民共和国的首都",
        "difficulty": 1,
        "score": 4,
        "tags": ["中国地理", "首都"],
        "createdAt": "2025-11-26T06:56:11.438Z",
        "updatedAt": "2025-11-26T06:56:11.438Z"
      },
      {
        "id": "template_3",
        "topicId": "1764140150589",
        "type": "subjective",
        "content": "请简述中国改革开放的历史意义",
        "options": [],
        "answer": "改革开放是中国特色社会主义发展的重要里程碑，它极大地解放和发展了社会生产力，提高了人民生活水平，增强了国家综合国力，推动了中国特色社会主义事业的伟大飞跃",
        "analysis": "改革开放是决定当代中国命运的关键一招，也是决定实现'两个一百年'奋斗目标、实现中华民族伟大复兴的关键一招",
        "difficulty": 3,
        "score": 15,
        "tags": ["中国现代史", "改革开放"],
        "createdAt": "2025-11-26T06:56:11.438Z",
        "updatedAt": "2025-11-26T06:56:11.438Z"
      }
    ];

    const fileDescription = `/*
思政复习题库系统 - 题目导入模板说明

一、文件格式说明
- 本文件为JSON格式，用于批量导入题目数据
- 文件内容为题目对象数组，每个对象代表一道题目
- 支持四种题型：单选题(single)、多选题(multiple)、填空题(fill)、主观题(subjective)

二、题型定义与特征

1. 单选题(single)
   - 特征：从多个选项中选择一个正确答案
   - 结构：包含options数组，answer为字符串格式
   - 答案要求：必须是选项中的一个ID（A/B/C/D等）

2. 多选题(multiple)
   - 特征：从多个选项中选择多个正确答案
   - 结构：包含options数组，answer为数组格式
   - 答案要求：必须包含至少一个选项ID，且所有ID都必须在选项中存在

3. 填空题(fill)
   - 特征：在题目内容中填写正确答案
   - 结构：不需要options数组，answer为字符串格式
   - 答案要求：直接填写正确答案文本

4. 主观题(subjective)
   - 特征：需要考生主观作答的题目
   - 结构：不需要options数组，answer为字符串格式
   - 答案要求：提供参考答案文本

三、字段说明

必填字段：
- id: 题目ID，格式为字符串，建议使用时间戳+随机数
- topicId: 章节ID，必须是已存在的章节ID
- type: 题型，必须是以下之一：single, multiple, fill, subjective
- content: 题目内容，字符串格式
- answer: 正确答案，格式根据题型而定

可选字段：
- options: 选项列表，仅单选题和多选题需要
- analysis: 题目解析，字符串格式
- difficulty: 难度级别，1-简单，2-中等，3-困难
- score: 分值，数字格式
- tags: 标签列表，数组格式
- createdAt: 创建时间，ISO日期字符串格式
- updatedAt: 更新时间，ISO日期字符串格式

四、难度级别划分
1. 简单：考查基本概念和常识，大多数考生能正确作答
2. 中等：考查对知识点的理解和应用，需要一定的思考
3. 困难：考查综合分析和创新能力，有一定的挑战性

五、示例说明
- 本模板包含四种题型的示例，可参考示例格式填写
- 导入前请确保所有必填字段都已正确填写
- 导入时系统会自动验证数据格式，如有错误会提示具体原因

六、注意事项
- 章节ID必须是已存在的章节ID，请先在系统中创建课程和章节
- 选项ID建议使用A/B/C/D等字母，避免使用特殊字符
- 题目内容和解析支持HTML格式，但需注意转义特殊字符
- 导入成功后，题目将自动添加到对应章节
*/
`;

    const jsonString = fileDescription + JSON.stringify(jsonTemplate, null, 2);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="question_import_template.json"');
    res.send(jsonString);
  } catch (error) {
    console.error('Generate JSON template error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate JSON template.' });
  }
});

// ──────────────── GET /import/template.xlsx ────────────────
router.get('/import/template.xlsx', async (_req, res) => {
  try {
    const header = ['序号','题型','题干','A','B','C','D','答案','解析','课程','章节','标签'];
    const example = [
      ['1','单选','示例题干','选项A','选项B','','','A','解析文本','数学','代数','基础'],
      ['2','填空','示例填空题','','','','','正确答案','解析文本','数学','几何','']
    ];
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('模板');
    worksheet.addRow(header);
    worksheet.addRows(example);
    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="question_import_template.xlsx"');
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Generate template error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate template.' });
  }
});

// ──────────────── GET /import/template ────────────────
router.get('/import/template', (req, res) => {
  const format = req.query.format as string;
  if (format === 'json') {
    return res.redirect('./template.json');
  }
  return res.redirect('./template.xlsx');
});

router.get('/import-template', (req, res) => res.redirect('./import/template'));

// ──────────────── Helpers ────────────────
function cellToText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if ('richText' in value) {
      return value.richText.map((part) => part.text).join('');
    }
    if ('text' in value) {
      return String(value.text ?? '');
    }
    if ('result' in value) {
      return String(value.result ?? '');
    }
    if ('error' in value) {
      return '';
    }
  }
  return String(value);
}

async function parseExcelFile(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('Empty worksheet.');

  const rows: string[][] = [];
  for (let rowIndex = 1; rowIndex <= worksheet.rowCount; rowIndex += 1) {
    const row = worksheet.getRow(rowIndex);
    rows.push(
      Array.from({ length: worksheet.columnCount }, (_, columnIndex) =>
        cellToText(row.getCell(columnIndex + 1).value),
      ),
    );
  }

  if (rows.length < 2) throw new Error('Empty worksheet.');

  const header = rows[0].map((h) => String(h || '').trim());
  const col = (name: string) => header.findIndex(h => h === name);

  const required = ['序号','题型','题干','答案','课程','章节'];
  for (const r of required) {
    if (col(r) === -1) {
      throw new Error(`Missing column: ${r}`);
    }
  }

  return { rows, header, col };
}

function parseJsonFile(buffer: Buffer) {
  const jsonString = buffer.toString('utf-8');
  const data = JSON.parse(jsonString);
  if (!Array.isArray(data)) {
    throw new Error('JSON file must contain an array of questions.');
  }
  return data;
}

async function getAllTopicsFromDb(): Promise<any[]> {
  return prisma.topic.findMany();
}

// ──────────────── POST /import ────────────────
router.post('/import', authMiddleware, requireRole(['teacher','admin']), upload.single('file'), async (req: express.Request & { file?: Express.Multer.File }, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded.' });

    let imported = 0;
    const skipped: { row: number; reason: string }[] = [];
    const topicsCache = await getAllTopicsFromDb();

    const fileName = req.file.originalname.toLowerCase();

    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const { rows, header, col } = await parseExcelFile(req.file.buffer);

      const idx = {
        seq: col('序号'), type: col('题型'), stem: col('题干'),
        ans: col('答案'), ana: col('解析'), course: col('课程'), chapter: col('章节'), tags: col('标签')
      };

      const optionCols = extractOptionColumns(header, '答案');

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

      // Prepare rows for transaction
      interface ImportRow {
        i: number;
        chapterId: string;
        qType: QuestionType;
        stem: string;
        answer: string | string[];
        analysis: string;
        tags: string[];
        options?: { id: string; content: string }[];
      }
      const importRows: ImportRow[] = [];

      for (let i = 1; i < rows.length; i++) {
        try {
          const r = rows[i]; if (!r) continue;
          const seq = String(r[idx.seq] || '').trim();
          const tRaw = String(r[idx.type] || '').trim();
          const stem = String(r[idx.stem] || '').trim();
          const ansRaw = String(r[idx.ans] || '').trim();
          const courseName = String(r[idx.course] || '').trim();
          const chapterName = String(r[idx.chapter] || '').trim();

          if (!seq || !tRaw || !ansRaw || !courseName || !chapterName) {
            skipped.push({ row: i + 1, reason: '必填列为空' });
            continue;
          }

          const qType = normalizeType(tRaw);
          if (!qType) {
            skipped.push({ row: i + 1, reason: '题型不合法' });
            continue;
          }

          const course = topicsCache.find((t: any) => !t.parentId && t.name === courseName);
          if (!course) {
            skipped.push({ row: i + 1, reason: '课程不存在' });
            continue;
          }

          const chapter = topicsCache.find((t: any) => t.parentId === course.id && t.name === chapterName);
          if (!chapter) {
            skipped.push({ row: i + 1, reason: '章节不存在或不匹配' });
            continue;
          }

          let options: { id: string; content: string }[] = [];
          let answer: string | string[];

          if (qType === 'single' || qType === 'multiple') {
            const optVals = extractOptionValues(r, optionCols, header);

            if (optVals.length < 2) {
              const ids = optVals.map(o => o.id).join('、') || '无';
              skipped.push({ row: i + 1, reason: `选择题选项少于两个（仅 ${ids}）` });
              continue;
            }

            options = optVals;

            if (qType === 'single') {
              const a = ansRaw.toUpperCase();
              if (!options.some(o => o.id === a)) {
                const availableIds = options.map(o => o.id).join('、');
                skipped.push({ row: i + 1, reason: `单选答案${a}不在可用选项 ${availableIds} 中` });
                continue;
              }
              answer = a;
            } else {
              const extracted = splitMulti(ansRaw);
              const missingInOptions = extracted.filter(l => !options!.some(o => o.id === l));
              if (missingInOptions.length > 0) {
                const availableIds = options!.map(o => o.id).join('、');
                skipped.push({ row: i + 1, reason: `多选答案${missingInOptions.join('、')}不在可用选项 ${availableIds} 中` });
                continue;
              }
              const arr = extracted.filter(l => options!.some(o => o.id === l));
              if (arr.length < 1) {
                skipped.push({ row: i + 1, reason: '多选答案非法' });
                continue;
              }
              answer = Array.from(new Set(arr)).sort();
            }
          } else {
            options = [];
            answer = ansRaw;
          }

          const analysis = String(r[idx.ana] || '').trim();
          const tags = splitTags(String(r[idx.tags] || ''));

          importRows.push({ i, chapterId: chapter.id, qType, stem, answer, analysis, tags, options });
        } catch (error) {
          skipped.push({ row: i + 1, reason: `Error: ${(error as Error).message}` });
          continue;
        }
      }

      // Bulk insert in transaction
      await prisma.$transaction(async (tx) => {
        for (const row of importRows) {
          const qId = Date.now().toString() + '_' + row.i;
          await tx.question.create({
            data: {
              id: qId,
              topicId: row.chapterId,
              type: row.qType,
              content: row.stem,
              answer: JSON.stringify(row.answer),
              analysis: row.analysis,
              difficulty: 1,
              score: 5,
              tags: JSON.stringify(row.tags),
            },
          });

          if (row.options) {
            for (let j = 0; j < row.options.length; j++) {
              await tx.questionOption.create({
                data: {
                  questionId: qId,
                  optionId: row.options[j].id,
                  content: row.options[j].content,
                  sortOrder: j,
                },
              });
            }
          }
          imported++;
        }
      });
    } else if (fileName.endsWith('.json')) {
      const jsonQuestions = parseJsonFile(req.file.buffer);

      // Prepare rows
      interface JsonImportRow {
        i: number;
        qData: any;
      }
      const jsonImportRows: JsonImportRow[] = [];

      for (let i = 0; i < jsonQuestions.length; i++) {
        const qData = jsonQuestions[i];
        if (!qData.type || !qData.content || !qData.answer || !qData.topicId) {
          skipped.push({ row: i + 1, reason: '缺少必填字段(type, content, answer, topicId)' });
          continue;
        }
        const validTypes: QuestionType[] = ['single', 'multiple', 'fill', 'subjective'];
        if (!validTypes.includes(qData.type)) {
          skipped.push({ row: i + 1, reason: `无效题型: ${qData.type}` });
          continue;
        }
        const topic = topicsCache.find((t: any) => t.id === qData.topicId);
        if (!topic) {
          skipped.push({ row: i + 1, reason: `章节不存在: ${qData.topicId}` });
          continue;
        }
        if ((qData.type === 'single' || qData.type === 'multiple') && (!qData.options || !Array.isArray(qData.options))) {
          skipped.push({ row: i + 1, reason: `${qData.type}题型必须包含options数组` });
          continue;
        }
        if ((qData.type === 'single' || qData.type === 'multiple') && qData.options.length < 2) {
          skipped.push({ row: i + 1, reason: '选择题选项不能少于2个' });
          continue;
        }
        if (qData.type === 'single') {
          if (Array.isArray(qData.answer)) {
            skipped.push({ row: i + 1, reason: '单选题答案不能是数组' });
            continue;
          }
          const validAnswers = qData.options.map((opt: any) => opt.id);
          if (!validAnswers.includes(qData.answer)) {
            skipped.push({ row: i + 1, reason: '单选题答案不在选项中' });
            continue;
          }
        } else if (qData.type === 'multiple') {
          if (!Array.isArray(qData.answer)) {
            skipped.push({ row: i + 1, reason: '多选题答案必须是数组' });
            continue;
          }
          const validAnswers = qData.options.map((opt: any) => opt.id);
          for (const ans of qData.answer) {
            if (!validAnswers.includes(ans)) {
              skipped.push({ row: i + 1, reason: `多选题答案${ans}不在选项中` });
              continue;
            }
          }
        }
        jsonImportRows.push({ i, qData });
      }

      await prisma.$transaction(async (tx) => {
        for (const row of jsonImportRows) {
          const qData = row.qData;
          const qId = qData.id || (Date.now().toString() + '_' + row.i);
          await tx.question.create({
            data: {
              id: qId,
              topicId: qData.topicId,
              type: qData.type,
              content: qData.content,
              answer: JSON.stringify(qData.answer),
              analysis: qData.analysis || '',
              difficulty: qData.difficulty || 1,
              score: qData.score || 5,
              tags: JSON.stringify(qData.tags || []),
            },
          });

          if (qData.options && Array.isArray(qData.options)) {
            for (let j = 0; j < qData.options.length; j++) {
              await tx.questionOption.create({
                data: {
                  questionId: qId,
                  optionId: qData.options[j].id,
                  content: qData.options[j].content,
                  sortOrder: j,
                },
              });
            }
          }
          imported++;
        }
      });
    } else {
      return res.status(400).json({ success: false, error: 'Unsupported file type. Please upload .xlsx, .xls, or .json file.' });
    }

    res.json({ success: true, data: { imported, skipped: skipped.length, errors: skipped } });
  } catch (error) {
    console.error('Import questions error:', error);
    res.status(500).json({ success: false, error: `Failed to import questions: ${(error as Error).message}` });
  }
});

// ──────────────── POST /import/preview ────────────────
router.post('/import/preview', authMiddleware, requireRole(['teacher','admin']), upload.single('file'), async (req: express.Request & { file?: Express.Multer.File }, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded.' });

    const fileName = req.file.originalname.toLowerCase();
    const out: any[] = [];

    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const { rows, header, col } = await parseExcelFile(req.file.buffer);

      const idx = {
        seq: col('序号'), type: col('题型'), stem: col('题干'),
        ans: col('答案'), ana: col('解析'), course: col('课程'), chapter: col('章节'), tags: col('标签')
      };

      const optionCols = extractOptionColumns(header, '答案');

      for (let i = 1; i < rows.length; i++) {
        const r = rows[i]; if (!r) continue;
        const seq = String(r[idx.seq] || '').trim();
        const tRaw = String(r[idx.type] || '').trim();
        const stem = String(r[idx.stem] || '').trim();
        const ansRaw = String(r[idx.ans] || '').trim();
        const courseName = String(r[idx.course] || '').trim();
        const chapterName = String(r[idx.chapter] || '').trim();
        const optVals = extractOptionValues(r, optionCols, header);
        const analysis = String(r[idx.ana] || '').trim();
        const tags = String(r[idx.tags] || '').trim();
        const errors: string[] = [];

        if (!seq) errors.push('序号为空');
        if (!tRaw) errors.push('题型为空');
        if (!ansRaw) errors.push('答案为空');
        if (!courseName) errors.push('课程为空');
        if (!chapterName) errors.push('章节为空');

        const rowOut: any = { row: i + 1, seq, type: tRaw, stem, answer: ansRaw, analysis, course: courseName, chapter: chapterName, tags, errors, options: optVals };
        for (const colName of optionCols) {
          rowOut[colName] = optVals.find(o => o.id === colName)?.content || '';
        }

        out.push(rowOut);
      }
    } else if (fileName.endsWith('.json')) {
      const jsonQuestions = parseJsonFile(req.file.buffer);

      for (let i = 0; i < jsonQuestions.length; i++) {
        const qData = jsonQuestions[i];
        const errors: string[] = [];

        if (!qData.type) errors.push('缺少题型');
        if (!qData.content) errors.push('缺少题干');
        if (!qData.answer) errors.push('缺少答案');
        if (!qData.topicId) errors.push('缺少章节ID');

        const validTypes: QuestionType[] = ['single', 'multiple', 'fill', 'subjective'];
        if (qData.type && !validTypes.includes(qData.type)) {
          errors.push(`无效题型: ${qData.type}`);
        }

        if (qData.type === 'single' || qData.type === 'multiple') {
          if (!qData.options || !Array.isArray(qData.options)) {
            errors.push(`${qData.type}题型必须包含options数组`);
          } else if (qData.options.length < 2) {
            errors.push('选择题选项不能少于2个');
          }
        }

        const optionColsJson: string[] = [];
        if (qData.options && Array.isArray(qData.options)) {
          for (const opt of qData.options) {
            if (opt.id && opt.content) {
              optionColsJson.push(opt.id);
            }
          }
        }

        out.push({
          row: i + 1,
          seq: i + 1,
          type: qData.type || '',
          stem: qData.content || '',
          answer: qData.answer || '',
          analysis: qData.analysis || '',
          course: '',
          chapter: '',
          tags: Array.isArray(qData.tags) ? qData.tags.join(', ') : qData.tags || '',
          errors,
          options: qData.options || [],
          optionCols: optionColsJson,
        });
      }
    } else {
      return res.status(400).json({ success: false, error: 'Unsupported file type. Please upload .xlsx, .xls, or .json file.' });
    }

    res.json({ success: true, data: { rows: out } });
  } catch (error) {
    console.error('Import preview error:', error);
    res.status(500).json({ success: false, error: `Failed to preview import: ${(error as Error).message}` });
  }
});

// ──────────────── POST /import/commit ────────────────
router.post('/import/commit', authMiddleware, requireRole(['teacher','admin']), async (req, res) => {
  try {
    const payload = req.body || {};
    const rows: any[] = Array.isArray(payload.rows) ? payload.rows : [];
    if (rows.length === 0) return res.status(400).json({ success: false, error: 'No rows to commit.' });

    const topicsCache = await getAllTopicsFromDb();

    interface CommitRow {
      i: number;
      chapterId: string;
      qType: QuestionType;
      stem: string;
      answer: string | string[];
      analysis: string;
      tags: string[];
      options?: { id: string; content: string }[];
    }
    const commitRows: CommitRow[] = [];
    const errors: any[] = [];

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
      if (!courseName || !chapterName || !qType || !ansRaw || !stem) { errors.push({ index: i, reason: '缺少必填字段' }); continue; }

      const course = topicsCache.find((t: any) => !t.parentId && t.name === courseName);
      if (!course) { errors.push({ index: i, reason: '课程不存在' }); continue; }
      const chapter = topicsCache.find((t: any) => t.parentId === course.id && t.name === chapterName);
      if (!chapter) { errors.push({ index: i, reason: '章节不存在或不匹配' }); continue; }

      let options: { id: string; content: string }[] = [];
      let answer: string | string[] = ansRaw;
      if (qType === 'single' || qType === 'multiple') {
        if (Array.isArray(r.options)) {
          options = r.options.filter((o: any) => o.content && o.content.trim()).map((o: any) => ({ id: String(o.id), content: String(o.content).trim() }));
        } else {
          const A = String(r.A || '').trim();
          const B = String(r.B || '').trim();
          const C = String(r.C || '').trim();
          const D = String(r.D || '').trim();
          options = [];
          if (A) options.push({ id: 'A', content: A });
          if (B) options.push({ id: 'B', content: B });
          if (C) options.push({ id: 'C', content: C });
          if (D) options.push({ id: 'D', content: D });
        }
        if (options.length < 2) {
          const ids = options.map(o => o.id).join('、') || '无';
          errors.push({ index: i, reason: `选择题选项少于两个（仅 ${ids}）` }); continue;
        }
        if (qType === 'single') {
          const a = ansRaw.toUpperCase();
          if (!options.some(o => o.id === a)) {
            const availableIds = options.map(o => o.id).join('、');
            errors.push({ index: i, reason: `单选答案${a}不在可用选项 ${availableIds} 中` }); continue;
          }
          answer = a;
        } else {
          const extracted = parseMultiAnswer(ansRaw);
          const missingInOptions = extracted.filter(l => !options!.some(o => o.id === l));
          if (missingInOptions.length > 0) {
            const availableIds = options!.map(o => o.id).join('、');
            errors.push({ index: i, reason: `多选答案${missingInOptions.join('、')}不在可用选项 ${availableIds} 中` }); continue;
          }
          const arr = extracted.filter(l => options!.some(o => o.id === l));
          if (arr.length < 1) { errors.push({ index: i, reason: '多选答案非法' }); continue; }
          answer = Array.from(new Set(arr)).sort();
        }
      }

      commitRows.push({ i, chapterId: chapter.id, qType, stem, answer, analysis, tags, options });
    }

    let imported = 0;
    await prisma.$transaction(async (tx) => {
      for (const row of commitRows) {
        const qId = Date.now().toString() + '_' + row.i;
        await tx.question.create({
          data: {
            id: qId,
            topicId: row.chapterId,
            type: row.qType,
            content: row.stem,
            answer: JSON.stringify(row.answer),
            analysis: row.analysis,
            difficulty: 1,
            score: 5,
            tags: JSON.stringify(row.tags),
          },
        });

        if (row.options) {
          for (let j = 0; j < row.options.length; j++) {
            await tx.questionOption.create({
              data: {
                questionId: qId,
                optionId: row.options[j].id,
                content: row.options[j].content,
                sortOrder: j,
              },
            });
          }
        }
        imported++;
      }
    });

    res.json({ success: true, data: { imported, errors } });
  } catch (error) {
    console.error('Import commit error:', error);
    res.status(500).json({ success: false, error: 'Failed to commit import.' });
  }
});

// ──────────────── GET /:id ────────────────
router.get('/:id', async (req, res) => {
  try {
    const qid = String(req.params.id).trim();
    const dbQ = await prisma.question.findUnique({
      where: { id: qid },
      include: { options: { orderBy: { sortOrder: 'asc' } } },
    });

    if (!dbQ) {
      return res.status(404).json({ success: false, error: 'Question not found.' });
    }

    res.json({ success: true, data: toFrontendQuestion(dbQ) });
  } catch (error) {
    console.error('Get question error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch question.' });
  }
});

// ──────────────── PUT /:id ────────────────
router.put('/:id', authMiddleware, requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    const existing = await prisma.question.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Question not found.' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const q = await tx.question.update({
        where: { id: req.params.id },
        data: {
          topicId: req.body.topicId || req.body.chapterId || existing.topicId,
          type: req.body.type || existing.type,
          content: req.body.content !== undefined ? req.body.content : existing.content,
          answer: req.body.answer !== undefined ? JSON.stringify(req.body.answer) : existing.answer,
          analysis: req.body.analysis !== undefined ? req.body.analysis : existing.analysis,
          difficulty: req.body.difficulty !== undefined ? req.body.difficulty : existing.difficulty,
          score: req.body.score !== undefined ? parseInt(req.body.score) : existing.score,
          tags: req.body.tags !== undefined ? JSON.stringify(req.body.tags) : existing.tags,
          updatedAt: new Date(),
        },
      });

      // If options changed, rebuild
      if (req.body.options !== undefined) {
        await tx.questionOption.deleteMany({ where: { questionId: q.id } });
        if (Array.isArray(req.body.options)) {
          for (let i = 0; i < req.body.options.length; i++) {
            await tx.questionOption.create({
              data: {
                questionId: q.id,
                optionId: req.body.options[i].id,
                content: req.body.options[i].content,
                sortOrder: i,
              },
            });
          }
        }
      }

      return tx.question.findUnique({
        where: { id: q.id },
        include: { options: { orderBy: { sortOrder: 'asc' } } },
      });
    });

    res.json({ success: true, data: updated ? toFrontendQuestion(updated) : null });
  } catch (error) {
    console.error('Update question error:', error);
    res.status(500).json({ success: false, error: 'Failed to update question.' });
  }
});

// ──────────────── DELETE /:id ────────────────
router.delete('/:id', authMiddleware, requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    const id = String(req.params.id).trim();

    const question = await prisma.question.findUnique({ where: { id } });
    if (!question) {
      return res.status(404).json({ success: false, error: '题目不存在或已被删除。' });
    }

    const [examSubQCount, examAnswerCount, practiceAnswerCount, wrongBookCount] = await Promise.all([
      prisma.examSubmissionQuestion.count({ where: { questionId: id } }),
      prisma.examAnswer.count({ where: { questionId: id } }),
      prisma.practiceAnswer.count({ where: { questionId: id } }),
      prisma.wrongBookItem.count({ where: { questionId: id } }),
    ]);

    if (examSubQCount > 0 || examAnswerCount > 0 || practiceAnswerCount > 0 || wrongBookCount > 0) {
      return res.status(409).json({
        success: false,
        error: '该题目已被考试、练习或错题记录引用，不能直接删除。'
      });
    }

    await prisma.$transaction([
      prisma.questionOption.deleteMany({ where: { questionId: id } }),
      prisma.question.delete({ where: { id } }),
    ]);

    res.json({ success: true, message: '删除成功。' });
  } catch (error: any) {
    console.error('[QUESTION DELETE FAILED]', {
      questionId: req.params.id,
      errorName: error?.name,
      errorCode: error?.code,
      errorMessage: error?.message,
      errorMeta: error?.meta,
      time: new Date().toISOString()
    });

    if (error?.code === 'P2025') {
      return res.status(404).json({ success: false, error: '题目不存在或已被删除。' });
    }
    if (error?.code === 'P2003') {
      return res.status(409).json({
        success: false,
        error: '该题目已被考试、练习或错题记录引用，不能直接删除。'
      });
    }
    res.status(500).json({ success: false, error: `删除失败: ${error?.message || '未知错误'}` });
  }
});

export { router as questionRouter };

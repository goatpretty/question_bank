import express from 'express';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import {
  detailWrongBook, getWrongBookStats, listWrongBook, setWrongBookMastery, WrongBookError,
} from '../services/wrongBook.js';
import { recordFromCompletedSource } from '../services/wrongBookSources.js';
import type { WrongBookListQuery } from '../../shared/wrongbook.js';
import { prisma } from '../db/prisma.js';
import { collectJob } from '../services/wrongBookCollection.js';
import { backfillFilter, executeBackfill, previewBackfill } from '../services/wrongBookBackfill.js';

const router = express.Router();

function userId(req: AuthRequest): string {
  if (!req.user?.id) throw new WrongBookError(401, '请先登录。');
  return req.user.id;
}

function integer(value: unknown, fallback: number, maximum: number, label: string): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) throw new WrongBookError(400, `${label}必须为正整数。`);
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result > maximum) throw new WrongBookError(400, `${label}超出范围。`);
  return result;
}

function text(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !value.trim() || value.length > 200) throw new WrongBookError(400, `${label}格式不正确。`);
  return value.trim();
}

function paging(req: AuthRequest) {
  return {
    page: integer(req.query.page, 1, 1_000_000, '页码'),
    limit: integer(req.query.limit, 10, 100, '每页数量'),
  };
}

function listQuery(req: AuthRequest): WrongBookListQuery {
  const mastered = req.query.isMastered;
  if (mastered !== undefined && mastered !== 'true' && mastered !== 'false') throw new WrongBookError(400, '掌握状态必须为 true 或 false。');
  const type = req.query.type;
  if (type !== undefined && !['single', 'multiple', 'fill', 'subjective'].includes(String(type))) throw new WrongBookError(400, '题型不支持。');
  if (type !== undefined && typeof type !== 'string') throw new WrongBookError(400, '题型格式不正确。');
  const sortBy = req.query.sortBy ?? 'lastWrongAt';
  if (sortBy !== 'lastWrongAt' && sortBy !== 'wrongCount') throw new WrongBookError(400, '排序方式不支持。');
  return {
    ...paging(req), subjectId: text(req.query.subjectId, '课程'), chapterId: text(req.query.chapterId, '章节'),
    type: type as WrongBookListQuery['type'], isMastered: mastered === undefined ? undefined : mastered === 'true', sortBy,
  };
}

function failure(res: express.Response, error: unknown) {
  if (error instanceof WrongBookError) return res.status(error.status).json({ success: false, error: error.message });
  console.error('Wrongbook request failed:', error instanceof Error ? error.name : 'unknown');
  return res.status(500).json({ success: false, error: '错题本操作失败，请重试。' });
}

router.get('/wrongbook', authMiddleware, async (req: AuthRequest, res) => {
  try {
    res.json({ success: true, data: await listWrongBook(userId(req), listQuery(req)) });
  } catch (error) { failure(res, error); }
});

router.get('/wrongbook/stats', authMiddleware, async (req: AuthRequest, res) => {
  try {
    res.json({ success: true, data: await getWrongBookStats(userId(req)) });
  } catch (error) { failure(res, error); }
});

router.get('/wrongbook/collection-jobs', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const owner = userId(req);
    const status = req.query.status ?? 'pending';
    if (status !== 'pending' && status !== 'completed') throw new WrongBookError(400, '任务状态不支持。');
    const { page, limit } = paging(req);
    const data = await prisma.$transaction(async tx => ({
      jobs: await tx.wrongBookCollectionJob.findMany({ where: { userId: owner, status },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * limit, take: limit,
        select: { id: true, sourceType: true, sourceSessionId: true, status: true, attempts: true, lastError: true, createdAt: true, completedAt: true },
      }),
      total: await tx.wrongBookCollectionJob.count({ where: { userId: owner, status } }), page, limit,
    }));
    res.json({ success: true, data });
  } catch (error) { failure(res, error); }
});

router.post('/wrongbook/collection-jobs/:jobId/retry', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const data = await collectJob(userId(req), String(req.params.jobId));
    res.status(data.status === 'pending' ? 202 : 200).json({ success: true, data });
  } catch (error) { failure(res, error); }
});

router.post('/wrongbook/backfill/preview', authMiddleware, async (req: AuthRequest, res) => {
  try {
    res.json({ success: true, data: await previewBackfill(userId(req), backfillFilter(req.body)) });
  } catch (error) { failure(res, error); }
});

router.post('/wrongbook/backfill/execute', authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (req.body?.confirm !== true || typeof req.body?.previewToken !== 'string') throw new WrongBookError(400, '请先预览，并明确确认执行补录。');
    if (Object.keys(req.body).some(key => !['confirm', 'previewToken'].includes(key))) throw new WrongBookError(400, '补录请求包含不支持的字段。');
    res.json({ success: true, data: await executeBackfill(userId(req), req.body.previewToken) });
  } catch (error) { failure(res, error); }
});

router.get('/wrongbook/:questionId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { page, limit } = paging(req);
    res.json({ success: true, data: await detailWrongBook(userId(req), String(req.params.questionId), page, limit) });
  } catch (error) { failure(res, error); }
});

router.post('/wrongbook/:questionId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const body = req.body as Record<string, unknown> | undefined;
    if (!body || !['practice', 'exam'].includes(String(body.sourceType)) || typeof body.sourceType !== 'string') {
      throw new WrongBookError(400, '请提供作答来源 sourceType（practice 或 exam）及 sourceSessionId。');
    }
    const sourceSessionId = text(body.sourceSessionId, '来源会话');
    if (!sourceSessionId) throw new WrongBookError(400, '请提供来源会话 sourceSessionId。');
    if (Object.keys(body).some(key => !['sourceType', 'sourceSessionId'].includes(key))) {
      throw new WrongBookError(400, '只能指定作答来源，答案、用户和时间由服务端核验。');
    }
    const result = await recordFromCompletedSource(userId(req), String(req.params.questionId), body.sourceType as 'practice' | 'exam', sourceSessionId);
    res.status(result.created ? 201 : 200).json({ success: true, data: result });
  } catch (error) { failure(res, error); }
});

router.put('/wrongbook/:questionId/master', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const isMastered: unknown = req.body?.isMastered === undefined ? true : req.body.isMastered;
    if (typeof isMastered !== 'boolean') throw new WrongBookError(400, 'isMastered 必须为布尔值。');
    res.json({ success: true, data: await setWrongBookMastery(userId(req), String(req.params.questionId), isMastered) });
  } catch (error) { failure(res, error); }
});

router.put('/wrongbook/:questionId/unmaster', authMiddleware, async (req: AuthRequest, res) => {
  try {
    res.json({ success: true, data: await setWrongBookMastery(userId(req), String(req.params.questionId), false) });
  } catch (error) { failure(res, error); }
});

router.get('/profile', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const stats = await getWrongBookStats(userId(req));
    res.json({
      success: true,
      data: {
        user: req.user,
        stats: { totalWrongQuestions: stats.total, masteredWrongQuestions: stats.mastered, masteryRate: stats.masteryRate },
      },
    });
  } catch (error) { failure(res, error); }
});

export { router as userRouter };

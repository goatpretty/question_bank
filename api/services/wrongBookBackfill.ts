import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { backup, DatabaseSync } from 'node:sqlite';
import jwt from 'jsonwebtoken';
import type { Prisma } from '../../generated/prisma/client.js';
import { JWT_SECRET } from '../config.js';
import { isolatedDatabasePath, prisma } from '../db/prisma.js';
import { recordWrongOccurrenceInTransaction, WrongBookError, type RecordWrongOccurrenceInput } from './wrongBook.js';
import { buildFromCompletedSource, SourceSkipError } from './wrongBookSources.js';
import { collectionEntries } from './wrongBookCollection.js';
import type { WrongBookSource } from '../../shared/wrongbook.js';

export interface BackfillFilter { sourceType: 'all' | WrongBookSource }
export interface BackfillRow {
  sourceType: WrongBookSource;
  sourceSessionId: string;
  questionId: string;
  disposition: 'new' | 'skipped' | 'error';
  reason: string;
  snapshotMissing: boolean;
  entry?: RecordWrongOccurrenceInput;
}
export interface BackfillPreview {
  filter: BackfillFilter;
  completedSources: number;
  excludedSources: number;
  newQuestions: number;
  newOccurrences: number;
  skipped: number;
  alreadyRecorded: number;
  anomalies: number;
  snapshotMissing: number;
  rows: BackfillRow[];
}
interface PreviewToken extends jwt.JwtPayload { purpose: string; userId: string; filter: BackfillFilter; digest: string }

function digest(value: unknown) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }

export function backfillFilter(body: unknown): BackfillFilter {
  if (body === undefined || body === null) return { sourceType: 'all' };
  if (typeof body !== 'object' || Array.isArray(body)) throw new WrongBookError(400, '补录筛选格式不正确。');
  const query = body as Record<string, unknown>;
  if (Object.keys(query).some(key => key !== 'sourceType') || (query.sourceType !== undefined && (typeof query.sourceType !== 'string' || !['all', 'practice', 'exam'].includes(query.sourceType)))) {
    throw new WrongBookError(400, '仅支持当前账号的 practice、exam 或 all 来源。');
  }
  return { sourceType: (query.sourceType ?? 'all') as BackfillFilter['sourceType'] };
}

async function scanBackfill(tx: Prisma.TransactionClient, userId: string, filter: BackfillFilter): Promise<BackfillPreview> {
  const practices = filter.sourceType === 'exam' ? [] : await tx.practiceSession.findMany({ where: { userId }, orderBy: { id: 'asc' }, include: { answers: { orderBy: { questionId: 'asc' } } } });
  const exams = filter.sourceType === 'practice' ? [] : await tx.examSubmission.findMany({ where: { userId }, orderBy: { id: 'asc' }, include: { questions: { orderBy: { questionId: 'asc' } } } });
  const sources = [
    ...practices.map(source => ({ type: 'practice' as const, id: source.id, status: source.status, questionIds: source.answers.map(answer => answer.questionId) })),
    ...exams.map(source => ({ type: 'exam' as const, id: source.id, status: source.status, questionIds: source.questions.map(question => question.questionId) })),
  ];
  const rows: BackfillRow[] = [];
  for (const source of sources.filter(item => item.status === 'completed')) {
    const job = await tx.wrongBookCollectionJob.findUnique({ where: { userId_sourceType_sourceSessionId: { userId, sourceType: source.type, sourceSessionId: source.id } } });
    const frozenEntries = job ? collectionEntries(job.payloadJson) : undefined;
    for (const questionId of source.questionIds) {
      const row: BackfillRow = { sourceType: source.type, sourceSessionId: source.id, questionId, disposition: 'skipped', reason: '', snapshotMissing: false };
      const exists = await tx.wrongBookOccurrence.findUnique({ where: { userId_sourceType_sourceSessionId_questionId: {
        userId, sourceType: source.type, sourceSessionId: source.id, questionId,
      } } });
      if (exists) row.reason = 'already_recorded';
      else {
        try {
          const entry = frozenEntries ? frozenEntries.find(item => item.questionId === questionId) : await buildFromCompletedSource(tx, userId, questionId, source.type, source.id);
          if (!entry) row.reason = 'not_wrong_at_submission';
          else {
            row.disposition = 'new'; row.reason = 'eligible'; row.entry = entry;
            row.snapshotMissing = entry.snapshotStatus === 'reconstructed';
          }
        } catch (error) {
          if (error instanceof SourceSkipError) row.reason = error.reason;
          else { row.disposition = 'error'; row.reason = error instanceof WrongBookError ? error.message : '来源数据异常，无法可靠补录。'; }
        }
      }
      rows.push(row);
    }
  }
  return {
    filter, completedSources: sources.filter(source => source.status === 'completed').length,
    excludedSources: sources.filter(source => source.status !== 'completed').length,
    newQuestions: new Set(rows.filter(row => row.disposition === 'new').map(row => row.questionId)).size,
    newOccurrences: rows.filter(row => row.disposition === 'new').length,
    skipped: rows.filter(row => row.disposition === 'skipped').length,
    alreadyRecorded: rows.filter(row => row.reason === 'already_recorded').length,
    anomalies: rows.filter(row => row.disposition === 'error').length,
    snapshotMissing: rows.filter(row => row.snapshotMissing).length, rows,
  };
}

export async function previewBackfill(userId: string, filter: BackfillFilter) {
  const preview = await prisma.$transaction(tx => scanBackfill(tx, userId, filter), { maxWait: 10000, timeout: 30000 });
  const previewToken = jwt.sign({ purpose: 'wrongbook-backfill', userId, filter, digest: digest(preview) }, JWT_SECRET, { expiresIn: '15m', jwtid: randomUUID() });
  return { ...preview, previewToken, expiresInSeconds: 900 };
}

async function backupBeforeBackfill() {
  const folder = join(dirname(isolatedDatabasePath), 'wrongbook-backups');
  mkdirSync(folder, { recursive: true });
  const path = join(folder, `before-backfill-${randomUUID()}.db`);
  const source = new DatabaseSync(isolatedDatabasePath, { readOnly: true });
  try { await backup(source, path); } finally { source.close(); }
  return path;
}

export async function executeBackfill(userId: string, previewToken: string) {
  let token: PreviewToken;
  try {
    token = jwt.verify(previewToken, JWT_SECRET, { algorithms: ['HS256'] }) as PreviewToken;
  } catch { throw new WrongBookError(409, '预览已失效或不合法，请重新预览。'); }
  if (token.purpose !== 'wrongbook-backfill' || token.userId !== userId) throw new WrongBookError(404, '补录预览不存在。');
  const tokenHash = digest(previewToken);
  const previous = await prisma.wrongBookBackfillRun.findUnique({ where: { tokenHash } });
  if (previous) return { ...JSON.parse(previous.resultJson) as Record<string, unknown>, replayed: true };
  // Check freshness before making a backup, and again inside the write transaction.
  const current = await prisma.$transaction(tx => scanBackfill(tx, userId, token.filter), { maxWait: 10000, timeout: 30000 });
  if (digest(current) !== token.digest) throw new WrongBookError(409, '预览后的来源或错题记录发生变化，请重新预览。');
  const backupPath = await backupBeforeBackfill();
  return prisma.$transaction(async tx => {
    const existing = await tx.wrongBookBackfillRun.findUnique({ where: { tokenHash } });
    if (existing) return { ...JSON.parse(existing.resultJson) as Record<string, unknown>, replayed: true };
    const preview = await scanBackfill(tx, userId, token.filter);
    if (digest(preview) !== token.digest) throw new WrongBookError(409, '预览后的来源或错题记录发生变化，请重新预览。');
    let added = 0;
    for (const row of preview.rows) {
      if (row.disposition !== 'new' || !row.entry) continue;
      const result = await recordWrongOccurrenceInTransaction(tx, { ...row.entry, preserveMastery: true });
      if (result.created) added++;
    }
    const result = {
      added, newQuestions: preview.newQuestions, skipped: preview.skipped, anomalies: preview.anomalies,
      snapshotMissing: preview.snapshotMissing, failed: 0, backupPath, replayed: false,
    };
    await tx.wrongBookBackfillRun.create({ data: { id: randomUUID(), userId, tokenHash, previewDigest: token.digest, resultJson: JSON.stringify(result) } });
    return result;
  }, { maxWait: 10000, timeout: 30000 });
}

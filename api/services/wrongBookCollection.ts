import { randomUUID } from 'node:crypto';
import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../db/prisma.js';
import { recordWrongOccurrenceInTransaction, WrongBookError, type RecordWrongOccurrenceInput } from './wrongBook.js';
import type { WrongBookSource } from '../../shared/wrongbook.js';

export interface CollectionResult {
  jobId: string;
  status: 'pending' | 'completed';
  message?: string;
}

export async function enqueueCollection(
  tx: Prisma.TransactionClient, userId: string, sourceType: WrongBookSource, sourceSessionId: string,
  entries: RecordWrongOccurrenceInput[], receipt: unknown,
) {
  return tx.wrongBookCollectionJob.create({ data: {
    id: randomUUID(), userId, sourceType, sourceSessionId,
    payloadJson: JSON.stringify(entries), receiptJson: JSON.stringify(receipt),
  } });
}

export function collectionEntries(payloadJson: string): RecordWrongOccurrenceInput[] {
  const entries = JSON.parse(payloadJson) as (Omit<RecordWrongOccurrenceInput, 'submittedAt'> & { submittedAt: string })[];
  if (!Array.isArray(entries)) throw new WrongBookError(422, '待收录快照损坏。');
  return entries.map(entry => ({ ...entry, submittedAt: new Date(entry.submittedAt) }));
}

export async function collectJob(userId: string, jobId: string): Promise<CollectionResult> {
  const job = await prisma.wrongBookCollectionJob.findFirst({ where: { id: jobId, userId } });
  if (!job) throw new WrongBookError(404, '收录任务不存在。');
  if (job.status === 'completed') return { jobId, status: 'completed' };
  try {
    await prisma.$transaction(async tx => {
      const current = await tx.wrongBookCollectionJob.findUniqueOrThrow({ where: { id: jobId } });
      if (current.status === 'completed') return;
      for (const entry of collectionEntries(current.payloadJson)) {
        if (entry.userId !== userId || entry.sourceType !== current.sourceType || entry.sourceSessionId !== current.sourceSessionId) {
          throw new WrongBookError(422, '收录任务来源不一致。');
        }
        await recordWrongOccurrenceInTransaction(tx, entry);
      }
      await tx.wrongBookCollectionJob.update({ where: { id: jobId }, data: {
        status: 'completed', completedAt: new Date(), attempts: { increment: 1 }, lastError: null,
      } });
    }, { maxWait: 10000, timeout: 30000 });
    return { jobId, status: 'completed' };
  } catch {
    const message = '提交已保存，错题收录尚未完成，可重试收录。';
    await prisma.wrongBookCollectionJob.updateMany({ where: { id: jobId, userId, status: 'pending' }, data: {
      attempts: { increment: 1 }, lastError: message,
    } }).catch(() => {});
    return { jobId, status: 'pending', message };
  }
}

export async function collectionForSource(userId: string, sourceType: WrongBookSource, sourceSessionId: string) {
  const job = await prisma.wrongBookCollectionJob.findUnique({ where: {
    userId_sourceType_sourceSessionId: { userId, sourceType, sourceSessionId },
  } });
  return job ? collectJob(userId, job.id) : null;
}

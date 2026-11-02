/**
 * 从当前 SQLite 数据库导出可公开的题库数据。
 *
 * 只读取 topics / questions / question_options 三张表，
 * 不读取 users、考试提交、练习作答、错题记录等运行数据。
 *
 * 用法：
 *   npx tsx scripts/export-public-dataset.ts
 *   npx tsx scripts/export-public-dataset.ts --out data/dataset-v1.json
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { prisma } from '../api/db/prisma';

interface SourceRow {
  id: string;
  chapter?: string;
  source?: {
    file?: string;
    questionNumber?: number;
    lineStart?: number;
    lineEnd?: number;
    correctAnswer?: string;
    myAnswer?: string;
    answerEvidence?: string;
  };
}

interface DatasetQuestion {
  id: string;
  topicId: string;
  type: string;
  content: string;
  answer: unknown;
  analysis: string;
  difficulty: number;
  score: number;
  tags: unknown;
  options: Array<{ optionId: string; content: string; sortOrder: number }>;
}

const SOURCE_MAP_PATH = resolve('docs/毛概-新增/正式导入/来源映射.json');
const DATA_LICENSE = 'CC BY 4.0';
const ATTRIBUTION = 'Question Bank contributors';

function safeJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function csvEscape(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function loadSourceMap(): Map<string, SourceRow> {
  const map = new Map<string, SourceRow>();
  if (!existsSync(SOURCE_MAP_PATH)) return map;

  const rows = JSON.parse(readFileSync(SOURCE_MAP_PATH, 'utf8')) as SourceRow[];
  for (const row of rows) {
    if (row?.id) map.set(row.id, row);
  }
  return map;
}

function describeSource(row: SourceRow | undefined): { type: string; ref: string; notes: string } {
  if (!row?.source) {
    return {
      type: 'maintainer-provided',
      ref: '',
      notes: '来源清单待补充',
    };
  }

  const source = row.source;
  const location = [
    source.file,
    source.questionNumber ? `第${source.questionNumber}题` : '',
    source.lineStart ? `L${source.lineStart}-L${source.lineEnd ?? source.lineStart}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return {
    type: 'textbook-derived',
    ref: location,
    notes: [row.chapter, source.answerEvidence].filter(Boolean).join('; '),
  };
}

async function main() {
  const outIndex = process.argv.indexOf('--out');
  const outputPath = resolve(outIndex >= 0 ? process.argv[outIndex + 1] : 'data/dataset-v1.json');

  const [topics, questions, options] = await Promise.all([
    prisma.topic.findMany({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] }),
    prisma.question.findMany({ orderBy: { id: 'asc' } }),
    prisma.questionOption.findMany({
      orderBy: [{ questionId: 'asc' }, { sortOrder: 'asc' }, { optionId: 'asc' }],
    }),
  ]);

  const topicNameById = new Map(topics.map((topic) => [topic.id, topic.name]));
  const sourceMap = loadSourceMap();
  const optionsByQuestion = new Map<string, DatasetQuestion['options']>();
  for (const option of options) {
    const list = optionsByQuestion.get(option.questionId) ?? [];
    list.push({
      optionId: option.optionId,
      content: option.content,
      sortOrder: option.sortOrder,
    });
    optionsByQuestion.set(option.questionId, list);
  }

  const datasetQuestions: DatasetQuestion[] = questions.map((question) => ({
    id: question.id,
    topicId: question.topicId,
    type: question.type,
    content: question.content,
    answer: safeJson(question.answer, question.answer),
    analysis: question.analysis,
    difficulty: question.difficulty,
    score: question.score,
    tags: safeJson(question.tags, []),
    options: optionsByQuestion.get(question.id) ?? [],
  }));

  const dataset = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    license: DATA_LICENSE,
    attribution: ATTRIBUTION,
    counts: {
      topics: topics.length,
      questions: datasetQuestions.length,
      options: datasetQuestions.reduce((sum, question) => sum + question.options.length, 0),
    },
    topics: topics.map((topic) => ({
      id: topic.id,
      name: topic.name,
      parentId: topic.parentId,
      sortOrder: topic.sortOrder,
    })),
    questions: datasetQuestions,
  };

  const serialized = `${JSON.stringify(dataset, null, 2)}\n`;

  // 防泄漏断言：导出内容不得出现运行数据字段。
  const forbiddenKeys = [
    'password_hash',
    'email',
    'userId',
    'submissionId',
    'sessionId',
    'wrongCount',
    'lastLoginPassword',
  ];
  for (const key of forbiddenKeys) {
    if (serialized.includes(`"${key}"`)) {
      throw new Error(`[export] 导出内容中出现禁止字段：${key}`);
    }
  }

  const unknownTopic = datasetQuestions.find((question) => !topicNameById.has(question.topicId));
  if (unknownTopic) {
    throw new Error(`[export] 题目 ${unknownTopic.id} 的 topicId 不存在：${unknownTopic.topicId}`);
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, serialized);

  const provenanceLines = [
    'question_id,topic,source_type,source_ref,license,attribution,notes',
  ];
  let mapped = 0;
  for (const question of datasetQuestions) {
    const source = sourceMap.get(question.id);
    if (source) mapped += 1;
    const described = describeSource(source);
    provenanceLines.push(
      [
        question.id,
        topicNameById.get(question.topicId) ?? '',
        described.type,
        described.ref,
        DATA_LICENSE,
        ATTRIBUTION,
        described.notes,
      ]
        .map(csvEscape)
        .join(','),
    );
  }
  writeFileSync(resolve('docs/data-provenance.csv'), `${provenanceLines.join('\n')}\n`);

  console.log(
    JSON.stringify(
      {
        output: outputPath,
        bytes: Buffer.byteLength(serialized),
        counts: dataset.counts,
        provenanceMapped: mapped,
        provenanceUnmapped: datasetQuestions.length - mapped,
        provenance: resolve('docs/data-provenance.csv'),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error('[export] failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

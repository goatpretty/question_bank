/**
 * 初始化数据库：
 *   1. 导入 data/dataset-v1.json 中的公开题库数据（幂等）。
 *   2. 按环境变量创建管理员；未配置时可选创建演示账号。
 *
 * 用法：
 *   npm run db:seed
 *   ADMIN_EMAIL=admin@example.com ADMIN_INITIAL_PASSWORD='...' npm run db:seed
 *   SEED_DEMO=true npm run db:seed
 */
import { existsSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import bcrypt from 'bcryptjs';
import { prisma } from '../api/db/prisma';
import { config } from '../api/config';

interface DatasetTopic {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
}

interface DatasetOption {
  optionId: string;
  content: string;
  sortOrder: number;
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
  options: DatasetOption[];
}

interface Dataset {
  schemaVersion: number;
  counts: { topics: number; questions: number; options: number };
  topics: DatasetTopic[];
  questions: DatasetQuestion[];
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

async function importDataset(): Promise<void> {
  const datasetPath = resolve('data/dataset-v1.json');
  if (!existsSync(datasetPath)) {
    console.warn(`[seed] 未找到 ${datasetPath}，跳过题库导入。`);
    return;
  }

  const dataset = JSON.parse(readFileSync(datasetPath, 'utf8')) as Dataset;
  if (dataset.schemaVersion !== 1) {
    throw new Error(`[seed] 不支持的数据集版本：${dataset.schemaVersion}`);
  }

  const parents = dataset.topics.filter((topic) => !topic.parentId);
  const children = dataset.topics.filter((topic) => topic.parentId);

  for (const batch of chunk(parents, 100)) {
    await prisma.$transaction(
      batch.map((topic) =>
        prisma.topic.upsert({
          where: { id: topic.id },
          update: { name: topic.name, parentId: null, sortOrder: topic.sortOrder },
          create: { id: topic.id, name: topic.name, parentId: null, sortOrder: topic.sortOrder },
        }),
      ),
    );
  }

  for (const batch of chunk(children, 100)) {
    await prisma.$transaction(
      batch.map((topic) =>
        prisma.topic.upsert({
          where: { id: topic.id },
          update: { name: topic.name, parentId: topic.parentId, sortOrder: topic.sortOrder },
          create: { id: topic.id, name: topic.name, parentId: topic.parentId, sortOrder: topic.sortOrder },
        }),
      ),
    );
  }

  for (const batch of chunk(dataset.questions, 100)) {
    await prisma.$transaction(
      batch.map((question) => {
        const data = {
          topicId: question.topicId,
          type: question.type,
          content: question.content,
          answer: JSON.stringify(question.answer),
          analysis: question.analysis,
          difficulty: question.difficulty,
          score: question.score,
          tags: JSON.stringify(question.tags ?? []),
        };
        return prisma.question.upsert({
          where: { id: question.id },
          update: data,
          create: { id: question.id, ...data },
        });
      }),
    );
  }

  const options = dataset.questions.flatMap((question) =>
    question.options.map((option) => ({
      questionId: question.id,
      optionId: option.optionId,
      content: option.content,
      sortOrder: option.sortOrder,
    })),
  );

  for (const batch of chunk(options, 200)) {
    await prisma.$transaction(
      batch.map((option) =>
        prisma.questionOption.upsert({
          where: {
            questionId_optionId: {
              questionId: option.questionId,
              optionId: option.optionId,
            },
          },
          update: { content: option.content, sortOrder: option.sortOrder },
          create: option,
        }),
      ),
    );
  }

  console.log(
    `[seed] 题库导入完成：${dataset.topics.length} 个专题，${dataset.questions.length} 道题，${options.length} 个选项。`,
  );
}

async function createAdmin(): Promise<void> {
  if (!config.adminEmail) {
    return;
  }

  if (!config.adminInitialPassword || config.adminInitialPassword.length < 8) {
    throw new Error('[seed] 设置 ADMIN_EMAIL 时必须同时设置至少 8 位的 ADMIN_INITIAL_PASSWORD。');
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: config.adminEmail }, { username: 'admin' }] },
  });

  if (existing) {
    console.log(`[seed] 管理员已存在（${existing.email}），跳过创建。`);
    return;
  }

  await prisma.user.create({
    data: {
      id: `u-admin-${Date.now()}`,
      username: 'admin',
      email: config.adminEmail,
      password_hash: await bcrypt.hash(config.adminInitialPassword, 12),
      role: 'admin',
      needPasswordChange: true,
    },
  });

  console.log(`[seed] 已创建管理员 ${config.adminEmail}，首次登录后必须修改密码。`);
}

async function createDemoUsers(): Promise<void> {
  if (!config.seedDemo) {
    return;
  }

  const userCount = await prisma.user.count();
  if (userCount > 0) {
    console.log('[seed] 用户表非空，跳过演示账号创建。');
    return;
  }

  const password = randomBytes(9).toString('base64url');
  const hash = await bcrypt.hash(password, 10);
  const now = new Date();

  await prisma.user.createMany({
    data: [
      {
        id: 'u-demo-admin',
        username: 'admin',
        email: 'admin@example.com',
        password_hash: hash,
        role: 'admin',
        needPasswordChange: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'u-demo-teacher',
        username: 'teacher',
        email: 'teacher@example.com',
        password_hash: hash,
        role: 'teacher',
        needPasswordChange: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'u-demo-student',
        username: 'student',
        email: 'student@example.com',
        password_hash: hash,
        role: 'student',
        needPasswordChange: false,
        createdAt: now,
        updatedAt: now,
      },
    ],
  });

  console.log('[seed] 已创建演示账号：admin / teacher / student');
  console.log(`[seed] 演示账号密码：${password}`);
  console.log('[seed] 该密码只显示一次，请勿提交到仓库。');
}

async function main(): Promise<void> {
  await importDataset();
  await createAdmin();
  await createDemoUsers();

  const [users, topics, questions, options] = await Promise.all([
    prisma.user.count(),
    prisma.topic.count(),
    prisma.question.count(),
    prisma.questionOption.count(),
  ]);

  console.log(
    `[seed] 当前数据：${users} 个用户，${topics} 个专题，${questions} 道题，${options} 个选项。`,
  );

  if (users === 0) {
    console.warn(
      '[seed] 当前没有任何用户。请设置 ADMIN_EMAIL 与 ADMIN_INITIAL_PASSWORD 后重新运行，或使用 SEED_DEMO=true 创建演示账号。',
    );
  }
}

main()
  .catch((error) => {
    console.error('[seed] 失败：', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "needPasswordChange" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "verification_codes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "topics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "topics_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "topics" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topicId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "analysis" TEXT NOT NULL DEFAULT '',
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "score" INTEGER NOT NULL DEFAULT 5,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "questions_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "question_options" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "question_options_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "exams" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "duration" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "exam_rules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "questionTypesJson" TEXT NOT NULL,
    CONSTRAINT "exam_rules_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "exam_rules_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "exam_submissions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "score" INTEGER NOT NULL DEFAULT 0,
    "completedAt" DATETIME,
    "abandonedAt" DATETIME,
    CONSTRAINT "exam_submissions_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "exam_submissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "exam_submission_questions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "submissionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "shuffledOptionsJson" TEXT,
    CONSTRAINT "exam_submission_questions_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "exam_submissions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "exam_submission_questions_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "exam_answers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "submissionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answerJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "exam_answers_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "exam_submissions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "exam_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "practice_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "totalQuestions" INTEGER NOT NULL,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "startTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "topicIdsJson" TEXT NOT NULL,
    "servedQuestionsJson" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "practice_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "practice_answers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "userAnswerJson" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "answeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "practice_answers_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "practice_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "practice_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "wrong_book_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "wrongCount" INTEGER NOT NULL DEFAULT 1,
    "lastWrongAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isMastered" BOOLEAN NOT NULL DEFAULT false,
    "masteredAt" DATETIME,
    CONSTRAINT "wrong_book_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "wrong_book_items_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "wrong_book_occurrences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceSessionId" TEXT NOT NULL,
    "sourceAnswerId" TEXT NOT NULL,
    "sourceTitle" TEXT NOT NULL,
    "submittedAt" DATETIME NOT NULL,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAnswerJson" TEXT NOT NULL,
    "correctAnswerJson" TEXT NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "snapshotStatus" TEXT NOT NULL,
    CONSTRAINT "wrong_book_occurrences_userId_questionId_fkey" FOREIGN KEY ("userId", "questionId") REFERENCES "wrong_book_items" ("userId", "questionId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "wrong_book_collection_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceSessionId" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "receiptJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME
);

-- CreateTable
CREATE TABLE "wrong_book_backfill_runs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "previewDigest" TEXT NOT NULL,
    "resultJson" TEXT NOT NULL,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "verification_codes_email_type_idx" ON "verification_codes"("email", "type");

-- CreateIndex
CREATE INDEX "verification_codes_email_type_used_idx" ON "verification_codes"("email", "type", "used");

-- CreateIndex
CREATE INDEX "questions_topicId_idx" ON "questions"("topicId");

-- CreateIndex
CREATE INDEX "questions_type_idx" ON "questions"("type");

-- CreateIndex
CREATE INDEX "question_options_questionId_idx" ON "question_options"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "question_options_questionId_optionId_key" ON "question_options"("questionId", "optionId");

-- CreateIndex
CREATE INDEX "exams_status_idx" ON "exams"("status");

-- CreateIndex
CREATE INDEX "exams_createdBy_idx" ON "exams"("createdBy");

-- CreateIndex
CREATE INDEX "exam_rules_examId_idx" ON "exam_rules"("examId");

-- CreateIndex
CREATE UNIQUE INDEX "exam_rules_examId_topicId_key" ON "exam_rules"("examId", "topicId");

-- CreateIndex
CREATE INDEX "exam_submissions_userId_idx" ON "exam_submissions"("userId");

-- CreateIndex
CREATE INDEX "exam_submissions_examId_idx" ON "exam_submissions"("examId");

-- CreateIndex
CREATE INDEX "exam_submissions_status_idx" ON "exam_submissions"("status");

-- CreateIndex
CREATE INDEX "exam_submissions_userId_status_idx" ON "exam_submissions"("userId", "status");

-- CreateIndex
CREATE INDEX "exam_submission_questions_submissionId_idx" ON "exam_submission_questions"("submissionId");

-- CreateIndex
CREATE INDEX "exam_submission_questions_questionId_idx" ON "exam_submission_questions"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "exam_submission_questions_submissionId_order_key" ON "exam_submission_questions"("submissionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "exam_submission_questions_submissionId_questionId_key" ON "exam_submission_questions"("submissionId", "questionId");

-- CreateIndex
CREATE INDEX "exam_answers_submissionId_idx" ON "exam_answers"("submissionId");

-- CreateIndex
CREATE INDEX "exam_answers_questionId_idx" ON "exam_answers"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "exam_answers_submissionId_questionId_key" ON "exam_answers"("submissionId", "questionId");

-- CreateIndex
CREATE INDEX "practice_sessions_userId_idx" ON "practice_sessions"("userId");

-- CreateIndex
CREATE INDEX "practice_sessions_userId_status_idx" ON "practice_sessions"("userId", "status");

-- CreateIndex
CREATE INDEX "practice_answers_sessionId_idx" ON "practice_answers"("sessionId");

-- CreateIndex
CREATE INDEX "practice_answers_questionId_idx" ON "practice_answers"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "practice_answers_sessionId_questionId_key" ON "practice_answers"("sessionId", "questionId");

-- CreateIndex
CREATE INDEX "wrong_book_items_userId_idx" ON "wrong_book_items"("userId");

-- CreateIndex
CREATE INDEX "wrong_book_items_userId_isMastered_idx" ON "wrong_book_items"("userId", "isMastered");

-- CreateIndex
CREATE UNIQUE INDEX "wrong_book_items_userId_questionId_key" ON "wrong_book_items"("userId", "questionId");

-- CreateIndex
CREATE INDEX "wrong_book_occurrences_userId_questionId_submittedAt_idx" ON "wrong_book_occurrences"("userId", "questionId", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "wrong_book_occurrences_userId_sourceType_sourceSessionId_questionId_key" ON "wrong_book_occurrences"("userId", "sourceType", "sourceSessionId", "questionId");

-- CreateIndex
CREATE INDEX "wrong_book_collection_jobs_userId_status_idx" ON "wrong_book_collection_jobs"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "wrong_book_collection_jobs_userId_sourceType_sourceSessionId_key" ON "wrong_book_collection_jobs"("userId", "sourceType", "sourceSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "wrong_book_backfill_runs_tokenHash_key" ON "wrong_book_backfill_runs"("tokenHash");

-- CreateIndex
CREATE INDEX "wrong_book_backfill_runs_userId_idx" ON "wrong_book_backfill_runs"("userId");


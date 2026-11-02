export type WrongBookSource = 'practice' | 'exam';
export type WrongBookAnswer = string | string[];
export type WrongBookQuestionType = 'single' | 'multiple' | 'fill' | 'subjective';

export interface WrongBookOptionSnapshot {
  id: string;
  content: string;
  displayLabel: string;
}

export interface WrongBookQuestionSnapshot {
  id: string;
  topicId: string;
  chapterName: string;
  subjectId: string;
  subjectName: string;
  type: WrongBookQuestionType;
  content: string;
  options: WrongBookOptionSnapshot[];
  answer: WrongBookAnswer;
  analysis: string;
}

export interface WrongBookOccurrenceView {
  id: string;
  sourceType: WrongBookSource;
  sourceSessionId: string;
  sourceAnswerId: string;
  sourceTitle: string;
  submittedAt: string;
  recordedAt: string;
  userAnswer: WrongBookAnswer;
  correctAnswer: WrongBookAnswer;
  userDisplayAnswer: WrongBookAnswer;
  correctDisplayAnswer: WrongBookAnswer;
  snapshotStatus: 'captured' | 'reconstructed';
  question: WrongBookQuestionSnapshot;
}

export interface WrongBookItemView {
  id: string;
  userId: string;
  questionId: string;
  wrongCount: number;
  lastWrongAt: string;
  isMastered: boolean;
  masteredAt: string | null;
  question: WrongBookQuestionSnapshot;
}

export interface WrongBookStats {
  total: number;
  mastered: number;
  unmastered: number;
  masteryRate: number;
}

export interface WrongBookListQuery {
  page: number;
  limit: number;
  subjectId?: string;
  chapterId?: string;
  type?: WrongBookQuestionType;
  isMastered?: boolean;
  sortBy: 'lastWrongAt' | 'wrongCount';
}

export interface WrongBookListData {
  wrongQuestions: WrongBookItemView[];
  total: number;
  page: number;
  limit: number;
  stats: WrongBookStats;
  filteredStats: WrongBookStats;
}

export interface WrongBookDetailData {
  item: WrongBookItemView;
  occurrences: WrongBookOccurrenceView[];
  total: number;
  page: number;
  limit: number;
  legacyOccurrenceCount: number;
}

export interface RecordWrongBookSourceRequest {
  sourceType: WrongBookSource;
  sourceSessionId: string;
}

export interface WrongBookCollectionJobView {
  id: string;
  sourceType: WrongBookSource;
  sourceSessionId: string;
  status: 'pending' | 'completed';
  attempts: number;
  lastError: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface WrongBookCollectionResult {
  jobId: string;
  status: 'pending' | 'completed';
  message?: string;
}

export interface WrongBookBackfillRow {
  sourceType: WrongBookSource;
  sourceSessionId: string;
  questionId: string;
  disposition: 'new' | 'skipped' | 'error';
  reason: string;
  snapshotMissing: boolean;
  entry?: {
    submittedAt: string;
    sourceTitle: string;
    userAnswer: WrongBookAnswer;
    correctAnswer: WrongBookAnswer;
    snapshot: WrongBookQuestionSnapshot;
    snapshotStatus: 'captured' | 'reconstructed';
  };
}

export interface WrongBookBackfillPreview {
  completedSources: number;
  excludedSources: number;
  newQuestions: number;
  newOccurrences: number;
  skipped: number;
  alreadyRecorded: number;
  anomalies: number;
  snapshotMissing: number;
  rows: WrongBookBackfillRow[];
  previewToken: string;
  expiresInSeconds: number;
}

export interface WrongBookBackfillResult {
  added: number;
  newQuestions: number;
  skipped: number;
  anomalies: number;
  snapshotMissing: number;
  failed: number;
  replayed: boolean;
}

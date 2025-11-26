export interface User {
  id: string;
  username: string;
  email: string;
  role: 'student' | 'teacher' | 'admin';
  createdAt: Date;
  updatedAt: Date;
}

export interface Topic {
  id: string;
  name: string;
  parentId?: string;
  sortOrder: number;
  createdAt: Date;
}

export type QuestionType = 'single' | 'multiple' | 'fill' | 'subjective';

export interface Question {
  id: string;
  topicId: string;
  type: QuestionType;
  content: string;
  options?: QuestionOption[];
  answer: string | string[];
  analysis: string;
  difficulty: number;
  score: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateQuestionData {
  topicId: string;
  type: QuestionType;
  content: string;
  options?: QuestionOption[];
  answer: string | string[];
  analysis?: string;
  difficulty?: number;
  score: number;
  tags?: string[];
}

export interface QuestionOption {
  id: string;
  content: string;
}

export interface PracticeSession {
  id: string;
  userId: string;
  topicIds: string[];
  totalQuestions: number;
  correctCount: number;
  startTime: Date;
  endTime?: Date;
  status: 'in_progress' | 'completed' | 'abandoned';
}

export interface PracticeAnswer {
  id: string;
  sessionId: string;
  questionId: string;
  userAnswer: string | string[];
  isCorrect: boolean;
  answeredAt: Date;
}

export interface Exam {
  id: string;
  name: string;
  description: string;
  duration: number;
  rules: ExamRule[];
  isActive: boolean;
  status?: 'draft' | 'published';
  createdBy?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface CreateExamData {
  name: string;
  description: string;
  duration: number;
  rules: ExamRule[];
  isActive: boolean;
}

export interface ExamRule {
  topicId: string;
  questionTypes: {
    type: QuestionType;
    count: number;
    score: number;
    difficulty?: number[];
  }[];
}

export interface ExamResult {
  id: string;
  examId: string;
  userId: string;
  totalScore: number;
  obtainedScore: number;
  startTime: Date;
  endTime: Date;
  detailReport: ExamDetailReport;
}

export interface ExamDetailReport {
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  answers: ExamAnswer[];
}

export interface ExamAnswer {
  questionId: string;
  userAnswer: string | string[];
  isCorrect: boolean;
  score: number;
}

export interface WrongQuestion {
  id: string;
  userId: string;
  questionId: string;
  wrongCount: number;
  lastWrongAt: Date;
  isMastered: boolean;
  masteredAt?: Date;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: User;
  message?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

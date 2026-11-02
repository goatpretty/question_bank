import { create } from 'zustand';
import { Exam, ExamResult } from '../../shared/types';
import { examService } from '../services/examService';

interface ExamQuestionData {
  question: any;
  order: number;
  totalQuestions: number;
  userAnswer: any;
}

interface ExamState {
  exams: Exam[];
  currentExam: Exam | null;
  examResult: ExamResult | null;
  examQuestions: any[];
  currentQuestionIndex: number;
  isLoading: boolean;
  error: string | null;
  submissionId: string | null;
  timeRemaining: number;
  totalQuestions: number;
  userAnswers: Record<number, string | string[]>;
  examHistory: any[];
  currentQuestion: any | null;
  currentAnswer: string | string[] | null;
  fetchExamQuestion: (order: number) => Promise<ExamQuestionData | null>;
  fetchExams: (params?: { page?: number; limit?: number; search?: string }) => Promise<void>;
  startExam: (examId: string) => Promise<void>;
  endExam: () => void;
  submitExam: () => Promise<void>;
  nextQuestion: () => void;
  previousQuestion: () => void;
  goToQuestion: (index: number) => void;
  answerQuestion: (questionId: string, userAnswer: string | string[]) => Promise<boolean>;
  fetchExamResult: (submissionId?: string) => Promise<void>;
  fetchExamHistory: (params?: { page?: number; limit?: number }) => Promise<void>;
  clearError: () => void;
  tickTimer: () => void;
}

export const useExamStore = create<ExamState>((set, get) => ({
  exams: [],
  currentExam: null,
  examResult: null,
  examQuestions: [],
  currentQuestionIndex: 0,
  isLoading: false,
  error: null,
  submissionId: null,
  timeRemaining: 0,
  totalQuestions: 0,
  userAnswers: {},
  examHistory: [],
  currentQuestion: null,
  currentAnswer: null,

  fetchExamQuestion: async (order: number) => {
    const { submissionId } = get();
    if (!submissionId) {
      set({ error: 'No active exam session.' });
      return null;
    }
    set({ isLoading: true, error: null });
    try {
      const res = await examService.getExamQuestion(submissionId, order);
      const cached = get().userAnswers;
      const answer = Object.prototype.hasOwnProperty.call(cached, res.data.order) ? cached[res.data.order] : res.data.userAnswer;
      set({
        currentQuestion: res.data.question,
        currentAnswer: answer ?? null,
        userAnswers: answer === null || answer === undefined ? cached : { ...cached, [res.data.order]: answer },
        currentQuestionIndex: res.data.order - 1,
        totalQuestions: res.data.totalQuestions,
        isLoading: false,
      });
      return res.data;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch question',
        isLoading: false,
      });
      return null;
    }
  },

  fetchExams: async (params?: { page?: number; limit?: number; search?: string }) => {
    set({ isLoading: true, error: null });
    try {
      const res = await examService.getAllExams({ ...params, status: 'published' });
      set({ exams: res.data.exams ?? [], isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch exams',
        isLoading: false,
      });
    }
  },

  startExam: async (examId: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await examService.startExam(examId);
      const submission = res.data;
      const endTime = new Date(submission.endTime).getTime();
      const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      set({
        currentExam: get().exams.find((e) => e.id === examId) || null,
        submissionId: submission.id,
        timeRemaining: remaining,
        examQuestions: [],
        currentQuestionIndex: 0,
        totalQuestions: 0,
        userAnswers: {},
        currentQuestion: null,
        currentAnswer: null,
        examResult: null,
        isLoading: false,
      });
      await get().fetchExamQuestion(1);
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to start exam',
        isLoading: false,
      });
    }
  },

  endExam: async () => {
    const { submissionId } = get();
    if (submissionId) {
      try {
        await examService.abandonExam(submissionId);
      } catch (error) {
        console.warn('Failed to abandon exam:', error);
      }
    }
    set({
      submissionId: null,
      currentExam: null,
      examQuestions: [],
      currentQuestionIndex: 0,
      totalQuestions: 0,
      timeRemaining: 0,
      userAnswers: {},
      currentQuestion: null,
      currentAnswer: null,
      examResult: null,
      isLoading: false,
    });
  },

  submitExam: async () => {
    const { submissionId, currentQuestion, userAnswers, currentQuestionIndex, currentAnswer } = get();
    if (!submissionId) {
      set({ error: 'No active exam session.' });
      return;
    }
    set({ isLoading: true, error: null });
    try {
      if (currentQuestion) {
        const currentOrderAnswer = userAnswers[currentQuestionIndex + 1];
        const answerToSubmit = currentAnswer ?? currentOrderAnswer ?? '';
        await examService.submitExamAnswer(
          submissionId,
          currentQuestion.id,
          answerToSubmit,
          true
        );
      } else {
        await examService.submitExamAnswer(
          submissionId,
          '',
          '',
          true
        );
      }
      await get().fetchExamResult(submissionId);
      await get().fetchExamHistory();
      set({
        submissionId: null,
        currentExam: null,
        currentQuestion: null,
        currentAnswer: null,
        examQuestions: [],
        currentQuestionIndex: 0,
        totalQuestions: 0,
        userAnswers: {},
        timeRemaining: 0,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to submit exam',
        isLoading: false,
      });
    }
  },

  nextQuestion: () => {
    const { currentQuestionIndex, totalQuestions } = get();
    if (currentQuestionIndex < totalQuestions - 1) {
      get().fetchExamQuestion(currentQuestionIndex + 2);
    }
  },

  previousQuestion: () => {
    const { currentQuestionIndex } = get();
    if (currentQuestionIndex > 0) {
      get().fetchExamQuestion(currentQuestionIndex);
    }
  },

  goToQuestion: (index: number) => {
    const { submissionId, totalQuestions } = get();
    if (!submissionId) return;
    if (index >= 0 && index < totalQuestions) {
      get().fetchExamQuestion(index + 1);
    }
  },

  answerQuestion: async (questionId: string, userAnswer: string | string[]) => {
    const { submissionId, currentQuestionIndex } = get();
    if (!submissionId) return false;
    const answers = { ...get().userAnswers };
    answers[currentQuestionIndex + 1] = userAnswer;
    set({ userAnswers: answers, currentAnswer: userAnswer, error: null });
    try {
      await examService.submitExamAnswer(submissionId, questionId, userAnswer, false, currentQuestionIndex + 1);
      return true;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to submit answer' });
      return false;
    }
  },

  fetchExamResult: async (submissionId?: string) => {
    const sid = submissionId ?? get().submissionId;
    if (!sid) {
      set({ error: 'No submission ID available.' });
      return;
    }
    set({ isLoading: true, error: null });
    try {
      const res = await examService.getSubmissionResult(sid);
      set({ examResult: res.data as any, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch exam result',
        isLoading: false,
      });
    }
  },

  fetchExamHistory: async (params?: { page?: number; limit?: number }) => {
    set({ isLoading: true, error: null });
    try {
      const res = await examService.getExamHistory(params);
      const submissions = res.data?.submissions ?? [];
      set({ examHistory: Array.isArray(submissions) ? submissions : [], isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch exam history',
        isLoading: false,
      });
    }
  },

  clearError: () => {
    set({ error: null });
  },

  tickTimer: () => {
    const { timeRemaining } = get();
    if (timeRemaining > 0) {
      set({ timeRemaining: timeRemaining - 1 });
    }
  },
}));

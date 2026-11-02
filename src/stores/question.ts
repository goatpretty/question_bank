import { create } from 'zustand';
import { Question, Topic } from '../../shared/types';
import { questionService } from '../services/questionService';
import { wrongBookService } from '../services/wrongBookService';
import type { WrongBookItemView } from '../../shared/wrongbook';

interface QuestionState {
  questions: Question[];
  currentQuestion: Question | null;
  topics: Topic[];
  wrongQuestions: WrongBookItemView[];
  isLoading: boolean;
  error: string | null;
  fetchQuestions: (filters?: { topicId?: string; difficulty?: number; type?: string }) => Promise<void>;
  fetchQuestionById: (questionId: string) => Promise<void>;
  fetchTopics: () => Promise<void>;
  fetchWrongQuestions: (params?: { isMastered?: boolean; page?: number; limit?: number }) => Promise<void>;
  markQuestionAsMastered: (questionId: string) => Promise<void>;
  addToWrongBook: (questionId: string) => Promise<void>;
  removeFromWrongBook: (wrongQuestionId: string) => Promise<void>;
  clearError: () => void;
}

export const useQuestionStore = create<QuestionState>((set, get) => ({
  questions: [],
  currentQuestion: null,
  topics: [],
  wrongQuestions: [],
  isLoading: false,
  error: null,

  fetchQuestions: async (filters) => {
    set({ isLoading: true, error: null });
    try {
      const res = await questionService.getAllQuestions(filters);
      set({ questions: res.data.questions ?? [], isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch questions',
        isLoading: false,
      });
    }
  },

  fetchQuestionById: async (questionId: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await questionService.getQuestionById(questionId);
      set({ currentQuestion: res.data, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch question',
        isLoading: false,
      });
    }
  },

  fetchTopics: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await questionService.getTopics();
      set({ topics: res.data ?? [], isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch topics',
        isLoading: false,
      });
    }
  },

  fetchWrongQuestions: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const res = await wrongBookService.getWrongBook(params);
      set({ wrongQuestions: res.data.wrongQuestions ?? [], isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch wrong questions',
        isLoading: false,
      });
    }
  },

  markQuestionAsMastered: async (questionId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await wrongBookService.markMastered(questionId);
      const updated = get().wrongQuestions.map(wq =>
        wq.questionId === questionId ? response.data : wq,
      );
      set({ wrongQuestions: updated, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to mark question as mastered',
        isLoading: false,
      });
    }
  },

  addToWrongBook: async (questionId: string) => {
    set({ isLoading: true, error: null });
    try {
      await wrongBookService.addWrongQuestion(questionId);
      set({ isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to add to wrong book',
        isLoading: false,
      });
    }
  },

  removeFromWrongBook: async (wrongQuestionId: string) => {
    set({ isLoading: true, error: null });
    try {
      const updated = get().wrongQuestions.filter(wq => wq.id !== wrongQuestionId);
      set({ wrongQuestions: updated, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to remove from wrong book',
        isLoading: false,
      });
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));

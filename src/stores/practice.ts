import { create } from 'zustand';
import { PracticeSession, PracticeAnswer, Question } from '../../shared/types';
import { practiceService } from '../services/practiceService';

interface PracticeState {
  currentSession: PracticeSession | null;
  sessionHistory: PracticeSession[];
  currentQuestion: Question | null;
  practiceAnswers: PracticeAnswer[];
  isLoading: boolean;
  error: string | null;
  startPractice: (topicIds: string[]) => void;
  endPractice: () => void;
  nextQuestion: () => void;
  previousQuestion: () => void;
  answerQuestion: (questionId: string, userAnswer: string | string[]) => void;
  fetchSessionHistory: () => Promise<void>;
  clearError: () => void;
}

export const usePracticeStore = create<PracticeState>((set, get) => ({
  currentSession: null,
  sessionHistory: [],
  currentQuestion: null,
  practiceAnswers: [],
  isLoading: false,
  error: null,

  startPractice: (topicIds: string[]) => {
    const session: PracticeSession = {
      id: `session-${Date.now()}`,
      userId: '', // Will be set from auth store
      topicIds,
      totalQuestions: 0,
      correctCount: 0,
      startTime: new Date(),
      status: 'in_progress',
    };
    set({ currentSession: session, isLoading: false, error: null });
  },

  endPractice: () => {
    const { currentSession } = get();
    if (currentSession) {
      const updatedSession: PracticeSession = {
        ...currentSession,
        endTime: new Date(),
        status: 'completed' as const,
      };
      set({ 
        currentSession: null, 
        sessionHistory: [...get().sessionHistory, updatedSession],
        currentQuestion: null,
        practiceAnswers: [],
      });
    }
  },

  nextQuestion: () => {
    // Implementation will be completed after API service is added
    set({ isLoading: false });
  },

  previousQuestion: () => {
    // Implementation will be completed after API service is added
    set({ isLoading: false });
  },

  answerQuestion: (_questionId: string, _userAnswer: string | string[]) => {
    // Implementation will be completed after API service is added
    set({ isLoading: false });
  },

  fetchSessionHistory: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await practiceService.getSessionHistory();
      const sessions = res.data?.sessions ?? res.data ?? [];
      set({ sessionHistory: Array.isArray(sessions) ? sessions : [], isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch practice history',
        isLoading: false,
      });
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));

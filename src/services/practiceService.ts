import { PracticeSession, PracticeAnswer, Question } from '../../shared/types';
import { BaseService } from './baseService';

interface PracticeSessionResponse {
  success: boolean;
  data: PracticeSession & { totalCount?: number };
  error?: string;
}

interface PracticeAnswerResponse {
  data: PracticeAnswer;
}

interface PracticeQuestionResponse {
  success: boolean;
  data: Question;
  error?: string;
}

interface PracticeSessionHistoryResponse {
  success: boolean;
  data: any;
  error?: string;
}

interface PracticeResultResponse {
  success: boolean;
  data: {
    results: any[];
    total: number;
    correct: number;
    totalQuestions: number;
  };
  error?: string;
}

class PracticeService extends BaseService {
  constructor() {
    super('practice');
  }

  async startPractice(data: { topicIds: string[]; questionCount?: number }): Promise<PracticeSessionResponse> {
    return this.post<PracticeSessionResponse>(`${this.apiBase}/start`, data);
  }

  async submitPractice(sessionId: string, answers: { questionId: string; userAnswer: string | string[] }[], completed?: boolean): Promise<PracticeSessionResponse> {
    return this.post<PracticeSessionResponse>(`${this.apiBase}/submit`, { practiceId: sessionId, answers, completed });
  }

  async endPractice(sessionId: string, answers: { questionId: string; userAnswer: string | string[] }[] = []): Promise<PracticeSessionResponse> {
    return this.submitPractice(sessionId, answers, true);
  }

  async getPracticeQuestion(sessionId: string): Promise<PracticeQuestionResponse> {
    return this.get<PracticeQuestionResponse>(`${this.apiBase}/question/${sessionId}`);
  }

  async getSessionDetail(id: string): Promise<PracticeSessionResponse> {
    return this.get<PracticeSessionResponse>(`${this.apiBase}/session/${id}`);
  }

  async getSessionResult(sessionId: string): Promise<PracticeResultResponse> {
    return this.get<PracticeResultResponse>(`${this.apiBase}/result/${sessionId}`);
  }

  async getSessionHistory(params?: { page?: number; limit?: number }): Promise<PracticeSessionHistoryResponse> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params)
        .filter(([_, v]) => v !== undefined)
        .forEach(([key, value]) => {
          searchParams.append(key, String(value));
        });
    }
    const url = `${this.apiBase}/history?${searchParams}`;
    return this.get<PracticeSessionHistoryResponse>(url);
  }

  submitAnswer(_sessionId: string, _questionId: string, _userAnswer: string | string[]): Promise<PracticeAnswerResponse> {
    throw new Error(
      'submitAnswer: 后端无逐题提交接口。请使用 submitPractice() 批量提交答案。' +
      '如需本地暂存答案，请在调用层自行维护状态。'
    );
  }
}

export const practiceService = new PracticeService();

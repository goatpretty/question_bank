import { Exam } from '../../shared/types';
import { BaseService } from './baseService';

interface ExamListResponse {
  data: {
    exams: Exam[];
    total: number;
    page: number;
    limit: number;
  };
}

interface ExamResponse {
  data: Exam;
}

interface ExamStatisticsResponse {
  data: any;
}

interface StartExamResponse {
  data: {
    id: string;
    examId: string;
    userId: string;
    startTime: string;
    endTime: string;
    status: 'in_progress';
    score: number;
    answers: any[];
  };
}

interface ExamQuestionResponse {
  data: {
    question: any;
    order: number;
    totalQuestions: number;
    userAnswer: any;
  };
}

interface SubmitAnswerResponse {
  data: {
    submission: any;
    completed: boolean;
  };
}

interface SubmissionResultResponse {
  data: {
    submission: any;
    results: Array<{
      question: any;
      order: number;
      userAnswer: any;
      isCorrect: boolean;
      score: number;
    }>;
    totalScore: number;
    maxScore: number;
  };
}

interface ExamHistoryResponse {
  data: {
    submissions: any[];
    total: number;
    page: number;
    limit: number;
  };
}

interface ExamPreviewResponse {
  success: boolean;
  data: {
    byType: Array<{ type: string; required: number; available: number }>;
    totalRequired: number;
    totalAvailable: number;
    warnings: string[];
  };
  error?: string;
}

interface ExamPublishResponse {
  success: boolean;
  data: any;
  error?: string;
}

class ExamService extends BaseService {
  constructor() {
    super('exams');
  }

  async getAllExams(params?: { page?: number; limit?: number; search?: string; status?: 'draft' | 'published' | 'archived' | 'unarchived' }, throwOnError = false): Promise<ExamListResponse> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params)
        .filter(([_, v]) => v !== undefined)
        .forEach(([key, value]) => {
          searchParams.append(key, String(value));
        });
    }
    const url = `${this.apiBase}?${searchParams}`;

    try {
      return await this.get<ExamListResponse>(url);
    } catch (error) {
      if (throwOnError) throw error;
      console.warn('考试列表请求失败:', error);
      return { data: { exams: [], total: 0, page: 1, limit: 0 } };
    }
  }

  async getExamById(id: string): Promise<ExamResponse> {
    return this.get<ExamResponse>(`${this.apiBase}/${id}`);
  }

  async createExam(data: Partial<Exam>): Promise<ExamResponse> {
    return this.post<ExamResponse>(this.apiBase, data);
  }

  async updateExam(id: string, data: Partial<Exam>): Promise<ExamResponse> {
    return this.put<ExamResponse>(`${this.apiBase}/${id}`, data);
  }

  async deleteExam(id: string): Promise<void> {
    try {
      await this.delete(`${this.apiBase}/${id}`);
    } catch (error: any) {
      if (error.message.includes('404')) {
        return;
      }
      throw error;
    }
  }

  async archiveExam(id: string): Promise<ExamPublishResponse> {
    return this.post<ExamPublishResponse>(`${this.apiBase}/${id}/archive`);
  }

  async restoreExam(id: string): Promise<ExamPublishResponse> {
    return this.post<ExamPublishResponse>(`${this.apiBase}/${id}/restore`);
  }

  async startExam(examId: string): Promise<StartExamResponse> {
    return this.post<StartExamResponse>(`${this.apiBase}/${examId}/start`);
  }

  async getExamQuestion(submissionId: string, order: number): Promise<ExamQuestionResponse> {
    return this.get<ExamQuestionResponse>(`${this.apiBase}/submission/${submissionId}/question/${order}`);
  }

  async submitExamAnswer(
    submissionId: string,
    questionId: string,
    answer: string | string[],
    completed: boolean = false,
    order?: number
  ): Promise<SubmitAnswerResponse> {
    return this.post<SubmitAnswerResponse>(`${this.apiBase}/submission/${submissionId}/answer`, {
      questionId,
      answer,
      completed,
      order,
    });
  }

  async abandonExam(submissionId: string): Promise<{ success: boolean; data: any }> {
    return this.post<{ success: boolean; data: any }>(`${this.apiBase}/submission/${submissionId}/abandon`);
  }

  async getSubmissionResult(submissionId: string): Promise<SubmissionResultResponse> {
    return this.get<SubmissionResultResponse>(`${this.apiBase}/submission/${submissionId}/result`);
  }

  async getExamHistory(params?: { page?: number; limit?: number }): Promise<ExamHistoryResponse> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.limit) searchParams.append('limit', String(params.limit));
    const query = searchParams.toString();
    return this.get<ExamHistoryResponse>(`${this.apiBase}/history${query ? `?${query}` : ''}`);
  }

  /** @deprecated No backend endpoint exists. To be implemented in a future phase with new route GET /api/exams/:id/statistics. */
  async getExamStatistics(_examId: string): Promise<ExamStatisticsResponse> {
    console.warn('getExamStatistics is not yet supported by the backend.');
    return { data: null };
  }

  async getExamPreview(examId: string): Promise<ExamPreviewResponse> {
    return this.get<ExamPreviewResponse>(`${this.apiBase}/${examId}/preview`);
  }

  async publishExam(examId: string): Promise<ExamPublishResponse> {
    return this.post<ExamPublishResponse>(`${this.apiBase}/${examId}/publish`);
  }

  async unpublishExam(examId: string): Promise<ExamPublishResponse> {
    return this.post<ExamPublishResponse>(`${this.apiBase}/${examId}/unpublish`);
  }
}

export const examService = new ExamService();

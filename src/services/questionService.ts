import { Question, CreateQuestionData, Topic } from '../../shared/types';
import { BaseService } from './baseService';
import { getToken } from './tokenUtils';

interface QuestionListResponse {
  data: {
    questions: Question[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface QuestionResponse {
  data: Question;
}

interface QuestionsByFilterResponse {
  data: Question[];
}

export interface PublicTotals {
  topics: number;
  courses: number;
  chapters: number;
  questions: number;
  options: number;
}

interface PublicStatsResponse {
  success: boolean;
  data: { totals: PublicTotals };
}

class QuestionService extends BaseService {
  constructor() {
    super('questions');
  }

  async getAllQuestions(params?: { page?: number; limit?: number; topicId?: string; difficulty?: number; type?: string }, throwOnError = false): Promise<QuestionListResponse> {
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
      return await this.get<QuestionListResponse>(url);
    } catch (error) {
      if (throwOnError) throw error;
      console.warn('题目列表请求失败:', error);
      return { data: { questions: [], total: 0, page: 1, limit: 0, totalPages: 0 } };
    }
  }

  async getQuestionById(id: string): Promise<QuestionResponse> {
    return this.get<QuestionResponse>(`${this.apiBase}/${id}`);
  }

  async createQuestion(data: CreateQuestionData): Promise<QuestionResponse> {
    return this.post<QuestionResponse>(this.apiBase, data);
  }

  async updateQuestion(id: string, data: Partial<CreateQuestionData>): Promise<QuestionResponse> {
    return this.put<QuestionResponse>(`${this.apiBase}/${id}`, data);
  }

  async deleteQuestion(id: string): Promise<void> {
    return this.delete(`${this.apiBase}/${id}`);
  }

  async getQuestionsBySubject(subject: string): Promise<QuestionsByFilterResponse> {
    return this.get<QuestionsByFilterResponse>(`${this.apiBase}/subject/${subject}`);
  }

  async getQuestionsByKnowledgePoint(knowledgePoint: string): Promise<QuestionsByFilterResponse> {
    return this.get<QuestionsByFilterResponse>(`${this.apiBase}/knowledge/${knowledgePoint}`);
  }

  async getQuestionsByDifficulty(difficulty: number): Promise<QuestionsByFilterResponse> {
    return this.get<QuestionsByFilterResponse>(`${this.apiBase}/difficulty/${difficulty}`);
  }

  async getTopics(): Promise<{ success: boolean; data: Topic[] }> {
    return this.get<{ success: boolean; data: Topic[] }>(`${this.apiBase}/topics`);
  }

  /** 公开的题库统计，供首页展示真实数据。 */
  async getPublicStats(): Promise<PublicStatsResponse> {
    return this.get<PublicStatsResponse>(`${this.apiBase}/stats`);
  }

  async createTopic(data: { name: string; parentId?: string }): Promise<{ success: boolean; data: Topic }> {
    return this.post<{ success: boolean; data: Topic }>(`${this.apiBase}/topics`, data);
  }

  async deleteTopic(id: string): Promise<void> {
    return this.delete(`${this.apiBase}/topics/${id}`);
  }

  async downloadImportTemplate(format: string): Promise<Blob> {
    const url = `${this.apiBase}/import/template?format=${format}`;
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(url, { headers });
    return response.blob();
  }

  async previewImport(file: File): Promise<{ success: boolean; data: any; error?: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${this.apiBase}/import/preview`, {
      method: 'POST',
      headers,
      body: formData
    });
    return response.json();
  }

  async commitImport(data: { rows: any[] }): Promise<{ success: boolean; data: any; error?: string }> {
    const slimmed = data.rows.map((r: any) => ({
      type: r.type,
      stem: r.stem,
      answer: r.answer,
      analysis: r.analysis,
      course: r.course,
      chapter: r.chapter,
      tags: r.tags,
      options: Array.isArray(r.options)
        ? r.options.filter((o: any) => o.content && o.content.trim()).map((o: any) => ({ id: String(o.id), content: String(o.content).trim() }))
        : undefined,
    }));
    return this.post<{ success: boolean; data: any; error?: string }>(`${this.apiBase}/import/commit`, { rows: slimmed });
  }
}

export const questionService = new QuestionService();

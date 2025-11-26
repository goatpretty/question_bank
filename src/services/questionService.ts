import { Question, CreateQuestionData } from '../../shared/types';
import { authService } from '@/services/authService';

const API_HOST = import.meta.env.VITE_API_URL ?? `http://${window.location.hostname}:3001`;
const API_BASE = `${API_HOST}/api/questions`;

class QuestionService {
  async getAllQuestions(): Promise<{ data: { questions: Question[], total: number, page: number, limit: number } }> {
    const response = await fetch(API_BASE, {
      headers: {
        'Authorization': `Bearer ${authService.getToken()}`,
        'Content-Type': 'application/json'
      }
    });
    try {
      if (!response.ok) {
        console.warn('题目列表请求失败:', response.status, response.statusText);
        return { data: { questions: [], total: 0, page: 1, limit: 0 } } as any;
      }
      return await response.json();
    } catch {
      return { data: { questions: [], total: 0, page: 1, limit: 0 } } as any;
    }
  }

  async getQuestionById(id: string): Promise<{ data: Question }> {
    const response = await fetch(`${API_BASE}/${id}`, {
      headers: {
        'Authorization': `Bearer ${authService.getToken()}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('获取题目详情失败');
    }

    return response.json();
  }

  async createQuestion(data: CreateQuestionData): Promise<{ data: Question }> {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authService.getToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '创建题目失败');
    }

    return response.json();
  }

  async updateQuestion(id: string, data: Partial<CreateQuestionData>): Promise<{ data: Question }> {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authService.getToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '更新题目失败');
    }

    return response.json();
  }

  async deleteQuestion(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authService.getToken()}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '删除题目失败');
    }
  }

  async getQuestionsBySubject(subject: string): Promise<Question[]> {
    const response = await fetch(`${API_BASE}/subject/${subject}`, {
      headers: {
        'Authorization': `Bearer ${authService.getToken()}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('获取科目题目失败');
    }

    return response.json();
  }

  async getQuestionsByKnowledgePoint(knowledgePoint: string): Promise<Question[]> {
    const response = await fetch(`${API_BASE}/knowledge/${knowledgePoint}`, {
      headers: {
        'Authorization': `Bearer ${authService.getToken()}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('获取知识点题目失败');
    }

    return response.json();
  }

  async getQuestionsByDifficulty(difficulty: number): Promise<Question[]> {
    const response = await fetch(`${API_BASE}/difficulty/${difficulty}`, {
      headers: {
        'Authorization': `Bearer ${authService.getToken()}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('获取难度题目失败');
    }

    return response.json();
  }
}

export const questionService = new QuestionService();

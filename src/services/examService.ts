import { Exam } from '../../shared/types';
import { authService } from '@/services/authService';

const API_HOST = import.meta.env.VITE_API_URL ?? `http://${window.location.hostname}:3001`;
const API_BASE = `${API_HOST}/api/exams`;

class ExamService {
  async getAllExams(): Promise<{ data: { exams: Exam[], total: number, page: number, limit: number } }> {
    const response = await fetch(API_BASE, {
      headers: {
        'Authorization': `Bearer ${authService.getToken()}`,
        'Content-Type': 'application/json'
      }
    });
    try {
      if (!response.ok) {
        console.warn('考试列表请求失败:', response.status, response.statusText);
        return { data: { exams: [], total: 0, page: 1, limit: 0 } } as any;
      }
      return await response.json();
    } catch {
      return { data: { exams: [], total: 0, page: 1, limit: 0 } } as any;
    }
  }

  async getExamById(id: string): Promise<{ data: Exam }> {
    const response = await fetch(`${API_BASE}/${id}`, {
      headers: {
        'Authorization': `Bearer ${authService.getToken()}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('获取考试详情失败');
    }

    return response.json();
  }

  async createExam(data: Partial<Exam>): Promise<{ data: Exam }> {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authService.getToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      try {
        const error = await response.json();
        throw new Error(error.message || '创建考试失败');
      } catch {
        throw new Error(`${response.status} ${response.statusText}` || '创建考试失败');
      }
    }

    return response.json();
  }

  async updateExam(id: string, data: Partial<Exam>): Promise<{ data: Exam }> {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authService.getToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      try {
        const error = await response.json();
        throw new Error(error.message || '更新考试失败');
      } catch {
        throw new Error(`${response.status} ${response.statusText}` || '更新考试失败');
      }
    }

    return response.json();
  }

  async deleteExam(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authService.getToken()}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        // Treat 404 as idempotent success to simplify UX
        return;
      }
      try {
        const error = await response.json();
        throw new Error(error.message || '删除考试失败');
      } catch {
        throw new Error(`${response.status} ${response.statusText}` || '删除考试失败');
      }
    }
  }

  async getExamResults(examId: string): Promise<{ data: any[] }> {
    const response = await fetch(`${API_BASE}/${examId}/results`, {
      headers: {
        'Authorization': `Bearer ${authService.getToken()}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('获取考试结果失败');
    }

    return response.json();
  }

  async getExamStatistics(examId: string): Promise<{ data: any }> {
    const response = await fetch(`${API_BASE}/${examId}/statistics`, {
      headers: {
        'Authorization': `Bearer ${authService.getToken()}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('获取考试统计失败');
    }

    return response.json();
  }
}

export const examService = new ExamService();

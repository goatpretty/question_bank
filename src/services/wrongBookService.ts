import { BaseService } from './baseService';
import type {
  RecordWrongBookSourceRequest, WrongBookBackfillPreview, WrongBookBackfillResult,
  WrongBookCollectionJobView, WrongBookCollectionResult, WrongBookDetailData,
  WrongBookItemView, WrongBookListData, WrongBookListQuery,
} from '../../shared/wrongbook';

interface Response<T> { success: boolean; data: T; error?: string }

function checked<T>(response: Response<T>): Response<T> {
  if (!response.success || response.data == null) throw new Error(response.error || '错题本响应不完整，请重试。');
  return response;
}

class WrongBookService extends BaseService {
  constructor() { super('users'); }

  async getWrongBook(params: Partial<WrongBookListQuery> = {}, signal?: AbortSignal) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== '') query.set(key, String(value)); });
    return checked(await this.get<Response<WrongBookListData>>(`${this.apiBase}/wrongbook?${query}`, { signal }));
  }

  async getDetail(questionId: string, page = 1, limit = 5, signal?: AbortSignal) {
    return checked(await this.get<Response<WrongBookDetailData>>(`${this.apiBase}/wrongbook/${encodeURIComponent(questionId)}?page=${page}&limit=${limit}`, { signal }));
  }

  async addWrongQuestion(questionId: string, source?: RecordWrongBookSourceRequest): Promise<void> {
    if (!source) throw new Error('收录错题需要已完成的作答来源。');
    checked(await this.post<Response<{ created: boolean }>>(`${this.apiBase}/wrongbook/${encodeURIComponent(questionId)}`, source));
  }

  async markMastered(questionId: string, isMastered = true) {
    return checked(await this.put<Response<WrongBookItemView>>(`${this.apiBase}/wrongbook/${encodeURIComponent(questionId)}/master`, { isMastered }));
  }

  async getCollectionJobs(page = 1, limit = 5) {
    return checked(await this.get<Response<{ jobs: WrongBookCollectionJobView[]; total: number }>>(`${this.apiBase}/wrongbook/collection-jobs?status=pending&page=${page}&limit=${limit}`));
  }

  async retryCollection(jobId: string) {
    return checked(await this.post<Response<WrongBookCollectionResult>>(`${this.apiBase}/wrongbook/collection-jobs/${encodeURIComponent(jobId)}/retry`));
  }

  async previewBackfill(sourceType: 'all' | 'practice' | 'exam') {
    return checked(await this.post<Response<WrongBookBackfillPreview>>(`${this.apiBase}/wrongbook/backfill/preview`, { sourceType }));
  }

  async executeBackfill(previewToken: string) {
    return checked(await this.post<Response<WrongBookBackfillResult>>(`${this.apiBase}/wrongbook/backfill/execute`, { previewToken, confirm: true }));
  }
}

export const wrongBookService = new WrongBookService();

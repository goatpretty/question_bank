import { getToken } from './tokenUtils';
import { API_HOST } from '@/config/runtime';

export class BaseService {
  protected apiBase: string;

  constructor(endpoint: string) {
    this.apiBase = `${API_HOST}/api/${endpoint}`;
  }

  protected async request<T>(
    url: string,
    options: RequestInit = {},
    responseType: 'json' | 'blob' = 'json'
  ): Promise<T> {
    const token = getToken();

    // Only set Content-Type to application/json if we have JSON data
    const headers: Record<string, string> = {};
    const isFormData = options.body instanceof FormData;

    // Only add Content-Type if not FormData (browser sets multipart/form-data automatically with boundary)
    if (!isFormData && options.body) {
      headers['Content-Type'] = 'application/json';
    }
    // Merge user-provided headers (override defaults)
    if (options.headers) {
      for (const [key, value] of Object.entries(options.headers as Record<string, string>)) {
        headers[key] = value;
      }
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        let errorMessage = `请求失败: ${response.status} ${response.statusText}`;

        try {
          const errorData = await response.json();
          errorMessage =
            errorData?.message ||
            errorData?.error ||
            errorData?.detail ||
            errorMessage;
        } catch {
          // response body 不是 JSON 时才保留默认错误
        }

        throw new Error(errorMessage);
      }

      if (response.status === 204) {
        return {} as T;
      }

      if (responseType === 'blob') {
        return response.blob() as T;
      }

      return response.json() as Promise<T>;
    } catch (error) {
      console.error('API请求错误:', error);
      throw error;
    }
  }

  protected get<T>(url: string, options?: RequestInit, responseType?: 'json' | 'blob'): Promise<T> {
    return this.request<T>(url, { ...options, method: 'GET' }, responseType);
  }

  protected post<T>(url: string, data?: any, options?: RequestInit, responseType?: 'json' | 'blob'): Promise<T> {
    const isFormData = data instanceof FormData;
    const body = data && !isFormData ? JSON.stringify(data) : data;
    return this.request<T>(
      url,
      { ...options, method: 'POST', body },
      responseType
    );
  }

  protected put<T>(url: string, data?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(url, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  protected delete<T>(url: string, options?: RequestInit): Promise<T> {
    return this.request<T>(url, { ...options, method: 'DELETE' });
  }
}

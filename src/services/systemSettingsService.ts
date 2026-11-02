import { BaseService } from './baseService';

export type SettingsSource = 'database' | 'environment';

export interface AdminSmtpSettings {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  from: string;
  source: SettingsSource;
  hasPassword: boolean;
}

export interface AdminAiSettings {
  enabled: boolean;
  baseUrl: string;
  model: string;
  source: SettingsSource;
  hasApiKey: boolean;
}

export interface AdminSystemSettings {
  smtp: AdminSmtpSettings;
  ai: AdminAiSettings;
}

export interface SmtpSettingsPayload {
  enabled?: boolean;
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  from?: string;
  /** 留空表示保持现有密码不变。 */
  password?: string;
}

export interface AiSettingsPayload {
  enabled?: boolean;
  baseUrl?: string;
  model?: string;
  /** 留空表示保持现有 API Key 不变。 */
  apiKey?: string;
}

interface SettingsResponse {
  success: boolean;
  data: AdminSystemSettings;
  message?: string;
}

interface ActionResponse {
  success: boolean;
  message?: string;
  error?: string;
}

class SystemSettingsService extends BaseService {
  constructor() {
    super('admin/settings');
  }

  async getSettings(): Promise<SettingsResponse> {
    return this.get<SettingsResponse>(this.apiBase);
  }

  async updateSettings(payload: {
    smtp?: SmtpSettingsPayload;
    ai?: AiSettingsPayload;
  }): Promise<SettingsResponse> {
    return this.put<SettingsResponse>(this.apiBase, payload);
  }

  async resetSection(section: 'smtp' | 'ai'): Promise<SettingsResponse> {
    return this.delete<SettingsResponse>(`${this.apiBase}/${section}`);
  }

  async sendTestEmail(to?: string): Promise<ActionResponse> {
    return this.post<ActionResponse>(`${this.apiBase}/test-email`, to ? { to } : {});
  }

  async testAi(): Promise<ActionResponse> {
    return this.post<ActionResponse>(`${this.apiBase}/test-ai`, {});
  }
}

export const systemSettingsService = new SystemSettingsService();

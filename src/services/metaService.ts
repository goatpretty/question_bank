import { BaseService } from './baseService';

/** 后端公开的部署信息，不含任何凭据。 */
export interface DeploymentMeta {
  name: string;
  version: string;
  registrationEnabled: boolean;
  aiEnabled: boolean;
  database: string;
  license: string;
  dataLicense: string;
  repository: string;
}

interface MetaResponse {
  success: boolean;
  data: DeploymentMeta;
}

class MetaService extends BaseService {
  constructor() {
    super('meta');
  }

  async getMeta(): Promise<MetaResponse> {
    return this.get<MetaResponse>(this.apiBase);
  }
}

export const metaService = new MetaService();

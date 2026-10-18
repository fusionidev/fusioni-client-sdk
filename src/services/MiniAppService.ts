import {ApiClient, getApiClient} from './ApiClient';
import type {MiniApp} from '../types/miniApp';

export class MiniAppService {
  constructor(private readonly apiClient?: ApiClient) {}

  async findByTags(agencyId: string, tags: readonly string[], signal?: AbortSignal): Promise<MiniApp[]> {
    return (await (this.apiClient ?? getApiClient()).get<MiniApp[]>('/mini-app/by-tags', {
      params: {agency_id: agencyId, tags: tags.filter(Boolean)},
      paramsSerializer: {indexes: null},
      signal,
    })) || [];
  }
}

const miniAppService = new MiniAppService();
export const getMiniAppService = (): MiniAppService => miniAppService;

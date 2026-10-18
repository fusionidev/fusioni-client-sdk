import {ApiClient, getApiClient} from './ApiClient';
import type {MiniApp} from '../types/miniApp';

export class MiniAppCatalogService {
  constructor(private readonly apiClient?: ApiClient) {}

  async findByPosition(agencyId: string, position: string, signal?: AbortSignal): Promise<MiniApp[]> {
    return (await (this.apiClient ?? getApiClient()).get<MiniApp[]>('/mini-app-catalog/by-position', {
      params: {agency_id: agencyId, position},
      signal,
    })) || [];
  }
}

const miniAppCatalogService = new MiniAppCatalogService();
export const getMiniAppCatalogService = (): MiniAppCatalogService => miniAppCatalogService;

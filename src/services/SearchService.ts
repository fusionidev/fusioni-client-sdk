import {ApiClient, getApiClient} from './ApiClient';
import type {SearchRequestOptions, SearchResponse} from '../types/search';

export class SearchService {
  constructor(private readonly apiClient?: ApiClient) {}

  /** Calls FusionDataResource.search_autocomplete. */
  autocomplete(agencyId: string, query: string, options: SearchRequestOptions = {}): Promise<SearchResponse> {
    return this.request('/fusion_data/asearch', agencyId, query, options);
  }

  /** Calls FusionDataResource.search_paginated. */
  search(agencyId: string, query: string, options: SearchRequestOptions = {}): Promise<SearchResponse> {
    return this.request('/fusion_data/psearch', agencyId, query, options);
  }

  private async request(url: string, agencyId: string, query: string, options: SearchRequestOptions): Promise<SearchResponse> {
    const {page = 0, size = 25, signal} = options;
    if (!agencyId.trim()) throw new Error('Fusioni Search: agencyId is required.');
    if (!Number.isInteger(page) || page < 0 || !Number.isInteger(size) || size < 1) {
      throw new Error('Fusioni Search: page must be a non-negative integer and size a positive integer.');
    }
    const response = await (this.apiClient ?? getApiClient()).post<Partial<SearchResponse> | null>(
      url, {agency_id: agencyId, inp: query.trim()}, {params: {page, size, agency_id: agencyId}, signal},
    );
    return {body: response?.body ?? [], pagination: response?.pagination ?? null};
  }
}

const searchService = new SearchService();
export const getSearchService = (): SearchService => searchService;

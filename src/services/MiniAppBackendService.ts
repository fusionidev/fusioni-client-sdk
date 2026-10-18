import axios from 'axios';
import {ApiClient, getApiClient} from './ApiClient';
import type {
  MiniAppBackendMethod,
  MiniAppBackendRequest,
  MiniAppRuntimeContext,
  MiniAppRuntimeTarget,
} from '../types/miniApp';

export class MiniAppBackendError extends Error {
  readonly name = 'MiniAppBackendError';

  constructor(message: string, readonly status: number, readonly response: unknown = null) {
    super(message);
  }
}

const supportedMethods = new Set<MiniAppBackendMethod>([
  'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD',
]);

const normalizeIdentifier = (value: string | null | undefined): string | null => value?.trim() || null;

// New renderer instances must reuse the same module URL: custom elements cannot
// be registered again from a freshly signed URL for the same bundle version.
const fileBasesByConnection = new Map<string, Map<string, Promise<string>>>();
const fileBasesByClient = new WeakMap<ApiClient, Map<string, Promise<string>>>();

function fileBases(client: ApiClient): Map<string, Promise<string>> {
  const url = client.getBaseUrl?.();
  const connection = url ? JSON.stringify([url, client.getAccessToken?.()]) : null;
  let cache = connection ? fileBasesByConnection.get(connection) : fileBasesByClient.get(client);
  if (!cache) {
    cache = new Map();
    if (connection) fileBasesByConnection.set(connection, cache);
    else fileBasesByClient.set(client, cache);
  }
  return cache;
}

function requireIdentifier(value: string | null | undefined, name: string): string {
  const normalized = normalizeIdentifier(value);
  if (!normalized) throw new Error(`${name} is required to call the Mini App backend.`);
  return normalized;
}

function normalizeBackendPath(path: string): string {
  if (typeof path !== 'string') throw new Error('Mini App backend path must be a string.');
  const normalized = path.trim();
  if (!normalized.startsWith('/') || normalized.startsWith('//') || /[?#]/.test(normalized)) {
    throw new Error('Mini App backend path must begin with "/". Pass query parameters through the query option.');
  }
  const segments = normalized.slice(1).split('/').map(segment => {
    let decoded: string;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      throw new Error('Mini App backend path contains invalid encoding.');
    }
    if (decoded === '.' || decoded === '..') {
      throw new Error('Mini App backend path traversal is not allowed.');
    }
    return encodeURIComponent(decoded);
  });
  return `/${segments.join('/')}`;
}

export class MiniAppBackendService {
  constructor(private readonly apiClient?: ApiClient) {}

  createContext(miniAppId?: string | null, agencyId?: string | null): MiniAppRuntimeContext {
    return this.createRuntimeContext(miniAppId, agencyId, 'installed');
  }

  createBuilderContext(miniAppId?: string | null, agencyId?: string | null): MiniAppRuntimeContext {
    return this.createRuntimeContext(miniAppId, agencyId, 'builder');
  }

  private createRuntimeContext(
    miniAppId: string | null | undefined,
    agencyId: string | null | undefined,
    target: MiniAppRuntimeTarget,
  ): MiniAppRuntimeContext {
    const appId = normalizeIdentifier(miniAppId);
    const agency = normalizeIdentifier(agencyId);
    return Object.freeze({
      miniAppId: appId,
      agencyId: agency,
      runtime: target,
      backend: Object.freeze({
        request: <T = unknown>(path: string, request: MiniAppBackendRequest = {}): Promise<T> =>
          this.requestThroughRuntime<T>(appId, agency, path, request, target === 'builder'),
      }),
    });
  }

  /** Stable signed file base for native ES module imports and relative assets. */
  filesBase(
    miniAppId: string | null | undefined,
    agencyId: string | null | undefined,
    target: MiniAppRuntimeTarget,
    version: string,
  ): Promise<string> {
    const appId = requireIdentifier(miniAppId, 'Mini App ID');
    const agency = requireIdentifier(agencyId, 'Agency ID');
    if (target !== 'installed' && target !== 'builder') throw new Error(`Unsupported Mini App runtime: ${target}`);
    const client = this.apiClient ?? getApiClient();
    const cache = fileBases(client);
    const key = JSON.stringify([target, appId, agency, version]);
    let base = cache.get(key);
    if (!base) {
      base = client.post<{path: string}>(`/mini-app-files/${target}/${encodeURIComponent(appId)}`, {}, {params: {agency_id: agency}})
        .then(response => {
          if (!response || typeof response.path !== 'string' || !response.path.trim()) {
            throw new Error('The Mini App file response did not include a path.');
          }
          const apiBase = (client.getBaseUrl?.() || '/api').replace(/\/+$/, '');
          return `${apiBase}/${response.path.replace(/^\/+/, '').replace(/\/+$/, '')}/`;
        }).catch(error => {
          cache.delete(key);
          throw this.backendError(error);
        });
      cache.set(key, base);
    }
    return base;
  }

  request<T = unknown>(
    miniAppId: string | null | undefined,
    agencyId: string | null | undefined,
    path: string,
    request: MiniAppBackendRequest = {},
  ): Promise<T> {
    return this.requestThroughRuntime<T>(miniAppId, agencyId, path, request, false);
  }

  private async requestThroughRuntime<T>(
    miniAppId: string | null | undefined,
    agencyId: string | null | undefined,
    path: string,
    request: MiniAppBackendRequest,
    builder: boolean,
  ): Promise<T> {
    const appId = requireIdentifier(miniAppId, 'Mini App ID');
    const agency = requireIdentifier(agencyId, 'Agency ID');
    const backendPath = normalizeBackendPath(path);
    const method = (request.method || 'GET').toUpperCase() as MiniAppBackendMethod;
    if (!supportedMethods.has(method)) throw new Error(`Unsupported Mini App backend method: ${request.method}`);

    const params = new URLSearchParams({agency_id: agency});
    for (const [key, value] of Object.entries(request.query || {})) {
      if (!['agency_id', 'token'].includes(key.toLowerCase())) params.set(key, String(value));
    }
    const url = `/mini-app-runtime${builder ? '/builder' : ''}/${encodeURIComponent(appId)}${backendPath}`;
    try {
      if (request.signal?.aborted) throw this.abortError();
      return await (this.apiClient ?? getApiClient()).request<T>(url, {
        method,
        params,
        headers: request.headers,
        data: request.body,
        responseType: request.responseType === 'text' ? 'text' : 'json',
        signal: request.signal,
      });
    } catch (error) {
      if (request.signal?.aborted || axios.isCancel(error)) throw this.abortError();
      throw this.backendError(error);
    }
  }

  private backendError(error: unknown): Error {
    if (axios.isAxiosError(error)) {
      const response: unknown = error.response?.data ?? null;
      const detail = response && typeof response === 'object' ? (response as {detail?: unknown}).detail : response;
      return new MiniAppBackendError(
        typeof detail === 'string' && detail.trim() ? detail : error.message || 'Mini App backend request failed.',
        error.response?.status ?? 0, response,
      );
    }
    return error instanceof Error ? error : new Error(String(error));
  }

  private abortError(): Error {
    const error = new Error('Mini App backend request was cancelled.');
    error.name = 'AbortError';
    return error;
  }
}

const miniAppBackendService = new MiniAppBackendService();
export const getMiniAppBackendService = (): MiniAppBackendService => miniAppBackendService;

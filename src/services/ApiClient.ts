import axios, {AxiosInstance} from 'axios';

/** Decode SSE `event.data` (plain text or JSON with a `data` field), matching fusioni-web chat usage. */
function normalizeSsePayload(raw: string): string | null {
  const s = raw?.trim() ?? '';
  if (!s) {
    return null;
  }
  try {
    const parsed = JSON.parse(s) as unknown;
    if (parsed !== null && typeof parsed === 'object' && 'data' in parsed) {
      const inner = (parsed as {data: unknown}).data;
      if (inner === undefined || inner === null) {
        return null;
      }
      if (typeof inner === 'string') {
        return inner;
      }
      if (typeof inner === 'number' || typeof inner === 'boolean') {
        return String(inner);
      }
      return JSON.stringify(inner);
    }
  } catch {
    /* use raw string */
  }
  return s;
}

export class ApiClient {
  private client: AxiosInstance;
  private baseUrl: string;
  private accessToken?: string;

  constructor(baseUrl: string, accessToken?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.accessToken = accessToken;
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for authentication
    this.client.interceptors.request.use(
      (config: any) => {
        console.log('Request interceptor - config:', config);
        if (this.accessToken) {
          config.headers.Authorization = `ApiKey ${this.accessToken}`;
          console.log('Authorization header set:', config.headers.Authorization);
        } else {
          throw new Error('No access token provided');
        }
        return config;
      },
      (error: any) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response: any) => response,
      (error: any) => {
        console.error('API Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  setAccessToken(token: string) {
    this.accessToken = token;
  }

  // HTTP method wrappers to isolate axios client
  async get<T = any>(url: string, config?: any): Promise<T> {
    const response = await this.client.get(url, config);
    return response.data;
  }

  async post<T = any>(url: string, data?: any, config?: any): Promise<T> {
    console.log('ApiClient POST request:', { url, data, config });
    const response = await this.client.post(url, data, config);
    return response.data;
  }

  async put<T = any>(url: string, data?: any, config?: any): Promise<T> {
    const response = await this.client.put(url, data, config);
    return response.data;
  }

  async delete<T = any>(url: string, config?: any): Promise<T> {
    const response = await this.client.delete(url, config);
    return response.data;
  }

  async options<T = any>(url: string, config?: any): Promise<T> {
    const response = await this.client.options(url, config);
    return response.data;
  }

  // Server-Sent Events for real-time updates
  connectToSSE(agencyId: string, onMessage: (data: any) => void): EventSource {
    const token = this.accessToken || 'test';
    const url = `${this.baseUrl}/sse/connect?agency_id=${agencyId}&token=${token}`;
    const eventSource = new EventSource(url, { withCredentials: false });

    const deliver = (eventName: string, event: Event) => {
      try {
        const me = event as MessageEvent;
        const normalized = normalizeSsePayload(String(me.data ?? ''));
        if (normalized === null) {
          return;
        }
        onMessage({event: eventName, data: normalized});
      } catch (error) {
        console.error('Error handling SSE event:', eventName, error);
      }
    };

    // fusioni-web EventSourceService uses ['chat_stream'] for chat execution progress
    eventSource.addEventListener('chat_stream', (e) => deliver('chat_stream', e));
    eventSource.addEventListener('process_info', (e) => deliver('process_info', e));

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
    };

    return eventSource;
  }


  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.get('/health');
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Singleton instance
let apiClientInstance: ApiClient | null = null;

export const getApiClient = (baseUrl?: string, accessToken?: string): ApiClient => {
  if (!apiClientInstance) {
    if (baseUrl) {
      apiClientInstance = new ApiClient(baseUrl, accessToken);
    } else {
      throw new Error('ApiClient not initialized. Call getApiClient with baseUrl first.');
    }
  }
  return apiClientInstance;
};

export const initializeApiClient = (baseUrl: string, accessToken?: string): ApiClient => {
  apiClientInstance = new ApiClient(baseUrl, accessToken);
  return apiClientInstance;
};

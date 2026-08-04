import axios, {AxiosInstance} from 'axios';

export interface FusioniSSEMessage {
  event: string;
  data: string;
  /** Parsed JSON payload when the server event contains JSON. */
  payload?: unknown;
}

interface DecodedSSEPayload {
  data: string;
  payload?: unknown;
}

/** Decode SSE `event.data` while retaining the full JSON payload for typed consumers. */
function decodeSsePayload(raw: string): DecodedSSEPayload | null {
  const s = raw?.trim() ?? '';
  if (!s) {
    return null;
  }
  try {
    const parsed = JSON.parse(s) as unknown;
    if (parsed !== null && typeof parsed === 'object') {
      if ('data' in parsed) {
        const inner = (parsed as {data: unknown}).data;
        if (inner === undefined || inner === null) {
          return null;
        }
        if (typeof inner === 'string') {
          return {data: inner, payload: parsed};
        }
        if (typeof inner === 'number' || typeof inner === 'boolean') {
          return {data: String(inner), payload: parsed};
        }
        return {data: JSON.stringify(inner), payload: parsed};
      }
      if ('message' in parsed) {
        const message = (parsed as {message: unknown}).message;
        if (message === undefined || message === null) {
          return null;
        }
        if (typeof message === 'string') {
          return {data: message, payload: parsed};
        }
        if (typeof message === 'number' || typeof message === 'boolean') {
          return {data: String(message), payload: parsed};
        }
        return {data: JSON.stringify(message), payload: parsed};
      }

      // `message_stream` sends a JourneyResponse object. Keep it intact so the
      // widget can correlate it by conversation and reconcile returned messages.
      return {data: s, payload: parsed};
    }
  } catch {
    /* use raw string */
  }
  return {data: s};
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
  connectToSSE(agencyId: string, onMessage: (data: FusioniSSEMessage) => void, conversationId?: string): EventSource {
    const token = this.accessToken || 'test';
    const params = new URLSearchParams({
      agency_id: agencyId,
      token,
    });
    if (conversationId) {
      params.set('conversation_id', conversationId);
    }
    const url = `${this.baseUrl}/sse/connect?${params.toString()}`;
    const eventSource = new EventSource(url, { withCredentials: false });

    const deliver = (eventName: string, event: Event) => {
      try {
        const me = event as MessageEvent;
        const decoded = decodeSsePayload(String(me.data ?? ''));
        if (decoded === null) {
          return;
        }
        onMessage({event: eventName, ...decoded});
      } catch (error) {
        console.error('Error handling SSE event:', eventName, error);
      }
    };

    // Match fusion-web: progress arrives on `chat_stream`; completed journey
    // responses (including persisted messages) arrive on `message_stream`.
    eventSource.addEventListener('chat_stream', (e) => deliver('chat_stream', e));
    eventSource.addEventListener('message_stream', (e) => deliver('message_stream', e));
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

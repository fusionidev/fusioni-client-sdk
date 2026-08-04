import { useEffect, useRef, useCallback } from 'react';
import { FusioniSSEMessage, getApiClient } from '../services/ApiClient';

const RECONNECT_DELAY_MS = 3000;

export const useSSE = (
  agencyId: string,
  onMessage: (data: FusioniSSEMessage) => void,
  isConnected: boolean = true,
  accessToken?: string,
  conversationId?: string,
) => {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMessageRef = useRef(onMessage);

  // Keep the callback ref up to date
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  // Stable callback that uses the ref
  const stableOnMessage = useCallback((data: FusioniSSEMessage) => {
    onMessageRef.current(data);
  }, []);

  useEffect(() => {
    let disposed = false;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const disconnect = () => {
      clearReconnectTimer();
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };

    if (!agencyId || !isConnected) {
      disconnect();
      return undefined;
    }

    const connect = () => {
      if (disposed || eventSourceRef.current) {
        return;
      }

      try {
        const apiClient = getApiClient();
        if (accessToken) {
          apiClient.setAccessToken(accessToken);
        }

        const eventSource = apiClient.connectToSSE(agencyId, stableOnMessage, conversationId);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
          clearReconnectTimer();
          console.log('SSE connection opened');
        };

        eventSource.onerror = (error) => {
          console.error('SSE connection error:', error);
          eventSource.close();
          if (eventSourceRef.current === eventSource) {
            eventSourceRef.current = null;
          }

          if (!disposed) {
            clearReconnectTimer();
            reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
          }
        };
      } catch (error) {
        console.error('Failed to connect to SSE:', error);
        if (!disposed) {
          reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
        }
      }
    };

    connect();

    return () => {
      disposed = true;
      disconnect();
    };
  }, [accessToken, agencyId, conversationId, isConnected, stableOnMessage]);

  return eventSourceRef.current;
};

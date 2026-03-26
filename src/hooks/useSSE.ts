import { useEffect, useRef, useCallback } from 'react';
import { getApiClient } from '../services/ApiClient';

export const useSSE = (agencyId: string, onMessage: (data: any) => void, isConnected: boolean = true, accessToken?: string) => {
  const eventSourceRef = useRef<EventSource | null>(null);
  const onMessageRef = useRef(onMessage);

  // Keep the callback ref up to date
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  // Stable callback that uses the ref
  const stableOnMessage = useCallback((data: any) => {
    onMessageRef.current(data);
  }, []);

  useEffect(() => {
    if (!agencyId || !isConnected) {
      // Disconnect if not connected or no agency ID
      if (eventSourceRef.current) {
        console.log('Disconnecting SSE (panel closed or no agency ID)...');
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    // Only connect if we don't already have a connection
    if (eventSourceRef.current) {
      return;
    }

    try {
      const apiClient = getApiClient();
      if (!apiClient) {
        console.error('API client not initialized for SSE connection');
        return;
      }
      
      // Update access token if provided
      if (accessToken) {
        apiClient.setAccessToken(accessToken);
      }
      
      console.log('Connecting to SSE (panel opened)...');
      const eventSource = apiClient.connectToSSE(agencyId, stableOnMessage);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('SSE connection opened');
      };

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        // Close the connection on error
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
      };

    } catch (error) {
      console.error('Failed to connect to SSE:', error);
    }
  }, [agencyId, stableOnMessage, isConnected, accessToken]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        console.log('Disconnecting SSE...');
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  return eventSourceRef.current;
};

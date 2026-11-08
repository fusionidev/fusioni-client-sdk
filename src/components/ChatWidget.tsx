import React, {forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState} from 'react';
import {isAxiosError} from 'axios';
import {
  ChatWidgetProps,
  Conversation,
  FusioniChatWidgetHandle,
  FusioniMemoryMessage,
  FusioniSDKConfig,
  PipelineRequest,
  PipelineResponse
} from '../types';
import {Language, isValidLanguage} from '../i18n';
import {FusioniSSEMessage, initializeApiClient} from '../services/ApiClient';
import {getConversationService} from '../services/ConversationService';
import {getPipelineService} from '../services/PipelineService';
import {getMessageService} from '../services/MessageService';
import {getSDKClientService} from '../services/SDKClientService';
import {ConversationList} from './ConversationList';
import {MessageList} from './MessageList';
import {ChatInput} from './ChatInput';
import {FloatingButton} from './FloatingButton';
import {ChatPanel} from './ChatPanel';
import {LanguageSwitcher} from './LanguageSwitcher';
import {ConfirmationDialog} from './ConfirmationDialog';
import {FUSIONI_SDK_OPTIMISTIC_USER, useChatState} from '../hooks/useChatState';
import {useSSE} from '../hooks/useSSE';
import {useTheme} from '../hooks/useTheme';
import {useTranslation} from '../hooks/useTranslation';
import {useIsMobileLayout} from '../hooks/useIsMobileLayout';
import {ShadowDomRoot} from './ShadowDomRoot';
import {getOwnerIdFromAccessToken} from '../utils/messageBubble';

const getStoredConversationIdKey = (agencyId: string) => `fusioni:selectedConversationId:${agencyId}`;
const getStoredChatPanelOpenKey = (agencyId: string) => `fusioni:chatPanelOpen:${agencyId}`;
const MESSAGE_RESPONSE_TIMEOUT_MS = 90_000;
const EXECUTION_POLL_INTERVAL_MS = 2_000;
const MAX_CONSECUTIVE_CHECK_FAILURES = 3;

interface PendingExecution {
  agencyId: string;
  conversationId: string;
  executionId: string;
  loadingMessageId: string;
  editedMessageId?: string | null;
  controller: AbortController;
  pollAfter: number;
  timer?: ReturnType<typeof setTimeout>;
  restored?: boolean;
  checking?: boolean;
  refreshTranscript?: boolean;
}

interface ConversationLoad {
  controller: AbortController;
  events: FusioniSSEMessage[];
}

const getExecutionId = (response: PipelineResponse): string | undefined => {
  const id = response.execution_id || response.extra_data?.execution_id;
  return typeof id === 'string' && id ? id : undefined;
};

const isActiveExecutionStatus = (status: string): boolean => {
  return status === 'queued' || status === 'running' || status === 'cancellation_requested';
}

const parsePipelineStreamResponse = (event: FusioniSSEMessage): PipelineResponse | null => {
  let candidate = event.payload;

  if (
    candidate &&
    typeof candidate === 'object' &&
    'data' in candidate &&
    (candidate as {data?: unknown}).data &&
    typeof (candidate as {data?: unknown}).data === 'object'
  ) {
    candidate = (candidate as {data: unknown}).data;
  }

  if (candidate && typeof candidate === 'object') {
    return candidate as PipelineResponse;
  }

  try {
    const parsed = JSON.parse(event.data) as unknown;
    return parsed && typeof parsed === 'object' ? parsed as PipelineResponse : null;
  } catch {
    return null;
  }
};

const getResponseConversationId = (
  response: PipelineResponse,
  pendingExecution: PendingExecution | null,
): string | null => {
  if (response.conversation_id) {
    return response.conversation_id;
  }

  const responseMessage = Array.isArray(response.messages) ? response.messages[0] : undefined;
  return responseMessage?.conversation_id || pendingExecution?.conversationId || null;
};

const readStoredConversationId = (agencyId: string): string | null => {
  if (typeof window === 'undefined') return null;

  try {
    return window.sessionStorage.getItem(getStoredConversationIdKey(agencyId));
  } catch {
    return null;
  }
};

const writeStoredConversationId = (agencyId: string, conversationId: string | null) => {
  if (typeof window === 'undefined') return;

  try {
    const key = getStoredConversationIdKey(agencyId);
    if (conversationId) {
      window.sessionStorage.setItem(key, conversationId);
    } else {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
};

const readStoredChatPanelOpen = (agencyId: string): boolean => {
  if (typeof window === 'undefined') return false;

  try {
    return window.sessionStorage.getItem(getStoredChatPanelOpenKey(agencyId)) === 'true';
  } catch {
    return false;
  }
};

const writeStoredChatPanelOpen = (agencyId: string, isOpen: boolean) => {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(getStoredChatPanelOpenKey(agencyId), String(isOpen));
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
};

const ChatWidgetInner = forwardRef<FusioniChatWidgetHandle, ChatWidgetProps>(function ChatWidgetInner(
  {
    config,
    onMessageSent,
    onMessageReceived,
    onConversationCreated,
    onConversationDeleted,
    onError
  },
  ref
) {
  const [languageOverride, setLanguageOverride] = useState<Language | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAwaitingResponse, setIsAwaitingResponse] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConversationListOpen, setIsConversationListOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mergedConfig, setMergedConfig] = useState<FusioniSDKConfig | null>(null);
  const [isConfigReady, setIsConfigReady] = useState(false);
  const [hasConfigError, setHasConfigError] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [isDeleteMessageDialogOpen, setIsDeleteMessageDialogOpen] = useState(false);
  const [hasLoadedConversations, setHasLoadedConversations] = useState(false);
  
  // Refs
  const floatingButtonRef = useRef<HTMLButtonElement>(null);
  const restoredConversationIdRef = useRef<string | null>(null);
  const pendingExecutionRef = useRef<PendingExecution | null>(null);
  const lastFailedExecutionIdRef = useRef<string>();
  const conversationLoadRef = useRef<ConversationLoad | null>(null);
  const seenMessageIdsRef = useRef(new Set<string>());
  
  const translationDefault: Language =
    languageOverride ?? mergedConfig?.language ?? config.language ?? 'en';

  // Translation and language management - use merged config or fallback to user config
  const { t, currentLanguage, changeLanguage } = useTranslation(translationDefault);
  const activeAgencyId = mergedConfig?.agencyId || config.agencyId;
  const currentOwnerId = mergedConfig?.ownerId
    || config.ownerId
    || getOwnerIdFromAccessToken(mergedConfig?.accessToken || config.accessToken);

  const updateChatOpen = useCallback((nextIsOpen: boolean) => {
    setIsOpen(nextIsOpen);
    if (activeAgencyId) {
      writeStoredChatPanelOpen(activeAgencyId, nextIsOpen);
    }
    if (!nextIsOpen) {
      setIsConversationListOpen(false);
    }
  }, [activeAgencyId]);
  
  const {
    conversations,
    currentConversation,
    messages,
    streamMessages,
    setCurrentConversation,
    setStreamMessages,
    addMessage,
    updateMessage,
    removeMessage,
    truncateMessagesAt,
    reconcileMessages,
    addConversation,
    updateConversation,
    removeConversation,
    loadConversations,
    replaceMessages,
    clearMessages
  } = useChatState(activeAgencyId);
  const currentConversationRef = useRef<Conversation | null>(currentConversation);
  currentConversationRef.current = currentConversation;

  const { theme, toggleTheme, setTheme } = useTheme(mergedConfig?.theme || config.theme);
  const isMobileLayout = useIsMobileLayout();
  const isBusy = isLoading || isAwaitingResponse;

  const handleLanguageChange = useCallback(
    (language: Language) => {
      setLanguageOverride(language);
      changeLanguage(language);
    },
    [changeLanguage]
  );

  useImperativeHandle(
    ref,
    () => ({
      setLanguage: (language: Language) => {
        if (!isValidLanguage(language)) {
          return;
        }
        setLanguageOverride(language);
        changeLanguage(language);
      },
      setTheme,
    }),
    [changeLanguage, setTheme]
  );
  
  // Initialize API client and fetch server configuration
  useEffect(() => {
    const initializeAndFetchConfig = async () => {
      try {
        // Initialize API client first
        initializeApiClient(config.apiBaseUrl, config.accessToken, config.agencyId);
        
        // Fetch server configuration if agencyId is available
        if (config.agencyId) {
          try {
            const sdkClientService = getSDKClientService();
            const serverConfig = await sdkClientService.getClientConfig(config.agencyId);
            
            if (serverConfig) {
              // Merge server config with user config
              const merged = sdkClientService.mergeConfig(config, serverConfig);
              setMergedConfig(merged);
              setHasConfigError(false);
            } else {
              // If no server config, use user config as-is (no error, just no data)
              setMergedConfig(config);
              setHasConfigError(false);
            }
          } catch (configError) {
            // Hide the chat while its backend configuration is unavailable.
            console.warn('Failed to fetch server configuration, using user config:', configError);
            setHasConfigError(true);
            setMergedConfig(config);
          }
        } else {
          setMergedConfig(config);
          setHasConfigError(false);
        }
        
        // Mark config as ready after fetching (or if no fetch needed)
        setIsConfigReady(true);
      } catch (err) {
        const error = new Error(t('chat.errors.failedToInitialize'));
        onError?.(error);
        setError(t('chat.errors.failedToInitialize'));
        // Still set config and mark as ready so the widget can render with user config
        setMergedConfig(config);
        setIsConfigReady(true);
      }
    };
    
    initializeAndFetchConfig().then();

  }, [config, onError, t]);

  // Load initial conversations
  useEffect(() => {
    if (activeAgencyId) {
      let isCancelled = false;

      restoredConversationIdRef.current = null;
      setHasLoadedConversations(false);
      loadConversations().finally(() => {
        if (!isCancelled) {
          setHasLoadedConversations(true);
        }
      });

      return () => {
        isCancelled = true;
      };
    }
  }, [activeAgencyId, loadConversations]);

  useEffect(() => {
    if (!activeAgencyId) {
      return;
    }

    setIsOpen(readStoredChatPanelOpen(activeAgencyId));
  }, [activeAgencyId]);

  const clearPendingExecution = useCallback(() => {
    const execution = pendingExecutionRef.current;
    pendingExecutionRef.current = null;
    clearTimeout(execution?.timer);
    execution?.controller.abort();
  }, []);

  const finishPendingExecution = useCallback((execution: PendingExecution, error?: Error) => {
    if (pendingExecutionRef.current !== execution) {
      return;
    }

    clearPendingExecution();
    setStreamMessages([]);
    setIsAwaitingResponse(false);
    if (error) {
      lastFailedExecutionIdRef.current = execution.executionId;
      updateMessage(execution.loadingMessageId, {
        loading: false,
        has_error: true,
        content: t('chat.messages.error'),
      });
      onError?.(error);
    } else {
      removeMessage(execution.loadingMessageId);
      void loadConversations();
    }
  }, [clearPendingExecution, loadConversations, onError, removeMessage, setStreamMessages, t, updateMessage]);

  const startPendingExecution = useCallback((
    agencyId: string,
    conversationId: string,
    executionId: string,
    options: Pick<PendingExecution, 'editedMessageId' | 'restored'> & {createdAt?: string} = {},
  ) => {
    const {createdAt, ...executionOptions} = options;
    const now = Date.now();
    const startedAt = Date.parse(createdAt ?? '');
    const execution: PendingExecution = {
      ...executionOptions,
      agencyId,
      conversationId,
      executionId,
      loadingMessageId: `loading-${executionId}`,
      controller: new AbortController(),
      pollAfter: (Number.isNaN(startedAt) ? now : Math.min(startedAt, now)) + MESSAGE_RESPONSE_TIMEOUT_MS,
    };
    pendingExecutionRef.current = execution;
    addMessage({
      id: execution.loadingMessageId,
      agency_id: agencyId,
      conversation_id: conversationId,
      role: 'assistant',
      content: '',
      mem_type: 'short',
      keywords: [],
      thoughts: null,
      created: new Date(),
      loading: true,
      shouldAnimate: false,
    });
    setIsAwaitingResponse(true);
    return execution;
  }, [addMessage]);

  const recordReceivedMessages = useCallback((messages: FusioniMemoryMessage[], notify: boolean) => {
    const seenIds = seenMessageIdsRef.current;
    for (const message of messages) {
      if (message.id && seenIds.has(message.id)) {
        continue;
      }
      if (message.id) {
        seenIds.add(message.id);
      }
      if (notify && message.role !== 'user') {
        onMessageReceived?.(message);
      }
    }
  }, [onMessageReceived]);

  const scheduleExecutionCheck = useCallback((execution: PendingExecution) => {
    const {agencyId, conversationId, controller: {signal}} = execution;
    if (signal.aborted || execution.checking) {
      return;
    }
    clearTimeout(execution.timer);
    let consecutiveFailures = 0;

    const poll = async () => {
      execution.checking = true;
      try {
        if (!execution.refreshTranscript) {
          const status = await getPipelineService().getExecutionStatus(agencyId, execution.executionId, signal)
            .catch((error: unknown) => {
              if (isAxiosError(error) && error.response?.status === 404) {
                return null;
              }
              throw error;
            });
          if (signal.aborted) {
            return;
          }
          if (!execution.refreshTranscript) {
            if (status && (status.execution_id !== execution.executionId ||
              status.agency_id !== agencyId ||
              (status.conversation_id && status.conversation_id !== conversationId))) {
              finishPendingExecution(execution);
              return;
            }
            if (status?.status === 'failed') {
              finishPendingExecution(execution, new Error(status.error_message || t('chat.errors.failedToSendMessage')));
              return;
            }
            if (status?.status === 'cancelled') {
              finishPendingExecution(execution);
              return;
            }
            execution.refreshTranscript = !status || !isActiveExecutionStatus(status.status);
          }
          consecutiveFailures = 0;
        }
        if (execution.refreshTranscript) {
          const history = await getMessageService().getMessages(conversationId, agencyId, signal);
          if (!signal.aborted) {
            replaceMessages(history);
            finishPendingExecution(execution);
            recordReceivedMessages(history, true);
          }
          return;
        }
      } catch (error) {
        if (signal.aborted) {
          return;
        }
        const statusCode = isAxiosError(error) ? error.response?.status : undefined;
        const canRetry = !statusCode || statusCode === 408 || statusCode === 429 || statusCode >= 500;
        if (!canRetry || ++consecutiveFailures >= MAX_CONSECUTIVE_CHECK_FAILURES) {
          finishPendingExecution(execution);
          return;
        }
      } finally {
        execution.checking = false;
      }
      if (!signal.aborted) {
        execution.timer = setTimeout(poll, EXECUTION_POLL_INTERVAL_MS);
      }
    };

    // Give the live stream the response window before checking status.
    const delay = execution.refreshTranscript ? 0 : Math.max(0, execution.pollAfter - Date.now());
    execution.timer = setTimeout(poll, delay);
  }, [finishPendingExecution, recordReceivedMessages, replaceMessages, t]);

  const submitExecution = useCallback(async (request: PipelineRequest) => {
    const executionId = globalThis.crypto?.randomUUID?.()
      ?? `execution-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const execution = currentConversationRef.current?.id === request.conversation_id
      ? startPendingExecution(request.agency_id, request.conversation_id, executionId, {editedMessageId: request.message_id})
      : null;

    try {
      const acknowledgement = await getPipelineService().executePipelineAsync({...request, execution_id: executionId});
      if (acknowledgement.has_error) {
        throw new Error(acknowledgement.error_message || t('chat.errors.failedToSendMessage'));
      }
      if (!execution || execution.controller.signal.aborted) {
        return;
      }

      execution.executionId = getExecutionId(acknowledgement) ?? executionId;
      scheduleExecutionCheck(execution);
    } catch (error) {
      const sendError = error instanceof Error ? error : new Error(t('chat.errors.failedToSendMessage'));
      if (execution) {
        finishPendingExecution(execution, sendError);
      } else {
        onError?.(sendError);
      }
    }
  }, [finishPendingExecution, onError, scheduleExecutionCheck, startPendingExecution, t]);

  const handleSSEMessage = useCallback((event: FusioniSSEMessage) => {
    if (event.event === 'chat_stream' || event.event === 'process_info') {
      const payload = event.payload && typeof event.payload === 'object'
        ? event.payload as {conversation_id?: string; execution_id?: string}
        : undefined;
      const eventConversationId = payload?.conversation_id;
      const visibleConversationId = currentConversationRef.current?.id;
      const pendingExecution = pendingExecutionRef.current;

      if (
        event.data.trim() &&
        (!eventConversationId || eventConversationId === visibleConversationId) &&
        (!payload?.execution_id || !pendingExecution || payload.execution_id === pendingExecution.executionId)
      ) {
        setStreamMessages([event.data]);
      }
      return;
    }

    if (event.event !== 'message_stream') {
      return;
    }

    const response = parsePipelineStreamResponse(event);
    if (!response) {
      console.warn('Ignoring invalid message_stream payload:', event.data);
      return;
    }

    const execution = pendingExecutionRef.current;
    const responseConversationId = getResponseConversationId(response, execution);
    if (!responseConversationId || responseConversationId !== currentConversationRef.current?.id) {
      return;
    }

    const load = conversationLoadRef.current;
    if (load) {
      load.events.push(event);
      return;
    }

    const pendingExecution = !response.extra_data?.background_notification && execution?.conversationId === responseConversationId
      ? execution
      : null;
    const responseExecutionId = getExecutionId(response);
    if (pendingExecution && responseExecutionId && responseExecutionId !== pendingExecution.executionId) {
      return;
    }

    const executionStatus = response.extra_data?.execution_status;
    if (response.has_error || executionStatus === 'failed') {
      const error = new Error(response.error_message || t('chat.errors.failedToSendMessage'));
      if (pendingExecution) {
        finishPendingExecution(pendingExecution, error);
      } else if (!responseExecutionId || responseExecutionId !== lastFailedExecutionIdRef.current) {
        onError?.(error);
      }
      return;
    }

    const responseMessages = Array.isArray(response.messages) ? response.messages : [];
    const lastMessageIndex = responseMessages.length - 1;
    const incomingMessages = responseMessages.map((message, index) => ({
      ...message,
      execution_time_ms: index === lastMessageIndex
        ? response.execution_time_ms ?? message.execution_time_ms
        : message.execution_time_ms,
      shouldAnimate: message.role === 'assistant' && !message.loading,
    })).filter(message =>
      (pendingExecution && !pendingExecution.restored) ||
      !message.id ||
      !seenMessageIdsRef.current.has(message.id),
    );
    const hasAssistantResponse = incomingMessages.some(
      (message) => message.role === 'assistant' || message.role === 'system',
    );
    const isCancelled = executionStatus === 'cancelled' || response.extra_data?.cancelled === true;
    const isCompleteResponse =
      isCancelled ||
      executionStatus === 'completed' ||
      response.extra_data?.multi_agent_complete === true ||
      response.extra_data?.multi_agent_superseded === true ||
      (!executionStatus && response.extra_data?.multi_agent !== true && hasAssistantResponse);
    const needsTranscript = !isCancelled && (pendingExecution?.restored || !hasAssistantResponse);

    if (incomingMessages.length > 0) {
      reconcileMessages(incomingMessages, {
        loadingMessageId: pendingExecution?.loadingMessageId,
        keepLoading: Boolean(pendingExecution && (!isCompleteResponse || needsTranscript)),
        editedMessageId: pendingExecution?.editedMessageId,
      });
      recordReceivedMessages(incomingMessages, true);
    }

    if (isCompleteResponse && pendingExecution) {
      if (!needsTranscript) {
        finishPendingExecution(pendingExecution);
      } else if (!pendingExecution.refreshTranscript) {
        pendingExecution.refreshTranscript = true;
        scheduleExecutionCheck(pendingExecution);
      }
    }
  }, [
    finishPendingExecution,
    onError,
    reconcileMessages,
    recordReceivedMessages,
    scheduleExecutionCheck,
    setStreamMessages,
    t,
  ]);

  // Connect on mount so live events can arrive during conversation restoration.
  useSSE(
    activeAgencyId,
    handleSSEMessage,
    Boolean(activeAgencyId),
    mergedConfig?.accessToken || config.accessToken,
  );

  useEffect(() => {
    return () => {
      currentConversationRef.current = null;
      conversationLoadRef.current?.controller.abort();
      clearPendingExecution();
    };
  }, [clearPendingExecution]);

  const resetConversationActivity = useCallback(() => {
    conversationLoadRef.current?.controller.abort();
    conversationLoadRef.current = null;
    clearPendingExecution();
    lastFailedExecutionIdRef.current = undefined;
    seenMessageIdsRef.current.clear();
    clearMessages();
    setStreamMessages([]);
    setIsAwaitingResponse(false);
    setIsLoading(false);
  }, [clearMessages, clearPendingExecution, setStreamMessages]);

  const handleToggleChat = useCallback(() => {
    setIsOpen(prev => {
      const nextIsOpen = !prev;
      if (activeAgencyId) {
        writeStoredChatPanelOpen(activeAgencyId, nextIsOpen);
      }
      if (!nextIsOpen) {
        setIsConversationListOpen(false);
      }
      return nextIsOpen;
    });
  }, [activeAgencyId]);

  const handleToggleConversationList = useCallback(() => {
    setIsConversationListOpen(prev => !prev);
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  const handleCreateConversation = useCallback(() => {
    if (!mergedConfig) return;
    resetConversationActivity();
    writeStoredConversationId(activeAgencyId, null);
    
    // Create a new conversation with null ID - will be created on server when first message is sent
    const newConversation: Conversation = {
      id: null,
      title: t('chat.conversations.newConversation'),
      agency_id: mergedConfig.agencyId,
      ...(mergedConfig.conversationProfileId ? {conversation_profile_id: mergedConfig.conversationProfileId} : {}),
      messages: []
    };

    addConversation(newConversation);
    setCurrentConversation(newConversation);
    currentConversationRef.current = newConversation;
    
    // Auto-hide conversation list when a new conversation is created
    setIsConversationListOpen(false);
    
    onConversationCreated?.(newConversation);
  }, [activeAgencyId, mergedConfig, addConversation, setCurrentConversation, resetConversationActivity, onConversationCreated, t]);

  const handleSelectConversation = useCallback(async (conversation: Conversation) => {
    setIsConversationListOpen(false);
    const conversationId = conversation.id;
    if (conversationId && pendingExecutionRef.current?.conversationId === conversationId) {
      return;
    }

    resetConversationActivity();
    setCurrentConversation(conversation);
    currentConversationRef.current = conversation;
    writeStoredConversationId(activeAgencyId, conversationId ?? null);
    if (!conversationId) {
      return;
    }

    setIsLoading(true);
    const load: ConversationLoad = {controller: new AbortController(), events: []};
    conversationLoadRef.current = load;
    const {signal} = load.controller;
    const readTranscript = async (notify: boolean) => {
      try {
        const history = await getMessageService().getMessages(conversationId, activeAgencyId, signal);
        if (!signal.aborted) {
          replaceMessages(history);
          recordReceivedMessages(history, notify);
        }
      } catch (error) {
        if (!signal.aborted) {
          console.error('Failed to load messages:', error);
        }
      }
    };

    try {
      await readTranscript(false);
      if (signal.aborted) {
        return;
      }

      const status = await getPipelineService().getLatestExecutionStatus(activeAgencyId, conversationId, signal);
      if (signal.aborted || !status?.execution_id || status.agency_id !== activeAgencyId ||
        status.conversation_id !== conversationId) {
        return;
      }

      if (isActiveExecutionStatus(status.status)) {
        const execution = startPendingExecution(activeAgencyId, conversationId, status.execution_id, {
          restored: true,
          createdAt: status.created_at,
        });
        scheduleExecutionCheck(execution);
      } else if (status.status === 'completed') {
        // Completion may have happened after the first transcript read.
        await readTranscript(true);
      }
    } catch {
      // Conversations without a recent execution still have a usable transcript.
    } finally {
      if (!signal.aborted) {
        conversationLoadRef.current = null;
        setIsLoading(false);
        // Apply live events after the history snapshot so it cannot overwrite them.
        load.events.forEach(handleSSEMessage);
      }
    }
  }, [
    activeAgencyId,
    handleSSEMessage,
    recordReceivedMessages,
    replaceMessages,
    resetConversationActivity,
    scheduleExecutionCheck,
    setCurrentConversation,
    startPendingExecution,
  ]);

  useEffect(() => {
    if (!hasLoadedConversations || !activeAgencyId || currentConversation) {
      return;
    }

    const storedConversationId = readStoredConversationId(activeAgencyId);
    if (!storedConversationId || restoredConversationIdRef.current === storedConversationId) {
      return;
    }

    restoredConversationIdRef.current = storedConversationId;
    let isCancelled = false;

    const restoreConversation = async () => {
      let storedConversation = conversations.find((conversation) => conversation.id === storedConversationId);

      if (!storedConversation) {
        try {
          storedConversation = await getConversationService().getConversation(storedConversationId);
        } catch {
          storedConversation = undefined;
        }
      }

      if (isCancelled) {
        return;
      }

      if (!storedConversation) {
        writeStoredConversationId(activeAgencyId, null);
        return;
      }

      if (!conversations.some((conversation) => conversation.id === storedConversation?.id)) {
        addConversation(storedConversation);
      }

      handleSelectConversation(storedConversation);
    };

    restoreConversation();

    return () => {
      isCancelled = true;
    };
  }, [
    addConversation,
    activeAgencyId,
    conversations,
    currentConversation,
    handleSelectConversation,
    hasLoadedConversations
  ]);

  const handleDeleteConversation = useCallback((conversationId: string) => {
    setConversationToDelete(conversationId);
    setIsDeleteDialogOpen(true);
  }, []);

  const confirmDeleteConversation = useCallback(async () => {
    if (!conversationToDelete) return;
    
    try {
      setIsLoading(true);
      const conversationService = getConversationService();
      await conversationService.deleteConversation(conversationToDelete);
      
      removeConversation(conversationToDelete);
      if (readStoredConversationId(activeAgencyId) === conversationToDelete) {
        writeStoredConversationId(activeAgencyId, null);
      }
      if (currentConversationRef.current?.id === conversationToDelete) {
        setCurrentConversation(null);
        currentConversationRef.current = null;
        resetConversationActivity();
      }
      onConversationDeleted?.(conversationToDelete);
      
      // Close dialog
      setIsDeleteDialogOpen(false);
      setConversationToDelete(null);
    } catch (err) {
      const error = new Error(t('chat.errors.failedToDeleteConversation'));
      onError?.(error);
      setError(t('chat.errors.failedToDeleteConversation'));
      // Close dialog even on error
      setIsDeleteDialogOpen(false);
      setConversationToDelete(null);
    } finally {
      setIsLoading(false);
    }
  }, [activeAgencyId, conversationToDelete, removeConversation, setCurrentConversation, resetConversationActivity, onConversationDeleted, onError, t]);

  const cancelDeleteConversation = useCallback(() => {
    setIsDeleteDialogOpen(false);
    setConversationToDelete(null);
  }, []);

  const handleSendMessage = useCallback(async (
    content: string, 
    image?: string, 
    audio?: string,
    messageId?: string | null
  ) => {
    if (!mergedConfig || !currentConversation || isBusy || pendingExecutionRef.current ||
      conversationLoadRef.current || (!content.trim() && !audio)) {
      return;
    }

    let conversationId = currentConversation.id;

    try {
      // If this is a new conversation (null ID), create it on the server first
      if (!conversationId) {
        setIsLoading(true);
        const conversationService = getConversationService();
        const conversationProfileId = currentConversation.conversation_profile_id || mergedConfig.conversationProfileId;
        conversationId = await conversationService.createConversation({
          title: t('chat.conversations.newConversation'),
          agency_id: mergedConfig.agencyId,
          ...(conversationProfileId ? {conversation_profile_id: conversationProfileId} : {}),
        });

        // Update the conversation with the real server ID
        const updatedConversation = {
          ...currentConversation,
          ...(conversationProfileId ? {conversation_profile_id: conversationProfileId} : {}),
          id: conversationId
        };
        
        // Update the conversation in the list and set as current
        updateConversation(updatedConversation.id, updatedConversation);
        if (currentConversationRef.current === currentConversation) {
          setCurrentConversation(updatedConversation);
          currentConversationRef.current = updatedConversation;
          writeStoredConversationId(activeAgencyId, conversationId);
          setIsLoading(false);
        }
      }

      const isVisibleConversation = currentConversationRef.current?.id === conversationId;
      if (isVisibleConversation) {
        setStreamMessages([]);
      }
      
      let userMessage: FusioniMemoryMessage | null = null;
      if (!messageId) {
        const userExtra: Record<string, unknown> = {[FUSIONI_SDK_OPTIMISTIC_USER]: true};
        if (image) {
          userExtra.image_ref = image;
          userExtra.image_base64 = true;
        } else if (audio) {
          userExtra.audio_ref = audio;
          userExtra.audio_base64 = true;
        }

        // Add user message (tagged so we can remove it from the list when the server returns the persisted turn)
        userMessage = {
          agency_id: mergedConfig.agencyId,
          conversation_id: conversationId,
          shouldAnimate: false,
          role: 'user',
          content: content.trim(),
          mem_type: 'short',
          keywords: [],
          thoughts: null,
          created: new Date(),
          loading: false,
          extra_data: userExtra as FusioniMemoryMessage['extra_data']
        };

        if (isVisibleConversation) {
          addMessage(userMessage);
        }
      } else if (isVisibleConversation) {
        // Match Angular behavior: keep messages only up to edited user turn.
        truncateMessagesAt(messageId);
      }

      if (userMessage) {
        onMessageSent?.(userMessage);
      }

      await submitExecution({
        conversation_id: conversationId,
        agency_id: mergedConfig.agencyId,
        inp: content || (audio ? `Audio message` : ''),
        image,
        audio,
        message_id: messageId
      });
    } catch (err) {
      if (currentConversationRef.current === currentConversation ||
        (conversationId && currentConversationRef.current?.id === conversationId)) {
        setIsLoading(false);
        setError(t('chat.errors.failedToSendMessage'));
      }
      onError?.(err instanceof Error ? err : new Error(t('chat.errors.failedToSendMessage')));
    }
  }, [
    currentConversation,
    activeAgencyId,
    mergedConfig,
    isBusy,
    addMessage,
    truncateMessagesAt,
    updateConversation,
    setCurrentConversation,
    submitExecution,
    onMessageSent,
    onError,
    setStreamMessages,
    t,
  ]);

  const handleDeleteMessage = useCallback((messageId: string) => {
    setMessageToDelete(messageId);
    setIsDeleteMessageDialogOpen(true);
  }, []);

  const handleEditMessage = useCallback((payload: { messageId: string; content: string }) => {
    if (isBusy || pendingExecutionRef.current || conversationLoadRef.current) return;
    updateMessage(payload.messageId, { content: payload.content });
    handleSendMessage(payload.content, undefined, undefined, payload.messageId);
  }, [isBusy, updateMessage, handleSendMessage]);

  const confirmDeleteMessage = useCallback(async () => {
    if (!messageToDelete || !mergedConfig) return;
    
    try {
      const messageService = getMessageService();
      await messageService.deleteMessage(messageToDelete, mergedConfig.agencyId);
      removeMessage(messageToDelete);
      
      // Close dialog
      setIsDeleteMessageDialogOpen(false);
      setMessageToDelete(null);
    } catch (err) {
      const error = new Error(t('chat.errors.failedToDeleteMessage'));
      onError?.(error);
      setError(t('chat.errors.failedToDeleteMessage'));
      // Close dialog even on error
      setIsDeleteMessageDialogOpen(false);
      setMessageToDelete(null);
    }
  }, [messageToDelete, mergedConfig, removeMessage, onError, t]);

  const cancelDeleteMessage = useCallback(() => {
    setIsDeleteMessageDialogOpen(false);
    setMessageToDelete(null);
  }, []);

  const handleMessageFeedback = useCallback(async (messageId: string, like: -1 | 0 | 1) => {
    if (!mergedConfig) return;

    const previousLike = messages.find((message) => message.id === messageId)?.like ?? 0;
    updateMessage(messageId, { like });

    try {
      await getMessageService().likeMessage(messageId, mergedConfig.agencyId, like);
    } catch {
      updateMessage(messageId, { like: previousLike });
      const feedbackError = new Error(t('chat.errors.failedToRateMessage'));
      onError?.(feedbackError);
      setError(feedbackError.message);
    }
  }, [mergedConfig, messages, onError, t, updateMessage]);

  const handleConfirmation = useCallback(async (result: { confirmed: 'Confirmed' | 'NotConfirmed'; key?: string }) => {
    if (!mergedConfig || !currentConversation?.id || isBusy || pendingExecutionRef.current ||
      conversationLoadRef.current) {
      return;
    }

    const isConfirmed = result.confirmed === 'Confirmed';
    await submitExecution({
      conversation_id: currentConversation.id,
      agency_id: mergedConfig.agencyId,
      context: isConfirmed && result.key ? {[result.key]: result.confirmed} : null,
      inp: isConfirmed ? null : t('common.no'),
    });
  }, [currentConversation, isBusy, mergedConfig, submitExecution, t]);

  const handleFileUpload = useCallback(async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = () => {
        const base64String = reader.result as string;
        resolve(base64String);
      };
      
      reader.onerror = () => {
        const error = new Error(t('chat.errors.failedToUploadFile'));
        onError?.(error);
        setError(t('chat.errors.failedToUploadFile'));
        reject(error);
      };
      
      reader.readAsDataURL(file);
    });
  }, [onError, t]);

  // Keep the saved open preference while the backend is unavailable.
  if (!isConfigReady || !mergedConfig || hasConfigError) {
    return null;
  }

  if (error) {
    return (
      <div className="fusioni-chat-error">
        <p>{t('common.error')}: {error}</p>
        <button onClick={() => setError(null)}>{t('chat.errors.retry')}</button>
      </div>
    );
  }

  const welcomeLabel = mergedConfig.labels?.find(label => label.language.trim().toLowerCase() === currentLanguage)
    ?? mergedConfig.labels?.find(label => label.language.trim().toLowerCase() === 'en');

  return (
    <div 
      className={`fusioni-chat-widget ${theme}`}
      data-fusioni-custom-icon={
        mergedConfig.icon?.trim() || mergedConfig.iconColor?.trim() || mergedConfig.iconBg?.trim()
          ? 'true'
          : undefined
      }
      style={{
        '--primary-color': mergedConfig.primaryColor || '#6366f1',
        '--fusioni-icon-bg': mergedConfig.iconBg?.trim() || undefined,
      } as React.CSSProperties}
    >
      
      <FloatingButton
        isOpen={isOpen}
        onClick={handleToggleChat}
        position={mergedConfig.position || 'bottom-right'}
        primaryColor={mergedConfig.primaryColor}
        icon={mergedConfig.icon}
        iconColor={mergedConfig.iconColor}
        buttonRef={floatingButtonRef}
        variant={mergedConfig.buttonVariant || 'glass'}
        shouldDisplay={!isMobileLayout || !isOpen}
      />
      
      {isOpen && (
        <ChatPanel
          isOpen={isOpen}
          onClose={() => updateChatOpen(false)}
          position={mergedConfig.position || 'bottom-right'}
          isFullscreen={isFullscreen}
          floatingButtonRef={floatingButtonRef}
        >
          <div className="fusioni-chat-container">
            {mergedConfig.showConversationList !== false && (
              <>
                <div 
                  className={`fusioni-conversation-backdrop ${isConversationListOpen ? 'open' : ''}`}
                  onClick={() => setIsConversationListOpen(false)}
                />
                       <ConversationList
                         conversations={conversations}
                         selectedConversationId={currentConversation?.id || undefined}
                         onSelectConversation={handleSelectConversation}
                         onDeleteConversation={handleDeleteConversation}
                         onCreateConversation={handleCreateConversation}
                         isOpen={isConversationListOpen}
                         currentLanguage={currentLanguage}
                         botIcon={mergedConfig.icon}
                         botIconColor={mergedConfig.iconColor}
                       />
              </>
            )}
            
            <div className="fusioni-chat-main">
              <div className="fusioni-chat-main-header">
                {mergedConfig.showConversationList !== false ? (
                  <button
                    type="button"
                    onClick={handleToggleConversationList}
                    className={`fusioni-conversation-toggle ${isConversationListOpen ? 'open' : ''}`}
                  >
                    <svg className="fusioni-conversation-toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 12h18M3 6h18M3 18h18"/>
                    </svg>
                    {t('chat.conversations.title')}
                  </button>
                ) : (
                  <span className="fusioni-chat-main-header-title">{t('chat.title')}</span>
                )}
                <div className="fusioni-header-actions">
                  <button
                    type="button"
                    onClick={handleCreateConversation}
                    disabled={isBusy}
                    className="fusioni-btn fusioni-btn-icon"
                    title={t('chat.conversations.newConversation')}
                    aria-label={t('chat.conversations.newConversation')}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M12 5V19M5 12H19"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  {mergedConfig.showThemeToggle !== false && (
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="fusioni-btn fusioni-btn-icon"
                    title={theme === 'dark' ? t('chat.theme.light') : t('chat.theme.dark')}
                  >
                    {theme === 'dark' ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="5"/>
                        <line x1="12" y1="1" x2="12" y2="3"/>
                        <line x1="12" y1="21" x2="12" y2="23"/>
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                        <line x1="1" y1="12" x2="3" y2="12"/>
                        <line x1="21" y1="12" x2="23" y2="12"/>
                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                      </svg>
                    )}
                  </button>
                  )}
                  {mergedConfig.showFullscreenToggle !== false && (
                  <button
                    type="button"
                    onClick={handleToggleFullscreen}
                    className="fusioni-btn fusioni-btn-icon"
                    title={isFullscreen ? t('chat.fullscreen.exit') : t('chat.fullscreen.enter')}
                  >
                    {isFullscreen ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M8 3V5M8 3H5M8 3L3 8M16 3V5M16 3H19M16 3L21 8M8 21V19M8 21H5M8 21L3 16M16 21V19M16 21H19M16 21L21 16"/>
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M8 3H5C4.46957 3 3.96086 3.21071 3.58579 3.58579C3.21071 3.96086 3 4.46957 3 5V8M21 8V5C21 4.46957 20.7893 3.96086 20.4142 3.58579C20.0391 3.21071 19.5304 3 19 3H16M16 21H19C19.5304 21 20.0391 20.7893 20.4142 20.4142C20.7893 20.0391 21 19.5304 21 19V16M3 16V19C3 19.5304 3.21071 20.0391 3.58579 20.4142C3.96086 20.7893 4.46957 21 5 21H8"/>
                      </svg>
                    )}
                  </button>
                  )}
                  {mergedConfig.showLanguageSwitcher !== false && (
                  <LanguageSwitcher
                    currentLanguage={currentLanguage}
                    onLanguageChange={handleLanguageChange}
                  />
                  )}
                  <button
                    type="button"
                    onClick={() => updateChatOpen(false)}
                    className="fusioni-btn fusioni-btn-icon fusioni-chat-toolbar-close-mobile"
                    title={t('common.close')}
                    aria-label={t('common.close')}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M18 6L6 18M6 6L18 18" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>
              
              {currentConversation ? (
                <>
                  <MessageList
                    messages={messages}
                    streamMessages={streamMessages}
                    conversationId={currentConversation.id}
                    showThoughts={mergedConfig.showThoughts === true}
                    onDeleteMessage={handleDeleteMessage}
                    onEditMessage={handleEditMessage}
                    onConfirmation={handleConfirmation}
                    enableButtons={!isBusy}
                    apiBaseUrl={mergedConfig.apiBaseUrl}
                    apiKey={mergedConfig.accessToken}
                    agencyId={mergedConfig.agencyId}
                    conversationProfileId={mergedConfig.conversationProfileId}
                    ownerId={currentOwnerId}
                    currentLanguage={currentLanguage}
                    theme={theme}
                    onSuggestionClick={(prompt) => handleSendMessage(prompt)}
                    onMessageFeedback={handleMessageFeedback}
                    botIcon={mergedConfig.icon}
                    botIconColor={mergedConfig.iconColor}
                  />
                  <ChatInput
                    onSendMessage={handleSendMessage}
                    onFileUpload={handleFileUpload}
                    disabled={isBusy}
                    placeholder={t('chat.input.placeholder')}
                    enableAudioRecording={mergedConfig.enableAudioRecording !== false}
                    enableFileUpload={mergedConfig.enableFileUpload !== false}
                    maxFileSize={mergedConfig.maxFileSize || 10}
                    allowedFileTypes={mergedConfig.allowedFileTypes || ['image/*']}
                    currentLanguage={currentLanguage}
                  />
                  <div className="fusioni-chat-powered-by">
                    Powered by{' '}
                    <a
                      href="https://fusioni.ai"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Fusioni Platform (opens in a new window)"
                    >
                      Fusioni Platform
                    </a>
                  </div>
                </>
              ) : (
                <div className="fusioni-chat-welcome">
                  <div className="fusioni-chat-welcome-content">
                    <h3>{welcomeLabel?.welcome_message?.trim() || t('chat.welcome.title')}</h3>
                    <p>{welcomeLabel?.description?.trim() || t('chat.welcome.description')}</p>
                    <button 
                      onClick={handleCreateConversation}
                      disabled={isBusy}
                      className="fusioni-btn fusioni-btn-primary"
                    >
                      {isBusy ? t('chat.welcome.creating') : t('chat.welcome.startButton')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </ChatPanel>
      )}

      {/* Delete Conversation Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={isDeleteDialogOpen}
        title={t('chat.conversations.deleteConfirm.title')}
        message={t('chat.conversations.deleteConfirm.message')}
        confirmText={t('chat.conversations.deleteConfirm.confirm')}
        cancelText={t('chat.conversations.deleteConfirm.cancel')}
        onConfirm={confirmDeleteConversation}
        onCancel={cancelDeleteConversation}
        currentLanguage={currentLanguage}
        variant="danger"
      />

      {/* Delete Message Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={isDeleteMessageDialogOpen}
        title={t('chat.messages.deleteConfirm.title')}
        message={t('chat.messages.deleteConfirm.message')}
        confirmText={t('chat.messages.deleteConfirm.confirm')}
        cancelText={t('chat.messages.deleteConfirm.cancel')}
        onConfirm={confirmDeleteMessage}
        onCancel={cancelDeleteMessage}
        currentLanguage={currentLanguage}
        variant="danger"
      />
    </div>
  );
});

ChatWidgetInner.displayName = 'ChatWidgetInner';

export const ChatWidget = forwardRef<FusioniChatWidgetHandle, ChatWidgetProps>(function ChatWidget(
  props,
  ref
) {
  return (
    <ShadowDomRoot>
      <ChatWidgetInner {...props} ref={ref} />
    </ShadowDomRoot>
  );
});

ChatWidget.displayName = 'ChatWidget';

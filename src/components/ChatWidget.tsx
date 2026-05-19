import React, {forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState} from 'react';
import {
  ChatWidgetProps,
  Conversation,
  FusioniChatWidgetHandle,
  FusioniMemoryMessage,
  FusioniSDKConfig
} from '../types';
import {Language, isValidLanguage} from '../i18n';
import {initializeApiClient} from '../services/ApiClient';
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
import '../styles/index.css';

export const ChatWidget = forwardRef<FusioniChatWidgetHandle, ChatWidgetProps>(function ChatWidget(
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
  
  // Refs
  const floatingButtonRef = useRef<HTMLButtonElement>(null);
  
  const translationDefault: Language =
    languageOverride ?? mergedConfig?.language ?? config.language ?? 'en';

  // Translation and language management - use merged config or fallback to user config
  const { t, currentLanguage, changeLanguage } = useTranslation(translationDefault);
  
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
    removeOptimisticUserMessages,
    truncateMessagesAt,
    addConversation,
    updateConversation,
    removeConversation,
    loadConversations,
    loadMessages,
    clearMessages
  } = useChatState(mergedConfig?.agencyId || config.agencyId);

  const { theme, toggleTheme, setTheme } = useTheme(mergedConfig?.theme || config.theme);
  const isMobileLayout = useIsMobileLayout();

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
        initializeApiClient(config.apiBaseUrl, config.accessToken);
        
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
            // If fetching config fails, mark as error and hide FloatingButton
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
    if (mergedConfig?.agencyId) {
      loadConversations().then();
    }
  }, [mergedConfig?.agencyId, loadConversations]);

  // SSE connection for real-time updates - only when a chat panel is open
  const eventSource = useSSE(mergedConfig?.agencyId || config.agencyId, (data) => {
    // Same as fusioni-web chat.component: latest SSE line replaces stream (single loading row updates)
    if (data?.data != null && String(data.data).trim() !== '') {
      setStreamMessages([String(data.data)]);
    }
  }, isOpen, mergedConfig?.accessToken || config.accessToken);

  // Cleanup: Close a chat panel when component unmounts
  useEffect(() => {
    return () => {
      setIsOpen(false);
    };
  }, []);

  const handleToggleChat = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const handleToggleConversationList = useCallback(() => {
    setIsConversationListOpen(prev => !prev);
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  const handleCreateConversation = useCallback(() => {
    if (!mergedConfig) return;
    
    // Create a new conversation with null ID - will be created on server when first message is sent
    const newConversation: Conversation = {
      id: null,
      title: t('chat.conversations.newConversation'),
      agency_id: mergedConfig.agencyId,
      messages: []
    };

    addConversation(newConversation);
    setCurrentConversation(newConversation);
    
    // Clear messages when switching to new conversation
    clearMessages();
    setStreamMessages([]);
    
    // Auto-hide conversation list when a new conversation is created
    setIsConversationListOpen(false);
    
    onConversationCreated?.(newConversation);
  }, [mergedConfig, addConversation, setCurrentConversation, clearMessages, onConversationCreated, t]);

  const handleSelectConversation = useCallback(async (conversation: Conversation) => {
    try {
      setIsLoading(true);
      
      // Clear messages immediately when switching conversations
      clearMessages();
      setStreamMessages([]);
      
      setCurrentConversation(conversation);
      
      // Auto-hide conversation list when a conversation is selected
      setIsConversationListOpen(false);
      
      if (conversation.id) {
        await loadMessages(conversation.id);
      }
    } catch (err) {
      const error = new Error(t('chat.errors.failedToLoadConversation'));
      onError?.(error);
      setError(t('chat.errors.failedToLoadConversation'));
    } finally {
      setIsLoading(false);
    }
  }, [setCurrentConversation, loadMessages, clearMessages, onError]);

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
      if (currentConversation?.id === conversationToDelete) {
        setCurrentConversation(null);
        clearMessages();
        setStreamMessages([]);
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
  }, [conversationToDelete, removeConversation, currentConversation, setCurrentConversation, clearMessages, setStreamMessages, onConversationDeleted, onError, t]);

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
    if (!mergedConfig) return;
    
    if (!currentConversation || (!content.trim() && !audio)) {
      return;
    }

    try {
      setIsLoading(true);

      let conversationId = currentConversation.id;
      
      // If this is a new conversation (null ID), create it on the server first
      if (!conversationId) {
        const conversationService = getConversationService();
        conversationId = await conversationService.createConversation({
          title: t('chat.conversations.newConversation'),
          agency_id: mergedConfig.agencyId,
        });

        // Update the conversation with the real server ID
        const updatedConversation = {
          ...currentConversation,
          id: conversationId
        };
        
        // Update the conversation in the list and set as current
        updateConversation(updatedConversation.id, updatedConversation);
        setCurrentConversation(updatedConversation);
        
      }

      // Clear stream messages for new conversation
      setStreamMessages([]);
      
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

        addMessage(userMessage);
      } else {
        // Match Angular behavior: keep messages only up to edited user turn.
        truncateMessagesAt(messageId);
      }

      // Add a loading message (UI: logo + Spotlight in Message; no plain-text bubble like Angular)
      const loadingMessage: FusioniMemoryMessage = {
        id: `loading-${Date.now()}`,
        agency_id: mergedConfig.agencyId,
        shouldAnimate: false,
        conversation_id: conversationId,
        role: 'assistant',
        content: '',
        mem_type: 'short',
        keywords: [],
        thoughts: null,
        created: new Date(),
        loading: true,
        has_error: false
      };

      addMessage(loadingMessage);
      if (userMessage) {
        onMessageSent?.(userMessage);
      }

      const pipelineRequest = {
        conversation_id: conversationId,
        agency_id: mergedConfig.agencyId,
        inp: content || (audio ? `Audio message` : ''),
        image,
        audio,
        message_id: messageId
      };

      // Execute pipeline - this calls /pipeline/${agency_id}/exec
      const pipelineService = getPipelineService();
      const response = await pipelineService.executePipeline(pipelineRequest);

      // Remove loading message and add response messages
      removeMessage(loadingMessage.id!);

      // Server usually echoes the user turn in `response.messages`; drop the optimistic local row (not keyed by id)
      const serverIncludesUserTurn =
        response.messages?.some((m) => m.role === 'user') ?? false;
      if (serverIncludesUserTurn) {
        removeOptimisticUserMessages();
        // Edit flow keeps the local edited user row until pipeline returns.
        // Drop that local row when server echoes the persisted user turn.
        if (messageId) {
          removeMessage(messageId);
        }
      }

      // Only trigger typing effect for messages received from /pipeline/${agency_id}/exec response
      if (response.messages && response.messages.length > 0) {
        response.messages.forEach(message => {
          // Mark assistant messages from pipeline exec response as needing animation
          const messageWithAnimation = {
            ...message,
            shouldAnimate: message.role === 'assistant' && !message.loading
          };
          addMessage(messageWithAnimation);
          onMessageReceived?.(messageWithAnimation);
        });
      }

      // Reload conversations to update titles
      loadConversations();
    } catch (err) {
      const error = new Error(t('chat.errors.failedToSendMessage'));
      onError?.(error);
      setError(t('chat.errors.failedToSendMessage'));
      
      // Update loading message with error
      const loadingMessages = messages.filter(m => m.loading);
      if (loadingMessages.length > 0) {
        const loadingMessage = loadingMessages[0];
        updateMessage(loadingMessage.id!, {
          ...loadingMessage,
          loading: false,
          has_error: true,
          content: t('chat.messages.error')
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [
    currentConversation,
    mergedConfig,
    messages,
    addMessage,
    removeMessage,
    removeOptimisticUserMessages,
    truncateMessagesAt,
    updateMessage,
    updateConversation,
    setCurrentConversation,
    loadConversations,
    onMessageSent,
    onMessageReceived,
    onError
  ]);

  const handleDeleteMessage = useCallback((messageId: string) => {
    setMessageToDelete(messageId);
    setIsDeleteMessageDialogOpen(true);
  }, []);

  const handleEditMessage = useCallback((payload: { messageId: string; content: string }) => {
    updateMessage(payload.messageId, { content: payload.content });
    handleSendMessage(payload.content, undefined, undefined, payload.messageId);
  }, [updateMessage, handleSendMessage]);

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

  const handleConfirmation = useCallback(async (result: { confirmed: 'Confirmed' | 'NotConfirmed'; key?: string }) => {
    if (!mergedConfig || !currentConversation) return;

    try {
      setIsLoading(true);

      const conversationId = currentConversation.id;
      if (!conversationId) {
        console.warn('Cannot handle confirmation: conversation has no ID');
        return;
      }

      // Create a working message
      const workingMessage: FusioniMemoryMessage = {
        id: `loading-${Date.now()}`,
        shouldAnimate: false,
        agency_id: mergedConfig.agencyId,
        conversation_id: conversationId,
        role: 'assistant',
        content: '',
        mem_type: 'short',
        keywords: [],
        thoughts: null,
        created: new Date(),
        loading: true,
        has_error: false
      };

      addMessage(workingMessage);

      const confirmed = 'Confirmed';
      const notConfirmingMessage = t('common.no');

      // Set up context
      const ctx: Record<string, string> = {};
      if (result.key && result.confirmed === confirmed) {
        ctx[result.key] = confirmed;
      }

      // Execute pipeline with context - this calls /pipeline/${agency_id}/exec
      const pipelineService = getPipelineService();
      const pipelineRequest = {
        conversation_id: conversationId,
        agency_id: mergedConfig.agencyId,
        context: Object.keys(ctx).length > 0 ? ctx : null,
        inp: result.confirmed !== confirmed ? notConfirmingMessage : null
      };

      const response = await pipelineService.executePipeline(pipelineRequest);

      // Remove working message and add response messages
      removeMessage(workingMessage.id!);
      
      // Only trigger typing effect for messages received from /pipeline/${agency_id}/exec response
      if (response.messages && response.messages.length > 0) {
        response.messages.forEach(message => {
          // Mark assistant messages from pipeline exec response as needing animation
          const messageWithAnimation = {
            ...message,
            shouldAnimate: message.role === 'assistant' && !message.loading
          };
          addMessage(messageWithAnimation);
          onMessageReceived?.(messageWithAnimation);
        });
      }

      // Reload conversations to update titles
      loadConversations();
    } catch (err) {
      const error = new Error(t('chat.errors.failedToSendMessage'));
      onError?.(error);
      setError(t('chat.errors.failedToSendMessage'));
      
      // Update working message with error
      const loadingMessages = messages.filter(m => m.loading);
      if (loadingMessages.length > 0) {
        const loadingMessage = loadingMessages[0];
        updateMessage(loadingMessage.id!, {
          ...loadingMessage,
          loading: false,
          has_error: true,
          content: t('chat.messages.error')
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [
    mergedConfig,
    currentConversation,
    messages,
    addMessage,
    removeMessage,
    updateMessage,
    loadConversations,
    onMessageReceived,
    onError,
    t
  ]);

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
  }, [onError]);

  // Don't render until config is ready
  if (!isConfigReady || !mergedConfig) {
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

  return (
    <div 
      className={`fusioni-chat-widget ${theme}`}
      style={{ '--primary-color': mergedConfig.primaryColor || '#6366f1' } as React.CSSProperties}
    >
      
      <FloatingButton
        isOpen={isOpen}
        onClick={handleToggleChat}
        position={mergedConfig.position || 'bottom-right'}
        primaryColor={mergedConfig.primaryColor}
        buttonRef={floatingButtonRef}
        variant={mergedConfig.buttonVariant || 'glass'}
        shouldDisplay={!hasConfigError && (!isMobileLayout || !isOpen)}
      />
      
      {isOpen && (
        <ChatPanel
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
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
                  {isMobileLayout && (
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="fusioni-btn fusioni-btn-icon fusioni-chat-toolbar-close-mobile"
                      title={t('common.close')}
                      aria-label={t('common.close')}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M18 6L6 18M6 6L18 18" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  )}
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
                </div>
              </div>
              
              {currentConversation ? (
                <>
                  <MessageList
                    messages={messages}
                    streamMessages={streamMessages}
                    showThoughts={false}
                    onDeleteMessage={handleDeleteMessage}
                    onEditMessage={handleEditMessage}
                    onConfirmation={handleConfirmation}
                    enableButtons={!isLoading}
                    apiBaseUrl={mergedConfig.apiBaseUrl}
                    apiKey={mergedConfig.accessToken}
                    agencyId={mergedConfig.agencyId}
                    currentLanguage={currentLanguage}
                    theme={theme}
                  />
                  <ChatInput
                    onSendMessage={handleSendMessage}
                    onFileUpload={handleFileUpload}
                    disabled={isLoading}
                    placeholder={t('chat.input.placeholder')}
                    enableAudioRecording={mergedConfig.enableAudioRecording !== false}
                    enableFileUpload={mergedConfig.enableFileUpload !== false}
                    maxFileSize={mergedConfig.maxFileSize || 10}
                    allowedFileTypes={mergedConfig.allowedFileTypes || ['image/*']}
                    currentLanguage={currentLanguage}
                  />
                </>
              ) : (
                <div className="fusioni-chat-welcome">
                  <div className="fusioni-chat-welcome-content">
                    <h3>{t('chat.welcome.title')}</h3>
                    <p>{t('chat.welcome.description')}</p>
                    <button 
                      onClick={handleCreateConversation}
                      disabled={isLoading}
                      className="fusioni-btn fusioni-btn-primary"
                    >
                      {isLoading ? t('chat.welcome.creating') : t('chat.welcome.startButton')}
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

ChatWidget.displayName = 'ChatWidget';

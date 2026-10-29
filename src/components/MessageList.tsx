import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FusioniMemoryMessage } from '../types';
import { PortalContainerContext } from '../context/PortalContainerContext';
import { Message } from './Message';
import { MessageStreamLoading } from './MessageStreamLoading';
import { ChatLoader } from './ChatLoader';
import { useTranslation } from '../hooks/useTranslation';
import { ImageGallery } from './ImageGallery';
import { FUSIONI_LOGO_BASE64 } from '../assets/logo-base64';
import { ActionSuggestion, getActionService, toActionSuggestion } from '../services/ActionService';
import { getAgentService } from '../services/AgentService';
import {
  FUSIONI_SDK_OPTIMISTIC_USER,
  getAgentAccentClass,
  getAgentBubbleStyle,
  getAgentInitials,
  getMessageOwner,
  isAgentMessage,
  isMessageOwner,
} from '../utils/messageBubble';

interface MessageListProps {
  messages: FusioniMemoryMessage[];
  streamMessages: string[];
  conversationId?: string | null;
  showThoughts?: boolean;
  onDeleteMessage?: (messageId: string) => void;
  onEditMessage?: (payload: { messageId: string; content: string }) => void;
  onConfirmation?: (result: { confirmed: 'Confirmed' | 'NotConfirmed'; key?: string }) => void;
  enableButtons?: boolean;
  apiBaseUrl?: string;
  apiKey?: string;
  agencyId: string;
  conversationProfileId?: string | null;
  ownerId?: string;
  currentLanguage?: 'en' | 'el';
  theme?: 'light' | 'dark';
  onSuggestionClick?: (prompt: string) => void;
  onMessageFeedback?: (messageId: string, like: -1 | 0 | 1) => void;
}

interface MessageAvatarProps {
  message: FusioniMemoryMessage;
  agencyId: string;
  isOwnMessage: boolean;
}

const MessageAvatar: React.FC<MessageAvatarProps> = ({ message, agencyId, isOwnMessage }) => {
  const [agentAvatar, setAgentAvatar] = useState<string | null>(null);
  const owner = getMessageOwner(message);
  const agentId = typeof owner?.owner_id === 'string' ? owner.owner_id : '';
  const agent = isAgentMessage(message);

  useEffect(() => {
    let cancelled = false;
    setAgentAvatar(null);

    if (!agent || !agencyId || !agentId) return;

    getAgentService().getAvatar(agencyId, agentId)
      .then((avatar) => {
        if (!cancelled) setAgentAvatar(avatar);
      })
      .catch(() => {
        if (!cancelled) setAgentAvatar(null);
      });

    return () => {
      cancelled = true;
    };
  }, [agencyId, agent, agentId]);

  if (agent) {
    return (
      <div
        className={`fusioni-message-avatar fusioni-message-agent-avatar ${getAgentAccentClass(message)}`}
        style={getAgentBubbleStyle(message) as React.CSSProperties}
        title={owner?.name || 'Agent'}
      >
        {agentAvatar ? (
          <img src={agentAvatar} alt="" loading="lazy" decoding="async" />
        ) : (
          <span>{getAgentInitials(message)}</span>
        )}
      </div>
    );
  }

  if (message.role === 'user') {
    const firstName = typeof owner?.first_name === 'string' ? owner.first_name.trim() : '';
    const lastName = typeof owner?.last_name === 'string' ? owner.last_name.trim() : '';
    const userInitials = firstName && lastName
      ? `${firstName[0]}${lastName[0]}`.toUpperCase()
      : '';

    return (
      <div
        className={`fusioni-message-avatar ${isOwnMessage ? 'fusioni-message-user-avatar' : 'fusioni-message-other-user-avatar'}`}
        title={!isOwnMessage ? [firstName, lastName].filter(Boolean).join(' ') || owner?.name : undefined}
        aria-hidden="true"
      >
        {userInitials ? (
          <span>{userInitials}</span>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
          </svg>
        )}
      </div>
    );
  }

  return (
    <div className="fusioni-message-avatar fusioni-message-assistant-avatar">
      <img src={FUSIONI_LOGO_BASE64} alt="Fusioni" width="32" height="32" />
    </div>
  );
};

const formatExecutionTime = (milliseconds: number): string =>
  milliseconds < 1000 ? `${Math.round(milliseconds)} ms` : `${(milliseconds / 1000).toFixed(2)} s`;

const AUTO_SCROLL_THRESHOLD_PX = 48;

const getMessageScrollKey = (message?: FusioniMemoryMessage): string => {
  if (!message) return '';

  return [
    message.id || '',
    message.role,
    message.loading ? 'loading' : 'ready',
    message.has_error ? 'error' : 'ok',
    message.content || '',
  ].join('\u0000');
};

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  streamMessages,
  conversationId,
  showThoughts = false,
  onDeleteMessage,
  onEditMessage,
  onConfirmation,
  enableButtons = true,
  apiBaseUrl,
  apiKey,
  agencyId,
  conversationProfileId,
  ownerId,
  currentLanguage = 'en',
  theme = 'light',
  onSuggestionClick,
  onMessageFeedback,
}) => {
  const { t } = useTranslation(currentLanguage);
  const portalContainer = useContext(PortalContainerContext);
  const [suggestions, setSuggestions] = useState<ActionSuggestion[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLDivElement>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [showNewMessageButton, setShowNewMessageButton] = useState(false);
  const shouldAutoScrollRef = useRef(true);
  const scrollSnapshotRef = useRef({
    conversationId,
    messageCount: messages.length,
    tailKey: getMessageScrollKey(messages[messages.length - 1]),
    streamKey: streamMessages.join('\u0000'),
    hasOptimisticUserMessage: messages.some(
      (message) => message.extra_data?.[FUSIONI_SDK_OPTIMISTIC_USER] === true,
    ),
  });
  const [gallerySession, setGallerySession] = useState<{
    key: number;
    images: string[];
    index: number;
  } | null>(null);

  const openGallery = useCallback((payload: { images: string[]; index: number }) => {
    setGallerySession((prev) => ({
      key: (prev?.key ?? 0) + 1,
      images: payload.images,
      index: payload.index,
    }));
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    shouldAutoScrollRef.current = true;
    setShowNewMessageButton(false);

    // Use double requestAnimationFrame to ensure DOM and layout have fully updated.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          const container = scrollContainerRef.current;
          container.scrollTo({
            top: container.scrollHeight,
            behavior,
          });
        }
      });
    });
  }, []);

  const handleMessageListScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const isNearBottom = distanceFromBottom <= AUTO_SCROLL_THRESHOLD_PX;
    shouldAutoScrollRef.current = isNearBottom;

    if (isNearBottom) {
      setShowNewMessageButton(false);
    }
  }, []);

  useEffect(() => {
    scrollToBottom('auto');
  }, [conversationId, scrollToBottom]);

  useEffect(() => {
    const previous = scrollSnapshotRef.current;
    const tailKey = getMessageScrollKey(messages[messages.length - 1]);
    const streamKey = streamMessages.join('\u0000');
    const hasOptimisticUserMessage = messages.some(
      (message) => message.extra_data?.[FUSIONI_SDK_OPTIMISTIC_USER] === true,
    );
    const nextSnapshot = {
      conversationId,
      messageCount: messages.length,
      tailKey,
      streamKey,
      hasOptimisticUserMessage,
    };
    scrollSnapshotRef.current = nextSnapshot;

    if (previous.conversationId !== conversationId) return;

    const ownMessageWasSent =
      hasOptimisticUserMessage && !previous.hasOptimisticUserMessage;
    const messageWasAdded = messages.length > previous.messageCount;
    const tailWasUpdated =
      messages.length === previous.messageCount && tailKey !== previous.tailKey;
    const streamWasUpdated =
      streamMessages.length > 0 && streamKey !== previous.streamKey;

    if (ownMessageWasSent) {
      scrollToBottom('auto');
      return;
    }

    if (!messageWasAdded && !tailWasUpdated && !streamWasUpdated) return;

    if (shouldAutoScrollRef.current) {
      scrollToBottom('auto');
    } else {
      setShowNewMessageButton(true);
    }
  }, [conversationId, messages, scrollToBottom, streamMessages]);

  useEffect(() => {
    setSuggestions([]);
    if (!agencyId || !conversationProfileId) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    getActionService()
      .findByConversationProfileId(agencyId, conversationProfileId, controller.signal)
      .then((actions) => {
        if (cancelled) {
          return;
        }
        const items = actions
          .map((action) => toActionSuggestion(action, currentLanguage))
          .filter((item): item is ActionSuggestion => item !== null);
        setSuggestions(items);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Failed to load action suggestions:', error);
          setSuggestions([]);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
    // Reload when the SDK client switches conversation profiles.
  }, [agencyId, conversationProfileId, currentLanguage]);

  const formatDate = (date: Date): string => {
    const now = new Date();
    const diffInMilliseconds = now.getTime() - new Date(date).getTime();
    const diffInHours = diffInMilliseconds / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      if (diffInHours < 1) {
        const diffInMinutes = diffInMilliseconds / (1000 * 60);
        if (diffInMinutes < 1) {
          return 'Just now';
        }
        return `${Math.floor(diffInMinutes)} minutes ago`;
      } else {
        return `${Math.floor(diffInHours)} hours ago`;
      }
    }
    
    return new Date(date).toLocaleString('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const startEdit = (message: FusioniMemoryMessage) => {
    if (!message.id || message.loading || !onEditMessage) {
      return;
    }
    setEditingMessageId(message.id);
    setEditingContent(message.content ?? '');
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditingContent('');
  };

  const confirmEdit = () => {
    if (!editingMessageId || !onEditMessage) {
      cancelEdit();
      return;
    }
    const updatedContent = editRef.current?.innerHTML ?? editingContent;
    if (updatedContent.trim() !== '') {
      onEditMessage({ messageId: editingMessageId, content: updatedContent });
    }
    cancelEdit();
  };

  useEffect(() => {
    if (!editingMessageId || !editRef.current) {
      return;
    }
    editRef.current.innerHTML = editingContent;
    editRef.current.focus();
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(editRef.current);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }, [editingMessageId, editingContent]);

  const renderMessageActions = (message: FusioniMemoryMessage) => {
    if (!message.id) return null;

    if (message.role === 'user' && editingMessageId === message.id) {
      return (
        <div className="fusioni-message-actions">
          {onDeleteMessage && (
            <button type="button" onClick={() => onDeleteMessage(message.id!)} className="fusioni-btn fusioni-btn-icon fusioni-message-action-danger" title={t('chat.messages.delete')} aria-label={t('chat.messages.delete')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M3 6h18M8 6V4h8v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m4 4v8m6-8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          <button type="button" onClick={confirmEdit} className="fusioni-btn fusioni-btn-icon" title={t('common.save')} aria-label={t('common.save')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button type="button" onClick={cancelEdit} className="fusioni-btn fusioni-btn-icon" title={t('common.cancel')} aria-label={t('common.cancel')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      );
    }

    if (!onDeleteMessage && !(message.role === 'user' && onEditMessage)) return null;

    return (
      <div className="fusioni-message-actions">
        {onDeleteMessage && (
          <button type="button" onClick={() => onDeleteMessage(message.id!)} className="fusioni-btn fusioni-btn-icon fusioni-message-action-danger" title={t('chat.messages.delete')} aria-label={t('chat.messages.delete')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3 6h18M8 6V4h8v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m4 4v8m6-8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        {message.role === 'user' && onEditMessage && (
          <button type="button" onClick={() => startEdit(message)} className="fusioni-btn fusioni-btn-icon" title={t('common.edit')} aria-label={t('common.edit')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
    );
  };

  return (
    <>
    <div className="fusioni-message-list-shell">
      <div
        className="fusioni-message-list"
        ref={scrollContainerRef}
        onScroll={handleMessageListScroll}
      >
        <div className="fusioni-messages-container">
        {messages.length === 0 ? (
          <div className="fusioni-empty-messages">
            <div className="fusioni-empty-messages-content">
              <div className="fusioni-empty-icon-frame" aria-hidden="true">
                <img
                  src={FUSIONI_LOGO_BASE64}
                  alt=""
                  width="60"
                  height="60"
                  className="fusioni-empty-logo"
                />
              </div>
              <h3>{t('chat.emptyState.title')}</h3>
              <p>{t('chat.emptyState.description')}</p>
              {suggestions.length > 0 && <div className="fusioni-empty-suggestions" role="list" aria-label={t('chat.emptyState.suggestionsLabel')}>
                {suggestions.map((suggestion, index) => (
                  <button
                    key={suggestion.id ?? `action-suggestion-${index}`}
                    type="button"
                    className="fusioni-empty-suggestion-chip"
                    role="listitem"
                    disabled={!onSuggestionClick}
                    onClick={() => onSuggestionClick?.(suggestion.prompt)}
                  >
                    {suggestion.label}
                  </button>
                ))}
              </div>}
            </div>
          </div>
        ) : (
          <div className="fusioni-messages">
            {messages.map((message, index) => {
              const isLastMessage = index === messages.length - 1;
              const messageKey = message.id ??
                `msg-fallback-${index}-${message.role}-${message.created instanceof Date ? message.created.getTime() : 0}`;
              const isUser = isMessageOwner(message, ownerId);
              const isEditing = isUser && editingMessageId === message.id;
              const showFeedback = !isUser && !message.has_error &&
                message.extra_data?.widget !== 'Confirmation' && Boolean(message.id && onMessageFeedback);

              return (
                <div key={messageKey} className="fusioni-message-wrapper">
                  <div className={`fusioni-message ${isUser ? 'user' : 'assistant'}${isAgentMessage(message) ? ' agent' : ''}`}>
                    {!message.loading && !isUser && (
                      <MessageAvatar message={message} agencyId={agencyId} isOwnMessage={false} />
                    )}

                    <div className="fusioni-message-content">
                      <div className="fusioni-message-bubble-row">
                        {!message.loading && isUser && renderMessageActions(message)}
                        <div className="fusioni-message-body">
                          {isEditing ? (
                            <div
                              ref={editRef}
                              className="fusioni-message-bubble fusioni-message-user fusioni-message-editing"
                              contentEditable
                              suppressContentEditableWarning
                              spellCheck
                              onKeyDown={(event) => {
                                if (event.key === 'Escape') {
                                  event.preventDefault();
                                  cancelEdit();
                                }
                              }}
                            />
                          ) : message.loading ? (
                            <MessageStreamLoading
                              streamMessages={streamMessages}
                              loadingLabel={t('chat.messages.loading')}
                            />
                          ) : (
                            <Message
                              message={message}
                              isOwnMessage={isUser}
                              showThoughts={showThoughts}
                              onConfirmation={onConfirmation}
                              enableButtons={enableButtons && isLastMessage}
                              apiBaseUrl={apiBaseUrl}
                              apiKey={apiKey}
                              agencyId={agencyId}
                              currentLanguage={currentLanguage}
                              onOpenGallery={openGallery}
                            />
                          )}
                        </div>
                        {!message.loading && !isUser && !message.has_error && renderMessageActions(message)}
                      </div>

                      {!message.loading && (
                        <div className="fusioni-message-footer">
                          <span className="fusioni-message-time">{formatDate(message.created)}</span>
                          {!isUser && message.execution_time_ms != null && (
                            <span className="fusioni-message-execution" title={t('chat.messages.executionTime')}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                                <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                              </svg>
                              {formatExecutionTime(message.execution_time_ms)}
                            </span>
                          )}
                          {showFeedback && (
                            <div className="fusioni-message-feedback">
                              <span className="fusioni-feedback-divider" aria-hidden="true">|</span>
                              <button
                                type="button"
                                className={`fusioni-feedback-button${message.like === 1 ? ' active positive' : ''}`}
                                title={t('chat.messages.like')}
                                aria-label={t('chat.messages.like')}
                                aria-pressed={message.like === 1}
                                onClick={() => onMessageFeedback?.(message.id!, message.like === 1 ? 0 : 1)}
                              >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                  <path d="M7 10v11H3V10h4Zm0 9h10.1a2 2 0 0 0 1.94-1.51l1.5-6A2 2 0 0 0 18.6 9H14l.7-4.2A2.4 2.4 0 0 0 12.34 2L7 10Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                className={`fusioni-feedback-button${message.like === -1 ? ' active negative' : ''}`}
                                title={t('chat.messages.dislike')}
                                aria-label={t('chat.messages.dislike')}
                                aria-pressed={message.like === -1}
                                onClick={() => onMessageFeedback?.(message.id!, message.like === -1 ? 0 : -1)}
                              >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                  <path d="M7 14V3H3v11h4Zm0-9h10.1a2 2 0 0 1 1.94 1.51l1.5 6A2 2 0 0 1 18.6 15H14l.7 4.2A2.4 2.4 0 0 1 12.34 22L7 14Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {!message.loading && isUser && (
                      <MessageAvatar message={message} agencyId={agencyId} isOwnMessage />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
          <div ref={messagesEndRef} />
        </div>
      </div>
      {showNewMessageButton && (
        <button
          type="button"
          className="fusioni-new-message-button"
          onClick={() => scrollToBottom('smooth')}
          title={t('chat.messages.newMessageReceived')}
          aria-label={t('chat.messages.newMessageReceived')}
          aria-live="polite"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>{t('chat.messages.newMessageReceived')}</span>
        </button>
      )}
    </div>
    {gallerySession &&
      typeof document !== 'undefined' &&
      createPortal(
        <ImageGallery
          key={gallerySession.key}
          images={gallerySession.images}
          initialIndex={gallerySession.index}
          theme={theme}
          onClose={() => setGallerySession(null)}
        />,
        portalContainer ?? document.body
      )}
    </>
  );
};

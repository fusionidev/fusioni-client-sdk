import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FusioniMemoryMessage } from '../types';
import { Message } from './Message';
import { ChatLoader } from './ChatLoader';
import { ImageGallery } from './ImageGallery';
import { FUSIONI_LOGO_BASE64 } from '../assets/logo-base64';

interface MessageListProps {
  messages: FusioniMemoryMessage[];
  streamMessages: string[];
  showThoughts?: boolean;
  onDeleteMessage?: (messageId: string) => void;
  onEditMessage?: (payload: { messageId: string; content: string }) => void;
  onConfirmation?: (result: { confirmed: 'Confirmed' | 'NotConfirmed'; key?: string }) => void;
  enableButtons?: boolean;
  apiBaseUrl?: string;
  apiKey?: string;
  agencyId: string;
  currentLanguage?: 'en' | 'el';
  theme?: 'light' | 'dark';
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  streamMessages,
  showThoughts = false,
  onDeleteMessage,
  onEditMessage,
  onConfirmation,
  enableButtons = true,
  apiBaseUrl,
  apiKey,
  agencyId,
  currentLanguage = 'en',
  theme = 'light'
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLDivElement>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
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

  const scrollToBottom = () => {
    // Use double requestAnimationFrame to ensure DOM and layout have fully updated
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          // Scroll to the very bottom with smooth animation
          // This ensures the last message is fully visible
          const container = scrollContainerRef.current;
          container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth'
          });
        }
      });
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamMessages]);

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

  return (
    <>
    <div className="fusioni-message-list" ref={scrollContainerRef}>
      <div className="fusioni-messages-container">
        {messages.length === 0 ? (
          <div className="fusioni-empty-messages">
            <div className="fusioni-empty-messages-content">
              <svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                className="fusioni-empty-icon"
              >
                <path
                  d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <h3>Start a conversation</h3>
              <p>Send a message to begin chatting with the AI assistant</p>
            </div>
          </div>
        ) : (
          <div className="fusioni-messages">
            {messages.map((message, index) => {
              const isLastMessage = index === messages.length - 1;
              const messageKey =
                message.id ??
                `msg-fallback-${index}-${message.role}-${message.created instanceof Date ? message.created.getTime() : 0}`;
              return (
              <div key={messageKey} className="fusioni-message-wrapper">
                <div className={`fusioni-message ${message.role}`}>
                  <div className="fusioni-message-avatar">
                    {message.role === 'user' ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle
                          cx="12"
                          cy="7"
                          r="4"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                      </svg>
                    ) : (
                      <img 
                        src={FUSIONI_LOGO_BASE64} 
                        alt="Fusioni Logo" 
                        width="24" 
                        height="24"
                      />
                    )}
                  </div>
                  
                  <div className="fusioni-message-content">
                    
                    
                    <div className="fusioni-message-body">
                      {message.role === 'user' && editingMessageId === message.id ? (
                        <div
                          ref={editRef}
                          className="fusioni-message-text"
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
                      ) : (
                        <Message
                          message={message}
                          showThoughts={showThoughts}
                          onDelete={onDeleteMessage}
                          onConfirmation={onConfirmation}
                          enableButtons={enableButtons && isLastMessage}
                          streamMessages={message.loading ? streamMessages : []}
                          apiBaseUrl={apiBaseUrl}
                          apiKey={apiKey}
                          agencyId={agencyId}
                          currentLanguage={currentLanguage}
                          onOpenGallery={openGallery}
                        />
                      )}
                    </div>

                    <div className="fusioni-message-footer">
                      {/* <span className="fusioni-message-role">
                        {message.role === 'user' ? '' : 'Fusioni'}
                      </span> */}
                      <span className="fusioni-message-time">
                        {formatDate(message.created)}
                      </span>
                      {message.id && (onDeleteMessage || (message.role === 'user' && onEditMessage)) && (
                        <div className="fusioni-message-actions">
                          {message.role === 'user' && editingMessageId === message.id ? (
                            <>
                              <button
                                onClick={confirmEdit}
                                className="fusioni-btn fusioni-btn-icon"
                                title="Save edit"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                  <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="fusioni-btn fusioni-btn-icon"
                                title="Cancel edit"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                  <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                  <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </button>
                            </>
                          ) : (
                            <>
                              {message.role === 'user' && onEditMessage && (
                                <button
                                  onClick={() => startEdit(message)}
                                  className="fusioni-btn fusioni-btn-icon"
                                  title="Edit message"
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                    <path d="M12 20H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M16.5 3.5C16.8978 3.10218 17.4374 2.87868 18 2.87868C18.5626 2.87868 19.1022 3.10218 19.5 3.5C19.8978 3.89782 20.1213 4.43739 20.1213 5C20.1213 5.56261 19.8978 6.10218 19.5 6.5L7 19L3 20L4 16L16.5 3.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </button>
                              )}
                              {onDeleteMessage && (
                                <button
                                  onClick={() => onDeleteMessage(message.id!)}
                                  className="fusioni-btn fusioni-btn-icon"
                                  title="Delete message"
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                    <path
                                      d="M3 6H5H21"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                    <path
                                      d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {showThoughts && message.thoughts && (
                      <div className="fusioni-message-thoughts">
                        <details>
                          <summary>Thoughts</summary>
                          <p>{message.thoughts}</p>
                        </details>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
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
        document.body
      )}
    </>
  );
};

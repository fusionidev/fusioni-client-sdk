import React, { useState } from 'react';
import { ConversationListProps } from '../types';
import { useTranslation } from '../hooks/useTranslation';
import { FUSIONI_LOGO_BASE64 } from '../assets/logo-base64';

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  selectedConversationId,
  onSelectConversation,
  onDeleteConversation,
  onCreateConversation,
  searchQuery = '',
  onSearchChange,
  isOpen = false,
  currentLanguage = 'en'
}) => {
  const [searchTerm, setSearchTerm] = useState(searchQuery);
  const { t } = useTranslation(currentLanguage);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    onSearchChange?.(value);
  };

  const filteredConversations = conversations
    .filter(conversation =>
      conversation.title.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      // Sort by created date in descending order (latest first)
      // If no created date, treat as oldest (put at bottom)
      const dateA = a.created ? new Date(a.created).getTime() : 0;
      const dateB = b.created ? new Date(b.created).getTime() : 0;
      return dateB - dateA;
    });

  const formatDate = (date: Date | null | undefined): string => {
    if (!date) return '';
    
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

  return (
    <div className={`fusioni-conversation-list ${isOpen ? 'open' : ''}`}>
      {/* Header */}
      <div className="fusioni-conversation-header">
        <div className="fusioni-conversation-title">
          <div className="fusioni-conversation-logo">
            <img 
              src={FUSIONI_LOGO_BASE64} 
              alt="Fusioni Logo" 
              width="32" 
              height="32"
            />
          </div>
          <div className="fusioni-conversation-info">
            <h3>{t('chat.title')}</h3>
            <p>{t('chat.subtitle')}</p>
          </div>
        </div>
        <button
          onClick={onCreateConversation}
          className="fusioni-btn fusioni-btn-icon"
          title={t('chat.conversations.newConversation')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 5V19M5 12H19"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* Search */}
      <div className="fusioni-conversation-search">
        <div className="fusioni-search-input">
          <input
            type="text"
            placeholder={t('chat.conversations.search')}
            value={searchTerm}
            onChange={handleSearchChange}
            className="fusioni-input"
          />
          <div className="fusioni-search-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle
                cx="11"
                cy="11"
                r="8"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M21 21L16.65 16.65"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="fusioni-divider" />

      {/* Conversations */}
      <div className="fusioni-conversations">
        {filteredConversations.length === 0 ? (
          <div className="fusioni-empty-state">
            <p>{t('chat.conversations.noConversations')}</p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="fusioni-btn fusioni-btn-text"
              >
{t('common.clear')}
              </button>
            )}
          </div>
        ) : (
          filteredConversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`fusioni-conversation-item ${
                conversation.id === selectedConversationId ? 'active' : ''
              }`}
              onClick={() => onSelectConversation(conversation)}
            >
              {/* Neural Network Background Animation */}
              <div className="fusioni-conversation-neural-bg">
                <div className="fusioni-neural-node fusioni-neural-node-1"></div>
                <div className="fusioni-neural-node fusioni-neural-node-2"></div>
                <div className="fusioni-neural-node fusioni-neural-node-3"></div>
                <div className="fusioni-neural-connection fusioni-neural-connection-1"></div>
                <div className="fusioni-neural-connection fusioni-neural-connection-2"></div>
              </div>

              <div className="fusioni-conversation-content">
                <div className="fusioni-conversation-main">
                  <div className="fusioni-conversation-title-section">
                    <h4 className="fusioni-conversation-title-text">
                      {conversation.title}
                      {!conversation.id && (
                        <span className="fusioni-conversation-temp-indicator" title={t('chat.conversations.newIndicator')}>
                          <div className="fusioni-new-badge">
                            <span className="fusioni-new-text">NEW</span>
                            <div className="fusioni-new-pulse"></div>
                          </div>
                        </span>
                      )}
                    </h4>
                    {conversation.created && (
                      <div className="fusioni-conversation-meta">
                        <div className="fusioni-conversation-date">
                          {formatDate(conversation.created)}
                        </div>
                        <div className="fusioni-conversation-status">
                          <div className="fusioni-status-dot"></div>
                          <span>Active</span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="fusioni-conversation-actions">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (conversation.id) {
                          onDeleteConversation(conversation.id);
                        }
                      }}
                      className="fusioni-btn fusioni-btn-icon fusioni-btn-danger fusioni-delete-btn"
                      title={t('chat.conversations.delete')}
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
                  </div>
                </div>
                
                {/* Data Flow Animation */}
                <div className="fusioni-conversation-data-flow">
                  <div className="fusioni-data-stream"></div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

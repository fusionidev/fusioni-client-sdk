// Main SDK exports
export { ChatWidget } from './components/ChatWidget';
export { ShadowDomRoot } from './components/ShadowDomRoot';
export type { ShadowDomRootProps } from './components/ShadowDomRoot';

// Component exports
export { FloatingButton } from './components/FloatingButton';
export { ChatPanel } from './components/ChatPanel';
export { ConversationList } from './components/ConversationList';
export { MessageList } from './components/MessageList';
export { Message } from './components/Message';
export { ChatInput } from './components/ChatInput';
export { FileUpload } from './components/FileUpload';
export { AudioRecorder } from './components/AudioRecorder';
export { LanguageSwitcher } from './components/LanguageSwitcher';
export { ChatLoader } from './components/ChatLoader';
export { Spotlight } from './components/Spotlight';
export type { SpotlightProps } from './components/Spotlight';
export { UrlPreview } from './components/UrlPreview';
export { Map } from './components/Map';
export { ImageGallery } from './components/ImageGallery';

// Service exports
export { ApiClient, getApiClient, initializeApiClient } from './services/ApiClient';
export { getConversationService } from './services/ConversationService';
export { PipelineService, getPipelineService } from './services/PipelineService';
export { MessageService, getMessageService } from './services/MessageService';
export {
  ActionService,
  getActionService,
  toActionSuggestion,
  resolveActionLiteral,
} from './services/ActionService';
export type { Action, ActionLiteral, ActionSuggestion } from './services/ActionService';

// Hook exports
export { useChatState } from './hooks/useChatState';
export { useSSE } from './hooks/useSSE';
export { useTheme } from './hooks/useTheme';
export { useTranslation } from './hooks/useTranslation';
export { useIsMobileLayout } from './hooks/useIsMobileLayout';

// i18n exports
export { getTranslation, getAvailableLanguages, isValidLanguage } from './i18n';
export type { Language, TranslationKeys } from './i18n';

// Type exports
export type {
  // Core types
  Conversation,
  FusioniMemoryMessage,
  Pipeline,
  PipelineRequest,
  PipelineResponse,
  Pagination,
  FusioniPayload,
  
  // Configuration types
  FusioniSDKConfig,
  FusioniChatWidgetHandle,
  ChatWidgetProps,
  MessageProps,
  ConversationListProps,
  ChatInputProps,
  ChatEvent,
  ConfirmationResult,
  
  // Utility types
  MessageRole,
  Theme,
  Position
} from './types';

// URL Preview types
export type { LinkPreviewData, UrlPreviewProps } from './components/UrlPreview';

// Map types
export type { MapProps } from './components/Map';

// Image gallery types
export type { ImageGalleryProps } from './components/ImageGallery';

// Default export
export { ChatWidget as default } from './components/ChatWidget';

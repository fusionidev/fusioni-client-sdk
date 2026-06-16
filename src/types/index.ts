// Core interfaces based on Angular services

export interface Pagination {
  page: number;
  size: number;
  total_items?: number;
  total_pages?: number;
  first?: boolean;
  last?: boolean;
}

export interface FusioniPayload<T> {
  body?: T[];
  pagination?: Pagination;
}

export interface Conversation {
  id?: string | null;
  agency_id: string;
  title: string;
  created?: Date | null;
  updated?: Date | null;
  messages?: FusioniMemoryMessage[] | null;
}

export interface FusioniMemoryMessage {
  id?: string;
  agency_id: string;
  conversation_id?: string;
  mem_type: string;
  has_error?: boolean;
  role: 'user' | 'assistant' | 'system';
  keywords: string[] | null;
  thoughts: string | string[] | Record<string, unknown> | null;
  created: Date;
  content: string;
  loading: boolean;
  shouldAnimate: boolean;
  extra_data?: {
    image?: string;
    image_ref?: string;
    image_base64?: boolean;
    audio_ref?: string;
    audio_base64?: boolean;
    duration?: number;
    coordinates?: {
      lat: number;
      lon: number;
      zoom?: number;
    };
    map?: {
      lat: string | number;
      lng: string | number;
      zoom?: string | number;
    };
    /** Assistant document page screenshots (opens shared image gallery) */
    document_images?: string[];
    [key: string]: any;
  };
}

export interface PipelineStep {
  name: string | null;
  agent_id: string | null;
  service_id: string | null;
  step_type: string | null;
}

export interface Pipeline {
  id?: string;
  name: string;
  description: string;
  code?: string;
  agency_id?: string | null;
  steps: PipelineStep[] | null;
  capability_ids: string[];
  active: boolean;
}

export interface PipelineRequest {
  conversation_id: string;
  agency_id: string;
  inp?: string | null;
  image?: string | ArrayBuffer | null;
  audio?: string | ArrayBuffer | null;
  message_id?: string | null;
  agent_id?: string | null;
  context?: any | null;
}

export interface PipelineResponse {
  answer: string[];
  context_data: any;
  thoughts: string[];
  messages: FusioniMemoryMessage[];
}

// SDK Configuration
export interface FusioniSDKConfig {
  apiBaseUrl: string;
  agencyId: string;
  accessToken?: string;
  theme?: 'light' | 'dark' | 'auto';
  showThemeToggle?: boolean;
  showFullscreenToggle?: boolean;
  showLanguageSwitcher?: boolean;
  showThoughts?: boolean;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  primaryColor?: string;
  showConversationList?: boolean;
  enableAudioRecording?: boolean;
  enableFileUpload?: boolean;
  maxFileSize?: number; // in MB
  allowedFileTypes?: string[];
  language?: 'en' | 'el';
  buttonVariant?: 'minimal' | 'glass' | 'solid';
}

// Component Props
export interface ChatWidgetProps {
  config: FusioniSDKConfig;
  onMessageSent?: (message: FusioniMemoryMessage) => void;
  onMessageReceived?: (message: FusioniMemoryMessage) => void;
  onConversationCreated?: (conversation: Conversation) => void;
  onConversationDeleted?: (conversationId: string) => void;
  onError?: (error: Error) => void;
}

export interface ConfirmationResult {
  confirmed: 'Confirmed' | 'NotConfirmed';
  key?: string;
}

export interface MessageProps {
  message: FusioniMemoryMessage;
  showThoughts?: boolean;
  fontSize?: string;
  onDelete?: (messageId: string) => void;
  onConfirmation?: (result: ConfirmationResult) => void;
  enableButtons?: boolean;
  apiBaseUrl?: string;
  apiKey?: string;
  agencyId: string;
  currentLanguage?: 'en' | 'el';
  /** Opens full-screen gallery (fusioni-web parity with `ImageGalleryComponent`) */
  onOpenGallery?: (payload: { images: string[]; index: number }) => void;
}

export interface ConversationListProps {
  conversations: Conversation[];
  selectedConversationId?: string;
  onSelectConversation: (conversation: Conversation) => void;
  onDeleteConversation: (conversationId: string) => void;
  onCreateConversation: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  isOpen?: boolean;
  currentLanguage?: 'en' | 'el';
}

export interface ChatInputProps {
  onSendMessage: (content: string, image?: string, audio?: string) => void;
  onFileUpload: (file: File) => Promise<string>;
  disabled?: boolean;
  placeholder?: string;
  enableAudioRecording?: boolean;
  enableFileUpload?: boolean;
  maxFileSize?: number;
  allowedFileTypes?: string[];
  currentLanguage?: 'en' | 'el';
}

// Event types
export interface ChatEvent {
  type: 'message_sent' | 'message_received' | 'conversation_created' | 'conversation_deleted' | 'error';
  data: any;
  timestamp: Date;
}

// Utility types
export type MessageRole = 'user' | 'assistant' | 'system';
export type Theme = 'light' | 'dark' | 'auto';
export type Position = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

/** Imperative API for `ChatWidget` ref and script-tag `Fusioni.init` / `Fusioni.mount` result */
export interface FusioniChatWidgetHandle {
  setLanguage: (language: 'en' | 'el') => void;
  setTheme: (theme: Theme) => void;
}

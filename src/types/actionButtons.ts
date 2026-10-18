import type {CSSProperties, ReactNode} from 'react';
import type {Language} from '../i18n';
import type {ApiClient} from '../services/ApiClient';
import type {Action} from '../services/ActionService';
import type {FusioniMemoryMessage} from './index';
import type {ConversationInputFieldData} from './conversationProfile';

export interface ActionResult {
  content: string;
  images: string[];
  links: string[];
  executionTimeMs?: number | null;
  output_variables?: Record<string, unknown>[] | null;
}

export type ActionInputFieldValues = Readonly<Record<string, Readonly<ConversationInputFieldData>>>;
export type ActionEnabledStates = Readonly<Record<string, boolean>>;
export type ActionExecutionState = 'idle' | 'loading' | 'success' | 'error';

export interface ActionButtonsProps {
  agencyId: string | null;
  tags?: readonly string[];
  apiBaseUrl?: string;
  accessToken?: string;
  apiClient?: ApiClient;
  currentLanguage?: Language;
  showRunButton?: boolean;
  showLoadingPanel?: boolean;
  showActionResult?: boolean;
  showButtonsPanel?: boolean;
  actionInputFieldValues?: ActionInputFieldValues;
  actionEnabledStates?: ActionEnabledStates;
  fullscreen?: boolean;
  /** Content shown beside the profile form in fullscreen mode. */
  sidePanel?: ReactNode;
  children?: ReactNode;
  hasFullscreenSidePanelContent?: boolean;
  /** @deprecated Use sidePanel or hasFullscreenSidePanelContent. */
  hasChatSidePanelContent?: boolean;
  /** Optional storage prefix; conversation IDs are always scoped by agency. */
  conversationStorageKey?: string;
  className?: string;
  style?: CSSProperties;
  onResponse?: (results: ActionResult[]) => void;
  onError?: (error: Error) => void;
  onFullscreenChange?: (fullscreen: boolean) => void;
}

export interface ActionButtonsHandle {
  readonly selectedAction: Action | null;
  readonly results: readonly ActionResult[];
  readonly conversationMessages: readonly FusioniMemoryMessage[];
  loadActions(): void;
  /** Runs immediately or opens the linked profile form. Accepts an action, ID, or key. */
  executeAction(action: Action | string): Promise<void>;
  submitFields(): Promise<void>;
  cancelFields(): void;
  startNewConversation(action?: Action | string): void;
}

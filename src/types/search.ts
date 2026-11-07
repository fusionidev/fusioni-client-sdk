import type {CSSProperties} from 'react';
import type {Language} from '../i18n';
import type {ApiClient} from '../services/ApiClient';

/** A FusionDataDTO returned by Fusion's data search endpoints. */
export interface SearchItem {
  id?: string | null;
  agency_id: string;
  name: string;
  content: string;
  storage_id: string;
  url?: string | null;
  images?: string[] | null;
  keywords?: string[] | null;
  language?: string | null;
  document_id?: string | null;
  chunk_title?: string | null;
  chunk_index?: number | null;
  hash_id?: string | null;
  embedding_model?: string | null;
  chunk_id?: string | null;
  symbol_id?: string | null;
  symbol_kind?: string | null;
  symbol_name?: string | null;
  mini_app_id?: string | null;
  source_target?: string | null;
  source_hash?: string | null;
  start_char?: number | null;
  end_char?: number | null;
  start_line?: number | null;
  end_line?: number | null;
}

/** Fusion permits null pagination fields as well as an entirely null pagination. */
export interface SearchPagination {
  page?: number | null;
  size?: number | null;
  total_items?: number | null;
  total_pages?: number | null;
  first?: boolean | null;
  last?: boolean | null;
}

export interface SearchResponse {
  body: SearchItem[];
  pagination: SearchPagination | null;
}

export interface SearchRequestOptions {
  /** Zero-based page number. Defaults to 0. */
  page?: number;
  /** Defaults to 25. Fusion currently limits autocomplete to 10 suggestions. */
  size?: number;
  signal?: AbortSignal;
}

export type SearchMode = 'autocomplete' | 'search';

export interface SearchProps {
  agencyId: string;
  apiBaseUrl?: string;
  accessToken?: string;
  apiClient?: ApiClient;
  /** Full search runs on submit; autocomplete runs while typing. Defaults to 'search'. */
  mode?: SearchMode;
  /** Bind to an existing input instead of rendering the SDK's search field. */
  inputElement?: string | HTMLInputElement;
  /** Render into this element instead of the default dropdown or inline results. */
  resultElement?: string | HTMLElement;
  pageSize?: number;
  /** Minimum trimmed query length. Defaults to 2. */
  minLength?: number;
  /** Autocomplete delay in milliseconds. Defaults to 250. */
  debounceMs?: number;
  placeholder?: string;
  label?: string;
  currentLanguage?: Language;
  theme?: 'light' | 'dark' | 'auto';
  className?: string;
  style?: CSSProperties;
  onResults?: (response: SearchResponse) => void;
  onError?: (error: Error) => void;
  /** Return false to handle selection yourself and prevent browser navigation. */
  onSelect?: (item: SearchItem) => boolean | void;
}

export interface SearchHandle {
  readonly results: readonly SearchItem[];
  readonly pagination: SearchPagination | null;
  /** Uses the current input value when query is omitted. Errors are delivered to onError. */
  search(query?: string, page?: number): Promise<void>;
  clear(): void;
  focus(): void;
}

import type {CSSProperties} from 'react';
import type {Language} from '../i18n';
import type {ApiClient} from '../services/ApiClient';

/** The fields the renderer consumes from an installed or published snapshot. */
export interface MiniApp {
  id?: string | null;
  mini_app_id?: string | null;
  name?: string;
  description?: string;
  version?: string;
  /** Legacy snapshot metadata; rendering uses bundle instead. */
  program?: string | null;
  bundle?: MiniAppBundle | null;
  position?: string[];
  tags?: string[];
  [field: string]: unknown;
}

export interface MiniAppRendererOptions {
  title?: string;
  rows?: number;
  label?: string;
  [option: string]: unknown;
}

/** File contents are served by the Mini App runtime, not embedded in snapshots. */
export interface MiniAppBundleFile {
  path: string;
  sha256: string;
  size: number;
}

/** The entry ES module must register this custom element at module top level. */
export interface MiniAppBundle {
  element: string;
  entry: string;
  backend?: string | null;
  files: MiniAppBundleFile[];
}

/** Configuration is assigned before connectedCallback runs. */
export interface MiniAppElement extends HTMLElement {
  context?: Readonly<MiniAppExecutionContext>;
  options?: MiniAppRendererOptions;
}

export interface MiniAppFilesContext {
  readonly base: string;
  url(path: string): string;
}

export type MiniAppBackendMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';
export type MiniAppBackendQueryValue = string | number | boolean;
export type MiniAppBackendResponseType = 'json' | 'text';
export type MiniAppRuntimeTarget = 'installed' | 'builder';

export interface MiniAppBackendRequest {
  method?: MiniAppBackendMethod;
  query?: Record<string, MiniAppBackendQueryValue>;
  headers?: Record<string, string>;
  body?: unknown;
  responseType?: MiniAppBackendResponseType;
  signal?: AbortSignal;
}

export interface MiniAppBackendClient {
  request<T = unknown>(path: string, request?: MiniAppBackendRequest): Promise<T>;
}

export interface MiniAppRuntimeContext extends Record<string, unknown> {
  miniAppId: string | null;
  agencyId: string | null;
  runtime: MiniAppRuntimeTarget;
  backend: MiniAppBackendClient;
}

export interface MiniAppExecutionContext extends Record<string, unknown> {
  lifecycle: Readonly<{signal: AbortSignal}>;
  files: Readonly<MiniAppFilesContext>;
  backend?: MiniAppBackendClient;
}

export interface MiniAppRendererProps {
  /** External custom-element container; collections use it only for a single result. */
  element?: HTMLElement | null;
  miniApp?: MiniApp | null;
  miniApps?: readonly MiniApp[] | null;
  agencyId?: string | null;
  /** Position takes precedence over tags, then miniApps. */
  position?: string | null;
  tags?: readonly string[] | null;
  /** Equal-width columns at 768px and above. Mobile always uses one column. */
  columns?: number;
  /** Read when starting or reloading; changes alone do not restart elements. */
  options?: MiniAppRendererOptions;
  context?: Record<string, unknown>;
  reloadable?: boolean;
  showStatus?: boolean;
  currentLanguage?: Language;
  /** API base URL, including /api, just like ChatWidget's configuration. */
  apiBaseUrl?: string;
  accessToken?: string;
  /** Optional client; otherwise use apiBaseUrl or the initialized SDK client. */
  apiClient?: ApiClient;
  className?: string;
  style?: CSSProperties;
  onReady?: (element: MiniAppElement | null) => void;
  onFailed?: (error: Error) => void;
}

export interface MiniAppRendererHandle {
  /** Mounted custom element; null for collections, loading, or an empty host. */
  readonly api: MiniAppElement | null;
  /** Remounts the current element, or every child element in a collection. */
  run(): Promise<void>;
  /** Reloads a position/tag query. Does nothing for a supplied collection. */
  loadMiniApps(): void;
}

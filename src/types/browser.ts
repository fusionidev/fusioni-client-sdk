import type {FusioniChatWidgetHandle, FusioniSDKConfig} from './index';
import type {MiniAppRendererHandle, MiniAppRendererProps} from './miniApp';
import type {ActionButtonsHandle, ActionButtonsProps} from './actionButtons';
import type {SearchHandle, SearchProps} from './search';

export type FusioniScriptConfig = FusioniSDKConfig;
export type FusioniContainer = string | HTMLElement;

export interface FusioniMountResult extends FusioniChatWidgetHandle {
  unmount(): void;
}

export interface FusioniMiniAppMountResult extends MiniAppRendererHandle {
  unmount(): void;
}

export interface FusioniActionButtonsMountResult extends ActionButtonsHandle {
  unmount(): void;
}

export interface FusioniSearchMountResult extends SearchHandle {
  unmount(): void;
}

export type FusioniSearchOptions = Omit<SearchProps, 'agencyId'> & {agencyId?: string};
export type FusioniActionButtonsOptions = Omit<ActionButtonsProps, 'agencyId'> & {agencyId?: string | null};

/** Initialized SDK. Mount methods return this same instance so calls can be chained. */
export interface FusioniSDKInstance {
  /** Mount the floating chat widget with optional configuration overrides. */
  chatWidget(config?: Partial<FusioniScriptConfig>): FusioniSDKInstance;
  /** Mount chat in a specific container. */
  chatWidget(container: FusioniContainer, config?: Partial<FusioniScriptConfig>): FusioniSDKInstance;
  /** Mount chat in a container, or in the default floating placement when omitted. */
  mount(container?: FusioniContainer, config?: Partial<FusioniScriptConfig>): FusioniSDKInstance;
  search(container: FusioniContainer, props?: FusioniSearchOptions): FusioniSDKInstance;
  mountSearch(container: FusioniContainer, props?: FusioniSearchOptions): FusioniSDKInstance;
  mountMiniApp(container: FusioniContainer, props?: MiniAppRendererProps): FusioniSDKInstance;
  mountActionButtons(container: FusioniContainer, props?: FusioniActionButtonsOptions): FusioniSDKInstance;
  getChatWidget(container?: FusioniContainer): FusioniMountResult | null;
  getSearch(container: FusioniContainer): FusioniSearchMountResult | null;
  getMiniApp(container: FusioniContainer): FusioniMiniAppMountResult | null;
  getActionButtons(container: FusioniContainer): FusioniActionButtonsMountResult | null;
  /** Unmount one container, or every feature owned by this instance when omitted. */
  unmount(container?: FusioniContainer): void;
}

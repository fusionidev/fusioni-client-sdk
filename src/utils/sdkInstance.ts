import {ApiClient, initializeApiClient} from '../services/ApiClient';
import type {MiniAppRendererProps} from '../types/miniApp';
import type {ActionButtonsProps} from '../types/actionButtons';
import type {SearchProps} from '../types/search';
import type {
  FusioniContainer, FusioniScriptConfig, FusioniSDKInstance, FusioniMountResult,
  FusioniSearchMountResult, FusioniMiniAppMountResult, FusioniActionButtonsMountResult,
} from '../types/browser';

const DEFAULT_ROOT_ID = 'fusioni-chat-root';

interface MountFunctions {
  mount(container: FusioniContainer, config: FusioniScriptConfig): FusioniMountResult;
  mountSearch(container: FusioniContainer, props: SearchProps): FusioniSearchMountResult;
  mountMiniApp(container: FusioniContainer, props: MiniAppRendererProps): FusioniMiniAppMountResult;
  mountActionButtons(container: FusioniContainer, props: ActionButtonsProps): FusioniActionButtonsMountResult;
}

type MountedFeature =
  | {kind: 'chat'; handle: FusioniMountResult}
  | {kind: 'search'; handle: FusioniSearchMountResult}
  | {kind: 'miniApp'; handle: FusioniMiniAppMountResult}
  | {kind: 'actionButtons'; handle: FusioniActionButtonsMountResult};

function findContainer(container: FusioniContainer): HTMLElement | null {
  const element = typeof container === 'string' ? document.querySelector(container) : container;
  return element instanceof HTMLElement ? element : null;
}

export function getContainer(container: FusioniContainer): HTMLElement {
  const element = findContainer(container);
  if (!element) throw new Error(`Fusioni SDK: container "${container}" not found or not an HTMLElement.`);
  return element;
}

function createDefaultRoot(): HTMLElement {
  let root = document.getElementById(DEFAULT_ROOT_ID);
  if (!root) {
    root = document.createElement('div');
    root.id = DEFAULT_ROOT_ID;
    document.body.appendChild(root);
  }
  return root;
}

/** Keep each initialized SDK's connection and mount ownership independent. */
export function createSDKInstance(config: FusioniScriptConfig, mounting: MountFunctions): FusioniSDKInstance {
  if (!config?.apiBaseUrl?.trim() || !config?.agencyId?.trim()) {
    throw new Error('Fusioni SDK: init requires apiBaseUrl and agencyId.');
  }
  const defaults = {...config};
  const apiClient = initializeApiClient(defaults.apiBaseUrl, defaults.accessToken, defaults.agencyId);
  const mounted = new Map<HTMLElement, MountedFeature>();

  function featureProps<T extends Pick<MiniAppRendererProps, 'apiBaseUrl' | 'accessToken' | 'apiClient' | 'agencyId' | 'currentLanguage'>>(props: T) {
    const baseUrl = props.apiBaseUrl ?? defaults.apiBaseUrl;
    const token = props.accessToken ?? defaults.accessToken;
    const agencyId = props.agencyId === undefined ? defaults.agencyId : props.agencyId;
    const client = props.apiClient ?? (baseUrl === defaults.apiBaseUrl && token === defaults.accessToken && agencyId === defaults.agencyId
      ? apiClient : new ApiClient(baseUrl, token, agencyId ?? undefined));
    return {
      ...props,
      apiClient: client,
      apiBaseUrl: props.apiBaseUrl ?? client.getBaseUrl(),
      accessToken: props.accessToken ?? client.getAccessToken(),
      currentLanguage: props.currentLanguage ?? defaults.language,
    };
  }

  function lookup(container: FusioniContainer): MountedFeature | undefined {
    const target = findContainer(container);
    return target ? mounted.get(target) : undefined;
  }

  const sdk: FusioniSDKInstance = {
    chatWidget(containerOrConfig?: FusioniContainer | Partial<FusioniScriptConfig>, overrides: Partial<FusioniScriptConfig> = {}) {
      if (typeof containerOrConfig === 'string' || containerOrConfig instanceof HTMLElement) {
        return sdk.mount(containerOrConfig, overrides);
      }
      return sdk.mount(undefined, containerOrConfig);
    },
    mount(container, overrides = {}) {
      const target = container === undefined ? createDefaultRoot() : getContainer(container);
      const handle = mounting.mount(target, {...defaults, ...overrides});
      mounted.set(target, {kind: 'chat', handle});
      return sdk;
    },
    search(container, props = {}) {
      const target = getContainer(container);
      const handle = mounting.mountSearch(target, {
        ...featureProps(props), agencyId: props.agencyId ?? defaults.agencyId, theme: props.theme ?? defaults.theme,
      });
      mounted.set(target, {kind: 'search', handle});
      return sdk;
    },
    mountSearch(container, props) {return sdk.search(container, props);},
    mountMiniApp(container, props = {}) {
      const target = getContainer(container);
      const handle = mounting.mountMiniApp(target, {...featureProps(props), agencyId: props.agencyId === undefined ? defaults.agencyId : props.agencyId});
      mounted.set(target, {kind: 'miniApp', handle});
      return sdk;
    },
    mountActionButtons(container, props = {}) {
      const target = getContainer(container);
      const handle = mounting.mountActionButtons(target, {...featureProps(props), agencyId: props.agencyId === undefined ? defaults.agencyId : props.agencyId});
      mounted.set(target, {kind: 'actionButtons', handle});
      return sdk;
    },
    getChatWidget(container = `#${DEFAULT_ROOT_ID}`) {
      const feature = lookup(container);
      return feature?.kind === 'chat' ? feature.handle : null;
    },
    getSearch(container) {
      const feature = lookup(container);
      return feature?.kind === 'search' ? feature.handle : null;
    },
    getMiniApp(container) {
      const feature = lookup(container);
      return feature?.kind === 'miniApp' ? feature.handle : null;
    },
    getActionButtons(container) {
      const feature = lookup(container);
      return feature?.kind === 'actionButtons' ? feature.handle : null;
    },
    unmount(container) {
      if (container === undefined) {
        mounted.forEach(feature => feature.handle.unmount());
        mounted.clear();
      } else {
        const target = findContainer(container);
        if (!target) return;
        mounted.get(target)?.handle.unmount();
        mounted.delete(target);
      }
    },
  };
  return sdk;
}

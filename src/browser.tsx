/**
 * Browser / script-tag entry point for Fusioni SDK.
 * Use when including via <script src="path/to/fusioni-sdk.umd.js"></script>.
 * Built as IIFE (not UMD) so `Fusioni` is always set on the global object even when
 * outer scopes define CommonJS `module`/`exports` (e.g. some app bundlers).
 * Exposes window.Fusioni with init() and mount().
 */
declare const __FUSIONI_SDK_VERSION__: string;

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { ChatWidget } from './components/ChatWidget';
import { MiniAppRenderer } from './components/MiniAppRenderer';
import { ActionButtons } from './components/ActionButtons';
import { ShadowDomRoot } from './components/ShadowDomRoot';
import type { FusioniChatWidgetHandle, FusioniSDKConfig } from './types';
import type { MiniAppRendererHandle, MiniAppRendererProps } from './types/miniApp';
import type {ActionButtonsHandle, ActionButtonsProps} from './types/actionButtons';

const DEFAULT_ROOT_ID = 'fusioni-chat-root';

export interface FusioniScriptConfig extends FusioniSDKConfig {}

export interface FusioniMountResult {
  unmount: () => void;
  setLanguage: FusioniChatWidgetHandle['setLanguage'];
  setTheme: FusioniChatWidgetHandle['setTheme'];
}

export interface FusioniMiniAppMountResult extends MiniAppRendererHandle {
  unmount(): void;
}

export interface FusioniActionButtonsMountResult extends ActionButtonsHandle {
  unmount(): void;
}

function getContainer(container: string | HTMLElement): HTMLElement {
  if (typeof container === 'string') {
    const el = document.querySelector(container);
    if (!el || !(el instanceof HTMLElement)) {
      throw new Error(`Fusioni SDK: container "${container}" not found or not an HTMLElement.`);
    }
    return el;
  }
  if (container && container instanceof HTMLElement) {
    return container;
  }
  throw new Error('Fusioni SDK: container must be a CSS selector string or an HTMLElement.');
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

const mountedRoots = new Map<HTMLElement, Root>();

/**
 * Mount the chat widget into a container.
 * The widget is rendered inside a Shadow DOM for style isolation from the host page.
 *
 * @param container - CSS selector (e.g. '#chat') or HTMLElement
 * @param config - Fusioni SDK configuration
 * @returns Object with unmount() to tear down the widget
 */
function mount(
  container: string | HTMLElement,
  config: FusioniScriptConfig
): FusioniMountResult {
  const target = getContainer(container);
  const root = createRoot(target);
  mountedRoots.set(target, root);
  const widgetRef = React.createRef<FusioniChatWidgetHandle>();
  root.render(React.createElement(ChatWidget, { config, ref: widgetRef }));

  return {
    unmount() {
      root.unmount();
      mountedRoots.delete(target);
    },
    setLanguage(language) {
      widgetRef.current?.setLanguage(language);
    },
    setTheme(theme) {
      widgetRef.current?.setTheme(theme);
    },
  };
}

/**
 * Initialize the chat widget with default placement (floating, bottom-right).
 * Creates a div#fusioni-chat-root and mounts the widget there.
 * @param config - Fusioni SDK configuration
 * @returns Object with unmount() to tear down the widget
 */
function init(config: FusioniScriptConfig): FusioniMountResult {
  const rootEl = createDefaultRoot();
  return mount(rootEl, config);
}

/** Mount one Mini App or a collection, with the same props as the React renderer. */
function mountMiniApp(
  container: string | HTMLElement,
  props: MiniAppRendererProps,
): FusioniMiniAppMountResult {
  const target = getContainer(container);
  mountedRoots.get(target)?.unmount();
  const root = createRoot(target);
  mountedRoots.set(target, root);
  const rendererRef = React.createRef<MiniAppRendererHandle>();
  root.render(
    <ShadowDomRoot>
      <MiniAppRenderer {...props} ref={rendererRef} />
    </ShadowDomRoot>,
  );
  return {
    get api() { return rendererRef.current?.api ?? null; },
    run: () => rendererRef.current?.run() ?? Promise.resolve(),
    loadMiniApps: () => rendererRef.current?.loadMiniApps(),
    unmount() {
      if (mountedRoots.get(target) !== root) return;
      root.unmount();
      mountedRoots.delete(target);
    },
  };
}

/** Mount tagged actions with isolated styles and the React component's imperative API. */
function mountActionButtons(container: string | HTMLElement, props: ActionButtonsProps): FusioniActionButtonsMountResult {
  const target = getContainer(container);
  mountedRoots.get(target)?.unmount();
  const root = createRoot(target);
  mountedRoots.set(target, root);
  const actionRef = React.createRef<ActionButtonsHandle>();
  root.render(<ShadowDomRoot><ActionButtons {...props} ref={actionRef} /></ShadowDomRoot>);
  return {
    get selectedAction() { return actionRef.current?.selectedAction ?? null; },
    get results() { return actionRef.current?.results ?? []; },
    get conversationMessages() { return actionRef.current?.conversationMessages ?? []; },
    loadActions: () => actionRef.current?.loadActions(),
    executeAction: action => actionRef.current?.executeAction(action) ?? Promise.resolve(),
    submitFields: () => actionRef.current?.submitFields() ?? Promise.resolve(),
    cancelFields: () => actionRef.current?.cancelFields(),
    startNewConversation: action => actionRef.current?.startNewConversation(action),
    unmount() {
      if (mountedRoots.get(target) !== root) return;
      root.unmount();
      mountedRoots.delete(target);
    },
  };
}

const Fusioni = {
  init,
  mount,
  mountMiniApp,
  mountActionButtons,
  version: __FUSIONI_SDK_VERSION__,
};

if (typeof window !== 'undefined') {
  (window as unknown as { Fusioni: typeof Fusioni }).Fusioni = Fusioni;
}

export default Fusioni;

/**
 * Browser / script-tag entry point for Fusioni SDK.
 * Use when including via <script src="path/to/fusioni-sdk.umd.js"></script>.
 * Built as IIFE (not UMD) so `Fusioni` is always set on the global object even when
 * outer scopes define CommonJS `module`/`exports` (e.g. some app bundlers).
 * Exposes window.Fusioni with chainable init() and standalone mount methods.
 */
declare const __FUSIONI_SDK_VERSION__: string;

import React from 'react';
import {flushSync} from 'react-dom';
import { createRoot, Root } from 'react-dom/client';
import { ChatWidget } from './components/ChatWidget';
import { MiniAppRenderer } from './components/MiniAppRenderer';
import { ActionButtons } from './components/ActionButtons';
import { Search } from './components/Search';
import { ShadowDomRoot } from './components/ShadowDomRoot';
import type { FusioniChatWidgetHandle } from './types';
import type { MiniAppRendererHandle, MiniAppRendererProps } from './types/miniApp';
import type {ActionButtonsHandle, ActionButtonsProps} from './types/actionButtons';
import type {SearchHandle, SearchProps} from './types/search';
import {resolveSearchElement} from './utils/searchElements';
import {createSDKInstance, getContainer} from './utils/sdkInstance';
import type {
  FusioniScriptConfig, FusioniSDKInstance, FusioniMountResult, FusioniSearchMountResult,
  FusioniMiniAppMountResult, FusioniActionButtonsMountResult,
} from './types/browser';
export type {
  FusioniScriptConfig, FusioniContainer, FusioniSDKInstance, FusioniMountResult, FusioniSearchMountResult,
  FusioniMiniAppMountResult, FusioniActionButtonsMountResult, FusioniSearchOptions, FusioniActionButtonsOptions,
} from './types/browser';

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
  mountedRoots.get(target)?.unmount();
  const root = createRoot(target);
  mountedRoots.set(target, root);
  const widgetRef = React.createRef<FusioniChatWidgetHandle>();
  root.render(React.createElement(ChatWidget, { config, ref: widgetRef }));

  return {
    unmount() {
      if (mountedRoots.get(target) !== root) return;
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
 * Initialize shared SDK settings without mounting UI. Each feature method returns
 * this instance, allowing init(config).search(...).mountMiniApp(...).
 */
function init(config: FusioniScriptConfig): FusioniSDKInstance {
  return createSDKInstance(config, {mount, mountSearch, mountMiniApp, mountActionButtons});
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

/** Mount Search. Result portals preserve the contents of any supplied result element. */
function mountSearch(container: string | HTMLElement, props: SearchProps): FusioniSearchMountResult {
  const target = getContainer(container);
  // Validate bindings before replacing a previous mount.
  const inputElement = props.inputElement ? resolveSearchElement(props.inputElement, true) : undefined;
  const resultElement = props.resultElement ? resolveSearchElement(props.resultElement) : undefined;
  if (target === inputElement || (inputElement && target.contains(inputElement))) {
    throw new Error('Fusioni Search: mount into a separate container so the bound input is preserved.');
  }
  if (resultElement && resultElement !== target && target.contains(resultElement)) {
    throw new Error('Fusioni Search: resultElement must be outside the mounting container or be the container itself.');
  }
  mountedRoots.get(target)?.unmount();
  const root = createRoot(target);
  mountedRoots.set(target, root);
  const searchRef = React.createRef<SearchHandle>();
  flushSync(() => root.render(<Search {...props} inputElement={inputElement} resultElement={resultElement} ref={searchRef} />));
  return {
    get results() {return searchRef.current?.results ?? [];},
    get pagination() {return searchRef.current?.pagination ?? null;},
    search: (query, page) => searchRef.current?.search(query, page) ?? Promise.resolve(),
    clear: () => searchRef.current?.clear(),
    focus: () => searchRef.current?.focus(),
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
  mountSearch,
  version: __FUSIONI_SDK_VERSION__,
};

if (typeof window !== 'undefined') {
  (window as unknown as { Fusioni: typeof Fusioni }).Fusioni = Fusioni;
}

export default Fusioni;

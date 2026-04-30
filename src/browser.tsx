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
import type { FusioniSDKConfig } from './types';
import './styles/index.css';

const DEFAULT_ROOT_ID = 'fusioni-chat-root';

export interface FusioniScriptConfig extends FusioniSDKConfig {}

export interface FusioniMountResult {
  unmount: () => void;
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
 * @param container - CSS selector (e.g. '#chat') or HTMLElement
 * @param config - Fusioni SDK configuration
 * @returns Object with unmount() to tear down the widget
 */
function mount(
  container: string | HTMLElement,
  config: FusioniScriptConfig
): FusioniMountResult {
  const el = getContainer(container);
  const root = createRoot(el);
  mountedRoots.set(el, root);
  root.render(React.createElement(ChatWidget, { config }));

  return {
    unmount() {
      root.unmount();
      mountedRoots.delete(el);
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

const Fusioni = {
  init,
  mount,
  version: __FUSIONI_SDK_VERSION__,
};

if (typeof window !== 'undefined') {
  (window as unknown as { Fusioni: typeof Fusioni }).Fusioni = Fusioni;
}

export default Fusioni;

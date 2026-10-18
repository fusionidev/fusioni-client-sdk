import {MiniAppBackendService} from '../services/MiniAppBackendService';
import type {MiniApp, MiniAppBackendClient, MiniAppBackendRequest, MiniAppBundle, MiniAppElement, MiniAppExecutionContext, MiniAppRendererOptions} from '../types/miniApp';

/** A custom element cannot be redefined; keep its entry URL even after unmount. */
const definedElements = new Map<string, string>();
const loadingElements = new Map<string, {url: string; promise: Promise<void>}>();
const asError = (error: unknown): Error => error instanceof Error ? error : new Error(String(error));

function bundleVersion(bundle: MiniAppBundle): string {
  return [bundle.element, bundle.entry, ...(bundle.files || []).map(file => `${file.path}:${file.sha256}`).sort()].join('\n');
}

function isBackendClient(value: unknown): value is MiniAppBackendClient {
  return !!value && typeof value === 'object' && typeof (value as {request?: unknown}).request === 'function';
}

interface MiniAppRun {
  rootElement: HTMLElement;
  miniApp?: MiniApp | null;
  agencyId?: string | null;
  options: MiniAppRendererOptions;
  context: Record<string, unknown>;
  backendService: MiniAppBackendService;
}

/** Owns native custom-element lifecycle independently of React's render cycle. */
export class MiniAppElementRuntime {
  api: MiniAppElement | null = null;
  private controller: AbortController | null = null;
  private renderedInto: HTMLElement | null = null;
  private runId = 0;

  constructor(private readonly onReady: (element: MiniAppElement) => void, private readonly onFailed: (error: Error) => void) {}

  run(run: MiniAppRun): Promise<void> {
    this.stop(true);
    const runId = ++this.runId;
    const bundle = run.miniApp?.bundle;
    if (!run.miniApp || !bundle?.element || !bundle.entry) return Promise.resolve();
    const controller = new AbortController();
    this.controller = controller;
    this.renderedInto = run.rootElement;
    return this.mount(runId, run, bundle, controller.signal).catch(error => {
      if (runId === this.runId && !controller.signal.aborted) this.onFailed(asError(error));
    });
  }

  private async mount(runId: number, run: MiniAppRun, bundle: MiniAppBundle, signal: AbortSignal): Promise<void> {
    const context = this.executionContext(run, signal);
    const target = context.runtime === 'builder' ? 'builder' : 'installed';
    const agencyId = typeof context.agencyId === 'string' ? context.agencyId : run.agencyId;
    const base = await run.backendService.filesBase(run.miniApp!.mini_app_id || run.miniApp!.id, agencyId, target, bundleVersion(bundle));
    if (runId !== this.runId || signal.aborted) return;

    const entryUrl = base + bundle.entry;
    await this.ensureElement(bundle, entryUrl);
    if (runId !== this.runId || signal.aborted) return;

    const element = document.createElement(bundle.element) as MiniAppElement;
    element.context = Object.freeze({...context, files: Object.freeze({
      base, url: (path: string) => base + String(path).replace(/^\/+/, ''),
    })});
    element.options = run.options;
    run.rootElement.replaceChildren(element);
    if (runId !== this.runId || signal.aborted) { element.remove(); return; }
    this.api = element;
    this.onReady(element);
  }

  private async ensureElement(bundle: MiniAppBundle, entryUrl: string): Promise<void> {
    const definedFrom = definedElements.get(bundle.element);
    const loading = loadingElements.get(bundle.element);
    if ((definedFrom && definedFrom !== entryUrl) || (loading && loading.url !== entryUrl)) {
      throw new Error(`Another version of <${bundle.element}> already runs on this page. Reload the page to run this one.`);
    }
    // Share pending imports so one instance does not mistake another instance's
    // registration for a host-owned element before the import has settled.
    if (loading) return loading.promise;
    if (!definedFrom && customElements.get(bundle.element)) {
      throw new Error(`<${bundle.element}> is already defined by another part of this page.`);
    }
    const promise = Promise.resolve().then(() => this.importModule(entryUrl)).then(() => {
      if (!customElements.get(bundle.element)) {
        throw new Error(`${bundle.entry} did not define the custom element <${bundle.element}>. `
          + `Call customElements.define('${bundle.element}', …) at the top level of the module, `
          + 'not in a DOMContentLoaded or load listener; exporting the class is not enough.');
      }
      // Importing cannot be cancelled: remember registrations even for a stale run.
      definedElements.set(bundle.element, entryUrl);
    });
    loadingElements.set(bundle.element, {url: entryUrl, promise});
    try { await promise; }
    finally { loadingElements.delete(bundle.element); }
  }

  /** Keep a native URL import so relative imports and import.meta.url assets work. */
  protected importModule(url: string): Promise<unknown> {
    return import(/* webpackIgnore: true */ /* @vite-ignore */ url);
  }

  stop(reportFailure = false): void {
    this.runId += 1;
    this.controller?.abort();
    this.controller = null;
    this.api = null;
    const renderedInto = this.renderedInto;
    this.renderedInto = null;
    try { renderedInto?.replaceChildren(); }
    catch (error) { if (reportFailure) this.onFailed(asError(error)); }
  }

  private executionContext(run: MiniAppRun, signal: AbortSignal): Record<string, unknown> & Pick<MiniAppExecutionContext, 'lifecycle' | 'backend'> {
    let context = run.context;
    if (!isBackendClient(context.backend)) {
      context = {...context, ...run.backendService.createContext(run.miniApp!.mini_app_id || run.miniApp!.id,
        run.agencyId || (typeof context.agencyId === 'string' ? context.agencyId : null))};
    }
    const lifecycle = Object.freeze({signal});
    const backend = context.backend;
    if (!isBackendClient(backend)) return Object.freeze({...context, lifecycle});
    return Object.freeze({...context, lifecycle, backend: Object.freeze({
      request: <T = unknown>(path: string, request: MiniAppBackendRequest = {}): Promise<T> => backend.request<T>(path, {...request, signal}),
    })});
  }
}

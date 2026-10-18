const React = require('react');
const {createRoot} = require('react-dom/client');
const act = React.act ?? require('react-dom/test-utils').act;
const {MiniAppRenderer} = require('../src/components/MiniAppRenderer');
const {MiniAppBackendService} = require('../src/services/MiniAppBackendService');
const {installMiniAppModules, deferred} = require('./mini-app-helpers.cjs');
global.IS_REACT_ACT_ENVIRONMENT = true;

describe('MiniAppRenderer web components', () => {
  let container, root, ref, modules, snapshot;
  beforeEach(() => {
    container = document.createElement('div'); document.body.appendChild(container);
    root = createRoot(container); ref = React.createRef(); modules = installMiniAppModules(); snapshot = modules.snapshot;
  });
  afterEach(async () => {await act(async () => root.unmount()); container.remove(); jest.restoreAllMocks();});
  async function render(props, strict = false) {
    await act(async () => {const renderer = React.createElement(MiniAppRenderer, {...props, ref});
      root.render(strict ? React.createElement(React.StrictMode, null, renderer) : renderer);});
  }
  function host() {return container.querySelector('[data-mini-app-host]');}

  it('imports the bundle module and exposes the mounted custom element', async () => {
    const miniApp = snapshot('example'), onReady = jest.fn();
    await render({miniApp, agencyId: 'agency', onReady});
    expect(host().firstElementChild.localName).toBe(miniApp.bundle.element);
    expect(host().textContent).toBe('example'); expect(ref.current.api).toBe(host().firstElementChild);
    expect(onReady).toHaveBeenCalledWith(ref.current.api);
    expect(modules.filesBase).toHaveBeenCalledWith('example', 'agency', 'installed', expect.stringContaining('frontend/index.js:'));
    expect(modules.importModule).toHaveBeenCalledWith(`/api/mini-app-files/${miniApp.bundle.element}/frontend/index.js`);
  });

  it('does not evaluate legacy programs or mount snapshots without complete bundles', async () => {
    const evaluate = jest.spyOn(global, 'Function'), onReady = jest.fn();
    await render({miniApp: {id: 'legacy', program: 'throw new Error("never run")'}, program: 'throw new Error("never run")', onReady});
    expect(host().children).toHaveLength(0); expect(evaluate).not.toHaveBeenCalled(); expect(onReady).not.toHaveBeenCalled();
    expect(container.textContent).toContain('This mini app has no web component bundle yet.');
    expect(container.querySelector('[data-reload]').disabled).toBe(true); expect(modules.filesBase).not.toHaveBeenCalled();
    await render({miniApp: {id: 'incomplete', bundle: {element: 'empty-entry', entry: ''}}}); expect(modules.filesBase).not.toHaveBeenCalled();
  });

  it('sets options, frozen context and file helpers before connectedCallback', async () => {
    let connectedContext, connectedOptions;
    const miniApp = snapshot('configuration', '', element => {
      connectedContext = element.context; connectedOptions = element.options;
      element.textContent = `${element.options.title}:${element.context.locale}:${element.context.miniAppId}:${element.context.files.url('/frontend/logo.svg')}`;
    });
    const options = {title: 'Reports', rows: 25}; await render({miniApp, agencyId: 'agency', options, context: {locale: 'el'}});
    expect(connectedOptions).toBe(options); expect(Object.isFrozen(connectedContext)).toBe(true);
    expect(Object.isFrozen(connectedContext.lifecycle)).toBe(true); expect(Object.isFrozen(connectedContext.files)).toBe(true);
    expect(host().textContent).toBe(`Reports:el:configuration:/api/mini-app-files/${miniApp.bundle.element}/frontend/logo.svg`);
  });

  it('reads new options and context on deliberate reload, disconnecting the prior element', async () => {
    const disconnected = jest.fn(), onReady = jest.fn();
    const miniApp = snapshot('reload', '', element => {element.textContent = `${element.options.label}:${element.context.locale}`;}, disconnected);
    await render({miniApp, options: {label: 'one'}, context: {locale: 'en'}, onReady}); const first = ref.current.api;
    await render({miniApp, options: {label: 'two'}, context: {locale: 'el'}, onReady});
    expect(ref.current.api).toBe(first); expect(host().textContent).toBe('one:en'); expect(onReady).toHaveBeenCalledTimes(1);
    await act(async () => container.querySelector('[data-reload]').click());
    expect(host().textContent).toBe('two:el'); expect(ref.current.api).not.toBe(first); expect(disconnected).toHaveBeenCalledTimes(1);
    expect(first.context.lifecycle.signal.aborted).toBe(true);
  });

  it('aborts the lifecycle before disconnectedCallback on reload and React unmount', async () => {
    const cancelled = [], miniApp = snapshot('cleanup-order', 'cleanup', undefined, element => cancelled.push(element.context.lifecycle.signal.aborted));
    await render({miniApp}); await act(async () => ref.current.run()); await act(async () => root.unmount()); expect(cancelled).toEqual([true, true]);
  });

  it('moves between external containers and clears them on unmount', async () => {
    const first = document.createElement('section'), second = document.createElement('section'); document.body.append(first, second);
    try {
      const miniApp = snapshot('external'); await render({miniApp, element: first}); expect(first.textContent).toBe('external'); expect(host().hidden).toBe(true);
      await render({miniApp, element: second}); expect(first.textContent).toBe(''); expect(second.textContent).toBe('external');
      await act(async () => root.unmount()); expect(second.textContent).toBe('');
    } finally {first.remove(); second.remove();}
  });

  it('uses builder files and preserves the supplied backend with run-scoped cancellation', async () => {
    const request = jest.fn().mockResolvedValue({ok: true}); let context;
    const miniApp = snapshot('catalog', '', element => {context = element.context; void context.backend.request('/health', {signal: new AbortController().signal});});
    miniApp.mini_app_id = 'app-one'; const builder = new MiniAppBackendService({request}).createBuilderContext('app-one', 'builder-agency');
    await render({miniApp, agencyId: 'other-agency', context: builder});
    expect(modules.filesBase).toHaveBeenCalledWith('app-one', 'builder-agency', 'builder', expect.any(String));
    expect(request.mock.calls[0][0]).toBe('/mini-app-runtime/builder/app-one/health'); expect(request.mock.calls[0][1].signal).toBe(context.lifecycle.signal);
    await act(async () => root.unmount()); expect(context.lifecycle.signal.aborted).toBe(true);
  });

  it('provides the installed backend using mini_app_id and context agency fallback', async () => {
    const apiClient = {request: jest.fn().mockResolvedValue({status: 'ready'})}; let context;
    const miniApp = snapshot('catalog-id', '', element => {context = element.context; void context.backend.request('/health');}); miniApp.mini_app_id = 'app-one';
    await render({miniApp, apiClient, context: {agencyId: 'agency-1', locale: 'el'}});
    expect(modules.filesBase).toHaveBeenCalledWith('app-one', 'agency-1', 'installed', expect.any(String));
    expect(context.miniAppId).toBe('app-one'); expect(context.locale).toBe('el'); expect(context.runtime).toBe('installed');
    expect(apiClient.request.mock.calls[0][0]).toBe('/mini-app-runtime/app-one/health'); expect(apiClient.request.mock.calls[0][1].params.get('agency_id')).toBe('agency-1');
  });

  it('reports missing registrations and failed file/module loads, then recovers', async () => {
    const onFailed = jest.fn(), miniApp = snapshot('errors'); modules.modules.set(`/api/mini-app-files/${miniApp.bundle.element}/frontend/index.js`, () => {});
    await render({miniApp, onFailed}); expect(container.querySelector('[role="alert"]').textContent).toContain('customElements.define');
    modules.filesBase.mockRejectedValueOnce(new Error('Files unavailable')); await act(async () => ref.current.run());
    expect(container.querySelector('[role="alert"]').textContent).toContain('Files unavailable');
    await render({miniApp: snapshot('recovered'), onFailed}); expect(container.querySelector('[role="alert"]')).toBeNull();
    modules.importModule.mockRejectedValueOnce(new TypeError('Module could not be fetched')); await render({miniApp: snapshot('failed-import'), onFailed});
    expect(container.querySelector('[role="alert"]').textContent).toContain('Module could not be fetched'); expect(onFailed).toHaveBeenCalledTimes(3);
  });

  it('rejects another version of a registered element and elements owned by the host page', async () => {
    const miniApp = snapshot('versions'); await render({miniApp}); modules.filesBase.mockResolvedValueOnce('/api/mini-app-files/another-version/');
    await render({miniApp: {...miniApp, bundle: {...miniApp.bundle, files: [{path: 'frontend/index.js', sha256: 'v2', size: 1}]}}});
    expect(container.querySelector('[role="alert"]').textContent).toContain('Reload the page'); expect(modules.importModule).toHaveBeenCalledTimes(1);
    const external = snapshot('host-element'); customElements.define(external.bundle.element, class extends HTMLElement {});
    await render({miniApp: external}); expect(container.querySelector('[role="alert"]').textContent).toContain('another part of this page'); expect(modules.importModule).toHaveBeenCalledTimes(1);
  });

  it('ignores late file URLs and cancelled module failures after replacement or unmount', async () => {
    const base = deferred(), module = deferred(), onFailed = jest.fn(), onReady = jest.fn();
    modules.filesBase.mockReturnValueOnce(base.promise); await render({miniApp: snapshot('late-files'), onFailed});
    await render({miniApp: snapshot('replacement'), onReady}); await act(async () => base.resolve('/api/late/'));
    expect(modules.importModule.mock.calls.some(call => call[0].includes('/late/'))).toBe(false);
    modules.importModule.mockReturnValueOnce(module.promise); await render({miniApp: snapshot('late-import'), onFailed, onReady}); await act(async () => root.unmount());
    await act(async () => module.reject(new Error('cancelled failure'))); expect(onFailed).not.toHaveBeenCalled(); expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('does not mount an element defined by an import that finishes after cancellation', async () => {
    const pending = deferred(), onReady = jest.fn(), miniApp = snapshot('late-registration');
    modules.importModule.mockImplementationOnce(async () => {await pending.promise; customElements.define(miniApp.bundle.element, class extends HTMLElement {});});
    await render({miniApp, onReady}); await act(async () => root.unmount()); await act(async () => pending.resolve());
    expect(onReady).not.toHaveBeenCalled(); expect(container.children).toHaveLength(0); expect(customElements.get(miniApp.bundle.element)).toBeDefined();
  });

  it('renders collections, reloads every child, and changes layout without restarting', async () => {
    const miniApps = [snapshot('Billing'), snapshot('Reports')], onReady = jest.fn(), external = document.createElement('div');
    document.body.appendChild(external);
    await render({miniApps, columns: 2.9, element: external, onReady}); expect(container.querySelectorAll('section')).toHaveLength(2);
    expect(Array.from(container.querySelectorAll('[data-mini-app-host]'), node => node.textContent)).toEqual(['Billing', 'Reports']);
    expect(external.textContent).toBe(''); expect(ref.current.api).toBeNull();
    await render({miniApps, columns: 3, onReady, options: {}, context: {}}); expect(onReady).toHaveBeenCalledTimes(2);
    expect(container.querySelector('.fusioni-mini-app-grid').style.getPropertyValue('--fusioni-mini-app-columns')).toBe('3');
    await act(async () => ref.current.run()); expect(onReady).toHaveBeenCalledTimes(4);
    await render({miniApps: [miniApps[0]], element: external}); expect(external.textContent).toBe('Billing'); expect(container.querySelector('h3')).toBeNull(); external.remove();
  });

  it('mounts the same web component in concurrent renderer instances without duplicate registration', async () => {
    const miniApp = snapshot('shared'), onReady = jest.fn(), onFailed = jest.fn();
    await act(async () => root.render(React.createElement(React.Fragment, null,
      React.createElement(MiniAppRenderer, {miniApp, onReady, onFailed}), React.createElement(MiniAppRenderer, {miniApp, onReady, onFailed}))));
    expect(container.querySelectorAll(miniApp.bundle.element)).toHaveLength(2); expect(onReady).toHaveBeenCalledTimes(2);
    expect(onFailed).not.toHaveBeenCalled(); expect(modules.importModule).toHaveBeenCalledTimes(1);
  });

  it.each([0, -4, NaN, Infinity])('normalizes invalid column counts: %s', async columns => {
    await render({miniApps: [snapshot('one')], columns}); expect(container.querySelector('.fusioni-mini-app-grid').style.getPropertyValue('--fusioni-mini-app-columns')).toBe('1');
  });

  it('loads by position before tags and supplied apps', async () => {
    const apiClient = {get: jest.fn().mockResolvedValue([snapshot('loaded')])};
    await render({apiClient, agencyId: 'agency', position: ' dashboard ', tags: ['billing'], miniApps: [snapshot('direct')]});
    expect(apiClient.get).toHaveBeenCalledTimes(1); expect(apiClient.get.mock.calls[0][0]).toBe('/mini-app-catalog/by-position');
    expect(apiClient.get.mock.calls[0][1].params).toEqual({agency_id: 'agency', position: 'dashboard'}); expect(host().textContent).toBe('loaded');
  });

  it('normalizes tags and avoids reloading for equivalent arrays', async () => {
    const apiClient = {get: jest.fn().mockResolvedValue([snapshot('billing')])};
    await render({apiClient, agencyId: 'agency', tags: [' billing ', 'billing', 'reports', ' '], miniApps: [snapshot('direct')]});
    expect(apiClient.get.mock.calls[0][0]).toBe('/mini-app/by-tags'); expect(apiClient.get.mock.calls[0][1].params.tags).toEqual(['billing', 'reports']);
    expect(apiClient.get.mock.calls[0][1].paramsSerializer).toEqual({indexes: null});
    await render({apiClient, agencyId: 'agency', tags: ['billing', 'reports']}); expect(apiClient.get).toHaveBeenCalledTimes(1);
    await render({apiClient, agencyId: 'agency', tags: ['reports']}); expect(apiClient.get).toHaveBeenCalledTimes(2);
  });

  it('requires an agency for queries and renders a standalone app with blank tags', async () => {
    const apiClient = {get: jest.fn()}; await render({apiClient, position: 'dashboard', miniApps: [snapshot('direct')]});
    expect(apiClient.get).not.toHaveBeenCalled(); expect(container.querySelector('section')).toBeNull();
    await render({apiClient, tags: [' '], miniApp: snapshot('standalone')}); expect(host().textContent).toBe('standalone');
  });

  it('shows loading, retries failed queries, and reports empty results', async () => {
    const response = deferred(), apiClient = {get: jest.fn().mockReturnValueOnce(response.promise).mockResolvedValue([])}, props = {apiClient, agencyId: 'agency', tags: ['billing']};
    await render(props); expect(container.querySelector('[aria-busy]').getAttribute('aria-busy')).toBe('true'); expect(container.textContent).toContain('Loading mini apps');
    await act(async () => response.reject(new Error('offline'))); expect(container.querySelector('[role="alert"]').textContent).toContain('Mini apps could not be loaded.');
    await act(async () => container.querySelector('[role="alert"] button').click()); expect(apiClient.get).toHaveBeenCalledTimes(2); expect(container.textContent).toContain('No mini apps found');
    await render({...props, showStatus: false}); expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it('cancels stale queries when selection changes or a collection is replaced', async () => {
    const first = deferred(), second = deferred(), apiClient = {get: jest.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)};
    await render({apiClient, agencyId: 'agency', position: 'first'}); const signal = apiClient.get.mock.calls[0][1].signal;
    await render({apiClient, agencyId: 'agency', position: 'second'}); expect(signal.aborted).toBe(true);
    await act(async () => first.resolve([snapshot('stale')])); expect(container.querySelector('section')).toBeNull();
    await render({miniApp: snapshot('single')}); expect(apiClient.get.mock.calls[1][1].signal.aborted).toBe(true);
    await act(async () => second.resolve([snapshot('late')])); expect(host().textContent).toBe('single'); expect(container.querySelector('section')).toBeNull();
  });

  it('disconnects elements when switching to a collection and survives StrictMode', async () => {
    const disconnected = jest.fn(), miniApp = snapshot('strict', 'strict', undefined, disconnected); await render({miniApp}, true); const element = ref.current.api;
    expect(modules.filesBase).toHaveBeenCalledTimes(2); expect(host().children).toHaveLength(1);
    await render({miniApps: [snapshot('collection')]}, true); expect(element.context.lifecycle.signal.aborted).toBe(true); expect(disconnected).toHaveBeenCalledTimes(1);
  });

  it('clears earlier query results before returning to the same selection', async () => {
    const reload = deferred(), onReady = jest.fn(), apiClient = {get: jest.fn().mockResolvedValueOnce([snapshot('old')]).mockReturnValueOnce(reload.promise)};
    const query = {apiClient, agencyId: 'agency', position: 'dashboard', onReady}; await render(query); expect(onReady).toHaveBeenCalledTimes(1);
    await render({miniApps: []}); await render(query); expect(container.querySelector('section')).toBeNull();
    await act(async () => reload.resolve([snapshot('new')])); expect(host().textContent).toBe('new'); expect(onReady).toHaveBeenCalledTimes(2);
  });

  it('localizes controls and respects status/reload visibility', async () => {
    await render({currentLanguage: 'el'}); expect(container.querySelector('[data-reload]').getAttribute('aria-label')).toBe('Επαναφόρτωση');
    await render({reloadable: false, showStatus: false}); expect(container.querySelector('button')).toBeNull(); expect(container.querySelector('[role="status"]')).toBeNull();
  });
});

const React = require('react');
const act = React.act ?? require('react-dom/test-utils').act;
const {installMiniAppModules} = require('./mini-app-helpers.cjs');
global.IS_REACT_ACT_ENVIRONMENT = true;
global.__FUSIONI_SDK_VERSION__ = 'test';
const Fusioni = require('../src/browser').default;

describe('Fusioni.mountMiniApp web components', () => {
  let container, mounted, snapshot;
  beforeEach(() => {container = document.createElement('div'); container.id = 'mini-app-test'; document.body.appendChild(container); snapshot = installMiniAppModules().snapshot;});
  afterEach(async () => {await act(async () => mounted?.unmount()); container.remove(); jest.restoreAllMocks();});
  it('mounts a web component inside a styled Shadow DOM and exposes reload/cleanup', async () => {
    const onReady = jest.fn(), disconnected = jest.fn(), cancelled = [];
    const miniApp = snapshot('Browser Mini App', '', element => {element.textContent = element.options.label;}, element => {
      disconnected(element); cancelled.push(element.context.lifecycle.signal.aborted);
    });
    await act(async () => {mounted = Fusioni.mountMiniApp('#mini-app-test', {miniApp, options: {label: 'Browser Mini App'}, onReady});});
    const shadow = container.querySelector('.fusioni-sdk-host').shadowRoot; expect(shadow.querySelector('style[data-fusioni-sdk]')).not.toBeNull();
    expect(shadow.querySelector('[data-mini-app-host]').textContent).toBe('Browser Mini App'); expect(mounted.api.localName).toBe(miniApp.bundle.element);
    await act(async () => mounted.run()); expect(onReady).toHaveBeenCalledTimes(2); expect(disconnected).toHaveBeenCalledTimes(1);
    await act(async () => mounted.unmount()); expect(disconnected).toHaveBeenCalledTimes(2); expect(cancelled).toEqual([true, true]); expect(container.childElementCount).toBe(0);
  });
  it('remounts a container and ignores a stale unmount handle', async () => {
    const disconnected = jest.fn(); let previous;
    await act(async () => {previous = Fusioni.mountMiniApp(container, {miniApp: snapshot('first', 'first', undefined, disconnected)});});
    await act(async () => {mounted = Fusioni.mountMiniApp(container, {miniApp: snapshot('replacement')});});
    expect(disconnected).toHaveBeenCalledTimes(1); await act(async () => previous.unmount()); expect(container.querySelector('.fusioni-sdk-host').shadowRoot.textContent).toContain('replacement');
  });
  it('rejects missing containers', () => {expect(() => Fusioni.mountMiniApp('#missing', {})).toThrow('not found');});
});

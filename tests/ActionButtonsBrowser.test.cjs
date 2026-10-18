const React = require('react');
const act = React.act ?? require('react-dom/test-utils').act;
global.IS_REACT_ACT_ENVIRONMENT = true;
global.__FUSIONI_SDK_VERSION__ = 'test';
const Fusioni = require('../src/browser').default;

it('mounts action buttons in Shadow DOM, exposes execution and ignores a stale unmount handle', async () => {
  const container = document.createElement('div'); document.body.appendChild(container);
  const client = {get: jest.fn(async url => url === '/action/by_group_tags' ? [{id: 'a', key: 'report', title: 'Report', agency_id: 'agency', show_results: true}] : []),
    post: jest.fn(async () => ({answer: ['Result']}))};
  let mounted;
  try {
    await act(async () => {mounted = Fusioni.mountActionButtons(container, {agencyId: 'agency', tags: ['tools'], apiClient: client});});
    const shadow = container.querySelector('.fusioni-sdk-host').shadowRoot;
    expect(shadow.querySelector('style[data-fusioni-sdk]')).not.toBeNull();
    expect(shadow.querySelector('.fusioni-action-card').textContent).toContain('Report');
    await act(async () => mounted.executeAction('report')); expect(mounted.results[0].content).toBe('Result');
    const previous = mounted;
    await act(async () => {mounted = Fusioni.mountActionButtons(container, {agencyId: 'agency', tags: ['tools'], apiClient: client});});
    await act(async () => previous.unmount()); expect(container.querySelector('.fusioni-sdk-host')).not.toBeNull();
  } finally {await act(async () => mounted?.unmount()); container.remove();}
});

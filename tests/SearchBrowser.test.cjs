const React = require('react');
const act = React.act ?? require('react-dom/test-utils').act;
global.IS_REACT_ACT_ENVIRONMENT = true;
global.__FUSIONI_SDK_VERSION__ = 'test';
const Fusioni = require('../src/browser').default;

it('mounts Search with an immediately usable handle and ignores a replaced mount\'s unmount', async () => {
  const container = document.createElement('div'); document.body.appendChild(container);
  const client = {post: jest.fn(async () => ({body: [{id: 'a', name: 'Guide', content: 'Setup', url: '#guide'}], pagination: null}))};
  let mounted;
  try {
    await act(async () => {mounted = Fusioni.mountSearch(container, {agencyId: 'agency', apiClient: client}); await mounted.search('guide');});
    expect(container.querySelector('style[data-fusioni-search]')).not.toBeNull();
    expect(mounted.results[0].name).toBe('Guide'); expect(container.querySelector('a').getAttribute('href')).toBe('#guide');
    const previous = mounted;
    await act(async () => {mounted = Fusioni.mountSearch(container, {agencyId: 'other', apiClient: client});});
    await act(async () => previous.unmount()); expect(container.querySelector('input')).not.toBeNull();
    await act(async () => mounted.focus()); expect(document.activeElement).toBe(container.querySelector('input'));
    await act(async () => mounted.clear()); expect(mounted.results).toEqual([]);
  } finally {await act(async () => mounted?.unmount()); container.remove();}
});

it('rejects invalid bindings before replacing a mount and preserves externally bound inputs', async () => {
  const container = document.createElement('div'); document.body.appendChild(container);
  const input = document.createElement('input'); input.id = 'bound-search'; document.body.appendChild(input);
  let mounted;
  try {
    await act(async () => {mounted = Fusioni.mountSearch(container, {agencyId: 'agency', inputElement: '#bound-search', mode: 'autocomplete'});});
    expect(input.getAttribute('role')).toBe('combobox');
    expect(() => Fusioni.mountSearch('#missing', {agencyId: 'agency'})).toThrow('not found');
    expect(() => Fusioni.mountSearch(container, {agencyId: 'agency', inputElement: '#missing'})).toThrow('inputElement');
    expect(() => Fusioni.mountSearch(container, {agencyId: 'agency', resultElement: '#missing'})).toThrow('resultElement');
    expect(() => Fusioni.mountSearch(input, {agencyId: 'agency', inputElement: input})).toThrow('separate container');
    expect(input.isConnected).toBe(true);
    await act(async () => mounted.unmount()); expect(input.hasAttribute('role')).toBe(false);
  } finally {await act(async () => mounted?.unmount()); container.remove(); input.remove();}
});

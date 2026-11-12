const React = require('react');
const act = React.act ?? require('react-dom/test-utils').act;
global.IS_REACT_ACT_ENVIRONMENT = true;
global.__FUSIONI_SDK_VERSION__ = 'test';
jest.mock('../src/components/ChatWidget', () => ({ChatWidget: React.forwardRef(({config}, ref) => {
  const [language, setLanguage] = React.useState(config.language);
  const [theme, setTheme] = React.useState(config.theme);
  React.useImperativeHandle(ref, () => ({setLanguage, setTheme}));
  return React.createElement('div', {'data-chat-widget': '', 'data-agency': config.agencyId, 'data-language': language, 'data-theme': theme});
})}));
const Fusioni = require('../src/browser').default;
const {getApiClient} = require('../src/services/ApiClient');
const {installMiniAppModules} = require('./mini-app-helpers.cjs');

describe('Fusioni.init fluent browser API', () => {
  let host, sdk, requests, miniApp;
  const config = {apiBaseUrl: 'https://fusion.test/api', agencyId: 'agency', accessToken: 'sdk-token'};
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    host = document.createElement('div');
    host.innerHTML = '<input id="site-search"><div id="search-widget"></div><div id="mini-apps"></div><div id="actions"></div><div id="chat"></div>';
    document.body.appendChild(host); requests = [];
    miniApp = installMiniAppModules().snapshot('Chained Mini App');
    sdk = Fusioni.init(config);
    getApiClient().client.defaults.adapter = async request => {
      requests.push(request);
      const data = request.url === '/mini-app-catalog/by-position' ? [miniApp]
        : request.url === '/action/by_group_tags' ? [{id: 'report', key: 'report', agency_id: 'agency', title: 'Run report', show_results: true}]
        : request.url === '/sdk-client/dasearch' ? {body: [{name: 'Setup guide', url: '#guide', content: 'Setup'}], pagination: null}
        : request.url === '/action/exec' ? {answer: ['Finished']} : [];
      return {data, config: request, headers: {}, status: 200, statusText: 'OK'};
    };
  });
  afterEach(async () => {
    await act(async () => sdk?.unmount()); host.remove(); document.getElementById('fusioni-chat-root')?.remove(); jest.restoreAllMocks();
  });

  it('initializes without chat, then mounts all requested features with one shared authenticated connection', async () => {
    expect(requests).toHaveLength(0); expect(document.querySelector('[data-chat-widget]')).toBeNull(); expect(document.getElementById('fusioni-chat-root')).toBeNull();
    await act(async () => {
      expect(sdk.search('#search-widget', {mode: 'autocomplete', inputElement: '#site-search'})
        .mountMiniApp('#mini-apps', {position: 'dashboard'})
        .mountActionButtons('#actions', {tags: ['tools']}).chatWidget()).toBe(sdk);
    });
    expect(document.querySelector('#site-search').getAttribute('role')).toBe('combobox');
    expect(document.querySelector('#mini-apps .fusioni-sdk-host').shadowRoot.textContent).toContain('Chained Mini App');
    expect(document.querySelector('#actions .fusioni-sdk-host').shadowRoot.textContent).toContain('Run report');
    expect(document.querySelector('[data-chat-widget]').getAttribute('data-agency')).toBe('agency');
    await act(async () => sdk.getSearch('#search-widget').search('setup'));
    expect(document.querySelector('.fusioni-search-dropdown').textContent).toContain('Setup guide');
    await act(async () => sdk.getActionButtons('#actions').executeAction('report'));
    expect(sdk.getActionButtons('#actions').results[0].content).toBe('Finished');
    expect(requests.map(request => request.url)).toEqual(expect.arrayContaining(['/mini-app-catalog/by-position', '/action/by_group_tags', '/sdk-client/dasearch', '/action/exec']));
    for (const request of requests) {
      expect(request.baseURL).toBe(config.apiBaseUrl); expect(request.headers.get('Authorization')).toBe('ApiKey sdk-token');
      expect(request.params.agency_id).toBe('agency');
      if (request.url === '/sdk-client/dasearch') expect(JSON.parse(request.data).agency_id).toBe('agency');
    }
    await act(async () => sdk.unmount());
    expect(document.querySelector('.fusioni-search-dropdown')).toBeNull(); expect(document.querySelector('#site-search').hasAttribute('role')).toBe(false);
    for (const selector of ['#search-widget', '#mini-apps', '#actions', '#fusioni-chat-root']) expect(document.querySelector(selector).childElementCount).toBe(0);
  });

  it('mounts floating chat only when requested and exposes its language and theme controls', async () => {
    await act(async () => expect(sdk.chatWidget({theme: 'dark', language: 'el'})).toBe(sdk));
    const chat = document.querySelector('#fusioni-chat-root [data-chat-widget]');
    expect(chat.getAttribute('data-theme')).toBe('dark'); expect(chat.getAttribute('data-language')).toBe('el');
    await act(async () => {sdk.getChatWidget().setLanguage('en'); sdk.getChatWidget().setTheme('light');});
    expect(chat.getAttribute('data-theme')).toBe('light'); expect(chat.getAttribute('data-language')).toBe('en');
  });

  it('mounts chat in a chosen container and protects a replacement from stale cleanup', async () => {
    await act(async () => sdk.chatWidget('#chat', {theme: 'dark'})); const previous = sdk.getChatWidget('#chat');
    await act(async () => sdk.chatWidget(document.getElementById('chat'), {theme: 'light'}));
    await act(async () => previous.unmount()); expect(document.querySelector('#chat [data-chat-widget]').getAttribute('data-theme')).toBe('light');
    let replacement;
    await act(async () => {replacement = Fusioni.mount('#chat', {...config, agencyId: 'other'});});
    await act(async () => sdk.unmount('#chat')); expect(document.querySelector('#chat [data-chat-widget]').getAttribute('data-agency')).toBe('other');
    await act(async () => replacement.unmount());
  });

  it('preserves an active search when a chained replacement has invalid bindings', async () => {
    await act(async () => sdk.search('#search-widget', {mode: 'autocomplete', inputElement: '#site-search'}));
    const search = sdk.getSearch('#search-widget');
    expect(() => sdk.search('#search-widget', {inputElement: '#missing'})).toThrow('inputElement');
    expect(sdk.getSearch('#search-widget')).toBe(search);
    await act(async () => search.search('setup')); expect(search.results).toHaveLength(1);
  });
});

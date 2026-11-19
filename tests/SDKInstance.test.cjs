const {createSDKInstance} = require('../src/utils/sdkInstance');
const {ApiClient, getApiClient} = require('../src/services/ApiClient');

describe('Initialized SDK defaults', () => {
  let mounting, containers, config;
  beforeEach(() => {
    containers = Array.from({length: 4}, (_, index) => {
      const element = document.createElement('div'); element.id = `sdk-${index}`; document.body.appendChild(element); return element;
    });
    mounting = Object.fromEntries(['mount', 'mountSearch', 'mountMiniApp', 'mountActionButtons'].map(name => [name, jest.fn(() => ({
      unmount: jest.fn(), ...(name === 'mount' ? {setLanguage: jest.fn(), setTheme: jest.fn()} : {}),
    }))]));
    config = {apiBaseUrl: 'https://fusion.test/api', agencyId: 'agency', accessToken: 'token', language: 'el', theme: 'dark'};
  });
  afterEach(() => {containers.forEach(element => element.remove()); document.getElementById('fusioni-chat-root')?.remove();});

  it('initializes the default API client immediately without mounting UI, and chains all features', () => {
    const sdk = createSDKInstance(config, mounting);
    expect(getApiClient().getBaseUrl()).toBe(config.apiBaseUrl); expect(getApiClient().getAccessToken()).toBe(config.accessToken);
    expect(getApiClient().getAgencyId()).toBe('agency');
    expect(document.getElementById('fusioni-chat-root')).toBeNull(); expect(sdk.getChatWidget()).toBeNull();
    Object.values(mounting).forEach(fn => expect(fn).not.toHaveBeenCalled());
    expect(sdk.search(containers[0]).mountMiniApp(containers[1], {position: 'dashboard'})
      .mountActionButtons(containers[2], {tags: ['tools']}).chatWidget(containers[3])).toBe(sdk);
    for (const name of ['mountSearch', 'mountMiniApp', 'mountActionButtons']) {
      const props = mounting[name].mock.calls[0][1];
      expect(props).toMatchObject({agencyId: 'agency', apiBaseUrl: config.apiBaseUrl, accessToken: 'token', currentLanguage: 'el'});
      expect(props.apiClient).toBe(getApiClient());
    }
    expect(mounting.mountSearch.mock.calls[0][1].theme).toBe('dark');
    expect(mounting.mount.mock.calls[0][1]).toEqual(config);
    expect(sdk.getSearch('#sdk-0')).toBe(mounting.mountSearch.mock.results[0].value);
    expect(sdk.getMiniApp('#sdk-1')).toBe(mounting.mountMiniApp.mock.results[0].value);
    expect(sdk.getActionButtons('#sdk-2')).toBe(mounting.mountActionButtons.mock.results[0].value);
    expect(sdk.getChatWidget('#sdk-3')).toBe(mounting.mount.mock.results[0].value);
    expect(sdk.getSearch('#sdk-1')).toBeNull(); expect(sdk.getMiniApp('#missing')).toBeNull();
    sdk.unmount(); Object.values(mounting).forEach(fn => expect(fn.mock.results[0].value.unmount).toHaveBeenCalledTimes(1));
  });

  it('supports floating chat, overrides, the chat alias, and the search alias', () => {
    const sdk = createSDKInstance(config, mounting);
    expect(sdk.chatWidget({theme: 'light'})).toBe(sdk);
    const defaultRoot = document.getElementById('fusioni-chat-root'); expect(defaultRoot).not.toBeNull();
    expect(mounting.mount).toHaveBeenLastCalledWith(defaultRoot, {...config, theme: 'light'});
    expect(sdk.getChatWidget()).toBe(mounting.mount.mock.results[0].value);
    expect(sdk.mount(containers[0], {language: 'en'})).toBe(sdk);
    expect(mounting.mount).toHaveBeenLastCalledWith(containers[0], {...config, language: 'en'});
    expect(sdk.mountSearch(containers[1], {mode: 'autocomplete'})).toBe(sdk);
    expect(mounting.mountSearch.mock.calls[0][1].mode).toBe('autocomplete');
    sdk.unmount();
  });

  it('chains language and theme changes before mounting and preserves them as defaults', () => {
    const sdk = createSDKInstance(config, mounting);
    expect(sdk.setLanguage('en').setTheme('light')).toBe(sdk);
    expect(document.getElementById('fusioni-chat-root')).toBeNull();
    Object.values(mounting).forEach(fn => expect(fn).not.toHaveBeenCalled());
    sdk.chatWidget(containers[0]).search(containers[1]).mountMiniApp(containers[2]).mountActionButtons(containers[3]);
    expect(mounting.mount).toHaveBeenLastCalledWith(containers[0], {...config, language: 'en', theme: 'light'});
    expect(mounting.mountSearch.mock.calls[0][1]).toMatchObject({currentLanguage: 'en', theme: 'light'});
    for (const name of ['mountMiniApp', 'mountActionButtons']) {
      expect(mounting[name].mock.calls[0][1].currentLanguage).toBe('en');
    }
    expect(config).toMatchObject({language: 'el', theme: 'dark'});
    sdk.unmount();
  });

  it('updates only mounted chats owned by the instance without remounting them', () => {
    const sdk = createSDKInstance(config, mounting).chatWidget(containers[0]).chatWidget(containers[1]).search(containers[2]);
    const first = sdk.getChatWidget(containers[0]); const second = sdk.getChatWidget(containers[1]);
    const other = createSDKInstance(config, mounting).chatWidget(containers[3]);
    const otherChat = other.getChatWidget(containers[3]);
    expect(sdk.setLanguage('en').setTheme('auto')).toBe(sdk);
    for (const chat of [first, second]) {
      expect(chat.setLanguage).toHaveBeenCalledWith('en'); expect(chat.setTheme).toHaveBeenCalledWith('auto');
    }
    sdk.setLanguage('fr'); sdk.setTheme('invalid');
    expect(first.setLanguage).toHaveBeenCalledTimes(1); expect(first.setTheme).toHaveBeenCalledTimes(1);
    sdk.unmount(containers[0]);
    sdk.setLanguage('el').setTheme('dark');
    expect(first.setLanguage).toHaveBeenCalledTimes(1); expect(first.setTheme).toHaveBeenCalledTimes(1);
    expect(second.setLanguage).toHaveBeenLastCalledWith('el'); expect(second.setTheme).toHaveBeenLastCalledWith('dark');
    expect(otherChat.setLanguage).not.toHaveBeenCalled(); expect(otherChat.setTheme).not.toHaveBeenCalled();
    expect(mounting.mount).toHaveBeenCalledTimes(3);
    sdk.unmount(); other.unmount();
  });

  it('uses per-feature connection overrides without changing defaults and respects an injected client', () => {
    const sdk = createSDKInstance(config, mounting);
    sdk.search(containers[0], {apiBaseUrl: 'https://other.test/api', accessToken: 'other-token', agencyId: 'other', theme: 'light', currentLanguage: 'en'});
    const search = mounting.mountSearch.mock.calls[0][1];
    expect(search.apiClient.getBaseUrl()).toBe('https://other.test/api'); expect(search.apiClient.getAccessToken()).toBe('other-token');
    expect(search.apiClient.getAgencyId()).toBe('other');
    expect(search).toMatchObject({agencyId: 'other', theme: 'light', currentLanguage: 'en'});
    sdk.mountMiniApp(containers[1], {accessToken: 'mini-token'});
    expect(mounting.mountMiniApp.mock.calls[0][1].apiClient.getBaseUrl()).toBe(config.apiBaseUrl);
    expect(mounting.mountMiniApp.mock.calls[0][1].apiClient.getAccessToken()).toBe('mini-token');
    const explicit = new ApiClient('https://explicit.test/api', 'explicit-token');
    sdk.mountActionButtons(containers[2], {apiClient: explicit, agencyId: null});
    expect(mounting.mountActionButtons.mock.calls[0][1]).toMatchObject({apiClient: explicit, agencyId: null, apiBaseUrl: 'https://explicit.test/api', accessToken: 'explicit-token'});
    sdk.search(containers[3]);
    expect(mounting.mountSearch.mock.calls[1][1].apiClient).toBe(getApiClient());
    expect(mounting.mountSearch.mock.calls[1][1].agencyId).toBe('agency');
    sdk.unmount();
  });

  it('keeps initialized instances and their cleanup independent', () => {
    const first = createSDKInstance(config, mounting); const firstClient = getApiClient();
    const second = createSDKInstance({...config, agencyId: 'second', apiBaseUrl: 'https://second.test/api', accessToken: 'second-token'}, mounting);
    first.search(containers[0]); second.search(containers[1]);
    expect(mounting.mountSearch.mock.calls[0][1].apiClient).toBe(firstClient);
    expect(mounting.mountSearch.mock.calls[1][1].apiClient).toBe(getApiClient());
    first.unmount(); expect(mounting.mountSearch.mock.results[0].value.unmount).toHaveBeenCalledTimes(1);
    expect(mounting.mountSearch.mock.results[1].value.unmount).not.toHaveBeenCalled();
    second.unmount();
  });

  it('scopes agency-only feature overrides without changing the initialized default client', () => {
    const sdk = createSDKInstance(config, mounting);
    sdk.search(containers[0], {agencyId: 'other'}).mountMiniApp(containers[1], {agencyId: 'mini-agency'})
      .mountActionButtons(containers[2], {agencyId: 'actions-agency'});
    expect(mounting.mountSearch.mock.calls[0][1].apiClient.getAgencyId()).toBe('other');
    expect(mounting.mountMiniApp.mock.calls[0][1].apiClient.getAgencyId()).toBe('mini-agency');
    expect(mounting.mountActionButtons.mock.calls[0][1].apiClient.getAgencyId()).toBe('actions-agency');
    expect(getApiClient().getAgencyId()).toBe('agency');
    sdk.unmount();
  });

  it('unmounts one feature, ignores missing targets, and validates init and mount arguments', () => {
    const sdk = createSDKInstance(config, mounting).search(containers[0]).mountActionButtons(containers[1]);
    sdk.unmount('#sdk-0'); expect(sdk.getSearch(containers[0])).toBeNull(); expect(sdk.getActionButtons(containers[1])).not.toBeNull();
    sdk.unmount('#missing'); sdk.unmount(); sdk.unmount();
    Object.values(mounting).filter(fn => fn.mock.calls.length).forEach(fn => expect(fn.mock.results[0].value.unmount).toHaveBeenCalledTimes(1));
    expect(() => createSDKInstance({}, mounting)).toThrow('apiBaseUrl and agencyId');
    expect(() => createSDKInstance({...config, agencyId: ' '}, mounting)).toThrow('apiBaseUrl and agencyId');
    expect(() => sdk.search('#missing')).toThrow('not found');
  });
});

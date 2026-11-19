const React = require('react');
const act = React.act ?? require('react-dom/test-utils').act;
global.IS_REACT_ACT_ENVIRONMENT = true;
global.__FUSIONI_SDK_VERSION__ = 'test';

const Fusioni = require('../src/browser').default;
const {SDKClientService} = require('../src/services/SDKClientService');
const {ApiClient} = require('../src/services/ApiClient');
const conversations = require('../src/services/ConversationService');

describe('SDK controls on the real chat widget', () => {
  let host, sdk, resolveConfig, mediaQuery;
  beforeEach(() => {
    localStorage.clear(); sessionStorage.clear();
    sessionStorage.setItem('fusioni:chatPanelOpen:agency', 'true');
    host = document.createElement('div'); document.body.appendChild(host);
    const serverConfig = new Promise(resolve => {resolveConfig = resolve;});
    jest.spyOn(SDKClientService.prototype, 'getClientConfig').mockReturnValue(serverConfig);
    jest.spyOn(conversations, 'getConversationService').mockReturnValue({getConversationsByAgency: jest.fn().mockResolvedValue([])});
    jest.spyOn(ApiClient.prototype, 'connectToSSE').mockImplementation(() => ({close: jest.fn()}));
    jest.spyOn(console, 'log').mockImplementation(() => {});
    mediaQuery = {matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn()};
    const layoutQuery = {matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn()};
    Object.defineProperty(window, 'matchMedia', {configurable: true, writable: true,
      value: jest.fn(query => query === '(prefers-color-scheme: dark)' ? mediaQuery : layoutQuery),
    });
    sdk = Fusioni.init({apiBaseUrl: '/api', agencyId: 'agency', language: 'el', theme: 'dark'});
  });
  afterEach(async () => {
    await act(async () => sdk.unmount());
    host.remove(); localStorage.clear(); sessionStorage.clear(); jest.restoreAllMocks();
  });

  it('retains immediate controls through Shadow DOM mounting and delayed server configuration', async () => {
    await act(async () => sdk.chatWidget(host).setLanguage('en').setTheme('light'));
    await act(async () => resolveConfig({language: 'el', theme: 'dark', labels: [
      {language: 'en', welcome_message: 'Welcome'}, {language: 'el', welcome_message: 'Καλώς ήρθατε'},
    ]}));
    const shadow = host.querySelector('.fusioni-sdk-host').shadowRoot;
    const widget = shadow.querySelector('.fusioni-chat-widget');
    expect(shadow.querySelector('.fusioni-chat-welcome h3').textContent).toBe('Welcome');
    expect(widget.classList.contains('light')).toBe(true);
    expect(localStorage.getItem('fusioni-chat-theme')).toBe('light');

    await act(async () => sdk.setLanguage('el').setTheme('auto'));
    expect(shadow.querySelector('.fusioni-chat-welcome h3').textContent).toBe('Καλώς ήρθατε');
    expect(widget.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('fusioni-chat-theme')).toBeNull();
    const onSystemThemeChange = mediaQuery.addEventListener.mock.calls.find(([event]) => event === 'change')[1];
    mediaQuery.matches = false;
    await act(async () => onSystemThemeChange());
    expect(widget.classList.contains('light')).toBe(true);
    await act(async () => sdk.unmount());
    expect(mediaQuery.removeEventListener).toHaveBeenCalledWith('change', onSystemThemeChange);
  });
});

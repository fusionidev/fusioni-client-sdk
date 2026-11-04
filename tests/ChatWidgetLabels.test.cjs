const React = require('react');
const {createRoot} = require('react-dom/client');
const act = React.act ?? require('react-dom/test-utils').act;
jest.mock('../src/hooks/useSSE', () => ({useSSE: () => {}}));
jest.mock('../src/hooks/useIsMobileLayout', () => ({useIsMobileLayout: () => false}));
jest.mock('../src/components/ShadowDomRoot', () => ({ShadowDomRoot: ({children}) => children}));
jest.mock('../src/components/ChatPanel', () => ({ChatPanel: ({children}) => children}));
const {ChatWidget} = require('../src/components/ChatWidget');
const {SDKClientService} = require('../src/services/SDKClientService');
const api = require('../src/services/ApiClient');
const conversations = require('../src/services/ConversationService');
const {getTranslation} = require('../src/i18n');
global.IS_REACT_ACT_ENVIRONMENT = true;

const english = {language: 'en', welcome_message: 'Welcome to our team', description: 'How can we help?'};
const greek = {language: 'el', welcome_message: 'Καλώς ήρθατε στην ομάδα μας', description: 'Πώς μπορούμε να βοηθήσουμε;'};

describe('chat widget welcome labels', () => {
  let root, container, getConfig, ref;
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('fusioni:chatPanelOpen:agency', 'true');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    ref = React.createRef();
    getConfig = jest.spyOn(SDKClientService.prototype, 'getClientConfig');
    jest.spyOn(api, 'initializeApiClient').mockImplementation(() => {});
    jest.spyOn(conversations, 'getConversationService').mockReturnValue({
      getConversationsByAgency: jest.fn().mockResolvedValue([]),
    });
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    jest.restoreAllMocks();
  });
  async function render(serverConfig, config = {}) {
    getConfig.mockResolvedValue(serverConfig);
    await act(async () => root.render(React.createElement(ChatWidget, {
      ref, config: {agencyId: 'agency', apiBaseUrl: '/api', showConversationList: false, ...config},
    })));
  }
  function expectWelcome(title, description) {
    expect(container.querySelector('.fusioni-chat-welcome h3').textContent).toBe(title);
    expect(container.querySelector('.fusioni-chat-welcome p').textContent).toBe(description);
  }

  it('selects the server language and updates labels when the language changes', async () => {
    await render({language: 'el', labels: [english, greek]});
    expectWelcome(greek.welcome_message, greek.description);
    await act(async () => ref.current.setLanguage('en'));
    expectWelcome(english.welcome_message, english.description);
    await act(async () => ref.current.setLanguage('el'));
    expectWelcome(greek.welcome_message, greek.description);
  });

  it('falls back to the English label when the current language has no match', async () => {
    await render({labels: [{language: 'fr', welcome_message: 'Bonjour'}, english]}, {language: 'el'});
    expectWelcome(english.welcome_message, english.description);
  });

  it('matches label language codes ignoring casing and surrounding spaces', async () => {
    await render({labels: [{...greek, language: ' EL '}]}, {language: 'el'});
    expectWelcome(greek.welcome_message, greek.description);
  });

  it.each([undefined, null, [], [{language: 'fr', welcome_message: 'Bonjour', description: 'Bienvenue'}]])(
    'uses existing translated text when labels are absent or unmatched: %p', async labels => {
      await render({labels}, {language: 'el'});
      expectWelcome(getTranslation('el', 'chat.welcome.title'), getTranslation('el', 'chat.welcome.description'));
    },
  );

  it.each([undefined, null, '', '   '])('uses existing text independently for blank fields: %p', async blank => {
    await render({labels: [english, {...greek, welcome_message: blank}]}, {language: 'el'});
    expectWelcome(getTranslation('el', 'chat.welcome.title'), greek.description);
    await render({labels: [english, {...greek, description: blank}]}, {language: 'el'});
    expectWelcome(greek.welcome_message, getTranslation('el', 'chat.welcome.description'));
    await render({labels: [{...english, welcome_message: blank, description: blank}]});
    expectWelcome(getTranslation('en', 'chat.welcome.title'), getTranslation('en', 'chat.welcome.description'));
  });

  it('displays label content as plain text', async () => {
    const title = '<img src=x onerror=alert(1)>';
    await render({labels: [{language: 'en', welcome_message: title, description: '   Helpful text   '}]});
    expectWelcome(title, 'Helpful text');
    expect(container.querySelector('.fusioni-chat-welcome img')).toBeNull();
  });
});

it('merges server labels while preserving local labels when the server has none', () => {
  const service = new SDKClientService();
  const config = {agencyId: 'agency', apiBaseUrl: '/api', labels: [greek]};
  expect(service.mergeConfig(config, {labels: [english]}).labels).toEqual([english]);
  expect(service.mergeConfig(config, {labels: []}).labels).toEqual([]);
  expect(service.mergeConfig(config, {labels: null}).labels).toEqual([greek]);
  expect(service.mergeConfig(config, {}).labels).toEqual([greek]);
});

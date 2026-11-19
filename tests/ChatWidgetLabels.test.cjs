const React = require('react');
const {createRoot} = require('react-dom/client');
const act = React.act ?? require('react-dom/test-utils').act;
jest.mock('../src/hooks/useIsMobileLayout', () => ({useIsMobileLayout: () => false}));
jest.mock('../src/components/ShadowDomRoot', () => ({ShadowDomRoot: ({children}) => children}));
const {ChatWidget} = require('../src/components/ChatWidget');
const {SDKClientService} = require('../src/services/SDKClientService');
const api = require('../src/services/ApiClient');
const conversations = require('../src/services/ConversationService');
const {getTranslation} = require('../src/i18n');
global.IS_REACT_ACT_ENVIRONMENT = true;

const english = {language: 'en', welcome_message: 'Welcome to our team', description: 'How can we help?'};
const greek = {language: 'el', welcome_message: 'Καλώς ήρθατε στην ομάδα μας', description: 'Πώς μπορούμε να βοηθήσουμε;'};

describe('chat widget initialization', () => {
  let root, container, getConfig, connectToSSE, ref;
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('fusioni:chatPanelOpen:agency', 'true');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    ref = React.createRef();
    getConfig = jest.spyOn(SDKClientService.prototype, 'getClientConfig');
    connectToSSE = jest.spyOn(api.ApiClient.prototype, 'connectToSSE').mockImplementation(() => ({close: jest.fn()}));
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

  it('opens the stream with the panel, closes it, and reconnects when reopened', async () => {
    sessionStorage.removeItem('fusioni:chatPanelOpen:agency');
    await render(null);
    expect(connectToSSE).not.toHaveBeenCalled();

    const launcher = container.querySelector('.fusioni-floating-button');
    await act(async () => launcher.click());
    expect(connectToSSE).toHaveBeenCalledTimes(1);
    const firstStream = connectToSSE.mock.results[0].value;

    const closeButton = container.querySelector('.fusioni-chat-toolbar-close-mobile');
    await act(async () => closeButton.click());
    expect(firstStream.close).toHaveBeenCalledTimes(1);
    expect(connectToSSE).toHaveBeenCalledTimes(1);

    await act(async () => launcher.click());
    expect(connectToSSE).toHaveBeenCalledTimes(2);
    const secondStream = connectToSSE.mock.results[1].value;
    await act(async () => launcher.click());
    expect(secondStream.close).toHaveBeenCalledTimes(1);
  });

  it('cancels a scheduled stream reconnect when the panel closes', async () => {
    jest.useFakeTimers();
    try {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      await render(null);
      expect(connectToSSE).toHaveBeenCalledTimes(1);
      const stream = connectToSSE.mock.results[0].value;
      stream.onerror(new Event('error'));
      await act(async () => container.querySelector('.fusioni-floating-button').click());
      await act(async () => jest.advanceTimersByTime(3000));
      expect(connectToSSE).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it.each([false, true])('hides the panel during a backend failure and restores it on a healthy remount (already open: %s)', async alreadyOpen => {
    const panel = () => container.querySelector('.fusioni-chat-panel');
    const launcher = () => container.querySelector('.fusioni-floating-button');
    if (alreadyOpen) {
      await render(null);
      expect(panel()).not.toBeNull();
    }

    jest.spyOn(console, 'warn').mockImplementation(() => {});
    getConfig.mockRejectedValueOnce(new Error('Backend unreachable'));
    await render(null);

    expect(panel()).toBeNull();
    expect(launcher()).toBeNull();
    expect(connectToSSE).toHaveBeenCalledTimes(alreadyOpen ? 1 : 0);
    if (alreadyOpen) {
      expect(connectToSSE.mock.results[0].value.close).toHaveBeenCalledTimes(1);
    }
    expect(sessionStorage.getItem('fusioni:chatPanelOpen:agency')).toBe('true');

    await act(async () => root.unmount());
    root = createRoot(container);
    await render(null);
    expect(panel()).not.toBeNull();
    expect(launcher()).not.toBeNull();
    expect(connectToSSE).toHaveBeenCalledTimes(alreadyOpen ? 2 : 1);
  });

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

it.each([
  [null, false], [undefined, false], [false, false], [true, true],
])('treats the server upload and audio switches as authoritative (%p -> %p)', (value, expected) => {
  const service = new SDKClientService();
  const config = {agencyId: 'agency', enableFileUpload: true, enableAudioRecording: true};
  const merged = service.mergeConfig(config, {enable_file_upload: value, enable_audio_recording: value});
  expect(merged.enableFileUpload).toBe(expected);
  expect(merged.enableAudioRecording).toBe(expected);
});

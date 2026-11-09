const React = require('react');
const {createRoot} = require('react-dom/client');
const act = React.act ?? require('react-dom/test-utils').act;

jest.mock('../src/hooks/useSSE', () => ({useSSE: () => {}}));
jest.mock('../src/hooks/useIsMobileLayout', () => ({useIsMobileLayout: () => false}));
jest.mock('../src/components/ShadowDomRoot', () => ({ShadowDomRoot: ({children}) => children}));

const {ChatWidget} = require('../src/components/ChatWidget');
const api = require('../src/services/ApiClient');
const conversations = require('../src/services/ConversationService');
const messages = require('../src/services/MessageService');
const pipelines = require('../src/services/PipelineService');
const {SDKClientService} = require('../src/services/SDKClientService');

global.IS_REACT_ACT_ENVIRONMENT = true;

const agencyId = 'agency';
const selectedKey = 'fusioni:selectedConversationId:agency';
const source = {id: 'source', agency_id: agencyId, title: 'Source chat', conversation_profile_id: 'profile'};
const other = {id: 'other', agency_id: agencyId, title: 'Other chat'};
const fork = {...source, id: 'fork', created: '2026-10-01T00:00:00Z'};
const sourceHistory = [
  {id: 'question', role: 'user', content: 'Original question'},
  {id: 'answer', role: 'assistant', content: 'Branch from this answer'},
  {id: 'later', role: 'assistant', content: 'Later reply'},
  {id: 'error', role: 'assistant', content: 'An error', has_error: true},
].map(message => ({...message, agency_id: agencyId, conversation_id: source.id}));

describe('chat widget conversation forks', () => {
  let container, root, createFork, forkLookup, onConversationCreated, onError;
  const mount = async () => {
    root = createRoot(container);
    await act(async () => root.render(React.createElement(ChatWidget, {
      config: {agencyId, apiBaseUrl: '/api'}, onConversationCreated, onError,
    })));
  };
  const unmount = async () => {
    await act(async () => root.unmount());
    root = undefined;
  };
  const forkButtons = () => [...container.querySelectorAll('button[aria-label="Fork conversation"]')];
  const transcript = () => container.querySelector('.fusioni-message-list').textContent;
  const select = async title => act(async () => {
    [...container.querySelectorAll('.fusioni-conversation-item')]
      .find(item => item.querySelector('h4')?.textContent === title)?.click();
  });

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.setItem('conversations', JSON.stringify([source.id, other.id]));
    sessionStorage.setItem('fusioni:chatPanelOpen:agency', 'true');
    sessionStorage.setItem(selectedKey, source.id);
    container = document.createElement('div');
    document.body.appendChild(container);
    onConversationCreated = jest.fn();
    onError = jest.fn();
    createFork = jest.fn().mockResolvedValue(fork.id);
    forkLookup = jest.fn().mockResolvedValue(fork);

    const client = new api.ApiClient('/api', 'token', agencyId);
    client.client.defaults.adapter = async request => {
      const params = request.params;
      let data;
      switch (request.url) {
        case '/conversation/by_ids_and_agency_id':
          data = [source, other, fork].filter(conversation => params.ids.includes(conversation.id));
          break;
        case '/conversation/fork':
          data = await createFork(request.method, params.agency_id, JSON.parse(request.data));
          break;
        case '/conversation':
          data = await forkLookup(params.item_id, params.agency_id);
          break;
        case '/mem/messages':
          data = {body: params.conversation_id === source.id ? sourceHistory : params.conversation_id === fork.id
            ? sourceHistory.slice(0, 2).map(message => ({...message, id: `fork-${message.id}`, conversation_id: fork.id}))
            : []};
          break;
        default:
          throw new Error(`Unexpected request ${request.url}`);
      }
      return {data, status: 200, statusText: 'OK', headers: {}, config: request};
    };

    jest.spyOn(api, 'initializeApiClient').mockImplementation(() => {});
    jest.spyOn(SDKClientService.prototype, 'getClientConfig').mockResolvedValue(null);
    jest.spyOn(conversations, 'getConversationService').mockReturnValue(new conversations.LocalConversationService(
      new conversations.RemoteConversationService(client),
    ));
    jest.spyOn(messages, 'getMessageService').mockReturnValue(new messages.MessageService(client));
    jest.spyOn(pipelines, 'getPipelineService').mockReturnValue({getLatestExecutionStatus: jest.fn()});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(window, 'requestAnimationFrame').mockReturnValue(0);
  });

  afterEach(async () => {
    if (root) await unmount();
    container.remove();
    localStorage.clear();
    jest.restoreAllMocks();
  });

  it('forks from a saved reply, opens the copied history, and restores the fork after remounting', async () => {
    await mount();
    expect(forkButtons()).toHaveLength(2);
    await act(async () => forkButtons()[0].click());

    expect(createFork).toHaveBeenCalledWith('post', agencyId, {conversation_id: source.id, message_id: 'answer'});
    expect(forkLookup).toHaveBeenCalledWith(fork.id, agencyId);
    expect(onConversationCreated).toHaveBeenCalledWith(fork);
    expect(sessionStorage.getItem(selectedKey)).toBe(fork.id);
    expect(transcript()).toContain('Branch from this answer');
    expect(transcript()).not.toContain('Later reply');

    await unmount();
    await mount();
    expect(container.querySelectorAll('.fusioni-conversation-item')).toHaveLength(3);
    expect(transcript()).toContain('Branch from this answer');
    expect(transcript()).not.toContain('Later reply');
    expect(onError).not.toHaveBeenCalled();
  });

  it('keeps the source chat visible and lets the user retry a failed fork', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    createFork.mockRejectedValueOnce(new Error('Fork failed'));
    await mount();
    await act(async () => forkButtons()[0].click());

    expect(container.querySelector('.fusioni-chat-fork-error[role="alert"]').textContent).toContain('Couldn’t fork');
    expect(onError).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(selectedKey)).toBe(source.id);
    expect(transcript()).toContain('Later reply');
    expect(JSON.parse(localStorage.getItem('conversations'))).toEqual([source.id, other.id]);

    await act(async () => forkButtons()[0].click());
    expect(createFork).toHaveBeenCalledTimes(2);
    expect(sessionStorage.getItem(selectedKey)).toBe(fork.id);
    expect(container.querySelector('.fusioni-chat-fork-error')).toBeNull();
  });

  it('prevents duplicate requests and respects a conversation switch during the fork', async () => {
    let resolveFork;
    createFork.mockReturnValueOnce(new Promise(resolve => { resolveFork = resolve; }));
    await mount();
    await act(async () => forkButtons()[0].click());

    const pending = container.querySelector('button[aria-busy="true"]');
    expect(pending.disabled).toBe(true);
    expect(forkButtons()[0].disabled).toBe(true);
    await act(async () => forkButtons()[0].click());
    await select(other.title);
    expect(sessionStorage.getItem(selectedKey)).toBe(other.id);

    await act(async () => resolveFork(fork.id));
    expect(createFork).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll('.fusioni-conversation-item')).toHaveLength(3);
    expect(sessionStorage.getItem(selectedKey)).toBe(other.id);
    expect(onConversationCreated).toHaveBeenCalledWith(fork);
  });
});

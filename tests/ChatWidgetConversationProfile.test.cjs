const React = require('react');
const {createRoot} = require('react-dom/client');
const act = React.act ?? require('react-dom/test-utils').act;
jest.mock('../src/hooks/useSSE', () => ({useSSE: () => {}}));
jest.mock('../src/hooks/useIsMobileLayout', () => ({useIsMobileLayout: () => false}));
jest.mock('../src/components/ShadowDomRoot', () => ({ShadowDomRoot: ({children}) => children}));
jest.mock('../src/components/ChatPanel', () => ({ChatPanel: ({children}) => children}));
jest.mock('../src/components/MessageList', () => ({MessageList: () => null}));
jest.mock('../src/components/ChatInput', () => ({ChatInput: ({onSendMessage}) =>
  React.createElement('button', {'data-send': true, onClick: () => onSendMessage('Hello')}, 'Send')}));
const {ChatWidget} = require('../src/components/ChatWidget');
const {SDKClientService} = require('../src/services/SDKClientService');
const api = require('../src/services/ApiClient');
const conversations = require('../src/services/ConversationService');
const pipelines = require('../src/services/PipelineService');
global.IS_REACT_ACT_ENVIRONMENT = true;

describe('chat widget conversation profile', () => {
  let root, container, service, pipeline;
  beforeEach(() => {
    sessionStorage.clear(); sessionStorage.setItem('fusioni:chatPanelOpen:agency', 'true');
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
    service = {getConversationsByAgency: jest.fn().mockResolvedValue([]), createConversation: jest.fn().mockResolvedValue('conversation-1')};
    pipeline = {executePipelineAsync: jest.fn().mockResolvedValue({})};
    jest.spyOn(api, 'initializeApiClient').mockImplementation(() => {});
    jest.spyOn(conversations, 'getConversationService').mockReturnValue(service);
    jest.spyOn(pipelines, 'getPipelineService').mockReturnValue(pipeline);
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(async () => {await act(async () => root.unmount()); container.remove(); jest.restoreAllMocks();});
  it.each(['profile-1', null])('creates the conversation with client profile %s', async profile => {
    jest.spyOn(SDKClientService.prototype, 'getClientConfig').mockResolvedValue({conversation_profile_id: profile});
    const onConversationCreated = jest.fn();
    await act(async () => root.render(React.createElement(ChatWidget, {
      config: {agencyId: 'agency', apiBaseUrl: '/api', showConversationList: false}, onConversationCreated,
    })));
    await act(async () => container.querySelector('.fusioni-chat-welcome button').click());
    const draft = onConversationCreated.mock.calls[0][0];
    expect(draft.conversation_profile_id).toBe(profile || undefined);
    await act(async () => container.querySelector('[data-send]').click());
    expect(service.createConversation).toHaveBeenCalledWith({
      title: expect.any(String), agency_id: 'agency', ...(profile ? {conversation_profile_id: profile} : {}),
    });
    expect(pipeline.executePipelineAsync).toHaveBeenCalledWith(expect.objectContaining({conversation_id: 'conversation-1'}));
  });
});

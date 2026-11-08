const React = require('react');
const {createRoot} = require('react-dom/client');
const {AxiosError} = require('axios');
const act = React.act ?? require('react-dom/test-utils').act;

let receiveSSE;
jest.mock('../src/hooks/useSSE', () => ({
  useSSE: (_agencyId, onMessage) => { receiveSSE = onMessage; },
}));
jest.mock('../src/hooks/useIsMobileLayout', () => ({useIsMobileLayout: () => false}));
jest.mock('../src/components/ShadowDomRoot', () => ({ShadowDomRoot: ({children}) => children}));
jest.mock('../src/components/ChatPanel', () => ({ChatPanel: ({children}) => children}));
jest.mock('../src/components/MessageList', () => ({
  MessageList: ({messages}) => React.createElement('ol', {}, messages.map((message, index) =>
    React.createElement('li', {key: message.id || index},
      message.loading ? 'Working' : message.has_error ? 'Failed' : message.content))),
}));
jest.mock('../src/components/ChatInput', () => ({
  ChatInput: ({onSendMessage, onStopResponse, isStoppingResponse, disabled}) =>
    React.createElement(React.Fragment, null,
      React.createElement('button', {disabled, 'data-send': true, onClick: () => onSendMessage('Hello')}, 'Send'),
      onStopResponse && React.createElement('button', {
        disabled: isStoppingResponse, 'data-stop': true, onClick: onStopResponse,
      }, 'Stop response'),
    ),
}));

const {ChatWidget} = require('../src/components/ChatWidget');
const api = require('../src/services/ApiClient');
const conversations = require('../src/services/ConversationService');
const messages = require('../src/services/MessageService');
const pipelines = require('../src/services/PipelineService');
const {SDKClientService} = require('../src/services/SDKClientService');

global.IS_REACT_ACT_ENVIRONMENT = true;

const agencyId = 'agency';
const conversationId = 'conversation-1';
const otherConversationId = 'conversation-2';
const conversation = {id: conversationId, agency_id: agencyId, title: 'First chat'};
const otherConversation = {id: otherConversationId, agency_id: agencyId, title: 'Second chat'};
const userMessage = {id: 'user-1', conversation_id: conversationId, role: 'user', content: 'Hello'};
const assistantMessage = {id: 'assistant-1', conversation_id: conversationId, role: 'assistant', content: 'Done'};
const config = {apiBaseUrl: '/api', agencyId};
const usageReply = (id, usage, owner) => ({
  ...assistantMessage,
  id,
  extra_data: {context_usage: usage, owner},
});
const status = (executionId, state, extra = {}) => ({
  execution_id: executionId,
  agency_id: agencyId,
  conversation_id: conversationId,
  status: state,
  created_at: new Date(Date.now() - 90_000).toISOString(),
  ...extra,
});
const stream = (executionId, incoming, extra = {}) => receiveSSE({
  event: 'message_stream',
  data: '',
  payload: {conversation_id: conversationId, execution_id: executionId, messages: incoming, ...extra},
});

describe('chat widget execution recovery', () => {
  let root, container, getMessages, pipeline, onError, onMessageReceived;
  const mount = async (options = {}) => {
    root = createRoot(container);
    await act(async () => root.render(React.createElement(ChatWidget, {
      config: {...config, ...options}, onError, onMessageReceived,
    })));
  };
  const unmount = async () => {
    await act(async () => root.unmount());
    root = undefined;
  };
  const input = () => container.querySelector('[data-send]');
  const stop = () => container.querySelector('[data-stop]');
  const transcript = () => [...container.querySelectorAll('ol li')].map(row => row.textContent);
  const advance = ms => act(async () => { await jest.advanceTimersByTimeAsync(ms); });

  beforeEach(() => {
    jest.useFakeTimers();
    sessionStorage.clear();
    sessionStorage.setItem('fusioni:chatPanelOpen:agency', 'true');
    sessionStorage.setItem('fusioni:selectedConversationId:agency', conversationId);
    container = document.createElement('div');
    document.body.appendChild(container);
    onError = jest.fn();
    onMessageReceived = jest.fn();
    getMessages = jest.fn().mockResolvedValue([]);
    pipeline = {
      executePipelineAsync: jest.fn(async request => ({execution_id: request.execution_id})),
      getLatestExecutionStatus: jest.fn().mockResolvedValue(undefined),
      getExecutionStatus: jest.fn(async (_agencyId, executionId) => status(executionId, 'running')),
      cancelExecution: jest.fn(async (_agencyId, executionId) => status(executionId, 'cancellation_requested')),
    };
    jest.spyOn(api, 'initializeApiClient').mockImplementation(() => {});
    jest.spyOn(SDKClientService.prototype, 'getClientConfig').mockResolvedValue(null);
    jest.spyOn(conversations, 'getConversationService').mockReturnValue({
      getConversationsByAgency: jest.fn().mockResolvedValue([conversation, otherConversation]),
      createConversation: jest.fn().mockResolvedValue(conversationId),
    });
    jest.spyOn(messages, 'getMessageService').mockReturnValue({getMessages});
    jest.spyOn(pipelines, 'getPipelineService').mockReturnValue(pipeline);
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    if (root) await unmount();
    container.remove();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('starts polling at the response timeout and stops after the matching final event', async () => {
    await mount();
    await act(async () => input().click());
    const {execution_id: executionId} = pipeline.executePipelineAsync.mock.calls[0][0];
    expect(executionId).toEqual(expect.any(String));

    await advance(89_999);
    expect(pipeline.getExecutionStatus).not.toHaveBeenCalled();
    await advance(1);
    expect(pipeline.getExecutionStatus).toHaveBeenCalledTimes(1);
    await advance(2_000);
    expect(pipeline.getExecutionStatus).toHaveBeenCalledTimes(2);
    expect(input().disabled).toBe(true);
    expect(transcript()).toEqual(['Hello', 'Working']);
    expect(onError).not.toHaveBeenCalled();

    await act(async () => stream('previous-execution', [assistantMessage]));
    await act(async () => stream(executionId, [userMessage]));
    expect(transcript()).toEqual(['Hello', 'Working']);
    await act(async () => stream(executionId, [assistantMessage], {extra_data: {execution_status: 'completed'}}));
    expect(transcript()).toEqual(['Hello', 'Done']);
    expect(input().disabled).toBe(false);
    expect(onMessageReceived).toHaveBeenCalledTimes(1);

    const pollCount = pipeline.getExecutionStatus.mock.calls.length;
    expect(pollCount).toBeGreaterThan(0);
    await advance(10_000);
    expect(pipeline.getExecutionStatus).toHaveBeenCalledTimes(pollCount);
  });

  it('skips polling for a reply that finishes over the live stream before the timeout', async () => {
    await mount();
    await act(async () => input().click());
    const {execution_id: executionId} = pipeline.executePipelineAsync.mock.calls[0][0];
    await act(async () => stream(executionId, [userMessage, assistantMessage]));

    await advance(90_000);
    expect(pipeline.getExecutionStatus).not.toHaveBeenCalled();
    expect(transcript()).toEqual(['Hello', 'Done']);
    expect(input().disabled).toBe(false);
  });

  it('waits for submission to be acknowledged before sending an early stop', async () => {
    const executionId = 'acknowledged-execution';
    let acknowledge;
    pipeline.executePipelineAsync.mockReturnValueOnce(new Promise(resolve => { acknowledge = resolve; }));
    await mount();
    expect(stop()).toBeNull();

    await act(async () => input().click());
    expect(input().disabled).toBe(true);
    expect(stop().disabled).toBe(false);
    await act(async () => stop().click());
    expect(stop().disabled).toBe(true);
    await act(async () => stop().click());
    expect(pipeline.cancelExecution).not.toHaveBeenCalled();

    await act(async () => acknowledge({execution_id: executionId}));
    expect(pipeline.cancelExecution).toHaveBeenCalledTimes(1);
    expect(pipeline.cancelExecution).toHaveBeenCalledWith(agencyId, executionId);
    expect(input().disabled).toBe(true);

    getMessages.mockResolvedValue([userMessage]);
    await act(async () => stream(executionId, [], {extra_data: {execution_status: 'cancelled'}}));
    await advance(1);
    expect(pipeline.getExecutionStatus).not.toHaveBeenCalled();
    expect(stop()).toBeNull();
    expect(input().disabled).toBe(false);
    expect(transcript()).toEqual(['Hello']);

    await act(async () => stream(executionId, [assistantMessage]));
    expect(transcript()).toEqual(['Hello']);
    expect(onMessageReceived).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('checks cancellation promptly when the terminal live event is missed', async () => {
    await mount();
    await act(async () => input().click());
    const {execution_id: executionId} = pipeline.executePipelineAsync.mock.calls[0][0];
    pipeline.getExecutionStatus
      .mockResolvedValueOnce(status(executionId, 'cancellation_requested'))
      .mockResolvedValueOnce(status(executionId, 'cancelled'));
    getMessages.mockResolvedValue([userMessage]);

    await act(async () => stop().click());
    await advance(1);
    expect(pipeline.getExecutionStatus).toHaveBeenCalledTimes(1);
    expect(stop().disabled).toBe(true);
    expect(transcript()).toEqual(['Hello', 'Working']);
    await advance(2_000);
    expect(pipeline.getExecutionStatus).toHaveBeenCalledTimes(2);
    expect(stop()).toBeNull();
    expect(input().disabled).toBe(false);
    expect(transcript()).toEqual(['Hello']);
    expect(onError).not.toHaveBeenCalled();
  });

  it('lets the user retry a failed stop without discarding the pending turn', async () => {
    await mount();
    await act(async () => input().click());
    const {execution_id: executionId} = pipeline.executePipelineAsync.mock.calls[0][0];
    pipeline.cancelExecution
      .mockRejectedValueOnce(new Error('Request failed'))
      .mockResolvedValueOnce(status(executionId, 'cancelled'));

    await act(async () => stop().click());
    expect(stop().disabled).toBe(false);
    expect(input().disabled).toBe(true);
    expect(transcript()).toEqual(['Hello', 'Working']);
    expect(container.querySelector('.fusioni-chat-stop-error[role="alert"]')).not.toBeNull();
    expect(onError).toHaveBeenCalledTimes(1);

    getMessages.mockResolvedValue([userMessage]);
    await act(async () => stop().click());
    await advance(1);
    expect(pipeline.cancelExecution).toHaveBeenCalledTimes(2);
    expect(pipeline.getExecutionStatus).not.toHaveBeenCalled();
    expect(container.querySelector('.fusioni-chat-stop-error')).toBeNull();
    expect(stop()).toBeNull();
    expect(input().disabled).toBe(false);
    expect(transcript()).toEqual(['Hello']);
  });

  it('keeps a completed reply and a subsequent turn when an old stop request resolves', async () => {
    let resolveStop;
    pipeline.cancelExecution.mockReturnValueOnce(new Promise(resolve => { resolveStop = resolve; }));
    await mount();
    await act(async () => input().click());
    const {execution_id: executionId} = pipeline.executePipelineAsync.mock.calls[0][0];
    await act(async () => stop().click());
    await act(async () => stream(executionId, [userMessage, assistantMessage]));
    expect(transcript()).toEqual(['Hello', 'Done']);
    expect(stop()).toBeNull();

    await act(async () => input().click());
    await act(async () => resolveStop(status(executionId, 'completed')));
    expect(stop().disabled).toBe(false);
    expect(input().disabled).toBe(true);
    expect(transcript()).toEqual(['Hello', 'Done', 'Hello', 'Working']);
    expect(onError).not.toHaveBeenCalled();
  });

  it('restores a stopping turn without waiting for the normal response timeout', async () => {
    const executionId = 'execution-1';
    getMessages.mockResolvedValue([userMessage]);
    pipeline.getLatestExecutionStatus.mockResolvedValue(status(executionId, 'cancellation_requested', {
      created_at: new Date().toISOString(),
    }));
    pipeline.getExecutionStatus.mockResolvedValue(status(executionId, 'cancelled'));
    await mount();

    expect(stop().disabled).toBe(true);
    await advance(1);
    expect(pipeline.getExecutionStatus).toHaveBeenCalledTimes(1);
    expect(pipeline.cancelExecution).not.toHaveBeenCalled();
    expect(input().disabled).toBe(false);
    expect(transcript()).toEqual(['Hello']);
  });

  it('checks an idle conversation once without starting a polling loop', async () => {
    await mount();
    await advance(120_000);

    expect(pipeline.getLatestExecutionStatus).toHaveBeenCalledTimes(1);
    expect(pipeline.getExecutionStatus).not.toHaveBeenCalled();
    expect(input().disabled).toBe(false);
  });

  it('stops polling when the execution record is missing and recovers any saved reply', async () => {
    await mount();
    pipeline.executePipelineAsync.mockResolvedValue({});
    pipeline.getExecutionStatus.mockRejectedValueOnce(new AxiosError('Execution not found', undefined, undefined, undefined, {
      status: 404,
    }));
    getMessages.mockResolvedValue([userMessage, assistantMessage]);
    await act(async () => input().click());
    const {execution_id: executionId} = pipeline.executePipelineAsync.mock.calls[0][0];

    await advance(120_000);
    expect(pipeline.getExecutionStatus).toHaveBeenCalledTimes(1);
    expect(pipeline.getExecutionStatus).toHaveBeenCalledWith(agencyId, executionId, expect.any(AbortSignal));
    expect(transcript()).toEqual(['Hello', 'Done']);
    expect(input().disabled).toBe(false);
    expect(onError).not.toHaveBeenCalled();
  });

  it('stops retrying when execution status remains unavailable', async () => {
    await mount();
    pipeline.getExecutionStatus.mockRejectedValue(new Error('Status unavailable'));
    await act(async () => input().click());

    await advance(120_000);
    expect(pipeline.getExecutionStatus).toHaveBeenCalledTimes(3);
    expect(input().disabled).toBe(false);
  });

  it('restores a queued turn after remount and reads the full saved reply when SSE is missed', async () => {
    sessionStorage.removeItem('fusioni:selectedConversationId:agency');
    await mount();
    await act(async () => container.querySelector('.fusioni-chat-welcome button').click());
    await act(async () => input().click());
    const {execution_id: executionId} = pipeline.executePipelineAsync.mock.calls[0][0];
    expect(sessionStorage.getItem('fusioni:selectedConversationId:agency')).toBe(conversationId);
    await unmount();

    getMessages.mockResolvedValue([userMessage]);
    pipeline.getLatestExecutionStatus.mockResolvedValue(status(executionId, 'queued', {
      created_at: new Date(Date.now() - 60_000).toISOString(),
    }));
    await mount();
    expect(pipeline.getLatestExecutionStatus).toHaveBeenLastCalledWith(agencyId, conversationId, expect.any(AbortSignal));
    expect(input().disabled).toBe(true);
    expect(transcript()).toEqual(['Hello', 'Working']);
    expect(pipeline.executePipelineAsync).toHaveBeenCalledTimes(1);

    pipeline.getExecutionStatus
      .mockRejectedValueOnce(new Error('Temporary status failure'))
      .mockResolvedValue(status(executionId, 'completed'));
    getMessages
      .mockRejectedValueOnce(new Error('Temporary transcript failure'))
      .mockResolvedValue([userMessage, assistantMessage]);
    await advance(29_999);
    expect(pipeline.getExecutionStatus).not.toHaveBeenCalled();
    await advance(2_001);
    expect(pipeline.getExecutionStatus).toHaveBeenCalledTimes(2);
    expect(transcript()).toEqual(['Hello', 'Working']);
    await advance(2_000);
    expect(transcript()).toEqual(['Hello', 'Done']);
    expect(input().disabled).toBe(false);
    expect(onError).not.toHaveBeenCalled();

    await act(async () => stream(executionId, [userMessage, assistantMessage]));
    expect(transcript()).toEqual(['Hello', 'Done']);
    expect(onMessageReceived).toHaveBeenCalledTimes(1);
    expect(onMessageReceived).toHaveBeenCalledWith(assistantMessage);
  });

  it('recovers saved messages when a restored multi-agent turn ends with an empty event', async () => {
    const executionId = 'execution-1';
    getMessages.mockResolvedValueOnce([userMessage]).mockResolvedValue([userMessage, assistantMessage]);
    pipeline.getLatestExecutionStatus.mockResolvedValue(status(executionId, 'running', {
      created_at: new Date(Date.now()).toISOString(),
    }));
    await mount();

    await act(async () => stream(executionId, [], {extra_data: {multi_agent: true, multi_agent_complete: true}}));
    await advance(2_000);

    expect(transcript()).toEqual(['Hello', 'Done']);
    expect(input().disabled).toBe(false);
    expect(pipeline.getExecutionStatus).not.toHaveBeenCalled();
  });

  it('rereads the transcript if the turn completes during the initial load', async () => {
    const executionId = 'execution-1';
    getMessages.mockResolvedValueOnce([userMessage]).mockResolvedValueOnce([userMessage, assistantMessage]);
    pipeline.getLatestExecutionStatus.mockResolvedValue(status(executionId, 'completed'));

    await mount();

    expect(getMessages).toHaveBeenCalledTimes(2);
    expect(transcript()).toEqual(['Hello', 'Done']);
    expect(input().disabled).toBe(false);
  });

  it('keeps a live reply that arrives before the initial transcript resolves', async () => {
    let resolveTranscript;
    getMessages.mockReturnValueOnce(new Promise(resolve => { resolveTranscript = resolve; }));
    await mount();
    await act(async () => stream('execution-1', [assistantMessage]));
    await act(async () => resolveTranscript([userMessage]));

    expect(transcript()).toEqual(['Hello', 'Done']);
    expect(onMessageReceived).toHaveBeenCalledTimes(1);
  });

  it.each(['failed', 'cancelled'])('unlocks a restored turn when the execution is %s', async state => {
    const executionId = 'execution-1';
    getMessages.mockResolvedValue([userMessage]);
    pipeline.getLatestExecutionStatus.mockResolvedValue(status(executionId, 'running'));
    pipeline.getExecutionStatus.mockResolvedValue(status(executionId, state, {error_message: 'Worker failed'}));
    await mount();

    await advance(2_000);
    expect(input().disabled).toBe(false);
    expect(transcript()).toEqual(state === 'failed' ? ['Hello', 'Failed'] : ['Hello']);
    if (state === 'failed') {
      await act(async () => stream(executionId, [], {has_error: true, error_message: 'Worker failed'}));
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(new Error('Worker failed'));
    } else {
      expect(onError).not.toHaveBeenCalled();
    }
  });

  it('discards a recovery request after switching conversations', async () => {
    const executionId = 'execution-1';
    getMessages.mockResolvedValueOnce([userMessage]);
    pipeline.getLatestExecutionStatus.mockResolvedValueOnce(status(executionId, 'running'));
    pipeline.getExecutionStatus.mockResolvedValue(status(executionId, 'completed'));
    await mount();

    let resolveTranscript;
    getMessages.mockReturnValueOnce(new Promise(resolve => { resolveTranscript = resolve; }));
    await advance(2_000);
    const signal = getMessages.mock.lastCall[2];
    expect(signal.aborted).toBe(false);

    getMessages.mockResolvedValueOnce([{id: 'user-2', role: 'user', content: 'Other chat'}]);
    await act(async () => container.querySelectorAll('.fusioni-conversation-item')[1].click());
    expect(signal.aborted).toBe(true);
    await act(async () => resolveTranscript([userMessage, assistantMessage]));
    expect(transcript()).toEqual(['Other chat']);
    expect(input().disabled).toBe(false);
    expect(onMessageReceived).not.toHaveBeenCalled();
  });

  it('shows the fullest context from the latest usable reply per agent and updates on live replies', async () => {
    getMessages.mockResolvedValue([
      usageReply('old-alpha', {agent_id: 'a', used_tokens: 9_900, context_window: 10_000}),
      usageReply('beta', {
        agent_id: 'b', model: 'beta-model', used_tokens: 55_000, context_window: 100_000,
        estimated: true, dropped_history_messages: 2,
      }, {name: 'Beta', persona_name: 'Bea'}),
      usageReply('new-alpha', {agent_id: 'a', used_tokens: 4_500, context_window: 10_000}, {name: 'Alpha'}),
      usageReply('malformed-alpha', {agent_id: 'a', used_tokens: '9900', context_window: 10_000}),
      usageReply('unknown', {agent_id: 'c', used_tokens: 500_000}, {name: 'Unknown'}),
      {...userMessage, extra_data: {context_usage: {agent_id: 'b', used_tokens: 99_000, context_window: 100_000}}},
    ]);
    await mount({showContextUsageDetails: true});

    const meter = container.querySelector('.fusioni-context-usage');
    const summary = meter.querySelector('summary');
    expect(summary.getAttribute('aria-label')).toContain('55,000 / 100,000 tokens, 55%');
    const entries = [...meter.querySelectorAll('.fusioni-context-usage-entry')];
    expect(entries).toHaveLength(3);
    expect(entries[0].textContent).toContain('500,000 tokens');
    expect(entries[0].textContent).toContain('Context window size is unavailable');
    expect(entries[1].textContent).toContain('4,500 / 10,000 tokens');
    expect(entries[2].textContent).toContain('Bea');
    expect(entries[2].textContent).toContain('beta-model');
    expect(entries[2].textContent).toContain('Estimated usage');
    expect(entries[2].textContent).toContain('2 older messages');

    await act(async () => stream('live-execution', [
      usageReply('live-alpha', {agent_id: 'a', used_tokens: 11_000, context_window: 10_000}, {name: 'Alpha'}),
    ]));
    expect(summary.getAttribute('aria-label')).toContain('11,000 / 10,000 tokens, 110%');
    expect(summary.dataset.level).toBe('critical');
    expect(meter.querySelector('.fusioni-context-usage-track > div').style.width).toBe('100%');
  });

  it('shows usage without a percentage when none of the replies include a window size', async () => {
    getMessages.mockResolvedValue([
      usageReply('alpha', {agent_id: 'a', used_tokens: 2_100}),
      usageReply('beta', {agent_id: 'b', used_tokens: 1_200, context_window: 0}),
    ]);
    await mount({showContextUsage: true});

    const summary = container.querySelector('.fusioni-context-usage-summary');
    expect(summary.textContent).toContain('2,100 tokens');
    expect(summary.textContent).not.toContain('%');
    expect(container.querySelector('.fusioni-context-usage-track')).toBeNull();
  });

  it.each([undefined, false])('shows a static usage summary when details are %p', async showContextUsageDetails => {
    getMessages.mockResolvedValue([
      usageReply('alpha', {model: 'alpha-model', used_tokens: 2_500, context_window: 10_000}),
    ]);
    await mount({showContextUsageDetails});

    const meter = container.querySelector('.fusioni-context-usage');
    expect(meter.querySelector('.fusioni-context-usage-summary strong').textContent).toBe('25%');
    expect(meter.querySelector('summary, .fusioni-context-usage-panel, .fusioni-context-usage-chevron, [title]')).toBeNull();
    expect(meter.textContent).not.toContain('alpha-model');
  });

  it('hides context usage when disabled in the SDK configuration', async () => {
    SDKClientService.prototype.getClientConfig.mockResolvedValue({theme: 'light'});
    getMessages.mockResolvedValue([usageReply('alpha', {used_tokens: 250, context_window: 10_000})]);
    await mount({showContextUsage: false, showContextUsageDetails: true});
    expect(container.querySelector('.fusioni-context-usage')).toBeNull();
  });

  it('clears context usage when switching to a conversation without snapshots', async () => {
    getMessages
      .mockResolvedValueOnce([usageReply('alpha', {used_tokens: 40, context_window: 10_000})])
      .mockResolvedValueOnce([{...assistantMessage, id: 'other-assistant', conversation_id: otherConversationId}]);
    await mount();
    expect(container.querySelector('.fusioni-context-usage-summary').textContent).toContain('< 1%');

    await act(async () => container.querySelectorAll('.fusioni-conversation-item')[1].click());
    expect(container.querySelector('.fusioni-context-usage')).toBeNull();
  });
});

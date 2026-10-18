const {ActionButtonsController} = require('../src/utils/actionButtonsController');
const {ActionConversationStore} = require('../src/utils/actionConversationStore');

const action = (id, extra = {}) => ({id, key: id, title: id, agency_id: 'agency', enabled: true, show_results: true, ...extra});
const message = (id, role, content, created = '2026-10-01') => ({id, role, content, created, agency_id: 'agency', mem_type: 'short', keywords: [], thoughts: null});
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => {resolve = yes; reject = no;}); return {promise, resolve, reject}; };
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

describe('action execution and conversations', () => {
  let props, controller, client, actions, profiles;
  beforeEach(() => {
    sessionStorage.clear(); actions = [action('first'), action('second')]; profiles = [];
    client = {get: jest.fn(async url => url === '/action/by_group_tags' ? actions : url === '/action/conversation-profiles' ? profiles : {body: []}),
      post: jest.fn(async () => ({answer: ['Done'], conversation_id: 'thread'}))};
    props = {agencyId: 'agency', tags: [' tools ', 'tools', '', 'reports'], apiClient: client, onResponse: jest.fn(), onError: jest.fn()};
    controller = new ActionButtonsController(() => props, jest.fn());
  });
  afterEach(() => {controller.dispose(); jest.restoreAllMocks(); jest.useRealTimers();});

  it('normalizes tags, filters disabled actions, and queries profiles in parallel', async () => {
    actions.push(action('disabled', {enabled: false}), {title: 'No ID'});
    await controller.loadActions();
    expect(client.get.mock.calls[0][1].params).toEqual({agency_id: 'agency', tags: ['tools', 'reports']});
    expect(client.get.mock.calls[0][1].paramsSerializer).toEqual({indexes: null});
    expect(controller.state.actions.map(item => item.id)).toEqual(['first', 'second']);
    expect(client.get).toHaveBeenCalledWith('/action/conversation-profiles', expect.objectContaining({params: {agency_id: 'agency'}}));
  });

  it.each([{agencyId: null}, {tags: [' ', '']}])('does not query without agency and tags: %j', async extra => {
    props = {...props, ...extra}; await controller.loadActions(); expect(client.get).not.toHaveBeenCalled();
  });

  it('disables by key and rechecks current overrides at submission', async () => {
    actions[0].key = 'report'; props.actionEnabledStates = {first: false};
    await controller.loadActions(); await controller.executeAction('first'); expect(client.post).toHaveBeenCalledTimes(1);
    props.actionEnabledStates = {report: false}; await controller.executeAction('first'); expect(client.post).toHaveBeenCalledTimes(1);
  });

  it('merges shared and action-specific values, ignores unknown fields and skips the form', async () => {
    actions[0].conversation_profile_id = 'profile';
    profiles = [{id: 'profile', input_fields: [{name: 'topic', type: 'text', required: true}, {name: 'count', type: 'number', required: true},
      {name: 'enabled', type: 'boolean', required: true}, {name: 'file', type: 'file', required: false}, {name: 'chat', type: 'chat', required: false}]}];
    props.actionInputFieldValues = {'*': {topic: 'shared', count: 0, enabled: false, unknown: 'secret'}, first: {topic: 'own', file: ['data:file'], chat: 'ignored'}};
    await controller.loadActions(); await controller.executeAction('first');
    expect(controller.state.fieldFormVisible).toBe(false);
    expect(client.post.mock.calls[0][1]).toEqual({action_id: 'first', lang: 'en', context: {topic: 'own', count: 0, enabled: false}, image: ['data:file']});
  });

  it('keeps required fields in declaration order even when unselected and validates typed drafts', async () => {
    actions[0] = action('first', {conversation_profile_id: 'profile', conversation_profile_input_field_names: ['prompt']});
    profiles = [{id: 'profile', input_fields: [{name: 'ignored', type: 'text', required: false}, {name: 'count', type: 'number', required: true,
      validation_rules: [{operator: 'greater_than', value: 2}]}, {name: 'prompt', type: 'prompt', required: false}]}];
    await controller.loadActions(); await controller.executeAction('first');
    expect(controller.promptedFields().map(field => field.name)).toEqual(['count', 'prompt']);
    controller.setFieldValue('count', '2'); controller.setFieldValue('prompt', '  retained draft  ');
    await controller.submitFields(); expect(client.post).not.toHaveBeenCalled(); expect(controller.state.fieldValues.prompt).toBe('  retained draft  ');
    controller.setFieldValue('count', '3.5'); controller.setPromptAttachments('prompt', ['image']);
    controller.setUploadsPending('prompt', true); await controller.submitFields(); expect(client.post).not.toHaveBeenCalled();
    controller.setUploadsPending('prompt', false); await controller.submitFields();
    expect(client.post.mock.calls[0][1]).toEqual({action_id: 'first', lang: 'en', context: {count: 3.5, prompt: 'retained draft'}, image: ['image']});
  });

  it('blocks invalid supplied required values instead of prompting or running', async () => {
    actions[0].conversation_profile_id = 'profile'; profiles = [{id: 'profile', input_fields: [{name: 'topic', type: 'text', required: true}]}];
    props.actionInputFieldValues = {'*': {topic: null}};
    await controller.loadActions(); await controller.executeAction('first');
    expect(client.post).not.toHaveBeenCalled(); expect(controller.state.fieldFormVisible).toBe(false);
    expect(controller.state.executionError).toContain('required');
  });

  it('loads a missing profile before execution and blocks execution on lookup failure', async () => {
    actions[0].conversation_profile_id = 'missing'; await controller.loadActions();
    client.get.mockImplementation(async () => {throw new Error('missing');});
    await controller.executeAction('first');
    expect(client.post).not.toHaveBeenCalled(); expect(controller.state.executionError).toContain('profile');
    client.get.mockResolvedValue({id: 'missing', input_fields: []}); await controller.executeAction('first');
    expect(client.post).toHaveBeenCalledTimes(1);
  });

  it('maintains separate conversations, rereads session storage, orders turns and resets one action', async () => {
    actions = [action('first', {maintain_conversation: true, results_sort: 'desc'}), action('second', {maintain_conversation: true})];
    client.post.mockImplementation(async (_, request) => ({conversation_id: `thread-${request.action_id}`, messages: [
      message(`u-${client.post.mock.calls.length}`, 'user', request.action_id), message(`a-${client.post.mock.calls.length}`, 'assistant', 'reply')]}));
    await controller.loadActions(); await controller.executeAction('first'); await controller.executeAction('second');
    new ActionConversationStore('agency').set('first', 'changed-externally');
    await controller.executeAction('first');
    expect(client.post.mock.calls[2][1].conversation_id).toBe('changed-externally');
    expect(controller.state.messages.first.map(item => item.id)).toEqual(['u-3', 'a-3', 'u-1', 'a-1']);
    expect(props.onResponse.mock.calls[2][0]).toHaveLength(2);
    controller.startNewConversation('first');
    expect(controller.state.conversations).toEqual({second: 'thread-second'});
    expect(controller.state.messages.first).toBeUndefined();
    await controller.executeAction('first'); expect(client.post.mock.calls[3][1].conversation_id).toBeUndefined();
  });

  it('one-shot actions clear earlier results and never reuse conversation IDs', async () => {
    await controller.loadActions(); await controller.executeAction('first'); await controller.executeAction('first');
    expect(controller.state.results.first).toHaveLength(1); expect(props.onResponse.mock.calls[1][0]).toHaveLength(1);
    expect(client.post.mock.calls.every(call => !call[1].conversation_id)).toBe(true);
    expect(controller.state.conversations).toEqual({});
  });

  it('emits responses without storing hidden results while preserving maintained IDs', async () => {
    actions = [action('first', {maintain_conversation: true, show_results: false})];
    await controller.loadActions(); await controller.executeAction('first');
    expect(controller.state.results).toEqual({}); expect(controller.state.messages).toEqual({});
    expect(controller.state.conversations.first).toBe('thread'); expect(props.onResponse).toHaveBeenCalledWith([expect.objectContaining({content: 'Done'})]);
  });

  it('restores histories independently, selects the most recent, and does not emit restored results', async () => {
    actions = ['first', 'second', 'broken'].map(id => action(id, {maintain_conversation: true}));
    const store = new ActionConversationStore('agency'); actions.forEach(item => store.set(item.id, `thread-${item.id}`));
    const load = client.get.getMockImplementation(); client.get.mockImplementation(async (url, options) => {
      if (url !== '/mem/messages') return load(url, options);
      const id = options.params.conversation_id;
      if (id.includes('broken')) throw new Error('history unavailable');
      return {body: [message('u', 'user', 'question'), message('a', 'assistant', id, id.includes('second') ? '2026-10-04' : '2026-10-02')]};
    });
    await controller.loadActions(); await tick();
    expect(controller.state.selectedAction.id).toBe('second'); expect(controller.state.results.first).toHaveLength(1);
    expect(controller.state.results.broken).toBeUndefined(); expect(props.onResponse).not.toHaveBeenCalled();
  });

  it('does not restore history when results are globally hidden', async () => {
    actions[0].maintain_conversation = true; new ActionConversationStore('agency').set('first', 'saved'); props.showActionResult = false;
    await controller.loadActions(); await tick(); expect(client.get.mock.calls.some(call => call[0] === '/mem/messages')).toBe(false);
  });

  it('ignores history arriving after a new conversation or live execution', async () => {
    actions[0].maintain_conversation = true; new ActionConversationStore('agency').set('first', 'saved');
    const history = deferred(); const load = client.get.getMockImplementation();
    client.get.mockImplementation((url, options) => url === '/mem/messages' ? history.promise : load(url, options));
    await controller.loadActions(); controller.startNewConversation('first'); await controller.executeAction('first');
    history.resolve({body: [message('old', 'assistant', 'Stale')]}); await tick();
    expect(controller.state.results.first.map(item => item.content)).toEqual(['Done']);
  });

  it('cancels superseded requests and prevents late responses or duplicate execution', async () => {
    await controller.loadActions(); const response = deferred(); client.post.mockReturnValue(response.promise);
    const executing = controller.executeAction('first'); await controller.executeAction('second');
    expect(client.post).toHaveBeenCalledTimes(1); const signal = client.post.mock.calls[0][2].signal;
    await controller.loadActions(); expect(signal.aborted).toBe(true);
    response.resolve({answer: ['Stale']}); await executing;
    expect(controller.state.results).toEqual({}); expect(props.onResponse).not.toHaveBeenCalled();
  });

  it('reports errors, permits retry and returns success icons to idle', async () => {
    jest.useFakeTimers(); await controller.loadActions(); client.post.mockRejectedValueOnce({response: {data: {detail: 'Try a different input'}}});
    await controller.executeAction('first'); expect(controller.state.executionError).toBe('Try a different input');
    expect(controller.state.executionStates.first).toBe('error'); expect(props.onError).toHaveBeenCalledTimes(1);
    await controller.executeAction('first'); expect(controller.state.executionStates.first).toBe('success');
    jest.advanceTimersByTime(5000); expect(controller.state.executionStates.first).toBe('idle');
  });

  it('keeps IDs usable when storage writes or reads are blocked', () => {
    const store = new ActionConversationStore('agency');
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {throw new Error('quota');});
    store.set('first', 'memory'); expect(store.read()).toEqual({first: 'memory'});
    store.set('second', 'other'); store.set('first'); expect(store.read()).toEqual({second: 'other'});
  });
});

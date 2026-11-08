const {ApiClient, getApiClient, initializeApiClient} = require('../src/services/ApiClient');
const {RemoteConversationService} = require('../src/services/ConversationService');
const {MessageService} = require('../src/services/MessageService');
const {PipelineService} = require('../src/services/PipelineService');
const {ActionService} = require('../src/services/ActionService');
const {SDKClientService} = require('../src/services/SDKClientService');
const axios = require('axios').default;

describe('Agency query parameters on SDK backend requests', () => {
  let client, requests;
  const uri = request => new URL(axios.getUri(request));
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    requests = [];
    client = new ApiClient('https://fusion.test/api', 'token', 'default-agency');
    client.client.defaults.adapter = async config => {
      requests.push(config);
      const data = config.method === 'post' && config.url === '/conversation' ? 'conversation-id'
        : config.url.startsWith('/journey') ? {answer: [], messages: [], thoughts: []} : {};
      return {data, status: 200, statusText: 'OK', headers: {}, config};
    };
  });
  afterEach(() => jest.restoreAllMocks());

  it('scopes every HTTP method without changing filters, body, authentication or cancellation', async () => {
    const params = Object.freeze({tags: ['tools', 'reports'], page: 2});
    const signal = new AbortController().signal;
    const config = {params, paramsSerializer: {indexes: null}, signal};
    await client.get('/items', config);
    await client.post('/items', {value: 1}, config);
    await client.put('/items', {value: 2}, config);
    await client.delete('/items', config);
    await client.options('/items', config);
    await client.request('/items', {...config, method: 'PATCH', data: {value: 3}});
    await client.request('/items', {...config, method: 'HEAD'});
    expect(requests.map(request => request.method)).toEqual(['get', 'post', 'put', 'delete', 'options', 'patch', 'head']);
    for (const request of requests) {
      const query = uri(request).searchParams;
      expect(query.getAll('agency_id')).toEqual(['default-agency']);
      expect(query.getAll('tags')).toEqual(['tools', 'reports']); expect(query.get('page')).toBe('2');
      expect(request.headers.get('Authorization')).toBe('ApiKey token'); expect(request.signal).toBe(signal);
    }
    expect(JSON.parse(requests[1].data)).toEqual({value: 1});
    expect(params).toEqual({tags: ['tools', 'reports'], page: 2});
  });

  it('retains explicit request agencies, de-duplicates inline agencies, and preserves URL filters', async () => {
    await client.post('/items?agency_id=inline&filter=a%20b#fragment', {agency_id: 'body'}, {params: {agency_id: 'request', size: 10}});
    expect(uri(requests[0]).searchParams.getAll('agency_id')).toEqual(['request']);
    expect(uri(requests[0]).searchParams.get('filter')).toBe('a b'); expect(uri(requests[0]).searchParams.get('size')).toBe('10');
    expect(JSON.parse(requests[0].data)).toEqual({agency_id: 'body'});
    await client.get('/items?agency_id=inline&agency_id=duplicate&item_id=one');
    expect(uri(requests[1]).searchParams.getAll('agency_id')).toEqual(['inline']);
    expect(uri(requests[1]).searchParams.get('item_id')).toBe('one');
    expect(client.getAgencyId()).toBe('default-agency');
  });

  it('copies URLSearchParams without losing repeated keys or mutating the original', async () => {
    const params = new URLSearchParams('tags=tools&tags=reports&agency_id=request');
    await client.get('/items?agency_id=inline', {params});
    expect(uri(requests[0]).searchParams.getAll('tags')).toEqual(['tools', 'reports']);
    expect(uri(requests[0]).searchParams.getAll('agency_id')).toEqual(['request']);
    expect(params.toString()).toBe('tags=tools&tags=reports&agency_id=request');
  });

  it.each(['object', 'json', 'form', 'urlencoded'])('adds an agency supplied only in a %s body to the query too', async format => {
    const body = format === 'object' ? {agency_id: 'body-agency', inp: 'query'}
      : format === 'json' ? '{"agency_id":"body-agency","inp":"query"}'
      : format === 'form' ? new FormData() : new URLSearchParams();
    if (format === 'form' || format === 'urlencoded') {body.set('agency_id', 'body-agency'); body.set('inp', 'query');}
    await client.post('/items', body);
    expect(uri(requests[0]).searchParams.getAll('agency_id')).toEqual(['body-agency']);
  });

  it('rejects unscoped requests instead of sending an empty or undefined agency', async () => {
    const unscoped = new ApiClient('https://fusion.test/api', 'token');
    unscoped.client.defaults.adapter = client.client.defaults.adapter;
    await expect(unscoped.get('/items')).rejects.toThrow('agencyId is required');
    await expect(unscoped.get('/items?agency_id=', {params: {agency_id: ' '}})).rejects.toThrow('agencyId is required');
    expect(requests).toHaveLength(0);
    await unscoped.post('/items', {agency_id: 'provided'});
    expect(uri(requests[0]).searchParams.get('agency_id')).toBe('provided');
    await expect(unscoped.get('/items')).rejects.toThrow('agencyId is required');
  });

  it('scopes ID lookups, deletes, configuration, conversation creation, feedback, and journeys', async () => {
    const shared = initializeApiClient('https://fusion.test/api', 'token', 'default-agency');
    shared.client.defaults.adapter = client.client.defaults.adapter;
    expect(getApiClient().getAgencyId()).toBe('default-agency');
    const conversations = new RemoteConversationService(shared);
    await conversations.getConversation('conversation-id');
    await conversations.deleteConversation('conversation-id');
    await conversations.createConversation({agency_id: 'default-agency', title: 'Example'});
    await new MessageService(shared).likeMessage('message-id', 'default-agency', 1);
    await new ActionService(shared).getConversationProfile('profile-id');
    await new SDKClientService().getClientConfig('default-agency');
    const pipeline = new PipelineService(shared);
    await pipeline.executePipeline({agency_id: 'default-agency', conversation_id: 'conversation-id', inp: 'Hello'});
    await pipeline.executePipelineAsync({agency_id: 'default-agency', conversation_id: 'conversation-id', inp: 'Hello'});
    await pipeline.getLatestExecutionStatus('default-agency', 'conversation-id');
    await pipeline.getExecutionStatus('default-agency', 'execution-id');
    await pipeline.cancelExecution('default-agency', 'execution/id');
    expect(requests).toHaveLength(11);
    requests.forEach(request => expect(uri(request).searchParams.getAll('agency_id')).toEqual(['default-agency']));
    expect(uri(requests[0]).searchParams.get('item_id')).toBe('conversation-id');
    expect(JSON.parse(requests[2].data).agency_id).toBe('default-agency');
    expect(JSON.parse(requests[3].data).like).toBe(1);
    expect(uri(requests[8]).pathname).toBe('/api/journey/executions/latest');
    expect(uri(requests[8]).searchParams.get('conversation_id')).toBe('conversation-id');
    expect(uri(requests[9]).pathname).toBe('/api/journey/executions/execution-id');
    expect(uri(requests[10]).pathname).toBe('/api/journey/executions/execution%2Fid/cancel');
    expect(requests[10].method).toBe('post');
    expect(JSON.parse(requests[10].data)).toEqual({});
  });

  it('keeps agencies independent across initialized clients', async () => {
    const first = initializeApiClient('https://fusion.test/api', 'token', 'first');
    first.client.defaults.adapter = client.client.defaults.adapter;
    const second = initializeApiClient('https://fusion.test/api', 'token', 'second');
    second.client.defaults.adapter = client.client.defaults.adapter;
    await Promise.all([first.get('/first'), second.get('/second')]);
    expect(uri(requests.find(request => request.url === '/first')).searchParams.get('agency_id')).toBe('first');
    expect(uri(requests.find(request => request.url === '/second')).searchParams.get('agency_id')).toBe('second');
  });

  it('preserves the agency on SSE connections and can use the configured agency', () => {
    const previous = global.EventSource;
    global.EventSource = jest.fn(function (url) {this.url = url; this.addEventListener = jest.fn();});
    try {
      const stream = client.connectToSSE('', jest.fn(), 'conversation-id');
      expect(new URL(stream.url).searchParams.get('agency_id')).toBe('default-agency');
      expect(new URL(stream.url).searchParams.get('conversation_id')).toBe('conversation-id');
      const explicit = client.connectToSSE('other', jest.fn());
      expect(new URL(explicit.url).searchParams.get('agency_id')).toBe('other');
    } finally {global.EventSource = previous;}
  });
});

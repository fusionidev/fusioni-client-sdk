const {MiniAppBackendService, MiniAppBackendError} = require('../src/services/MiniAppBackendService');

describe('MiniAppBackendService', () => {
  let client, service;
  beforeEach(() => {
    client = {request: jest.fn().mockResolvedValue({ok: true}), post: jest.fn().mockResolvedValue({path: 'mini-app-files/signed/'})};
    service = new MiniAppBackendService(client);
  });

  it('preserves methods, bodies, headers, response types and cancellation', async () => {
    const signal = new AbortController().signal;
    await service.request(' app one ', ' agency ', '/items/a%20b', {
      method: 'PATCH', body: {value: 1}, headers: {'X-Custom': 'yes'}, responseType: 'text', signal,
      query: {page: 2, active: true, agency_id: 'other', TOKEN: 'other'},
    });
    const [url, config] = client.request.mock.calls[0];
    expect(url).toBe('/mini-app-runtime/app%20one/items/a%20b');
    expect(Object.fromEntries(config.params)).toEqual({agency_id: 'agency', page: '2', active: 'true'});
    expect(config).toMatchObject({method: 'PATCH', data: {value: 1}, headers: {'X-Custom': 'yes'}, responseType: 'text'});
    expect(config.signal).toBe(signal);
  });

  it('creates frozen installed and builder contexts', async () => {
    const installed = service.createContext(' app ', ' agency ');
    const builder = service.createBuilderContext(' draft ', ' agency ');
    expect(Object.isFrozen(installed)).toBe(true);
    expect(Object.isFrozen(installed.backend)).toBe(true);
    expect(installed.miniAppId).toBe('app');
    expect(installed.runtime).toBe('installed'); expect(builder.runtime).toBe('builder');
    await installed.backend.request('/health');
    await builder.backend.request('/health');
    expect(client.request.mock.calls.map(call => call[0])).toEqual(['/mini-app-runtime/app/health', '/mini-app-runtime/builder/draft/health']);
  });

  it('grants one signed URL per runtime, app, agency and bundle version, across service instances', async () => {
    const first = service.filesBase(' app one ', ' agency ', 'installed', 'v1');
    expect(service.filesBase('app one', 'agency', 'installed', 'v1')).toBe(first);
    expect(new MiniAppBackendService(client).filesBase('app one', 'agency', 'installed', 'v1')).toBe(first);
    await expect(first).resolves.toBe('/api/mini-app-files/signed/');
    expect(client.post).toHaveBeenCalledWith('/mini-app-files/installed/app%20one', {}, {params: {agency_id: 'agency'}});
    await service.filesBase('app one', 'agency', 'installed', 'v2');
    await service.filesBase('app one', 'agency', 'builder', 'v1');
    await service.filesBase('app one', 'other-agency', 'installed', 'v1'); expect(client.post).toHaveBeenCalledTimes(4);
  });

  it('keeps file URLs stable for separate clients with the same connection and isolates other credentials', async () => {
    client.getBaseUrl = () => 'https://connection.test/api'; client.getAccessToken = () => 'first-token';
    const clone = {...client, post: jest.fn().mockResolvedValue({path: 'mini-app-files/clone/'})};
    const first = service.filesBase('shared-app', 'agency', 'installed', 'v1');
    expect(new MiniAppBackendService(clone).filesBase('shared-app', 'agency', 'installed', 'v1')).toBe(first);
    await expect(first).resolves.toBe('https://connection.test/api/mini-app-files/signed/'); expect(clone.post).not.toHaveBeenCalled();
    clone.getAccessToken = () => 'other-token'; await new MiniAppBackendService(clone).filesBase('shared-app', 'agency', 'installed', 'v1');
    expect(clone.post).toHaveBeenCalledTimes(1);
  });

  it('evicts failed grants so reload can retry and preserves backend error detail', async () => {
    client.post.mockRejectedValueOnce({isAxiosError: true, response: {status: 503, data: {detail: 'Runtime unavailable'}}, message: 'HTTP 503'});
    await expect(service.filesBase('app', 'agency', 'installed', 'v1')).rejects.toMatchObject({name: 'MiniAppBackendError', status: 503, message: 'Runtime unavailable'});
    await expect(service.filesBase('app', 'agency', 'installed', 'v1')).resolves.toBe('/api/mini-app-files/signed/'); expect(client.post).toHaveBeenCalledTimes(2);
  });

  it('rejects invalid grant responses and permits retry', async () => {
    client.post.mockResolvedValueOnce({}); await expect(service.filesBase('app', 'agency', 'installed', 'v1')).rejects.toThrow('path');
    await expect(service.filesBase('app', 'agency', 'installed', 'v1')).resolves.toBe('/api/mini-app-files/signed/');
  });

  it('requires identifiers and a supported runtime before requesting file access', () => {
    expect(() => service.filesBase(null, 'agency', 'installed', 'v1')).toThrow('Mini App ID');
    expect(() => service.filesBase('app', '', 'installed', 'v1')).toThrow('Agency ID');
    expect(() => service.filesBase('app', 'agency', 'other', 'v1')).toThrow('Unsupported'); expect(client.post).not.toHaveBeenCalled();
  });

  it.each(['https://other.test/path', '//other.test/path', '/items?x=1', '/items#x', '/..', '/%2e%2e/items', '/.', '/%zz'])('rejects invalid paths: %s', async path => {
    await expect(service.request('app', 'agency', path)).rejects.toThrow();
    expect(client.request).not.toHaveBeenCalled();
  });

  it('requires identifiers and supported methods', async () => {
    await expect(service.request(null, 'agency', '/')).rejects.toThrow('Mini App ID is required');
    await expect(service.request('app', ' ', '/')).rejects.toThrow('Agency ID is required');
    await expect(service.request('app', 'agency', '/', {method: 'TRACE'})).rejects.toThrow('Unsupported');
    expect(client.request).not.toHaveBeenCalled();
  });

  it('normalizes backend errors with status and response', async () => {
    const response = {detail: 'Backend unavailable'};
    client.request.mockRejectedValue({isAxiosError: true, response: {status: 503, data: response}, message: 'HTTP 503'});
    await expect(service.request('app', 'agency', '/')).rejects.toMatchObject({name: 'MiniAppBackendError', message: 'Backend unavailable', status: 503, response});
    await expect(service.request('app', 'agency', '/')).rejects.toBeInstanceOf(MiniAppBackendError);
  });

  it('rejects already cancelled requests and normalizes cancellation in flight', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(service.request('app', 'agency', '/', {signal: controller.signal})).rejects.toMatchObject({name: 'AbortError'});
    expect(client.request).not.toHaveBeenCalled();
    client.request.mockRejectedValue({__CANCEL__: true});
    await expect(service.request('app', 'agency', '/')).rejects.toMatchObject({name: 'AbortError'});
  });
});

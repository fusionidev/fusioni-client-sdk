const {ApiClient} = require('../src/services/ApiClient');
const {MiniAppService} = require('../src/services/MiniAppService');
const {MiniAppCatalogService} = require('../src/services/MiniAppCatalogService');
const {MiniAppBackendService} = require('../src/services/MiniAppBackendService');
const axios = require('axios').default;

describe('Mini App API transport', () => {
  let client, requests;
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    requests = [];
    client = new ApiClient('https://fusion.test/api', 'sdk-token');
    client.client.defaults.adapter = async config => {
      requests.push(config);
      return {data: [], status: 200, statusText: 'OK', headers: {}, config};
    };
  });
  afterEach(() => jest.restoreAllMocks());

  it('uses API base URL/authentication and repeated, unbracketed tags', async () => {
    await new MiniAppService(client).findByTags('agency', ['billing', 'reports']);
    const request = requests[0];
    expect(axios.getUri(request)).toBe('https://fusion.test/api/mini-app/by-tags?agency_id=agency&tags=billing&tags=reports');
    expect(request.headers.get('Authorization')).toBe('ApiKey sdk-token');
    await new MiniAppCatalogService(client).findByPosition('agency', 'dashboard');
    expect(axios.getUri(requests[1])).toBe('https://fusion.test/api/mini-app-catalog/by-position?agency_id=agency&position=dashboard');
  });

  it('supports generic backend HTTP methods through ApiClient', async () => {
    const backend = new MiniAppBackendService(client);
    await backend.request('app', 'agency', '/items', {method: 'PATCH', body: {value: 1}});
    await backend.request('app', 'agency', '/health', {method: 'HEAD'});
    expect(requests[0].method).toBe('patch');
    expect(requests[0].data).toBe('{"value":1}');
    expect(axios.getUri(requests[0])).toBe('https://fusion.test/api/mini-app-runtime/app/items?agency_id=agency');
    expect(requests[1].method).toBe('head');
  });

  it('authenticates signed file grants and resolves their paths under the configured API base', async () => {
    client.client.defaults.adapter = async config => {
      requests.push(config); return {data: {path: 'mini-app-files/token/'}, status: 200, statusText: 'OK', headers: {}, config};
    };
    const base = await new MiniAppBackendService(client).filesBase('bundle-app', 'agency', 'builder', 'bundle-v1');
    expect(base).toBe('https://fusion.test/api/mini-app-files/token/');
    expect(axios.getUri(requests[0])).toBe('https://fusion.test/api/mini-app-files/builder/bundle-app?agency_id=agency');
    expect(requests[0].method).toBe('post'); expect(requests[0].data).toBe('{}'); expect(requests[0].headers.get('Authorization')).toBe('ApiKey sdk-token');
  });
});

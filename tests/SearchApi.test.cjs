const {ApiClient, initializeApiClient} = require('../src/services/ApiClient');
const {SearchService, getSearchService} = require('../src/services/SearchService');
const axios = require('axios').default;

describe('Search API transport', () => {
  let client, requests, response;
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    requests = [];
    response = {body: [{id: 'guide', name: 'Guide', url: '/guide'}], pagination: {page: 2, size: 5, last: false}};
    client = new ApiClient('https://fusion.test/api/', 'search-token');
    client.client.defaults.adapter = async config => {
      requests.push(config);
      return {data: response, status: 200, statusText: 'OK', headers: {}, config};
    };
  });
  afterEach(() => jest.restoreAllMocks());

  it('calls search_paginated with the FusionSearchDTO, zero-based pagination and authentication', async () => {
    const signal = new AbortController().signal;
    expect(await new SearchService(client).search('agency', '  setup guide  ', {page: 2, size: 5, signal})).toEqual(response);
    expect(axios.getUri(requests[0])).toBe('https://fusion.test/api/sdk-client/dpsearch?page=2&size=5&agency_id=agency');
    expect(requests[0].method).toBe('post');
    expect(JSON.parse(requests[0].data)).toEqual({agency_id: 'agency', inp: 'setup guide'});
    expect(requests[0].headers.get('Authorization')).toBe('ApiKey search-token');
    expect(requests[0].signal).toBe(signal);
  });

  it('calls search_autocomplete and normalizes nullable payloads', async () => {
    response = {body: null, pagination: null};
    expect(await new SearchService(client).autocomplete('agency', 'guide')).toEqual({body: [], pagination: null});
    expect(axios.getUri(requests[0])).toBe('https://fusion.test/api/fusion_data/asearch?page=0&size=25&agency_id=agency');
    response = null;
    expect(await new SearchService(client).search('agency', 'guide')).toEqual({body: [], pagination: null});
  });

  it('uses the initialized SDK client when no client is supplied', async () => {
    const shared = initializeApiClient('https://shared.test', 'shared-token');
    shared.client.defaults.adapter = client.client.defaults.adapter;
    await getSearchService().search('agency', 'guide');
    expect(axios.getUri(requests[0])).toBe('https://shared.test/sdk-client/dpsearch?page=0&size=25&agency_id=agency');
    expect(requests[0].headers.get('Authorization')).toBe('ApiKey shared-token');
  });

  it('rejects invalid paging and agency configuration before making requests', async () => {
    const service = new SearchService(client);
    await expect(service.search(' ', 'guide')).rejects.toThrow('agencyId');
    for (const options of [{page: -1}, {page: 0.5}, {size: 0}, {size: NaN}]) {
      await expect(service.search('agency', 'guide', options)).rejects.toThrow('page');
    }
    expect(requests).toHaveLength(0);
  });

  it('propagates transport errors and supports request cancellation', async () => {
    client.client.defaults.adapter = async () => {throw new Error('offline');};
    await expect(new SearchService(client).search('agency', 'guide')).rejects.toThrow('offline');
    const controller = new AbortController(); controller.abort();
    await expect(new SearchService(client).autocomplete('agency', 'guide', {signal: controller.signal})).rejects.toMatchObject({code: 'ERR_CANCELED'});
  });
});

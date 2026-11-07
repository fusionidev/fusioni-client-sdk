import type {AxiosRequestConfig} from 'axios';

const agencyValue = (value: unknown): string | undefined => typeof value === 'string' ? value.trim() || undefined : undefined;

function bodyAgency(data: unknown): string | undefined {
  if (typeof data === 'string') {
    try { return bodyAgency(JSON.parse(data)); } catch { return undefined; }
  }
  if (data instanceof URLSearchParams || (typeof FormData !== 'undefined' && data instanceof FormData)) {
    return agencyValue(data.get('agency_id'));
  }
  return data && typeof data === 'object' ? agencyValue((data as {agency_id?: unknown}).agency_id) : undefined;
}

/** Add one agency query parameter, retaining request-specific scope and existing filters. */
export function withAgencyQuery<T extends AxiosRequestConfig>(config: T, defaultAgencyId?: string): T {
  const url = config.url ?? '';
  const hashIndex = url.indexOf('#');
  const address = hashIndex < 0 ? url : url.slice(0, hashIndex);
  const queryIndex = address.indexOf('?');
  const query = new URLSearchParams(queryIndex < 0 ? '' : address.slice(queryIndex + 1));
  const params = config.params;
  const agencyId = agencyValue(params instanceof URLSearchParams ? params.get('agency_id') : params?.agency_id)
    ?? agencyValue(query.get('agency_id')) ?? bodyAgency(config.data) ?? agencyValue(defaultAgencyId);
  if (!agencyId) {
    throw new Error('Fusioni SDK: agencyId is required for backend requests. Supply it when initializing the SDK or ApiClient.');
  }
  if (params instanceof URLSearchParams) {
    const scoped = new URLSearchParams(params);
    scoped.set('agency_id', agencyId);
    config.params = scoped;
  } else {
    config.params = {...params, agency_id: agencyId};
  }
  // Move an inline agency into params so Axios cannot send two agency values.
  if (query.has('agency_id')) {
    query.delete('agency_id');
    const remaining = query.toString();
    config.url = `${address.slice(0, queryIndex)}${remaining ? `?${remaining}` : ''}${hashIndex < 0 ? '' : url.slice(hashIndex)}`;
  }
  return config;
}

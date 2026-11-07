import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ApiClient} from '../services/ApiClient';
import {SearchService} from '../services/SearchService';
import type {SearchProps, SearchResponse} from '../types/search';

const emptyResponse = (): SearchResponse => ({body: [], pagination: null});
const initialState = (query = '') => ({
  query, response: emptyResponse(), page: 0, loading: false, searched: false,
  error: false, open: false, activeIndex: -1,
});

/** Shared request lifecycle for both the React component and script-tag mount. */
export function useSearch(props: SearchProps) {
  const {agencyId, mode = 'search', pageSize = 25, minLength = 2, debounceMs = 250} = props;
  const service = useMemo(() => new SearchService(props.apiClient ?? (props.apiBaseUrl
    ? new ApiClient(props.apiBaseUrl, props.accessToken, props.agencyId) : undefined)), [props.apiClient, props.apiBaseUrl, props.accessToken, props.agencyId]);
  const [state, setState] = useState(initialState);
  const callbacks = useRef(props);
  callbacks.current = props;
  const queryRef = useRef('');
  const submittedQuery = useRef('');
  const sequence = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    sequence.current += 1;
    abort.current?.abort();
    abort.current = null;
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const clear = useCallback((query = '') => {
    cancel();
    queryRef.current = query;
    submittedQuery.current = '';
    setState(initialState(query));
  }, [cancel]);

  const search = useCallback(async (query = queryRef.current, page = 0): Promise<void> => {
    cancel();
    queryRef.current = query;
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < minLength) {
      clear(query);
      return;
    }
    const requestId = sequence.current;
    const controller = new AbortController();
    abort.current = controller;
    submittedQuery.current = trimmed;
    setState({...initialState(query), page, loading: true, open: true});
    let response: SearchResponse;
    try {
      response = await service[mode === 'autocomplete' ? 'autocomplete' : 'search'](agencyId, trimmed, {
        page, size: pageSize, signal: controller.signal,
      });
    } catch (error) {
      if (requestId !== sequence.current || controller.signal.aborted) return;
      abort.current = null;
      setState(previous => ({...previous, loading: false, error: true}));
      callbacks.current.onError?.(error instanceof Error ? error : new Error(String(error)));
      return;
    }
    if (requestId !== sequence.current || controller.signal.aborted) return;
    abort.current = null;
    setState(previous => ({...previous, response, loading: false, searched: true}));
    callbacks.current.onResults?.(response);
  }, [agencyId, cancel, clear, minLength, mode, pageSize, service]);

  const change = useCallback((query: string, autocomplete = true) => {
    clear(query);
    if (mode !== 'autocomplete' || !autocomplete || !query.trim() || query.trim().length < minLength) return;
    setState(previous => ({...previous, open: true}));
    timer.current = setTimeout(() => {void search(query);}, Math.max(0, debounceMs));
  }, [clear, debounceMs, minLength, mode, search]);

  useEffect(() => {
    clear(queryRef.current);
    return cancel;
  }, [agencyId, cancel, clear, debounceMs, minLength, mode, pageSize, service]);

  return {
    ...state, mode, search, change, clear, cancel,
    searchPage: (page: number) => search(submittedQuery.current, page),
    setOpen: (open: boolean) => {
      if (!open && timer.current !== null) {clearTimeout(timer.current); timer.current = null;}
      setState(previous => ({...previous, open, activeIndex: -1}));
    },
    setActiveIndex: (activeIndex: number) => setState(previous => ({...previous, activeIndex})),
  };
}

export type SearchController = ReturnType<typeof useSearch>;

import {useCallback, useEffect, useState} from 'react';
import type {ApiClient} from '../services/ApiClient';
import {MiniAppService} from '../services/MiniAppService';
import {MiniAppCatalogService} from '../services/MiniAppCatalogService';
import type {MiniApp, MiniAppRendererProps} from '../types/miniApp';

interface CollectionState {
  key: string;
  apiClient?: ApiClient;
  apps: readonly MiniApp[];
  isLoading: boolean;
  loadFailed: boolean;
}

export function useMiniApps({agencyId, position, tags, miniApps, apiClient}: MiniAppRendererProps) {
  const normalizedPosition = position?.trim() || '';
  const tagsKey = JSON.stringify([...new Set((tags || []).map(tag => tag?.trim()).filter(Boolean))]);
  const hasQuery = !!normalizedPosition || tagsKey !== '[]';
  const isCollection = hasQuery || miniApps != null;
  const [revision, setRevision] = useState(0);
  const key = JSON.stringify([agencyId, normalizedPosition, tagsKey, revision]);
  const [state, setState] = useState<CollectionState>({
    key: '', apps: [], isLoading: false, loadFailed: false,
  });

  const loadMiniApps = useCallback(() => {
    if (hasQuery) setRevision(value => value + 1);
  }, [hasQuery]);

  useEffect(() => {
    if (!hasQuery || !agencyId) {
      setState({key, apiClient, apps: [], isLoading: false, loadFailed: false});
      return;
    }
    const controller = new AbortController();
    setState({key, apiClient, apps: [], isLoading: true, loadFailed: false});
    const load = normalizedPosition
      ? new MiniAppCatalogService(apiClient).findByPosition(agencyId, normalizedPosition, controller.signal)
      : new MiniAppService(apiClient).findByTags(agencyId, JSON.parse(tagsKey) as string[], controller.signal);
    void load.then(
      apps => {
        if (!controller.signal.aborted) {
          setState({key, apiClient, apps, isLoading: false, loadFailed: false});
        }
      },
      () => {
        if (!controller.signal.aborted) {
          setState({key, apiClient, apps: [], isLoading: false, loadFailed: true});
        }
      },
    );
    return () => controller.abort();
  }, [agencyId, apiClient, hasQuery, key, normalizedPosition, tagsKey]);

  const current = state.key === key && state.apiClient === apiClient;
  return {
    isCollection,
    apps: hasQuery ? (agencyId && current ? state.apps : []) : miniApps ?? [],
    isLoading: hasQuery && !!agencyId && (!current || state.isLoading),
    loadFailed: hasQuery && !!agencyId && current && state.loadFailed,
    loadMiniApps,
  };
}

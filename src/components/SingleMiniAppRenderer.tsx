import React, {forwardRef, useCallback, useImperativeHandle, useLayoutEffect, useRef, useState} from 'react';
import {useTranslation} from '../hooks/useTranslation';
import {MiniAppBackendService} from '../services/MiniAppBackendService';
import {MiniAppElementRuntime} from '../utils/miniAppElement';
import type {MiniAppRendererHandle, MiniAppRendererProps} from '../types/miniApp';

/** Keeps React-owned controls separate from the DOM the custom element owns. */
export const SingleMiniAppRenderer = forwardRef<MiniAppRendererHandle, MiniAppRendererProps>((props, ref) => {
  const {
    element, miniApp, agencyId, apiClient,
    reloadable = true, showStatus = true, currentLanguage = 'en',
  } = props;
  const {t} = useTranslation(currentLanguage);
  const empty = !miniApp?.bundle?.element || !miniApp.bundle.entry;
  const hostRef = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const [error, setError] = useState<string | null>(null);
  const runtimeRef = useRef<MiniAppElementRuntime | null>(null);
  if (!runtimeRef.current) {
    runtimeRef.current = new MiniAppElementRuntime(
      api => latest.current.onReady?.(api),
      failure => {
        setError(failure.message);
        latest.current.onFailed?.(failure);
      },
    );
  }
  const runtime = runtimeRef.current;

  const run = useCallback((): Promise<void> => {
    setError(null);
    const rootElement = element || hostRef.current;
    if (!rootElement) return Promise.resolve();
    return runtime.run({
      rootElement, miniApp, agencyId,
      options: latest.current.options || {},
      context: latest.current.context || {},
      backendService: new MiniAppBackendService(apiClient),
    });
  }, [agencyId, apiClient, element, miniApp, runtime]);

  // Abort before React removes the host, so disconnectedCallback sees cancellation.
  useLayoutEffect(() => {
    void run();
    return () => runtime.stop();
  }, [run, runtime]);

  useImperativeHandle(ref, () => ({
    get api() { return runtime.api; },
    run,
    loadMiniApps() {},
  }), [run, runtime]);

  return (
    <div className="fusioni-mini-app-single">
      {reloadable && (
        <div className="fusioni-mini-app-toolbar">
          <button
            type="button" data-reload
            className="fusioni-mini-app-reload"
            onClick={() => { void run(); }}
            disabled={empty}
            title={t('miniApp.reload')}
            aria-label={t('miniApp.reload')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M20 7v5h-5M4 17v-5h5M6.1 6.1A8 8 0 0 1 20 12M4 12a8 8 0 0 0 13.9 5.9" />
            </svg>
            {t('miniApp.reload')}
          </button>
        </div>
      )}
      <div ref={hostRef} data-mini-app-host className="fusioni-mini-app-host" hidden={!!element} />
      {error && (
        <div className="fusioni-mini-app-error" role="alert">
          <p className="fusioni-mini-app-error-title">{t('miniApp.failed')}</p>
          <p className="fusioni-mini-app-error-detail">{error}</p>
        </div>
      )}
      {showStatus && empty && !error && (
        <p className="fusioni-mini-app-status" role="status">{t('miniApp.empty')}</p>
      )}
    </div>
  );
});

SingleMiniAppRenderer.displayName = 'SingleMiniAppRenderer';

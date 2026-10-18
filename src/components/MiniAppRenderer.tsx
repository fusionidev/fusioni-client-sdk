import React, {forwardRef, useImperativeHandle, useMemo, useRef} from 'react';
import {ApiClient} from '../services/ApiClient';
import {useMiniApps} from '../hooks/useMiniApps';
import {useTranslation} from '../hooks/useTranslation';
import {SingleMiniAppRenderer} from './SingleMiniAppRenderer';
import type {MiniAppRendererHandle, MiniAppRendererProps} from '../types/miniApp';

/**
 * Mounts trusted Mini App bundles as native custom elements in the host page.
 * Position queries take precedence over tags, supplied lists, and a single app.
 */
export const MiniAppRenderer = forwardRef<MiniAppRendererHandle, MiniAppRendererProps>((props, ref) => {
  const {
    apiClient: suppliedClient, apiBaseUrl, accessToken, columns = 1,
    className, style, showStatus = true, currentLanguage = 'en',
  } = props;
  const apiClient = useMemo(
    () => suppliedClient ?? (apiBaseUrl ? new ApiClient(apiBaseUrl, accessToken) : undefined),
    [suppliedClient, apiBaseUrl, accessToken],
  );
  const {isCollection, apps, isLoading, loadFailed, loadMiniApps} = useMiniApps({...props, apiClient});
  const {t} = useTranslation(currentLanguage);
  const singleRef = useRef<MiniAppRendererHandle>(null);
  const children = useRef(new Map<string, MiniAppRendererHandle>());
  const normalizedColumns = Number.isFinite(columns) ? Math.max(1, Math.floor(columns)) : 1;

  useImperativeHandle(ref, () => ({
    get api() { return isCollection ? null : singleRef.current?.api ?? null; },
    run: () => isCollection
      ? Promise.all(Array.from(children.current.values(), child => child.run())).then(() => undefined)
      : singleRef.current?.run() ?? Promise.resolve(),
    loadMiniApps,
  }), [isCollection, loadMiniApps]);

  return (
    <div className={['fusioni-mini-app-renderer', className].filter(Boolean).join(' ')} style={style}>
      {isCollection ? (
        <div className="fusioni-mini-app-collection" aria-busy={isLoading}>
          {isLoading && <p className="fusioni-mini-app-status" role="status">{t('miniApp.loading')}</p>}
          {loadFailed && (
            <div className="fusioni-mini-app-error fusioni-mini-app-load-error" role="alert">
              <span>{t('miniApp.loadFailed')}</span>
              <button type="button" className="fusioni-mini-app-retry" onClick={loadMiniApps}>
                {t('chat.errors.retry')}
              </button>
            </div>
          )}
          {showStatus && !isLoading && !loadFailed && apps.length === 0 && (
            <p className="fusioni-mini-app-status" role="status">{t('miniApp.notFound')}</p>
          )}
          {apps.length > 0 && (
            <div
              className="fusioni-mini-app-grid"
              style={{'--fusioni-mini-app-columns': normalizedColumns} as React.CSSProperties}
            >
              {apps.map((app, index) => {
                const key = app.id || app.mini_app_id || `${index}:${app.name || ''}`;
                return (
                  <section className="fusioni-mini-app-section" key={key}>
                    {app.name && apps.length > 1 && <h3 className="fusioni-mini-app-title">{app.name}</h3>}
                    <SingleMiniAppRenderer
                      ref={child => {
                        if (child) children.current.set(key, child);
                        else children.current.delete(key);
                      }}
                      miniApp={app}
                      agencyId={props.agencyId}
                      apiClient={apiClient}
                      element={apps.length === 1 ? props.element : null}
                      options={props.options}
                      context={props.context}
                      reloadable={props.reloadable}
                      showStatus={showStatus}
                      currentLanguage={currentLanguage}
                      onReady={props.onReady}
                      onFailed={props.onFailed}
                    />
                  </section>
                );
              })}
            </div>
          )}
        </div>
      ) : <SingleMiniAppRenderer {...props} apiClient={apiClient} ref={singleRef} />}
    </div>
  );
});

MiniAppRenderer.displayName = 'MiniAppRenderer';

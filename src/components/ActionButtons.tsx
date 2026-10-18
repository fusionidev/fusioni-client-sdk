import React, {forwardRef, useImperativeHandle, useMemo} from 'react';
import {ApiClient, getApiClient} from '../services/ApiClient';
import {resolveActionLiteral} from '../services/ActionService';
import {useActionButtons} from '../hooks/useActionButtons';
import {useTranslation} from '../hooks/useTranslation';
import {normalizeActionLanguage} from '../utils/conversationInputFields';
import {ActionIcon} from './ActionIcon';
import {ActionFieldForm} from './ActionFieldForm';
import {ActionTranscript} from './ActionTranscript';
import {MessageStreamLoading} from './MessageStreamLoading';
import type {ActionButtonsHandle, ActionButtonsProps} from '../types/actionButtons';

const ActionButtonsView = forwardRef<ActionButtonsHandle, ActionButtonsProps>((props, ref) => {
  const {state, controller} = useActionButtons(props);
  const {t} = useTranslation(props.currentLanguage);
  const selected = state.selectedAction;
  const results = selected?.id ? state.results[selected.id] || [] : [];
  const messages = selected?.id ? state.messages[selected.id] || [] : [];
  const literal = selected && resolveActionLiteral(selected, normalizeActionLanguage(props.currentLanguage || 'en'));
  const label = literal?.text || selected?.title || '';
  useImperativeHandle(ref, () => ({
    get selectedAction() { return controller.state.selectedAction; },
    get results() { return controller.state.results[controller.state.selectedAction?.id || ''] || []; },
    get conversationMessages() { return controller.state.messages[controller.state.selectedAction?.id || ''] || []; },
    loadActions: () => { void controller.loadActions(); },
    executeAction: action => controller.executeAction(action),
    submitFields: () => controller.submitFields(),
    cancelFields: () => controller.cancelFields(),
    startNewConversation: action => controller.startNewConversation(action),
  }), [controller]);
  if (!props.agencyId || !props.tags?.length) return null;
  const showTranscript = props.showActionResult !== false && selected?.show_results && !!(results.length || messages.length)
    && ((!state.executingActionId && !state.executionError) || selected.maintain_conversation);
  return <section className={['fusioni-action-buttons', props.className].filter(Boolean).join(' ')} style={props.style}
    aria-label={t('actions.available')} aria-busy={state.isLoading}>
    {state.isLoading && <p role="status" className="fusioni-action-status">{t('actions.loading')}</p>}
    {state.loadError && <div className="fusioni-action-error" role="alert"><span>{state.loadError}</span>
      <button type="button" className="fusioni-btn fusioni-btn-secondary" onClick={() => void controller.loadActions()}>{t('chat.errors.retry')}</button></div>}
    {!state.isLoading && !state.loadError && !state.actions.length && <p role="status" className="fusioni-action-status">{t('actions.empty')}</p>}
    {!state.isLoading && !state.loadError && !!state.actions.length && <div className={`fusioni-action-grid${props.showButtonsPanel ? ' fusioni-action-grid-panel' : ''}`}>
      {state.actions.map(action => {
        const translated = resolveActionLiteral(action, normalizeActionLanguage(props.currentLanguage || 'en'));
        const actionLabel = translated?.text || action.title;
        const description = translated?.description || '';
        const executionState = state.executionStates[action.id!] || 'idle';
        return <button type="button" className="fusioni-action-card" key={action.id} data-action-key={action.key || action.id}
          disabled={!!state.executingActionId || controller.isDisabled(action)} aria-busy={state.executingActionId === action.id}
          aria-label={`${t('actions.run')}: ${actionLabel}${description ? `. ${description}` : ''}`} onClick={() => void controller.executeAction(action)}>
          <span className={`fusioni-action-icon fusioni-action-icon-${executionState}`}><ActionIcon icon={action.icon} color={action.icon_color} state={executionState} /></span>
          <span className="fusioni-action-card-copy"><strong>{actionLabel}</strong>{description && <span>{description}</span>}</span>
          <span aria-hidden="true">→</span><span className="fusioni-sr-only" aria-live="polite">{executionState === 'success' ? t('actions.success') : executionState === 'error' ? t('common.error') : ''}</span>
        </button>;
      })}
    </div>}
    {state.fieldFormVisible && selected && <ActionFieldForm key={state.formVersion} label={label} controller={controller} props={props} />}
    {props.showLoadingPanel !== false && state.executingActionId && <div role="status" aria-busy="true" className="fusioni-action-loading">
      <MessageStreamLoading streamMessages={[]} loadingLabel={`${t('actions.running')}: ${label}`} /></div>}
    {state.executionError && <p className="fusioni-action-error" role="alert">{state.executionError}</p>}
    {showTranscript && selected && <ActionTranscript action={selected} label={label} results={results} messages={messages}
      agencyId={props.agencyId} apiBaseUrl={props.apiBaseUrl} accessToken={props.accessToken} currentLanguage={props.currentLanguage}
      conversationId={state.conversations[selected.id!]} executing={!!state.executingActionId} onNewConversation={() => controller.startNewConversation(selected)} />}
  </section>;
});
ActionButtonsView.displayName = 'ActionButtonsView';

/** Executes tagged actions with profile forms and independent persisted conversations. */
export const ActionButtons = forwardRef<ActionButtonsHandle, ActionButtonsProps>((props, ref) => {
  const apiClient = useMemo(() => {
    if (props.apiClient) return props.apiClient;
    if (props.apiBaseUrl) return new ApiClient(props.apiBaseUrl, props.accessToken);
    try { return getApiClient(); } catch { return undefined; }
  }, [props.apiClient, props.apiBaseUrl, props.accessToken]);
  const tags = [...new Set((props.tags || []).map(tag => tag.trim()).filter(Boolean))];
  const queryKey = JSON.stringify([props.agencyId, [...tags].sort(), props.conversationStorageKey]);
  return <ActionButtonsView {...props} tags={tags} apiClient={apiClient} apiBaseUrl={props.apiBaseUrl ?? apiClient?.getBaseUrl?.()}
    accessToken={props.accessToken ?? apiClient?.getAccessToken?.()} key={queryKey} ref={ref} />;
});
ActionButtons.displayName = 'ActionButtons';

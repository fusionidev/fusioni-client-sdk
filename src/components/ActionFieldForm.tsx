import React, {useEffect, useState} from 'react';
import {FullscreenPanel} from './FullscreenPanel';
import {ActionInputField} from './ActionInputField';
import {useTranslation} from '../hooks/useTranslation';
import type {ActionButtonsProps} from '../types/actionButtons';
import type {ActionButtonsController} from '../utils/actionButtonsController';

let nextFormId = 0;

export const ActionFieldForm: React.FC<{label: string; controller: ActionButtonsController; props: ActionButtonsProps}> = ({label, controller, props}) => {
  const {t} = useTranslation(props.currentLanguage);
  const [fullscreen, setFullscreen] = useState(props.fullscreen || false);
  const [id] = useState(() => `fusioni-action-form-${++nextFormId}`);
  useEffect(() => { setFullscreen(props.fullscreen || false); }, [props.fullscreen]);
  const changeFullscreen = (value: boolean): void => { setFullscreen(value); props.onFullscreenChange?.(value); };
  const sidePanel = props.sidePanel ?? props.children;
  const showSidePanel = fullscreen && (sidePanel != null || props.hasFullscreenSidePanelContent || props.hasChatSidePanelContent);
  return <FullscreenPanel fullscreen={fullscreen} label={label} onClose={() => changeFullscreen(false)}>
    <div className={`fusioni-action-form-layout${showSidePanel ? ' fusioni-action-form-layout-split' : ''}`}>
      {showSidePanel && <aside className="fusioni-action-side-panel">{sidePanel}</aside>}
      <form className="fusioni-action-field-form" noValidate onSubmit={event => { event.preventDefault(); void controller.submitFields(); }}>
        <div className="fusioni-action-form-header"><div><h3>{label}</h3><p>{t('actions.fieldsPrompt')}</p></div>
          <button type="button" className="fusioni-btn fusioni-btn-secondary" onClick={() => changeFullscreen(!fullscreen)}
            aria-label={t(fullscreen ? 'chat.fullscreen.exit' : 'chat.fullscreen.enter')}>{fullscreen ? '↙' : '↗'}</button></div>
        <div className="fusioni-action-fields">{controller.promptedFields().map((field, index) =>
          <ActionInputField key={field.name} field={field} inputId={`${id}-${index}`} controller={controller} props={props} />)}</div>
        <div className="fusioni-action-form-actions">
          <button type="button" className="fusioni-btn fusioni-btn-secondary" onClick={() => controller.cancelFields()}>{t('common.cancel')}</button>
          {props.showRunButton !== false && <button type="submit" className="fusioni-btn fusioni-btn-primary" disabled={Object.values(controller.state.pendingUploads).some(Boolean)}>{t('actions.submit')}</button>}
        </div>
      </form>
    </div>
  </FullscreenPanel>;
};

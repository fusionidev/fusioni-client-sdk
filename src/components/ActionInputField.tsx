import React from 'react';
import {ChatInput} from './ChatInput';
import {ActionFileField} from './ActionFileField';
import {ActionProfileChat} from './ActionProfileChat';
import {readFileDataUrl} from '../utils/readFileDataUrl';
import {useTranslation} from '../hooks/useTranslation';
import {conversationFieldError, conversationFieldLabel, conversationFieldPlaceholder, isConversationInputFieldDraftInvalid} from '../utils/conversationInputFields';
import type {ConversationInputField} from '../types/conversationProfile';
import type {ActionButtonsProps} from '../types/actionButtons';
import type {ActionButtonsController} from '../utils/actionButtonsController';

export const ActionInputField: React.FC<{
  field: ConversationInputField; inputId: string; controller: ActionButtonsController; props: ActionButtonsProps;
}> = ({field, inputId, controller, props}) => {
  const {t} = useTranslation(props.currentLanguage);
  const language = props.currentLanguage || 'en';
  const state = controller.state;
  const value = state.fieldValues[field.name];
  const invalid = state.fieldFormSubmitted && isConversationInputFieldDraftInvalid(field, value);
  const label = conversationFieldLabel(field, language);
  const placeholder = conversationFieldPlaceholder(field, language);
  const disabled = !!state.executingActionId;
  const describedBy = invalid ? `${inputId}-error` : field.description ? `${inputId}-description` : undefined;
  const attrs = {id: inputId, disabled, 'aria-invalid': invalid, 'aria-describedby': describedBy, className: 'fusioni-action-field-input'};
  const update = (text: string): void => controller.setFieldValue(field.name, text);
  const stringValue = value == null ? '' : String(value);
  let control: React.ReactNode;
  switch (field.type) {
    case 'prompt':
      control = <ChatInput inputId={inputId} ariaLabel={label} value={stringValue} onValueChange={update} clearOnSend={false}
        ariaInvalid={invalid} ariaDescribedBy={describedBy} placeholder={placeholder} disabled={disabled} enableAudioRecording={false}
        onFileUpload={readFileDataUrl} maxAttachments={8} onAttachmentsChange={images => controller.setPromptAttachments(field.name, images)}
        onUploadingChange={pending => controller.setUploadsPending(field.name, pending)}
        onSendMessage={text => { update(text); void controller.submitFields(); }} currentLanguage={language} />;
      break;
    case 'chat': {
      const profile = state.selectedAction?.conversation_profile_id ? state.profiles[state.selectedAction.conversation_profile_id] : undefined;
      control = profile && props.agencyId ? <ActionProfileChat agencyId={props.agencyId} profile={profile} apiClient={props.apiClient}
        apiBaseUrl={props.apiBaseUrl} accessToken={props.accessToken} currentLanguage={language}
        getInputData={() => controller.chatInputData()} onResponse={response => controller.emitChatResponse(response)} /> : null;
      break;
    }
    case 'file':
      control = <ActionFileField inputId={inputId} label={`${t('actions.attachFiles')}: ${label}`} disabled={disabled}
        onChange={files => controller.setFieldValue(field.name, files)} onPendingChange={pending => controller.setUploadsPending(field.name, pending)} />;
      break;
    case 'boolean':
      control = <div className="fusioni-action-boolean"><input {...attrs} type="checkbox" checked={value === true}
        onChange={event => controller.setFieldValue(field.name, event.target.checked)} /><span>{t(value === true ? 'common.yes' : 'common.no')}</span></div>;
      break;
    case 'json':
      control = <textarea {...attrs} rows={5} value={stringValue} placeholder={t('actions.jsonPlaceholder')} onChange={event => update(event.target.value)} />;
      break;
    default:
      control = <input {...attrs} type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
        step={field.type === 'number' ? 'any' : undefined} value={stringValue} placeholder={field.type === 'list' ? t('actions.listPlaceholder') : placeholder}
        onChange={event => update(event.target.value)} />;
  }
  return <div className={`fusioni-action-field${['json', 'prompt', 'chat', 'file'].includes(field.type) ? ' fusioni-action-field-wide' : ''}`}>
    <label htmlFor={field.type === 'chat' ? undefined : inputId}><span>{label}</span><small>{t(field.required ? 'actions.required' : 'actions.optional')}</small></label>
    {control}
    {field.description && <p id={`${inputId}-description`} className="fusioni-action-field-description">{field.description}</p>}
    {invalid && <p id={`${inputId}-error`} role="alert" className="fusioni-action-field-error">{conversationFieldError(field, value, language)}</p>}
  </div>;
};

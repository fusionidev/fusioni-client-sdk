import React, {useEffect, useRef, useState} from 'react';
import {ChatInput} from './ChatInput';
import {ActionMessageThread} from './ActionTranscript';
import {MessageStreamLoading} from './MessageStreamLoading';
import {useTranslation} from '../hooks/useTranslation';
import {useSSE} from '../hooks/useSSE';
import {ApiClient, FusioniSSEMessage} from '../services/ApiClient';
import {RemoteConversationService} from '../services/ConversationService';
import {PipelineService} from '../services/PipelineService';
import {buildActionMessages, mergeActionMessages} from '../utils/actionResults';
import {readFileDataUrl} from '../utils/readFileDataUrl';
import type {Language} from '../i18n';
import type {FusioniMemoryMessage, PipelineResponse} from '../types';
import type {ConversationInputFieldData, ConversationProfile} from '../types/conversationProfile';

export const ActionProfileChat: React.FC<{
  agencyId: string; profile: ConversationProfile; apiClient?: ApiClient;
  apiBaseUrl?: string; accessToken?: string; currentLanguage: Language;
  getInputData: () => {context: ConversationInputFieldData; uploads: string[]} | null;
  onResponse: (response: PipelineResponse) => void;
}> = (props) => {
  const {agencyId, profile, apiClient, apiBaseUrl, accessToken, currentLanguage} = props;
  const {t} = useTranslation(currentLanguage);
  const [messages, setMessages] = useState<FusioniMemoryMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stream, setStream] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [inputVersion, setInputVersion] = useState(0);
  const conversationId = useRef<string>();
  const controllerRef = useRef<AbortController>();
  const latest = useRef(props);
  latest.current = props;
  useEffect(() => () => { controllerRef.current?.abort(); }, []);
  const onStream = (event: FusioniSSEMessage): void => {
    const payload = event.payload as {conversation_id?: string; agency_id?: string} | undefined;
    if (event.event !== 'chat_stream' || !controllerRef.current || controllerRef.current.signal.aborted
      || (payload?.conversation_id && payload.conversation_id !== conversationId.current)
      || (payload?.agency_id && payload.agency_id !== agencyId)) return;
    setStream(lines => [...lines, event.data].slice(-6));
  };
  useSSE(agencyId, onStream, true, accessToken, undefined, apiClient);

  const send = async (content: string, image?: string): Promise<void> => {
    if (loading || !content.trim()) return;
    const input = latest.current.getInputData();
    if (!input) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true); setError(''); setStream([]);
    const optimisticId = `action-chat-${Date.now()}`;
    try {
      if (!conversationId.current) {
        conversationId.current = await new RemoteConversationService(apiClient).createConversation({
          agency_id: agencyId, title: profile.name, conversation_profile_id: profile.id,
        }, controller.signal);
      }
      if (controller.signal.aborted) return;
      const optimistic: FusioniMemoryMessage = {id: optimisticId, agency_id: agencyId, conversation_id: conversationId.current,
        mem_type: 'short', role: 'user', keywords: [], thoughts: null, created: new Date(), content: content.trim(),
        loading: false, shouldAnimate: false, ...(image ? {extra_data: {image_ref: image, image_base64: true}} : {})};
      setMessages(kept => [...kept, optimistic]);
      const images = [...input.uploads, ...(image ? [image] : [])];
      const response = await new PipelineService(apiClient).executePipeline({agency_id: agencyId, conversation_id: conversationId.current,
        inp: content.trim(), ...(Object.keys(input.context).length ? {context: input.context} : {}),
        ...(images.length ? {image: images[0], images} : {})}, controller.signal);
      if (controller.signal.aborted) return;
      if (response.has_error) throw new Error(response.error_message || t('actions.executionFailed'));
      const returned = buildActionMessages(response, agencyId);
      setMessages(kept => mergeActionMessages(returned.some(message => message.role === 'user')
        ? kept.filter(message => message.id !== optimisticId) : kept, returned, 'asc'));
      setDraft('');
      setInputVersion(version => version + 1);
      latest.current.onResponse(response);
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : t('actions.executionFailed'));
    } finally {
      if (!controller.signal.aborted) { setLoading(false); controllerRef.current = undefined; }
    }
  };
  return <div className="fusioni-action-profile-chat" aria-label={t('actions.conversation')}>
    {!!messages.length && <ActionMessageThread messages={messages} agencyId={agencyId} apiBaseUrl={apiBaseUrl} accessToken={accessToken} currentLanguage={currentLanguage} />}
    {loading && <div role="status"><MessageStreamLoading streamMessages={stream} loadingLabel={t('actions.running')} /></div>}
    {error && <p role="alert" className="fusioni-action-error">{error}</p>}
    <ChatInput key={inputVersion} value={draft} onValueChange={setDraft} clearOnSend={false} onSendMessage={(text, image) => { void send(text, image); }}
      onFileUpload={readFileDataUrl} disabled={loading} enableAudioRecording={false} currentLanguage={currentLanguage} />
  </div>;
};

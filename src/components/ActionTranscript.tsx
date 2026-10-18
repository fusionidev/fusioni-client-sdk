import React, {useContext, useEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {Message} from './Message';
import {ImageGallery} from './ImageGallery';
import {UrlPreview} from './UrlPreview';
import {PortalContainerContext} from '../context/PortalContainerContext';
import {useTranslation} from '../hooks/useTranslation';
import type {Language} from '../i18n';
import type {Action} from '../services/ActionService';
import type {FusioniMemoryMessage} from '../types';
import type {ActionResult} from '../types/actionButtons';
import {buildActionResult} from '../utils/actionResults';

interface ThreadProps {
  messages: readonly FusioniMemoryMessage[];
  agencyId: string;
  apiBaseUrl?: string;
  accessToken?: string;
  currentLanguage?: Language;
  sort?: 'asc' | 'desc';
}

export const ActionMessageThread: React.FC<ThreadProps> = ({messages, agencyId, apiBaseUrl, accessToken, currentLanguage = 'en', sort = 'asc'}) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const portal = useContext(PortalContainerContext);
  const [gallery, setGallery] = useState<{images: string[]; index: number} | null>(null);
  const rendered = useMemo(() => messages.map(message => {
    const result = buildActionResult(message.content || '', message.extra_data, message.execution_time_ms, undefined, apiBaseUrl);
    return {message: {...message, content: result.content, shouldAnimate: false, extra_data: {...message.extra_data,
      image: undefined, image_ref: undefined, document_images: result.images}}, links: result.links};
  }), [messages, apiBaseUrl]);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport) viewport.scrollTop = sort === 'asc' ? viewport.scrollHeight : 0;
  }, [messages, sort]);
  return <>
    <div ref={viewportRef} className="fusioni-action-conversation">
      {rendered.map(({message, links}, index) => <div className={`fusioni-message ${message.role === 'user' ? 'user' : 'assistant'}`} key={message.id || `${index}:${message.role}`}>
        <div className="fusioni-message-content"><Message message={message} agencyId={agencyId} isOwnMessage={message.role === 'user'}
          apiBaseUrl={apiBaseUrl} apiKey={accessToken} currentLanguage={currentLanguage} enableButtons={false}
          onOpenGallery={setGallery} urlPreviewUrls={links} />
          {message.execution_time_ms != null && message.role !== 'user' && <div className="fusioni-action-execution-time">{(message.execution_time_ms / 1000).toFixed(2)}s</div>}
        </div>
      </div>)}
    </div>
    {gallery && createPortal(<ImageGallery images={gallery.images} initialIndex={gallery.index} onClose={() => setGallery(null)} />, portal || document.body)}
  </>;
};

export const ActionTranscript: React.FC<ThreadProps & {
  action: Action; label: string; results: readonly ActionResult[];
  conversationId?: string; executing: boolean; onNewConversation: () => void;
}> = ({action, label, results, conversationId, executing, onNewConversation, ...threadProps}) => {
  const {t} = useTranslation(threadProps.currentLanguage);
  const portal = useContext(PortalContainerContext);
  const [gallery, setGallery] = useState<{images: string[]; index: number} | null>(null);
  const title = t(action.maintain_conversation ? 'actions.conversation' : 'actions.result');
  return <section className="fusioni-action-transcript" aria-label={title}>
    <div className="fusioni-action-transcript-header">
      <div><h3>{title}</h3><p>{label}</p></div>
      {conversationId && <button type="button" className="fusioni-btn fusioni-btn-secondary" disabled={executing} onClick={onNewConversation}>{t('chat.conversations.newConversation')}</button>}
    </div>
    {action.maintain_conversation ? <ActionMessageThread {...threadProps} sort={action.results_sort || 'desc'} />
      : results.map((result, index) => <article key={index} className="fusioni-action-result">
        {result.content && <div className="fusioni-action-result-content" dangerouslySetInnerHTML={{__html: result.content}} />}
        {!!result.images.length && <div className="fusioni-action-result-images">{result.images.map((image, imageIndex) =>
          <button type="button" key={image} aria-label={`${t('actions.result')} image ${imageIndex + 1}`} onClick={() => setGallery({images: result.images, index: imageIndex})}>
            <img src={image} alt={`${t('actions.result')} ${imageIndex + 1}`} loading="lazy" />
          </button>)}</div>}
        {result.links.map(link => <UrlPreview key={link} url={link} agencyId={threadProps.agencyId} apiBaseUrl={threadProps.apiBaseUrl}
          apiKey={threadProps.accessToken} showCloseButton={false} compact={false} />)}
        {result.executionTimeMs != null && <div className="fusioni-action-execution-time">{(result.executionTimeMs / 1000).toFixed(2)}s</div>}
      </article>)}
    {gallery && createPortal(<ImageGallery images={gallery.images} initialIndex={gallery.index} onClose={() => setGallery(null)} />, portal || document.body)}
  </section>;
};

import type {FusioniMemoryMessage, PipelineResponse} from '../types';
import type {ActionResult} from '../types/actionButtons';

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object';
const strings = (value: unknown): string[] => (Array.isArray(value) ? value : [value])
  .filter((item): item is string => typeof item === 'string' && !!item.trim()).map(item => item.trim());
const imageUrl = (url: string): boolean => /^data:image\//i.test(url) || /\.(png|jpe?g|gif|webp|bmp|svg|avif)(?:[?#]|$)/i.test(url);
const safeUrl = (url: string, image = false): boolean => /^(https?:|\/|\.|#)/i.test(url.trim())
  || (image && /^data:image\/(?:png|jpe?g|gif|webp|bmp|avif);base64,/i.test(url.trim()));

/** Angular sanitizes innerHTML; apply the same boundary before reusing Message. */
export function sanitizeActionHtml(html: string): string {
  if (typeof DOMParser === 'undefined') {
    return html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,style,iframe,object,embed,link,meta,base,form,input,button,svg,math').forEach(el => el.remove());
  doc.body.querySelectorAll('*').forEach(el => {
    for (const attribute of Array.from(el.attributes)) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith('on') || ['style', 'srcdoc', 'srcset'].includes(name)
        || (['href', 'src', 'poster', 'background', 'xlink:href'].includes(name) && !safeUrl(attribute.value, name === 'src' && el.tagName === 'IMG'))) {
        el.removeAttribute(attribute.name);
      }
    }
    if (el.tagName === 'A') el.setAttribute('rel', 'noopener noreferrer');
  });
  return doc.body.innerHTML;
}

function extractImages(extra: unknown, apiBaseUrl?: string): string[] {
  if (!record(extra)) return [];
  const base = (apiBaseUrl || '/api').replace(/\/+$/, '');
  const images = [...strings(extra.image), ...strings(extra.document_images)];
  if (typeof extra.image_ref === 'string' && extra.image_ref.trim()) {
    images.push(extra.image_base64 ? extra.image_ref.trim() : `${base}/image/file/${encodeURIComponent(extra.image_ref.trim())}`);
  }
  if (Array.isArray(extra.media)) {
    for (const item of extra.media) {
      const url = typeof item === 'string' ? item : record(item) && typeof item.url === 'string' ? item.url : '';
      const type = record(item) && typeof item.content_type === 'string' ? item.content_type.toLowerCase() : '';
      if (url && (type.startsWith('image/') || imageUrl(url))) images.push(url.trim());
    }
  }
  return [...new Set(images)].filter(url => safeUrl(url, true));
}

function stripDuplicateImages(html: string, images: string[]): string {
  if (!html.includes('<img') || !images.length || typeof DOMParser === 'undefined') return html;
  const normalize = (url: string): string => {
    try { return new URL(url, typeof window === 'undefined' ? 'http://localhost' : window.location.origin).href; }
    catch { return url; }
  };
  const urls = new Set(images.map(normalize));
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('img').forEach(img => {
    if (!urls.has(normalize(img.getAttribute('src') || ''))) return;
    const parent = img.parentElement;
    img.remove();
    if (parent && parent !== doc.body && !parent.textContent?.trim() && !parent.querySelector('img,video,audio,iframe,a')) parent.remove();
  });
  return doc.body.innerHTML;
}

export function buildActionResult(content: string, extra: unknown, executionTimeMs?: number | null, output_variables?: Record<string, unknown>[] | null, apiBaseUrl?: string): ActionResult {
  const images = extractImages(extra, apiBaseUrl);
  const html = stripDuplicateImages(sanitizeActionHtml(content), images);
  const document = typeof DOMParser === 'undefined' ? null : new DOMParser().parseFromString(html, 'text/html');
  const text = document?.body.textContent || html;
  const links = [...Array.from(text.matchAll(/https?:\/\/[^\s<>"']+/gi), match => match[0].replace(/[),.;!?]+$/, '')),
    ...Array.from(document?.querySelectorAll('a[href]') || [], anchor => anchor.getAttribute('href') || ''),
    ...(record(extra) ? [...strings(extra.document_urls), ...strings(extra.document_links)] : [])];
  return {content: html, images, links: [...new Set(links)].filter(link => safeUrl(link) && !images.includes(link) && !imageUrl(link)), executionTimeMs, output_variables};
}

export function buildActionResults(response: PipelineResponse, apiBaseUrl?: string): ActionResult[] {
  const messages = (Array.isArray(response.messages) ? response.messages : []).filter(message => message.role !== 'user');
  if (messages.length) {
    return messages.map((message, index) => buildActionResult(message.content || '', message.extra_data,
      message.execution_time_ms ?? (index === messages.length - 1 ? response.execution_time_ms : undefined),
      response.output_variables ?? message.extra_data?.output_variables, apiBaseUrl));
  }
  const answers = Array.isArray(response.answer) ? response.answer : [];
  return (answers.length ? answers : response.extra_data ? [''] : []).map(answer =>
    buildActionResult(answer, response.extra_data, response.execution_time_ms, response.output_variables, apiBaseUrl));
}

export function buildActionMessages(response: PipelineResponse, agencyId: string): FusioniMemoryMessage[] {
  const messages: FusioniMemoryMessage[] = response.messages?.length ? [...response.messages] :
    (response.answer?.length ? response.answer : response.extra_data ? [''] : []).map(content => ({
      agency_id: agencyId, conversation_id: response.conversation_id || undefined, mem_type: 'short',
      role: 'assistant' as const, keywords: [], thoughts: null, created: new Date(), content,
      loading: false, shouldAnimate: false, extra_data: response.extra_data || undefined,
    }));
  return messages.map((message, index) => ({...message, loading: false, shouldAnimate: false,
    execution_time_ms: message.execution_time_ms ?? (index === messages.length - 1 ? response.execution_time_ms : undefined)}));
}

export function orderActionHistory(messages: readonly FusioniMemoryMessage[], sort: 'asc' | 'desc'): FusioniMemoryMessage[] {
  if (sort === 'asc') return [...messages];
  const turns: FusioniMemoryMessage[][] = [];
  for (const message of messages) {
    if (message.role === 'user' || !turns.length) turns.push([]);
    turns[turns.length - 1].push(message);
  }
  return turns.reverse().flat();
}

export function mergeActionMessages(kept: readonly FusioniMemoryMessage[], incoming: readonly FusioniMemoryMessage[], sort: 'asc' | 'desc'): FusioniMemoryMessage[] {
  const ids = new Set(kept.map(message => message.id).filter(Boolean));
  const turn = incoming.filter(message => {
    if (message.id && ids.has(message.id)) return false;
    if (message.id) ids.add(message.id);
    return true;
  });
  return sort === 'asc' ? [...kept, ...turn] : [...turn, ...kept];
}

import React, {useEffect, useMemo, useRef} from 'react';
import {getTranslation, type Language} from '../i18n';
import type {FusioniMemoryMessage} from '../types';
import {getMessageOwner} from '../utils/messageBubble';

interface AgentContextUsage {
  key: string;
  name?: string;
  model?: string;
  usedTokens: number;
  windowSize: number | null;
  ratio: number | null;
  estimated: boolean;
  droppedMessages: number;
}

const readCount = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : 0;

const readText = (value: unknown): string | undefined =>
  typeof value === 'string' ? value.trim() || undefined : undefined;

function getLatestContextUsage(messages: readonly FusioniMemoryMessage[]) {
  const entries = new Map<string, AgentContextUsage>();
  let fullest: AgentContextUsage | undefined;

  // Each agent has a separate context. The newest usable snapshot wins for that agent.
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== 'assistant' || message.loading) continue;

    const usage = message.extra_data?.context_usage;
    const usedTokens = readCount(usage?.used_tokens);
    if (!usage || !usedTokens) continue;

    const key = readText(usage.agent_id) ?? '';
    if (entries.has(key)) continue;

    const owner = getMessageOwner(message);
    const windowSize = readCount(usage.context_window) || null;
    const ratio = windowSize ? usedTokens / windowSize : null;
    const entry: AgentContextUsage = {
      key,
      name: readText(owner?.persona_name) ?? readText(owner?.name),
      model: readText(usage.model),
      usedTokens,
      windowSize,
      ratio,
      estimated: usage.estimated === true,
      droppedMessages: readCount(usage.dropped_history_messages),
    };
    entries.set(key, entry);

    if (!fullest ||
        (ratio ?? -1) > (fullest.ratio ?? -1) ||
        (ratio === null && fullest.ratio === null && usedTokens > fullest.usedTokens)) {
      fullest = entry;
    }
  }

  return {entries: [...entries.values()], fullest};
}

const RING_CIRCUMFERENCE = 2 * Math.PI * 8;

function usageLevel(ratio: number | null) {
  if (ratio !== null && ratio >= 0.9) return 'critical';
  if (ratio !== null && ratio >= 0.75) return 'warning';
  return 'normal';
}

export const ContextUsageMeter: React.FC<{
  messages: readonly FusioniMemoryMessage[];
  language: Language;
  showDetails: boolean;
}> = ({messages, language, showDetails}) => {
  const {entries, fullest} = useMemo(() => getLatestContextUsage(messages), [messages]);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const hasDetails = showDetails && Boolean(fullest);

  useEffect(() => {
    const details = detailsRef.current;
    if (!hasDetails || !details) return;

    const ownerDocument = details.ownerDocument;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (details.open && !event.composedPath().includes(details)) details.open = false;
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (!details.open || event.key !== 'Escape') return;
      details.open = false;
      if (event.composedPath().includes(details)) details.querySelector('summary')?.focus();
    };
    ownerDocument.addEventListener('click', closeOnOutsideClick);
    ownerDocument.addEventListener('keydown', closeOnEscape);
    return () => {
      ownerDocument.removeEventListener('click', closeOnOutsideClick);
      ownerDocument.removeEventListener('keydown', closeOnEscape);
    };
  }, [hasDetails]);

  if (!fullest) return null;

  const t = (key: string) => getTranslation(language, `chat.contextUsage.${key}`);
  const numberFormat = new Intl.NumberFormat(language);
  const percentFormat = new Intl.NumberFormat(language, {style: 'percent', maximumFractionDigits: 0});
  const formatRatio = (ratio: number) =>
    ratio < 0.01 ? `< ${percentFormat.format(0.01)}` : percentFormat.format(ratio);
  const tokenLabel = (entry: AgentContextUsage) => {
    const windowLabel = entry.windowSize ? ` / ${numberFormat.format(entry.windowSize)}` : '';
    return `${entry.estimated ? '≈ ' : ''}${numberFormat.format(entry.usedTokens)}${windowLabel} ${t('tokens')}`;
  };
  const summaryValue = fullest.ratio === null ? tokenLabel(fullest) : formatRatio(fullest.ratio);
  const level = usageLevel(fullest.ratio);
  const summaryContents = (
    <>
      <svg className="fusioni-context-usage-ring" width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.2"/>
        {fullest.ratio !== null && (
          <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" transform="rotate(-90 10 10)"
            strokeDasharray={`${Math.min(fullest.ratio, 1) * RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}/>
        )}
      </svg>
      <span>{t('title')}</span>
      <strong>{summaryValue}</strong>
    </>
  );

  if (!showDetails) {
    return (
      <div className="fusioni-context-usage">
        <div className="fusioni-context-usage-summary" data-level={level}>
          {summaryContents}
          {fullest.ratio !== null && <span className="fusioni-sr-only">{tokenLabel(fullest)}</span>}
        </div>
      </div>
    );
  }

  const summaryLabel = [t('title'), tokenLabel(fullest), fullest.ratio === null ? '' : summaryValue]
    .filter(Boolean).join(', ');
  return (
    <details ref={detailsRef} className="fusioni-context-usage">
      <summary className="fusioni-context-usage-summary" title={summaryLabel} aria-label={summaryLabel} data-level={level}>
        {summaryContents}
        <svg className="fusioni-context-usage-chevron" width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </summary>
      <div className="fusioni-context-usage-panel" role="region" aria-label={t('title')} tabIndex={0}>
        <strong className="fusioni-context-usage-title">{t('title')}</strong>
        {entries.map(entry => (
          <div key={entry.key} className="fusioni-context-usage-entry" data-level={usageLevel(entry.ratio)}>
            <div className="fusioni-context-usage-entry-heading">
              <strong>{entry.name || entry.model || getTranslation(language, 'chat.messages.agent')}</strong>
              {entry.ratio !== null && <strong>{formatRatio(entry.ratio)}</strong>}
            </div>
            {entry.name && entry.model && <div>{entry.model}</div>}
            {entry.ratio !== null && (
              <div className="fusioni-context-usage-track" aria-hidden="true">
                <div style={{width: `${Math.min(entry.ratio, 1) * 100}%`}}/>
              </div>
            )}
            <div>{tokenLabel(entry)}</div>
            {entry.windowSize === null && <div>{t('windowUnavailable')}</div>}
            {entry.estimated && <div>{t('estimated')}</div>}
            {entry.droppedMessages > 0 && (
              <div>{entry.droppedMessages === 1
                ? t('droppedOne')
                : t('droppedMany').replace('{count}', numberFormat.format(entry.droppedMessages))}</div>
            )}
          </div>
        ))}
        <div>{t('footnote')}</div>
      </div>
    </details>
  );
};

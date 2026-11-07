import React from 'react';
import type {MutableRefObject, RefObject} from 'react';
import {getTranslation} from '../i18n';
import type {SearchController} from '../hooks/useSearch';
import type {SearchProps} from '../types/search';
import {searchItemUrl} from '../utils/searchElements';

interface SearchResultsProps {
  controller: SearchController;
  options: SearchProps;
  listId: string;
  resultsRef: RefObject<HTMLDivElement>;
  links: MutableRefObject<(HTMLAnchorElement | null)[]>;
}

export function SearchResults({controller, options, listId, resultsRef, links}: SearchResultsProps) {
  const t = (key: string) => getTranslation(options.currentLanguage ?? 'en', `search.${key}`);
  const autocomplete = controller.mode === 'autocomplete';
  const {body, pagination} = controller.response;
  const hasNext = body.length > 0 && (pagination?.last != null ? !pagination.last
    : pagination?.total_pages != null ? controller.page + 1 < pagination.total_pages : false);
  const pageLabel = t('page').replace('{page}', String(controller.page + 1));

  return <div ref={resultsRef} className="fusioni-search-results" aria-busy={controller.loading}>
    {!autocomplete && controller.searched && body.length > 0 && <p className="fusioni-search-summary" role="status">
      {t('count').replace('{count}', String(body.length))}
    </p>}
    <div id={listId} role={autocomplete ? 'listbox' : 'list'} aria-label={t('results')}>
      {body.map((item, index) => {
        const href = searchItemUrl(item.url, resultsRef.current?.ownerDocument ?? document);
        const active = controller.activeIndex === index;
        const content = <>
          <span className="fusioni-search-item-copy">
            <strong className="fusioni-search-item-title">{item.name || item.chunk_title || item.url || t('untitled')}</strong>
            {item.content && <span className="fusioni-search-item-description">{item.content}</span>}
            {href && <span className="fusioni-search-item-url">{item.url}</span>}
          </span>
          {href && <span className="fusioni-search-item-arrow" aria-hidden="true">↗</span>}
        </>;
        const className = `fusioni-search-item${active ? ' fusioni-search-item-active' : ''}`;
        return <div key={`${item.id ?? item.url ?? item.name}-${index}`} role={autocomplete ? 'none' : 'listitem'}>
          {href ? <a ref={element => {links.current[index] = element;}} id={`${listId}-${index}`} href={href}
            className={className} role={autocomplete ? 'option' : undefined}
            aria-selected={autocomplete ? active : undefined} tabIndex={autocomplete ? -1 : undefined}
            onMouseDown={event => {if (autocomplete) event.preventDefault();}}
            onMouseEnter={() => {if (autocomplete) controller.setActiveIndex(index);}}
            onClick={event => {
              if (options.onSelect?.(item) === false) {event.preventDefault(); return;}
              if (autocomplete) controller.setOpen(false);
            }}>{content}</a>
            : <div id={`${listId}-${index}`} className={`${className} fusioni-search-item-disabled`}
              role={autocomplete ? 'option' : undefined} aria-selected={autocomplete ? false : undefined}
              aria-disabled="true">{content}</div>}
        </div>;
      })}
    </div>
    {controller.loading && <div className="fusioni-search-status" role="status">
      <span className="fusioni-search-skeleton" aria-hidden="true" />{t('loading')}
    </div>}
    {controller.error && <div className="fusioni-search-status fusioni-search-error" role="alert">
      <span>{t('failed')}</span><button type="button" onClick={() => void controller.search()}>{t('retry')}</button>
    </div>}
    {controller.searched && !body.length && <p className="fusioni-search-status" role="status">{t('empty')}</p>}
    {!autocomplete && !controller.loading && !controller.error && (controller.page > 0 || hasNext) &&
      <nav className="fusioni-search-pagination" aria-label={t('pagination')}>
        <button type="button" disabled={controller.page === 0} onClick={() => void controller.searchPage(controller.page - 1)}>{t('previous')}</button>
        <span aria-live="polite">{pageLabel}</span>
        <button type="button" disabled={!hasNext} onClick={() => void controller.searchPage(controller.page + 1)}>{t('next')}</button>
      </nav>}
  </div>;
}

import React, {forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {getTranslation} from '../i18n';
import {useSearch} from '../hooks/useSearch';
import {useSearchInput} from '../hooks/useSearchInput';
import {useSearchPosition} from '../hooks/useSearchPosition';
import type {SearchHandle, SearchProps} from '../types/search';
import {resolveSearchElement} from '../utils/searchElements';
import {SearchResults} from './SearchResults';
import styles from '../styles/search.css';

let nextSearchId = 0;

/** Search Fusion data using an SDK field or an existing input on the host page. */
export const Search = forwardRef<SearchHandle, SearchProps>((props, ref) => {
  const controller = useSearch(props);
  const internalInput = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const links = useRef<(HTMLAnchorElement | null)[]>([]);
  const [listId] = useState(() => `fusioni-search-results-${++nextSearchId}`);
  const [input, setInput] = useState<HTMLInputElement | null>(null);
  const [resultElement, setResultElement] = useState<HTMLElement | null>(null);
  const autocomplete = controller.mode === 'autocomplete';
  const visible = controller.loading || controller.searched || controller.error;
  const showResults = visible && (!autocomplete || controller.open);
  const dropdown = autocomplete && !resultElement;
  const position = useSearchPosition(input, dropdown && showResults);
  const t = (key: string) => getTranslation(props.currentLanguage ?? 'en', `search.${key}`);

  useLayoutEffect(() => {
    setInput(props.inputElement ? resolveSearchElement(props.inputElement, true) : internalInput.current);
    setResultElement(props.resultElement ? resolveSearchElement(props.resultElement) : null);
  }, [props.inputElement, props.resultElement]);
  useSearchInput(input, controller, listId, resultsRef, links);

  useImperativeHandle(ref, () => ({
    get results() {return controller.response.body;},
    get pagination() {return controller.response.pagination;},
    search(query = input?.value ?? controller.query, page = 0) {
      if (input) input.value = query;
      return controller.search(query, page);
    },
    clear() {if (input) input.value = ''; controller.clear();},
    focus() {input?.focus();},
  }), [controller, input]);

  const results = showResults ? <SearchResults controller={controller} options={props}
    listId={listId} resultsRef={resultsRef} links={links} /> : null;
  let portal: React.ReactPortal | null = null;
  if (results && (resultElement || (dropdown && input))) {
    // Keep automatic overlays in the input's DOM tree so ARIA references work in Shadow DOM too.
    const root = input?.getRootNode();
    const target = resultElement ?? (root?.nodeType === 11 ? root as ShadowRoot : input!.ownerDocument.body);
    portal = createPortal(<div className={`fusioni-search${dropdown ? ' fusioni-search-dropdown' : ' fusioni-search-custom-results'}`}
      data-theme={props.theme ?? 'light'} style={{...props.style, ...(dropdown ? position : {})}}>
      <style data-fusioni-search="">{styles}</style>{results}
    </div>, target);
  }

  return <div className={`fusioni-search${props.className ? ` ${props.className}` : ''}`}
    data-theme={props.theme ?? 'light'} style={props.style}>
    <style data-fusioni-search="">{styles}</style>
    {!props.inputElement && <form className="fusioni-search-form" role="search">
      <label className="fusioni-search-label" htmlFor={`${listId}-input`}>{props.label ?? t('label')}</label>
      <div className="fusioni-search-field">
        <svg className="fusioni-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" />
        </svg>
        <input ref={internalInput} id={`${listId}-input`} type="search" className="fusioni-search-input"
          placeholder={props.placeholder ?? t('placeholder')} />
        {!autocomplete && <button type="submit" className="fusioni-search-submit">{t('submit')}</button>}
      </div>
    </form>}
    {portal ?? (!resultElement && !dropdown ? results : null)}
  </div>;
});
Search.displayName = 'Search';

import {useEffect, useLayoutEffect, useRef} from 'react';
import type {RefObject} from 'react';
import type {SearchController} from './useSearch';
import {searchItemUrl} from '../utils/searchElements';

/** Bind native inputs without replacing their nodes, values, or existing event handlers. */
export function useSearchInput(
  input: HTMLInputElement | null,
  controller: SearchController,
  listId: string,
  resultsRef: RefObject<HTMLDivElement>,
  links: RefObject<(HTMLAnchorElement | null)[]>,
) {
  const latest = useRef(controller);
  latest.current = controller;
  const autocomplete = controller.mode === 'autocomplete';

  useLayoutEffect(() => {
    if (!input) return;
    const attributes = ['role', 'autocomplete', 'aria-autocomplete', 'aria-haspopup', 'aria-controls',
      'aria-expanded', 'aria-activedescendant', 'aria-busy'];
    const original = attributes.map(name => [name, input.getAttribute(name)] as const);
    if (autocomplete) {
      input.setAttribute('role', 'combobox');
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('aria-autocomplete', 'list');
      input.setAttribute('aria-haspopup', 'listbox');
      input.setAttribute('aria-controls', listId);
    }
    latest.current.change(input.value, false);
    let composing = false;
    const onInput = (event: Event) => latest.current.change(input.value, !composing && !(event as InputEvent).isComposing);
    const onCompositionStart = () => {composing = true; latest.current.change(input.value, false);};
    const onCompositionEnd = () => {composing = false; latest.current.change(input.value);};
    const onFocus = () => {
      if (!autocomplete) return;
      if (latest.current.searched || latest.current.error) latest.current.setOpen(true);
      else latest.current.change(input.value);
    };
    const onBlur = (event: FocusEvent) => {
      if (autocomplete && !resultsRef.current?.contains(event.relatedTarget as Node | null)) latest.current.setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (composing || event.isComposing || event.keyCode === 229) return;
      const state = latest.current;
      if (autocomplete && (event.key === 'ArrowDown' || event.key === 'ArrowUp') && state.response.body.length) {
        const indices = state.response.body.flatMap((item, index) => searchItemUrl(item.url, input.ownerDocument) ? [index] : []);
        if (!indices.length) return;
        event.preventDefault();
        const current = state.open ? indices.indexOf(state.activeIndex) : -1;
        const next = current < 0 ? (event.key === 'ArrowDown' ? 0 : indices.length - 1)
          : (current + (event.key === 'ArrowDown' ? 1 : -1) + indices.length) % indices.length;
        state.setOpen(true);
        state.setActiveIndex(indices[next]);
      } else if (event.key === 'Escape' && autocomplete) {
        event.preventDefault();
        state.setOpen(false);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (autocomplete && state.open && state.activeIndex >= 0) links.current?.[state.activeIndex]?.click();
        else void state.search(input.value);
      } else if (event.key === 'Tab' && autocomplete) {
        state.setOpen(false);
      }
    };
    const onSubmit = (event: Event) => {event.preventDefault(); void latest.current.search(input.value);};
    const onOutside = (event: Event) => {
      const path = event.composedPath();
      if (!path.includes(input) && (!resultsRef.current || !path.includes(resultsRef.current))) latest.current.setOpen(false);
    };
    const form = input.form;
    input.addEventListener('input', onInput);
    input.addEventListener('compositionstart', onCompositionStart);
    input.addEventListener('compositionend', onCompositionEnd);
    input.addEventListener('focus', onFocus);
    input.addEventListener('blur', onBlur);
    input.addEventListener('keydown', onKeyDown);
    form?.addEventListener('submit', onSubmit);
    if (autocomplete) input.ownerDocument.addEventListener('pointerdown', onOutside, true);
    return () => {
      input.removeEventListener('input', onInput);
      input.removeEventListener('compositionstart', onCompositionStart);
      input.removeEventListener('compositionend', onCompositionEnd);
      input.removeEventListener('focus', onFocus);
      input.removeEventListener('blur', onBlur);
      input.removeEventListener('keydown', onKeyDown);
      form?.removeEventListener('submit', onSubmit);
      input.ownerDocument.removeEventListener('pointerdown', onOutside, true);
      latest.current.cancel();
      original.forEach(([name, value]) => value === null ? input.removeAttribute(name) : input.setAttribute(name, value));
    };
  }, [autocomplete, input, links, listId, resultsRef]);

  const visible = controller.open && (controller.loading || controller.searched || controller.error);
  useLayoutEffect(() => {
    if (!input || !autocomplete) return;
    input.setAttribute('aria-expanded', String(visible));
    input.setAttribute('aria-busy', String(controller.loading));
    if (visible && controller.activeIndex >= 0) input.setAttribute('aria-activedescendant', `${listId}-${controller.activeIndex}`);
    else input.removeAttribute('aria-activedescendant');
  }, [autocomplete, controller.activeIndex, controller.loading, input, listId, visible]);

  useEffect(() => {
    if (visible && controller.activeIndex >= 0) links.current?.[controller.activeIndex]?.scrollIntoView?.({block: 'nearest'});
  }, [controller.activeIndex, links, visible]);
}

/** Resolve selectors eagerly so a typo does not silently create an unrelated search field. */
export function resolveSearchElement<T extends HTMLElement>(
  value: string | T, input = false,
): T {
  const element = typeof value === 'string' ? document.querySelector(value) : value;
  if (!(element instanceof HTMLElement) || (input && !(element instanceof HTMLInputElement))) {
    throw new Error(`Fusioni Search: ${input ? 'inputElement' : 'resultElement'} must resolve to ${input ? 'an HTMLInputElement' : 'an HTMLElement'}.`);
  }
  return element as T;
}

/** Only web links are navigable; relative links resolve against the host page. */
export function searchItemUrl(url: string | null | undefined, document: Document): string | undefined {
  if (!url?.trim()) return undefined;
  try {
    const parsed = new URL(url.trim(), document.baseURI);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? url.trim() : undefined;
  } catch {
    return undefined;
  }
}

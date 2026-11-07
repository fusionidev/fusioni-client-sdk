const React = require('react');
const {createRoot} = require('react-dom/client');
const act = React.act ?? require('react-dom/test-utils').act;
const {Search} = require('../src/components/Search');
global.IS_REACT_ACT_ENVIRONMENT = true;
const item = (name = 'Setup guide', extra = {}) => ({id: name, agency_id: 'agency', name, content: 'How to configure Fusion.', storage_id: 'docs', url: `#${name.replace(/ /g, '-')}`, ...extra});
const deferred = () => {let resolve; const promise = new Promise(yes => {resolve = yes;}); return {promise, resolve};};

describe('Search component', () => {
  let container, root, ref, client, props, external;
  beforeEach(() => {
    jest.useFakeTimers();
    container = document.createElement('div'); document.body.appendChild(container);
    root = createRoot(container); ref = React.createRef(); external = [];
    client = {post: jest.fn(async () => ({body: [item()], pagination: {page: 0, size: 2, total_pages: 2, last: false}}))};
    props = {agencyId: 'agency', apiClient: client, mode: 'autocomplete', debounceMs: 250};
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove(); external.forEach(element => element.remove());
    jest.useRealTimers(); jest.restoreAllMocks();
  });
  const render = async extra => {props = {...props, ...extra}; await act(async () => root.render(React.createElement(Search, {...props, ref})));};
  const input = () => container.querySelector('input') ?? document.querySelector('#external-input');
  const type = async value => act(async () => {input().value = value; input().dispatchEvent(new Event('input', {bubbles: true}));});
  const tick = async (ms = 250) => act(async () => jest.advanceTimersByTime(ms));
  const key = async key => act(async () => input().dispatchEvent(new KeyboardEvent('keydown', {key, bubbles: true, cancelable: true})));
  const add = element => {external.push(element); document.body.appendChild(element); return element;};

  it('debounces autocomplete, enforces minimum length, and positions results below the field', async () => {
    await render();
    input().getBoundingClientRect = () => ({left: 24, bottom: 80, width: 300});
    await type('g'); await tick(); expect(client.post).not.toHaveBeenCalled();
    await type('gu'); await tick(200); await type('guide'); await tick(249); expect(client.post).not.toHaveBeenCalled();
    await tick(1);
    expect(client.post).toHaveBeenCalledTimes(1);
    expect(client.post).toHaveBeenCalledWith('/fusion_data/asearch', {agency_id: 'agency', inp: 'guide'}, expect.objectContaining({params: {page: 0, size: 25, agency_id: 'agency'}, signal: expect.any(AbortSignal)}));
    const dropdown = document.querySelector('.fusioni-search-dropdown');
    expect(dropdown.textContent).toContain('Setup guide'); expect(dropdown.style.top).toBe('88px'); expect(dropdown.style.width).toBe('300px');
    expect(input().getAttribute('aria-expanded')).toBe('true'); expect(input().getAttribute('aria-controls')).toBe(dropdown.querySelector('[role="listbox"]').id);
    await type(' '); expect(document.querySelector('.fusioni-search-dropdown')).toBeNull();
    expect(ref.current.results).toEqual([]);
  });

  it('supports arrows, Enter, Escape, focus reopening, and cancellable URL selection', async () => {
    const onSelect = jest.fn(() => false);
    client.post.mockResolvedValue({body: [item('No URL', {url: null}), item(), item('Other')], pagination: null});
    await render({onSelect}); await type('guide'); await tick();
    await key('ArrowDown');
    const selected = document.getElementById(input().getAttribute('aria-activedescendant'));
    expect(selected.getAttribute('href')).toBe('#Setup-guide'); expect(selected.getAttribute('aria-selected')).toBe('true');
    await key('Enter'); expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({name: 'Setup guide'}));
    expect(input().getAttribute('aria-expanded')).toBe('true');
    await key('ArrowUp'); expect(document.getElementById(input().getAttribute('aria-activedescendant')).textContent).toContain('Other');
    await key('Escape'); expect(document.querySelector('.fusioni-search-dropdown')).toBeNull();
    await act(async () => input().focus()); expect(document.querySelector('.fusioni-search-dropdown')).not.toBeNull();
    await key('Tab'); expect(document.querySelector('.fusioni-search-dropdown')).toBeNull();
  });

  it('renders safe native links and leaves default browser navigation enabled', async () => {
    const onSelect = jest.fn(); await render({onSelect}); await type('guide'); await tick();
    const link = document.querySelector('.fusioni-search-item');
    const click = new MouseEvent('click', {bubbles: true, cancelable: true});
    await act(async () => link.dispatchEvent(click));
    expect(link.getAttribute('href')).toBe('#Setup-guide'); expect(click.defaultPrevented).toBe(false);
    expect(onSelect).toHaveBeenCalledWith(item()); expect(document.querySelector('.fusioni-search-dropdown')).toBeNull();
  });

  it('uses a custom result element, preserves its existing children and restores input attributes', async () => {
    const form = add(document.createElement('form'));
    form.innerHTML = '<label for="external-input">Existing search</label><input id="external-input" autocomplete="on" aria-expanded="mixed" value="prefilled">';
    const bound = form.querySelector('input'); const hostInput = jest.fn(); bound.addEventListener('input', hostInput);
    const results = add(document.createElement('section')); results.id = 'results'; results.innerHTML = '<h2>Matches</h2>';
    await render({inputElement: '#external-input', resultElement: results});
    expect(container.querySelector('input')).toBeNull(); expect(bound.value).toBe('prefilled');
    await type('guide'); await tick();
    expect(results.querySelector('[role="listbox"]')).not.toBeNull(); expect(results.querySelector('h2').textContent).toBe('Matches');
    expect(document.querySelector('.fusioni-search-dropdown')).toBeNull(); expect(hostInput).toHaveBeenCalledTimes(1);
    await act(async () => root.render(null));
    expect(results.innerHTML).toBe('<h2>Matches</h2>'); expect(bound.getAttribute('autocomplete')).toBe('on');
    expect(bound.getAttribute('aria-expanded')).toBe('mixed'); expect(bound.hasAttribute('role')).toBe(false);
    bound.dispatchEvent(new Event('input')); await tick(); expect(client.post).toHaveBeenCalledTimes(1);
  });

  it('submits full searches without requesting while typing, and pages the submitted query', async () => {
    await render({mode: 'search', pageSize: 2});
    await type('guide'); await tick(); expect(client.post).not.toHaveBeenCalled();
    await act(async () => container.querySelector('form').dispatchEvent(new Event('submit', {bubbles: true, cancelable: true})));
    expect(client.post.mock.calls[0][0]).toBe('/fusion_data/psearch'); expect(container.querySelector('[role="list"]')).not.toBeNull();
    expect(container.querySelector('input').hasAttribute('role')).toBe(false);
    client.post.mockResolvedValueOnce({body: [item('Page two')], pagination: {page: 1, size: 2, last: true}});
    await act(async () => container.querySelector('nav button:last-child').click());
    expect(client.post.mock.calls[1][1].inp).toBe('guide'); expect(client.post.mock.calls[1][2].params).toEqual({page: 1, size: 2, agency_id: 'agency'});
    expect(container.querySelector('nav').textContent).toContain('Page 2'); expect(container.querySelector('nav button:last-child').disabled).toBe(true);
    expect(ref.current.pagination.last).toBe(true);
    await act(async () => container.querySelector('nav button').click()); expect(client.post.mock.calls[2][2].params.page).toBe(0);
  });

  it('binds full-search form submission to an external input and exposes search, clear and focus', async () => {
    const form = add(document.createElement('form')); form.innerHTML = '<input id="external-input">';
    await render({mode: 'search', inputElement: form.querySelector('input')}); await type('external guide');
    const event = new Event('submit', {bubbles: true, cancelable: true});
    await act(async () => form.dispatchEvent(event)); expect(event.defaultPrevented).toBe(true);
    expect(client.post.mock.calls[0][1].inp).toBe('external guide');
    await act(async () => ref.current.search('manual', 2)); expect(input().value).toBe('manual'); expect(ref.current.results).toHaveLength(1);
    await act(async () => ref.current.focus()); expect(document.activeElement).toBe(input());
    await act(async () => ref.current.clear()); expect(input().value).toBe(''); expect(ref.current.results).toEqual([]);
  });

  it('aborts immediately on a new query and ignores out-of-order results', async () => {
    const old = deferred(); const current = deferred(); const onResults = jest.fn();
    client.post.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    await render({onResults}); await type('old'); await tick(); const signal = client.post.mock.calls[0][2].signal;
    await type('new'); expect(signal.aborted).toBe(true); await tick();
    await act(async () => current.resolve({body: [item('New result')], pagination: null}));
    await act(async () => old.resolve({body: [item('Old result')], pagination: null}));
    expect(ref.current.results[0].name).toBe('New result'); expect(onResults).toHaveBeenCalledTimes(1);
  });

  it('keeps dismissed suggestions closed while requests complete and cancels a pending debounce', async () => {
    await render(); await type('guide'); await key('Escape'); await tick(); expect(client.post).not.toHaveBeenCalled();
    const pending = deferred(); client.post.mockReturnValue(pending.promise);
    await type('guide'); await tick(); await key('Escape');
    await act(async () => pending.resolve({body: [item()], pagination: null}));
    expect(document.querySelector('.fusioni-search-dropdown')).toBeNull();
    await act(async () => input().focus()); expect(document.querySelector('.fusioni-search-dropdown')).not.toBeNull();
    await act(async () => document.body.dispatchEvent(new Event('pointerdown', {bubbles: true}))); expect(document.querySelector('.fusioni-search-dropdown')).toBeNull();
  });

  it('waits until IME composition finishes before searching', async () => {
    await render();
    await act(async () => input().dispatchEvent(new Event('compositionstart', {bubbles: true})));
    await type('δοκιμή'); await key('Enter'); await tick(); expect(client.post).not.toHaveBeenCalled();
    await act(async () => input().dispatchEvent(new Event('compositionend', {bubbles: true}))); await tick();
    expect(client.post).toHaveBeenCalledTimes(1); expect(client.post.mock.calls[0][1].inp).toBe('δοκιμή');
  });

  it('shows loading, localized errors, retry and empty states', async () => {
    const onError = jest.fn(); const pending = deferred(); client.post.mockReturnValueOnce(pending.promise);
    await render({currentLanguage: 'el', onError}); await type('guide'); await tick();
    expect(document.querySelector('[role="status"]').textContent).toContain('Αναζήτηση');
    await act(async () => pending.resolve({body: [], pagination: null}));
    expect(document.querySelector('[role="status"]').textContent).toContain('Δεν βρέθηκαν');
    client.post.mockRejectedValueOnce(new Error('offline')); await type('retry'); await tick();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({message: 'offline'}));
    expect(document.querySelector('[role="alert"]').textContent).toContain('δεν ολοκληρώθηκε');
    await act(async () => document.querySelector('[role="alert"] button').click()); expect(ref.current.results).toHaveLength(1);
  });

  it('escapes result text and disables missing or non-web URLs', async () => {
    client.post.mockResolvedValue({body: [item('<img src=x onerror=alert(1)>', {content: '<script>bad()</script>', url: 'javascript:alert(1)'}),
      item('Missing URL', {url: ''}), item('Relative', {url: '/guide'}), item('Absolute', {url: 'https://docs.test/guide'})], pagination: null});
    await render(); await type('guide'); await tick();
    expect(document.querySelectorAll('.fusioni-search-item[aria-disabled="true"]')).toHaveLength(2);
    expect(document.querySelector('.fusioni-search-results img')).toBeNull(); expect(document.querySelector('.fusioni-search-results script')).toBeNull();
    expect([...document.querySelectorAll('a.fusioni-search-item')].map(link => link.getAttribute('href'))).toEqual(['/guide', 'https://docs.test/guide']);
  });

  it('cleans up timers, pending requests and portals on unmount, agency changes and StrictMode', async () => {
    const pending = deferred(); const onResults = jest.fn(); client.post.mockReturnValue(pending.promise);
    await act(async () => root.render(React.createElement(React.StrictMode, null, React.createElement(Search, {...props, ref, onResults}))));
    await type('guide'); await tick(); const signal = client.post.mock.calls[0][2].signal;
    await act(async () => root.render(React.createElement(React.StrictMode, null, React.createElement(Search, {...props, agencyId: 'other', ref, onResults}))));
    expect(signal.aborted).toBe(true); expect(ref.current.results).toEqual([]);
    await act(async () => pending.resolve({body: [item('Stale')], pagination: null})); expect(onResults).not.toHaveBeenCalled();
    client.post.mockReturnValue(new Promise(() => {}));
    await type('new guide'); await tick(); const unmountSignal = client.post.mock.calls.at(-1)[2].signal;
    await act(async () => root.render(null)); expect(unmountSignal.aborted).toBe(true); expect(document.querySelector('.fusioni-search-dropdown')).toBeNull();
  });
});

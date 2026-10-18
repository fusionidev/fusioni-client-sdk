const React = require('react');
const {createRoot} = require('react-dom/client');
const {Simulate} = require('react-dom/test-utils');
const act = React.act ?? require('react-dom/test-utils').act;
jest.mock('../src/components/MessageStreamLoading', () => ({MessageStreamLoading: ({streamMessages, loadingLabel}) => React.createElement('span', null, streamMessages.join(' ') || loadingLabel)}));
const {ActionButtons} = require('../src/components/ActionButtons');
global.IS_REACT_ACT_ENVIRONMENT = true;
const deferred = () => {let resolve; const promise = new Promise(yes => {resolve = yes;}); return {promise, resolve};};

describe('React action buttons', () => {
  let container, root, ref, client, actions, profiles, props;
  beforeEach(() => {
    sessionStorage.clear();
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); ref = React.createRef();
    actions = [{id: 'report-id', key: 'report', title: 'Report', agency_id: 'agency', enabled: true, show_results: true,
      literals: [{language: 'en', text: 'Create report', description: 'A summary of your project', prompt: 'report'}], conversation_profile_id: 'profile'}];
    profiles = [{id: 'profile', name: 'Report profile', input_fields: [
      {name: 'count', type: 'number', required: true, labels: [{language: 'en', text: 'Count'}], validation_rules: [{operator: 'greater_than', value: 0}]},
      {name: 'prompt', type: 'prompt', required: true, labels: [{language: 'en', text: 'Instructions'}]},
    ]}];
    client = {get: jest.fn(async url => url === '/action/by_group_tags' ? actions : profiles),
      post: jest.fn(async () => ({answer: ['<p>Finished</p>'], execution_time_ms: 1000}))};
    props = {agencyId: 'agency', tags: ['tools'], apiClient: client, onResponse: jest.fn()};
  });
  afterEach(async () => {await act(async () => root.unmount()); container.remove(); jest.restoreAllMocks();});
  const render = async extra => {props = {...props, ...extra}; await act(async () => root.render(React.createElement(ActionButtons, {...props, ref})));};
  const clickAction = async () => act(async () => container.querySelector('[data-action-key="report"]').click());
  const change = async (element, value) => act(async () => Simulate.change(element, {target: {value}}));

  it('renders descriptions, validates fields, and preserves prompt drafts after failed Send', async () => {
    await render({showRunButton: false}); await clickAction();
    expect(container.querySelector('.fusioni-action-card').getAttribute('aria-label')).toContain('A summary of your project');
    expect(container.querySelector('[type="submit"]')).toBeNull();
    const prompt = container.querySelector('textarea'); await change(prompt, 'Retain these instructions');
    await act(async () => Simulate.keyDown(prompt, {key: 'Enter', shiftKey: false}));
    expect(client.post).not.toHaveBeenCalled(); expect(prompt.value).toBe('Retain these instructions');
    const count = container.querySelector('input[type="number"]'); expect(count.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(count.getAttribute('aria-describedby')).textContent).toContain('required');
    await change(count, '2'); await act(async () => Simulate.keyDown(prompt, {key: 'Enter', shiftKey: false}));
    expect(client.post.mock.calls[0][1].context).toEqual({count: 2, prompt: 'Retain these instructions'});
    expect(container.querySelector('.fusioni-action-result').textContent).toContain('Finished');
    expect(container.querySelector('.fusioni-action-execution-time').textContent).toBe('1.00s');
  });

  it('preserves the exact input nodes and drafts when switching fullscreen, exposes side content, and handles Escape', async () => {
    const onFullscreenChange = jest.fn(); await render({sidePanel: React.createElement('p', null, 'Context panel'), onFullscreenChange}); await clickAction();
    const prompt = container.querySelector('textarea'); await change(prompt, 'Draft');
    await act(async () => container.querySelector('[aria-label="Enter fullscreen"]').click());
    const dialog = document.querySelector('[role="dialog"]'); expect(dialog.querySelector('textarea')).toBe(prompt);
    expect(dialog.textContent).toContain('Context panel'); expect(document.body.style.overflow).toBe('hidden');
    await act(async () => dialog.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true})));
    expect(container.querySelector('textarea')).toBe(prompt); expect(prompt.value).toBe('Draft');
    expect(document.querySelector('[role="dialog"]')).toBeNull(); expect(onFullscreenChange.mock.calls.map(call => call[0])).toEqual([true, false]);
  });

  it('updates disabled states and cancels an open form', async () => {
    await render(); await clickAction(); expect(container.querySelector('form')).not.toBeNull();
    await render({actionEnabledStates: {report: false}}); expect(container.querySelector('form')).toBeNull();
    expect(container.querySelector('.fusioni-action-card').disabled).toBe(true);
    await act(async () => ref.current.executeAction('report')); expect(client.post).not.toHaveBeenCalled();
  });

  it('hides result panels while still emitting callbacks and exposing results through the ref', async () => {
    await render({showActionResult: false, actionInputFieldValues: {'*': {count: 1, prompt: 'Input'}}});
    await act(async () => ref.current.executeAction('report'));
    expect(container.querySelector('.fusioni-action-transcript')).toBeNull(); expect(props.onResponse).toHaveBeenCalledTimes(1);
    expect(ref.current.results[0].content).toBe('<p>Finished</p>');
  });
  it('uses an injected client connection for media URLs and authenticated link previews', async () => {
    client.getBaseUrl = () => 'https://backend.test/api'; client.getAccessToken = () => 'client-token';
    client.post.mockResolvedValue({answer: ['Read https://docs.test/guide'], extra_data: {image_ref: 'image-id'}});
    const fetch = jest.fn(async () => ({text: async () => '<title>Guide</title>'}));
    const previous = global.fetch; global.fetch = fetch;
    try {
      await render({actionInputFieldValues: {'*': {count: 1, prompt: 'Input'}}});
      await act(async () => ref.current.executeAction('report'));
      expect(ref.current.results[0].images).toEqual(['https://backend.test/api/image/file/image-id']);
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('https://backend.test/api/proxy/agency/web'),
        expect.objectContaining({headers: {Authorization: 'ApiKey client-token'}}));
    } finally {global.fetch = previous;}
  });

  it('cancels the old agency request and ignores its late execution result', async () => {
    await render({actionInputFieldValues: {'*': {count: 1, prompt: 'Input'}}}); const pending = deferred(); client.post.mockReturnValue(pending.promise);
    let execution; await act(async () => {execution = ref.current.executeAction('report');});
    const signal = client.post.mock.calls[0][2].signal;
    await render({agencyId: 'different'}); expect(signal.aborted).toBe(true);
    await act(async () => {pending.resolve({answer: ['Stale']}); await execution;});
    expect(ref.current.results).toEqual([]); expect(props.onResponse).not.toHaveBeenCalled();
  });

  it('handles load failures, retries and empty query results', async () => {
    client.get.mockRejectedValueOnce(new Error('offline')); await render(); expect(container.querySelector('[role="alert"]').textContent).toContain('could not be loaded');
    await act(async () => container.querySelector('[role="alert"] button').click()); expect(container.querySelector('.fusioni-action-card')).not.toBeNull();
    actions = []; await act(async () => ref.current.loadActions()); expect(container.textContent).toContain('No actions found');
    await render({tags: ['  ']}); expect(container.childElementCount).toBe(0);
  });

  it('loads and cleans up correctly in StrictMode', async () => {
    await act(async () => root.render(React.createElement(React.StrictMode, null, React.createElement(ActionButtons, {...props, ref}))));
    expect(container.querySelectorAll('.fusioni-action-card')).toHaveLength(1); expect(client.get.mock.calls[0][1].signal.aborted).toBe(true);
  });
});

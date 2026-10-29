const React = require('react');
const {createRoot} = require('react-dom/client');
const act = React.act ?? require('react-dom/test-utils').act;
const {ActionService} = require('../src/services/ActionService');
const {SDKClientService} = require('../src/services/SDKClientService');
const {MessageList} = require('../src/components/MessageList');
global.IS_REACT_ACT_ENVIRONMENT = true;

it('maps the client assigned profile and clears an absent server assignment', () => {
  const service = new SDKClientService();
  const config = {agencyId: 'agency', apiBaseUrl: '/api', conversationProfileId: 'old'};
  expect(service.mergeConfig(config, {conversation_profile_id: 'profile'}).conversationProfileId).toBe('profile');
  expect(service.mergeConfig(config, {conversation_profile_id: null}).conversationProfileId).toBeNull();
  expect(service.mergeConfig(config, {}).conversationProfileId).toBeNull();
});

it('requests the profile endpoint scoped to the agency and skips blank profiles', async () => {
  const client = {get: jest.fn().mockResolvedValue([{id: 'action'}])};
  const service = new ActionService(client);
  const signal = new AbortController().signal;
  expect(await service.findByConversationProfileId('agency', 'profile', signal)).toEqual([{id: 'action'}]);
  expect(client.get).toHaveBeenCalledWith('/action/by_conversation_profile', {
    params: {agency_id: 'agency', conversation_profile_id: 'profile'}, signal,
  });
  await service.findByConversationProfileId('agency', ' ');
  expect(client.get).toHaveBeenCalledTimes(1);
});

describe('chat action suggestions', () => {
  let container, root, find, all;
  const action = (id, enabled = true) => ({id, title: id, enabled, agency_id: 'agency', literals: [
    {text: id, prompt: `Run ${id}`, language: 'en'}, {text: `Greek ${id}`, prompt: id, language: 'el'},
  ]});
  beforeEach(() => {
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
    find = jest.spyOn(ActionService.prototype, 'findByConversationProfileId').mockResolvedValue([action('Book'), action('Disabled', false)]);
    all = jest.spyOn(ActionService.prototype, 'findEnabledByAgencyId');
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);
  });
  afterEach(async () => {await act(async () => root.unmount()); container.remove(); jest.restoreAllMocks();});
  async function render(profile, extra = {}) {
    await act(async () => root.render(React.createElement(MessageList, {
      messages: [], streamMessages: [], agencyId: 'agency', conversationProfileId: profile, ...extra,
    })));
  }
  it('shows enabled profile actions in the selected language and sends their prompt', async () => {
    const onSuggestionClick = jest.fn(); await render('profile', {onSuggestionClick});
    expect(find).toHaveBeenCalledWith('agency', 'profile', expect.any(AbortSignal));
    expect(container.textContent).toContain('Book'); expect(container.textContent).not.toContain('Disabled');
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent.includes('Book')).click());
    expect(onSuggestionClick).toHaveBeenCalledWith('Run Book');
    await render('profile', {currentLanguage: 'el'}); expect(container.textContent).toContain('Greek Book');
    expect(all).not.toHaveBeenCalled();
  });
  it('does not fetch agency actions without a profile and clears suggestions on removal', async () => {
    await render(null); expect(find).not.toHaveBeenCalled();
    await render('profile'); expect(container.textContent).toContain('Book');
    await render(null); expect(container.textContent).not.toContain('Book'); expect(all).not.toHaveBeenCalled();
  });
  it('hides the suggestions section when the server returns no actions', async () => {
    await render('profile'); expect(container.querySelector('.fusioni-empty-suggestions')).not.toBeNull();
    find.mockResolvedValueOnce([]); await render('empty-profile');
    expect(container.querySelector('.fusioni-empty-suggestions')).toBeNull();
    expect(container.querySelector('.fusioni-empty-suggestion-chip')).toBeNull();
  });
  it('hides the suggestions section when no profile is assigned or all actions are disabled', async () => {
    await render(null); expect(container.querySelector('.fusioni-empty-suggestions')).toBeNull();
    find.mockResolvedValueOnce([action('Disabled', false)]); await render('profile');
    expect(container.querySelector('.fusioni-empty-suggestions')).toBeNull();
  });
  it('ignores responses for a previous profile', async () => {
    let resolve;
    find.mockReturnValueOnce(new Promise(yes => {resolve = yes;}));
    await render('old'); const signal = find.mock.calls[0][2];
    find.mockResolvedValueOnce([action('New action')]); await render('new');
    expect(signal.aborted).toBe(true);
    await act(async () => resolve([action('Old action')]));
    expect(container.textContent).toContain('New action'); expect(container.textContent).not.toContain('Old action');
  });
});

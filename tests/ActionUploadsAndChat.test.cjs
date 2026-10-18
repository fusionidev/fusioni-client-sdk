const React = require('react');
const {createRoot} = require('react-dom/client');
const {Simulate} = require('react-dom/test-utils');
const act = React.act ?? require('react-dom/test-utils').act;
jest.mock('../src/components/MessageStreamLoading', () => ({MessageStreamLoading: ({streamMessages, loadingLabel}) => React.createElement('span', null, streamMessages.join(' ') || loadingLabel)}));
const {ActionFileField} = require('../src/components/ActionFileField');
const {ActionProfileChat} = require('../src/components/ActionProfileChat');
const {ChatInput} = require('../src/components/ChatInput');
global.IS_REACT_ACT_ENVIRONMENT = true;
const deferred = () => {let resolve; const promise = new Promise(yes => {resolve = yes;}); return {promise, resolve};};

describe('reused inputs, uploads and profile chat', () => {
  let container, root;
  beforeEach(() => {container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);});
  afterEach(async () => {await act(async () => root.unmount()); container.remove(); jest.restoreAllMocks();});
  const render = async element => act(async () => root.render(element));

  it('keeps upload ordering when readers finish out of order, removes pending files safely and enforces the eight-file limit', async () => {
    const readers = [], original = global.FileReader;
    global.FileReader = class {constructor() {readers.push(this);} readAsDataURL(file) {this.file = file;} abort() {this.aborted = true;}};
    try {
      const onChange = jest.fn(), onPendingChange = jest.fn();
      await render(React.createElement(ActionFileField, {inputId: 'files', label: 'Files', onChange, onPendingChange}));
      const files = Array.from({length: 10}, (_, index) => new File(['text'], `${index}.txt`, {type: 'text/plain'}));
      await act(async () => Simulate.change(container.querySelector('input'), {target: {files}}));
      expect(readers).toHaveLength(8); expect(container.querySelectorAll('.fusioni-action-file')).toHaveLength(8);
      expect(container.querySelector('.fusioni-file-upload button').disabled).toBe(true);
      await act(async () => {readers[1].result = 'second'; readers[1].onload();});
      await act(async () => container.querySelector('[aria-label="Remove 0.txt"]').click()); expect(readers[0].aborted).toBe(true);
      await act(async () => {readers[0].result = 'removed'; readers[0].onload(); readers[2].result = 'third'; readers[2].onload();});
      expect(onChange.mock.calls.at(-1)[0]).toEqual(['second', 'third']);
      for (let index = 3; index < 8; index++) await act(async () => {readers[index].result = String(index); readers[index].onload();});
      expect(onPendingChange.mock.calls.at(-1)[0]).toBe(false);
      expect(container.querySelector('.fusioni-file-upload button').disabled).toBe(false);
    } finally {global.FileReader = original;}
  });

  it('preserves the ordinary ChatInput send-and-clear behavior and controlled validation drafts', async () => {
    const send = jest.fn(), onValueChange = jest.fn();
    await render(React.createElement(ChatInput, {onSendMessage: send, onFileUpload: jest.fn(), enableAudioRecording: false}));
    let textarea = container.querySelector('textarea'); await act(async () => Simulate.change(textarea, {target: {value: '  Hello  '}}));
    await act(async () => Simulate.keyDown(textarea, {key: 'Enter'}));
    expect(send).toHaveBeenCalledWith('Hello', undefined, undefined); expect(textarea.value).toBe('');
    await render(React.createElement(ChatInput, {value: 'Preserved', onValueChange, clearOnSend: false, onSendMessage: send, onFileUpload: jest.fn(), enableAudioRecording: false}));
    textarea = container.querySelector('textarea'); await act(async () => Simulate.keyDown(textarea, {key: 'Enter'}));
    expect(textarea.value).toBe('Preserved'); expect(onValueChange).not.toHaveBeenCalled();
  });

  it('sends multiple prompt attachments in selection order and removes individual previews', async () => {
    const first = deferred(), second = deferred(), onAttachmentsChange = jest.fn(), onUploadingChange = jest.fn();
    const upload = jest.fn(file => file.name === 'one.png' ? first.promise : second.promise);
    await render(React.createElement(ChatInput, {value: 'Prompt', clearOnSend: false, maxAttachments: 8, onSendMessage: jest.fn(), onFileUpload: upload,
      onAttachmentsChange, onUploadingChange, enableAudioRecording: false}));
    const files = ['one.png', 'two.png'].map(name => new File(['image'], name, {type: 'image/png'}));
    await act(async () => Simulate.change(container.querySelector('input[type="file"]'), {target: {files}}));
    expect(onUploadingChange).toHaveBeenCalledWith(true);
    await act(async () => {second.resolve('data:image/png;base64,two'); first.resolve('data:image/png;base64,one');});
    expect(onAttachmentsChange.mock.calls.at(-1)[0]).toEqual(['data:image/png;base64,one', 'data:image/png;base64,two']);
    await act(async () => container.querySelector('[title="Remove image"]').click());
    expect(onAttachmentsChange.mock.calls.at(-1)[0]).toEqual(['data:image/png;base64,two']);
    expect(onUploadingChange.mock.calls.at(-1)[0]).toBe(false);
  });

  it('creates a profile-linked chat, sends context/uploads, streams progress, and reuses the conversation', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const pending = deferred(), onResponse = jest.fn(), close = jest.fn(); let stream;
    const client = {connectToSSE: jest.fn((_, callback) => {stream = callback; return {close};}),
      post: jest.fn((url) => url === '/conversation' ? Promise.resolve('chat-id') : pending.promise)};
    const getInputData = jest.fn(() => ({context: {customer: '123'}, uploads: ['data:file']}));
    await render(React.createElement(ActionProfileChat, {agencyId: 'agency', profile: {id: 'profile', name: 'Support', input_fields: []},
      apiClient: client, currentLanguage: 'en', getInputData, onResponse}));
    const textarea = container.querySelector('textarea'); await act(async () => Simulate.change(textarea, {target: {value: 'Question'}}));
    await act(async () => Simulate.keyDown(textarea, {key: 'Enter'}));
    expect(client.post.mock.calls[0][1]).toEqual({agency_id: 'agency', title: 'Support', conversation_profile_id: 'profile'});
    expect(client.post.mock.calls[1][1]).toEqual({agency_id: 'agency', conversation_id: 'chat-id', inp: 'Question', context: {customer: '123'}, image: 'data:file', images: ['data:file']});
    await act(async () => stream({event: 'chat_stream', data: 'Searching', payload: {conversation_id: 'chat-id'}}));
    expect(container.querySelector('[role="status"]').textContent).toBe('Searching');
    await act(async () => stream({event: 'chat_stream', data: 'Other thread', payload: {conversation_id: 'other'}}));
    expect(container.querySelector('[role="status"]').textContent).not.toContain('Other thread');
    const response = {messages: [{id: 'user', role: 'user', content: 'Question'}, {id: 'reply', role: 'assistant', content: 'Answer'}]};
    await act(async () => pending.resolve(response));
    expect(container.querySelectorAll('.fusioni-action-conversation > .fusioni-message')).toHaveLength(2);
    expect(container.querySelector('textarea').value).toBe(''); expect(onResponse).toHaveBeenCalledWith(response);
    client.post.mockResolvedValue({answer: ['Next answer']});
    await act(async () => Simulate.change(container.querySelector('textarea'), {target: {value: 'Next'}}));
    await act(async () => Simulate.keyDown(container.querySelector('textarea'), {key: 'Enter'}));
    expect(client.post.mock.calls.filter(call => call[0] === '/conversation')).toHaveLength(1);
    await act(async () => root.unmount()); expect(close).toHaveBeenCalled();
  });

  it('validates parent fields before chat creation and cancels an in-flight chat on unmount', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const pending = deferred(), onResponse = jest.fn();
    const client = {connectToSSE: jest.fn(() => ({close: jest.fn()})), post: jest.fn(() => pending.promise)};
    const getInputData = jest.fn(() => null);
    await render(React.createElement(ActionProfileChat, {agencyId: 'agency', profile: {id: 'profile', name: 'Support', input_fields: []},
      apiClient: client, currentLanguage: 'en', getInputData, onResponse}));
    await act(async () => Simulate.change(container.querySelector('textarea'), {target: {value: 'Draft'}}));
    await act(async () => Simulate.keyDown(container.querySelector('textarea'), {key: 'Enter'}));
    expect(client.post).not.toHaveBeenCalled(); expect(container.querySelector('textarea').value).toBe('Draft');
    getInputData.mockReturnValue({context: {}, uploads: []});
    await act(async () => Simulate.keyDown(container.querySelector('textarea'), {key: 'Enter'}));
    const signal = client.post.mock.calls[0][2].signal;
    await act(async () => root.unmount()); expect(signal.aborted).toBe(true);
    await act(async () => pending.resolve('chat-id')); expect(onResponse).not.toHaveBeenCalled(); expect(client.post).toHaveBeenCalledTimes(1);
  });
});

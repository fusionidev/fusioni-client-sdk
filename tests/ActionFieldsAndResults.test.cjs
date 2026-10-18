const fields = require('../src/utils/conversationInputFields');
const {buildActionResult, buildActionResults, orderActionHistory, mergeActionMessages} = require('../src/utils/actionResults');

describe('profile field conversion and validation', () => {
  it.each([
    ['number', '2.5', 2.5], ['boolean', 'yes', true], ['boolean', 'false', false], ['json', '{"n":2}', {n: 2}],
    ['list', 'a, b, , c', ['a', 'b', 'c']], ['list', '[1,2]', [1, 2]], ['file', ['a', ' b '], ['a', 'b']],
  ])('coerces %s values', (type, value, expected) => expect(fields.coerceDefaultValue(type, value)).toEqual({valid: true, value: expected}));
  it.each([['number', 'NaN'], ['number', 'Infinity'], ['json', '{broken'], ['list', '[broken'], ['file', [4]], ['boolean', 'maybe']])('rejects invalid %s', (type, value) => {
    expect(fields.isConversationInputFieldDraftInvalid({type, required: true}, value)).toBe(true);
  });
  it.each([
    ['text', 'a', 'equals', 'a', 'b'], ['text', 'a', 'not_equals', 'b', 'b'],
    ['number', '3', 'greater_than', 2, '1'], ['number', '3', 'greater_than_or_equal', 3, '2'],
    ['number', '3', 'less_than', 4, '5'], ['number', '3', 'less_than_or_equal', 3, '4'],
    ['text', 'abc', 'contains', 'b', 'xyz'], ['text', 'abc', 'not_contains', 'x', 'xxx'],
    ['text', 'abc', 'min_length', 3, 'a'], ['list', 'a,b', 'max_length', 2, 'a,b,c'],
    ['date', '2026-10-03', 'greater_than', '2026-10-02', '2026-10-01'], ['boolean', false, 'equals', false, true],
  ])('enforces %s %s %s', (type, valid, operator, value, invalid) => {
    const field = {type, required: false, validation_rules: [{operator, value}]};
    expect(fields.isConversationInputFieldDraftInvalid(field, valid)).toBe(false);
    expect(fields.isConversationInputFieldDraftInvalid(field, invalid)).toBe(true);
    expect(fields.isConversationInputFieldDraftInvalid(field, '')).toBe(false);
  });
  it('keeps false and zero as required values and excludes file/chat from context', () => {
    const declared = [{name: 'n', type: 'number', required: true}, {name: 'b', type: 'boolean', required: true},
      {name: 'f', type: 'file'}, {name: 'c', type: 'chat'}, {name: 't', type: 'text'}, {name: 'j', type: 'json'}];
    expect(fields.buildConversationInputFieldData(declared, {n: '0', b: false, f: ['file'], c: 'chat', t: ' trim ', j: '{"a":1}'}))
      .toEqual({n: 0, b: false, t: 'trim', j: {a: 1}});
    expect(fields.isConversationInputFieldDraftInvalid(declared[1], false)).toBe(false);
  });
  it('localizes regional labels and validation messages', () => {
    const field = {name: 'n', type: 'number', required: true, labels: [{language: 'el-GR', text: 'Αριθμός'}], validation_rules: [{operator: 'greater_than', value: 4}]};
    expect(fields.conversationFieldLabel(field, 'el')).toBe('Αριθμός');
    expect(fields.conversationFieldError(field, '2', 'en')).toContain('greater than 4');
  });
});

describe('action result normalization', () => {
  it('prefers non-user messages, preserves output variables and execution time', () => {
    const result = buildActionResults({answer: ['fallback'], messages: [{role: 'user', content: 'question'}, {role: 'assistant', content: 'answer'}], execution_time_ms: 900, output_variables: [{id: 1}]});
    expect(result).toEqual([expect.objectContaining({content: 'answer', executionTimeMs: 900, output_variables: [{id: 1}]})]);
  });
  it('supports answer and media-only fallbacks', () => {
    expect(buildActionResults({answer: ['one', 'two']})).toHaveLength(2);
    expect(buildActionResults({extra_data: {document_images: ['/image.png']}})[0].images).toEqual(['/image.png']);
  });
  it('decodes HTML entities in linked document URLs', () => {
    expect(buildActionResult('<a href="https://files.test/report?a=1&amp;b=2">Report</a>', {}).links).toEqual(['https://files.test/report?a=1&b=2']);
  });
  it('deduplicates media and inline images and keeps non-image document links', () => {
    const image = 'https://files.test/a.png', pdf = 'https://files.test/guide.pdf';
    const result = buildActionResult(`<p><img src="${image}"></p><p>See ${pdf}</p>`, {image, document_images: [image],
      media: [{url: '/image/no-extension', content_type: 'image/png'}], image_ref: 'id', document_urls: [pdf, image]}, 123, null, '/api');
    expect(result.images).toEqual([image, '/api/image/file/id', '/image/no-extension']);
    expect(result.content).not.toContain('<img'); expect(result.links).toEqual([pdf]);
  });
  it('sanitizes HTML and rejects executable URLs before reusing Message', () => {
    const result = buildActionResult('<script>alert(1)</script><iframe src="/bad"></iframe><img src="x" onerror="alert(1)"><a href="java\nscript:alert(1)" onclick="bad()">link</a><p style="x">safe</p>',
      {document_images: ['javascript:bad', 'data:image/svg+xml;base64,PHN2Zw=='], document_urls: ['javascript:bad']});
    expect(result.content).not.toMatch(/script|iframe|onerror|onclick|style=/); expect(result.content).toContain('safe');
    expect(result.images).toEqual([]); expect(result.links).toEqual([]);
  });
  it('reverses full conversation turns and deduplicates persisted message IDs', () => {
    const turn = [{id: 'u1', role: 'user'}, {id: 'a1', role: 'assistant'}, {id: 'u2', role: 'user'}, {id: 'a2', role: 'assistant'}];
    expect(orderActionHistory(turn, 'desc').map(item => item.id)).toEqual(['u2', 'a2', 'u1', 'a1']);
    expect(mergeActionMessages(turn.slice(0, 2), [...turn.slice(2), turn[1]], 'desc').map(item => item.id)).toEqual(['u2', 'a2', 'u1', 'a1']);
  });
});

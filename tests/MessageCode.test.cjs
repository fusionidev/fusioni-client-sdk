const React = require('react');
const {createRoot} = require('react-dom/client');
const {Message} = require('../src/components/Message');
const act = React.act ?? require('react-dom/test-utils').act;

global.IS_REACT_ACT_ENVIRONMENT = true;

describe('chat message code samples', () => {
  it.each([false, true])('preserves escaped HTML and indentation with animation %s', async shouldAnimate => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const sample = '<h2>Title</h2>\n  <strong>@agent & team</strong>\n';
    const escaped = '&lt;h2&gt;Title&lt;/h2&gt;\n  &lt;strong&gt;@agent &amp; team&lt;/strong&gt;\n';
    const message = {
      id: `code-${shouldAnimate}`,
      role: 'assistant',
      content: `<p>Use <code>heading</code> in the template.</p><pre><code>${escaped}</code></pre>`,
      shouldAnimate,
      loading: false,
    };

    jest.useFakeTimers();
    try {
      await act(async () => root.render(React.createElement(Message, {message, agencyId: 'agency'})));
      if (shouldAnimate) {
        await act(async () => jest.runAllTimers());
      }

      const block = container.querySelector('pre > code');
      expect(block?.textContent).toBe(sample);
      expect(block.children).toHaveLength(0);
      expect(container.querySelector('p > code')?.textContent).toBe('heading');
    } finally {
      await act(async () => root.unmount());
      jest.useRealTimers();
    }
  });
});

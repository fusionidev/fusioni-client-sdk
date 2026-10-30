const React = require('react');
const {createRoot} = require('react-dom/client');
const act = React.act ?? require('react-dom/test-utils').act;
const {FloatingButton} = require('../src/components/FloatingButton');
const {SDKClientService} = require('../src/services/SDKClientService');

global.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = props => act(() => root.render(React.createElement(FloatingButton, {
  isOpen: false, onClick: jest.fn(), ...props,
})));

it('renders the server SVG with its configured color and strips active content', () => {
  const config = new SDKClientService().mergeConfig({agencyId: 'agency'}, {
    icon: '<svg viewBox="0 0 24 24" fill="none" onload="alert(1)"><script>alert(1)</script><path d="M2 2h20" stroke="#000" onclick="alert(1)"/><circle cx="12" cy="12" r="3" fill="red"/><foreignObject><div>unsafe</div></foreignObject></svg>',
    icon_color: '#12ab34',
  });
  render(config);
  const icon = container.querySelector('.fusioni-floating-button-custom-icon');
  expect(icon.style.color).toBe('rgb(18, 171, 52)');
  expect(icon.querySelector('svg').getAttribute('viewBox')).toBe('0 0 24 24');
  expect(icon.querySelector('svg').getAttribute('fill')).toBe('none');
  expect(icon.querySelector('path').getAttribute('stroke')).toBe('currentColor');
  expect(icon.querySelector('circle').getAttribute('fill')).toBe('currentColor');
  expect(icon.querySelector('script, foreignObject, [onload], [onclick]')).toBeNull();
});

it.each([undefined, null, '', '   ', 'not an svg'])('keeps the default chat icon for %p', icon => {
  render({icon, iconColor: 'text-emerald-500'});
  expect(container.querySelector('.fusioni-floating-button-custom-icon')).toBeNull();
  expect(container.querySelector('.fusioni-floating-button-icon').getAttribute('width')).toBe('32');
  expect(container.querySelector('.fusioni-floating-button-icon').style.color).toBe('rgb(16, 185, 129)');
  expect(container.querySelector('button').getAttribute('aria-label')).toBe('Open chat');
});

it('preserves SVG paints without a configured color and shows the close icon while open', () => {
  const icon = '<svg fill="none"><path d="M1 1h20" stroke="red"/></svg>';
  render({icon});
  expect(container.querySelector('path').getAttribute('stroke')).toBe('red');
  render({icon, iconColor: 'blue', isOpen: true});
  expect(container.querySelector('.fusioni-floating-button-custom-icon')).toBeNull();
  expect(container.querySelector('button').getAttribute('aria-label')).toBe('Close chat');
  expect(container.querySelector('.fusioni-floating-button-icon').style.color).toBe('blue');
});

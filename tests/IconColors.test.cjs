const React = require('react');
const {createRoot} = require('react-dom/client');
const act = React.act ?? require('react-dom/test-utils').act;
const {ActionIcon, BotIcon} = require('../src/components/ActionIcon');
const {FloatingButton} = require('../src/components/FloatingButton');
const {safeSvg} = require('../src/utils/svg');
const {readFileSync} = require('fs');
const {join} = require('path');

global.IS_REACT_ACT_ENVIRONMENT = true;

// The SVG shown by fusion-web's icon selector in the reported regression.
const svg = readFileSync(join(__dirname, 'fixtures/sparking-robot.svg'), 'utf8');

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

describe.each([
  ['bot', (icon, color) => React.createElement(BotIcon, {icon, color})],
  ['action', (icon, color) => React.createElement(ActionIcon, {icon, color, state: 'idle'})],
  ['floating button', (icon, color) => React.createElement(FloatingButton, {icon, iconColor: color, isOpen: false, onClick: jest.fn()})],
])('%s SVG color', (_name, render) => {
  it.each([
    ['#aabbcc', 'rgb(170, 187, 204)'],
    ['text-emerald-500', 'rgb(16, 185, 129)'],
    ['text-white', 'rgb(255, 255, 255)'],
  ])('applies %s while preserving the robot gradient, facial details and shading', (color, expected) => {
    act(() => root.render(render(svg, color)));
    const icon = container.querySelector('svg');
    expect(icon.parentElement.style.color).toBe(expected);
    const gradient = icon.querySelector('linearGradient');
    expect(gradient).not.toBeNull();
    expect(gradient.getAttribute('gradientUnits')).toBe('userSpaceOnUse');
    expect(icon.querySelector('path[fill^="url("]').getAttribute('fill')).toBe(`url(#${gradient.id})`);
    expect(gradient.querySelector('stop').getAttribute('stop-color')).toBe('currentColor');
    expect(gradient.querySelectorAll('stop')[1].getAttribute('stop-opacity')).toBe('0.7');
    const face = icon.querySelector('path[fill="#000"]');
    expect(face.getAttribute('fill-opacity')).toBe('0.2');
    expect(icon.querySelector('rect[fill="#fff"]')).not.toBeNull();
    expect(icon.querySelector('path[fill="#fff"]').getAttribute('fill-opacity')).toBe('0.4');
    expect(icon.querySelector('ellipse').getAttribute('fill-opacity')).toBe('0.15');
    expect(icon.getAttribute('fill-rule')).toBe('evenodd');
  });

  it('updates the color without replacing the SVG artwork', () => {
    act(() => root.render(render(svg, '#123456')));
    const icon = container.querySelector('svg');
    const path = icon.querySelector('path').getAttribute('d');
    act(() => root.render(render(svg, '#fedcba')));
    expect(container.querySelector('svg')).toBe(icon);
    expect(icon.parentElement.style.color).toBe('rgb(254, 220, 186)');
    expect(icon.querySelector('path').getAttribute('d')).toBe(path);
  });

  it('uses the configured color for SVGs with an implicit solid fill', () => {
    act(() => root.render(render('<svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/></svg>', '#123456')));
    expect(container.querySelector('svg').getAttribute('fill')).toBe('currentColor');
  });
});

it('isolates gradient ids between icons so their colors do not bleed into one another', () => {
  act(() => root.render(React.createElement(React.Fragment, null,
    React.createElement(BotIcon, {icon: svg, color: 'white'}),
    React.createElement(BotIcon, {icon: svg, color: 'red'}),
  )));
  const icons = container.querySelectorAll('svg');
  const gradients = container.querySelectorAll('linearGradient');
  expect(gradients[0].id).not.toBe(gradients[1].id);
  icons.forEach((icon, index) => {
    expect(icon.querySelector('path[fill^="url("]').getAttribute('fill')).toBe(`url(#${gradients[index].id})`);
  });
});

it('preserves safe inline artwork styles and local masks while removing active and external content', () => {
  container.innerHTML = safeSvg(`<svg viewBox="0 0 24 24" onload="alert(1)">
    <defs>
      <mask id="cutout"><rect width="24" height="24" fill="white"/><circle cx="12" cy="12" r="3" fill="black"/></mask>
      <linearGradient id="remote" href="https://example.com/paint.svg#g"/>
    </defs>
    <path d="M0 0h24v24H0z" style="fill:currentColor;fill-opacity:0.6;stroke:none;position:fixed" mask="url(#cutout)"/>
    <rect fill="url(https://example.com/paint.svg#g)" onclick="alert(1)"/>
    <circle fill="url(#missing)"/>
    <script>alert(1)</script><style>body{display:none}</style><foreignObject><img src="bad"/></foreignObject>
  </svg>`, true);
  const icon = container.querySelector('svg');
  const path = icon.querySelector('path');
  expect(path.getAttribute('fill')).toBe('currentColor');
  expect(path.getAttribute('fill-opacity')).toBe('0.6');
  expect(path.getAttribute('stroke')).toBe('none');
  expect(path.getAttribute('mask')).toBe(`url(#${icon.querySelector('mask').id})`);
  expect(icon.querySelector('linearGradient').hasAttribute('href')).toBe(false);
  expect(icon.querySelector('svg > rect').hasAttribute('fill')).toBe(false);
  expect(icon.querySelector('svg > circle').hasAttribute('fill')).toBe(false);
  expect(icon.querySelector('[onload], [onclick], [style], script, style, foreignObject, img')).toBeNull();
  expect(icon.hasAttribute('onload')).toBe(false);
});

it.each([BotIcon, ActionIcon])('accepts CSS colors for named icons in %p', Component => {
  act(() => root.render(React.createElement(Component, {icon: 'iconoirBrain', color: '#123456', state: 'idle'})));
  expect(container.querySelector('svg').getAttribute('stroke')).toBe('#123456');
});
